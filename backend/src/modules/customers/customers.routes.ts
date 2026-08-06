import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission } from "@/middleware/auth";
import { ApiError } from "@/utils/errors";

export const customersRouter = Router();
customersRouter.use(authenticate);

// ---- Price levels ----
customersRouter.get("/price-levels", requirePermission("customer.view"), async (_req, res) => {
  res.json(await prisma.priceLevel.findMany({ orderBy: { minPoints: "asc" } }));
});

customersRouter.post("/price-levels", requirePermission("customer.manage"), async (req, res) => {
  const body = z.object({ name: z.string().min(1), description: z.string().optional(), minPoints: z.number().int().min(0).default(0) }).parse(req.body);
  res.status(201).json(await prisma.priceLevel.create({ data: body }));
});

// ---- Customers ----
customersRouter.get("/", requirePermission("customer.view"), async (req, res) => {
  const { q } = req.query as Record<string, string>;
  const where: any = { isActive: true };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }];
  res.json(await prisma.customer.findMany({ where, include: { priceLevel: true }, orderBy: { name: "asc" }, take: 100 }));
});

customersRouter.get("/:id", requirePermission("customer.view"), async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { priceLevel: true, loyaltyTransactions: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!customer) throw ApiError.notFound("Customer not found");
  res.json(customer);
});

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
});

customersRouter.post("/", requirePermission("customer.manage"), async (req, res) => {
  const body = customerSchema.parse(req.body);
  res.status(201).json(await prisma.customer.create({ data: body }));
});

customersRouter.put("/:id", requirePermission("customer.manage"), async (req, res) => {
  const body = customerSchema.partial().parse(req.body);
  res.json(await prisma.customer.update({ where: { id: req.params.id }, data: body }));
});

// Recompute price level based on accumulated points vs. PriceLevel.minPoints thresholds.
async function autoAssignPriceLevel(customerId: string) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  const eligible = await prisma.priceLevel.findMany({ where: { minPoints: { lte: customer.points } }, orderBy: { minPoints: "desc" }, take: 1 });
  if (eligible[0] && eligible[0].id !== customer.priceLevelId) {
    await prisma.customer.update({ where: { id: customerId }, data: { priceLevelId: eligible[0].id } });
  }
}

// ---- Loyalty: redeem points ----
customersRouter.post("/:id/loyalty/redeem", requirePermission("customer.manage"), async (req, res) => {
  const body = z.object({ points: z.number().int().positive(), note: z.string().optional() }).parse(req.body);
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) throw ApiError.notFound("Customer not found");
  if (customer.points < body.points) throw ApiError.badRequest("Insufficient points");

  await prisma.$transaction([
    prisma.customer.update({ where: { id: req.params.id }, data: { points: { decrement: body.points } } }),
    prisma.loyaltyTransaction.create({ data: { customerId: req.params.id, type: "REDEEM", points: -body.points, note: body.note } }),
  ]);

  await autoAssignPriceLevel(req.params.id);
  res.json(await prisma.customer.findUnique({ where: { id: req.params.id } }));
});

customersRouter.post("/:id/loyalty/adjust", requirePermission("customer.manage"), async (req, res) => {
  const body = z.object({ points: z.number().int(), note: z.string().optional() }).parse(req.body);
  await prisma.$transaction([
    prisma.customer.update({ where: { id: req.params.id }, data: { points: { increment: body.points } } }),
    prisma.loyaltyTransaction.create({ data: { customerId: req.params.id, type: "ADJUST", points: body.points, note: body.note } }),
  ]);
  await autoAssignPriceLevel(req.params.id);
  res.json(await prisma.customer.findUnique({ where: { id: req.params.id } }));
});
