import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch } from "@/middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(authenticate, resolveBranch);

function dateRange(query: Record<string, string>) {
  const from = query.from ? new Date(query.from) : new Date(new Date().setDate(new Date().getDate() - 30));
  const to = query.to ? new Date(query.to) : new Date();
  return { from, to };
}

async function salesData(branchId: string | undefined, from: Date, to: Date) {
  return prisma.sale.findMany({
    where: { branchId, createdAt: { gte: from, lte: to }, status: { in: ["COMPLETED", "PARTIALLY_RETURNED"] } },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// ---- Sales & profit report ----
reportsRouter.get("/sales", requirePermission("report.view"), async (req, res) => {
  const { from, to } = dateRange(req.query as Record<string, string>);
  const sales = await salesData(req.branchId, from, to);

  let totalSales = 0;
  let totalCogs = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const sale of sales) {
    totalSales += Number(sale.grandTotal);
    totalDiscount += Number(sale.discountTotal);
    totalTax += Number(sale.taxTotal);
    for (const item of sale.items) totalCogs += Number(item.unitCost) * item.qty;
  }

  res.json({
    period: { from, to },
    transactionCount: sales.length,
    totalSales,
    totalDiscount,
    totalTax,
    totalCogs,
    grossProfit: totalSales - totalCogs,
    sales: sales.map((s) => ({
      id: s.id,
      invoiceNo: s.invoiceNo,
      date: s.createdAt,
      grandTotal: Number(s.grandTotal),
      itemCount: s.items.length,
    })),
  });
});

// ---- Best-selling products ----
reportsRouter.get("/best-sellers", requirePermission("report.view"), async (req, res) => {
  const { from, to } = dateRange(req.query as Record<string, string>);
  const sales = await salesData(req.branchId, from, to);

  const map = new Map<string, { productId: string; name: string; qty: number; revenue: number; cogs: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const key = item.productId;
      if (!map.has(key)) map.set(key, { productId: key, name: item.product.name, qty: 0, revenue: 0, cogs: 0 });
      const entry = map.get(key)!;
      entry.qty += item.qty;
      entry.revenue += Number(item.lineTotal);
      entry.cogs += Number(item.unitCost) * item.qty;
    }
  }

  const rows = Array.from(map.values())
    .map((r) => ({ ...r, profit: r.revenue - r.cogs }))
    .sort((a, b) => b.qty - a.qty);

  res.json({ period: { from, to }, products: rows });
});

// ---- Export: CSV ----
reportsRouter.get("/sales/export.csv", requirePermission("report.view"), async (req, res) => {
  const { from, to } = dateRange(req.query as Record<string, string>);
  const sales = await salesData(req.branchId, from, to);

  const header = "Invoice,Tanggal,Subtotal,Diskon,Pajak,Total\n";
  const rows = sales
    .map((s) => [s.invoiceNo, s.createdAt.toISOString(), s.subtotal, s.discountTotal, s.taxTotal, s.grandTotal].join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.csv");
  res.send(header + rows);
});

// ---- Export: Excel ----
reportsRouter.get("/sales/export.xlsx", requirePermission("report.view"), async (req, res) => {
  const { from, to } = dateRange(req.query as Record<string, string>);
  const sales = await salesData(req.branchId, from, to);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales");
  sheet.columns = [
    { header: "Invoice", key: "invoice", width: 18 },
    { header: "Tanggal", key: "date", width: 20 },
    { header: "Subtotal", key: "subtotal", width: 14 },
    { header: "Diskon", key: "discount", width: 14 },
    { header: "Pajak", key: "tax", width: 14 },
    { header: "Total", key: "total", width: 14 },
  ];
  sales.forEach((s) =>
    sheet.addRow({
      invoice: s.invoiceNo,
      date: s.createdAt.toISOString(),
      subtotal: Number(s.subtotal),
      discount: Number(s.discountTotal),
      tax: Number(s.taxTotal),
      total: Number(s.grandTotal),
    })
  );

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

// ---- Export: PDF ----
reportsRouter.get("/sales/export.pdf", requirePermission("report.view"), async (req, res) => {
  const { from, to } = dateRange(req.query as Record<string, string>);
  const sales = await salesData(req.branchId, from, to);
  const total = sales.reduce((s, x) => s + Number(x.grandTotal), 0);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");

  const doc = new PDFDocument({ margin: 30 });
  doc.pipe(res);
  doc.fontSize(16).text("Laporan Penjualan", { align: "center" });
  doc.fontSize(10).text(`Periode: ${from.toLocaleDateString("id-ID")} - ${to.toLocaleDateString("id-ID")}`);
  doc.moveDown();
  sales.forEach((s) => {
    doc.text(`${s.invoiceNo}  |  ${s.createdAt.toLocaleString("id-ID")}  |  Rp ${Number(s.grandTotal).toLocaleString("id-ID")}`);
  });
  doc.moveDown();
  doc.fontSize(12).text(`Total: Rp ${total.toLocaleString("id-ID")}`, { align: "right" });
  doc.end();
});
