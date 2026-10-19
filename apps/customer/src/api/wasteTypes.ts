import { apiClient } from "./client.js";

export interface WasteType {
  _id: string;
  slug: string;
  name: string;
  description: string;
  basePrice: number; // in paise
  ratePerKg: number; // in paise
  commissionRate: number;
  unit: string;
  isActive: boolean;
}

export interface QuoteItemInput {
  wasteTypeId: string;
  quantity: number;
  weightKg?: number;
}

export interface PricingBreakdown {
  base: number;
  perKg: number;
  convenienceFee: number;
  surgeMultiplier: number;
  total: number;
  partnerEarning: number;
  platformCommission: number;
}

export const FALLBACK_WASTE_TYPES: WasteType[] = [
  {
    _id: "seed-small-bag",
    slug: "small-bag",
    name: "Small Bag",
    description: "Standard domestic waste up to 10kg bag",
    basePrice: 5000,
    ratePerKg: 1000,
    commissionRate: 0.15,
    unit: "bag",
    isActive: true,
  },
  {
    _id: "seed-medium",
    slug: "medium",
    name: "Medium Waste",
    description: "Household bulk cartons, packaging, and mixed items",
    basePrice: 10000,
    ratePerKg: 1200,
    commissionRate: 0.15,
    unit: "item",
    isActive: true,
  },
  {
    _id: "seed-bulk-furniture",
    slug: "bulk-furniture",
    name: "Bulk Furniture",
    description: "Chairs, tables, mattresses, sofas, and large wooden items",
    basePrice: 30000,
    ratePerKg: 1500,
    commissionRate: 0.2,
    unit: "item",
    isActive: true,
  },
  {
    _id: "seed-debris",
    slug: "debris",
    name: "Debris & Construction Waste",
    description: "Tiles, plaster, cement bags, rubble, and renovation debris",
    basePrice: 25000,
    ratePerKg: 800,
    commissionRate: 0.18,
    unit: "bag",
    isActive: true,
  },
  {
    _id: "seed-garden-waste",
    slug: "garden-waste",
    name: "Garden Waste",
    description: "Leaves, tree branches, lawn trimmings, and organic clippings",
    basePrice: 8000,
    ratePerKg: 500,
    commissionRate: 0.12,
    unit: "bag",
    isActive: true,
  },
  {
    _id: "seed-e-waste",
    slug: "e-waste",
    name: "E-Waste",
    description: "Computers, TVs, kitchen appliances, cables, and circuit boards",
    basePrice: 15000,
    ratePerKg: 2500,
    commissionRate: 0.15,
    unit: "item",
    isActive: true,
  },
  {
    _id: "seed-scrap",
    slug: "scrap",
    name: "Scrap & Recyclable Metals",
    description: "Iron, aluminium, brass, copper, and mixed metal scrap",
    basePrice: 6000,
    ratePerKg: 1500,
    commissionRate: 0.1,
    unit: "kg",
    isActive: true,
  },
];

export async function getWasteTypes(): Promise<{ wasteTypes: WasteType[] }> {
  try {
    const res = await apiClient<{ items?: WasteType[]; wasteTypes?: WasteType[] }>("/waste-types");
    const wasteTypes = res.wasteTypes || res.items || [];
    if (wasteTypes.length > 0) {
      return { wasteTypes };
    }
    return { wasteTypes: FALLBACK_WASTE_TYPES };
  } catch (error) {
    console.warn("Catalog fetch failed, falling back to cached waste types:", error);
    return { wasteTypes: FALLBACK_WASTE_TYPES };
  }
}

export async function calculateQuote(
  items: QuoteItemInput[],
  distanceKm = 2,
  enableSurge = false,
  surgeMultiplier = 1.0,
): Promise<{ breakdown: PricingBreakdown }> {
  try {
    return await apiClient<{ breakdown: PricingBreakdown }>("/waste-types/quote", {
      method: "POST",
      body: JSON.stringify({
        items,
        distanceKm,
        enableSurge,
        surgeMultiplier,
      }),
    });
  } catch (error) {
    console.warn("Quote API request failed, computing fallback quote locally:", error);
    let base = 0;
    let perKg = 0;
    for (const it of items) {
      const match = FALLBACK_WASTE_TYPES.find(
        (w) => w._id === it.wasteTypeId || w.slug === it.wasteTypeId,
      );
      const bPrice = match?.basePrice ?? 5000;
      const rPrice = match?.ratePerKg ?? 1000;
      base += bPrice * (it.quantity || 1);
      perKg += rPrice * (it.weightKg || 0);
    }
    const convenienceFee = 5000;
    const subtotal = base + perKg + convenienceFee;
    const mult = enableSurge ? Math.min(1.5, Math.max(1.0, surgeMultiplier)) : 1.0;
    const total = Math.round(subtotal * mult);
    const platformCommission = Math.round(total * 0.15);
    const partnerEarning = total - platformCommission;

    return {
      breakdown: {
        base,
        perKg,
        convenienceFee,
        surgeMultiplier: mult,
        total,
        partnerEarning,
        platformCommission,
      },
    };
  }
}
