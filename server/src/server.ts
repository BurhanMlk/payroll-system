import http from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { startWorkers, startSchedulers, handleSubscriptionExpiry } from "./jobs";

const app = createApp();
const server = http.createServer(app);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully...");
  server.close(async () => {
    try {
      await prisma.$disconnect();
      await redis.quit();
      logger.info("Shutdown complete.");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  });

  // Force exit if graceful shutdown hangs.
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout.");
    process.exit(1);
  }, 15000).unref();
}

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected.");
  } catch (err) {
    logger.error({ err }, "Failed to connect to database");
    process.exit(1);
  }

  server.listen(env.PORT, () => {
    logger.info(`EduPayroll API listening on http://localhost:${env.PORT}`);
  });

  // Start background workers + schedulers. These power the subscription
  // lifecycle (trial -> grace -> expired), expiry reminders, and daily
  // payroll auto-generation.
  startWorkers();
  startSchedulers();

  // Process any already-lapsed subscriptions immediately on startup, so a
  // restart doesn't leave the system waiting for the next cron tick.
  handleSubscriptionExpiry().catch((err) => {
    logger.warn({ err }, "Initial subscription expiry check failed");
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void main();
