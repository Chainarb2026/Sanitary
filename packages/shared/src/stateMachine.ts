import type { BookingStatus } from "./types.js";

/**
 * Deterministic map of allowed status transitions for a booking.
 * Transitions are enforced ONLY through this map.
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  CREATED: ["SEARCHING", "CANCELLED"],
  SEARCHING: ["ASSIGNED", "NO_PARTNER", "CANCELLED"],
  NO_PARTNER: ["SEARCHING", "CANCELLED"],
  ASSIGNED: ["EN_ROUTE", "SEARCHING", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["OTP_VERIFIED", "CANCELLED"],
  OTP_VERIFIED: ["COLLECTED", "CANCELLED"],
  COLLECTED: ["PAID"],
  PAID: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export class InvalidStateTransitionError extends Error {
  public readonly code = "INVALID_STATE_TRANSITION";
  public readonly from: BookingStatus;
  public readonly to: BookingStatus;

  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Cannot transition booking status from '${from}' to '${to}'`);
    this.name = "InvalidStateTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * Checks whether transitioning from `from` to `to` is legally allowed.
 * Big-O: O(k) where k is the small constant number of outgoing transitions (<= 3), so O(1) time and O(1) space.
 */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  const allowed = BOOKING_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.includes(to);
}

/**
 * Asserts that a transition is valid or throws an explicit InvalidStateTransitionError.
 * Big-O: O(1) time, O(1) space.
 */
export function assertValidTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

/**
 * Returns whether a status is terminal (cannot transition further).
 * Big-O: O(1) time, O(1) space.
 */
export function isTerminalStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}
