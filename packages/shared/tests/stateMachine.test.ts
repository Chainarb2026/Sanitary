import { describe, it, expect } from "vitest";
import {
  BOOKING_TRANSITIONS,
  canTransition,
  assertValidTransition,
  InvalidStateTransitionError,
  isTerminalStatus,
} from "../src/stateMachine.js";
import { BOOKING_STATUSES } from "../src/constants.js";
import type { BookingStatus } from "../src/types.js";

describe("Booking State Machine", () => {
  it("covers all 11 booking statuses in the transitions map", () => {
    const statusesInMap = Object.keys(BOOKING_TRANSITIONS) as BookingStatus[];
    expect(statusesInMap.sort()).toEqual([...BOOKING_STATUSES].sort());
  });

  it("permits standard happy path lifecycle transitions", () => {
    const happyPath: BookingStatus[] = [
      "CREATED",
      "SEARCHING",
      "ASSIGNED",
      "EN_ROUTE",
      "ARRIVED",
      "OTP_VERIFIED",
      "COLLECTED",
      "PAID",
      "COMPLETED",
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i]!;
      const to = happyPath[i + 1]!;
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertValidTransition(from, to)).not.toThrow();
    }
  });

  it("handles NO_PARTNER recovery and fallback paths", () => {
    expect(canTransition("SEARCHING", "NO_PARTNER")).toBe(true);
    expect(canTransition("NO_PARTNER", "SEARCHING")).toBe(true);
    expect(canTransition("NO_PARTNER", "CANCELLED")).toBe(true);
  });

  it("allows unassigning partner back to SEARCHING from ASSIGNED", () => {
    expect(canTransition("ASSIGNED", "SEARCHING")).toBe(true);
  });

  it("permits allowed cancellations", () => {
    expect(canTransition("CREATED", "CANCELLED")).toBe(true);
    expect(canTransition("SEARCHING", "CANCELLED")).toBe(true);
    expect(canTransition("ASSIGNED", "CANCELLED")).toBe(true);
    expect(canTransition("EN_ROUTE", "CANCELLED")).toBe(true);
    expect(canTransition("ARRIVED", "CANCELLED")).toBe(true);
    expect(canTransition("OTP_VERIFIED", "CANCELLED")).toBe(true);
  });

  it("strictly rejects illegal and backwards transitions", () => {
    expect(canTransition("COMPLETED", "CREATED")).toBe(false);
    expect(canTransition("CANCELLED", "CREATED")).toBe(false);
    expect(canTransition("COLLECTED", "ASSIGNED")).toBe(false);
    expect(canTransition("PAID", "EN_ROUTE")).toBe(false);
    expect(canTransition("CREATED", "PAID")).toBe(false);

    expect(() => assertValidTransition("COMPLETED", "CREATED")).toThrow(
      InvalidStateTransitionError,
    );
  });

  it("identifies terminal states correctly", () => {
    expect(isTerminalStatus("COMPLETED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
    expect(isTerminalStatus("CREATED")).toBe(false);
    expect(isTerminalStatus("COLLECTED")).toBe(false);
    expect(isTerminalStatus("PAID")).toBe(false);
  });

  it("populates InvalidStateTransitionError with correct properties", () => {
    try {
      assertValidTransition("CREATED", "PAID");
      expect.fail("Expected assertion to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStateTransitionError);
      const error = err as InvalidStateTransitionError;
      expect(error.code).toBe("INVALID_STATE_TRANSITION");
      expect(error.from).toBe("CREATED");
      expect(error.to).toBe("PAID");
    }
  });
});
