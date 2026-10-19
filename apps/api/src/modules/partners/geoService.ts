import { getRedisClient } from "../../infra/redis.js";
import { GEO_CONFIG, type NearbyPartner } from "@sanitary/shared";
import { logger } from "../../infra/logger.js";

/**
 * High-performance geospatial tracking service backed by Redis GEO.
 * Live partner locations live exclusively in Redis GEO, not MongoDB.
 */
export class GeoService {
  /**
   * Records a partner's live GPS ping in Redis GEO with 30s presence TTL and server-side throttling.
   * Big-O: O(log N) Redis GEOADD + O(1) SET presence.
   */
  public async recordLocationPing(
    partnerId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ recorded: boolean; throttled: boolean }> {
    const redis = getRedisClient();

    // 1. Server-side throttle check (max 1 ping per 3 seconds per partner)
    const throttleKey = `partner:ping_throttle:${partnerId}`;
    const acquired = await redis.set(
      throttleKey,
      "1",
      "EX",
      GEO_CONFIG.PING_THROTTLE_SECONDS,
      "NX",
    );

    if (!acquired) {
      // Ping throttled to prevent mobile GPS flooding
      return { recorded: false, throttled: true };
    }

    const presenceKey = `${GEO_CONFIG.PRESENCE_KEY_PREFIX}${partnerId}`;

    // 2. Atomic pipeline: update GEO coordinates and refresh 30s presence TTL
    await redis
      .multi()
      .geoadd(GEO_CONFIG.GEO_KEY, longitude, latitude, partnerId)
      .set(presenceKey, "1", "EX", GEO_CONFIG.PRESENCE_TTL_SECONDS)
      .exec();

    return { recorded: true, throttled: false };
  }

  /**
   * Removes a partner from the geospatial index and clears presence upon going offline.
   * Big-O: O(log N) Redis ZREM.
   */
  public async removeLocation(partnerId: string): Promise<void> {
    const redis = getRedisClient();
    const presenceKey = `${GEO_CONFIG.PRESENCE_KEY_PREFIX}${partnerId}`;

    await redis.multi().zrem(GEO_CONFIG.GEO_KEY, partnerId).del(presenceKey).exec();
  }

  /**
   * Queries nearby online partners within radiusKm, strictly filtering by active 30s presence.
   *
   * Big-O: O(N + log M) where N is number of candidates within radius and M is total indexed items.
   */
  public async findNearby(
    lat: number,
    lng: number,
    radiusKm: number = GEO_CONFIG.DEFAULT_SEARCH_RADIUS_KM,
    limit: number = GEO_CONFIG.DEFAULT_SEARCH_LIMIT,
  ): Promise<NearbyPartner[]> {
    const redis = getRedisClient();

    // 1. Query Redis GEO sorted by distance ascending
    let rawResults: unknown;
    try {
      rawResults = await redis.call(
        "GEORADIUS",
        GEO_CONFIG.GEO_KEY,
        lng,
        lat,
        radiusKm,
        "km",
        "WITHCOORD",
        "WITHDIST",
        "ASC",
        "COUNT",
        limit,
      );
    } catch (err) {
      logger.error({ err }, "Redis GEORADIUS query failed");
      return [];
    }

    if (!Array.isArray(rawResults) || rawResults.length === 0) {
      return [];
    }

    // 2. Extract candidate partner IDs
    // GEORADIUS format: [ [partnerId, distance, [lng, lat]], ... ]
    const candidates = rawResults.map((item) => {
      const [partnerId, distStr, coords] = item as [
        string,
        string,
        [string | number, string | number],
      ];
      return {
        partnerId,
        distanceKm: parseFloat(distStr),
        longitude: parseFloat(String(coords[0])),
        latitude: parseFloat(String(coords[1])),
      };
    });

    if (candidates.length === 0) return [];

    // 3. Pipeline presence checks to filter out stale/disconnected partners
    const pipeline = redis.pipeline();
    for (const c of candidates) {
      pipeline.exists(`${GEO_CONFIG.PRESENCE_KEY_PREFIX}${c.partnerId}`);
    }
    const presenceResults = await pipeline.exec();

    // 4. Return only verified live candidates with active presence
    const activePartners: NearbyPartner[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const presenceCheck = presenceResults?.[i];
      const isPresent = presenceCheck && presenceCheck[1] === 1;

      if (isPresent) {
        const c = candidates[i]!;
        activePartners.push({
          partnerId: c.partnerId,
          distanceKm: c.distanceKm,
          coordinates: {
            latitude: c.latitude,
            longitude: c.longitude,
          },
        });
      }
    }

    return activePartners;
  }
}

export const geoService = new GeoService();
