import { describe, expect, it } from "vitest";
import { calculateReorder } from "../reorder.calc";

describe("calculateReorder", () => {
  it("recommends enough stock to cover average demand", () => {
    expect(
      calculateReorder({
        soldQty: 60,
        currentStock: 10,
        minStock: 5,
        historyDays: 30,
        coverDays: 14,
      })
    ).toEqual({ averageDailySales: 2, targetStock: 28, recommendedQty: 18 });
  });

  it("uses minimum stock when demand history is empty", () => {
    expect(
      calculateReorder({
        soldQty: 0,
        currentStock: 2,
        minStock: 8,
        historyDays: 30,
        coverDays: 14,
      })
    ).toEqual({ averageDailySales: 0, targetStock: 8, recommendedQty: 6 });
  });

  it("does not recommend a purchase when stock already covers the target", () => {
    expect(
      calculateReorder({
        soldQty: 30,
        currentStock: 20,
        minStock: 2,
        historyDays: 30,
        coverDays: 14,
      })
    ).toEqual({ averageDailySales: 1, targetStock: 14, recommendedQty: 0 });
  });

  it("rounds fractional demand upward to avoid an understocked target", () => {
    expect(
      calculateReorder({
        soldQty: 10,
        currentStock: 0,
        minStock: 0,
        historyDays: 30,
        coverDays: 14,
      }).recommendedQty
    ).toBe(5);
  });
});
