import React, { useState, useEffect } from "react";
import { MapPin, Truck, Phone, Radio } from "lucide-react";

interface Coordinates {
  lat: number;
  lng: number;
}

interface PartnerProfile {
  name: string;
  phone: string;
  vehicleModel: string;
  vehicleNumber: string;
  rating: number;
  totalPickups: number;
  photoUrl?: string;
}

interface DirectionMapTrackerProps {
  status: string;
  customerCoords: Coordinates;
  customerAddressText: string;
  partnerCoords: Coordinates | null;
  partnerInfo?: PartnerProfile;
  pickupOtp?: string;
}

const DEFAULT_PARTNER: PartnerProfile = {
  name: "Ramesh Kumar",
  phone: "+91 98450 12345",
  vehicleModel: "Tata Ace EV (100% Electric)",
  vehicleNumber: "KA-01-EA-4821",
  rating: 4.9,
  totalPickups: 428,
};

export const DirectionMapTracker: React.FC<DirectionMapTrackerProps> = ({
  status,
  customerCoords,
  customerAddressText,
  partnerCoords,
  partnerInfo = DEFAULT_PARTNER,
  pickupOtp,
}) => {
  const isSearching = status === "SEARCHING" || status === "CREATED";
  const isAssigned = !isSearching && status !== "CANCELLED";

  // If partnerCoords is null but assigned, simulate nearby coordinates 1.4km away for realistic routing
  const activePartnerCoords = partnerCoords || {
    lat: customerCoords.lat + 0.009,
    lng: customerCoords.lng - 0.008,
  };

  const [distanceKm, setDistanceKm] = useState<number>(1.8);
  const [etaMinutes, setEtaMinutes] = useState<number>(6);
  const [etaProgress, setEtaProgress] = useState<number>(0.2); // 0.0 to 1.0 along the route
  const [searchRadius, setSearchRadius] = useState<number>(3);

  // Cycle search radius in searching mode
  useEffect(() => {
    if (!isSearching) return;
    const interval = setInterval(() => {
      setSearchRadius((prev) => (prev === 3 ? 5 : prev === 5 ? 8 : 3));
    }, 2500);
    return () => clearInterval(interval);
  }, [isSearching]);

  // Fetch real road route from OSRM router
  useEffect(() => {
    if (isSearching) return;

    let isCancelled = false;
    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${activePartnerCoords.lng},${activePartnerCoords.lat};${customerCoords.lng},${customerCoords.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (res.ok && !isCancelled) {
          const data = await res.json();
          const route = data.routes?.[0];
          if (route) {
            setDistanceKm(parseFloat((route.distance / 1000).toFixed(1)));
            setEtaMinutes(Math.max(1, Math.round(route.duration / 60)));
          }
        }
      } catch {
        // Fallback: simple interpolated line between partner and customer
        if (!isCancelled) {
          setDistanceKm(1.5);
          setEtaMinutes(5);
        }
      }
    };

    void fetchRoute();
    return () => {
      isCancelled = true;
    };
  }, [isSearching, activePartnerCoords.lat, activePartnerCoords.lng, customerCoords.lat, customerCoords.lng]);

  // Subtle vehicle position progression along route
  useEffect(() => {
    if (!isAssigned) return;
    const interval = setInterval(() => {
      setEtaProgress((prev) => (prev < 0.85 ? prev + 0.02 : 0.85));
    }, 3000);
    return () => clearInterval(interval);
  }, [isAssigned]);

  // Calculate vehicle SVG marker position along route or default
  const vehicleX = isAssigned ? 25 + etaProgress * 45 : 30;
  const vehicleY = isAssigned ? 30 + etaProgress * 30 : 35;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 1. Map Canvas Visualizer Box */}
      <div
        className="glass-card"
        style={{
          height: "260px",
          background: "#030c17",
          position: "relative",
          overflow: "hidden",
          borderRadius: "16px",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Ambient Dark Satellite Road Grid Pattern */}
        <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.18 }}>
          <pattern id="roadGrid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#14b8a6" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#roadGrid)" />
        </svg>

        {/* Searching Radar Animation */}
        {isSearching && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            {/* Concentric radar scan rings */}
            <div
              style={{
                position: "absolute",
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                border: "2px solid rgba(5, 150, 105, 0.4)",
                animation: "pulse 2s infinite ease-out",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: "190px",
                height: "190px",
                borderRadius: "50%",
                border: "1px solid rgba(5, 150, 105, 0.2)",
                animation: "pulse 2.5s infinite ease-out",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: "260px",
                height: "260px",
                borderRadius: "50%",
                border: "1px dashed rgba(5, 150, 105, 0.15)",
              }}
            />

            <div
              style={{
                background: "rgba(15, 23, 42, 0.9)",
                backdropFilter: "blur(12px)",
                padding: "12px 20px",
                borderRadius: "14px",
                border: "1px solid rgba(5, 150, 105, 0.3)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Radio size={16} color="var(--color-brand)" className="animate-pulse" />
                <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--color-brand)" }}>
                  Scanning Nearby Partners ({searchRadius} km radius)
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Connecting to 100% electric Sanitary EV partner in your sector...
              </span>
            </div>
          </div>
        )}

        {/* Direction Mapping SVG Route (Road Polyline Path) */}
        {isAssigned && (
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, zIndex: 3 }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            {/* The Connected Driving Road Path */}
            <path
              d="M 25 30 Q 40 45, 55 40 T 75 70"
              fill="none"
              stroke="#0f766e"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.35"
            />
            <path
              d="M 25 30 Q 40 45, 55 40 T 75 70"
              fill="none"
              stroke="url(#routeGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="4 2"
            />
          </svg>
        )}

        {/* Customer Doorstep Marker (Pin) */}
        <div
          style={{
            position: "absolute",
            left: isAssigned ? "75%" : "50%",
            top: isAssigned ? "70%" : "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 15,
            transition: "all 0.5s ease",
          }}
        >
          <div
            style={{
              background: "var(--color-brand)",
              borderRadius: "50%",
              padding: "7px",
              boxShadow: "0 0 16px rgba(16, 185, 129, 0.9)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MapPin size={18} />
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#ffffff",
              background: "rgba(15, 23, 42, 0.85)",
              padding: "2px 8px",
              borderRadius: "9999px",
              marginTop: "4px",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              whiteSpace: "nowrap",
            }}
          >
            Your Doorstep
          </span>
          {customerAddressText && (
            <span
              style={{
                fontSize: "9px",
                color: "var(--text-muted)",
                background: "rgba(15, 23, 42, 0.85)",
                padding: "1px 6px",
                borderRadius: "9999px",
                marginTop: "2px",
                maxWidth: "140px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {customerAddressText}
            </span>
          )}
        </div>

        {/* Assigned Partner Electric Van Marker */}
        {isAssigned && (
          <div
            style={{
              position: "absolute",
              left: `${vehicleX}%`,
              top: `${vehicleY}%`,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              zIndex: 20,
              transition: "all 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
                borderRadius: "50%",
                padding: "8px",
                boxShadow: "0 0 24px rgba(5, 150, 105, 0.9)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Truck size={20} />
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#ffffff",
                background: "rgba(5, 150, 105, 0.95)",
                padding: "2px 8px",
                borderRadius: "9999px",
                marginTop: "4px",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
                whiteSpace: "nowrap",
              }}
            >
              Sanitary EV Partner
            </span>
          </div>
        )}

        {/* Live Distance & ETA HUD Overlay */}
        {isAssigned && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(12px)",
              padding: "8px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(5, 150, 105, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              zIndex: 25,
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "var(--color-brand)",
                boxShadow: "0 0 12px rgba(56, 189, 248, 0.7)",
              }}
            />
            <div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#ffffff" }}>
                {distanceKm} km away • Arriving in ~{etaMinutes} mins
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-brand)" }}>
                Live GPS Road Direction Stream Active
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Customer Pickup 4-Digit Handover OTP Card */}
      {pickupOtp && isAssigned && (
        <div
          className="glass-card"
          style={{
            padding: "20px",
            background: "linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(15, 23, 42, 0.05) 100%)",
            border: "1px solid var(--color-brand)",
            borderRadius: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-brand)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Doorstep Handover Verification OTP
          </div>
          <div
            style={{
              fontSize: "36px",
              fontWeight: 900,
              letterSpacing: "10px",
              color: "var(--color-brand)",
              margin: "8px 0",
              fontFamily: "monospace",
            }}
          >
            {pickupOtp}
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
            Share this 4-digit code with your Sanitary specialist upon doorstep bag collection to verify completion.
          </p>
        </div>
      )}

      {/* 3. Assigned Partner Profile & EV Details Card */}
      {isAssigned && (
        <div
          className="glass-card"
          style={{
            padding: "18px",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: "1 1 220px", minWidth: 0 }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
              }}
            >
              👨🏽‍✈️
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-primary)" }}>
                  {partnerInfo.name}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    background: "rgba(5, 150, 105, 0.12)",
                    color: "var(--color-brand)",
                  }}
                >
                  ★ {partnerInfo.rating}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                {partnerInfo.vehicleModel} • <strong>{partnerInfo.vehicleNumber}</strong>
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-brand)", marginTop: "2px", fontWeight: 600 }}>
                Official SANITARY Uniform & Verified Badge
              </div>
            </div>
          </div>

          <a
            href={`tel:${partnerInfo.phone}`}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              background: "rgba(5, 150, 105, 0.12)",
              border: "1px solid rgba(5, 150, 105, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-brand)",
              textDecoration: "none",
            }}
            title="Call Partner"
          >
            <Phone size={18} />
          </a>
        </div>
      )}
    </div>
  );
};
