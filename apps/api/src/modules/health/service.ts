import { isDbConnected } from "../../infra/db.js";
import { isRedisConnected } from "../../infra/redis.js";

export interface HealthStatus {
  status: "ok";
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadyStatus {
  status: "ready" | "not_ready";
  timestamp: string;
  checks: {
    mongodb: "up" | "down";
    redis: "up" | "down";
  };
}

/**
 * Health business logic service.
 */
export class HealthService {
  /**
   * Liveness check. Returns basic process health.
   * Big-O: O(1) time, O(1) space.
   */
  public getLiveness(): HealthStatus {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  /**
   * Readiness check. Verifies database and cache availability.
   * Big-O: O(1) network probe.
   */
  public async getReadiness(): Promise<ReadyStatus> {
    const mongoUp = isDbConnected();
    const redisUp = await isRedisConnected();

    const isReady = mongoUp && redisUp;

    return {
      status: isReady ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks: {
        mongodb: mongoUp ? "up" : "down",
        redis: redisUp ? "up" : "down",
      },
    };
  }
}

export const healthService = new HealthService();
