import { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/errors";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "ValidationError", details: err.flatten() });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // No route was individually catching duplicate-key violations (e.g. branch code, product
  // SKU, user email), so they all fell through as raw 500s with no usable message. Handled
  // once here instead of in every create/update route.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const fields = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
    return res.status(409).json({ error: `Nilai untuk ${fields} sudah digunakan` });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}
