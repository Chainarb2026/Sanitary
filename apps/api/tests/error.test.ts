import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import { assertValidTransition } from "@sanitary/shared";
import { errorHandler } from "../src/middlewares/errorHandler.js";
import { requestIdMiddleware } from "../src/middlewares/requestId.js";
import { BadRequestError } from "../src/errors/appError.js";

function createTestErrorApp() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(requestIdMiddleware);

  testApp.get("/test-zod-error", (_req, _res, next) => {
    try {
      z.object({ phone: z.string().min(10) }).parse({ phone: "123" });
    } catch (err) {
      next(err);
    }
  });

  testApp.get("/test-transition-error", (_req, _res, next) => {
    try {
      assertValidTransition("COMPLETED", "CREATED");
    } catch (err) {
      next(err);
    }
  });

  testApp.get("/test-app-error", (_req, _res, next) => {
    next(new BadRequestError("Custom bad request parameter", { param: "invalid" }));
  });

  testApp.get("/test-generic-error", (_req, _res, next) => {
    next(new Error("Database connection dropped"));
  });

  testApp.use(errorHandler);
  return testApp;
}

describe("Error Handling Middleware", () => {
  const testApp = createTestErrorApp();

  it("handles Zod validation error as 400 with VALIDATION_ERROR code and details", async () => {
    const res = await request(testApp).get("/test-zod-error");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Validation failed");
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details[0].path).toBe("phone");
  });

  it("handles invalid state transitions as 409 with INVALID_STATE_TRANSITION code", async () => {
    const res = await request(testApp).get("/test-transition-error");

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("INVALID_STATE_TRANSITION");
    expect(res.body.error.details).toEqual({
      from: "COMPLETED",
      to: "CREATED",
    });
  });

  it("handles domain AppError with corresponding status code and details", async () => {
    const res = await request(testApp).get("/test-app-error");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.message).toBe("Custom bad request parameter");
    expect(res.body.error.details).toEqual({ param: "invalid" });
  });

  it("handles unhandled generic errors as 500 with INTERNAL_ERROR without leaking internals", async () => {
    const res = await request(testApp).get("/test-generic-error");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.error.message).toBe("An internal server error occurred");
  });
});
