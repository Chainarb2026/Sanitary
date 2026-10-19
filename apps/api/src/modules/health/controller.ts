import type { Request, Response, NextFunction } from "express";
import { healthService } from "./service.js";

export class HealthController {
  /**
   * HTTP handler for GET /health (Liveness)
   */
  public getHealth(_req: Request, res: Response): void {
    const status = healthService.getLiveness();
    res.status(200).json(status);
  }

  /**
   * HTTP handler for GET /ready (Readiness)
   */
  public async getReady(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const readiness = await healthService.getReadiness();
      const httpCode = readiness.status === "ready" ? 200 : 503;
      res.status(httpCode).json(readiness);
    } catch (error) {
      next(error);
    }
  }
}

export const healthController = new HealthController();
