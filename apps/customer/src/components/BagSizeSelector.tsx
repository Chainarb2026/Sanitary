import React, { useState } from "react";
import { Plus, Minus, Camera, ShieldCheck } from "lucide-react";
import { type WasteType } from "../api/wasteTypes.js";

export interface BagSizeItem {
  slug: string;
  name: string;
  subtitle: string;
  flatPrice: number; // in Rupees
  icon: string;
  tag?: string;
  popular?: boolean;
}

export const BAG_SIZE_CATALOG: BagSizeItem[] = [
  {
    slug: "small-bag",
    name: "Small Household Bag",
    subtitle: "Standard kitchen bin liner, room dustbin bag, or small grocery bag",
    flatPrice: 49,
    icon: "🎒",
    popular: true,
    tag: "Most Popular",
  },
  {
    slug: "medium",
    name: "Medium Sack / Box",
    subtitle: "General household declutter, delivery cartons, packaging, or 50L sack",
    flatPrice: 99,
    icon: "📦",
    popular: true,
    tag: "Great Value",
  },
  {
    slug: "large-sack",
    name: "Large Heavy Sack",
    subtitle: "Multi-room deep cleanout, heavy-duty black gunny bag, or large bin",
    flatPrice: 179,
    icon: "🛍️",
  },
  {
    slug: "bulk-furniture",
    name: "Bulky Item / Furniture",
    subtitle: "Single chair, small table, mattress, appliance, or wooden piece",
    flatPrice: 299,
    icon: "🛋️",
  },
  {
    slug: "e-waste",
    name: "E-Waste & Electronics Box",
    subtitle: "Old laptop, cables, microwave, monitor, chargers, or kitchen gadget",
    flatPrice: 149,
    icon: "💻",
  },
  {
    slug: "garden-waste",
    name: "Garden Green Sack",
    subtitle: "Dry leaves, pruned branches, organic yard trimmings, lawn clippings",
    flatPrice: 79,
    icon: "🌿",
  },
  {
    slug: "debris",
    name: "Renovation & Debris Sack",
    subtitle: "Tiles, plaster, renovation rubble, cement bag scrap",
    flatPrice: 199,
    icon: "🧱",
  },
];

interface BagSizeSelectorProps {
  wasteTypes: WasteType[];
  selectedItems: Array<{ wasteTypeId: string; quantity: number; estimatedWeightKg: number }>;
  onItemsChange: (
    items: Array<{ wasteTypeId: string; quantity: number; estimatedWeightKg: number }>,
  ) => void;
}

export const BagSizeSelector: React.FC<BagSizeSelectorProps> = ({
  wasteTypes,
  selectedItems,
  onItemsChange,
}) => {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Helper to get quantity for a slug
  const getQuantityForSlug = (slug: string): number => {
    // Find matching waste type from API catalog
    const matchedType = wasteTypes.find(
      (w) =>
        w.slug === slug ||
        (slug === "small-bag" && w.slug.includes("bag")) ||
        (slug === "medium" && w.slug.includes("medium")) ||
        (slug === "large-sack" && w.slug.includes("debris")) ||
        (slug === "bulk-furniture" && w.slug.includes("bulk")),
    );
    if (!matchedType) return 0;
    const item = selectedItems.find((it) => it.wasteTypeId === matchedType._id);
    return item ? item.quantity : 0;
  };

  const handleUpdateQuantity = (bag: BagSizeItem, delta: number) => {
    // Find or fallback to matching wasteType in API
    let matchedType = wasteTypes.find(
      (w) =>
        w.slug === bag.slug ||
        (bag.slug === "small-bag" && w.slug.includes("bag")) ||
        (bag.slug === "medium" && (w.slug.includes("medium") || w.slug.includes("segregated"))) ||
        (bag.slug === "large-sack" && (w.slug.includes("medium") || w.slug.includes("debris"))) ||
        (bag.slug === "bulk-furniture" && w.slug.includes("bulk")) ||
        (bag.slug === "e-waste" && w.slug.includes("e-waste")) ||
        (bag.slug === "garden-waste" && w.slug.includes("garden")) ||
        (bag.slug === "debris" && w.slug.includes("debris")),
    );

    if (!matchedType) {
      matchedType = wasteTypes[0];
    }
    if (!matchedType) return;

    const existingIndex = selectedItems.findIndex((it) => it.wasteTypeId === matchedType!._id);
    const currentQty = existingIndex >= 0 ? selectedItems[existingIndex]!.quantity : 0;
    const newQty = Math.max(0, currentQty + delta);

    let updated = [...selectedItems];
    if (newQty === 0) {
      if (existingIndex >= 0) {
        updated = updated.filter((_, idx) => idx !== existingIndex);
      }
    } else if (existingIndex >= 0) {
      updated[existingIndex] = {
        wasteTypeId: matchedType._id,
        quantity: newQty,
        estimatedWeightKg: 1, // Normalized flat unit
      };
    } else {
      updated.push({
        wasteTypeId: matchedType._id,
        quantity: newQty,
        estimatedWeightKg: 1, // Normalized flat unit
      });
    }

    onItemsChange(updated);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Quick preset bundles
  const handleApplyPreset = (slug: string, qty: number) => {
    const bag = BAG_SIZE_CATALOG.find((b) => b.slug === slug);
    if (bag) {
      handleUpdateQuantity(bag, qty - getQuantityForSlug(slug));
    }
  };

  const totalItemsCount = selectedItems.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: "22px",
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(240, 253, 250, 0.92) 100%), url('/doorstep-pickup-partner.jpg') right center/cover no-repeat",
          border: "1px solid rgba(5, 150, 105, 0.22)",
          borderRadius: "18px",
          boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "20px",
              boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
            }}
          >
            🎒
          </div>
          <div>
            <h2 style={{ fontSize: "19px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
              Select Bag & Waste Sizes
            </h2>
            <div style={{ fontSize: "12px", color: "#047857", fontWeight: 800, marginTop: "2px" }}>
              100% Flat Pricing • Zero Weighing Scales • Zero Hidden Fees
            </div>
          </div>
        </div>
        <p style={{ fontSize: "13px", color: "#475569", margin: 0, lineHeight: 1.5, maxWidth: "560px" }}>
          Simply select how many bags or items you have ready for collection. Verified Sanitary partners arrive at your doorstep in under 15 minutes.
        </p>

        {/* Quick Presets */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "9999px",
              background: "#ffffff",
              borderColor: "#cbd5e1",
              color: "#0f172a",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
            onClick={() => handleApplyPreset("small-bag", 1)}
          >
            🎒 1 Small Bag (₹49)
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "9999px",
              background: "#ffffff",
              borderColor: "#cbd5e1",
              color: "#0f172a",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
            onClick={() => handleApplyPreset("small-bag", 2)}
          >
            🎒 2 Small Bags (₹98)
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "9999px",
              background: "#ffffff",
              borderColor: "#cbd5e1",
              color: "#0f172a",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
            onClick={() => handleApplyPreset("medium", 1)}
          >
            📦 1 Medium Sack (₹99)
          </button>
        </div>
      </div>

      {/* Bag Size Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {BAG_SIZE_CATALOG.map((bag) => {
          const qty = getQuantityForSlug(bag.slug);
          const isSelected = qty > 0;

          return (
            <div
              key={bag.slug}
              className={`glass-card ${isSelected ? "selected-card" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 18px",
                borderRadius: "16px",
                border: isSelected
                  ? "2px solid #059669"
                  : "1px solid #e2e8f0",
                background: isSelected
                  ? "linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)"
                  : "#ffffff",
                boxShadow: isSelected
                  ? "0 4px 16px rgba(5, 150, 105, 0.12)"
                  : "0 2px 8px rgba(15, 23, 42, 0.03)",
                transition: "all 0.2s ease",
              }}
            >
              {/* Left: Icon & Description */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1, minWidth: 0, paddingRight: "12px" }}>
                <div
                  style={{
                    fontSize: "26px",
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: isSelected ? "rgba(5, 150, 105, 0.12)" : "#f8fafc",
                    border: isSelected ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {bag.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                      {bag.name}
                    </span>
                    {bag.tag && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          background: "#ecfdf5",
                          color: "#059669",
                          border: "1px solid #a7f3d0",
                        }}
                      >
                        {bag.tag}
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      margin: "3px 0 6px 0",
                      lineHeight: 1.4,
                    }}
                  >
                    {bag.subtitle}
                  </p>

                  <div style={{ fontSize: "15px", fontWeight: 900, color: "#059669", fontFamily: "var(--font-display)" }}>
                    ₹{bag.flatPrice}{" "}
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                      flat rate
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Quantity Incrementor Button */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: isSelected ? "rgba(5, 150, 105, 0.08)" : "#f8fafc",
                  padding: "6px 8px",
                  borderRadius: "12px",
                  border: isSelected ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleUpdateQuantity(bag, -1)}
                  disabled={qty === 0}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    border: "none",
                    background: qty > 0 ? "#059669" : "#e2e8f0",
                    color: qty > 0 ? "#ffffff" : "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: qty > 0 ? "pointer" : "default",
                    transition: "all 0.15s ease",
                  }}
                  title="Remove 1"
                >
                  <Minus size={16} />
                </button>

                <span
                  style={{
                    fontWeight: 900,
                    fontSize: "16px",
                    minWidth: "24px",
                    textAlign: "center",
                    color: isSelected ? "#059669" : "#0f172a",
                  }}
                >
                  {qty}
                </span>

                <button
                  type="button"
                  onClick={() => handleUpdateQuantity(bag, 1)}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                  title="Add 1"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Photo Attachment for Driver Guide */}
      <div
        className="glass-card"
        style={{
          padding: "16px 18px",
          borderRadius: "16px",
          border: "1.5px dashed #cbd5e1",
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.94) 100%)",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
              }}
            >
              <Camera size={18} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                Doorstep Photo Reference (Optional)
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Snap a quick photo of your bags so your partner spots them easily
              </div>
            </div>
          </div>

          <label
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <span>{photoPreview ? "Change Photo" : "Upload"}</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
          </label>
        </div>

        {photoPreview && (
          <div style={{ marginTop: "12px", position: "relative", display: "inline-block" }}>
            <img
              src={photoPreview}
              alt="Uploaded bags reference"
              style={{
                width: "120px",
                height: "90px",
                objectFit: "cover",
                borderRadius: "10px",
                border: "2px solid #059669",
              }}
            />
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: "#e11d48",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      {totalItemsCount > 0 && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
            border: "1px solid #a7f3d0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "13px",
            boxShadow: "0 2px 8px rgba(5, 150, 105, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldCheck size={20} color="#059669" />
            <span style={{ color: "#065f46" }}>
              <strong style={{ color: "#064e3b" }}>{totalItemsCount}</strong> {totalItemsCount === 1 ? "bag/item" : "bags/items"} selected for doorstep pickup
            </span>
          </div>
          <span style={{ fontWeight: 800, color: "#047857" }}>
            Flat Rate Guaranteed
          </span>
        </div>
      )}
    </div>
  );
};
