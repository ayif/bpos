"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bpos_token");
}

export function setToken(token: string) {
  localStorage.setItem("bpos_token", token);
}

export function clearToken() {
  localStorage.removeItem("bpos_token");
  localStorage.removeItem("bpos_user");
}

export function getActiveBranchId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bpos_branch_id");
}

export function setActiveBranchId(branchId: string) {
  localStorage.setItem("bpos_branch_id", branchId);
}

export class ApiClientError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const branchId = getActiveBranchId();

  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(branchId ? { "X-Branch-Id": branchId } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiClientError(res.status, body?.error ?? res.statusText, body?.details);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return (await res.blob()) as unknown as T;
}

export const api = {
  get: <T = any>(path: string) => apiFetch<T>(path),
  post: <T = any>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
