import jwt from "jsonwebtoken";
import { env } from "@/config/env";

export interface JwtPayload {
  userId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  branchIds: string[];
  defaultBranchId: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
