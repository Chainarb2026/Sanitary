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
import { AddressModel } from "../src/modules/addresses/model.js";
import { WasteTypeModel } from "../src/modules/wasteTypes/model.js";
import { DEFAULT_WASTE_TYPES } from "../src/modules/wasteTypes/seedData.js";
import { bookingEvents } from "../src/modules/bookings/events.js";

describe("Phase 4: Bookings Module", () => {
  let mongoServer: MongoMemoryServer;
  let mockRedis: MockRedis;

  const customerId = new mongoose.Types.ObjectId().toString();
  const customerPhone = "+919876543210";
  const customerToken = generateAccessToken({
    sub: customerId,
    role: "customer",
    phone: customerPhone,
  });

  const partnerId = new mongoose.Types.ObjectId().toString();
  const partnerPhone = "+919876543211";
  const partnerToken = generateAccessToken({
    sub: partnerId,
    role: "partner",
    phone: partnerPhone,
  });

  const adminId = new mongoose.Types.ObjectId().toString();
  const adminPhone = "+919876543299";
  const adminToken = generateAccessToken({
    sub: adminId,
    role: "admin",
    phone: adminPhone,
  });

  let testAddressId: string;
  let smallBagWasteTypeId: string;
  let mediumWasteTypeId: string;

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
    await BookingModel.deleteMany({});
    await AddressModel.deleteMany({});
    await WasteTypeModel.deleteMany({});

    // Seed waste types
    const wasteDocs = await WasteTypeModel.create(DEFAULT_WASTE_TYPES);
    const smallBag = wasteDocs.find((w) => w.slug === "small-bag");
    const mediumBag = wasteDocs.find((w) => w.slug === "medium");
    smallBagWasteTypeId = smallBag!._id.toString();
    mediumWasteTypeId = mediumBag!._id.toString();

    // Create a customer test address
    const addressDoc = await AddressModel.create({
      userId: new mongoose.Types.ObjectId(customerId),
      addressLine1: "123 Indiranagar 100ft Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      location: {
        type: "Point",
        coordinates: [77.6408, 12.9784], // [lng, lat]
      },
      label: "home",
      isDefault: true,
    });
    testAddressId = addressDoc._id.toString();
  });

  it("creates booking with address snapshot, stored quote, pickup OTP, and emits domain event", async () => {
    let eventReceived: { bookingId: string } | null = null;
    bookingEvents.once("booking.created", (payload) => {
      eventReceived = payload;
    });

    const payload = {
      addressId: testAddressId,
      items: [
        { wasteTypeId: smallBagWasteTypeId, quantity: 2, estimatedWeightKg: 5 },
        { wasteTypeId: mediumWasteTypeId, quantity: 1, estimatedWeightKg: 10 },
      ],
      slot: {
        date: "2026-10-15",
        startTime: "10:00",
        endTime: "12:00",
        type: "scheduled",
      },
      customerNotes: "Ring doorbell twice",
    };

    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("CREATED");
    expect(res.body.customerId).toBe(customerId);
    expect(res.body.address.addressLine1).toBe("123 Indiranagar 100ft Road");
    expect(res.body.quote.total).toBeGreaterThan(0);
    expect(
      res.body.quote.partnerEarning +
        res.body.quote.platformCommission +
        res.body.quote.convenienceFee,
    ).toBe(res.body.quote.total);
    expect(res.body.pickupOtp).toBeDefined();
    expect(res.body.pickupOtp).toMatch(/^\d{6}$/); // 6-digit numeric OTP shown to customer
    expect(res.body.statusHistory).toHaveLength(1);
    expect(res.body.statusHistory[0].from).toBe("CREATED");

    // Verify DB record stores only hashed OTP, not plain
    const dbBooking = await BookingModel.findById(res.body._id).lean();
    expect(dbBooking).toBeDefined();
    expect(dbBooking!.pickupOtpHashed).toBeDefined();
    expect(dbBooking!.pickupOtpHashed).not.toBe(res.body.pickupOtp);

    // Verify domain event emitted
    expect(eventReceived).not.toBeNull();
    expect(eventReceived.bookingId).toBe(res.body._id);
  });

  it("idempotency: duplicate idempotency keys return the original booking without duplicating records", async () => {
    const idempotencyKey = "client-txn-uuid-883921";
    const payload = {
      addressId: testAddressId,
      items: [{ wasteTypeId: smallBagWasteTypeId, quantity: 1, estimatedWeightKg: 3 }],
      slot: {
        date: "2026-10-15",
        startTime: "14:00",
        endTime: "16:00",
        type: "scheduled",
      },
    };

    // First request
    const firstRes = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

    expect(firstRes.status).toBe(201);
    const originalBookingId = firstRes.body._id;
    const originalPickupOtp = firstRes.body.pickupOtp;

    // Second request with identical idempotency key
    const secondRes = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.headers["x-idempotent-replay"]).toBe("true");
    expect(secondRes.body._id).toBe(originalBookingId);
    expect(secondRes.body.pickupOtp).toBe(originalPickupOtp);

    // Verify exactly one booking was created in the database
    const count = await BookingModel.countDocuments({
      customerId: new mongoose.Types.ObjectId(customerId),
      idempotencyKey,
    });
    expect(count).toBe(1);
  });

  it("rejects illegal state transitions and only permits valid transitions while appending statusHistory", async () => {
    // Create initial booking
    const booking = await BookingModel.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      items: [
        {
          wasteTypeId: new mongoose.Types.ObjectId(smallBagWasteTypeId),
          name: "Small Bag",
          category: "standard",
          quantity: 1,
          pricePaise: 4900,
        },
      ],
      address: {
        addressLine1: "123 Indiranagar",
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
      status: "CREATED",
      statusHistory: [
        { from: "CREATED", to: "CREATED", timestamp: new Date(), updatedBy: customerId },
      ],
      pickupOtpHashed: "some-hash-value",
    });

    const bookingId = booking._id.toString();

    // 1. ILLEGAL TRANSITION: CREATED -> PAID (Forbidden by state machine)
    const illegalRes = await request(app)
      .post(`/bookings/${bookingId}/transition`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID" });

    expect(illegalRes.status).toBe(409);
    expect(illegalRes.body.error.code).toBe("INVALID_STATE_TRANSITION");

    // 2. VALID TRANSITION: CREATED -> SEARCHING
    const validRes1 = await request(app)
      .post(`/bookings/${bookingId}/transition`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "SEARCHING", reason: "Dispatch algorithm initiated" });

    expect(validRes1.status).toBe(200);
    expect(validRes1.body.status).toBe("SEARCHING");
    expect(validRes1.body.statusHistory).toHaveLength(2);
    expect(validRes1.body.statusHistory[1].from).toBe("CREATED");
    expect(validRes1.body.statusHistory[1].to).toBe("SEARCHING");

    // 3. ILLEGAL TRANSITION: SEARCHING -> COMPLETED
    const illegalRes2 = await request(app)
      .post(`/bookings/${bookingId}/transition`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "COMPLETED" });

    expect(illegalRes2.status).toBe(409);
    expect(illegalRes2.body.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("handles pickup OTP physical verification by partner when ARRIVED", async () => {
    // Customer creates booking
    const createRes = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        addressId: testAddressId,
        items: [{ wasteTypeId: smallBagWasteTypeId, quantity: 1 }],
        slot: { date: "2026-10-15", startTime: "10:00", endTime: "12:00", type: "asap" },
      });

    const bookingId = createRes.body._id;
    const rawOtp = createRes.body.pickupOtp;

    // Simulate partner assignment and progression to ARRIVED
    await BookingModel.findByIdAndUpdate(bookingId, {
      partnerId: new mongoose.Types.ObjectId(partnerId),
      status: "ARRIVED",
    });

    // 1. Partner verifies with incorrect OTP -> 400
    const wrongOtpRes = await request(app)
      .post(`/bookings/${bookingId}/verify-otp`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ otp: "000000" });

    expect(wrongOtpRes.status).toBe(400);
    expect(wrongOtpRes.body.error.code).toBe("INVALID_PICKUP_OTP");

    // 2. Partner verifies with correct customer OTP -> transitions to OTP_VERIFIED
    const correctOtpRes = await request(app)
      .post(`/bookings/${bookingId}/verify-otp`)
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ otp: rawOtp });

    expect(correctOtpRes.status).toBe(200);
    expect(correctOtpRes.body.status).toBe("OTP_VERIFIED");
  });

  it("enforces customer cancellation rules and fee calculation based on booking status", async () => {
    // 1. Cancellation during CREATED status -> 0 cancellation fee
    const createRes1 = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        addressId: testAddressId,
        items: [{ wasteTypeId: smallBagWasteTypeId, quantity: 1 }],
        slot: { date: "2026-10-15", startTime: "10:00", endTime: "12:00", type: "asap" },
      });

    const bookingId1 = createRes1.body._id;

    const cancelRes1 = await request(app)
      .post(`/bookings/${bookingId1}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Changed my mind" });

    expect(cancelRes1.status).toBe(200);
    expect(cancelRes1.body.status).toBe("CANCELLED");
    expect(cancelRes1.body.cancellationFeePaise).toBe(0);

    // 2. Cancellation during EN_ROUTE -> 5000 paise (₹50 convenience fee assessed)
    const createRes2 = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        addressId: testAddressId,
        items: [{ wasteTypeId: smallBagWasteTypeId, quantity: 1 }],
        slot: { date: "2026-10-15", startTime: "10:00", endTime: "12:00", type: "asap" },
      });

    const bookingId2 = createRes2.body._id;
    await BookingModel.findByIdAndUpdate(bookingId2, {
      partnerId: new mongoose.Types.ObjectId(partnerId),
      status: "EN_ROUTE",
    });

    const cancelRes2 = await request(app)
      .post(`/bookings/${bookingId2}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Emergency popped up, partner please forgive" });

    expect(cancelRes2.status).toBe(200);
    expect(cancelRes2.body.status).toBe("CANCELLED");
    expect(cancelRes2.body.cancellationFeePaise).toBe(5000);

    // 3. Cancellation after OTP_VERIFIED -> Forbidden (execution started)
    await BookingModel.findByIdAndUpdate(bookingId2, { status: "OTP_VERIFIED" });
    const cancelRes3 = await request(app)
      .post(`/bookings/${bookingId2}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Try cancelling during weighing" });

    expect(cancelRes3.status).toBe(400);
    expect(cancelRes3.body.error.code).toBe("CANNOT_CANCEL_IN_CURRENT_STATUS");
  });

  it("implements keyset cursor pagination with zero page overlaps across multi-page traversals", async () => {
    // Seed 25 bookings for customer with staggered creation timestamps
    const bookingDocs = [];
    const baseTime = Date.now() - 3600000; // 1 hour ago

    for (let i = 0; i < 25; i++) {
      bookingDocs.push({
        customerId: new mongoose.Types.ObjectId(customerId),
        items: [
          {
            wasteTypeId: new mongoose.Types.ObjectId(smallBagWasteTypeId),
            name: `Item ${i}`,
            category: "standard",
            quantity: 1,
            pricePaise: 1000,
          },
        ],
        address: {
          addressLine1: `Address ${i}`,
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560038",
          location: { type: "Point", coordinates: [77.6408, 12.9784] },
        },
        slot: { date: "2026-10-15", startTime: "10:00", endTime: "12:00", type: "asap" },
        quote: {
          base: 1000,
          perKg: 0,
          convenienceFee: 500,
          surgeMultiplier: 1.0,
          total: 1500,
          partnerEarning: 1000,
          platformCommission: 500,
        },
        status: "CREATED",
        statusHistory: [
          {
            from: "CREATED",
            to: "CREATED",
            timestamp: new Date(baseTime + i * 1000),
            updatedBy: customerId,
          },
        ],
        pickupOtpHashed: "hash",
        createdAt: new Date(baseTime + i * 1000),
        updatedAt: new Date(baseTime + i * 1000),
      });
    }

    await BookingModel.insertMany(bookingDocs);

    // Page 1: fetch 10 items
    const page1Res = await request(app)
      .get("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .query({ limit: 10 });

    expect(page1Res.status).toBe(200);
    expect(page1Res.body.items).toHaveLength(10);
    expect(page1Res.body.hasMore).toBe(true);
    expect(page1Res.body.nextCursor).toBeDefined();

    const cursor1 = page1Res.body.nextCursor;
    const page1Ids = page1Res.body.items.map((b: { _id: string }) => b._id);

    // Page 2: fetch next 10 items using cursor
    const page2Res = await request(app)
      .get("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .query({ limit: 10, cursor: cursor1 });

    expect(page2Res.status).toBe(200);
    expect(page2Res.body.items).toHaveLength(10);
    expect(page2Res.body.hasMore).toBe(true);
    expect(page2Res.body.nextCursor).toBeDefined();

    const cursor2 = page2Res.body.nextCursor;
    const page2Ids = page2Res.body.items.map((b: { _id: string }) => b._id);

    // Verify zero overlap between page 1 and page 2
    const overlap1 = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(overlap1).toHaveLength(0);

    // Page 3: fetch remaining 5 items
    const page3Res = await request(app)
      .get("/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .query({ limit: 10, cursor: cursor2 });

    expect(page3Res.status).toBe(200);
    expect(page3Res.body.items).toHaveLength(5);
    expect(page3Res.body.hasMore).toBe(false);
    expect(page3Res.body.nextCursor).toBeNull();

    const page3Ids = page3Res.body.items.map((b: { _id: string }) => b._id);

    // Verify zero overlap between page 2 and page 3
    const overlap2 = page2Ids.filter((id: string) => page3Ids.includes(id));
    expect(overlap2).toHaveLength(0);

    // Total unique items retrieved equals exactly 25
    const totalRetrieved = new Set([...page1Ids, ...page2Ids, ...page3Ids]);
    expect(totalRetrieved.size).toBe(25);
  });
});
