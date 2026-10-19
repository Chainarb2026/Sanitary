export interface DefaultWasteTypeSeed {
  slug: string;
  name: string;
  description: string;
  basePrice: number; // paise
  ratePerKg: number; // paise
  commissionRate: number; // configurable per waste type
  unit: string;
}

export const DEFAULT_WASTE_TYPES: DefaultWasteTypeSeed[] = [
  {
    slug: "small-bag",
    name: "Small Bag",
    description: "Standard domestic waste up to 10kg bag",
    basePrice: 5000, // ₹50.00
    ratePerKg: 1000, // ₹10.00 / kg
    commissionRate: 0.15, // 15%
    unit: "bag",
  },
  {
    slug: "medium",
    name: "Medium Waste",
    description: "Household bulk cartons, packaging, and mixed items",
    basePrice: 10000, // ₹100.00
    ratePerKg: 1200, // ₹12.00 / kg
    commissionRate: 0.15, // 15%
    unit: "item",
  },
  {
    slug: "bulk-furniture",
    name: "Bulk Furniture",
    description: "Chairs, tables, mattresses, sofas, and large wooden items",
    basePrice: 30000, // ₹300.00
    ratePerKg: 1500, // ₹15.00 / kg
    commissionRate: 0.2, // 20%
    unit: "item",
  },
  {
    slug: "debris",
    name: "Debris & Construction Waste",
    description: "Tiles, plaster, cement bags, rubble, and renovation debris",
    basePrice: 25000, // ₹250.00
    ratePerKg: 800, // ₹8.00 / kg
    commissionRate: 0.18, // 18%
    unit: "bag",
  },
  {
    slug: "garden-waste",
    name: "Garden Waste",
    description: "Leaves, tree branches, lawn trimmings, and organic clippings",
    basePrice: 8000, // ₹80.00
    ratePerKg: 500, // ₹5.00 / kg
    commissionRate: 0.12, // 12%
    unit: "bag",
  },
  {
    slug: "e-waste",
    name: "E-Waste",
    description: "Computers, TVs, kitchen appliances, cables, and circuit boards",
    basePrice: 15000, // ₹150.00
    ratePerKg: 2500, // ₹25.00 / kg
    commissionRate: 0.15, // 15%
    unit: "item",
  },
  {
    slug: "scrap",
    name: "Scrap & Recyclable Metals",
    description: "Iron, aluminium, brass, copper, and mixed metal scrap",
    basePrice: 6000, // ₹60.00
    ratePerKg: 1500, // ₹15.00 / kg
    commissionRate: 0.1, // 10%
    unit: "kg",
  },
];
