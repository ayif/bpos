import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission } from "@/middleware/auth";

export const branchesRouter = Router();
branchesRouter.use(authenticate);

branchesRouter.get("/", requirePermission("branch.view"), async (_req, res) => {
  res.json(await prisma.branch.findMany({ orderBy: { name: "asc" } }));
});

branchesRouter.post("/", requirePermission("branch.manage"), async (req, res) => {
  const body = z
    .object({ code: z.string().min(1), name: z.string().min(1), address: z.string().optional(), phone: z.string().optional() })
    .parse(req.body);
  res.status(201).json(await prisma.branch.create({ data: body }));
});

branchesRouter.put("/:id", requirePermission("branch.manage"), async (req, res) => {
  const body = z
    .object({ code: z.string().optional(), name: z.string().optional(), address: z.string().optional(), phone: z.string().optional(), isActive: z.boolean().optional() })
    .parse(req.body);
  res.json(await prisma.branch.update({ where: { id: req.params.id }, data: body }));
});
