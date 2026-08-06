import { describe, it, expect, beforeEach } from "vitest";
import { receiveStock, consumeStockFifo } from "@/modules/stock/stock.service";

// Minimal in-memory stand-in for the slice of the Prisma transaction client
// that stock.service.ts touches. Lets us exercise the real FIFO consumption
// algorithm (batch ordering, partial depletion, weighted cost) without a DB.
class FakeTx {
  private nextId = 1;
  private seq = 0;
  stockBatches: any[] = [];
  private productStocks = new Map<string, { productId: string; branchId: string; qty: number }>();
  stockMovements: any[] = [];

  private key(productId: string, branchId: string) {
    return `${productId}:${branchId}`;
  }

  stockBatch = {
    create: async ({ data }: any) => {
      const rec = { id: `batch-${this.nextId++}`, receivedAt: this.seq++, ...data };
      this.stockBatches.push(rec);
      return rec;
    },
    findMany: async ({ where }: any) => {
      return this.stockBatches
        .filter((b) => b.productId === where.productId && b.branchId === where.branchId && b.qtyRemaining > 0)
        .sort((a, b) => a.receivedAt - b.receivedAt);
    },
    update: async ({ where, data }: any) => {
      const rec = this.stockBatches.find((b) => b.id === where.id);
      if (data.qtyRemaining?.decrement !== undefined) rec.qtyRemaining -= data.qtyRemaining.decrement;
      return rec;
    },
  };

  productStock = {
    upsert: async ({ where, update, create }: any) => {
      const k = this.key(where.productId_branchId.productId, where.productId_branchId.branchId);
      let rec = this.productStocks.get(k);
      if (rec) {
        if (update.qty?.increment !== undefined) rec.qty += update.qty.increment;
      } else {
        rec = { ...create };
        this.productStocks.set(k, rec!);
      }
      return rec;
    },
    findUnique: async ({ where }: any) => {
      const k = this.key(where.productId_branchId.productId, where.productId_branchId.branchId);
      return this.productStocks.get(k) ?? null;
    },
    update: async ({ where, data }: any) => {
      const k = this.key(where.productId_branchId.productId, where.productId_branchId.branchId);
      const rec = this.productStocks.get(k)!;
      if (data.qty?.decrement !== undefined) rec.qty -= data.qty.decrement;
      return rec;
    },
  };

  stockMovement = {
    create: async ({ data }: any) => {
      const rec = { id: `mv-${this.nextId++}`, ...data };
      this.stockMovements.push(rec);
      return rec;
    },
  };

  product = {
    update: async ({ where, data }: any) => ({ id: where.id, ...data }),
  };
}

const PRODUCT = "prod-1";
const BRANCH = "branch-1";

describe("consumeStockFifo", () => {
  let tx: FakeTx;

  beforeEach(() => {
    tx = new FakeTx();
  });

  it("consumes a single batch and reports its unit cost", async () => {
    await receiveStock(tx as any, { productId: PRODUCT, branchId: BRANCH, qty: 10, unitCost: 100, sourceType: "INITIAL", movementType: "INITIAL" as any });

    const result = await consumeStockFifo(tx as any, { productId: PRODUCT, branchId: BRANCH, qty: 4, movementType: "SALE_OUT" as any });

    expect(result.totalCost).toBe(400);
    expect(result.avgUnitCost).toBe(100);
    expect(tx.stockBatches[0].qtyRemaining).toBe(6);
  });

  it("consumes oldest batch first and spills into the next batch (FIFO ordering)", async () => {
    await receiveStock(tx as any, { productId: PRODUCT, branchId: BRANCH, qty: 5, unitCost: 100, sourceType: "PURCHASE", movementType: "PURCHASE_IN" as any });
    await receiveStock(tx as any, { productId: PRODUCT, branchId: BRANCH, qty: 5, unitCost: 120, sourceType: "PURCHASE", movementType: "PURCHASE_IN" as any });

    const result = await consumeStockFifo(tx as any, { productId: PRODUCT, branchId: BRANCH, qty: 7, movementType: "SALE_OUT" as any });

    // 5 units @100 (=500) + 2 units @120 (=240) = 740
    expect(result.totalCost).toBe(740);
    expect(result.avgUnitCost).toBeCloseTo(740 / 7, 5);
    expect(tx.stockBatches[0].qtyRemaining).toBe(0);
    expect(tx.stockBatches[1].qtyRemaining).toBe(3);
  });

  it("rejects consuming more than what's currently in stock", async () => {
    await receiveStock(tx as any, { productId: PRODUCT, branchId: BRANCH, qty: 3, unitCost: 100, sourceType: "INITIAL", movementType: "INITIAL" as any });

    await expect(
      consumeStockFifo(tx as any, { productId: PRODUCT, branchId: BRANCH, qty: 5, movementType: "SALE_OUT" as any })
    ).rejects.toThrow(/Insufficient stock/);
  });

  it("rejects a non-positive quantity", async () => {
    await expect(
      consumeStockFifo(tx as any, { productId: PRODUCT, branchId: BRANCH, qty: 0, movementType: "SALE_OUT" as any })
    ).rejects.toThrow(/must be positive/);
  });
});
