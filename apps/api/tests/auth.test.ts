import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/app.js";
import { connectDB, disconnectDB } from "../src/infra/db.js";
import { setRedisClient } from "../src/infra/redis.js";
import { createMockRedis, type MockRedis } from "./helpers/mockRedis.js";
import { setSmsProvider, type SmsProvider } from "../src/modules/auth/smsProvider.js";
import { authService } from "../src/modules/auth/service.js";
import { UserModel } from "../src/modules/users/model.js";

describe("Phase 1: Authentication & Authorization Module", () => {
  let mongoServer: MongoMemoryServer;
  let mockRedis: MockRedis;
  let lastDispatchedOtp: string | null = null;
  let lastDispatchedPhone: string | null = null;

  const testSmsProvider: SmsProvider = {
    async sendOtp(phone: string, otp: string): Promise<void> {
      lastDispatchedPhone = phone;
      lastDispatchedOtp = otp;
    },
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());

    mockRedis = createMockRedis();
    setRedisClient(mockRedis as unknown as import("ioredis").Redis);
    setSmsProvider(testSmsProvider);
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockRedis.reset();
    lastDispatchedOtp = null;
    lastDispatchedPhone = null;
    await UserModel.deleteMany({});
  });

  it("completes full phone-OTP login and issues valid JWT access & refresh tokens", async () => {
    const phone = "+919876543210";

    // 1. Send OTP
    const sendRes = await request(app).post("/auth/send-otp").send({ phone });
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.success).toBe(true);
    expect(lastDispatchedPhone).toBe(phone);
    expect(lastDispatchedOtp).toMatch(/^\d{6}$/);

    // 2. Verify OTP
    const verifyRes = await request(app)
      .post("/auth/verify-otp")
      .send({ phone, otp: lastDispatchedOtp });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body).toHaveProperty("tokens");
    expect(verifyRes.body.tokens).toHaveProperty("accessToken");
    expect(verifyRes.body.tokens).toHaveProperty("refreshToken");
    expect(verifyRes.body.user).toHaveProperty("phone", phone);
    expect(verifyRes.body.user).toHaveProperty("role", "customer");

    const accessToken = verifyRes.body.tokens.accessToken;

    // 3. Access protected route with Bearer token
    const meRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user).toHaveProperty("phone", phone);
    expect(meRes.body.user).toHaveProperty("role", "customer");
  });

  it("rejects verification when OTP has expired", async () => {
    const phone = "+919876543211";

    await request(app).post("/auth/send-otp").send({ phone });
    expect(lastDispatchedOtp).toBeDefined();

    // Simulate OTP expiry by clearing key from Redis
    mockRedis.expireImmediately(`otp:${phone}`);

    const verifyRes = await request(app)
      .post("/auth/verify-otp")
      .send({ phone, otp: lastDispatchedOtp });

    expect(verifyRes.status).toBe(400);
    expect(verifyRes.body.error.code).toBe("OTP_EXPIRED");
  });

  it("locks out user when maximum wrong-OTP attempts are exceeded", async () => {
    const phone = "+919876543212";

    await request(app).post("/auth/send-otp").send({ phone });

    // Attempt 1: wrong OTP
    const res1 = await request(app).post("/auth/verify-otp").send({ phone, otp: "000000" });
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe("INVALID_OTP");
    expect(res1.body.error.details.remainingAttempts).toBe(2);

    // Attempt 2: wrong OTP
    const res2 = await request(app).post("/auth/verify-otp").send({ phone, otp: "111111" });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("INVALID_OTP");
    expect(res2.body.error.details.remainingAttempts).toBe(1);

    // Attempt 3: wrong OTP -> Lockout (429)
    const res3 = await request(app).post("/auth/verify-otp").send({ phone, otp: "222222" });
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe("OTP_ATTEMPTS_EXCEEDED");

    // Attempt 4: Even if correct OTP is provided afterwards, key was cleared
    const res4 = await request(app)
      .post("/auth/verify-otp")
      .send({ phone, otp: lastDispatchedOtp });
    expect([400, 429]).toContain(res4.status);
  });

  it("rotates refresh tokens and detects refresh token reuse, revoking the token family", async () => {
    const phone = "+919876543213";

    await request(app).post("/auth/send-otp").send({ phone });
    const loginRes = await request(app)
      .post("/auth/verify-otp")
      .send({ phone, otp: lastDispatchedOtp });

    const firstRefreshToken = loginRes.body.tokens.refreshToken;

    // Normal refresh: Should succeed and rotate tokens
    const refreshRes1 = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: firstRefreshToken });

    expect(refreshRes1.status).toBe(200);
    expect(refreshRes1.body).toHaveProperty("accessToken");
    expect(refreshRes1.body).toHaveProperty("refreshToken");

    const secondRefreshToken = refreshRes1.body.refreshToken;
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    // REUSE ATTACK: Presenting firstRefreshToken again after it was already rotated!
    const reuseRes = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: firstRefreshToken });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe("REFRESH_TOKEN_REUSE_DETECTED");

    // Breach consequence: The secondRefreshToken in the revoked family must now also be rejected
    const victimRes = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: secondRefreshToken });

    expect(victimRes.status).toBe(401);
    expect(["TOKEN_EXPIRED", "UNAUTHORIZED"]).toContain(victimRes.body.error.code);
  });

  it("enforces RBAC role guards and rejects unauthorized access", async () => {
    const customerPhone = "+919876543214";
    const adminPhone = "+919876543215";

    // 1. Unauthenticated request rejected
    const unauthRes = await request(app).get("/auth/test-admin");
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error.code).toBe("UNAUTHORIZED");

    // 2. Customer user tries to access admin route -> 403 Forbidden
    await authService.registerUserWithRole(customerPhone, "customer");
    await request(app).post("/auth/send-otp").send({ phone: customerPhone });
    const customerLogin = await request(app)
      .post("/auth/verify-otp")
      .send({ phone: customerPhone, otp: lastDispatchedOtp });

    const customerToken = customerLogin.body.tokens.accessToken;

    const customerForbiddenRes = await request(app)
      .get("/auth/test-admin")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(customerForbiddenRes.status).toBe(403);
    expect(customerForbiddenRes.body.error.code).toBe("FORBIDDEN");

    // Customer also forbidden from partner route
    const partnerForbiddenRes = await request(app)
      .get("/auth/test-partner")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(partnerForbiddenRes.status).toBe(403);
    expect(partnerForbiddenRes.body.error.code).toBe("FORBIDDEN");

    // 3. Admin user accesses admin route -> 200 OK
    await authService.registerUserWithRole(adminPhone, "admin");
    await request(app).post("/auth/send-otp").send({ phone: adminPhone });
    const adminLogin = await request(app)
      .post("/auth/verify-otp")
      .send({ phone: adminPhone, otp: lastDispatchedOtp });

    const adminToken = adminLogin.body.tokens.accessToken;

    const adminAllowedRes = await request(app)
      .get("/auth/test-admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminAllowedRes.status).toBe(200);
    expect(adminAllowedRes.body.message).toBe("Admin access granted");
  });

  it("rate limits requests when token bucket capacity is exceeded", async () => {
    const phone = "+919876543299";

    // Rate limiter has capacity 5 for send-otp
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/auth/send-otp").send({ phone });
      expect(res.status).toBe(200);
    }

    // 6th call should be rate limited
    const limitedRes = await request(app).post("/auth/send-otp").send({ phone });
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.error.code).toBe("RATE_LIMITED");
    expect(limitedRes.headers["retry-after"]).toBeDefined();
  });

  it("enforces unique phone index on User MongoDB collection", async () => {
    await UserModel.init();
    const phone = "+919876543288";

    await UserModel.create({ phone, role: "customer" });

    // Attempt duplicate insertion
    await expect(UserModel.create({ phone, role: "customer" })).rejects.toThrow();
  });
});
