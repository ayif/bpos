import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch } from "@/middleware/auth";
import { receiveStock } from "@/modules/stock/stock.service";
import { ApiError } from "@/utils/errors";

export const productsRouter = Router();
productsRouter.use(authenticate);

const upload = multer({ storage: multer.memoryStorage() });

// ---- Categories ----
productsRouter.get("/categories", requirePermission("product.view"), async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
});

productsRouter.post("/categories", requirePermission("product.manage"), async (req, res) => {
  const body = z.object({ name: z.string().min(1), parentId: z.string().optional() }).parse(req.body);
  res.status(201).json(await prisma.category.create({ data: body }));
});

// ---- Units ----
productsRouter.get("/units", requirePermission("product.view"), async (_req, res) => {
  res.json(await prisma.unit.findMany({ orderBy: { name: "asc" } }));
});

productsRouter.post("/units", requirePermission("product.manage"), async (req, res) => {
  const body = z.object({ name: z.string().min(1), symbol: z.string().min(1) }).parse(req.body);
  res.status(201).json(await prisma.unit.create({ data: body }));
});

// ---- Products ----
const productSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unitId: z.string().optional(),
  sellPrice: z.number().nonnegative(),
  isTaxable: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  minStock: z.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
  initialQty: z.number().int().min(0).optional(),
  initialCost: z.number().min(0).optional(),
});

productsRouter.get("/", resolveBranch, requirePermission("product.view"), async (req, res) => {
  const { q, categoryId, page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const where: any = { isActive: true };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { barcode: { contains: q, mode: "insensitive" } }];
  if (categoryId) where.categoryId = categoryId;

  const take = Math.min(parseInt(pageSize, 10) || 20, 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        unit: true,
        stocks: { where: { branchId: req.branchId } },
      },
      take,
      skip,
      orderBy: { name: "asc" },
    }),
    prisma.product.count({ where }),
  ]);

  res.json({ items, total, page: Number(page), pageSize: take });
});

productsRouter.get("/barcode/:barcode", resolveBranch, requirePermission("product.view"), async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { barcode: req.params.barcode },
    include: { stocks: { where: { branchId: req.branchId } }, unit: true },
  });
  if (!product) throw ApiError.notFound("Product not found for this barcode");
  res.json(product);
});

productsRouter.get("/:id", resolveBranch, requirePermission("product.view"), async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { category: true, unit: true, stocks: true, priceLevels: { include: { priceLevel: true } } },
  });
  if (!product) throw ApiError.notFound("Product not found");
  res.json(product);
});

productsRouter.post("/", resolveBranch, requirePermission("product.manage"), async (req, res) => {
  const body = productSchema.parse(req.body);
  const { initialQty, initialCost, ...data } = body;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: { ...data, costPrice: initialCost ?? 0 } });
    if (initialQty && initialQty > 0 && req.branchId) {
      await receiveStock(tx, {
        productId: created.id,
        branchId: req.branchId,
        qty: initialQty,
        unitCost: initialCost ?? 0,
        sourceType: "INITIAL",
        movementType: "INITIAL",
        refType: "Product",
        refId: created.id,
        userId: req.user!.userId,
      });
    }
    return created;
  });

  res.status(201).json(product);
});

productsRouter.put("/:id", requirePermission("product.manage"), async (req, res) => {
  const body = productSchema.partial().parse(req.body);
  const { initialQty, initialCost, ...data } = body;
  const product = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json(product);
});

productsRouter.delete("/:id", requirePermission("product.manage"), async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).send();
});

// ---- Excel export ----
productsRouter.get("/export/excel", resolveBranch, requirePermission("product.view"), async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true, unit: true, stocks: { where: { branchId: req.branchId } } },
    orderBy: { name: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.columns = [
    { header: "SKU", key: "sku", width: 15 },
    { header: "Barcode", key: "barcode", width: 18 },
    { header: "Name", key: "name", width: 30 },
    { header: "Category", key: "category", width: 18 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Cost Price", key: "costPrice", width: 14 },
    { header: "Sell Price", key: "sellPrice", width: 14 },
    { header: "Stock (branch)", key: "stock", width: 14 },
  ];
  products.forEach((p) => {
    sheet.addRow({
      sku: p.sku,
      barcode: p.barcode ?? "",
      name: p.name,
      category: p.category?.name ?? "",
      unit: p.unit?.symbol ?? "",
      costPrice: Number(p.costPrice),
      sellPrice: Number(p.sellPrice),
      stock: p.stocks[0]?.qty ?? 0,
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

// ---- Excel import ----
productsRouter.post("/import/excel", resolveBranch, requirePermission("product.manage"), upload.single("file"), async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Excel file is required (field name: file)");

  const workbook = new ExcelJS.Workbook();
  const fileBuffer = Buffer.isBuffer(req.file.buffer)
    ? req.file.buffer
    : Buffer.from(req.file.buffer as any) as any;
  await workbook.xlsx.load(fileBuffer as any);
  const sheet = workbook.worksheets[0];

  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const sku = String(row.getCell(1).value ?? "").trim();
    if (!sku) continue;
    const barcode = String(row.getCell(2).value ?? "").trim() || undefined;
    const name = String(row.getCell(3).value ?? "").trim();
    const costPrice = Number(row.getCell(6).value ?? 0);
    const sellPrice = Number(row.getCell(7).value ?? 0);
    const qty = Number(row.getCell(8).value ?? 0);

    try {
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        await prisma.product.update({ where: { sku }, data: { name, barcode, sellPrice, costPrice } });
        results.updated++;
      } else {
        await prisma.$transaction(async (tx) => {
          const created = await tx.product.create({ data: { sku, barcode, name, sellPrice, costPrice } });
          if (qty > 0 && req.branchId) {
            await receiveStock(tx, {
              productId: created.id,
              branchId: req.branchId!,
              qty,
              unitCost: costPrice,
              sourceType: "INITIAL",
              movementType: "INITIAL",
              refType: "ProductImport",
              userId: req.user!.userId,
            });
          }
        });
        results.created++;
      }
    } catch (err) {
      results.errors.push(`Row ${i} (${sku}): ${(err as Error).message}`);
    }
  }

  res.json(results);
});

// ---- Barcode label printing (Fitur Tambahan) ----
productsRouter.get("/labels/pdf", requirePermission("product.view"), async (req, res) => {
  const { ids, copies = "1" } = req.query as Record<string, string>;
  if (!ids) throw ApiError.badRequest("Provide ?ids=comma,separated,product,ids");
  const productIds = ids.split(",").filter(Boolean);
  const copiesPerProduct = Math.max(1, Math.min(parseInt(copies, 10) || 1, 50));

  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  const bwipjs = await import("bwip-js");
  const PDFDocumentCtor = (await import("pdfkit")).default;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=barcode-labels.pdf");

  const doc = new PDFDocumentCtor({ size: [200, 100], margin: 8 });
  doc.pipe(res);

  let first = true;
  for (const product of products) {
    if (!product.barcode) continue;
    for (let i = 0; i < copiesPerProduct; i++) {
      if (!first) doc.addPage({ size: [200, 100], margin: 8 });
      first = false;

      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: product.barcode,
        scale: 2,
        height: 10,
        includetext: true,
        textxalign: "center",
      });

      doc.fontSize(8).text(product.name, { align: "center", width: 184 });
      doc.image(png, { fit: [180, 55], align: "center" });
      doc.fontSize(9).text(`Rp ${Number(product.sellPrice).toLocaleString("id-ID")}`, { align: "center" });
    }
  }

  doc.end();
});
