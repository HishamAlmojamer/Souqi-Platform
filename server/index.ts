import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config";
import { disconnectDatabase } from "./db";
import { errorHandler } from "./http";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { escrowRouter } from "./routes/escrow";
import { industriesRouter } from "./routes/industries";
import { inspectionsRouter } from "./routes/inspections";
import { messagesRouter } from "./routes/messages";
import { notificationsRouter } from "./routes/notifications";
import { organizationsRouter } from "./routes/organizations";
import { productsRouter } from "./routes/products";
import { purchaseOrdersRouter } from "./routes/purchaseOrders";
import { quotesRouter } from "./routes/quotes";
import { rfqsRouter } from "./routes/rfqs";
import { shipmentsRouter } from "./routes/shipments";
import { suppliersRouter } from "./routes/suppliers";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          config.allowedOrigins.length === 0 ||
          config.allowedOrigins.includes(origin)
        ) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed"));
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/organizations", organizationsRouter);
  app.use("/api", industriesRouter);
  app.use("/api", rfqsRouter);
  app.use("/api", quotesRouter);
  app.use("/api", purchaseOrdersRouter);
  app.use("/api", suppliersRouter);
  app.use("/api", productsRouter);
  app.use("/api", inspectionsRouter);
  app.use("/api", messagesRouter);
  app.use("/api", escrowRouter);
  app.use("/api", shipmentsRouter);
  app.use("/api", notificationsRouter);
  app.use("/api", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({
      code: "NOT_FOUND",
      error: "المسار غير موجود",
      message: "المسار غير موجود",
    });
  });
  app.use(errorHandler);

  return app;
}

export const app = createApp();

if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`Souqi API listening on http://localhost:${config.port}`);
  });

  async function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
