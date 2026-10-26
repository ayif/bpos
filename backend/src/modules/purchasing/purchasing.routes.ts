import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch } from "@/middleware/auth";
import { generateCode } from "@/utils/codes";
import { receiveStock } from "@/modules/stock/stock.service";
import { postPurchaseJournal } from "@/modules/accounting/accounting.service";
import { ApiError } from "@/utils/errors";
import { calculateReorder } from "./reorder.calc";

export const purchasingRouter = Router();
purchasingRouter.use(authenticate);

// ---- Suppliers ----
purchasingRouter.get("/suppliers", requirePermission("purchasing.view"), async (_req, res) => {
  res.json(await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
});

purchasingRouter.post("/suppliers", requirePermission("purchasing.manage"), async (req, res) => {
  const body = z
    .object({ name: z.string().min(1), contact: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional() })
    .parse(req.body);
  res.status(201).json(await prisma.supplier.create({ data: body }));
});

purchasingRouter.put("/suppliers/:id", requirePermission("purchasing.manage"), async (req, res) => {
  const body = z
    .object({ name: z.string().optional(), contact: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional() })
    .parse(req.body);
  res.json(await prisma.supplier.update({ where: { id: req.params.id }, data: body }));
});

// ---- Purchase Orders ----
const poSchema = z.object({
  supplierId: z.string(),
  note: z.string().optional(),
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive(), unitCost: z.number().min(0) })).min(1),
});

purchasingRouter.post("/purchase-orders", resolveBranch, requirePermission("purchasing.manage"), async (req, res) => {
  const body = poSchema.parse(req.body);
  const po = await prisma.purchaseOrder.create({
    data: {
      code: generateCode("PO"),
      supplierId: body.supplierId,
      branchId: req.branchId!,
      note: body.note,
      status: "PENDING_APPROVAL",
      items: { create: body.items },
    },
    include: { items: true, supplier: true },
  });
  res.status(201).json(po);
});

purchasingRouter.get("/purchase-orders", resolveBranch, requirePermission("purchasing.view"), async (req, res) => {
  const pos = await prisma.purchaseOrder.findMany({
    where: { branchId: req.branchId },
    include: { items: { include: { product: true } }, supplier: true, receipts: true, decidedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(pos);
});

purchasingRouter.get("/reorder-suggestions", resolveBranch, requirePermission("purchasing.view"), async (req, res) => {
  const query = z
    .object({
      days: z.coerce.number().int().min(7).max(180).default(30),
      coverDays: z.coerce.number().int().min(1).max(90).default(14),
    })
    .parse(req.query);
  const branchId = req.branchId!;
  const since = new Date();
  since.setDate(since.getDate() - query.days);

  const [products, soldItems] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        stocks: { where: { branchId } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          branchId,
          createdAt: { gte: since },
          status: "COMPLETED",
        },
      },
      select: { productId: true, qty: true },
    }),
  ]);

  const soldByProduct = new Map<string, number>();
  for (const item of soldItems) {
    soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.qty);
  }

  const suggestions = products
    .map((product) => {
      const currentStock = product.stocks[0]?.qty ?? 0;
      const soldQty = soldByProduct.get(product.id) ?? 0;
      const recommendation = calculateReorder({
        soldQty,
        currentStock,
        minStock: product.minStock,
        historyDays: query.days,
        coverDays: query.coverDays,
      });

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category?.name ?? null,
        currentStock,
        minStock: product.minStock,
        soldQty,
        averageDailySales: recommendation.averageDailySales,
        targetStock: recommendation.targetStock,
        recommendedQty: recommendation.recommendedQty,
        unitCost: Number(product.costPrice),
      };
    })
    .filter((product) => product.recommendedQty > 0);

  res.json({
    branchId,
    historyDays: query.days,
    coverDays: query.coverDays,
    generatedAt: new Date(),
    items: suggestions,
  });
});

// ---- PO Approval (single-level: BRANCH_MANAGER/OWNER/SUPER_ADMIN via purchasing.approve) ----
const decisionSchema = z.object({ note: z.string().optional() });

purchasingRouter.post("/purchase-orders/:id/approve", resolveBranch, requirePermission("purchasing.approve"), async (req, res) => {
  const body = decisionSchema.parse(req.body);
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: req.params.id } });
  if (po.branchId !== req.branchId) throw ApiError.forbidden("You do not have access to this branch");
  if (po.status !== "PENDING_APPROVAL") throw ApiError.badRequest(`PO is already ${po.status}, cannot approve`);

  const updated = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { status: "APPROVED", decidedById: req.user!.userId, decidedAt: new Date(), decisionNote: body.note },
    include: { items: true, supplier: true },
  });
  res.json(updated);
});

purchasingRouter.post("/purchase-orders/:id/reject", resolveBranch, requirePermission("purchasing.approve"), async (req, res) => {
  const body = decisionSchema.parse(req.body);
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: req.params.id } });
  if (po.branchId !== req.branchId) throw ApiError.forbidden("You do not have access to this branch");
  if (po.status !== "PENDING_APPROVAL") throw ApiError.badRequest(`PO is already ${po.status}, cannot reject`);

  const updated = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { status: "REJECTED", decidedById: req.user!.userId, decidedAt: new Date(), decisionNote: body.note },
    include: { items: true, supplier: true },
  });
  res.json(updated);
});

// ---- Goods Receipt (penerimaan barang) — updates stock (FIFO batch) + journal ----
const receiptSchema = z.object({
  poId: z.string().optional(),
  note: z.string().optional(),
  onCredit: z.boolean().optional(),
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive(), unitCost: z.number().min(0) })).min(1),
});

purchasingRouter.post("/goods-receipts", resolveBranch, requirePermission("purchasing.receive"), async (req, res) => {
  const body = receiptSchema.parse(req.body);
  const branchId = req.branchId!;

  if (body.poId) {
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: body.poId } });
    if (po.branchId !== branchId) throw ApiError.forbidden("You do not have access to this branch");
    if (po.status !== "APPROVED") throw ApiError.badRequest(`PO must be APPROVED before receiving goods (current status: ${po.status})`);
  }

  const receipt = await prisma.$transaction(async (tx) => {
    const created = await tx.goodsReceipt.create({
      data: { code: generateCode("GR"), poId: body.poId, branchId, note: body.note },
    });

    let totalCost = 0;
    for (const item of body.items) {
      totalCost += item.qty * item.unitCost;
      await tx.goodsReceiptItem.create({
        data: { receiptId: created.id, productId: item.productId, qty: item.qty, unitCost: item.unitCost },
      });
      await receiveStock(tx, {
        productId: item.productId,
        branchId,
        qty: item.qty,
        unitCost: item.unitCost,
        sourceType: "PURCHASE",
        sourceRefId: created.id,
        movementType: "PURCHASE_IN",
        refType: "GoodsReceipt",
        refId: created.id,
        userId: req.user!.userId,
      });
    }

    if (body.poId) {
      await tx.purchaseOrder.update({ where: { id: body.poId }, data: { status: "RECEIVED" } });
    }

    await postPurchaseJournal(tx, { branchId, refId: created.id, totalCost, onCredit: body.onCredit });

    return tx.goodsReceipt.findUniqueOrThrow({ where: { id: created.id }, include: { items: { include: { product: true } } } });
  });

  res.status(201).json(receipt);
});

purchasingRouter.get("/goods-receipts", resolveBranch, requirePermission("purchasing.view"), async (req, res) => {
  const receipts = await prisma.goodsReceipt.findMany({
    where: { branchId: req.branchId },
    include: { items: { include: { product: true } }, po: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(receipts);
});
