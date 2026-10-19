import http from "node:http";
import { app } from "./app.js";
import { config } from "./infra/config.js";
import { logger } from "./infra/logger.js";
import { connectDB, disconnectDB } from "./infra/db.js";
import { closeRedis, initRedis } from "./infra/redis.js";
import { initSocketServer } from "./infra/socket.js";
import { initDispatchListeners } from "./modules/dispatch/listener.js";
import { wasteTypeService } from "./modules/wasteTypes/service.js";

const server = http.createServer(app);

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Graceful shutdown initiated...");

  server.close(async () => {
    logger.info("HTTP server closed to new connections");

    try {
      await disconnectDB();
      await closeRedis();
      logger.info("All database and Redis connections successfully closed. Exiting process.");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error occurred while shutting down background resources");
      process.exit(1);
    }
  });

  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    logger.fatal("Forceful shutdown triggered after timeout");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled Promise Rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught Exception detected");
  process.exit(1);
});

async function startServer(): Promise<void> {
  try {
    await initRedis();

    // Initialize real-time Socket.IO server with verified Redis
    initSocketServer(server);

    // Initialize domain event listeners for automated dispatch
    initDispatchListeners();

    // Attempt DB connection in non-test mode
    if (config.NODE_ENV !== "test") {
      try {
        await connectDB();
        await wasteTypeService.seedDefaults();
      } catch (dbErr) {
        logger.warn({ dbErr }, "MongoDB connection failed on boot. Will retry via driver.");
      }
    }

    server.listen(config.PORT, config.API_HOST, () => {
      logger.info(
        {
          port: config.PORT,
          host: config.API_HOST,
          env: config.NODE_ENV,
        },
        `Sanitary API server listening on http://${config.API_HOST}:${config.PORT}`,
      );
    });
  } catch (error) {
    logger.fatal({ err: error }, "Failed to bootstrap HTTP server");
    process.exit(1);
  }
}

// Start only if executed directly
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  void startServer();
}

export { server };
