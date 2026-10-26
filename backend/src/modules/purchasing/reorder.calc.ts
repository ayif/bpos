export interface ReorderInput {
  soldQty: number;
  currentStock: number;
  minStock: number;
  historyDays: number;
  coverDays: number;
}

export function calculateReorder(input: ReorderInput) {
  const averageDailySales = input.soldQty / input.historyDays;
  const targetStock = Math.max(input.minStock, Math.ceil(averageDailySales * input.coverDays));
  const recommendedQty = Math.max(0, targetStock - input.currentStock);

  return { averageDailySales, targetStock, recommendedQty };
}
