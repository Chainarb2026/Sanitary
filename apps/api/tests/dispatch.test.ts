import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/app.js";
import { connectDB, disconnectDB } from "../src/infra/db.js";
import { setRedisClient } from "../src/infra/redis.js";
import { createMockRedis, type MockRedis } from "./helpers/mockRedis.js";
import { generateAccessToken } from "../src/utils/jwt.js";
import { BookingModel } from "../src/modules/bookings/model.js";
import { bookingRepo } from "../src/modules/bookings/repo.js";
import { PartnerModel } from "../src/modules/partners/model.js";
import { AddressModel } from "../src/modules/addresses/model.js";
import { dispatchService } from "../src/modules/dispatch/service.js";
import { calculatePartnerScore, selectTopKPartners } from "../src/modules/dispatch/scorer.js";

import { setDispatchQueue } from "../src/modules/dispatch/queue.js";

describe("Phase 5: Dispatch & Realtime Engine", () => {
  let mongoServer: MongoMemoryServer;
  let mockRedis: MockRedis;

  const customerId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());

    mockRedis = createMockRedis();
    setRedisClient(mockRedis as unknown as import("ioredis").Redis);

    setDispatchQueue({
      add: async (name: string, data: unknown) => ({ id: "mock-job-id", name, data }),
      close: async () => {},
    } as unknown as import("bullmq").Queue);
  });

  afterAll(async () => {
    setDispatchQueue(null);
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockRedis.reset();
    await BookingModel.deleteMany({});
    await PartnerModel.deleteMany({});
    await AddressModel.deleteMany({});
  });

  it("calculates weighted partner scores and ranks top-k using Min-Heap", () => {
    const candidates = [
      { partnerId: "p1", distanceKm: 1.0, rating: 4.8, acceptanceRate: 0.95, recentLoad: 0 },
      { partnerId: "p2", distanceKm: 6.0, rating: 4.2, acceptanceRate: 0.8, recentLoad: 5 },
      { partnerId: "p3", distanceKm: 0.5, rating: 5.0, acceptanceRate: 1.0, recentLoad: 0 },
      { partnerId: "p4", distanceKm: 2.5, rating: 4.9, acceptanceRate: 0.9, recentLoad: 1 },
      { partnerId: "p5", distanceKm: 7.5, rating: 3.5, acceptanceRate: 0.6, recentLoad: 8 },
    ];

    const scoreP3 = calculatePartnerScore(candidates[2]!);
    const scoreP1 = calculatePartnerScore(candidates[0]!);
    const scoreP2 = calculatePartnerScore(candidates[1]!);

    // P3 (0.5km, 5.0 rating, 1.0 acc) must score higher than P1, and much higher than P2
    expect(scoreP3).toBeGreaterThan(scoreP1);
    expect(scoreP1).toBeGreaterThan(scoreP2);

    // Min-heap selects top 3
    const top3 = selectTopKPartners(candidates, 3, 8);
    expect(top3).toHaveLength(3);
    expect(top3[0]!.partnerId).toBe("p3");
    expect(top3[1]!.partnerId).toBe("p1");
    expect(top3[2]!.partnerId).toBe("p4");
  });

  it("concurrency race: 20 partners accepting simultaneously and EXACTLY ONE wins", async () => {
    // 1. Create a booking in SEARCHING status
    const booking = await BookingModel.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      items: [
        {
          wasteTypeId: new mongoose.Types.ObjectId(),
          name: "Small Bag",
          category: "standard",
          quantity: 1,
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
      status: "SEARCHING",
      statusHistory: [
        { from: "CREATED", to: "SEARCHING", timestamp: new Date(), updatedBy: "system" },
      ],
      pickupOtpHashed: "hash",
    });

    const bookingId = booking._id.toString();

    // 2. Generate 20 distinct partners with valid JWT tokens
    const partnerCount = 20;
    const partners = Array.from({ length: partnerCount }, (_, i) => {
      const pId = new mongoose.Types.ObjectId().toString();
      const token = generateAccessToken({
        sub: pId,
        role: "partner",
        phone: `+9198765400${String(i).padStart(2, "0")}`,
      });
      return { id: pId, token };
    });

    // 3. Fire 20 simultaneous HTTP POST /bookings/:id/accept requests
    const promises = partners.map((p) =>
      request(app)
        .post(`/bookings/${bookingId}/accept`)
        .set("Authorization", `Bearer ${p.token}`)
        .send(),
    );

    const responses = await Promise.all(promises);

    // 4. Assert: EXACTLY ONE HTTP 200 success, EXACTLY 19 HTTP 409 Conflict
    const successes = responses.filter((r) => r.status === 200);
    const conflicts = responses.filter((r) => r.status === 409);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(19);

    // Winning response contains ASSIGNED status
    const winningRes = successes[0]!;
    expect(winningRes.body.status).toBe("ASSIGNED");
    expect(winningRes.body.partnerId).toBeDefined();

    const winningPartnerId = winningRes.body.partnerId;

    // All conflicting responses contain BOOKING_ALREADY_ASSIGNED code
    for (const conflictRes of conflicts) {
      expect(conflictRes.body.error.code).toBe("BOOKING_ALREADY_ASSIGNED");
    }

    // 5. Verify database state: exactly 1 partner assigned, status is ASSIGNED
    const dbBooking = await BookingModel.findById(bookingId).lean();
    expect(dbBooking).toBeDefined();
    expect(dbBooking!.status).toBe("ASSIGNED");
    expect(dbBooking!.partnerId?.toString()).toBe(winningPartnerId);
    expect(dbBooking!.statusHistory.filter((sh) => sh.to === "ASSIGNED")).toHaveLength(1);
  });

  it("handles 15s offer timeout fallthrough to the next candidate partner", async () => {
    // 1. Seed two partners: Partner 1 and Partner 2
    const p1Id = new mongoose.Types.ObjectId().toString();
    const p2Id = new mongoose.Types.ObjectId().toString();

    const p2Token = generateAccessToken({ sub: p2Id, role: "partner", phone: "+919876540102" });

    // 2. Create booking in SEARCHING status
    const booking = await BookingModel.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      items: [
        {
          wasteTypeId: new mongoose.Types.ObjectId(),
          name: "Small Bag",
          category: "standard",
          quantity: 1,
          pricePaise: 4900,
        },
      ],
      address: {
        addressLine1: "Indiranagar",
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
      status: "SEARCHING",
      statusHistory: [
        { from: "CREATED", to: "SEARCHING", timestamp: new Date(), updatedBy: "system" },
      ],
      pickupOtpHashed: "hash",
    });

    const bookingId = booking._id.toString();
    const candidates = [p1Id, p2Id];

    // Load strongly typed booking record
    const bookingRecord = await bookingRepo.findById(bookingId);
    expect(bookingRecord).toBeDefined();

    // Offer to candidate 0 (p1)
    await dispatchService.offerToCandidate(bookingRecord!, candidates, 0);

    // 3. Simulate 15s timeout on Partner 1 -> trigger timeout fallthrough to candidate 1 (p2)
    await dispatchService.handleOfferTimeout(bookingId, candidates, 0);

    // Booking must still be SEARCHING
    let currentBooking = await BookingModel.findById(bookingId).lean();
    expect(currentBooking!.status).toBe("SEARCHING");

    // Partner 2 accepts the fallen-through offer
    const acceptRes = await request(app)
      .post(`/bookings/${bookingId}/accept`)
      .set("Authorization", `Bearer ${p2Token}`)
      .send();

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.status).toBe("ASSIGNED");
    expect(acceptRes.body.partnerId).toBe(p2Id);

    // Verify DB updated with Partner 2
    currentBooking = await BookingModel.findById(bookingId).lean();
    expect(currentBooking!.status).toBe("ASSIGNED");
    expect(currentBooking!.partnerId?.toString()).toBe(p2Id);
  });

  it("marks NO_PARTNER when all candidates time out or no partners are available within 8km", async () => {
    const p1Id = new mongoose.Types.ObjectId().toString();
    const candidates = [p1Id];

    const booking = await BookingModel.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      items: [
        {
          wasteTypeId: new mongoose.Types.ObjectId(),
          name: "Small Bag",
          category: "standard",
          quantity: 1,
          pricePaise: 4900,
        },
      ],
      address: {
        addressLine1: "Indiranagar",
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
      status: "SEARCHING",
      statusHistory: [
        { from: "CREATED", to: "SEARCHING", timestamp: new Date(), updatedBy: "system" },
      ],
      pickupOtpHashed: "hash",
    });

    const bookingId = booking._id.toString();

    // Candidate 0 times out with no further candidates left
    await dispatchService.handleOfferTimeout(bookingId, candidates, 0);

    const updatedBooking = await BookingModel.findById(bookingId).lean();
    expect(updatedBooking!.status).toBe("NO_PARTNER");
    expect(updatedBooking!.statusHistory.some((sh) => sh.to === "NO_PARTNER")).toBe(true);
  });
});
