import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Truck,
  ChevronRight,
  ShieldCheck,
  Zap,
  MapPin,
  Plus,
  Minus,
  Check,
  Leaf,
  Recycle,
  Sparkles,
} from "lucide-react";
import { getBookings } from "../api/bookings.js";
import { getWasteTypes } from "../api/wasteTypes.js";
import { useAuth } from "../hooks/useAuth.js";
import { SanitaryMark } from "../components/SanitaryLogo.js";
import { UberHero } from "../components/UberHero.js";

// Visual styling and consumer metadata for waste catalog
const WASTE_TYPE_META: Record<string, { icon: string; popular?: boolean; subtext?: string }> = {
  "small-bag": { icon: "🎒", popular: true, subtext: "Domestic kitchen/household bin (~up to 10kg)" },
  medium: { icon: "📦", popular: true, subtext: "Cartons, bulk packaging, mixed home declutter" },
  "bulk-furniture": { icon: "🛋️", popular: true, subtext: "Chairs, mattress, table, bed frame, wooden items" },
  debris: { icon: "🧱", subtext: "Tiles, plaster, rubble, cement bags" },
  "garden-waste": { icon: "🌿", subtext: "Tree branches, dry leaves, organic lawn trimmings" },
  "e-waste": { icon: "💻", subtext: "TV, microwave, PC, chargers, wires, circuits" },
  scrap: { icon: "🔩", subtext: "Iron, aluminium, copper, metal scrap bundle" },
};

export const MAJOR_CITIES_STATS = [
  {
    name: "Bengaluru",
    state: "Karnataka",
    partners: "180+ Active",
    sla: "11 mins",
    keyAreas: "Koramangala, Indiranagar, HSR, Whitefield, Jayanagar",
  },
  {
    name: "Mumbai (MMR)",
    state: "Maharashtra",
    partners: "210+ Active",
    sla: "14 mins",
    keyAreas: "Bandra, Andheri, Powai, Thane, Navi Mumbai",
  },
  {
    name: "Delhi-NCR",
    state: "National Capital",
    partners: "195+ Active",
    sla: "13 mins",
    keyAreas: "South Delhi, Gurugram Cyber City, Noida Sector 62",
  },
  {
    name: "Hyderabad",
    state: "Telangana",
    partners: "140+ Active",
    sla: "12 mins",
    keyAreas: "Gachibowli, Hitec City, Jubilee Hills, Madhapur",
  },
  {
    name: "Chennai",
    state: "Tamil Nadu",
    partners: "125+ Active",
    sla: "14 mins",
    keyAreas: "Adyar, Anna Nagar, T. Nagar, OMR IT Corridor",
  },
  {
    name: "Pune",
    state: "Maharashtra",
    partners: "95+ Active",
    sla: "15 mins",
    keyAreas: "Kothrud, Viman Nagar, Hinjewadi, Baner, Wakad",
  },
];

export const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Scroll to hash target if present (e.g. from nav link clicks)
  useEffect(() => {
    if (window.location.hash) {
      const targetId = window.location.hash.replace("#", "");
      const elem = document.getElementById(targetId);
      if (elem) {
        setTimeout(() => {
          elem.scrollIntoView({ behavior: "smooth" });
        }, 120);
      }
    }
  }, []);

  // Query: Fetch Active Ongoing Bookings
  const { data: bookingsData } = useQuery({
    queryKey: ["customerActiveBookings"],
    queryFn: () => getBookings(undefined, 5),
    enabled: isAuthenticated,
  });

  const activeBooking = bookingsData?.items.find((b) =>
    ["CREATED", "SEARCHING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"].includes(b.status),
  );

  // Fetch live real-time waste catalog from backend API
  const { data: catalogData } = useQuery({
    queryKey: ["wasteTypes"],
    queryFn: getWasteTypes,
  });

  const liveCatalog = useMemo(() => {
    const raw = catalogData?.wasteTypes || [];
    return raw.map((w) => {
      const meta = WASTE_TYPE_META[w.slug] || { icon: "♻️", subtext: w.description };
      return {
        _id: w._id,
        slug: w.slug,
        name: w.name,
        subtext: meta.subtext || w.description,
        flatPrice: Math.round(w.basePrice / 100),
        unitName: w.unit,
        icon: meta.icon,
        popular: meta.popular || false,
      };
    });
  }, [catalogData]);

  // Flat Pricing Calculator State
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({
    "small-bag": 1,
    medium: 0,
    "bulk-furniture": 0,
    "e-waste": 0,
    debris: 0,
    "garden-waste": 0,
    scrap: 0,
  });

  const updateItemQty = (slug: string, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[slug] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [slug]: next };
    });
  };

  // Calculate total flat fee
  const calculatedTotal = useMemo(() => {
    let subtotal = 0;
    let itemCount = 0;
    for (const item of liveCatalog) {
      const qty = selectedItems[item.slug] || 0;
      subtotal += item.flatPrice * qty;
      itemCount += qty;
    }
    return {
      subtotal,
      itemCount,
      total: subtotal,
    };
  }, [selectedItems, liveCatalog]);

  const handleSchedulePickup = () => {
    const itemsToBook = liveCatalog
      .filter((i) => (selectedItems[i.slug] || 0) > 0)
      .map((i) => ({
        wasteTypeId: i._id,
        quantity: selectedItems[i.slug],
        estimatedWeightKg: 1,
      }));

    if (itemsToBook.length > 0) {
      navigate(`/book?items=${encodeURIComponent(JSON.stringify(itemsToBook))}`);
    } else {
      navigate("/book");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
      {/* Active Ongoing Pickup Banner */}
      {activeBooking && (
        <Link
          to={`/tracking/${activeBooking._id || activeBooking.id}`}
          style={{ textDecoration: "none" }}
        >
          <div
            style={{
              borderRadius: "16px",
              border: "1.5px solid #a7f3d0",
              background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 8px 24px rgba(5, 150, 105, 0.12)",
              padding: "18px 24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
                }}
              >
                <Truck size={24} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#047857",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    Active Doorstep Pickup
                  </span>
                  <span
                    style={{
                      background: "#ffffff",
                      border: "1px solid #a7f3d0",
                      color: "#059669",
                      fontSize: "11px",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "9999px",
                    }}
                  >
                    {activeBooking.status}
                  </span>
                </div>
                <div
                  style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}
                >
                  Sanitary Partner En Route — Tap to view live arrival radar & pickup code
                </div>
              </div>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0f172a",
              }}
            >
              <ChevronRight size={20} />
            </div>
          </div>
        </Link>
      )}

      {/* 1. HERO SECTION: "Request a pickup" with Grand Transparent Image Slider */}
      <UberHero />

      {/* 2. FLAT-FEE TRANSPARENT PRICING CALCULATOR (LIGHT, CLEAN, CONSUMER-FRIENDLY) */}
      <section id="flat-pricing" style={{ scrollMarginTop: "90px" }}>
        <div
          style={{
            padding: "36px 32px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "24px",
            boxShadow: "0 10px 30px -5px rgba(15, 23, 42, 0.05), 0 20px 25px -5px rgba(15, 23, 42, 0.02)",
          }}
        >
          <div style={{ maxWidth: "720px", marginBottom: "28px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#047857",
                  fontSize: "12px",
                  fontWeight: 800,
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Check size={13} color="#059669" /> Transparent Flat-Fee Calculator
              </span>
            </div>
            <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginBottom: "8px", letterSpacing: "-0.02em" }}>
              Simple Flat Rates. No Confusing Kilograms to Guess.
            </h2>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              Most households don't own commercial weighing scales for garbage! Select the number of standard bags
              or items you have. What you see is what you pay — with zero hidden charges or surprises.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "32px",
              alignItems: "start",
            }}
          >
            {/* Left Column: Bag / Item Quantities Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {liveCatalog.map((item) => {
                const qty = selectedItems[item.slug] || 0;
                const isSelected = qty > 0;
                return (
                  <div
                    key={item.slug}
                    style={{
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      border: isSelected ? "1.5px solid #059669" : "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 4px 12px rgba(5, 150, 105, 0.08)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span style={{ fontSize: "24px" }}>{item.icon}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "15px", color: "#0f172a", fontWeight: 700 }}>
                            {item.name}
                          </strong>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 800,
                              color: "#047857",
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                            }}
                          >
                            ₹{item.flatPrice} / {item.unitName}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            marginTop: "2px",
                          }}
                        >
                          {item.subtext}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Increment/Decrement Buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => updateItemQty(item.slug, -1)}
                        disabled={qty <= 0}
                        aria-label={`Decrease ${item.name}`}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: qty <= 0 ? "#f8fafc" : "#ffffff",
                          color: qty <= 0 ? "#94a3b8" : "#0f172a",
                          cursor: qty <= 0 ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Minus size={14} />
                      </button>

                      <span
                        style={{
                          minWidth: "26px",
                          textAlign: "center",
                          fontSize: "16px",
                          fontWeight: 800,
                          color: isSelected ? "#059669" : "#64748b",
                        }}
                      >
                        {qty}
                      </span>

                      <button
                        type="button"
                        onClick={() => updateItemQty(item.slug, 1)}
                        aria-label={`Increase ${item.name}`}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#059669",
                          color: "#ffffff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Dynamic Price Summary Sticky Card */}
            <div
              style={{
                position: "sticky",
                top: "100px",
                padding: "26px",
                background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
                border: "1.5px solid #a7f3d0",
                borderRadius: "20px",
                boxShadow: "0 10px 25px -5px rgba(5, 150, 105, 0.1)",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: "14px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#059669",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Guaranteed Pickup Quote
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                    All-Inclusive Doorstep Fare
                  </div>
                </div>

                <SanitaryMark size={20} color="#059669" />
              </div>

              {/* Selected Items Breakdown */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}
              >
                {calculatedTotal.itemCount === 0 ? (
                  <div
                    style={{ color: "#64748b", textAlign: "center", padding: "16px 0", fontSize: "13px" }}
                  >
                    Tap + on any bag or item on the left to build your pickup quote.
                  </div>
                ) : (
                  liveCatalog.filter((i) => (selectedItems[i.slug] || 0) > 0).map((i) => {
                    const count = selectedItems[i.slug] || 0;
                    return (
                      <div
                        key={i.slug}
                        style={{ display: "flex", justifyContent: "space-between" }}
                      >
                        <span style={{ color: "#475569" }}>
                          {count} × {i.name}:
                        </span>
                        <span style={{ color: "#0f172a", fontWeight: 700 }}>
                          ₹{i.flatPrice * count}
                        </span>
                      </div>
                    );
                  })
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#64748b",
                    fontSize: "13px",
                    paddingTop: "6px",
                  }}
                >
                  <span>Doorstep Handling & Vehicle Dispatch:</span>
                  <span style={{ color: "#059669", fontWeight: 700 }}>FREE (₹0)</span>
                </div>

                <div
                  style={{
                    borderTop: "1px dashed #cbd5e1",
                    paddingTop: "14px",
                    marginTop: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <span
                      style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}
                    >
                      Total Flat Price:
                    </span>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      Zero hidden surge • Pay on pickup
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "34px",
                      fontWeight: 900,
                      fontFamily: "var(--font-display)",
                      color: "#059669",
                    }}
                  >
                    ₹{calculatedTotal.total}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSchedulePickup}
                className="btn btn-primary btn-block btn-lg"
                style={{
                  marginTop: "6px",
                  padding: "16px",
                  fontSize: "15px",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  boxShadow: "0 4px 16px rgba(5, 150, 105, 0.35)",
                }}
              >
                Schedule This Pickup <ArrowRight size={16} />
              </button>

              <div
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <ShieldCheck size={14} color="#059669" />
                <span>Zero-loss double-entry receipt issued via UPI QR / Cash</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS: 3 SIMPLE STEPS (REPLACED GIMMICKY AI SCANNER WITH HIGH-VALUE CUSTOMER FLOW) */}
      <section style={{ scrollMarginTop: "90px" }}>
        <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto 36px auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                fontSize: "12px",
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: "9999px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Sparkles size={12} color="#059669" /> Doorstep Collection Made Effortless
            </span>
          </div>
          <h2 style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", marginBottom: "10px", letterSpacing: "-0.02em" }}>
            How Sanitary Works in 3 Easy Steps
          </h2>
          <p style={{ fontSize: "15px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
            No taking photos of dirty trash. No haggling with scrap dealers. Just transparent on-demand pickup.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {/* Step 1 */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "20px",
              padding: "32px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
                fontSize: "20px",
                fontWeight: 800,
              }}
            >
              1
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Select Bags or Items
            </h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              Pick standard bag sizes, cartons, or old furniture in 1 click. Zero weighing scales required; pricing is 100% flat and transparent.
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "20px",
              padding: "32px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "#f0fdf4",
                border: "1px solid #a7f3d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
                fontSize: "20px",
                fontWeight: 800,
              }}
            >
              2
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Electric EV Specialist Arrives
            </h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              A verified partner in an official uniform arrives in an electric Tata Ace EV in under 15 minutes. Track their arrival on live GPS.
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "20px",
              padding: "32px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
                fontSize: "20px",
                fontWeight: 800,
              }}
            >
              3
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              100% Certified Recycling
            </h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              Share your 6-digit pickup OTP and pay via UPI QR or cash. 100% of collected waste is diverted from landfills to authorized recycling plants.
            </p>
          </div>
        </div>
      </section>

      {/* 4. CITIES COVERAGE SHOWCASE (LIGHT THEMED, HIGH-CONTRAST) */}
      <section id="cities-coverage" style={{ scrollMarginTop: "90px" }}>
        <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto 36px auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                fontSize: "12px",
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: "9999px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <MapPin size={12} color="#059669" /> Rapid Doorstep Coverage
            </span>
          </div>
          <h2 style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", marginBottom: "10px", letterSpacing: "-0.02em" }}>
            Active Across Major Indian Metros
          </h2>
          <p style={{ fontSize: "15px", color: "#475569", margin: 0 }}>
            Sanitary operates neighborhood dispatch hubs with electric fleet specialists ready for rapid dispatch.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {MAJOR_CITIES_STATS.map((c) => (
            <div
              key={c.name}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "14px",
                boxShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.05)",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              <div>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={18} color="#059669" />
                    <strong style={{ fontSize: "17px", color: "#0f172a", fontWeight: 800 }}>{c.name}</strong>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#047857",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      padding: "3px 8px",
                      borderRadius: "9999px",
                    }}
                  >
                    {c.partners}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#059669",
                    fontWeight: 700,
                    marginTop: "6px",
                  }}
                >
                  Average Arrival SLA: {c.sla}
                </div>

                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px", lineHeight: 1.5 }}>
                  Active Hubs: {c.keyAreas}
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                }}
              >
                <span style={{ color: "#475569" }}>
                  Daily Pickup Slot: 8 AM – 8 PM
                </span>
                <span style={{ color: "#059669", fontWeight: 800 }}>● Live Now</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. WHY RESIDENTS CHOOSE SANITARY (CONSUMER-CENTRIC BENTO GRID) */}
      <section>
        <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto 36px auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            <SanitaryMark size={16} color="#059669" />
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "#047857",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Why Residents Trust Sanitary
            </span>
          </div>
          <h2 style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", marginBottom: "10px", letterSpacing: "-0.02em" }}>
            The Cleanest Way to Declutter Your Home
          </h2>
          <p style={{ fontSize: "15px", color: "#475569", margin: 0 }}>
            Reliable doorstep recycling designed for modern apartment living.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {/* Card 1: 100% Electric EV Fleet */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
                marginBottom: "16px",
              }}
            >
              <Zap size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
              100% Electric Fleet (Tata Ace EV)
            </h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              Zero exhaust fumes and zero engine noise inside your residential community. Clean vehicles for cleaner neighborhoods.
            </p>
          </div>

          {/* Card 2: Verified Specialists */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
                marginBottom: "16px",
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
              Uniformed & Background-Verified
            </h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              Every partner is Aadhaar & Police-verified, wears an official uniform, and enters your doorstep only with your 6-digit OTP.
            </p>
          </div>

          {/* Card 3: Zero-Landfill Guarantee */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
                marginBottom: "16px",
              }}
            >
              <Recycle size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
              Zero-Landfill Circular Guarantee
            </h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              100% of your plastics, cardboards, and metals are channeled to certified recyclers. Full transparency with digital receipts.
            </p>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION BANNER (LIGHT, LUMINOUS, HIGH-CONTRAST) */}
      <section>
        <div
          style={{
            padding: "48px 36px",
            background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #eff6ff 100%)",
            border: "1.5px solid #a7f3d0",
            borderRadius: "24px",
            boxShadow: "0 16px 40px -8px rgba(5, 150, 105, 0.12)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "#ffffff",
              boxShadow: "0 4px 14px rgba(5, 150, 105, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Leaf size={26} color="#059669" />
          </div>

          <div
            style={{
              padding: "4px 14px",
              borderRadius: "9999px",
              background: "#ffffff",
              border: "1px solid #a7f3d0",
              color: "#059669",
              fontSize: "12px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Let's Clean Our Cities Together
          </div>

          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", maxWidth: "680px", lineHeight: 1.2, color: "#064e3b", fontWeight: 800, margin: 0 }}>
            Join Millions of Indian Households Making Our Metros Clean & Waste-Free
          </h2>

          <p
            style={{
              fontSize: "15px",
              color: "#334155",
              maxWidth: "540px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Book on-demand doorstep recycling with transparent flat fees. No hidden costs. 100%
            diversion to certified recycling hubs.
          </p>

          <Link
            to="/book"
            className="btn btn-primary btn-lg"
            style={{
              marginTop: "8px",
              padding: "16px 32px",
              fontSize: "15px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              boxShadow: "0 4px 16px rgba(5, 150, 105, 0.35)",
            }}
          >
            Schedule Doorstep Collection Now <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
};
