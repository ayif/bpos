import crypto from "crypto";
import { env } from "@/config/env";

// Thin client around the Digiflazz API. Runs in "mock" mode by default
// (no real credentials needed) so the module works out of the box; set
// DIGIFLAZZ_MODE=live plus DIGIFLAZZ_USERNAME/DIGIFLAZZ_API_KEY to call the
// real Digiflazz endpoint (https://api.digiflazz.com/v1).
const DIGIFLAZZ_BASE_URL = "https://api.digiflazz.com/v1";
const REQUEST_TIMEOUT_MS = 15_000;

export class DigiflazzError extends Error {}

function sign(username: string, apiKey: string, refId: string) {
  return crypto.createHash("md5").update(`${username}${apiKey}${refId}`).digest("hex");
}

// POST to Digiflazz with a hard timeout and normalized error handling — a
// slow/unreachable provider or a non-JSON (e.g. HTML error page) response
// must not hang the request or crash the route with an unhandled rejection.
async function callDigiflazz(path: string, body: Record<string, unknown>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(`${DIGIFLAZZ_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new DigiflazzError(`Digiflazz request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new DigiflazzError(`Digiflazz request failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  let json: any;
  try {
    json = await resp.json();
  } catch {
    throw new DigiflazzError(`Digiflazz returned a non-JSON response (HTTP ${resp.status})`);
  }

  if (!resp.ok) {
    throw new DigiflazzError(json?.data?.message ?? `Digiflazz request failed (HTTP ${resp.status})`);
  }

  return json;
}

export interface DigiflazzResult {
  status: "Pending" | "Sukses" | "Gagal" | string;
  message: string;
  rc: string;
  sn: string | null;
}

// Digiflazz documents exactly these three status strings for both the
// synchronous inquiry response and the async callback payload. Match them
// explicitly rather than inferring from `rc` alone.
export function mapDigiflazzStatus(result: Pick<DigiflazzResult, "status" | "rc">): "PENDING" | "SUCCESS" | "FAILED" {
  if (result.status === "Sukses") return "SUCCESS";
  if (result.status === "Gagal") return "FAILED";
  if (result.status === "Pending") return "PENDING";
  // Unexpected/missing status field — fall back to the response code.
  return result.rc === "00" ? "PENDING" : "FAILED";
}

// Weighted-random outcome used only in mock mode, so the pending/failure
// paths (and the callback flow) are exercisable without real credentials.
function mockInquiryResult(refId: string): DigiflazzResult {
  const roll = Math.random();
  if (roll < 0.1) {
    return { status: "Gagal", message: "Simulasi gagal: saldo provider tidak cukup (mock mode)", rc: "51", sn: null };
  }
  if (roll < 0.3) {
    return { status: "Pending", message: "Simulasi sedang diproses provider (mock mode)", rc: "00", sn: null };
  }
  return { status: "Sukses", message: "Simulasi transaksi berhasil (mock mode)", rc: "00", sn: `MOCKSN-${refId}` };
}

export async function digiflazzInquiry(buyerSkuCode: string, customerNo: string, refId: string): Promise<DigiflazzResult> {
  if (env.digiflazz.mode === "mock") {
    return mockInquiryResult(refId);
  }

  const json = await callDigiflazz("/transaction", {
    username: env.digiflazz.username,
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId,
    sign: sign(env.digiflazz.username, env.digiflazz.apiKey, refId),
    // Sandbox/developer accounts can pass testing:true so calls don't touch
    // real balance — see DIGIFLAZZ_TESTING in .env.example.
    ...(env.digiflazz.testing ? { testing: true } : {}),
  });
  return json.data;
}

export async function digiflazzProductList() {
  if (env.digiflazz.mode === "mock") {
    return [];
  }
  const json = await callDigiflazz("/price-list", {
    cmd: "prepaid",
    username: env.digiflazz.username,
    sign: sign(env.digiflazz.username, env.digiflazz.apiKey, "pricelist"),
  });
  return json.data ?? [];
}
