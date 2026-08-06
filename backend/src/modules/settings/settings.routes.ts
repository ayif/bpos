import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission, resolveBranch } from "@/middleware/auth";

export const settingsRouter = Router();
settingsRouter.use(authenticate, resolveBranch);

settingsRouter.get("/", requirePermission("settings.view"), async (req, res) => {
  let setting = await prisma.storeSetting.findFirst({ where: { branchId: req.branchId } });
  if (!setting) {
    setting = await prisma.storeSetting.findFirst({ where: { branchId: null } });
  }
  res.json(setting ?? { storeName: "BPOS Store", receiptSize: "58mm", theme: "light", taxRate: 0 });
});

const settingSchema = z.object({
  storeName: z.string().optional(),
  logoUrl: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  receiptSize: z.enum(["58mm", "80mm", "A4"]).optional(),
  printerName: z.string().optional(),
  theme: z.string().optional(),
  loyaltyEarnRate: z.number().min(0).optional(),
  loyaltyRedeemRate: z.number().min(0).optional(),
});

settingsRouter.put("/", requirePermission("settings.manage"), async (req, res) => {
  const body = settingSchema.parse(req.body);
  const branchId = req.branchId!;

  const setting = await prisma.storeSetting.upsert({
    where: { branchId },
    update: body,
    create: { branchId, ...body },
  });

  res.json(setting);
});
