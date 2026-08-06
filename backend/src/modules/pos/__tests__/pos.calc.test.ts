import { describe, it, expect } from "vitest";
import { computeSaleLine, computeSaleTotals, computeChange } from "@/modules/pos/pos.calc";

describe("computeSaleLine", () => {
  it("applies tax on the discounted amount, rounded to nearest unit", () => {
    const line = computeSaleLine(
      { sellPrice: 4000, isTaxable: true, taxRate: 11 },
      { productId: "p1", qty: 2, discount: 500 }
    );
    // gross = 4000*2 - 500 = 7500; tax = round(7500 * 0.11) = 825
    expect(line.unitPrice).toBe(4000);
    expect(line.taxAmount).toBe(825);
    expect(line.lineTotal).toBe(7500 + 825);
  });

  it("charges no tax for non-taxable products", () => {
    const line = computeSaleLine({ sellPrice: 1000, isTaxable: false, taxRate: 11 }, { productId: "p1", qty: 1, discount: 0 });
    expect(line.taxAmount).toBe(0);
    expect(line.lineTotal).toBe(1000);
  });

  it("accepts Decimal-like string values from Prisma", () => {
    const line = computeSaleLine({ sellPrice: "2500", isTaxable: true, taxRate: "11.00" }, { productId: "p1", qty: 1, discount: 0 });
    expect(line.unitPrice).toBe(2500);
    expect(line.taxAmount).toBe(275);
  });
});

describe("computeSaleTotals", () => {
  it("sums subtotal/tax/discount across multiple lines and adds the cart-level discount", () => {
    const totals = computeSaleTotals(
      [
        { product: { sellPrice: 4000, isTaxable: true, taxRate: 11 }, item: { productId: "p1", qty: 2, discount: 500 } },
        { product: { sellPrice: 2000, isTaxable: false, taxRate: 0 }, item: { productId: "p2", qty: 3, discount: 0 } },
      ],
      1000 // cart-level discount
    );

    // subtotal = (4000*2) + (2000*3) = 14000
    expect(totals.subtotal).toBe(14000);
    // line discounts = 500 + 0 = 500; + cart discount 1000 = 1500
    expect(totals.discountTotal).toBe(1500);
    // tax = round((4000*2-500)*0.11) = 825; second line not taxable = 0
    expect(totals.taxTotal).toBe(825);
    // grandTotal = subtotal - discountTotal + taxTotal
    expect(totals.grandTotal).toBe(14000 - 1500 + 825);
  });

  it("returns zero totals for an empty cart with only a cart-level discount of zero", () => {
    const totals = computeSaleTotals([], 0);
    expect(totals).toMatchObject({ subtotal: 0, taxTotal: 0, discountTotal: 0, grandTotal: 0, lines: [] });
  });
});

describe("computeChange", () => {
  it("returns the difference when payment covers the grand total", () => {
    expect(computeChange(10000, 15000)).toBe(5000);
  });

  it("returns zero when payment exactly matches the grand total", () => {
    expect(computeChange(10000, 10000)).toBe(0);
  });

  it("throws when payment is insufficient", () => {
    expect(() => computeChange(10000, 9999)).toThrow("Insufficient payment amount");
  });
});
