import { describe, it, expect, beforeEach } from "vitest";
import { postSaleJournal, postPurchaseJournal, postExpenseJournal, ACCOUNT_CODES } from "@/modules/accounting/accounting.service";

// Minimal in-memory stand-in for the slice of the Prisma transaction client
// the auto-posting helpers touch: look up an account by chart-of-accounts
// code, and record the journal entry (+lines) that gets created.
class FakeTx {
  private accountsByCode = new Map<string, { id: string; code: string }>();
  entries: { code: string; refType: string; refId?: string; lines: { accountId: string; debit: number; credit: number }[] }[] = [];

  constructor() {
    for (const code of Object.values(ACCOUNT_CODES)) {
      this.accountsByCode.set(code, { id: `acc-${code}`, code });
    }
  }

  account = {
    findUnique: async ({ where }: any) => this.accountsByCode.get(where.code) ?? null,
  };

  journalEntry = {
    create: async ({ data }: any) => {
      const entry = { code: data.code, refType: data.refType, refId: data.refId, lines: data.lines.create };
      this.entries.push(entry);
      return { id: `entry-${this.entries.length}`, ...entry };
    },
  };
}

function accId(code: string) {
  return `acc-${code}`;
}

describe("postSaleJournal", () => {
  let tx: FakeTx;
  beforeEach(() => {
    tx = new FakeTx();
  });

  it("posts cash, revenue, tax, and COGS lines for a cash sale with tax", async () => {
    await postSaleJournal(tx as any, {
      saleId: "sale-1",
      branchId: "branch-1",
      grandTotal: 11100,
      taxTotal: 1100,
      totalCogs: 6000,
      paymentMethod: "CASH",
    });

    expect(tx.entries).toHaveLength(1);
    const lines = tx.entries[0].lines;

    expect(lines).toContainEqual({ accountId: accId(ACCOUNT_CODES.CASH), debit: 11100, credit: 0 });
    expect(lines).toContainEqual({ accountId: accId(ACCOUNT_CODES.SALES_REVENUE), debit: 0, credit: 10000 });
    expect(lines).toContainEqual({ accountId: accId(ACCOUNT_CODES.TAX_PAYABLE), debit: 0, credit: 1100 });
    expect(lines).toContainEqual({ accountId: accId(ACCOUNT_CODES.COGS), debit: 6000, credit: 0 });
    expect(lines).toContainEqual({ accountId: accId(ACCOUNT_CODES.INVENTORY), debit: 0, credit: 6000 });

    // Debits must equal credits (double-entry).
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("uses the bank account instead of cash for non-cash payment methods", async () => {
    await postSaleJournal(tx as any, {
      saleId: "sale-2",
      branchId: "branch-1",
      grandTotal: 5000,
      taxTotal: 0,
      totalCogs: 0,
      paymentMethod: "QRIS",
    });

    const lines = tx.entries[0].lines;
    expect(lines).toContainEqual({ accountId: accId(ACCOUNT_CODES.BANK), debit: 5000, credit: 0 });
    // No tax and no COGS on this sale -> only cash + revenue lines.
    expect(lines).toHaveLength(2);
  });
});

describe("postPurchaseJournal", () => {
  let tx: FakeTx;
  beforeEach(() => {
    tx = new FakeTx();
  });

  it("debits inventory and credits cash for a cash purchase", async () => {
    await postPurchaseJournal(tx as any, { branchId: "branch-1", refId: "gr-1", totalCost: 2000 });

    const lines = tx.entries[0].lines;
    expect(lines).toEqual([
      { accountId: accId(ACCOUNT_CODES.INVENTORY), debit: 2000, credit: 0 },
      { accountId: accId(ACCOUNT_CODES.CASH), debit: 0, credit: 2000 },
    ]);
  });

  it("credits accounts payable instead of cash when purchased on credit", async () => {
    await postPurchaseJournal(tx as any, { branchId: "branch-1", refId: "gr-2", totalCost: 3000, onCredit: true });

    const lines = tx.entries[0].lines;
    expect(lines).toContainEqual({ accountId: accId(ACCOUNT_CODES.ACCOUNTS_PAYABLE), debit: 0, credit: 3000 });
  });

  it("skips posting when there is nothing to record", async () => {
    await postPurchaseJournal(tx as any, { branchId: "branch-1", refId: "gr-3", totalCost: 0 });
    expect(tx.entries).toHaveLength(0);
  });
});

describe("postExpenseJournal", () => {
  it("debits operating expense and credits cash", async () => {
    const tx = new FakeTx();
    await postExpenseJournal(tx as any, { branchId: "branch-1", expenseId: "exp-1", amount: 750 });

    const lines = tx.entries[0].lines;
    expect(lines).toEqual([
      { accountId: accId(ACCOUNT_CODES.OPERATING_EXPENSE), debit: 750, credit: 0 },
      { accountId: accId(ACCOUNT_CODES.CASH), debit: 0, credit: 750 },
    ]);
  });
});
