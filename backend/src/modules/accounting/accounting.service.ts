import { Prisma, PrismaClient } from "@prisma/client";
import { generateCode } from "@/utils/codes";

type Tx = Prisma.TransactionClient | PrismaClient;

// Default chart of accounts codes used by the auto-posting engine.
// Seeded by prisma/seed.ts — see ACCOUNT_CODES below for reference.
export const ACCOUNT_CODES = {
  CASH: "1000",
  BANK: "1010",
  INVENTORY: "1200",
  TAX_PAYABLE: "2100",
  ACCOUNTS_PAYABLE: "2000",
  SALES_REVENUE: "4000",
  COGS: "5000",
  OPERATING_EXPENSE: "5100",
};

async function getAccountId(tx: Tx, code: string): Promise<string> {
  const account = await tx.account.findUnique({ where: { code } });
  if (!account) throw new Error(`Chart of accounts missing code ${code} — run prisma seed first`);
  return account.id;
}

/**
 * Post a journal entry for a completed POS sale:
 *   Dr Cash/Bank            grandTotal
 *     Cr Sales Revenue        (grandTotal - taxTotal)
 *     Cr Tax Payable          taxTotal
 *   Dr COGS                 totalCost
 *     Cr Inventory            totalCost
 */
export async function postSaleJournal(
  tx: Tx,
  params: { saleId: string; branchId: string; grandTotal: number; taxTotal: number; totalCogs: number; paymentMethod: string }
) {
  const cashAccount = params.paymentMethod === "CASH" ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK;
  const [cashId, revenueId, taxId, cogsId, inventoryId] = await Promise.all([
    getAccountId(tx, cashAccount),
    getAccountId(tx, ACCOUNT_CODES.SALES_REVENUE),
    getAccountId(tx, ACCOUNT_CODES.TAX_PAYABLE),
    getAccountId(tx, ACCOUNT_CODES.COGS),
    getAccountId(tx, ACCOUNT_CODES.INVENTORY),
  ]);

  const lines: { accountId: string; debit: number; credit: number }[] = [
    { accountId: cashId, debit: params.grandTotal, credit: 0 },
    { accountId: revenueId, debit: 0, credit: params.grandTotal - params.taxTotal },
  ];
  if (params.taxTotal > 0) {
    lines.push({ accountId: taxId, debit: 0, credit: params.taxTotal });
  }
  if (params.totalCogs > 0) {
    lines.push({ accountId: cogsId, debit: params.totalCogs, credit: 0 });
    lines.push({ accountId: inventoryId, debit: 0, credit: params.totalCogs });
  }

  await tx.journalEntry.create({
    data: {
      code: generateCode("JRN-SALE"),
      branchId: params.branchId,
      refType: "Sale",
      refId: params.saleId,
      saleId: params.saleId,
      description: `Auto journal for sale ${params.saleId}`,
      lines: { create: lines },
    },
  });
}

/**
 * Post a journal entry for goods received (purchase):
 *   Dr Inventory   totalCost
 *     Cr Cash/Accounts Payable  totalCost
 */
export async function postPurchaseJournal(
  tx: Tx,
  params: { branchId: string; refId: string; totalCost: number; onCredit?: boolean }
) {
  if (params.totalCost <= 0) return;
  const [inventoryId, payId] = await Promise.all([
    getAccountId(tx, ACCOUNT_CODES.INVENTORY),
    getAccountId(tx, params.onCredit ? ACCOUNT_CODES.ACCOUNTS_PAYABLE : ACCOUNT_CODES.CASH),
  ]);

  await tx.journalEntry.create({
    data: {
      code: generateCode("JRN-PUR"),
      branchId: params.branchId,
      refType: "GoodsReceipt",
      refId: params.refId,
      description: `Auto journal for goods receipt ${params.refId}`,
      lines: {
        create: [
          { accountId: inventoryId, debit: params.totalCost, credit: 0 },
          { accountId: payId, debit: 0, credit: params.totalCost },
        ],
      },
    },
  });
}

/**
 * Post a journal entry for an operating expense:
 *   Dr Operating Expense   amount
 *     Cr Cash                amount
 */
export async function postExpenseJournal(
  tx: Tx,
  params: { branchId: string; expenseId: string; amount: number }
) {
  const [expenseAccountId, cashId] = await Promise.all([
    getAccountId(tx, ACCOUNT_CODES.OPERATING_EXPENSE),
    getAccountId(tx, ACCOUNT_CODES.CASH),
  ]);

  await tx.journalEntry.create({
    data: {
      code: generateCode("JRN-EXP"),
      branchId: params.branchId,
      refType: "Expense",
      refId: params.expenseId,
      expenseId: params.expenseId,
      description: `Auto journal for expense ${params.expenseId}`,
      lines: {
        create: [
          { accountId: expenseAccountId, debit: params.amount, credit: 0 },
          { accountId: cashId, debit: 0, credit: params.amount },
        ],
      },
    },
  });
}
