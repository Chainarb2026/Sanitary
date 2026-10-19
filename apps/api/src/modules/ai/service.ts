import crypto from "node:crypto";
import { price, type BookingQuoteBreakdown } from "@sanitary/shared";
import { type AiEstimateResponse, type AiWasteEstimate } from "./schemas.js";
import { getAiProvider } from "./provider.js";
import { WasteTypeModel } from "../wasteTypes/model.js";
import { getRedisClient } from "../../infra/redis.js";
import { config } from "../../infra/config.js";
import { AppError } from "../../errors/appError.js";
import { logger } from "../../infra/logger.js";

export const AI_CACHE_TTL_SECONDS = 86400; // 24 hours
export const MIN_CONFIDENCE_THRESHOLD = 0.6;

export class AiService {
  /**
   * Estimates waste attributes from an image URL with SHA-256 caching, daily limits,
   * resilient fallback, and instant pricing quote calculation.
   */
  public async estimateWaste(params: {
    imageUrl: string;
    userId: string;
    distanceKm?: number;
    isScheduled?: boolean;
    surgeMultiplier?: number;
  }): Promise<AiEstimateResponse> {
    const {
      imageUrl,
      userId,
      distanceKm = 3.0,
      isScheduled = false,
      surgeMultiplier = 1.0,
    } = params;
    const redis = getRedisClient();

    // 1. Enforce per-user daily request limit
    await this.enforceDailyLimit(userId);

    // 2. Compute SHA-256 hash of image URL / content for caching
    const imageHash = crypto.createHash("sha256").update(imageUrl).digest("hex");
    const cacheKey = `ai:estimate:cache:${imageHash}`;

    // 3. Check Redis cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info({ imageHash, userId }, "AI estimation cache hit");
        const parsedEstimate = JSON.parse(cached) as AiWasteEstimate;
        const quote = await this.generateQuote(
          parsedEstimate,
          distanceKm,
          isScheduled,
          surgeMultiplier,
        );
        return {
          fallback: false,
          estimate: parsedEstimate,
          quote,
          cacheHit: true,
        };
      }
    } catch (err) {
      logger.warn({ err, imageHash }, "Failed to read AI cache from Redis");
    }

    // 4. Invoke AI Vision Provider with resilient fallback
    const provider = getAiProvider();
    let estimate: AiWasteEstimate;

    try {
      const result = await provider.estimateWaste(imageUrl);
      estimate = result.estimate;

      // Token and cost logging
      logger.info(
        {
          userId,
          imageHash,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          costPaise: result.usage.estimatedCostPaise,
          confidence: estimate.confidence,
        },
        "AI vision estimation completed and logged",
      );
    } catch (err: unknown) {
      const code = err instanceof AppError ? err.code : "PROVIDER_ERROR";
      const message = err instanceof Error ? err.message : "Provider failure";
      logger.warn({ err, userId, imageUrl }, "AI vision provider failed. Returning fallback.");
      return {
        fallback: true,
        reason: `${code}: ${message}`,
      };
    }

    // 5. Confidence check: under 0.6 triggers fallback to manual selection
    if (estimate.confidence < MIN_CONFIDENCE_THRESHOLD) {
      logger.info(
        { confidence: estimate.confidence, threshold: MIN_CONFIDENCE_THRESHOLD },
        "AI estimation confidence below threshold. Returning fallback.",
      );
      return {
        fallback: true,
        reason: `LOW_CONFIDENCE (${estimate.confidence.toFixed(2)} < ${MIN_CONFIDENCE_THRESHOLD})`,
        estimate,
      };
    }

    // 6. Cache successful high-confidence estimate in Redis
    try {
      await redis.set(cacheKey, JSON.stringify(estimate), "EX", AI_CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn({ err, cacheKey }, "Failed to cache AI estimate in Redis");
    }

    // 7. Feed estimate into pricing engine for instant quote
    const quote = await this.generateQuote(estimate, distanceKm, isScheduled, surgeMultiplier);

    return {
      fallback: false,
      estimate,
      quote,
      cacheHit: false,
    };
  }

  private async enforceDailyLimit(userId: string): Promise<void> {
    const redis = getRedisClient();
    const dateStr = new Date().toISOString().slice(0, 10);
    const rateKey = `ai:rate:daily:${userId}:${dateStr}`;

    try {
      const count = await redis.incr(rateKey);
      if (count === 1) {
        await redis.expire(rateKey, 86400); // 24 hours
      }

      if (count > config.AI_MAX_DAILY_REQUESTS_PER_USER) {
        logger.warn({ userId, count }, "User exceeded daily AI estimation limit");
        throw new AppError(
          429,
          "AI_DAILY_LIMIT_EXCEEDED",
          `Daily AI estimation limit of ${config.AI_MAX_DAILY_REQUESTS_PER_USER} requests reached. Please proceed with manual waste selection.`,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn({ err, userId }, "Failed to evaluate daily AI rate limit");
    }
  }

  private async generateQuote(
    estimate: AiWasteEstimate,
    distanceKm: number,
    isScheduled: boolean,
    surgeMultiplier: number,
  ): Promise<BookingQuoteBreakdown> {
    // Find matching waste type from catalog or use default
    const matchedType = await WasteTypeModel.findOne({
      $or: [
        { name: new RegExp(estimate.wasteType, "i") },
        { category: new RegExp(estimate.volumeClass, "i") },
        { isActive: true },
      ],
    })
      .lean()
      .exec();

    const basePricePaise = matchedType?.basePrice ?? 4900;
    const pricePerKgPaise = matchedType?.ratePerKg ?? 500;
    const commissionRate = matchedType?.commissionRate ?? 0.2;

    const pricingItems = estimate.items.map((it) => ({
      wasteTypeId: matchedType?._id.toString() ?? "default-waste-type",
      name: it.name,
      quantity: it.quantity,
      weightKg:
        it.estimatedWeightKg ?? Math.round(estimate.estimatedWeightKg / estimate.items.length),
      basePricePaise,
      ratePerKgPaise: pricePerKgPaise,
      commissionRate,
    }));

    return price(
      pricingItems,
      distanceKm,
      {
        timeSlot: "10:00-12:00",
        isPeak: isScheduled,
      },
      {
        enableSurge: surgeMultiplier > 1.0,
        surgeMultiplier,
      },
    );
  }
}

export const aiService = new AiService();
