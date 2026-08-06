import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import "express-async-errors";

import { env } from "@/config/env";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";

import { authRouter } from "@/modules/auth/auth.routes";
import { branchesRouter } from "@/modules/branches/branches.routes";
import { usersRouter } from "@/modules/users/users.routes";
import { productsRouter } from "@/modules/products/products.routes";
import { stockRouter } from "@/modules/stock/stock.routes";
import { posRouter } from "@/modules/pos/pos.routes";
import { purchasingRouter } from "@/modules/purchasing/purchasing.routes";
import { customersRouter } from "@/modules/customers/customers.routes";
import { accountingRouter } from "@/modules/accounting/accounting.routes";
import { reportsRouter } from "@/modules/reports/reports.routes";
import { ppobRouter } from "@/modules/ppob/ppob.routes";
import { settingsRouter } from "@/modules/settings/settings.routes";
import { shiftRouter } from "@/modules/shift/shift.routes";
import { expenseRouter } from "@/modules/expense/expense.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(compression());
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "bpos-backend", time: new Date().toISOString() }));

  app.use("/api/auth", authRouter);
  app.use("/api/branches", branchesRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/stock", stockRouter);
  app.use("/api/pos", posRouter);
  app.use("/api/purchasing", purchasingRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/accounting", accountingRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/ppob", ppobRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/shift", shiftRouter);
  app.use("/api/expenses", expenseRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
