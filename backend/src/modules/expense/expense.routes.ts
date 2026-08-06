import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch } from "@/middleware/auth";
import { generateCode } from "@/utils/codes";
import { postExpenseJournal } from "@/modules/accounting/accounting.service";

export const expenseRouter = Router();
expenseRouter.use(authenticate, resolveBranch);

expenseRouter.get("/categories", requirePermission("expense.view"), async (_req, res) => {
  res.json(await prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }));
});

expenseRouter.post("/categories", requirePermission("expense.manage"), async (req, res) => {
  const body = z.object({ name: z.string().min(1) }).parse(req.body);
  res.status(201).json(await prisma.expenseCategory.create({ data: body }));
});

expenseRouter.get("/", requirePermission("expense.view"), async (req, res) => {
  const expenses = await prisma.expense.findMany({
    where: { branchId: req.branchId },
    include: { category: true, user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(expenses);
});

const expenseSchema = z.object({
  categoryId: z.string(),
  amount: z.number().positive(),
  description: z.string().optional(),
});

expenseRouter.post("/", requirePermission("expense.manage"), async (req, res) => {
  const body = expenseSchema.parse(req.body);
  const branchId = req.branchId!;

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: { code: generateCode("EXP"), branchId, categoryId: body.categoryId, amount: body.amount, description: body.description, userId: req.user!.userId },
    });
    await postExpenseJournal(tx, { branchId, expenseId: created.id, amount: body.amount });
    return created;
  });

  res.status(201).json(expense);
});
