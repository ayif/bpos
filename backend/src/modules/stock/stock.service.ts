import { Prisma, PrismaClient, StockMovementType } from "@prisma/client";
import { ApiError } from "@/utils/errors";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Add a new FIFO stock batch (from purchase, opname increase, transfer-in, etc.)
 * and bump the denormalized ProductStock counter.
 */
export async function receiveStock(
  tx: Tx,
  params: {
    productId: string;
    branchId: string;
    qty: number;
    unitCost: number;
    sourceType: "PURCHASE" | "OPNAME" | "TRANSFER_IN" | "INITIAL";
    sourceRefId?: string;
    movementType: StockMovementType;
    refType?: string;
    refId?: string;
    userId?: string;
  }
) {
  if (params.qty <= 0) throw ApiError.badRequest("Quantity to receive must be positive");

  await tx.stockBatch.create({
    data: {
      productId: params.productId,
      branchId: params.branchId,
      qtyRemaining: params.qty,
      qtyOriginal: params.qty,
      unitCost: params.unitCost,
      sourceType: params.sourceType,
      sourceRefId: params.sourceRefId,
    },
  });

  await tx.productStock.upsert({
    where: { productId_branchId: { productId: params.productId, branchId: params.branchId } },
    update: { qty: { increment: params.qty } },
    create: { productId: params.productId, branchId: params.branchId, qty: params.qty },
  });

  await tx.stockMovement.create({
    data: {
      productId: params.productId,
      branchId: params.branchId,
      type: params.movementType,
      qty: params.qty,
      unitCost: params.unitCost,
      refType: params.refType,
      refId: params.refId,
      userId: params.userId,
    },
  });

  // Keep Product.costPrice as the latest received cost for quick reference.
  await tx.product.update({
    where: { id: params.productId },
    data: { costPrice: params.unitCost },
  });
}

/**
 * Consume stock FIFO (oldest batch first) for a sale, transfer-out, or opname decrease.
 * Returns the weighted average unit cost of the consumed quantity (used for COGS).
 */
export async function consumeStockFifo(
  tx: Tx,
  params: {
    productId: string;
    branchId: string;
    qty: number;
    movementType: StockMovementType;
    refType?: string;
    refId?: string;
    userId?: string;
  }
): Promise<{ totalCost: number; avgUnitCost: number }> {
  if (params.qty <= 0) throw ApiError.badRequest("Quantity to consume must be positive");

  const productStock = await tx.productStock.findUnique({
    where: { productId_branchId: { productId: params.productId, branchId: params.branchId } },
  });

  if (!productStock || productStock.qty < params.qty) {
    throw ApiError.badRequest(
      `Insufficient stock for product ${params.productId} at branch ${params.branchId} (available: ${productStock?.qty ?? 0}, requested: ${params.qty})`
    );
  }

  const batches = await tx.stockBatch.findMany({
    where: { productId: params.productId, branchId: params.branchId, qtyRemaining: { gt: 0 } },
    orderBy: { receivedAt: "asc" },
  });

  let remaining = params.qty;
  let totalCost = 0;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.qtyRemaining, remaining);
    totalCost += take * Number(batch.unitCost);
    remaining -= take;
    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { qtyRemaining: { decrement: take } },
    });
  }

  if (remaining > 0) {
    // Batches ran out (data drift) — fall back to last known cost for the shortfall.
    const lastCost = batches.length ? Number(batches[batches.length - 1].unitCost) : 0;
    totalCost += remaining * lastCost;
  }

  await tx.productStock.update({
    where: { productId_branchId: { productId: params.productId, branchId: params.branchId } },
    data: { qty: { decrement: params.qty } },
  });

  await tx.stockMovement.create({
    data: {
      productId: params.productId,
      branchId: params.branchId,
      type: params.movementType,
      qty: -params.qty,
      unitCost: params.qty ? totalCost / params.qty : 0,
      refType: params.refType,
      refId: params.refId,
      userId: params.userId,
    },
  });

  return { totalCost, avgUnitCost: params.qty ? totalCost / params.qty : 0 };
}

export async function getStockQty(tx: Tx, productId: string, branchId: string): Promise<number> {
  const row = await tx.productStock.findUnique({
    where: { productId_branchId: { productId, branchId } },
  });
  return row?.qty ?? 0;
}
