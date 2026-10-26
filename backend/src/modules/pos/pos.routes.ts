import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch } from "@/middleware/auth";
import { generateCode } from "@/utils/codes";
import { consumeStockFifo, receiveStock } from "@/modules/stock/stock.service";
import { postSaleJournal } from "@/modules/accounting/accounting.service";
import { ApiError } from "@/utils/errors";
import { computeSaleTotals } from "@/modules/pos/pos.calc";

export const posRouter = Router();
posRouter.use(authenticate, resolveBranch);

const saleSchema = z.object({
  customerId: z.string().optional(),
  shiftId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        qty: z.number().int().positive(),
        discount: z.number().min(0).default(0),
      })
    )
    .min(1),
  discountTotal: z.number().min(0).default(0),
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "TRANSFER", "QRIS"]),
        amount: z.number().positive(),
        refNo: z.string().optional(),
      })
    )
    .min(1),
});

// ---- Create sale (checkout) ----
posRouter.post("/sales", requirePermission("pos.sell"), async (req, res) => {
  const body = saleSchema.parse(req.body);
  const branchId = req.branchId!;

  const products = await prisma.product.findMany({
    where: { id: { in: body.items.map((i) => i.productId) } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of body.items) {
    if (!productMap.has(item.productId)) throw ApiError.badRequest(`Unknown product ${item.productId}`);
  }

  const { subtotal, taxTotal, discountTotal, grandTotal, lines: lineData } = computeSaleTotals(
    body.items.map((item) => ({ product: productMap.get(item.productId)!, item })),
    body.discountTotal
  );

  const paidTotal = body.payments.reduce((s, p) => s + p.amount, 0);
  if (paidTotal < grandTotal) throw ApiError.badRequest("Insufficient payment amount");
  const changeTotal = paidTotal - grandTotal;
  const paymentMethod = body.payments.length > 1 ? "MIXED" : body.payments[0].method;

  const sale = await prisma.$transaction(async (tx) => {
    let totalCogs = 0;
    const createdItems: { productId: string; qty: number; unitPrice: number; unitCost: number; discount: number; taxAmount: number; lineTotal: number }[] = [];

    const saleRecord = await tx.sale.create({
      data: {
        invoiceNo: generateCode("INV"),
        branchId,
        cashierId: req.user!.userId,
        customerId: body.customerId,
        shiftId: body.shiftId,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        paidTotal,
        changeTotal,
        paymentMethod: paymentMethod as any,
        payments: { create: body.payments.map((p) => ({ method: p.method as any, amount: p.amount, refNo: p.refNo })) },
      },
    });

    for (const line of lineData) {
      const { avgUnitCost, totalCost } = await consumeStockFifo(tx, {
        productId: line.productId,
        branchId,
        qty: line.qty,
        movementType: "SALE_OUT",
        refType: "Sale",
        refId: saleRecord.id,
        userId: req.user!.userId,
      });
      totalCogs += totalCost;

      await tx.saleItem.create({
        data: {
          saleId: saleRecord.id,
          productId: line.productId,
          qty: line.qty,
          unitPrice: line.unitPrice,
          unitCost: avgUnitCost,
          discount: line.discount,
          taxAmount: line.taxAmount,
          lineTotal: line.lineTotal,
        },
      });
    }

    // Loyalty points: 1 point per configured currency unit spent (default rate from settings)
    if (body.customerId) {
      const setting = await tx.storeSetting.findFirst({ where: { branchId } });
      const rate = setting ? Number(setting.loyaltyEarnRate) : 1;
      const pointsEarned = Math.floor((grandTotal / 1000) * rate);
      if (pointsEarned > 0) {
        await tx.customer.update({ where: { id: body.customerId }, data: { points: { increment: pointsEarned } } });
        await tx.loyaltyTransaction.create({
          data: { customerId: body.customerId, type: "EARN", points: pointsEarned, refType: "Sale", refId: saleRecord.id },
        });
      }
    }

    await postSaleJournal(tx, {
      saleId: saleRecord.id,
      branchId,
      grandTotal,
      taxTotal,
      totalCogs,
      paymentMethod,
    });

    return tx.sale.findUniqueOrThrow({
      where: { id: saleRecord.id },
      include: { items: { include: { product: true } }, payments: true, customer: true },
    });
  });

  res.status(201).json(sale);
});

posRouter.get("/sales", requirePermission("pos.view"), async (req, res) => {
  const sales = await prisma.sale.findMany({
    where: { branchId: req.branchId },
    include: { items: true, payments: true, customer: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(sales);
});

posRouter.get("/sales/:id", requirePermission("pos.view"), async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } }, payments: true, customer: true, branch: true, cashier: true },
  });
  if (!sale) throw ApiError.notFound("Sale not found");
  if (sale.branchId !== req.branchId) throw ApiError.forbidden("You do not have access to this branch");
  res.json(sale);
});

// ---- Receipt as PDF (works for 58mm/80mm/A4 depending on store settings) ----
posRouter.get("/sales/:id/receipt.pdf", requirePermission("pos.view"), async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } }, payments: true, branch: true, customer: true, cashier: true },
  });
  if (!sale) throw ApiError.notFound("Sale not found");
  if (sale.branchId !== req.branchId) throw ApiError.forbidden("You do not have access to this branch");

  const setting =
    (await prisma.storeSetting.findUnique({ where: { branchId: sale.branchId } })) ??
    (await prisma.storeSetting.findFirst({ where: { branchId: null } }));
  const isA4 = setting?.receiptSize === "A4";
  const width = setting?.receiptSize === "80mm" ? 227 : isA4 ? 595 : 164;
  const margin = isA4 ? 36 : 10;
  const contentWidth = width - margin * 2;
  const fontSize = isA4 ? 10 : 8;
  const estimatedLines = (text: string, size = fontSize) =>
    Math.max(1, Math.ceil(Array.from(text).length / Math.max(1, Math.floor(contentWidth / (size * 0.6)))));
  const itemHeight = sale.items.reduce((height, item) => height + estimatedLines(item.product.name, fontSize) * (fontSize + 3) + 24, 0);
  const headerHeight =
    estimatedLines(setting?.storeName ?? "BPOS Store", isA4 ? 18 : 11) * (isA4 ? 23 : 14) +
    estimatedLines(sale.branch.name) * (fontSize + 3) +
    (setting?.address ?? sale.branch.address ? estimatedLines((setting?.address ?? sale.branch.address)!) * (fontSize + 3) : 0) +
    (setting?.phone ?? sale.branch.phone ? fontSize + 3 : 0);
  const pageHeight = Math.max(isA4 ? 842 : 400, margin * 2 + headerHeight + 150 + itemHeight + sale.payments.length * (fontSize + 5));

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${sale.invoiceNo}.pdf`);

  const doc = new PDFDocument({ size: [width, pageHeight], margin });
  doc.pipe(res);

  const formatAmount = (amount: number | string | { toString(): string }) => `Rp ${Number(amount).toLocaleString("id-ID")}`;
  const separator = () => {
    const y = doc.y + 5;
    doc.save().lineWidth(0.7).dash(2, { space: 3 }).moveTo(margin, y).lineTo(width - margin, y).stroke().restore();
    doc.y = y + 10;
  };
  const row = (label: string, value: string, options: { bold?: boolean; size?: number } = {}) => {
    const size = options.size ?? fontSize;
    doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    const y = doc.y;
    const valueWidth = doc.widthOfString(value);
    doc.text(label, margin, y, { width: contentWidth - valueWidth - 8 });
    doc.text(value, width - margin - valueWidth, y, { lineBreak: false });
    doc.y = y + Math.max(doc.heightOfString(label, { width: contentWidth - valueWidth - 8 }), size + 3) + 2;
  };

  doc.font("Helvetica-Bold").fontSize(isA4 ? 18 : 11).text(setting?.storeName ?? "BPOS Store", { align: "center" });
  doc.font("Helvetica").fontSize(fontSize).text(sale.branch.name, { align: "center" });
  const address = setting?.address ?? sale.branch.address;
  const phone = setting?.phone ?? sale.branch.phone;
  if (address) doc.text(address, { align: "center" });
  if (phone) doc.text(phone, { align: "center" });

  separator();
  row("No. Transaksi", sale.invoiceNo);
  row("Tanggal", sale.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }));
  row("Kasir", sale.cashier.name);
  if (sale.customer) row("Pelanggan", sale.customer.name);
  separator();

  sale.items.forEach((item) => {
    doc.font("Helvetica-Bold").fontSize(fontSize).text(item.product.name, { width: contentWidth });
    row(`${item.qty} x ${formatAmount(item.unitPrice)}`, formatAmount(item.lineTotal));
    if (Number(item.discount) > 0) row("Diskon item", `- ${formatAmount(item.discount)}`);
  });

  separator();
  row("Subtotal", formatAmount(sale.subtotal));
  if (Number(sale.discountTotal) > 0) row("Diskon", `- ${formatAmount(sale.discountTotal)}`);
  if (Number(sale.taxTotal) > 0) row("Pajak", formatAmount(sale.taxTotal));
  separator();
  row("TOTAL", formatAmount(sale.grandTotal), { bold: true, size: isA4 ? 14 : 10 });
  sale.payments.forEach((payment) => row(`Bayar (${payment.method})`, formatAmount(payment.amount)));
  if (Number(sale.changeTotal) > 0) row("Kembalian", formatAmount(sale.changeTotal));
  separator();
  doc.font("Helvetica").fontSize(fontSize).text("Terima kasih atas kunjungan Anda", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(isA4 ? 8 : 7).fillColor("#64748b").text("Simpan struk ini sebagai bukti pembayaran.", { align: "center" });

  doc.end();
});

// ---- Retur / Refund ----
const returnSchema = z.object({
  reason: z.string().optional(),
  items: z.array(z.object({ saleItemId: z.string(), qty: z.number().int().positive() })).min(1),
});

posRouter.post("/sales/:id/return", requirePermission("pos.refund"), async (req, res) => {
  const body = returnSchema.parse(req.body);
  const sale = await prisma.sale.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!sale) throw ApiError.notFound("Sale not found");
  if (sale.branchId !== req.branchId) throw ApiError.forbidden("You do not have access to this branch");

  const result = await prisma.$transaction(async (tx) => {
    let totalAmount = 0;
    const returnItemsData: { saleItemId: string; qty: number; amount: number }[] = [];

    for (const reqItem of body.items) {
      const saleItem = sale.items.find((si) => si.id === reqItem.saleItemId);
      if (!saleItem) throw ApiError.badRequest(`Sale item ${reqItem.saleItemId} not part of this sale`);
      if (reqItem.qty > saleItem.qty) throw ApiError.badRequest("Return qty exceeds sold qty");

      const amount = (Number(saleItem.lineTotal) / saleItem.qty) * reqItem.qty;
      totalAmount += amount;
      returnItemsData.push({ saleItemId: reqItem.saleItemId, qty: reqItem.qty, amount });

      // Return stock back in at the original FIFO cost as a fresh batch.
      await receiveStock(tx, {
        productId: saleItem.productId,
        branchId: sale.branchId,
        qty: reqItem.qty,
        unitCost: Number(saleItem.unitCost),
        sourceType: "INITIAL",
        movementType: "RETURN_IN",
        refType: "SaleReturn",
        refId: sale.id,
        userId: req.user!.userId,
      });
    }

    const saleReturn = await tx.saleReturn.create({
      data: {
        code: generateCode("RET"),
        saleId: sale.id,
        reason: body.reason,
        totalAmount,
        items: { create: returnItemsData },
      },
    });

    await tx.sale.update({
      where: { id: sale.id },
      data: { status: "PARTIALLY_RETURNED" },
    });

    return saleReturn;
  });

  res.status(201).json(result);
});
