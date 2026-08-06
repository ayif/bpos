import { NextFunction, Request, Response } from "express";
import { verifyToken, JwtPayload } from "@/utils/jwt";
import { ApiError } from "@/utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      branchId?: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing bearer token");
  }
  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
  next();
}

// Resolve the active branch for this request: header X-Branch-Id, else user's default branch.
export function resolveBranch(req: Request, _res: Response, next: NextFunction) {
  const requested = (req.headers["x-branch-id"] as string) || (req.query.branchId as string);
  const user = req.user!;
  const isSuperAdmin = user.permissions.includes("*");

  if (requested) {
    if (!isSuperAdmin && !user.branchIds.includes(requested)) {
      throw ApiError.forbidden("You do not have access to this branch");
    }
    req.branchId = requested;
  } else {
    req.branchId = user.defaultBranchId ?? user.branchIds[0];
  }
  next();
}

export function requirePermission(...perms: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();
    const hasAll = user.permissions.includes("*") || perms.every((p) => user.permissions.includes(p));
    if (!hasAll) throw ApiError.forbidden(`Missing permission: ${perms.join(", ")}`);
    next();
  };
}
