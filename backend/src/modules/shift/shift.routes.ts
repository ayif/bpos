import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch, isSuperAdmin } from "@/middleware/auth";
import { ApiError } from "@/utils/errors";

export const shiftRouter = Router();
shiftRouter.use(authenticate, resolveBranch);

shiftRouter.get("/current", requirePermission("shift.manage"), async (req, res) => {
  const shift = await prisma.shift.findFirst({
    where: { branchId: req.branchId, userId: req.user!.userId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
  res.json(shift);
});

shiftRouter.post("/open", requirePermission("shift.manage"), async (req, res) => {
  const body = z.object({ openingCash: z.number().min(0) }).parse(req.body);

  const existing = await prisma.shift.findFirst({
    where: { branchId: req.branchId, userId: req.user!.userId, status: "OPEN" },
  });
  if (existing) throw ApiError.conflict("An open shift already exists for this user/branch");

  const shift = await prisma.shift.create({
    data: { branchId: req.branchId!, userId: req.user!.userId, openingCash: body.openingCash },
  });
  res.status(201).json(shift);
});

shiftRouter.post("/:id/close", requirePermission("shift.manage"), async (req, res) => {
  const body = z.object({ closingCash: z.number().min(0) }).parse(req.body);
  const shift = await prisma.shift.findUnique({ where: { id: req.params.id }, include: { sales: true } });
  if (!shift) throw ApiError.notFound("Shift not found");
  if (shift.branchId !== req.branchId) throw ApiError.forbidden("You do not have access to this branch");
  // shift.manage is held by both cashiers and managers, with no separate tier for
  // "manage anyone's shift" — so without this, any cashier could close/tamper with
  // another user's open shift. Only the shift's own owner (or a super admin) may close it.
  if (shift.userId !== req.user!.userId && !isSuperAdmin(req)) {
    throw ApiError.forbidden("You can only close your own shift");
  }

  const cashSalesTotal = shift.sales
    .filter((s) => s.paymentMethod === "CASH" || s.paymentMethod === "MIXED")
    .reduce((sum, s) => sum + Number(s.paidTotal), 0);

  const expectedCash = Number(shift.openingCash) + cashSalesTotal;
  const difference = body.closingCash - expectedCash;

  const updated = await prisma.shift.update({
    where: { id: req.params.id },
    data: { closingCash: body.closingCash, expectedCash, difference, status: "CLOSED", closedAt: new Date() },
  });

  res.json(updated);
});

shiftRouter.get("/", requirePermission("shift.manage"), async (req, res) => {
  const shifts = await prisma.shift.findMany({
    where: { branchId: req.branchId },
    include: { user: true },
    orderBy: { openedAt: "desc" },
    take: 50,
  });
  res.json(shifts);
});
