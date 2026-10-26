import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  digiflazz: {
    mode: "live" as "live" | "mock",
    username: "test-buyer",
    apiKey: "test-api-key",
    testing: false,
    callbackToken: "",
  },
}));

vi.mock("@/config/env", () => ({ env: mockEnv }));

import { digiflazzProductList, DigiflazzError } from "../digiflazz.client";

describe("digiflazzProductList", () => {
  beforeEach(() => {
    mockEnv.digiflazz.mode = "live";
    vi.unstubAllGlobals();
  });

  it("requests and parses the prepaid price list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              buyer_sku_code: "TELKOMSEL5",
              product_name: "Telkomsel Pulsa 5.000",
              category: "Pulsa",
              brand: "TELKOMSEL",
              price: "5100",
              buyer_product_status: true,
              seller_product_status: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(digiflazzProductList()).resolves.toEqual([
      {
        buyer_sku_code: "TELKOMSEL5",
        product_name: "Telkomsel Pulsa 5.000",
        category: "Pulsa",
        brand: "TELKOMSEL",
        price: 5100,
        buyer_product_status: true,
        seller_product_status: true,
      },
    ]);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      cmd: "prepaid",
      username: "test-buyer",
      sign: crypto.createHash("md5").update("test-buyertest-api-keypricelist").digest("hex"),
    });
  });

  it("rejects an invalid provider response instead of syncing an empty catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ buyer_sku_code: "INCOMPLETE" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(digiflazzProductList()).rejects.toThrow(DigiflazzError);
  });

  it("explains that live mode is required when mock mode is enabled", async () => {
    mockEnv.digiflazz.mode = "mock";

    await expect(digiflazzProductList()).rejects.toThrow("DIGIFLAZZ_MODE=live");
  });
});
