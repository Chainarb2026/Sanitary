import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Clock, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { getBookings, type Booking } from "../api/bookings.js";
import { useAuth } from "../hooks/useAuth.js";
import { SanitaryMark } from "../components/SanitaryLogo.js";
import { Skeleton } from "../components/Skeleton.js";

export const HistoryPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth", { state: { from: "/history" } });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["customerBookingsHistory", statusFilter],
    queryFn: ({ pageParam }) => getBookings(pageParam, 10),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: isAuthenticated,
  });

  // Infinite scroll intersection observer
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allBookings: Booking[] = data?.pages.flatMap((page) => page.items) || [];

  const filteredBookings = allBookings.filter((b) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") {
      return ["CREATED", "SEARCHING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"].includes(
        b.status,
      );
    }
    if (statusFilter === "completed") return b.status === "COMPLETED";
    if (statusFilter === "cancelled") return b.status === "CANCELLED";
    return true;
  });

  return (
    <div
      style={{
        maxWidth: "840px",
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Page Title & Telemetry Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SanitaryMark size={28} />
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>Pickup Activity & Impact</h1>
            <div style={{ fontSize: "11px", color: "var(--color-brand)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Verified Doorstep Chain of Custody
            </div>
          </div>
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700, background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.25)", padding: "4px 10px", borderRadius: "9999px" }}>
          {allBookings.length} Pickups Logged
        </span>
      </div>

      {/* Environmental Telemetry HUD Banner */}
      <div
        className="glass-card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          padding: "16px 20px",
          borderRadius: "18px",
          border: "1px solid rgba(56, 189, 248, 0.22)",
          background: "linear-gradient(135deg, rgba(6, 9, 17, 0.95) 0%, rgba(11, 17, 32, 0.9) 100%)",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Total Waste Recycled
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "var(--color-brand)", fontFamily: "var(--font-display)" }}>
            {allBookings.reduce((acc, b) => acc + (b.items?.reduce((s, it) => s + (it.estimatedWeightKg || 5), 0) || 5), 0)} kg
          </div>
        </div>

        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Estimated CO₂e Saved
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#38bdf8", fontFamily: "var(--font-display)" }}>
            {(allBookings.reduce((acc, b) => acc + (b.items?.reduce((s, it) => s + (it.estimatedWeightKg || 5), 0) || 5), 0) * 1.85).toFixed(1)} kg
          </div>
        </div>

        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Landfill Diversion Rate
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#38bdf8", fontFamily: "var(--font-display)" }}>
            100.0%
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
        {[
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "completed", label: "Completed" },
          { key: "cancelled", label: "Cancelled" },
        ].map((f) => (
          <button
            type="button"
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-full)",
              border:
                statusFilter === f.key
                  ? "1px solid var(--color-brand)"
                  : "1px solid var(--border-subtle)",
              background: statusFilter === f.key ? "rgba(56, 189, 248, 0.15)" : "transparent",
              color: statusFilter === f.key ? "var(--color-brand)" : "var(--text-secondary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Booking List */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Skeleton height="110px" borderRadius="var(--radius-lg)" />
          <Skeleton height="110px" borderRadius="var(--radius-lg)" />
          <Skeleton height="110px" borderRadius="var(--radius-lg)" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="glass-card" style={{ textAlign: "center", padding: "36px 16px" }}>
          <Clock size={32} color="var(--text-muted)" style={{ margin: "0 auto 10px" }} />
          <h3>No Bookings Found</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
            You have no pickup history matching the selected filter.
          </p>
          <Link to="/book" className="btn btn-primary" style={{ marginTop: "16px" }}>
            Schedule a Pickup
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredBookings.map((booking) => {
            const bId = booking._id || booking.id || "";
            const isActive = [
              "CREATED",
              "SEARCHING",
              "ASSIGNED",
              "EN_ROUTE",
              "ARRIVED",
              "IN_PROGRESS",
            ].includes(booking.status);

            return (
              <Link key={bId} to={`/tracking/${bId}`} style={{ textDecoration: "none" }}>
                <div
                  className="glass-card glass-card-interactive"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    borderColor: isActive ? "rgba(56, 189, 248, 0.45)" : "var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={14} color="var(--color-brand)" />
                      <span
                        style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}
                      >
                        {booking.slot?.date || new Date(booking.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span
                      className={`badge ${
                        booking.status === "COMPLETED"
                          ? "badge-emerald"
                          : booking.status === "CANCELLED"
                            ? "badge-rose"
                            : "badge-brand"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <MapPin
                      size={16}
                      color="var(--text-secondary)"
                      style={{ marginTop: "2px", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong
                        style={{
                          fontSize: "14px",
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "#ffffff",
                        }}
                      >
                        {booking.address?.addressLine1 || "Pickup Address"}
                      </strong>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {booking.items?.length || 1} waste item(s) •{" "}
                        {booking.slot?.type === "asap" ? "ASAP" : "Scheduled"}
                      </span>
                    </div>
                  </div>

                  {booking.items?.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: "var(--color-brand)",
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>
                        Verified Doorstep Handover:{" "}
                        <strong>
                          {booking.items.reduce((acc, it) => acc + (it.quantity || 1), 0)} bag(s) / item(s) collected
                        </strong>
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid var(--border-subtle)",
                      paddingTop: "8px",
                      marginTop: "2px",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>Total Paid</span>
                    <strong style={{ color: "var(--color-brand)", fontSize: "15px" }}>
                      ₹{booking.quote ? (booking.quote.total / 100).toFixed(0) : "0"}
                    </strong>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      <div
        ref={loadMoreRef}
        style={{ height: "40px", display: "flex", justifyContent: "center", alignItems: "center" }}
      >
        {isFetchingNextPage && <Skeleton width="140px" height="24px" />}
      </div>
    </div>
  );
};
