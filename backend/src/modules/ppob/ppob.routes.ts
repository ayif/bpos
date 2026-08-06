import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch } from "@/middleware/auth";
import { generateCode } from "@/utils/codes";
import { digiflazzInquiry, mapDigiflazzStatus, DigiflazzError, DigiflazzResult } from "./digiflazz.client";
import { ApiError } from "@/utils/errors";
import { env } from "@/config/env";

export const ppobRouter = Router();

// Applies a terminal (SUCCESS/FAILED) or PENDING result to a transaction.
// Shared by the real Digiflazz callback and the mock-mode auto-resolver so
// both paths go through the exact same state transition logic. Ignores
// unknown refIds and duplicate calls on an already-terminal transaction —
// Digiflazz retries callbacks, and this keeps that idempotent.
async function applyDigiflazzResult(refId: string, result: Pick<DigiflazzResult, "status" | "rc" | "message" | "sn">) {
  const tx = await prisma.ppobTransaction.findUnique({ where: { refId } });
  if (!tx) return null;
  if (tx.status !== "PENDING") return tx; // already terminal — ignore late/duplicate callback

  const status = mapDigiflazzStatus(result);
  return prisma.ppobTransaction.update({
    where: { refId },
    data: { status, message: result.message ?? null, sn: result.sn ?? null },
  });
}

// Simulates Digiflazz's async callback for mock-mode PENDING transactions,
// so the pending -> terminal flow is fully exercisable without a real
// provider. unref() so an in-flight timer never blocks process shutdown.
// Note: purely in-memory — a backend restart before this fires leaves the
// transaction stuck at PENDING in mock mode (a real callback isn't affected
// by our restarts, so this is a mock-only limitation).
function scheduleMockResolution(refId: string) {
  const delayMs = 4000 + Math.random() * 4000;
  setTimeout(() => {
    const success = Math.random() < 0.75;
    applyDigiflazzResult(refId, success
      ? { status: "Sukses", rc: "00", message: "Simulasi transaksi berhasil (mock mode, async)", sn: `MOCKSN-${refId}` }
      : { status: "Gagal", rc: "51", message: "Simulasi gagal saat diproses provider (mock mode, async)", sn: null }
    ).catch((err) => console.error(`[ppob] mock auto-resolve failed for ${refId}:`, err));
  }, delayMs).unref();
}

// ---- Digiflazz callback (webhook) — NOT behind `authenticate`; Digiflazz
// calls this directly and cannot present our JWTs. Protected instead by a
// shared-secret token configured in the callback URL's query string. ----
const callbackSchema = z.object({
  data: z.object({
    ref_id: z.string(),
    status: z.string().optional(),
    rc: z.string().optional(),
    message: z.string().optional(),
    sn: z.string().nullable().optional(),
  }),
});

ppobRouter.post("/callback", async (req, res) => {
  if (!env.digiflazz.callbackToken) {
    throw ApiError.badGateway("DIGIFLAZZ_CALLBACK_TOKEN is not configured on this server");
  }
  if (req.query.token !== env.digiflazz.callbackToken) {
    throw ApiError.unauthorized("Invalid callback token");
  }

  const body = callbackSchema.parse(req.body);
  const updated = await applyDigiflazzResult(body.data.ref_id, {
    status: body.data.status ?? "",
    rc: body.data.rc ?? "",
    message: body.data.message ?? "",
    sn: body.data.sn ?? null,
  });
  if (!updated) throw ApiError.notFound("Unknown ref_id");
  res.json({ ok: true });
});

ppobRouter.use(authenticate, resolveBranch);

// ---- PPOB product catalog (synced from Digiflazz, or manually managed while in mock mode) ----
ppobRouter.get("/products", requirePermission("ppob.view"), async (req, res) => {
  const { category } = req.query as Record<string, string>;
  const where: any = { isActive: true };
  if (category) where.category = category;
  res.json(await prisma.ppobProduct.findMany({ where, orderBy: { productName: "asc" } }));
});

ppobRouter.post("/products", requirePermission("ppob.manage"), async (req, res) => {
  const body = z
    .object({
      buyerSkuCode: z.string(),
      productName: z.string(),
      category: z.string(),
      brand: z.string().optional(),
      price: z.number().positive(),
    })
    .parse(req.body);
  res.status(201).json(await prisma.ppobProduct.create({ data: body }));
});

// ---- Top up / bill payment (mocked unless DIGIFLAZZ_MODE=live) ----
const payRequestSchema = z.object({ ppobProductId: z.string(), customerNo: z.string().min(1) });

ppobRouter.post("/transactions", requirePermission("ppob.transact"), async (req, res) => {
  const body = payRequestSchema.parse(req.body);
  const product = await prisma.ppobProduct.findUnique({ where: { id: body.ppobProductId } });
  if (!product) throw ApiError.notFound("PPOB product not found");

  const refId = generateCode("PPOB");

  let result: DigiflazzResult;
  try {
    result = await digiflazzInquiry(product.buyerSkuCode, body.customerNo, refId);
  } catch (err) {
    // The provider was never reached / never accepted the request — do not
    // persist a transaction record that would be left dangling forever.
    if (err instanceof DigiflazzError) throw ApiError.badGateway(err.message);
    throw err;
  }

  const status = mapDigiflazzStatus(result);

  const tx = await prisma.ppobTransaction.create({
    data: {
      refId,
      branchId: req.branchId!,
      ppobProductId: product.id,
      customerNo: body.customerNo,
      amount: product.price,
      sellPrice: product.price,
      status,
      message: result.message ?? null,
      sn: result.sn ?? null,
    },
    include: { ppobProduct: true },
  });

  if (status === "PENDING" && env.digiflazz.mode === "mock") {
    scheduleMockResolution(refId);
  }

  res.status(201).json(tx);
});

ppobRouter.get("/transactions", requirePermission("ppob.view"), async (req, res) => {
  const txs = await prisma.ppobTransaction.findMany({
    where: { branchId: req.branchId },
    include: { ppobProduct: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(txs);
});

ppobRouter.get("/transactions/:refId/status", requirePermission("ppob.view"), async (req, res) => {
  const tx = await prisma.ppobTransaction.findUnique({ where: { refId: req.params.refId }, include: { ppobProduct: true } });
  if (!tx) throw ApiError.notFound("Transaction not found");
  res.json(tx);
});
