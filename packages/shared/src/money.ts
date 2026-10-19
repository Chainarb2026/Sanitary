import type { Paise } from "./types.js";

/**
 * Validates whether an amount is a valid integer paise representation.
 * Big-O: O(1) time, O(1) space.
 */
export function assertPaise(value: unknown): asserts value is Paise {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError(`Amount must be an integer paise value, received: ${String(value)}`);
  }
}

/**
 * Checks if a value is integer paise.
 * Big-O: O(1) time, O(1) space.
 */
export function isPaise(value: unknown): value is Paise {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * Converts a rupee float/number to integer paise.
 * Big-O: O(1) time, O(1) space.
 */
export function toPaise(rupees: number): Paise {
  if (typeof rupees !== "number" || !Number.isFinite(rupees)) {
    throw new TypeError(`Rupees must be a finite number, received: ${String(rupees)}`);
  }
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise to rupees with decimal.
 * Big-O: O(1) time, O(1) space.
 */
export function toRupees(paise: Paise): number {
  assertPaise(paise);
  return paise / 100;
}

/**
 * Sums an array of paise values safely.
 * Big-O: O(n) time where n is the number of amounts, O(1) space.
 */
export function addPaise(...amounts: Paise[]): Paise {
  return amounts.reduce((acc, curr) => {
    assertPaise(curr);
    return acc + curr;
  }, 0);
}

/**
 * Subtracts b from a in paise.
 * Big-O: O(1) time, O(1) space.
 */
export function subtractPaise(a: Paise, b: Paise): Paise {
  assertPaise(a);
  assertPaise(b);
  return a - b;
}

/**
 * Multiplies paise by a rate/factor (e.g., commission percentage) and rounds to nearest integer paise.
 * Big-O: O(1) time, O(1) space.
 */
export function multiplyPaise(paise: Paise, multiplier: number): Paise {
  assertPaise(paise);
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier)) {
    throw new TypeError(`Multiplier must be a finite number, received: ${String(multiplier)}`);
  }
  return Math.round(paise * multiplier);
}

/**
 * Formats integer paise into Indian Rupee string (e.g. "₹1,23,456.78").
 * Uses Indian number formatting standard.
 * Big-O: O(1) time, O(1) space.
 */
export function formatINR(paise: Paise): string {
  assertPaise(paise);
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
