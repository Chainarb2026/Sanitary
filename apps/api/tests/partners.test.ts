import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/app.js";
import { connectDB, disconnectDB } from "../src/infra/db.js";
import { setRedisClient } from "../src/infra/redis.js";
import { createMockRedis, type MockRedis } from "./helpers/mockRedis.js";
import { generateAccessToken } from "../src/utils/jwt.js";
import { PartnerModel } from "../src/modules/partners/model.js";
import { AddressModel } from "../src/modules/addresses/model.js";
import mongoose from "mongoose";
import { GEO_CONFIG } from "@sanitary/shared";

describe("Phase 3: Partners & Geospatial Address Tracking", () => {
  let mongoServer: MongoMemoryServer;
  let mockRedis: MockRedis;

  const adminId = new mongoose.Types.ObjectId().toString();
  const partnerUserId = new mongoose.Types.ObjectId().toString();
  const customerUserId = new mongoose.Types.ObjectId().toString();

  const adminToken = generateAccessToken({
    sub: adminId,
    role: "admin",
    phone: "+919876543299",
  });

  const partnerUserToken = generateAccessToken({
    sub: partnerUserId,
    role: "partner",
    phone: "+919876543201",
  });

  const customerUserToken = generateAccessToken({
    sub: customerUserId,
    role: "customer",
    phone: "+919876543202",
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
    await PartnerModel.deleteMany({});
    await AddressModel.deleteMany({});
  });

  it("handles partner onboarding and admin approve/reject workflow", async () => {
    // 1. Partner submits onboarding with KYC document metadata
    const onboardPayload = {
      name: "Ramesh Waste Logistics",
      vehicleType: "three_wheeler",
      serviceRadiusKm: 8,
      documentType: "driving_license",
      documentNumber: "KA-01-2022-98765",
      documentUrl: "https://storage.sanitary.in/kyc/partner-doc-1.pdf",
    };

    const onboardRes = await request(app)
      .post("/partners/onboard")
      .set("Authorization", `Bearer ${partnerUserToken}`)
      .send(onboardPayload);

    expect(onboardRes.status).toBe(201);
    expect(onboardRes.body.kyc.status).toBe("PENDING");
    expect(onboardRes.body.isOnline).toBe(false);

    const partnerId = onboardRes.body._id;

    // 2. Unapproved partner attempts to go online -> 403 Forbidden
    const prematureOnlineRes = await request(app)
      .post("/partners/status")
      .set("Authorization", `Bearer ${partnerUserToken}`)
      .send({ isOnline: true });

    expect(prematureOnlineRes.status).toBe(403);
    expect(prematureOnlineRes.body.error.code).toBe("FORBIDDEN");

    // 3. Admin approves KYC
    const approveRes = await request(app)
      .post(`/partners/${partnerId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.partner.kyc.status).toBe("APPROVED");

    // 4. Approved partner toggles online successfully
    const onlineRes = await request(app)
      .post("/partners/status")
      .set("Authorization", `Bearer ${partnerUserToken}`)
      .send({ isOnline: true });

    expect(onlineRes.status).toBe(200);
    expect(onlineRes.body.isOnline).toBe(true);
  });

  it("records location pings in Redis GEO, enforces 30s presence, and throttles rapid pings", async () => {
    // 1. Setup online partner
    const partner = await PartnerModel.create({
      userId: partnerUserId,
      phone: "+919876543201",
      name: "Suresh Green Collector",
      vehicleType: "two_wheeler",
      serviceRadiusKm: 10,
      isOnline: true,
      kyc: {
        documentType: "aadhaar",
        documentNumber: "123456789012",
        documentUrl: "https://storage.sanitary.in/kyc/doc.pdf",
        status: "APPROVED",
        submittedAt: new Date(),
      },
    });

    const partnerId = partner._id.toString();

    // 2. Initial location ping (Bangalore Indiranagar)
    const ping1 = await request(app)
      .post("/partners/location")
      .set("Authorization", `Bearer ${partnerUserToken}`)
      .send({ latitude: 12.9784, longitude: 77.6408 });

    expect(ping1.status).toBe(200);
    expect(ping1.body.recorded).toBe(true);
    expect(ping1.body.throttled).toBe(false);

    // Verify presence key was set
    const presenceKey = `${GEO_CONFIG.PRESENCE_KEY_PREFIX}${partnerId}`;
    expect(await mockRedis.exists(presenceKey)).toBe(1);

    // 3. Immediate subsequent ping within 3 seconds -> throttled server-side
    const ping2 = await request(app)
      .post("/partners/location")
      .set("Authorization", `Bearer ${partnerUserToken}`)
      .send({ latitude: 12.9785, longitude: 77.6409 });

    expect(ping2.status).toBe(200);
    expect(ping2.body.throttled).toBe(true);

    // 4. Partner found via findNearby
    const nearbyRes = await request(app)
      .get("/partners/nearby")
      .query({ latitude: 12.9716, longitude: 77.5946, radiusKm: 10 });

    expect(nearbyRes.status).toBe(200);
    expect(nearbyRes.body.partners.length).toBeGreaterThan(0);
    expect(nearbyRes.body.partners[0].partnerId).toBe(partnerId);

    // 5. Going offline removes partner from Redis GEO
    await request(app)
      .post("/partners/status")
      .set("Authorization", `Bearer ${partnerUserToken}`)
      .send({ isOnline: false });

    expect(await mockRedis.exists(presenceKey)).toBe(0);

    const afterOfflineRes = await request(app)
      .get("/partners/nearby")
      .query({ latitude: 12.9716, longitude: 77.5946, radiusKm: 10 });

    expect(afterOfflineRes.body.partners).toHaveLength(0);
  });

  it("manages customer pickup addresses with GeoJSON and 2dsphere indexing", async () => {
    // 1. Customer creates home address
    const homeAddressPayload = {
      addressLine1: "Flat 402, Sunshine Heights, 100ft Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      latitude: 12.9716,
      longitude: 77.5946,
      label: "home",
      isDefault: true,
    };

    const add1Res = await request(app)
      .post("/addresses")
      .set("Authorization", `Bearer ${customerUserToken}`)
      .send(homeAddressPayload);

    expect(add1Res.status).toBe(201);
    expect(add1Res.body.location.type).toBe("Point");
    expect(add1Res.body.location.coordinates).toEqual([77.5946, 12.9716]); // [lng, lat]
    expect(add1Res.body.isDefault).toBe(true);

    const address1Id = add1Res.body._id;

    // 2. Customer creates second address marked as default -> previous default unset
    const workAddressPayload = {
      addressLine1: "WeWork Galaxy, Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560025",
      latitude: 12.973,
      longitude: 77.608,
      label: "work",
      isDefault: true,
    };

    const add2Res = await request(app)
      .post("/addresses")
      .set("Authorization", `Bearer ${customerUserToken}`)
      .send(workAddressPayload);

    expect(add2Res.status).toBe(201);
    expect(add2Res.body.isDefault).toBe(true);

    // Verify list orders default first
    const listRes = await request(app)
      .get("/addresses")
      .set("Authorization", `Bearer ${customerUserToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.addresses).toHaveLength(2);
    expect(listRes.body.addresses[0].label).toBe("work");
    expect(listRes.body.addresses[1].isDefault).toBe(false);

    // 3. Customer deletes address
    const delRes = await request(app)
      .delete(`/addresses/${address1Id}`)
      .set("Authorization", `Bearer ${customerUserToken}`);

    expect(delRes.status).toBe(200);

    const finalListRes = await request(app)
      .get("/addresses")
      .set("Authorization", `Bearer ${customerUserToken}`);

    expect(finalListRes.body.addresses).toHaveLength(1);
  });
});
