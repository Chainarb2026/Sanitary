import { wasteTypeRepo, type WasteTypeRecord, type CreateWasteTypeInput } from "./repo.js";
import { DEFAULT_WASTE_TYPES } from "./seedData.js";
import { getRedisClient } from "../../infra/redis.js";
import { logger } from "../../infra/logger.js";
import { AppError, NotFoundError, ConflictError } from "../../errors/appError.js";
import {
  ERROR_CODES,
  calculatePrice,
  type PricingBreakdown,
  type PricingItemInput,
} from "@sanitary/shared";

export const CATALOG_CACHE_KEY = "catalog:waste_types:active";
export const CATALOG_CACHE_TTL_SECONDS = 3600; // 1 hour

export interface QuoteRequestItem {
  wasteTypeId: string;
  quantity?: number;
  weightKg?: number;
}

export interface QuoteRequest {
  items: QuoteRequestItem[];
  distanceKm?: number;
  enableSurge?: boolean;
  surgeMultiplier?: number;
}

/**
 * Waste Type catalog and quote calculation service.
 */
export class WasteTypeService {
  /**
   * Retrieves active waste types with Redis cache-aside.
   * Big-O: O(1) Redis cache read on hit, O(k) Mongo read on miss.
   */
  public async getActiveCatalog(): Promise<WasteTypeRecord[]> {
    const redis = getRedisClient();

    if (redis.status === "ready") {
      try {
        const cached = await redis.get(CATALOG_CACHE_KEY);
        if (cached) {
          return JSON.parse(cached) as WasteTypeRecord[];
        }
      } catch (err) {
        logger.warn({ err }, "Redis cache read failed for waste catalog. Falling back to DB.");
      }
    }

    // Cache miss: read from DB
    try {
      let items = await wasteTypeRepo.findActive();
      if (items.length === 0) {
        // Auto-seed default catalog if collection is empty
        await wasteTypeRepo.seedDefaults(DEFAULT_WASTE_TYPES);
        items = await wasteTypeRepo.findActive();
      }
      if (items.length > 0) {
        if (redis.status === "ready") {
          try {
            await redis.set(
              CATALOG_CACHE_KEY,
              JSON.stringify(items),
              "EX",
              CATALOG_CACHE_TTL_SECONDS,
            );
          } catch (err) {
            logger.warn({ err }, "Failed to write waste catalog to Redis cache");
          }
        }
        return items;
      }
    } catch (err) {
      logger.warn(
        { err },
        "Failed to read waste catalog from DB, falling back to default seed data",
      );
    }

    // Fallback: return default seed types with valid 24-char hex ObjectIds if DB is empty or disconnected
    const SEED_HEX_IDS: Record<string, string> = {
      "small-bag": "660000000000000000000001",
      "medium": "660000000000000000000002",
      "bulk-furniture": "660000000000000000000003",
      "debris": "660000000000000000000004",
      "garden-waste": "660000000000000000000005",
      "e-waste": "660000000000000000000006",
      "scrap": "660000000000000000000007",
    };
    return DEFAULT_WASTE_TYPES.map((d, index) => ({
      ...d,
      _id: SEED_HEX_IDS[d.slug] || `66000000000000000000000${(index + 1).toString(16)}`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Retrieves all waste types for admin review.
   */
  public async getAllForAdmin(): Promise<WasteTypeRecord[]> {
    return wasteTypeRepo.findAll();
  }

  /**
   * Retrieves a waste type by ID.
   */
  public async getById(id: string): Promise<WasteTypeRecord> {
    const item = await wasteTypeRepo.findById(id);
    if (!item) {
      throw new NotFoundError(`Waste type not found with ID '${id}'`);
    }
    return item;
  }

  /**
   * Creates a new waste type and invalidates catalog cache.
   */
  public async create(data: CreateWasteTypeInput): Promise<WasteTypeRecord> {
    const existing = await wasteTypeRepo.findBySlug(data.slug);
    if (existing) {
      throw new ConflictError(`Waste type with slug '${data.slug}' already exists`);
    }

    const created = await wasteTypeRepo.create(data);
    await this.invalidateCache();
    return created;
  }

  /**
   * Updates an existing waste type and invalidates catalog cache.
   */
  public async update(
    id: string,
    updates: Partial<CreateWasteTypeInput>,
  ): Promise<WasteTypeRecord> {
    if (updates.slug) {
      const existing = await wasteTypeRepo.findBySlug(updates.slug);
      if (existing && existing._id !== id) {
        throw new ConflictError(`Waste type with slug '${updates.slug}' already exists`);
      }
    }

    const updated = await wasteTypeRepo.updateById(id, updates);
    if (!updated) {
      throw new NotFoundError(`Waste type not found with ID '${id}'`);
    }

    await this.invalidateCache();
    return updated;
  }

  /**
   * Deletes a waste type and invalidates catalog cache.
   */
  public async delete(id: string): Promise<void> {
    const deleted = await wasteTypeRepo.deleteById(id);
    if (!deleted) {
      throw new NotFoundError(`Waste type not found with ID '${id}'`);
    }

    await this.invalidateCache();
  }

  /**
   * Invalidates Redis cache upon catalog mutation.
   * Big-O: O(1) Redis DEL.
   */
  public async invalidateCache(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(CATALOG_CACHE_KEY);
      logger.info("Waste types catalog cache invalidated");
    } catch (err) {
      logger.warn({ err }, "Failed to invalidate waste types catalog cache");
    }
  }

  /**
   * Seeds default waste types if catalog is uninitialized.
   */
  public async seedDefaults(): Promise<void> {
    await wasteTypeRepo.seedDefaults(DEFAULT_WASTE_TYPES);
    await this.invalidateCache();
  }

  /**
   * Generates a price quote using the pure pricing engine.
   * Big-O: O(N) calculation time.
   */
  public async calculateQuote(req: QuoteRequest): Promise<{
    breakdown: PricingBreakdown;
    items: Array<PricingItemInput & { name: string }>;
  }> {
    const catalog = await this.getActiveCatalog();
    const catalogMap = new Map<string, WasteTypeRecord>();
    for (const c of catalog) {
      catalogMap.set(c._id, c);
      catalogMap.set(c.slug, c);
    }

    // Match each requested item against catalog
    const pricingItems: Array<PricingItemInput & { name: string }> = [];

    for (const requested of req.items) {
      let wasteType = catalogMap.get(requested.wasteTypeId);
      if (!wasteType) {
        wasteType = catalog.find(
          (c) =>
            requested.wasteTypeId === c._id ||
            requested.wasteTypeId === c.slug ||
            requested.wasteTypeId.includes(c.slug) ||
            c.slug.includes(requested.wasteTypeId),
        );
      }
      if (!wasteType) {
        wasteType = catalog[0];
      }
      if (!wasteType) {
        throw new AppError(
          400,
          ERROR_CODES.BAD_REQUEST,
          `Invalid or inactive waste type ID: '${requested.wasteTypeId}'`,
        );
      }

      pricingItems.push({
        wasteTypeId: wasteType._id,
        name: wasteType.name,
        quantity: requested.quantity ?? 1,
        weightKg: requested.weightKg ?? 0,
        basePricePaise: wasteType.basePrice,
        ratePerKgPaise: wasteType.ratePerKg,
        commissionRate: wasteType.commissionRate,
      });
    }

    const breakdown = calculatePrice(
      pricingItems,
      req.distanceKm ?? 0,
      {},
      {
        enableSurge: req.enableSurge,
        surgeMultiplier: req.surgeMultiplier,
      },
    );

    return {
      breakdown,
      items: pricingItems,
    };
  }
}

export const wasteTypeService = new WasteTypeService();
