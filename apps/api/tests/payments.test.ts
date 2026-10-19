import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/app.js";
import { connectDB, disconnectDB } from "../src/infra/db.js";
import { setRedisClient } from "../src/infra/redis.js";
import { createMockRedis, type MockRedis } from "./helpers/mockRedis.js";
import { generateAccessToken } from "../src/utils/jwt.js";
import { config } from "../src/infra/config.js";
import { BookingModel } from "../src/modules/bookings/model.js";
import { PartnerModel } from "../src/modules/partners/model.js";
import { LedgerEntryModel } from "../src/modules/ledger/model.js";
import { ledgerService } from "../src/modules/ledger/service.js";
import { payoutService } from "../src/modules/payouts/service.js";
import { setSettlementQueue } from "../src/modules/payouts/queue.js";
import { setDispatchQueue } from "../src/modules/dispatch/queue.js";
import { dispatchService } from "../src/modules/dispatch/service.js";

describe("Phase 6: Payments, Double-Entry Ledger & Settlement", () => {
  let mongoServer: MongoMemoryServer;
  let mockRedis: MockRedis;

  const customerId = new mongoose.Types.ObjectId().toString();

  const partnerId = new mongoose.Types.ObjectId().toString();
  const partnerPhone = "+919876542222";
  const partnerToken = generateAccessToken({
    sub: partnerId,
    role: "partner",
    phone: partnerPhone,
  });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());

    mockRedis = createMockRedis();
    setRedisClient(mockRedis as unknown as import("ioredis").Redis);

    setSettlementQueue({
      add: async (name: string, data: unknown) => ({ id: "mock-settle-job", name, data }),
      close: async () => {},
    } as unknown as import("bullmq").Queue);

    setDispatchQueue({
      add: async (name: string, data: unknown) => ({ id: "mock-dispatch-job", name, data }),
      close: async () => {},
    } as unknown as import("bullmq").Queue);
  });

  afterAll(async () => {
    setSettlementQueue(null);
    setDispatchQueue(null);
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockRedis.reset();
    await BookingModel.deleteMany({});
    await PartnerModel.deleteMany({});
    await LedgerEntryModel.deleteMany({});
  });

  it("property test: ledger always sums to zero across 50 stochastic multi-leg transactions", async () => {
    const transactionCount = 50;

    for (let i = 0; i < transactionCount; i++) {
      const txnId = `prop_txn_${i}_${Date.now()}`;
      // Random total amount between 1000 and 100000 paise (₹10 to ₹1000)
      const totalAmount = Math.floor(Math.random() * 99000) + 1000;

      // Random split between partner and platform
      const partnerEarning = Math.floor(totalAmount * (0.6 + Math.random() * 0.2));
      const platformFee = totalAmount - partnerEarning;

      expect(partnerEarning + platformFee).toBe(totalAmount);

      const custId = `cust_${i}`;
      const partId = `part_${i}`;

      await ledgerService.recordTransaction({
        transactionId: txnId,
        entries: [
          {
            accountType: "customer",
            accountId: custId,
            type: "debit",
            amountPaise: totalAmount,
            idempotencyKey: `${txnId}:cust:debit`,
            description: `Customer payment ${i}`,
          },
          {
            accountType: "partner",
            accountId: partId,
            type: "credit",
            amountPaise: partnerEarning,
            idempotencyKey: `${txnId}:part:credit`,
            description: `Partner earning ${i}`,
          },
          {
            accountType: "platform",
            accountId: "platform",
            type: "credit",
            amountPaise: platformFee,
            idempotencyKey: `${txnId}:plat:credit`,
            description: `Platform commission ${i}`,
          },
        ],
      });
    }

    // 1. Verify EVERY individual transaction group in the ledger sums to zero
    const allEntries = await LedgerEntryModel.find({}).lean().exec();
    expect(allEntries.length).toBe(transactionCount * 3);

    const groupedByTxn = new Map<string, typeof allEntries>();
    for (const entry of allEntries) {
      const group = groupedByTxn.get(entry.transactionId) ?? [];
      group.push(entry);
      groupedByTxn.set(entry.transactionId, group);
    }

    for (const [txnId, entries] of groupedByTxn.entries()) {
      let sum = 0;
      for (const e of entries) {
        if (e.type === "credit") {
          sum += e.amountPaise;
        } else if (e.type === "debit") {
          sum -= e.amountPaise;
        }
      }
      expect(sum, `Transaction '${txnId}' must sum exactly to 0`).toBe(0);
    }

    // 2. Global sum across all ledger entries in DB MUST sum exactly to zero
    let globalSum = 0;
    for (const e of allEntries) {
      if (e.type === "credit") {
        globalSum += e.amountPaise;
      } else {
        globalSum -= e.amountPaise;
      }
    }
    expect(globalSum, "Total ledger across all accounts must balance to zero").toBe(0);

    // 3. Reject imbalanced transactions with 400 LEDGER_IMBALANCE
    await expect(
      ledgerService.recordTransaction({
        transactionId: "imbalanced_txn",
        entries: [
          {
            accountType: "customer",
            accountId: "c1",
            type: "debit",
            amountPaise: 5000,
            idempotencyKey: "imb:1",
            description: "Imbalanced debit",
          },
          {
            accountType: "partner",
            accountId: "p1",
            type: "credit",
            amountPaise: 4000, // 1000 paise discrepancy!
            idempotencyKey: "imb:2",
            description: "Imbalanced credit",
          },
        ],
      }),
    ).rejects.toThrow("Double-entry imbalance");
  });

  it("webhook idempotency: replaying the same webhook 5 times changes balance ONCE", async () => {
    // 1. Create a booking in COLLECTED status
    const booking = await BookingModel.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      partnerId: new mongoose.Types.ObjectId(partnerId),
      items: [
        {
          wasteTypeId: new mongoose.Types.ObjectId(),
          name: "Bulk Furniture",
          category: "heavy",
          quantity: 1,
          pricePaise: 7800,
        },
      ],
      address: {
        addressLine1: "12th Main, HAL 2nd Stage",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560008",
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
      status: "COLLECTED",
      statusHistory: [
        { from: "CREATED", to: "SEARCHING", timestamp: new Date(), updatedBy: "system" },
        { from: "SEARCHING", to: "ASSIGNED", timestamp: new Date(), updatedBy: partnerId },
        { from: "ASSIGNED", to: "COLLECTED", timestamp: new Date(), updatedBy: partnerId },
      ],
      pickupOtpHashed: "hash",
    });

    const bookingId = booking._id.toString();

    // Initial balances should be 0
    const initialPartnerBal = await ledgerService.getBalance("partner", partnerId);
    expect(initialPartnerBal).toBe(0);

    // 2. Construct authentic Razorpay webhook payload and cryptographic signature
    const webhookEventId = `evt_pay_captured_${bookingId}`;
    const payloadObject = {
      id: webhookEventId,
      event: "payment.captured",
      bookingId,
      paymentId: `rzp_pay_${bookingId}_test`,
      amount: 7800,
    };
    const rawBody = JSON.stringify(payloadObject);

    const validSignature = crypto
      .createHmac("sha256", config.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    // 3. Fire the EXACT same webhook 5 times sequentially
    const replayCount = 5;
    const responses = [];

    for (let i = 0; i < replayCount; i++) {
      const res = await request(app)
        .post("/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", validSignature)
        .send(rawBody);

      responses.push(res);
    }

    // 4. Assert: all 5 responses return HTTP 200
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    // First response is processed (idempotentReplay: false)
    expect(responses[0]!.body.idempotentReplay).toBe(false);

    // Remaining 4 responses are detected and handled as idempotent replays (idempotentReplay: true)
    for (let i = 1; i < replayCount; i++) {
      expect(responses[i]!.body.idempotentReplay).toBe(true);
    }

    // 5. CRITICAL ASSERTION: Partner balance changed ONCE (exactly 4900 paise, not 5 * 4900)
    const finalPartnerBal = await ledgerService.getBalance("partner", partnerId);
    expect(finalPartnerBal).toBe(4900);

    const finalCustomerBal = await ledgerService.getBalance("customer", customerId);
    expect(finalCustomerBal).toBe(-7800);

    const finalPlatformBal = await ledgerService.getBalance("platform", "platform");
    expect(finalPlatformBal).toBe(2900);

    // Sum of all accounts balances is exactly zero
    expect(finalCustomerBal + finalPartnerBal + finalPlatformBal).toBe(0);

    // Verify exactly 3 ledger entries were inserted, never duplicated across the 5 replays
    const ledgerCount = await LedgerEntryModel.countDocuments({});
    expect(ledgerCount).toBe(3);

    // Booking state transitioned to PAID
    const updatedBooking = await BookingModel.findById(bookingId).lean().exec();
    expect(updatedBooking!.status).toBe("PAID");
  });

  it("cash payment debits platform commission from partner wallet and blocks offers if below minimum", async () => {
    // 1. Create Partner in MongoDB
    await PartnerModel.create({
      userId: new mongoose.Types.ObjectId(partnerId),
      phone: partnerPhone,
      name: "Ramesh Waste Collector",
      vehicleType: "truck",
      serviceRadiusKm: 5,
      isOnline: true,
      isActive: true,
      kyc: {
        documentType: "driving_license",
        documentNumber: "DL1234567890",
        documentUrl: "https://storage.sanitary.in/kyc/dl.jpg",
        status: "APPROVED",
        reviewedAt: new Date(),
      },
      rating: 4.8,
      acceptanceRate: 0.95,
      recentLoad: 0,
    });

    // 2. Create booking collected by this partner
    const booking = await BookingModel.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      partnerId: new mongoose.Types.ObjectId(partnerId),
      items: [
        {
          wasteTypeId: new mongoose.Types.ObjectId(),
          name: "Small Bag",
          category: "standard",
          quantity: 1,
          pricePaise: 7800,
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
      status: "COLLECTED",
      statusHistory: [
        { from: "CREATED", to: "SEARCHING", timestamp: new Date(), updatedBy: "system" },
        { from: "SEARCHING", to: "ASSIGNED", timestamp: new Date(), updatedBy: partnerId },
        { from: "ASSIGNED", to: "COLLECTED", timestamp: new Date(), updatedBy: partnerId },
      ],
      pickupOtpHashed: "hash",
    });

    const bookingId = booking._id.toString();

    // 3. Partner confirms cash collected in person
    const cashRes = await request(app)
      .post("/payments/cash/collect")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ bookingId });

    expect(cashRes.status).toBe(200);
    expect(cashRes.body.status).toBe("COMPLETED");
    expect(cashRes.body.method).toBe("CASH");

    // Partner wallet balance debited by platform fee (2900 paise): balance is now -2900 paise
    const partnerBal = await ledgerService.getBalance("partner", partnerId);
    expect(partnerBal).toBe(-2900);

    const platformBal = await ledgerService.getBalance("platform", "platform");
    expect(platformBal).toBe(2900);

    // 4. Test wallet balance threshold blocking:
    // If partner wallet balance is driven lower than MIN_PARTNER_WALLET_BALANCE_PAISE (-50,000 paise)
    // E.g. debit 60,000 paise
    await ledgerService.recordTransaction({
      transactionId: "heavy_cash_deductions",
      entries: [
        {
          accountType: "partner",
          accountId: partnerId,
          type: "debit",
          amountPaise: 60000,
          idempotencyKey: "heavy:debit:p",
          description: "Heavy platform commissions",
        },
        {
          accountType: "platform",
          accountId: "platform",
          type: "credit",
          amountPaise: 60000,
          idempotencyKey: "heavy:credit:p",
          description: "Commission credit",
        },
      ],
    });

    const insolventBalance = await ledgerService.getBalance("partner", partnerId);
    expect(insolventBalance).toBe(-62900); // Below -50000 floor!

    // Setup Redis GEO for partner location
    await mockRedis.geoadd("partners:geo", 77.6408, 12.9784, partnerId);
    await mockRedis.set(`partner:presence:${partnerId}`, "1", "EX", 30);

    // Dispatch search must block this partner due to negative wallet overdraft limit
    const candidates = await dispatchService.findProgressiveCandidates(12.9784, 77.6408);
    expect(candidates).not.toContain(partnerId);
  });

  it("handles partner payout request and settlement job execution", async () => {
    // 1. Credit partner wallet with ₹1000 (100,000 paise)
    await ledgerService.recordTransaction({
      transactionId: "initial_partner_funding",
      entries: [
        {
          accountType: "platform",
          accountId: "platform",
          type: "debit",
          amountPaise: 100000,
          idempotencyKey: "fund:plat:debit",
          description: "Platform adjustment",
        },
        {
          accountType: "partner",
          accountId: partnerId,
          type: "credit",
          amountPaise: 100000,
          idempotencyKey: "fund:part:credit",
          description: "Partner previous earnings",
        },
      ],
    });

    const initialBal = await ledgerService.getBalance("partner", partnerId);
    expect(initialBal).toBe(100000);

    // 2. Partner requests payout of ₹500 (50,000 paise)
    const payoutRes = await request(app)
      .post("/payouts/request")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        amountPaise: 50000,
        payoutMethod: "UPI",
        accountDetails: { upiId: "ramesh@oksbi" },
      });

    expect(payoutRes.status).toBe(201);
    expect(payoutRes.body.status).toBe("REQUESTED");
    expect(payoutRes.body.amountPaise).toBe(50000);

    const payoutId = payoutRes.body._id;

    // 3. Process settlement job
    const settled = await payoutService.processSettlement(payoutId);
    expect(settled.status).toBe("PROCESSED");
    expect(settled.processedAt).toBeDefined();

    // 4. Partner balance reduced by ₹500: now 50,000 paise
    const postSettlementBal = await ledgerService.getBalance("partner", partnerId);
    expect(postSettlementBal).toBe(50000);

    // 5. Overdraft payout attempt (requesting ₹800 when only ₹500 remains) is rejected
    const failedPayoutRes = await request(app)
      .post("/payouts/request")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({
        amountPaise: 80000,
        payoutMethod: "UPI",
        accountDetails: { upiId: "ramesh@oksbi" },
      });

    expect(failedPayoutRes.status).toBe(400);
    expect(failedPayoutRes.body.error.code).toBe("INSUFFICIENT_WALLET_BALANCE");
  });
});
