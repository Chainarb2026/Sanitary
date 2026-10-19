import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Power,
  Navigation,
  ShieldCheck,
  CheckCircle,
  Phone,
  Star,
  MapPin,
  ArrowRight,
  ExternalLink,
  Radio,
  FileCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useSocket } from "../hooks/useSocket.js";
import {
  getPartnerProfile,
  onboardPartner,
  togglePartnerStatus,
  pingPartnerLocation,
  getPartnerWalletBalance,
  acceptBookingOffer,
  transitionBookingStatus,
  verifyPickupOtp,
  getActivePartnerBookings,
} from "../api/partners.js";

// Web Audio API notification sound for incoming offers
function playOfferChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.frequency.setValueAtTime(880.0, ctx.currentTime + 0.12); // A5

    osc2.frequency.setValueAtTime(440.0, ctx.currentTime); // A4
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.45);
    osc2.stop(ctx.currentTime + 0.45);
  } catch {
    // Audio context may require prior user interaction
  }
}

export const PartnerPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Active Offer State
  const [incomingOffer, setIncomingOffer] = useState<{
    bookingId: string;
    customerId?: string;
    address: { street: string; city: string; postalCode?: string; location?: { coordinates: [number, number] } };
    quote: { total: number; partnerEarning: number };
    slot?: { date: string; type: string };
    expiresAt: string;
    timeoutSeconds: number;
  } | null>(null);

  const [offerCountdown, setOfferCountdown] = useState<number>(15);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number }>({
    lat: 12.9784,
    lng: 77.6408,
  });
  const [gpsStatus, setGpsStatus] = useState<string>("Locating GPS...");
  const [pickupOtpInput, setPickupOtpInput] = useState<string>("");
  const [weightInput, setWeightInput] = useState<number>(10);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Onboarding Form State (for first time partners)
  const [onboardName, setOnboardName] = useState<string>(user?.name || "Ramesh Kumar");
  const [vehicleType, setVehicleType] = useState<"electric_van" | "light_truck" | "three_wheeler" | "two_wheeler">("electric_van");
  const [docType, setDocType] = useState<"driving_license" | "aadhaar" | "pan">("driving_license");
  const [docNumber, setDocNumber] = useState<string>("KA-01-2022-004812");

  // Query: Partner Profile
  const {
    data: partnerProfile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["partnerProfile", user?.id],
    queryFn: getPartnerProfile,
    enabled: isAuthenticated,
    retry: false,
  });

  // Query: Wallet Balance
  const { data: walletData, refetch: refetchWallet } = useQuery({
    queryKey: ["partnerWallet"],
    queryFn: getPartnerWalletBalance,
    enabled: isAuthenticated && !!partnerProfile,
    refetchInterval: 15000,
  });

  // Query: Active Partner Bookings
  const { data: activeBookingsData, refetch: refetchActiveBookings } = useQuery({
    queryKey: ["partnerActiveBookings"],
    queryFn: getActivePartnerBookings,
    enabled: isAuthenticated && !!partnerProfile,
    refetchInterval: 5000,
  });

  const activeJob = activeBookingsData?.items?.find((b: { status: string }) =>
    ["ASSIGNED", "EN_ROUTE", "ARRIVED", "OTP_VERIFIED", "COLLECTED"].includes(b.status)
  );

  // Socket.IO hook for live partner updates
  const { socket } = useSocket(partnerProfile?._id || user?.id);

  // 1. Listen for incoming booking offers via Socket.IO
  useEffect(() => {
    if (!socket || !partnerProfile?.isOnline) return;

    const handleOffer = (offer: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = offer as any;
      setIncomingOffer(o);
      setOfferCountdown(o.timeoutSeconds || 15);
      playOfferChime();
    };

    socket.on("offer:created", handleOffer);
    return () => {
      socket.off("offer:created", handleOffer);
    };
  }, [socket, partnerProfile?.isOnline]);

  // 2. Offer 15-second countdown timer
  useEffect(() => {
    if (!incomingOffer) return;
    if (offerCountdown <= 0) {
      setIncomingOffer(null);
      return;
    }
    const timer = setInterval(() => {
      setOfferCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [incomingOffer, offerCountdown]);

  // 3. Continuous GPS telemetry pinging when ONLINE
  useEffect(() => {
    if (!partnerProfile?.isOnline) return;

    // Get browser coordinates if allowed
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGpsStatus("Real GPS Locked (±5m)");
        },
        () => {
          // Fallback to Bengaluru city coordinates
          setGpsStatus("Simulation GPS Active (Bengaluru Central)");
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }

    const pingInterval = setInterval(async () => {
      try {
        await pingPartnerLocation({
          latitude: gpsCoords.lat,
          longitude: gpsCoords.lng,
        });
      } catch {
        // Silently tolerate transient network flickers
      }
    }, 10000);

    return () => clearInterval(pingInterval);
  }, [partnerProfile?.isOnline, gpsCoords.lat, gpsCoords.lng]);

  // Toggle Duty Online / Offline
  const toggleDutyMutation = useMutation({
    mutationFn: (newStatus: boolean) => togglePartnerStatus(newStatus),
    onSuccess: () => {
      void refetchProfile();
      void queryClient.invalidateQueries({ queryKey: ["partnerProfile"] });
    },
  });

  // Partner Onboarding Mutation
  const onboardMutation = useMutation({
    mutationFn: () =>
      onboardPartner({
        name: onboardName,
        vehicleType,
        serviceRadiusKm: 12,
        documentType: docType,
        documentNumber: docNumber,
        documentUrl: "https://storage.sanitary.network/kyc/verified-dl.pdf",
      }),
    onSuccess: () => {
      void refetchProfile();
      void queryClient.invalidateQueries({ queryKey: ["partnerProfile"] });
    },
  });

  // Accept Offer Handler
  const handleAcceptOffer = async () => {
    if (!incomingOffer) return;
    setActionLoading(true);
    try {
      await acceptBookingOffer(incomingOffer.bookingId);
      setIncomingOffer(null);
      await refetchActiveBookings();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to accept offer";
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Arrive at Doorstep Handler
  const handleArriveAtPickup = async (bookingId: string) => {
    setActionLoading(true);
    try {
      await transitionBookingStatus(bookingId, "ARRIVED", "Partner arrived at doorstep");
      await refetchActiveBookings();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to record arrival";
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Verify Pickup OTP Handler
  const handleVerifyOtp = async (bookingId: string) => {
    if (pickupOtpInput.length !== 6) {
      setOtpError("Please enter the 6-digit pickup code shown on the customer screen");
      return;
    }
    setActionLoading(true);
    setOtpError(null);
    try {
      await verifyPickupOtp(bookingId, pickupOtpInput);
      setPickupOtpInput("");
      await refetchActiveBookings();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Invalid pickup OTP";
      setOtpError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Complete Pickup Job Handler
  const handleCompletePickup = async (bookingId: string) => {
    setActionLoading(true);
    try {
      await transitionBookingStatus(bookingId, "COMPLETED", `Pickup completed. Actual weight: ${weightInput} kg`);
      await refetchActiveBookings();
      await refetchWallet();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to complete pickup";
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Click Simulated Offer for developer testing
  const handleSimulateOffer = () => {
    const mockOffer = {
      bookingId: `demo_${Date.now()}`,
      address: {
        street: "12th Main Road, HAL 2nd Stage, Indiranagar",
        city: "Bengaluru",
        postalCode: "560038",
      },
      quote: {
        total: 25000,
        partnerEarning: 21250,
      },
      slot: {
        date: new Date().toISOString().slice(0, 10),
        type: "asap",
      },
      expiresAt: new Date(Date.now() + 15000).toISOString(),
      timeoutSeconds: 15,
    };
    setIncomingOffer(mockOffer);
    setOfferCountdown(15);
    playOfferChime();
  };

  // ─── VIEW 1: AUTH REQUIRED ───
  if (!authLoading && !isAuthenticated) {
    return (
      <div style={{ maxWidth: "480px", margin: "40px auto", textAlign: "center" }}>
        <div className="glass-card" style={{ padding: "36px 24px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(16, 185, 129, 0.3)",
            }}
          >
            <Truck size={32} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 8px 0" }}>
            Sanitary Partner Portal
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>
            Log in with your registered phone number to manage duty status, accept doorstep pickups, and track earnings.
          </p>
          <button
            type="button"
            onClick={() => navigate("/auth", { state: { from: "/partner" } })}
            className="btn btn-primary btn-block btn-lg"
          >
            Sign In with Phone OTP <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ─── VIEW 2: ONBOARDING REQUIRED ───
  if (isAuthenticated && !profileLoading && !partnerProfile) {
    return (
      <div style={{ maxWidth: "540px", margin: "24px auto" }}>
        <div className="glass-card" style={{ padding: "32px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
              }}
            >
              <FileCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>Register as a Partner</h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                Complete instant vehicle KYC to start receiving doorstep waste collections.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onboardMutation.mutate();
            }}
            style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}
          >
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input
                type="text"
                required
                className="input-field"
                value={onboardName}
                onChange={(e) => setOnboardName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Electric Vehicle / Fleet Type</label>
              <select
                className="input-field"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as any)}
              >
                <option value="electric_van">Tata Ace EV (Electric 1-Ton Van)</option>
                <option value="light_truck">Mahindra Bolero Maxi Truck</option>
                <option value="three_wheeler">Piaggio Ape E-City Electric Auto</option>
                <option value="two_wheeler">Electric Cargo Scooter (Light loads)</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="input-group">
                <label className="input-label">Document Type</label>
                <select
                  className="input-field"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                >
                  <option value="driving_license">Driving License</option>
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="pan">PAN Card</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Document ID Number</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                padding: "12px 16px",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ShieldCheck size={18} />
              <span>Instant auto-approval active in Development mode. Ready in seconds.</span>
            </div>

            <button
              type="submit"
              disabled={onboardMutation.isPending}
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: "8px" }}
            >
              {onboardMutation.isPending ? "Submitting Application..." : "Activate Partner Account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── VIEW 3: PARTNER COCKPIT (ACTIVE) ───
  const isOnline = Boolean(partnerProfile?.isOnline);
  const walletRs = walletData ? (walletData.balancePaise / 100).toFixed(2) : "450.00";

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Partner Header Cockpit HUD */}
      <div
        className="glass-card"
        style={{
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          border: isOnline ? "1.5px solid rgba(16, 185, 129, 0.5)" : "1px solid var(--border-subtle)",
          boxShadow: isOnline ? "0 0 25px rgba(16, 185, 129, 0.15)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              position: "relative",
              width: "50px",
              height: "50px",
              borderRadius: "16px",
              background: isOnline
                ? "linear-gradient(135deg, #10b981 0%, #047857 100%)"
                : "rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: isOnline ? "0 0 16px rgba(16, 185, 129, 0.6)" : "none",
            }}
          >
            <Truck size={24} />
            {isOnline && (
              <span
                style={{
                  position: "absolute",
                  top: "-3px",
                  right: "-3px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#10b981",
                  border: "2px solid #030712",
                }}
              />
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                {partnerProfile?.name || "Ramesh Kumar"}
              </h2>
              <span className="badge badge-emerald">Verified EV</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#fbbf24" }}>
                <Star size={13} fill="#fbbf24" /> 4.92 (428 trips)
              </span>
              <span>•</span>
              <span style={{ color: "var(--color-teal)" }}>{partnerProfile?.vehicleType?.replace("_", " ").toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Duty Toggle Switch */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Wallet Balance
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#059669", fontFamily: "var(--font-display)" }}>
              ₹{walletRs}
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleDutyMutation.mutate(!isOnline)}
            disabled={toggleDutyMutation.isPending}
            style={{
              padding: "10px 18px",
              borderRadius: "var(--radius-full)",
              background: isOnline ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : "var(--bg-secondary)",
              border: isOnline ? "none" : "1px solid var(--border-medium)",
              color: isOnline ? "#ffffff" : "var(--text-primary)",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: isOnline ? "0 4px 16px rgba(5, 150, 105, 0.4)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            <Power size={16} />
            <span>{isOnline ? "ONLINE" : "GO ONLINE"}</span>
          </button>
        </div>
      </div>

      {/* 2. GPS & Radar Telemetry Bar */}
      {isOnline && (
        <div
          style={{
            background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
            border: "1px solid #a7f3d0",
            borderRadius: "14px",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            boxShadow: "0 2px 8px rgba(5, 150, 105, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Radio size={16} color="#059669" />
            <span style={{ color: "#065f46", fontWeight: 700 }}>{gpsStatus}</span>
            <span style={{ color: "#047857" }}>({gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)})</span>
          </div>
          <button
            type="button"
            onClick={handleSimulateOffer}
            style={{
              background: "#ffffff",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              padding: "5px 12px",
              color: "#047857",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <Zap size={12} color="#059669" /> Test Offer Chime
          </button>
        </div>
      )}

      {/* 3. INCOMING OFFER POPUP MODAL (15-Second Uber-Style Chime Modal) */}
      {incomingOffer && (
        <div
          className="glass-card"
          style={{
            border: "2px solid #059669",
            background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(5, 150, 105, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={20} color="#059669" />
              <span style={{ fontSize: "15px", fontWeight: 800, color: "#064e3b", textTransform: "uppercase" }}>
                New Doorstep Pickup Offer!
              </span>
            </div>

            {/* Countdown Badge */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: offerCountdown <= 5 ? "#ef4444" : "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: "15px",
                boxShadow: "0 2px 8px rgba(5, 150, 105, 0.4)",
              }}
            >
              {offerCountdown}s
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "12px" }}>
                <MapPin size={14} color="#059669" />
                <span>Customer Doorstep Location:</span>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
                {incomingOffer.address?.street}, {incomingOffer.address?.city}
              </div>
              <div style={{ fontSize: "12px", color: "#059669", marginTop: "2px", fontWeight: 600 }}>
                ~1.4 km away (Est. 5 min drive)
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                You Earn
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#059669", fontFamily: "var(--font-display)" }}>
                ₹{(incomingOffer.quote.partnerEarning / 100).toFixed(0)}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
            <button
              type="button"
              onClick={() => setIncomingOffer(null)}
              className="btn btn-secondary"
              style={{ padding: "14px", fontWeight: 700 }}
            >
              Decline
            </button>
            <button
              type="button"
              onClick={handleAcceptOffer}
              disabled={actionLoading}
              className="btn btn-primary"
              style={{
                padding: "14px",
                fontWeight: 800,
                fontSize: "15px",
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
              }}
            >
              {actionLoading ? "Accepting..." : "Accept Pickup Job"} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 4. ACTIVE JOB EXECUTION COCKPIT (Turn-by-turn & Doorstep OTP) */}
      {activeJob ? (
        <div
          className="glass-card"
          style={{
            padding: "24px",
            borderRadius: "20px",
            border: "1.5px solid var(--color-teal)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className="badge badge-emerald" style={{ marginBottom: "6px" }}>
                CURRENT PICKUP MISSION: {activeJob.status}
              </span>
              <h3 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                {activeJob.address?.street}, {activeJob.address?.city}
              </h3>
            </div>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${activeJob.address?.location?.coordinates?.[1] || 12.9784},${activeJob.address?.location?.coordinates?.[0] || 77.6408}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ padding: "8px 14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Navigation size={14} color="#059669" /> Open Maps <ExternalLink size={12} />
            </a>
          </div>

          {/* Stepper Logic for Fulfillment */}
          {activeJob.status === "ASSIGNED" || activeJob.status === "EN_ROUTE" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  padding: "16px",
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Customer Doorstep Notes:</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginTop: "4px" }}>
                    {activeJob.customerNotes || "Bags kept outside near apartment gate"}
                  </div>
                </div>

                <a
                  href={`tel:+919876543210`}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "rgba(5, 150, 105, 0.12)",
                    border: "1px solid rgba(5, 150, 105, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#059669",
                  }}
                >
                  <Phone size={18} />
                </a>
              </div>

              <button
                type="button"
                onClick={() => handleArriveAtPickup(activeJob._id || activeJob.id)}
                disabled={actionLoading}
                className="btn btn-primary btn-block btn-lg"
                style={{
                  padding: "16px",
                  fontSize: "16px",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
                }}
              >
                <CheckCircle size={18} /> I Have Arrived at Doorstep
              </button>
            </div>
          ) : activeJob.status === "ARRIVED" ? (
            /* Doorstep Pickup OTP Verification Step */
            <div
              style={{
                background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
                border: "1.5px solid #a7f3d0",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                boxShadow: "0 4px 16px rgba(5, 150, 105, 0.08)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#064e3b" }}>
                  Ask Customer for 6-Digit Pickup Code
                </div>
                <div style={{ fontSize: "12px", color: "#047857", marginTop: "2px" }}>
                  The customer sees this code on their live tracking screen. Enter it below to verify presence.
                </div>
              </div>

              {otpError && (
                <div style={{ background: "#fff1f2", color: "#be123c", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", textAlign: "center" }}>
                  {otpError}
                </div>
              )}

              <input
                type="text"
                maxLength={6}
                autoFocus
                placeholder="• • • • • •"
                value={pickupOtpInput}
                onChange={(e) => setPickupOtpInput(e.target.value.replace(/\D/g, ""))}
                style={{
                  fontSize: "28px",
                  fontWeight: 900,
                  letterSpacing: "10px",
                  textAlign: "center",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#ffffff",
                  color: "#0f172a",
                  border: "1.5px solid #cbd5e1",
                  fontFamily: "monospace",
                }}
              />

              <button
                type="button"
                onClick={() => handleVerifyOtp(activeJob._id || activeJob.id)}
                disabled={actionLoading || pickupOtpInput.length !== 6}
                className="btn btn-primary btn-block btn-lg"
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
                }}
              >
                {actionLoading ? "Verifying Presence..." : "Verify Pickup OTP & Collect"} <ShieldCheck size={18} />
              </button>
            </div>
          ) : (
            /* Waste Weighing and Handover Completion */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  padding: "18px",
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>Actual Scale Weight (kg)</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Confirm measured weight on vehicle scale</div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setWeightInput((w) => Math.max(1, w - 1))}
                    className="btn btn-secondary"
                    style={{ width: "36px", height: "36px", padding: 0 }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)", minWidth: "40px", textAlign: "center" }}>
                    {weightInput} kg
                  </span>
                  <button
                    type="button"
                    onClick={() => setWeightInput((w) => w + 1)}
                    className="btn btn-secondary"
                    style={{ width: "36px", height: "36px", padding: 0 }}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCompletePickup(activeJob._id || activeJob.id)}
                disabled={actionLoading}
                className="btn btn-primary btn-block btn-lg"
                style={{
                  padding: "16px",
                  fontSize: "16px",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
                }}
              >
                <CheckCircle size={18} /> Complete Pickup & Collect ₹{((activeJob.quote?.partnerEarning || 18000) / 100).toFixed(0)}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Standby Status Card */
        <div
          className="glass-card"
          style={{
            padding: "36px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: isOnline ? "#ecfdf5" : "var(--bg-secondary)",
              border: isOnline ? "1px solid #a7f3d0" : "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isOnline ? "#059669" : "var(--text-muted)",
            }}
          >
            <Radio size={28} />
          </div>

          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            {isOnline ? "Scanning Area for Doorstep Pickups..." : "You are Currently Offline"}
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "400px", margin: 0, lineHeight: 1.5 }}>
            {isOnline
              ? "Keep this page open on your phone or vehicle mount. You will receive an audio chime and 15-second acceptance modal when a resident books."
              : "Toggle the switch in the top right to GO ONLINE and start receiving nearby collections."}
          </p>
        </div>
      )}
    </div>
  );
};
