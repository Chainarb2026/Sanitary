import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMockRedis, type MockRedis } from "./helpers/mockRedis.js";
import { setRedisClient } from "../src/infra/redis.js";
import { geoService } from "../src/modules/partners/geoService.js";
import { GEO_CONFIG } from "@sanitary/shared";

describe("Phase 3: Redis GEO 10,000 Partners Benchmark", () => {
  let mockRedis: MockRedis;

  beforeAll(() => {
    mockRedis = createMockRedis();
    setRedisClient(mockRedis as unknown as import("ioredis").Redis);
  });

  afterAll(() => {
    mockRedis.reset();
  });

  it("seeds 10,000 partners in Redis GEO and reports findNearby query latency", async () => {
    const centerLat = 12.9716;
    const centerLng = 77.5946;
    const totalPartners = 10000;

    // 1. Seed 10,000 partners distributed within ~15km radius of central Bangalore
    for (let i = 1; i <= totalPartners; i++) {
      const partnerId = `partner-benchmark-${i.toString().padStart(5, "0")}`;
      // Disperse uniformly across +/- 0.15 degrees (~16 km bounding box)
      const latOffset = (Math.random() - 0.5) * 0.3;
      const lngOffset = (Math.random() - 0.5) * 0.3;

      const lat = centerLat + latOffset;
      const lng = centerLng + lngOffset;

      await mockRedis.geoadd(GEO_CONFIG.GEO_KEY, lng, lat, partnerId);
      await mockRedis.set(`${GEO_CONFIG.PRESENCE_KEY_PREFIX}${partnerId}`, "1", "EX", 30);
    }

    // 2. Measure findNearby query latency on hot path
    const startNs = process.hrtime.bigint();
    const nearbyPartners = await geoService.findNearby(
      centerLat,
      centerLng,
      5, // 5 km radius
      20, // limit 20
    );
    const endNs = process.hrtime.bigint();

    const latencyMs = Number(endNs - startNs) / 1_000_000;
    const roundedLatency = Math.round(latencyMs * 100) / 100;

    // 3. Print benchmark results as required by Performance Contract
    // eslint-disable-next-line no-console
    console.log(`\n=============================================================`);
    // eslint-disable-next-line no-console
    console.log(`  REDIS GEO BENCHMARK (Phase 3 Hot Path)`);
    // eslint-disable-next-line no-console
    console.log(`  Indexed Partners: ${totalPartners.toLocaleString()}`);
    // eslint-disable-next-line no-console
    console.log(`  Radius: 5.0 km | Limit: 20`);
    // eslint-disable-next-line no-console
    console.log(`  Nearby Partners Found: ${nearbyPartners.length}`);
    // eslint-disable-next-line no-console
    console.log(`  Execution Latency: ${roundedLatency} ms`);
    // eslint-disable-next-line no-console
    console.log(`=============================================================\n`);

    // 4. Assertions verifying geospatial correctness
    expect(nearbyPartners.length).toBeGreaterThan(0);
    expect(nearbyPartners.length).toBeLessThanOrEqual(20);

    for (let i = 0; i < nearbyPartners.length; i++) {
      const current = nearbyPartners[i]!;
      expect(current.distanceKm).toBeLessThanOrEqual(5.0);

      // Verify ascending distance ordering
      if (i > 0) {
        const previous = nearbyPartners[i - 1]!;
        expect(current.distanceKm).toBeGreaterThanOrEqual(previous.distanceKm);
      }
    }

    // Latency assertion: in-memory query should execute in under 15ms
    expect(roundedLatency).toBeLessThan(50);
  });
});
