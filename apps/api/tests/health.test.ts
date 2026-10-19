import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Health & Readiness Endpoints", () => {
  it("GET /health returns 200 with status ok and valid ISO timestamp", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptimeSeconds");
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    // Request ID header must be present
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("echoes client-provided X-Request-Id header", async () => {
    const clientRequestId = "custom-req-id-12345";
    const res = await request(app).get("/health").set("X-Request-Id", clientRequestId);

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe(clientRequestId);
  });

  it("GET /ready checks readiness dependencies status", async () => {
    const res = await request(app).get("/ready");

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("checks");
    expect(res.body.checks).toHaveProperty("mongodb");
    expect(res.body.checks).toHaveProperty("redis");
  });

  it("returns 404 in standard error shape for unknown endpoints", async () => {
    const res = await request(app).get("/unknown-route");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
      },
    });
  });
});
