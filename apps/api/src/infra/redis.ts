import { Redis } from "ioredis";
import net from "node:net";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createMockRedis } from "./mockRedis.js";

let redisClient: Redis | null = null;

function probePort(host: string, port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

/**
 * Initializes Redis on boot.
 * If in development and host Redis is offline, automatically activates in-memory MockRedis.
 */
export async function initRedis(): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  if (config.NODE_ENV === "production") {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    return redisClient;
  }

  try {
    const url = new URL(config.REDIS_URL.replace("redis://", "http://"));
    const port = parseInt(url.port || "6379", 10);
    const host = url.hostname || "127.0.0.1";

    const isAvailable = await probePort(host, port, 400);
    if (isAvailable) {
      logger.info({ host, port }, "Host Redis instance detected and connected");
      redisClient = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
    } else {
      logger.info(
        { host, port },
        "[DEV] Host Redis offline. Activating in-memory Redis engine for high-speed local development.",
      );
      redisClient = createMockRedis();
    }
  } catch {
    redisClient = createMockRedis();
  }

  return redisClient;
}

/**
 * Returns a singleton Redis client instance.
 * Big-O: O(1).
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    if (config.NODE_ENV !== "production") {
      logger.info("[DEV] Immediate fallback to in-memory Redis engine");
      redisClient = createMockRedis();
    } else {
      redisClient = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
    }
  }

  return redisClient;
}

/**
 * Overrides the active Redis client (primarily for testing with in-memory double).
 */
export function setRedisClient(client: Redis | null): void {
  redisClient = client;
}

/**
 * Closes the active Redis client connection.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis client connection closed");
  }
}

/**
 * Checks if Redis is ready and responding to PING.
 */
export async function isRedisConnected(): Promise<boolean> {
  if (!redisClient) {
    return false;
  }
  try {
    const reply = await redisClient.ping();
    return reply === "PONG";
  } catch {
    return false;
  }
}
