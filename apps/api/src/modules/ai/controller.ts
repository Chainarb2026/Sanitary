import { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { aiService } from "./service.js";
import { aiAccuracyService } from "./accuracyService.js";

const estimateSchema = z.object({
  imageUrl: z.string().url("Valid image URL is required"),
  distanceKm: z.number().positive().optional(),
  isScheduled: z.boolean().optional(),
  surgeMultiplier: z.number().min(1).max(1.5).optional(),
});

const weighSchema = z.object({
  actualWeightKg: z.number().positive("Actual weight must be positive"),
  partnerLocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});

export class AiController {
  public async estimate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = estimateSchema.parse(req.body);
      const userId = req.user!.userId;

      const result = await aiService.estimateWaste({
        imageUrl: parsed.imageUrl,
        userId,
        distanceKm: parsed.distanceKm,
        isScheduled: parsed.isScheduled,
        surgeMultiplier: parsed.surgeMultiplier,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async recordWeight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = weighSchema.parse(req.body);
      const bookingId = req.params["id"] as string;

      const updated = await aiAccuracyService.recordActualWeightAndEvaluateFraud({
        bookingId,
        actualWeightKg: parsed.actualWeightKg,
        partnerLocation: parsed.partnerLocation,
      });

      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  public async getAccuracyMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await aiAccuracyService.getAccuracyMetrics();
      res.status(200).json(metrics);
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AiController();
