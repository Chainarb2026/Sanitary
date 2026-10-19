import { logger } from "./infra/logger.js";
import { config } from "./infra/config.js";
import { connectDB, disconnectDB } from "./infra/db.js";
import { closeRedis } from "./infra/redis.js";

logger.info({ env: config.NODE_ENV }, "Starting Sanitary BullMQ Worker process...");

let isShuttingDown = false;

async function shutdownWorker(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Shutting down BullMQ worker process...");

  try {
    if (dispatchWorker) {
      await dispatchWorker.close();
    }
    if (settlementWorker) {
      await settlementWorker.close();
    }
    await disconnectDB();
    await closeRedis();
    logger.info("Worker cleanly disconnected from DB and Redis. Exiting.");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during worker process shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdownWorker("SIGTERM"));
process.on("SIGINT", () => void shutdownWorker("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Worker Unhandled Promise Rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Worker Uncaught Exception");
  process.exit(1);
});

import { createWorker } from "./infra/queue.js";
import { dispatchProcessor } from "./modules/dispatch/processor.js";
import { DISPATCH_QUEUE_NAME } from "./modules/dispatch/queue.js";
import { settlementProcessor } from "./modules/payouts/processor.js";
import { SETTLEMENT_QUEUE_NAME } from "./modules/payouts/queue.js";
import type { Worker } from "bullmq";

let dispatchWorker: Worker | null = null;
let settlementWorker: Worker | null = null;

async function startWorker(): Promise<void> {
  try {
    if (config.NODE_ENV !== "test") {
      try {
        await connectDB();
      } catch (err) {
        logger.warn({ err }, "MongoDB initial connect failed in worker. Retrying in background.");
      }
    }

    dispatchWorker = createWorker(DISPATCH_QUEUE_NAME, dispatchProcessor);
    settlementWorker = createWorker(SETTLEMENT_QUEUE_NAME, settlementProcessor);
    logger.info("BullMQ Dispatch & Settlement Workers initialized and standing by for job queues.");
  } catch (error) {
    logger.fatal({ err: error }, "Failed to initialize worker process");
    process.exit(1);
  }
}

// Start only if executed directly
if (process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js")) {
  void startWorker();
}
