import React, { useState, useEffect, useRef } from "react";
import {
  Radio,
  Truck,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Sparkles,
} from "lucide-react";
import { matchDemoPartner, type MatchedPartnerProfile } from "../api/bookings.js";
import { useSocket } from "../hooks/useSocket.js";
import { useAuth } from "../hooks/useAuth.js";

interface FindingPartnerViewProps {
  bookingId: string;
  customerAddress: string;
  totalRs: string | number;
  onPartnerMatched?: (partner: MatchedPartnerProfile) => void;
  onProceedToPayment: () => void;
}

const DEFAULT_MATCHED_PARTNER: MatchedPartnerProfile = {
  id: "partner_ramesh_kumar_01",
  name: "Ramesh Kumar",
  phone: "+91 98450 12345",
  vehicleModel: "Tata Ace EV (100% Electric)",
  vehicleNumber: "KA-01-EA-4821",
  rating: 4.9,
  etaMinutes: 6,
  distanceKm: 1.4,
};

export const FindingPartnerView: React.FC<FindingPartnerViewProps> = ({
  bookingId,
  customerAddress,
  totalRs,
  onPartnerMatched,
  onProceedToPayment,
}) => {
  const { user } = useAuth();
  const { lastStatusChange } = useSocket(user?.id);

  const [searchRadius, setSearchRadius] = useState<number>(3);
  const [searchStage, setSearchStage] = useState<number>(0);
  const [partner, setPartner] = useState<MatchedPartnerProfile | null>(null);
  const [isMatched, setIsMatched] = useState<boolean>(false);
  const [autoAdvanceSecs, setAutoAdvanceSecs] = useState<number>(3);

  const STAGE_MESSAGES = [
    "Scanning nearby sector for online electric Tata Ace EV partners...",
    "Transmitting doorstep request to verified specialists within 3 km...",
    "Partner Ramesh Kumar received pickup offer. Securing match...",
  ];

  // 1. Stage progression animation
  useEffect(() => {
    if (isMatched) return;

    const stageTimer1 = setTimeout(() => {
      setSearchStage(1);
      setSearchRadius(5);
    }, 1200);

    const stageTimer2 = setTimeout(() => {
      setSearchStage(2);
    }, 2400);

    return () => {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
    };
  }, [isMatched]);

  // 2. Partner Matching: listens for real socket or falls back to demo auto-match in DEV mode
  useEffect(() => {
    if (isMatched) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isDev = (import.meta as any).env?.DEV === true;
    if (!isDev) {
      // In production, wait exclusively for real partner acceptance via WebSocket
      return;
    }

    let isMounted = true;

    // Trigger demo match after 2.8s in local dev environment
    const matchTimer = setTimeout(() => {
      matchDemoPartner(bookingId)
        .then((res) => {
          if (isMounted && res.partner) {
            setPartner(res.partner);
            setIsMatched(true);
            onPartnerMatched?.(res.partner);
          }
        })
        .catch(() => {
          if (isMounted) {
            setPartner(DEFAULT_MATCHED_PARTNER);
            setIsMatched(true);
            onPartnerMatched?.(DEFAULT_MATCHED_PARTNER);
          }
        });
    }, 2800);

    return () => {
      isMounted = false;
      clearTimeout(matchTimer);
    };
  }, [bookingId, isMatched, onPartnerMatched]);

  // Also listen to real Socket.IO ASSIGNED event if a real partner accepted earlier
  useEffect(() => {
    if (lastStatusChange && lastStatusChange.status === "ASSIGNED") {
      setPartner(DEFAULT_MATCHED_PARTNER);
      setIsMatched(true);
      onPartnerMatched?.(DEFAULT_MATCHED_PARTNER);
    }
  }, [lastStatusChange, onPartnerMatched]);

  // 3. Auto-advance countdown once matched
  // Uses a ref for the interval ID so the cleanup function is always able to clear it
  const advanceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onProceedRef = useRef(onProceedToPayment);
  onProceedRef.current = onProceedToPayment;

  useEffect(() => {
    if (!isMatched) return;

    advanceTimerRef.current = setInterval(() => {
      setAutoAdvanceSecs((prev) => {
        if (prev <= 1) {
          if (advanceTimerRef.current) clearInterval(advanceTimerRef.current);
          onProceedRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (advanceTimerRef.current) clearInterval(advanceTimerRef.current);
    };
  }, [isMatched]);

  return (
    <div
      className="glass-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "24px",
        borderRadius: "20px",
        border: "1px solid rgba(5, 150, 105, 0.22)",
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(240, 253, 250, 0.94) 100%), url('/pixar-doorstep-pickup.jpg') center/cover no-repeat",
        boxShadow: "0 16px 40px -4px rgba(15, 23, 42, 0.08), 0 4px 16px -2px rgba(5, 150, 105, 0.06)",
        textAlign: "center",
      }}
    >
      {/* Dynamic Animated Radar Box */}
      <div
        style={{
          height: "220px",
          background: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
          position: "relative",
          overflow: "hidden",
          borderRadius: "16px",
          border: "1px solid rgba(5, 150, 105, 0.3)",
          boxShadow: "inset 0 2px 10px rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Ambient Dark Satellite Grid */}
        <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.18 }}>
          <pattern id="radarGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#34d399" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#radarGrid)" />
        </svg>

        {/* Radar Concentric Rings */}
        <div
          style={{
            position: "absolute",
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            border: isMatched ? "2px solid #34d399" : "2px solid rgba(52, 211, 153, 0.45)",
            animation: isMatched ? "none" : "pulse 2s infinite ease-out",
            transition: "all 0.5s ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "170px",
            height: "170px",
            borderRadius: "50%",
            border: isMatched ? "1px solid rgba(52, 211, 153, 0.5)" : "1px solid rgba(52, 211, 153, 0.3)",
            animation: isMatched ? "none" : "pulse 2.5s infinite ease-out",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "240px",
            height: "240px",
            borderRadius: "50%",
            border: "1px dashed rgba(52, 211, 153, 0.25)",
          }}
        />

        {/* Central Vehicle / Scanner Icon */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            background: isMatched
              ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
              : "linear-gradient(135deg, #047857 0%, #059669 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: isMatched
              ? "0 0 30px rgba(52, 211, 153, 0.8)"
              : "0 0 25px rgba(5, 150, 105, 0.6)",
            transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            transform: isMatched ? "scale(1.1)" : "scale(1)",
          }}
        >
          {isMatched ? <CheckCircle2 size={36} /> : <Truck size={32} className="animate-pulse" />}
        </div>

        {/* Live HUD Badge */}
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            padding: "5px 14px",
            borderRadius: "9999px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: isMatched ? "#047857" : "#065f46",
            fontWeight: 800,
            border: "1px solid #a7f3d0",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
          }}
        >
          <Radio size={13} className={isMatched ? "" : "animate-pulse"} color="#059669" />
          <span>
            {isMatched
              ? "Partner Connected (100% Electric EV)"
              : `Scanning Sector (${searchRadius} km Radius)`}
          </span>
        </div>
      </div>

      {/* Searching State View */}
      {!isMatched ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-block",
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "#059669",
                boxShadow: "0 0 10px #059669",
              }}
            />
            <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
              Finding Nearby Pickup Partner...
            </h3>
          </div>

          <p style={{ fontSize: "13px", color: "#475569", margin: 0, maxWidth: "480px" }}>
            {STAGE_MESSAGES[searchStage]}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#334155",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              padding: "6px 14px",
              borderRadius: "9999px",
              boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
            }}
          >
            <MapPin size={13} color="#059669" />
            <span>Pickup at: <strong style={{ color: "#0f172a" }}>{customerAddress}</strong></span>
          </div>
        </div>
      ) : (
        /* Matched State View (Celebration & Partner Profile Reveal) */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "6px 16px",
              borderRadius: "9999px",
              background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
              border: "1px solid #a7f3d0",
              color: "#047857",
              fontSize: "13px",
              fontWeight: 800,
              margin: "0 auto",
              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.06)",
            }}
          >
            <Sparkles size={15} color="#059669" />
            <span>Pickup Partner Confirmed!</span>
          </div>

          {/* Partner Card */}
          <div
            className="glass-card"
            style={{
              padding: "20px",
              borderRadius: "16px",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              border: "1px solid #a7f3d0",
              boxShadow: "0 8px 24px -4px rgba(5, 150, 105, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
                }}
              >
                👨🏽‍✈️
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    {partner?.name || "Ramesh Kumar"}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: "#ecfdf5",
                      color: "#059669",
                      border: "1px solid #a7f3d0",
                    }}
                  >
                    ★ {partner?.rating || 4.9}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                  {partner?.vehicleModel || "Tata Ace EV (100% Electric)"} •{" "}
                  <strong style={{ color: "#0f172a" }}>
                    {partner?.vehicleNumber || "KA-01-EA-4821"}
                  </strong>
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    color: "#047857",
                    marginTop: "3px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: 700,
                  }}
                >
                  <ShieldCheck size={13} color="#059669" />
                  <span>Verified Sanitary Specialist & Safety Certified</span>
                </div>
              </div>
            </div>

            {/* ETA Pill */}
            <div
              style={{
                textAlign: "right",
                background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
                padding: "8px 16px",
                borderRadius: "12px",
                border: "1px solid #a7f3d0",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                Arriving in
              </div>
              <div style={{ fontSize: "17px", fontWeight: 900, color: "#064e3b", fontFamily: "var(--font-display)" }}>
                ~{partner?.etaMinutes || 6} mins
              </div>
              <div style={{ fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                {partner?.distanceKm || 1.4} km away
              </div>
            </div>
          </div>

          {/* Action to proceed to payment */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={onProceedToPayment}
              style={{
                padding: "14px",
                fontSize: "15px",
                fontWeight: 800,
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                color: "#ffffff",
                boxShadow: "0 4px 16px rgba(5, 150, 105, 0.35)",
                borderRadius: "12px",
              }}
            >
              Proceed to Payment (₹{totalRs}) <ArrowRight size={16} />
            </button>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              Auto-advancing to secure payment in {autoAdvanceSecs}s...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
