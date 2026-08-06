import type { Prisma } from "@prisma/client";

export interface SaleLineInput {
  productId: string;
  qty: number;
  discount: number;
}

export interface SaleLineProduct {
  sellPrice: number | string | Prisma.Decimal;
  isTaxable: boolean;
  taxRate: number | string | Prisma.Decimal;
}

export interface SaleLineResult {
  productId: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxAmount: number;
  lineTotal: number;
}

// Compute a single sale line's price/tax breakdown. Tax is applied on the
// discounted (net) amount, rounded to the nearest currency unit.
export function computeSaleLine(product: SaleLineProduct, item: SaleLineInput): SaleLineResult {
  const unitPrice = Number(product.sellPrice);
  const gross = unitPrice * item.qty - item.discount;
  const taxAmount = product.isTaxable ? Math.round((gross * Number(product.taxRate)) / 100) : 0;
  const lineTotal = gross + taxAmount;

  return { productId: item.productId, qty: item.qty, unitPrice, discount: item.discount, taxAmount, lineTotal };
}

export interface SaleTotals {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  lines: SaleLineResult[];
}

export function computeSaleTotals(
  lines: { product: SaleLineProduct; item: SaleLineInput }[],
  extraDiscountTotal: number
): SaleTotals {
  const computed = lines.map(({ product, item }) => computeSaleLine(product, item));

  const subtotal = computed.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const taxTotal = computed.reduce((s, l) => s + l.taxAmount, 0);
  const lineDiscountTotal = computed.reduce((s, l) => s + l.discount, 0);
  const discountTotal = extraDiscountTotal + lineDiscountTotal;
  const grandTotal = subtotal - discountTotal + taxTotal;

  return { subtotal, taxTotal, discountTotal, grandTotal, lines: computed };
}

// Sum of payments must cover the grand total; returns the change to give back.
export function computeChange(grandTotal: number, paidTotal: number): number {
  if (paidTotal < grandTotal) {
    throw new Error("Insufficient payment amount");
  }
  return paidTotal - grandTotal;
}
