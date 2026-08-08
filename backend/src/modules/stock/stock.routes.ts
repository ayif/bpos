import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch, isSuperAdmin, branchScope } from "@/middleware/auth";
import { generateCode } from "@/utils/codes";
import { consumeStockFifo, receiveStock, getStockQty } from "./stock.service";
import { ApiError } from "@/utils/errors";

export const stockRouter = Router();
stockRouter.use(authenticate);

// ---- Stock Transfer between branches ----

const transferSchema = z.object({
  toBranchId: z.string(),
  note: z.string().optional(),
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive() })).min(1),
});

stockRouter.post("/transfers", resolveBranch, requirePermission("stock.transfer"), async (req, res) => {
  const body = transferSchema.parse(req.body);
  const fromBranchId = req.branchId!;
  if (fromBranchId === body.toBranchId) throw ApiError.badRequest("Source and destination branch must differ");

  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.create({
      data: {
        code: generateCode("TRF"),
        fromBranchId,
        toBranchId: body.toBranchId,
        note: body.note,
        status: "RECEIVED", // simplified: immediate transfer
      },
    });

    for (const item of body.items) {
      const { avgUnitCost } = await consumeStockFifo(tx, {
        productId: item.productId,
        branchId: fromBranchId,
        qty: item.qty,
        movementType: "TRANSFER_OUT",
        refType: "StockTransfer",
        refId: transfer.id,
        userId: req.user!.userId,
      });

      await tx.stockTransferItem.create({
        data: { transferId: transfer.id, productId: item.productId, qty: item.qty, unitCost: avgUnitCost },
      });

      await receiveStock(tx, {
        productId: item.productId,
        branchId: body.toBranchId,
        qty: item.qty,
        unitCost: avgUnitCost,
        sourceType: "TRANSFER_IN",
        sourceRefId: transfer.id,
        movementType: "TRANSFER_IN",
        refType: "StockTransfer",
        refId: transfer.id,
        userId: req.user!.userId,
      });
    }

    return transfer;
  });

  res.status(201).json(result);
});

stockRouter.get("/transfers", requirePermission("stock.transfer"), async (req, res) => {
  // A transfer touches two branches (source/destination), so it doesn't fit the
  // single-`branchId` shape of branchScope() — restrict to transfers where the
  // user's own branch is either side, instead of leaking every branch's transfers.
  const where = isSuperAdmin(req)
    ? {}
    : { OR: [{ fromBranchId: { in: req.user!.branchIds } }, { toBranchId: { in: req.user!.branchIds } }] };
  const transfers = await prisma.stockTransfer.findMany({
    where,
    include: { items: { include: { product: true } }, fromBranch: true, toBranch: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(transfers);
});

// ---- Stock Opname (physical count / adjustment) ----

const opnameSchema = z.object({
  note: z.string().optional(),
  items: z.array(
    z.object({ productId: z.string(), countedQty: z.number().int().min(0) })
  ).min(1),
});

stockRouter.post("/opnames", resolveBranch, requirePermission("stock.opname"), async (req, res) => {
  const body = opnameSchema.parse(req.body);
  const branchId = req.branchId!;

  const result = await prisma.$transaction(async (tx) => {
    const opname = await tx.stockOpname.create({
      data: { code: generateCode("OPN"), branchId, note: body.note, status: "COMPLETED" },
    });

    for (const item of body.items) {
      const systemQty = await getStockQty(tx, item.productId, branchId);
      const difference = item.countedQty - systemQty;

      await tx.stockOpnameItem.create({
        data: {
          opnameId: opname.id,
          productId: item.productId,
          systemQty,
          countedQty: item.countedQty,
          difference,
        },
      });

      if (difference > 0) {
        await receiveStock(tx, {
          productId: item.productId,
          branchId,
          qty: difference,
          unitCost: 0,
          sourceType: "OPNAME",
          sourceRefId: opname.id,
          movementType: "OPNAME_ADJUST",
          refType: "StockOpname",
          refId: opname.id,
          userId: req.user!.userId,
        });
      } else if (difference < 0) {
        await consumeStockFifo(tx, {
          productId: item.productId,
          branchId,
          qty: Math.abs(difference),
          movementType: "OPNAME_ADJUST",
          refType: "StockOpname",
          refId: opname.id,
          userId: req.user!.userId,
        });
      }
    }

    return opname;
  });

  res.status(201).json(result);
});

stockRouter.get("/opnames", requirePermission("stock.opname"), async (req, res) => {
  const opnames = await prisma.stockOpname.findMany({
    where: branchScope(req, req.query.branchId as string | undefined),
    include: { items: { include: { product: true } }, branch: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(opnames);
});

stockRouter.get("/movements", resolveBranch, requirePermission("stock.view"), async (req, res) => {
  const movements = await prisma.stockMovement.findMany({
    where: { branchId: req.branchId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(movements);
});
