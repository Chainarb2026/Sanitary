import { describe, it, expect } from "vitest";
import { calculatePrice, type PricingItemInput, PRICING_CONFIG } from "../src/pricing.js";

describe("Pure Pricing Engine", () => {
  it("defaults surge to 1.0x when flag is omitted or false", () => {
    const items: PricingItemInput[] = [
      {
        wasteTypeId: "item-1",
        basePricePaise: 5000,
        ratePerKgPaise: 1000,
        commissionRate: 0.15,
        quantity: 2,
        weightKg: 5,
      },
    ];

    const resultWithoutFlag = calculatePrice(items);
    expect(resultWithoutFlag.surgeMultiplier).toBe(1.0);

    const resultWithDisabledFlag = calculatePrice(
      items,
      0,
      {},
      { enableSurge: false, surgeMultiplier: 1.4 },
    );
    expect(resultWithDisabledFlag.surgeMultiplier).toBe(1.0);
  });

  it("strictly caps surge multiplier at 1.5x even if higher multiplier requested", () => {
    const items: PricingItemInput[] = [
      {
        wasteTypeId: "item-1",
        basePricePaise: 10000,
        ratePerKgPaise: 500,
        commissionRate: 0.2,
        quantity: 1,
        weightKg: 10,
      },
    ];

    const resultOverCapped = calculatePrice(
      items,
      0,
      {},
      { enableSurge: true, surgeMultiplier: 2.5 },
    );
    expect(resultOverCapped.surgeMultiplier).toBe(PRICING_CONFIG.MAX_SURGE_MULTIPLIER);
    expect(resultOverCapped.surgeMultiplier).toBe(1.5);

    const resultAllowedSurge = calculatePrice(
      items,
      0,
      {},
      { enableSurge: true, surgeMultiplier: 1.25 },
    );
    expect(resultAllowedSurge.surgeMultiplier).toBe(1.25);
  });

  it("PROPERTY TEST: proves partnerEarning + commission + fees == total for 500 random inputs with zero rounding loss", () => {
    // Generate 500 stochastic permutations
    for (let iteration = 0; iteration < 500; iteration++) {
      const itemCount = Math.floor(Math.random() * 5) + 1; // 1 to 5 items
      const items: PricingItemInput[] = [];

      for (let i = 0; i < itemCount; i++) {
        items.push({
          wasteTypeId: `waste-type-${i}`,
          basePricePaise: Math.floor(Math.random() * 20000) + 100, // ₹1 to ₹200
          ratePerKgPaise: Math.floor(Math.random() * 5000) + 50, // ₹0.50 to ₹50/kg
          commissionRate: parseFloat((Math.random() * 0.25 + 0.05).toFixed(2)), // 5% to 30%
          quantity: Math.floor(Math.random() * 10) + 1, // 1 to 10
          weightKg: parseFloat((Math.random() * 80).toFixed(2)), // 0 to 80 kg
        });
      }

      const enableSurge = Math.random() > 0.5;
      const surgeMultiplier = parseFloat((Math.random() * 2.0 + 0.5).toFixed(2));
      const distanceKm = parseFloat((Math.random() * 30).toFixed(1));

      const breakdown = calculatePrice(items, distanceKm, {}, { enableSurge, surgeMultiplier });

      // Verify mathematical balance:
      // partnerEarning + platformCommission + convenienceFee === total
      const sum =
        breakdown.partnerEarning + breakdown.platformCommission + breakdown.convenienceFee;

      expect(sum).toBe(breakdown.total);

      // Assert all money components are strict non-negative integers
      expect(Number.isInteger(breakdown.base)).toBe(true);
      expect(Number.isInteger(breakdown.perKg)).toBe(true);
      expect(Number.isInteger(breakdown.convenienceFee)).toBe(true);
      expect(Number.isInteger(breakdown.total)).toBe(true);
      expect(Number.isInteger(breakdown.partnerEarning)).toBe(true);
      expect(Number.isInteger(breakdown.platformCommission)).toBe(true);

      expect(breakdown.partnerEarning).toBeGreaterThanOrEqual(0);
      expect(breakdown.platformCommission).toBeGreaterThanOrEqual(0);
      expect(breakdown.total).toBeGreaterThan(0);
    }
  });

  it("handles empty items list gracefully with convenience fee only", () => {
    const emptyResult = calculatePrice([]);
    expect(emptyResult.base).toBe(0);
    expect(emptyResult.perKg).toBe(0);
    expect(emptyResult.convenienceFee).toBe(PRICING_CONFIG.DEFAULT_CONVENIENCE_FEE_PAISE);
    expect(emptyResult.total).toBe(PRICING_CONFIG.DEFAULT_CONVENIENCE_FEE_PAISE);
    expect(emptyResult.partnerEarning).toBe(0);
    expect(emptyResult.platformCommission).toBe(0);
  });
});
