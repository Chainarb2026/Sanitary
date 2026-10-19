import { describe, it, expect } from "vitest";
import {
  toPaise,
  toRupees,
  addPaise,
  subtractPaise,
  multiplyPaise,
  formatINR,
  assertPaise,
  isPaise,
} from "../src/money.js";

describe("Money Utilities", () => {
  it("converts rupees to integer paise accurately", () => {
    expect(toPaise(10)).toBe(1000);
    expect(toPaise(10.5)).toBe(1050);
    expect(toPaise(10.55)).toBe(1055);
    expect(toPaise(0.01)).toBe(1);
    expect(toPaise(0)).toBe(0);
    // Rounding
    expect(toPaise(10.556)).toBe(1056);
  });

  it("throws for non-finite rupee values", () => {
    expect(() => toPaise(NaN)).toThrow(TypeError);
    expect(() => toPaise(Infinity)).toThrow(TypeError);
  });

  it("converts paise to rupees with decimal", () => {
    expect(toRupees(1000)).toBe(10);
    expect(toRupees(1050)).toBe(10.5);
    expect(toRupees(1055)).toBe(10.55);
    expect(toRupees(1)).toBe(0.01);
    expect(toRupees(0)).toBe(0);
  });

  it("asserts integer paise correctly", () => {
    expect(() => assertPaise(100)).not.toThrow();
    expect(() => assertPaise(0)).not.toThrow();
    expect(() => assertPaise(10.5)).toThrow(TypeError);
    expect(() => assertPaise("100")).toThrow(TypeError);
    expect(isPaise(100)).toBe(true);
    expect(isPaise(10.5)).toBe(false);
  });

  it("safely adds multiple paise values", () => {
    expect(addPaise(100, 250, 450)).toBe(800);
    expect(addPaise(0)).toBe(0);
    expect(addPaise()).toBe(0);
  });

  it("subtracts paise values", () => {
    expect(subtractPaise(1000, 350)).toBe(650);
  });

  it("multiplies paise by multiplier and rounds to integer", () => {
    // 15% commission on 5000 paise (Rs 50)
    expect(multiplyPaise(5000, 0.15)).toBe(750);
    // Rounding check: 100 paise * 0.155 = 15.5 -> 16 paise
    expect(multiplyPaise(100, 0.155)).toBe(16);
  });

  it("formats paise into Indian Rupee currency format (en-IN)", () => {
    const formattedZero = formatINR(0);
    expect(formattedZero).toContain("0.00");
    expect(formattedZero).toMatch(/₹|Rs/);

    const formattedLarge = formatINR(12345678); // Rs 1,23,456.78
    expect(formattedLarge).toMatch(/1,23,456\.78/);
  });
});
