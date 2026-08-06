import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { signToken } from "@/utils/jwt";
import { authenticate } from "@/middleware/auth";
import { ApiError } from "@/utils/errors";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true, branches: { include: { branch: true } } },
  });

  if (!user || !user.isActive) throw ApiError.unauthorized("Invalid email or password");
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const branchIds = user.branches.map((b) => b.branchId);
  const defaultBranch = user.branches.find((b) => b.isDefault)?.branchId ?? branchIds[0] ?? null;
  const permissions = user.role.permissions as string[];

  const token = signToken({
    userId: user.id,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions,
    branchIds,
    defaultBranchId: defaultBranch,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions,
      branches: user.branches.map((b) => ({ id: b.branch.id, name: b.branch.name, isDefault: b.isDefault })),
    },
  });
});

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { role: true, branches: { include: { branch: true } } },
  });
  if (!user) throw ApiError.notFound("User not found");
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions,
    branches: user.branches.map((b) => ({ id: b.branch.id, name: b.branch.name, isDefault: b.isDefault })),
  });
});
