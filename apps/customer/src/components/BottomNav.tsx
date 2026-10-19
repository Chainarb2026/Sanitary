import React from "react";
import { NavLink } from "react-router-dom";
import { Home, PlusCircle, Clock, UserCheck, Truck } from "lucide-react";

export const BottomNav: React.FC = () => {
  return (
    <nav className="bottom-nav" aria-label="Main Navigation">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} end>
        <Home size={20} />
        <span>Home</span>
      </NavLink>

      <NavLink
        to="/book"
        className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        style={{
          transform: "translateY(-8px)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
            borderRadius: "50%",
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
            color: "#ffffff",
          }}
        >
          <PlusCircle size={24} />
        </div>
        <span style={{ fontWeight: 700, color: "var(--color-teal)" }}>Pickup</span>
      </NavLink>

      <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
        <Clock size={20} />
        <span>Activity</span>
      </NavLink>

      <NavLink to="/partner" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
        <Truck size={20} />
        <span>Partner</span>
      </NavLink>

      <NavLink to="/auth" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
        <UserCheck size={20} />
        <span>Account</span>
      </NavLink>
    </nav>
  );
};
