import { Request, Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authenticate, requirePermission } from "@/middleware/auth";
import { ApiError } from "@/utils/errors";
import { ACCOUNT_CODES } from "@/modules/accounting/accounting.service";

const CREDIT_NORMAL_TYPES = new Set(["LIABILITY", "EQUITY", "REVENUE"]);

export const accountingRouter = Router();
accountingRouter.use(authenticate);

// Reports here take an optional `branchId` query param rather than the usual
// `X-Branch-Id` header (to allow cross-branch aggregate reports for admins).
// Without this check, any authenticated user with accounting.view could pass
// an arbitrary branchId and read another branch's financials. Non-super-admin
// users are restricted to their own branchIds; omitting branchId scopes the
// query to just those branches instead of leaking every branch's data.
function branchScope(req: Request, requestedBranchId?: string): { branchId?: string | { in: string[] } } {
  const user = req.user!;
  const isSuperAdmin = user.permissions.includes("*");

  if (requestedBranchId) {
    if (!isSuperAdmin && !user.branchIds.includes(requestedBranchId)) {
      throw ApiError.forbidden("You do not have access to this branch");
    }
    return { branchId: requestedBranchId };
  }
  if (isSuperAdmin) return {};
  return { branchId: { in: user.branchIds } };
}

// ---- Chart of accounts ----
accountingRouter.get("/accounts", requirePermission("accounting.view"), async (_req, res) => {
  res.json(await prisma.account.findMany({ orderBy: { code: "asc" } }));
});

accountingRouter.post("/accounts", requirePermission("accounting.manage"), async (req, res) => {
  const body = z
    .object({
      code: z.string().min(1),
      name: z.string().min(1),
      type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
    })
    .parse(req.body);
  res.status(201).json(await prisma.account.create({ data: body }));
});

// ---- Journal entries (read) ----
accountingRouter.get("/journal-entries", requirePermission("accounting.view"), async (req, res) => {
  const { from, to, branchId } = req.query as Record<string, string>;
  const where: any = { ...branchScope(req, branchId) };
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = new Date(from);
  if (to) where.createdAt.lte = new Date(to);

  const entries = await prisma.journalEntry.findMany({
    where,
    include: { lines: { include: { account: true } }, branch: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  res.json(entries);
});

// helper: sum debit/credit per account within an optional date range
async function trialBalance(req: Request, from?: string, to?: string, branchId?: string) {
  const scope = branchScope(req, branchId);
  const where: any = {};
  if (Object.keys(scope).length) where.entry = { ...scope };
  if (from || to) {
    where.entry = { ...(where.entry ?? {}), createdAt: {} };
    if (from) where.entry.createdAt.gte = new Date(from);
    if (to) where.entry.createdAt.lte = new Date(to);
  }

  const lines = await prisma.journalLine.findMany({ where, include: { account: true } });
  const map = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();

  for (const line of lines) {
    const key = line.accountId;
    if (!map.has(key)) {
      map.set(key, { code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0 });
    }
    const entry = map.get(key)!;
    entry.debit += Number(line.debit);
    entry.credit += Number(line.credit);
  }

  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

// ---- Laba Rugi (Profit & Loss) ----
accountingRouter.get("/reports/profit-loss", requirePermission("accounting.view"), async (req, res) => {
  const { from, to, branchId } = req.query as Record<string, string>;
  const balances = await trialBalance(req, from, to, branchId);

  const revenue = balances.filter((b) => b.type === "REVENUE");
  const expense = balances.filter((b) => b.type === "EXPENSE");

  const totalRevenue = revenue.reduce((s, r) => s + (r.credit - r.debit), 0);
  const totalExpense = expense.reduce((s, r) => s + (r.debit - r.credit), 0);

  res.json({
    period: { from: from ?? null, to: to ?? null },
    revenue: revenue.map((r) => ({ code: r.code, name: r.name, amount: r.credit - r.debit })),
    expense: expense.map((r) => ({ code: r.code, name: r.name, amount: r.debit - r.credit })),
    totalRevenue,
    totalExpense,
    netProfit: totalRevenue - totalExpense,
  });
});

// ---- Neraca (Balance Sheet) ----
accountingRouter.get("/reports/balance-sheet", requirePermission("accounting.view"), async (req, res) => {
  const { to, branchId } = req.query as Record<string, string>;
  const balances = await trialBalance(req, undefined, to, branchId);

  const assets = balances.filter((b) => b.type === "ASSET").map((b) => ({ code: b.code, name: b.name, amount: b.debit - b.credit }));
  const liabilities = balances.filter((b) => b.type === "LIABILITY").map((b) => ({ code: b.code, name: b.name, amount: b.credit - b.debit }));
  const equity = balances.filter((b) => b.type === "EQUITY").map((b) => ({ code: b.code, name: b.name, amount: b.credit - b.debit }));

  // Retained earnings plug = net profit to date (revenue - expense), added to equity side.
  const revenue = balances.filter((b) => b.type === "REVENUE").reduce((s, r) => s + (r.credit - r.debit), 0);
  const expense = balances.filter((b) => b.type === "EXPENSE").reduce((s, r) => s + (r.debit - r.credit), 0);
  const retainedEarnings = revenue - expense;

  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  const totalEquity = equity.reduce((s, e) => s + e.amount, 0) + retainedEarnings;

  res.json({
    asOf: to ?? new Date().toISOString(),
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity: [...equity, { code: "3900", name: "Retained Earnings (current)", amount: retainedEarnings }],
    totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  });
});

// ---- Arus Kas (Cash Flow) — simplified direct method based on Cash/Bank account movements ----
accountingRouter.get("/reports/cash-flow", requirePermission("accounting.view"), async (req, res) => {
  const { from, to, branchId } = req.query as Record<string, string>;
  const scope = branchScope(req, branchId);
  const where: any = { account: { code: { in: ["1000", "1010"] } } };
  if (Object.keys(scope).length) where.entry = { ...scope };
  if (from || to) {
    where.entry = { ...(where.entry ?? {}), createdAt: {} };
    if (from) where.entry.createdAt.gte = new Date(from);
    if (to) where.entry.createdAt.lte = new Date(to);
  }

  const lines = await prisma.journalLine.findMany({
    where,
    include: { entry: true, account: true },
    orderBy: { entry: { createdAt: "asc" } },
  });

  const cashIn = lines.filter((l) => Number(l.debit) > 0).reduce((s, l) => s + Number(l.debit), 0);
  const cashOut = lines.filter((l) => Number(l.credit) > 0).reduce((s, l) => s + Number(l.credit), 0);

  res.json({
    period: { from: from ?? null, to: to ?? null },
    cashIn,
    cashOut,
    netCashFlow: cashIn - cashOut,
    transactions: lines.map((l) => ({
      date: l.entry.createdAt,
      description: l.entry.description,
      refType: l.entry.refType,
      in: Number(l.debit),
      out: Number(l.credit),
    })),
  });
});

// ---- Buku Besar (General Ledger per account, with running balance) ----
accountingRouter.get("/reports/general-ledger", requirePermission("accounting.view"), async (req, res) => {
  const { accountId, from, to, branchId } = req.query as Record<string, string>;
  if (!accountId) throw ApiError.badRequest("accountId is required");

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw ApiError.notFound("Account not found");

  const creditNormal = CREDIT_NORMAL_TYPES.has(account.type);
  const scope = branchScope(req, branchId);

  const baseWhere: any = { accountId };
  if (Object.keys(scope).length) baseWhere.entry = { ...scope };

  // Opening balance = net movement of all lines strictly before `from`.
  let openingBalance = 0;
  if (from) {
    const priorLines = await prisma.journalLine.findMany({
      where: { ...baseWhere, entry: { ...(baseWhere.entry ?? {}), createdAt: { lt: new Date(from) } } },
    });
    openingBalance = priorLines.reduce((bal, l) => {
      const delta = creditNormal ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
      return bal + delta;
    }, 0);
  }

  const rangeWhere: any = { ...baseWhere };
  if (from || to) {
    rangeWhere.entry = { ...(rangeWhere.entry ?? {}), createdAt: {} };
    if (from) rangeWhere.entry.createdAt.gte = new Date(from);
    if (to) rangeWhere.entry.createdAt.lte = new Date(to);
  }

  const lines = await prisma.journalLine.findMany({
    where: rangeWhere,
    include: { entry: true },
    orderBy: { entry: { createdAt: "asc" } },
  });

  let running = openingBalance;
  const rows = lines.map((l) => {
    const delta = creditNormal ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
    running += delta;
    return {
      date: l.entry.createdAt,
      entryCode: l.entry.code,
      description: l.entry.description,
      refType: l.entry.refType,
      debit: Number(l.debit),
      credit: Number(l.credit),
      balance: running,
    };
  });

  res.json({
    account: { id: account.id, code: account.code, name: account.name, type: account.type },
    period: { from: from ?? null, to: to ?? null },
    openingBalance,
    closingBalance: running,
    lines: rows,
  });
});

// ---- Laporan Pajak (PPN) ----
// PPN Keluaran dihitung dari kredit ke akun Hutang Pajak (2100) pada transaksi penjualan.
// Catatan: sistem belum mencatat PPN Masukan (pajak pembelian) secara terpisah pada jurnal
// pembelian (postPurchaseJournal tidak memisahkan komponen pajak), sehingga nilainya dilaporkan 0
// dengan catatan eksplisit, bukan diasumsikan.
accountingRouter.get("/reports/tax-report", requirePermission("accounting.view"), async (req, res) => {
  const { from, to, branchId } = req.query as Record<string, string>;

  const taxAccount = await prisma.account.findUnique({ where: { code: ACCOUNT_CODES.TAX_PAYABLE } });
  if (!taxAccount) throw ApiError.notFound(`Chart of accounts missing code ${ACCOUNT_CODES.TAX_PAYABLE}`);

  const scope = branchScope(req, branchId);
  const where: any = { accountId: taxAccount.id };
  if (Object.keys(scope).length) where.entry = { ...scope };
  if (from || to) {
    where.entry = { ...(where.entry ?? {}), createdAt: {} };
    if (from) where.entry.createdAt.gte = new Date(from);
    if (to) where.entry.createdAt.lte = new Date(to);
  }

  const lines = await prisma.journalLine.findMany({
    where,
    include: { entry: true },
    orderBy: { entry: { createdAt: "asc" } },
  });

  const outputTax = lines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);

  res.json({
    period: { from: from ?? null, to: to ?? null },
    outputTax,
    inputTax: 0,
    inputTaxNote: "PPN Masukan belum dicatat terpisah pada jurnal pembelian saat ini.",
    taxPayable: outputTax,
    transactions: lines.map((l) => ({
      date: l.entry.createdAt,
      entryCode: l.entry.code,
      description: l.entry.description,
      refType: l.entry.refType,
      amount: Number(l.credit) - Number(l.debit),
    })),
  });
});
