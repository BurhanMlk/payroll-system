import IORedis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  // Heroku Redis serves TLS (rediss://) with a self-signed cert.
  ...(env.REDIS_URL.startsWith("rediss://") ? { tls: { rejectUnauthorized: false } } : {}),
});

redis.on("error", (err) => {
  if (env.NODE_ENV !== "test") {
    logger.warn({ err: err.message }, "Redis connection error");
  }
});

redis.on("ready", () => {
  if (env.NODE_ENV !== "test") {
    logger.info("Redis connected");
  }
});
