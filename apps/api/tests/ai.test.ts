import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/app.js";
import { connectDB, disconnectDB } from "../src/infra/db.js";
import { setRedisClient } from "../src/infra/redis.js";
import { createMockRedis, type MockRedis } from "./helpers/mockRedis.js";
import { generateAccessToken } from "../src/utils/jwt.js";
import { MockAiProvider, setAiProvider } from "../src/modules/ai/provider.js";
import { BookingModel } from "../src/modules/bookings/model.js";
import { WasteTypeModel } from "../src/modules/wasteTypes/model.js";
import { AppError } from "../src/errors/appError.js";

describe("Phase 7: AI Vision Estimation, Resiliency & Fraud Detection", () => {
  let mongoServer: MongoMemoryServer;
  let mockRedis: MockRedis;
  let mockAiProvider: MockAiProvider;

  const customerId = new mongoose.Types.ObjectId().toString();
  const customerToken = generateAccessToken({
    sub: customerId,
    role: "customer",
    phone: "+919876541001",
  });

  const partnerId = new mongoose.Types.ObjectId().toString();
  const partnerToken = generateAccessToken({
    sub: partnerId,
    role: "partner",
    phone: "+919876542002",
  });

  const adminId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({
    sub: adminId,
    role: "admin",
    phone: "+919876543003",
  });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());

    mockRedis = createMockRedis();
    setRedisClient(mockRedis as unknown as import("ioredis").Redis);

    mockAiProvider = new MockAiProvider();
    setAiProvider(mockAiProvider);

    // Seed waste catalog
    await WasteTypeModel.create({
      slug: "small-bag",
      name: "Small Bag",
      description: "Standard small waste bag",
      basePrice: 4900,
      ratePerKg: 500,
      commissionRate: 0.2,
      unit: "item",
      isActive: true,
    });
  });

  afterAll(async () => {
    setAiProvider(null);
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockRedis.reset();
    mockAiProvider.getCircuitBreaker().reset();
    await BookingModel.deleteMany({});
  });

  it("handles invalid-JSON or malformed provider response by falling back to manual selection", async () => {
    // Configure mock handler to throw a JSON parse syntax error
    mockAiProvider.setMockHandler(async () => {
      throw new Error("Unexpected token < in JSON at position 0 (Invalid JSON from provider)");
    });

    const res = await request(app)
      .post("/ai/estimate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ imageUrl: "https://images.sanitary.in/waste_bad_json.jpg" });

    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.reason).toContain("PROVIDER_ERROR");
  });

  it("handles low-confidence (< 0.6) estimation by returning fallback for manual selection", async () => {
    // Configure mock handler to return confidence 0.42 (< 0.6)
    mockAiProvider.setMockHandler(async () => ({
      rawResponse: '{"confidence": 0.42}',
      estimate: {
        wasteType: "Small Bag",
        items: [{ name: "Indistinct Debris", quantity: 1, estimatedWeightKg: 2.0 }],
        estimatedWeightKg: 2.0,
        volumeClass: "small",
        hazardous: false,
        confidence: 0.42,
      },
      usage: {
        promptTokens: 250,
        completionTokens: 60,
        totalTokens: 310,
        estimatedCostPaise: 1,
      },
    }));

    const res = await request(app)
      .post("/ai/estimate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ imageUrl: "https://images.sanitary.in/waste_low_confidence.jpg" });

    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.reason).toContain("LOW_CONFIDENCE");
    expect(res.body.estimate.confidence).toBe(0.42);
  });

  it("handles provider timeout gracefully by returning fallback to manual selection", async () => {
    // Configure mock handler to simulate request timeout
    mockAiProvider.setMockHandler(async () => {
      throw new AppError(504, "AI_PROVIDER_TIMEOUT", "Gemini vision API request timed out");
    });

    const res = await request(app)
      .post("/ai/estimate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ imageUrl: "https://images.sanitary.in/waste_timeout.jpg" });

    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.reason).toContain("AI_PROVIDER_TIMEOUT");
  });

  it("caches successful estimate by image SHA-256 and feeds instant quote into pricing engine", async () => {
    let providerCallCount = 0;

    mockAiProvider.setMockHandler(async () => {
      providerCallCount++;
      return {
        rawResponse: '{"wasteType": "Small Bag", "confidence": 0.95}',
        estimate: {
          wasteType: "Small Bag",
          items: [{ name: "Segregated Paper & Plastic", quantity: 1, estimatedWeightKg: 6.0 }],
          estimatedWeightKg: 6.0,
          volumeClass: "small",
          hazardous: false,
          confidence: 0.95,
        },
        usage: {
          promptTokens: 320,
          completionTokens: 90,
          totalTokens: 410,
          estimatedCostPaise: 1,
        },
      };
    });

    const targetImageUrl = "https://images.sanitary.in/clean_waste_photo.jpg";

    // 1. First call: Cache miss -> invokes AI provider
    const res1 = await request(app)
      .post("/ai/estimate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ imageUrl: targetImageUrl });

    expect(res1.status).toBe(200);
    expect(res1.body.fallback).toBe(false);
    expect(res1.body.cacheHit).toBe(false);
    expect(res1.body.estimate.confidence).toBe(0.95);
    expect(res1.body.quote).toBeDefined();
    expect(res1.body.quote.total).toBeGreaterThan(0);
    expect(providerCallCount).toBe(1);

    // 2. Second call with same image URL: Cache hit -> returns cached result without invoking provider
    const res2 = await request(app)
      .post("/ai/estimate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ imageUrl: targetImageUrl });

    expect(res2.status).toBe(200);
    expect(res2.body.fallback).toBe(false);
    expect(res2.body.cacheHit).toBe(true);
    expect(res2.body.estimate.confidence).toBe(0.95);
    expect(res2.body.quote.total).toBe(res1.body.quote.total);
    // Provider handler count remains 1!
    expect(providerCallCount).toBe(1);
  });

  it("partner weighs pickup, computes estimation error, exposes admin accuracy, and triggers fraud flags", async () => {
    // 1. Create a booking in ARRIVED status with estimated weight 5.0 kg
    const booking = await BookingModel.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      partnerId: new mongoose.Types.ObjectId(partnerId),
      items: [
        {
          wasteTypeId: new mongoose.Types.ObjectId(),
          name: "Small Bag",
          category: "standard",
          quantity: 1,
          estimatedWeightKg: 5.0,
          pricePaise: 4900,
        },
      ],
      address: {
        addressLine1: "100ft Road, Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038",
        location: { type: "Point", coordinates: [77.6408, 12.9784] },
      },
      slot: { date: "2026-10-15", startTime: "10:00", endTime: "12:00", type: "asap" },
      quote: {
        base: 4900,
        perKg: 0,
        convenienceFee: 2900,
        surgeMultiplier: 1.0,
        total: 7800,
        partnerEarning: 4900,
        platformCommission: 2900,
      },
      status: "ARRIVED",
      statusHistory: [
        { from: "CREATED", to: "SEARCHING", timestamp: new Date(), updatedBy: "system" },
        { from: "SEARCHING", to: "ASSIGNED", timestamp: new Date(), updatedBy: partnerId },
        { from: "ASSIGNED", to: "ARRIVED", timestamp: new Date(), updatedBy: partnerId },
      ],
      pickupOtpHashed: "hash",
    });

    const bookingId = booking._id.toString();

    // 2. Partner records actual weight of 25.0 kg (huge 20kg discrepancy, z >= 3)
    // and sends partnerLocation coordinates 5km away (GPS mismatch)
    const weighRes = await request(app)
      .post(`/bookings/${bookingId}/weigh`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        actualWeightKg: 25.0,
        partnerLocation: {
          latitude: 13.02, // ~5km north of 12.9784
          longitude: 77.6408,
        },
      });

    expect(weighRes.status).toBe(200);
    expect(weighRes.body.actualWeightKg).toBe(25.0);
    expect(weighRes.body.estimationErrorKg).toBe(20.0);
    expect(weighRes.body.status).toBe("COLLECTED");

    // Both fraud flags triggered!
    expect(weighRes.body.fraudFlags).toContain("WEIGHT_MISMATCH");
    expect(weighRes.body.fraudFlags).toContain("GPS_MISMATCH");
    expect(weighRes.body.fraudScore).toBeGreaterThanOrEqual(20);

    // 3. Admin queries AI accuracy metric endpoint
    const adminRes = await request(app)
      .get("/admin/ai-accuracy")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.totalEvaluatedSamples).toBe(1);
    expect(adminRes.body.meanAbsoluteErrorKg).toBe(20.0);
    expect(adminRes.body.fraudFlagBreakdown.WEIGHT_MISMATCH).toBe(1);
    expect(adminRes.body.fraudFlagBreakdown.GPS_MISMATCH).toBe(1);
  });
});
