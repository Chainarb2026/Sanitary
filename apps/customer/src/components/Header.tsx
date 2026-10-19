import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  WifiOff,
  LogOut,
  User,
  ArrowRight,
  MapPin,
  ChevronDown,
  Sparkles,
  Sun,
  Moon,
  Truck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";
import { useTheme } from "../hooks/useTheme.js";
import { SanitaryLogo, SanitaryMark } from "./SanitaryLogo.js";

export const INDIAN_CITIES = [
  { id: "blr", name: "Bengaluru", state: "Karnataka", partners: 184, isLive: true },
  { id: "mum", name: "Mumbai (MMR)", state: "Maharashtra", partners: 212, isLive: true },
  { id: "del", name: "Delhi-NCR", state: "National Capital", partners: 198, isLive: true },
  { id: "hyd", name: "Hyderabad", state: "Telangana", partners: 145, isLive: true },
  { id: "chn", name: "Chennai", state: "Tamil Nadu", partners: 128, isLive: true },
  { id: "pun", name: "Pune", state: "Maharashtra", partners: 96, isLive: true },
  { id: "kol", name: "Kolkata", state: "West Bengal", partners: 84, isLive: true },
];

export type IndianCity = (typeof INDIAN_CITIES)[number];
const DEFAULT_CITY: IndianCity = INDIAN_CITIES[0] as IndianCity;

export const Header: React.FC = () => {
  const { user, isAuthenticated, logoutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedCity, setSelectedCity] = useState<IndianCity>(DEFAULT_CITY);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);

  return (
    <>
      {!isOnline && (
        <div className="offline-banner" role="alert">
          <WifiOff size={14} />
          <span>You are offline. Showing cached offline data & catalog.</span>
        </div>
      )}

      {/* Top Banner Tag: "Let's Clean Our Cities" */}
      <div
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "7px 16px",
          textAlign: "center",
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          letterSpacing: "0.03em",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "rgba(5, 150, 105, 0.1)",
            border: "1px solid rgba(5, 150, 105, 0.25)",
            padding: "2px 8px",
            borderRadius: "9999px",
            color: "var(--color-brand)",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <Sparkles size={11} /> National Initiative
        </span>
        <span>
          <strong>Let's Clean Our Cities</strong> — Doorstep Smart Recycling Network Across India
        </span>
        <span
          style={{ color: "var(--text-muted)", display: "none" }}
          className="banner-metro-count"
        >
          • Serving 7+ Major Metros
        </span>
      </div>

      <header className="site-header">
        <div className="site-header-inner">
          {/* Logo with Geometric Stencil Symbol & Metro Context */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
            <Link
              to="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textDecoration: "none",
              }}
            >


              <div>
                <SanitaryLogo variant="full" size={22} color="var(--text-primary)" />
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "var(--color-brand)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginTop: "1px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Doorstep Recycling
                </div>
              </div>
            </Link>

            {/* Visual Divider */}
            <div
              style={{
                height: "22px",
                width: "1px",
                background: "var(--border-medium)",
                margin: "0 2px",
              }}
            />

            {/* City Selector Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 14px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-medium)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                <MapPin size={13} color="var(--color-brand)" />
                <span>{selectedCity.name}</span>
                <span className="pulse-indicator" style={{ width: "6px", height: "6px" }} />
                <ChevronDown
                  size={13}
                  color="var(--text-muted)"
                  style={{
                    transform: cityDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {cityDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    width: "240px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-md)",
                    padding: "6px",
                    boxShadow: "var(--shadow-luxury)",
                    zIndex: 150,
                  }}
                >
                  <div
                    style={{
                      padding: "6px 10px",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Select Active Metro Hub
                  </div>
                  {INDIAN_CITIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCity(c);
                        setCityDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        background:
                          selectedCity.id === c.id ? "rgba(5, 150, 105, 0.1)" : "transparent",
                        border: "none",
                        color:
                          selectedCity.id === c.id ? "var(--color-brand)" : "var(--text-primary)",
                        fontSize: "13px",
                        fontWeight: selectedCity.id === c.id ? 700 : 500,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <div>
                        <div>{c.name}</div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                          {c.state}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--color-brand)",
                        }}
                      >
                        {c.partners} Live
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation Links (Segmented Pill Capsule) */}
          <nav className="nav-links-desktop" aria-label="Main Navigation">
            <Link
              to="/"
              className={`nav-link ${location.pathname === "/" && !location.hash ? "active" : ""}`}
            >
              Overview
            </Link>

            <a
              href="#flat-pricing"
              onClick={(e) => {
                if (location.pathname === "/") {
                  e.preventDefault();
                  document.getElementById("flat-pricing")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  navigate("/#flat-pricing");
                }
              }}
              className={`nav-link ${location.hash === "#flat-pricing" ? "active" : ""}`}
            >
              Flat Pricing
            </a>

            <a
              href="#cities-coverage"
              onClick={(e) => {
                if (location.pathname === "/") {
                  e.preventDefault();
                  document.getElementById("cities-coverage")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  navigate("/#cities-coverage");
                }
              }}
              className={`nav-link ${location.hash === "#cities-coverage" ? "active" : ""}`}
            >
              Coverage
            </a>

            <Link
              to="/history"
              className={`nav-link ${location.pathname === "/history" ? "active" : ""}`}
            >
              Activity
            </Link>

            <Link
              to="/partner"
              className={`nav-link ${location.pathname === "/partner" ? "active" : ""}`}
              style={{
                color: location.pathname === "/partner" ? "var(--color-brand)" : "#059669",
              }}
            >
              <Truck size={14} color="#059669" />
              <span>Partner Portal</span>
            </Link>
          </nav>

          {/* Right Header Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {/* Primary Action Button: Schedule Pickup */}
            <Link
              to="/book"
              className="btn btn-primary"
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 700,
                borderRadius: "var(--radius-full)",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 10px rgba(5, 150, 105, 0.25)",
              }}
            >
              Schedule Pickup <ArrowRight size={14} />
            </Link>

            {/* Theme Toggle Button (Light/Dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              aria-label="Toggle theme mode"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {isAuthenticated && user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-medium)",
                    padding: "6px 12px",
                    borderRadius: "var(--radius-full)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <User size={13} color="var(--color-brand)" />
                  <span>{user.phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void logoutUser()}
                  title="Logout"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "var(--radius-full)",
                    transition: "all 0.2s ease",
                  }}
                  aria-label="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  borderRadius: "var(--radius-full)",
                  whiteSpace: "nowrap",
                }}
                onClick={() => navigate("/auth")}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
