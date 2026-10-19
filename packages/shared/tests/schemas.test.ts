import { describe, it, expect } from "vitest";
import {
  bookingStatusSchema,
  paiseSchema,
  signedPaiseSchema,
  mongoIdSchema,
  indianPhoneSchema,
  geoCoordinatesSchema,
  cursorPaginationSchema,
} from "../src/schemas.js";

describe("Shared Schemas", () => {
  it("validates booking statuses", () => {
    expect(bookingStatusSchema.safeParse("CREATED").success).toBe(true);
    expect(bookingStatusSchema.safeParse("SEARCHING").success).toBe(true);
    expect(bookingStatusSchema.safeParse("INVALID_STATUS").success).toBe(false);
  });

  it("validates paise amounts", () => {
    expect(paiseSchema.safeParse(0).success).toBe(true);
    expect(paiseSchema.safeParse(1500).success).toBe(true);
    expect(paiseSchema.safeParse(-5).success).toBe(false);
    expect(paiseSchema.safeParse(12.34).success).toBe(false);
  });

  it("validates signed paise for ledger operations", () => {
    expect(signedPaiseSchema.safeParse(-500).success).toBe(true);
    expect(signedPaiseSchema.safeParse(500).success).toBe(true);
    expect(signedPaiseSchema.safeParse(10.5).success).toBe(false);
  });

  it("validates mongo objectId strings", () => {
    expect(mongoIdSchema.safeParse("507f1f77bcf86cd799439011").success).toBe(true);
    expect(mongoIdSchema.safeParse("invalid-id").success).toBe(false);
  });

  it("validates Indian phone numbers", () => {
    expect(indianPhoneSchema.safeParse("+919876543210").success).toBe(true);
    expect(indianPhoneSchema.safeParse("+915876543210").success).toBe(false); // starts with 5
    expect(indianPhoneSchema.safeParse("9876543210").success).toBe(false); // missing +91
  });

  it("validates geo coordinates [longitude, latitude]", () => {
    expect(geoCoordinatesSchema.safeParse([77.5946, 12.9716]).success).toBe(true);
    expect(geoCoordinatesSchema.safeParse([190, 12.9716]).success).toBe(false); // invalid lon
    expect(geoCoordinatesSchema.safeParse([77.5946, 100]).success).toBe(false); // invalid lat
  });

  it("validates cursor pagination with defaults", () => {
    const parsedDefault = cursorPaginationSchema.safeParse({});
    expect(parsedDefault.success).toBe(true);
    if (parsedDefault.success) {
      expect(parsedDefault.data.limit).toBe(20);
      expect(parsedDefault.data.cursor).toBeUndefined();
    }

    const parsedCustom = cursorPaginationSchema.safeParse({ cursor: "abc123cursor", limit: "50" });
    expect(parsedCustom.success).toBe(true);
    if (parsedCustom.success) {
      expect(parsedCustom.data.limit).toBe(50);
      expect(parsedCustom.data.cursor).toBe("abc123cursor");
    }
  });
});
