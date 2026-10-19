import type { Paise } from "./types.js";
import { assertPaise } from "./money.js";

export interface PricingItemInput {
  wasteTypeId: string;
  name?: string;
  quantity?: number;
  weightKg?: number;
  basePricePaise: number;
  ratePerKgPaise: number;
  commissionRate: number; // e.g. 0.15 for 15%
}

export interface PricingFlags {
  enableSurge?: boolean;
  surgeMultiplier?: number;
}

export interface PricingSlot {
  timeSlot?: string;
  isPeak?: boolean;
  isWeekend?: boolean;
}

export interface PricingBreakdown {
  base: Paise;
  perKg: Paise;
  convenienceFee: Paise;
  surgeMultiplier: number;
  total: Paise;
  partnerEarning: Paise;
  platformCommission: Paise;
}

export const PRICING_CONFIG = {
  DEFAULT_CONVENIENCE_FEE_PAISE: 5000, // ₹50.00
  MAX_SURGE_MULTIPLIER: 1.5,
  MIN_SURGE_MULTIPLIER: 1.0,
} as const;

/**
 * PURE PRICING ENGINE
 *
 * Computes customer total, fees, and partner earnings strictly in integer paise.
 * Zero floating-point money math. Guarantees:
 *   partnerEarning + platformCommission + convenienceFee === total
 *
 * Big-O: O(N) time where N is the number of line items, O(1) space.
 */
export function calculatePrice(
  items: PricingItemInput[],
  _distanceKm: number = 0,
  _slot?: PricingSlot,
  flags?: PricingFlags,
): PricingBreakdown {
  if (!items || items.length === 0) {
    const fee = PRICING_CONFIG.DEFAULT_CONVENIENCE_FEE_PAISE;
    return {
      base: 0,
      perKg: 0,
      convenienceFee: fee,
      surgeMultiplier: 1.0,
      total: fee,
      partnerEarning: 0,
      platformCommission: 0,
    };
  }

  // 1. Determine surge multiplier (feature-flagged, default OFF, capped at 1.5x)
  let surge = 1.0;
  if (flags?.enableSurge) {
    const rawSurge = flags.surgeMultiplier ?? 1.0;
    surge = Math.min(
      Math.max(rawSurge, PRICING_CONFIG.MIN_SURGE_MULTIPLIER),
      PRICING_CONFIG.MAX_SURGE_MULTIPLIER,
    );
  }

  // 2. Sum line item components
  let totalBasePaise = 0;
  let totalPerKgPaise = 0;
  let totalCommissionPaise = 0;

  for (const item of items) {
    assertPaise(item.basePricePaise);
    assertPaise(item.ratePerKgPaise);

    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    const weight = Math.max(0, item.weightKg ?? 0);

    const itemBase = item.basePricePaise * qty;
    const itemPerKg = Math.round(item.ratePerKgPaise * weight);

    totalBasePaise += itemBase;
    totalPerKgPaise += itemPerKg;

    // Apply surge to item line subtotal before computing item commission
    const itemSubtotal = itemBase + itemPerKg;
    const itemSurgedSubtotal = Math.round(itemSubtotal * surge);

    // Configurable commission rate per waste type
    const itemCommission = Math.round(itemSurgedSubtotal * item.commissionRate);
    totalCommissionPaise += itemCommission;
  }

  // 3. Convenience fee
  const convenienceFee = PRICING_CONFIG.DEFAULT_CONVENIENCE_FEE_PAISE;

  // 4. Calculate final customer total
  const rawSubtotal = totalBasePaise + totalPerKgPaise;
  const surgedSubtotal = Math.round(rawSubtotal * surge);
  const total = surgedSubtotal + convenienceFee;

  // 5. Invariant preservation:
  // partnerEarning + platformCommission + convenienceFee == total
  // Partner receives surged items subtotal minus platform commission.
  const partnerEarning = surgedSubtotal - totalCommissionPaise;

  return {
    base: totalBasePaise,
    perKg: totalPerKgPaise,
    convenienceFee,
    surgeMultiplier: surge,
    total,
    partnerEarning,
    platformCommission: totalCommissionPaise,
  };
}

export const price = calculatePrice;
