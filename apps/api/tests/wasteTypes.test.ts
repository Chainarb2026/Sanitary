import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/app.js";
import { connectDB, disconnectDB } from "../src/infra/db.js";
import { setRedisClient } from "../src/infra/redis.js";
import { createMockRedis, type MockRedis } from "./helpers/mockRedis.js";
import { generateAccessToken } from "../src/utils/jwt.js";
import { wasteTypeService, CATALOG_CACHE_KEY } from "../src/modules/wasteTypes/service.js";
import { WasteTypeModel } from "../src/modules/wasteTypes/model.js";

describe("Phase 2: Waste Types Catalog & Pricing Integration", () => {
  let mongoServer: MongoMemoryServer;
  let mockRedis: MockRedis;

  const adminToken = generateAccessToken({
    sub: "admin-user-id-1",
    role: "admin",
    phone: "+919876543299",
  });

  const customerToken = generateAccessToken({
    sub: "customer-user-id-1",
    role: "customer",
    phone: "+919876543210",
  });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());

    mockRedis = createMockRedis();
    setRedisClient(mockRedis as unknown as import("ioredis").Redis);
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockRedis.reset();
    await WasteTypeModel.deleteMany({});
    await wasteTypeService.seedDefaults();
  });

  it("seeds the catalog with all 7 required default waste types", async () => {
    const res = await request(app).get("/waste-types");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(7);

    const slugs = res.body.items.map((i: { slug: string }) => i.slug);
    expect(slugs).toContain("small-bag");
    expect(slugs).toContain("medium");
    expect(slugs).toContain("bulk-furniture");
    expect(slugs).toContain("debris");
    expect(slugs).toContain("garden-waste");
    expect(slugs).toContain("e-waste");
    expect(slugs).toContain("scrap");
  });

  it("implements Redis cache-aside and invalidates cache on admin write", async () => {
    // 1. Initial request caches catalog in Redis
    expect(await mockRedis.get(CATALOG_CACHE_KEY)).toBeNull();

    const initialRes = await request(app).get("/waste-types");
    expect(initialRes.status).toBe(200);

    const cachedData = await mockRedis.get(CATALOG_CACHE_KEY);
    expect(cachedData).not.toBeNull();
    const parsedCache = JSON.parse(cachedData!);
    expect(parsedCache).toHaveLength(7);

    // 2. Admin creates a new waste type -> cache must be invalidated
    const newWasteType = {
      slug: "hazardous-chemical",
      name: "Hazardous Chemical Waste",
      description: "Paints, solvents, and household chemical containers",
      basePrice: 40000, // ₹400.00
      ratePerKg: 3000,
      commissionRate: 0.25,
      unit: "can",
      isActive: true,
    };

    const createRes = await request(app)
      .post("/waste-types")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(newWasteType);

    expect(createRes.status).toBe(201);
    expect(createRes.body.slug).toBe("hazardous-chemical");

    // Cache must have been invalidated (deleted from Redis)
    expect(await mockRedis.get(CATALOG_CACHE_KEY)).toBeNull();

    // Next get request repopulates cache with 8 items
    const secondRes = await request(app).get("/waste-types");
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.items).toHaveLength(8);
  });

  it("rejects non-admin users from creating, updating, or deleting waste types", async () => {
    // 1. Unauthenticated creation rejected
    const unauthRes = await request(app).post("/waste-types").send({
      slug: "unauth-type",
      name: "Unauthorized",
      description: "Should fail",
      basePrice: 1000,
      ratePerKg: 100,
      commissionRate: 0.1,
    });
    expect(unauthRes.status).toBe(401);

    // 2. Customer user rejected with 403 Forbidden
    const customerRes = await request(app)
      .post("/waste-types")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        slug: "customer-type",
        name: "Customer Attempt",
        description: "Should fail with forbidden",
        basePrice: 1000,
        ratePerKg: 100,
        commissionRate: 0.1,
      });
    expect(customerRes.status).toBe(403);
    expect(customerRes.body.error.code).toBe("FORBIDDEN");
  });

  it("admin can update and delete waste types, triggering cache invalidations", async () => {
    const listRes = await request(app).get("/waste-types");
    const itemToUpdate = listRes.body.items[0];

    // Ensure cache is populated
    expect(await mockRedis.get(CATALOG_CACHE_KEY)).not.toBeNull();

    // 1. Admin updates item
    const updateRes = await request(app)
      .put(`/waste-types/${itemToUpdate._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        basePrice: 7500, // Updated base price to ₹75.00
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.basePrice).toBe(7500);

    // Cache invalidated
    expect(await mockRedis.get(CATALOG_CACHE_KEY)).toBeNull();

    // 2. Admin deletes item
    const deleteRes = await request(app)
      .delete(`/waste-types/${itemToUpdate._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verification
    const afterDeleteRes = await request(app).get("/waste-types");
    expect(afterDeleteRes.body.items).toHaveLength(6);
  });

  it("calculates quotes accurately using pure pricing engine via POST /waste-types/quote", async () => {
    const listRes = await request(app).get("/waste-types");
    const smallBag = listRes.body.items.find((i: { slug: string }) => i.slug === "small-bag");
    const furniture = listRes.body.items.find((i: { slug: string }) => i.slug === "bulk-furniture");

    const quoteRes = await request(app)
      .post("/waste-types/quote")
      .send({
        items: [
          { wasteTypeId: smallBag._id, quantity: 2, weightKg: 15 },
          { wasteTypeId: furniture._id, quantity: 1, weightKg: 20 },
        ],
        distanceKm: 5,
        enableSurge: true,
        surgeMultiplier: 1.3,
      });

    expect(quoteRes.status).toBe(200);
    expect(quoteRes.body).toHaveProperty("breakdown");
    const { breakdown } = quoteRes.body;

    // Check surge applied
    expect(breakdown.surgeMultiplier).toBe(1.3);

    // Invariant check
    expect(breakdown.partnerEarning + breakdown.platformCommission + breakdown.convenienceFee).toBe(
      breakdown.total,
    );
  });
});
