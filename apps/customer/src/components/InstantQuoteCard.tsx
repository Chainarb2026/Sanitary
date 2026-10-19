import React from "react";
import { Receipt, ShieldCheck, HeartHandshake } from "lucide-react";
import type { PricingBreakdown } from "../api/wasteTypes.js";

interface InstantQuoteCardProps {
  quote: PricingBreakdown | null;
  isLoading?: boolean;
}

export const InstantQuoteCard: React.FC<InstantQuoteCardProps> = ({ quote, isLoading }) => {
  if (isLoading) {
    return (
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="skeleton" style={{ width: "120px", height: "20px" }} />
          <div className="skeleton" style={{ width: "80px", height: "24px" }} />
        </div>
        <div className="skeleton" style={{ width: "100%", height: "16px" }} />
        <div className="skeleton" style={{ width: "100%", height: "16px" }} />
        <div className="skeleton" style={{ width: "100%", height: "30px", marginTop: "8px" }} />
      </div>
    );
  }

  if (!quote) return null;

  const baseRs = (quote.base / 100).toFixed(0);
  const perKgRs = (quote.perKg / 100).toFixed(0);
  const convenienceRs = (quote.convenienceFee / 100).toFixed(0);
  const totalRs = (quote.total / 100).toFixed(0);
  const partnerRs = (quote.partnerEarning / 100).toFixed(0);

  return (
    <div
      className="glass-card"
      style={{
        border: "1px solid rgba(5, 150, 105, 0.22)",
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(240, 253, 250, 0.93) 100%), url('/circular-card-tech.jpg') right center/cover no-repeat",
        boxShadow: "0 12px 32px -4px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(5, 150, 105, 0.05)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        borderRadius: "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
              border: "1px solid #a7f3d0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#059669",
            }}
          >
            <Receipt size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0f172a" }}>Fare Estimate</h3>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Calculated instantly via bag tier</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
          <span style={{ fontSize: "16px", color: "#059669", fontWeight: 700 }}>₹</span>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 900,
              fontFamily: "var(--font-display)",
              color: "#0f172a",
              lineHeight: 1,
            }}
          >
            {totalRs}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#475569",
          }}
        >
          <span>Base Pickup Charge</span>
          <span style={{ color: "#0f172a", fontWeight: 700 }}>₹{baseRs}</span>
        </div>

        {quote.perKg > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#475569",
            }}
          >
            <span>Bag & Size Tier Charge</span>
            <span style={{ color: "#0f172a", fontWeight: 700 }}>₹{perKgRs}</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#475569",
          }}
        >
          <span>Doorstep & Safety Fee</span>
          <span style={{ color: "#0f172a", fontWeight: 700 }}>₹{convenienceRs}</span>
        </div>

        {quote.surgeMultiplier > 1.0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#d97706",
            }}
          >
            <span>High-Demand Surge ({quote.surgeMultiplier}x)</span>
            <span style={{ fontWeight: 800 }}>Active</span>
          </div>
        )}
      </div>

      {/* Partner Transparency Note */}
      <div
        style={{
          background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
          border: "1px solid #a7f3d0",
          borderRadius: "12px",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#065f46",
        }}
      >
        <HeartHandshake size={16} color="#059669" style={{ flexShrink: 0 }} />
        <span>
          <strong style={{ color: "#047857" }}>₹{partnerRs}</strong> goes directly to your verified neighborhood pickup partner.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          color: "#64748b",
        }}
      >
        <ShieldCheck size={14} color="#059669" />
        <span>Price guarantee: Transparent flat rates per bag and item size with zero hidden fees.</span>
      </div>
    </div>
  );
};
