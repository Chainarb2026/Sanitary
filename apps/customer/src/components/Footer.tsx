import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { SanitaryLogo, SanitaryMark } from "./SanitaryLogo.js";

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        {/* Brand & Manifesto Column */}
        <div className="footer-col">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
            >
              <SanitaryMark size={22} color="#ffffff" />
            </div>
            <div>
              <SanitaryLogo variant="full" size={20} color="#ffffff" />
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#38bdf8",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: "2px",
                }}
              >
                Doorstep Clean Network
              </div>
            </div>
          </div>

          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              maxWidth: "340px",
              marginBottom: "18px",
            }}
          >
            India’s trusted doorstep waste recycling infrastructure. Under the banner of{" "}
            <strong style={{ color: "var(--color-teal)" }}>Let’s Clean Our Cities</strong>, we power
            clean streets across 7 major metros with electric Tata Ace EV fleets, sub-15 minute
            dispatch, transparent flat fees, and verified zero-loss double-entry settlements.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border-subtle)",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              <ShieldCheck size={14} color="var(--color-teal)" />
              <span>CPCB & SPCB Certified Hubs</span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border-subtle)",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              <CheckCircle2 size={14} color="#38bdf8" />
              <span>100% Circular Diversion</span>
            </div>
          </div>
        </div>

        {/* Platform Services */}
        <div className="footer-col">
          <h5>Platform</h5>
          <ul>
            <li>
              <Link to="/book">Instant Doorstep Pickup</Link>
            </li>
            <li>
              <Link to="/book">Gemini AI Waste Scan</Link>
            </li>
            <li>
              <Link to="/book">Transparent Fare Matrix</Link>
            </li>
            <li>
              <Link to="/history">Activity & Ledger Records</Link>
            </li>
            <li>
              <a href="#accepted-waste">7 Waste Categories</a>
            </li>
          </ul>
        </div>

        {/* Pan-India Coverage Zones */}
        <div className="footer-col">
          <h5>Pan-India Metros</h5>
          <ul>
            <li>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Bengaluru • 180+ Partners
              </span>
            </li>
            <li>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Mumbai (MMR) • 210+ Partners
              </span>
            </li>
            <li>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Delhi-NCR • 195+ Partners
              </span>
            </li>
            <li>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Hyderabad • 140+ Partners
              </span>
            </li>
            <li>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Chennai • 125+ Partners
              </span>
            </li>
            <li>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Pune & Kolkata Hubs
              </span>
            </li>
          </ul>
        </div>

        {/* Trust & Verification */}
        <div className="footer-col">
          <h5>Security & Settlement</h5>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: "14px",
            }}
          >
            All financial transactions are calculated strictly in integer paise with append-only
            double-entry ledger accounts. Supported via instant dynamic UPI QR and cash on
            collection.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <SanitaryMark size={18} color="#38bdf8" />
            <div style={{ fontSize: "11px", color: "#f8fafc", fontWeight: 600 }}>
              Zero-Loss Certified Architecture
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div>
          © {new Date().getFullYear()} ChainArb Pvt Ltd. All rights
          reserved.
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          <a href="#" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Privacy Policy
          </a>
          <a href="#" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Terms of Service
          </a>
          <a href="#" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Environmental Compliance
          </a>
        </div>
      </div>
    </footer>
  );
};
