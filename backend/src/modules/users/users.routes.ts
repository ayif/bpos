import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission } from "@/middleware/auth";
import { ApiError } from "@/utils/errors";

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get("/", requirePermission("user.manage"), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { role: true, branches: { include: { branch: true } } },
    orderBy: { name: "asc" },
  });
  res.json(users.map(({ passwordHash, ...u }) => u));
});

usersRouter.get("/roles", requirePermission("user.manage"), async (_req, res) => {
  res.json(await prisma.role.findMany());
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string(),
  branchIds: z.array(z.string()).min(1),
  defaultBranchId: z.string().optional(),
});

usersRouter.post("/", requirePermission("user.manage"), async (req, res) => {
  const body = createSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      roleId: body.roleId,
      branches: {
        create: body.branchIds.map((branchId) => ({ branchId, isDefault: branchId === (body.defaultBranchId ?? body.branchIds[0]) })),
      },
    },
    include: { role: true, branches: true },
  });

  const { passwordHash: _omit, ...safe } = user;
  res.status(201).json(safe);
});

const updateSchema = z.object({
  name: z.string().optional(),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

usersRouter.put("/:id", requirePermission("user.manage"), async (req, res) => {
  const body = updateSchema.parse(req.body);
  const data: any = { ...body };
  delete data.password;
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

usersRouter.post("/:id/branches", requirePermission("user.manage"), async (req, res) => {
  const body = z.object({ branchIds: z.array(z.string()).min(1), defaultBranchId: z.string().optional() }).parse(req.body);
  await prisma.userBranch.deleteMany({ where: { userId: req.params.id } });
  await prisma.userBranch.createMany({
    data: body.branchIds.map((branchId) => ({ userId: req.params.id, branchId, isDefault: branchId === (body.defaultBranchId ?? body.branchIds[0]) })),
  });
  res.json({ ok: true });
});
