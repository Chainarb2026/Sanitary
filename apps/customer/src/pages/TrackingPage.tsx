import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, XCircle, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { getBookingById, cancelBooking, type BookingStatus } from "../api/bookings.js";
import { useSocket } from "../hooks/useSocket.js";
import { useAuth } from "../hooks/useAuth.js";
import { DirectionMapTracker } from "../components/DirectionMapTracker.js";
import { PaymentView } from "../components/PaymentView.js";

const STATUS_PROGRESS: BookingStatus[] = [
  "CREATED",
  "SEARCHING",
  "ASSIGNED",
  "EN_ROUTE",
  "ARRIVED",
  "OTP_VERIFIED",
  "COLLECTED",
  "PAID",
  "COMPLETED",
];

export const TrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [partnerCoords, setPartnerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Poll / fetch booking data
  const {
    data: booking,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => getBookingById(id!),
    enabled: !!id,
    retry: (failureCount, err: any) => {
      if (err?.status === 404) return false;
      return failureCount < 2;
    },
    refetchInterval: (query) => {
      // Immediately stop polling if booking doesn't exist (404)
      if ((query.state.error as any)?.status === 404) return false;
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "CANCELLED" ? false : 5000;
    },
  });

  // Socket.IO real-time subscriptions
  const { lastPartnerLocation, lastStatusChange } = useSocket(user?.id);

  useEffect(() => {
    if (lastPartnerLocation && booking?.partnerId === lastPartnerLocation.partnerId) {
      setPartnerCoords({
        lat: lastPartnerLocation.latitude,
        lng: lastPartnerLocation.longitude,
      });
    }
  }, [lastPartnerLocation, booking?.partnerId]);

  useEffect(() => {
    if (
      lastStatusChange &&
      (lastStatusChange.bookingId === id || lastStatusChange.bookingId === booking?._id)
    ) {
      void refetch();
    }
  }, [lastStatusChange, id, booking?._id, refetch]);

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: () => cancelBooking(id!, "Customer cancelled from tracking page"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["booking", id] });
      setShowCancelModal(false);
      setCancelError(null);
    },
    onError: (err: any) => {
      if (err?.status === 404) {
        setCancelError("This booking record was not found on the server (server may have restarted).");
        void queryClient.removeQueries({ queryKey: ["booking", id] });
      } else {
        setCancelError(err?.message || "Could not cancel booking. Please try again.");
      }
    },
  });

  const currentStatus = booking?.status || "SEARCHING";
  const statusIndex = STATUS_PROGRESS.indexOf(currentStatus);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "20px" }}>
        <div className="skeleton" style={{ height: "180px", borderRadius: "var(--radius-lg)" }} />
        <div className="skeleton" style={{ height: "100px", borderRadius: "var(--radius-lg)" }} />
        <div className="skeleton" style={{ height: "140px", borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div
        className="glass-card"
        style={{
          textAlign: "center",
          padding: "40px 24px",
          maxWidth: "500px",
          margin: "40px auto",
          border: "1px solid rgba(244, 63, 94, 0.25)",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "rgba(244, 63, 94, 0.1)",
            border: "1.5px solid rgba(244, 63, 94, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <AlertCircle size={30} color="#f43f5e" />
        </div>
        <h3 style={{ fontSize: "18px", fontWeight: 800 }}>Booking Not Found</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "8px", lineHeight: 1.6 }}>
          Booking <strong>#{id?.slice(-6).toUpperCase() || id}</strong> was not found in the database.
          The dev server may have restarted or this session has expired.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/history")}
          >
            My Activity
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/book")}
          >
            Schedule New Pickup
          </button>
        </div>
      </div>
    );
  }

  const isTerminal = currentStatus === "COMPLETED" || currentStatus === "CANCELLED";
  const canCancel =
    !isTerminal &&
    currentStatus !== "ARRIVED" &&
    currentStatus !== "OTP_VERIFIED" &&
    currentStatus !== "COLLECTED" &&
    currentStatus !== "PAID";

  const partnerEnRoute =
    currentStatus === "ASSIGNED" || currentStatus === "EN_ROUTE";

  return (
    <div
      style={{
        maxWidth: "840px",
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        paddingBottom: "36px",
      }}
    >
      {/* ─── Live Status Header ─── */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* Top row: booking ID + status badge + Cancel pill */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: "0.05em",
              }}
            >
              BOOKING #{booking._id.slice(-6).toUpperCase()}
            </span>
            <h2 style={{ fontSize: "18px", marginTop: "4px", lineHeight: 1.3 }}>
              {currentStatus === "SEARCHING" && "Searching for Nearby Partner..."}
              {currentStatus === "ASSIGNED" && "Partner Assigned! Heading Your Way"}
              {currentStatus === "EN_ROUTE" && "Partner is En Route to Your Address"}
              {currentStatus === "ARRIVED" && "Partner Has Arrived at Doorstep!"}
              {currentStatus === "OTP_VERIFIED" && "OTP Verified • Waste Handover"}
              {currentStatus === "COLLECTED" && "Waste Loaded • Ready for Payment"}
              {currentStatus === "PAID" && "Payment Successful"}
              {currentStatus === "COMPLETED" && "Pickup Completed & Recycled"}
              {currentStatus === "CANCELLED" && "Booking Cancelled"}
              {currentStatus === "NO_PARTNER" && "No Partner Available — Try Again"}
            </h2>
          </div>

          {/* Status badge */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <span
              className={`badge ${
                currentStatus === "COMPLETED"
                  ? "badge-emerald"
                  : currentStatus === "CANCELLED"
                    ? "badge-rose"
                    : "badge-teal"
              }`}
            >
              {currentStatus}
            </span>
          </div>
        </div>

        {/* Status progress bar */}
        <div style={{ display: "flex", gap: "4px" }}>
          {["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTED", "COMPLETED"].map((st) => {
            const stepIdx = STATUS_PROGRESS.indexOf(st as BookingStatus);
            const isCompleted = statusIndex >= stepIdx;
            const isCurrent = currentStatus === st;
            return (
              <div
                key={st}
                title={st}
                style={{
                  flex: 1,
                  height: "4px",
                  borderRadius: "var(--radius-full)",
                  background: isCurrent
                    ? "var(--color-teal)"
                    : isCompleted
                      ? "var(--color-brand)"
                      : "rgba(100, 116, 139, 0.2)",
                  transition: "background 0.4s ease",
                }}
              />
            );
          })}
        </div>

        {/* Inline fee warning — shown when partner is already dispatched */}
        {canCancel && partnerEnRoute && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 13px",
              borderRadius: "10px",
              background: "rgba(251, 191, 36, 0.08)",
              border: "1px solid rgba(251, 191, 36, 0.35)",
              fontSize: "12px",
              color: "#b45309",
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>
              Partner is already on the way. Cancelling now incurs a{" "}
              <strong>₹50 compensation fee</strong>.
            </span>
          </div>
        )}
      </div>

      {/* ─── Real-time Map & Direction Tracker ─── */}
      <DirectionMapTracker
        status={currentStatus}
        customerCoords={{
          lat: booking.address.location?.coordinates
            ? booking.address.location.coordinates[1]
            : 12.9716,
          lng: booking.address.location?.coordinates
            ? booking.address.location.coordinates[0]
            : 77.5946,
        }}
        customerAddressText={`${booking.address.addressLine1}, ${booking.address.city}`}
        partnerCoords={partnerCoords}
        pickupOtp={
          !["COMPLETED", "CANCELLED", "COLLECTED"].includes(currentStatus)
            ? booking.pickupOtp
            : undefined
        }
      />

      {/* ─── Pickup Details Card ─── */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Pickup Details
        </h4>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px" }}>
          <MapPin size={16} color="var(--color-teal)" style={{ marginTop: "2px", flexShrink: 0 }} />
          <div>
            <strong>{booking.address.addressLine1}</strong>
            <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
              {booking.address.city} • {booking.address.pincode}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
          <Clock size={16} color="var(--color-teal)" style={{ flexShrink: 0 }} />
          <div>
            <strong>
              {booking.slot.type === "asap"
                ? "ASAP Pickup (15-30m)"
                : `${booking.slot.date} (${booking.slot.startTime} - ${booking.slot.endTime})`}
            </strong>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "10px",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: "14px",
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>Total Fare</span>
          <strong style={{ fontSize: "16px", color: "var(--color-teal)" }}>
            ₹{(booking.quote.total / 100).toFixed(0)}
          </strong>
        </div>
      </div>

      {/* ─── Payment ─── only shown when partner is PHYSICALLY at the door ─── */}
      {["PAID", "COMPLETED"].includes(currentStatus) ? (
        <div
          className="glass-card"
          style={{
            background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
            border: "1.5px solid #a7f3d0",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: "16px",
            boxShadow: "0 4px 16px rgba(5, 150, 105, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "var(--color-brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 0 16px rgba(5, 150, 105, 0.5)",
              }}
            >
              <CheckCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--color-brand)" }}>
                Payment Confirmed & Verified
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                ₹{(booking.quote.total / 100).toFixed(0)} paid via secure gateway • Receipt logged
              </div>
            </div>
          </div>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "9999px",
              background: "rgba(5, 150, 105, 0.2)",
              color: "var(--color-brand)",
              fontSize: "12px",
              fontWeight: 800,
              border: "1px solid rgba(5, 150, 105, 0.4)",
            }}
          >
            PAID
          </span>
        </div>
      ) : ["ARRIVED", "OTP_VERIFIED", "COLLECTED"].includes(currentStatus) ? (
        <PaymentView
          bookingId={booking._id}
          totalPaise={booking.quote.total}
          partnerName="Ramesh Kumar (Tata Ace EV)"
          onPaymentSuccess={() => {
            void refetch();
          }}
        />
      ) : null}

      {/* ─── Cancelled State Card ─── */}
      {currentStatus === "CANCELLED" && (
        <div
          className="glass-card"
          style={{
            textAlign: "center",
            padding: "28px 20px",
            border: "1px solid rgba(244, 63, 94, 0.2)",
            background: "rgba(244, 63, 94, 0.03)",
          }}
        >
          <XCircle size={34} color="#f43f5e" style={{ margin: "0 auto 10px" }} />
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#f43f5e", marginBottom: "6px" }}>
            Booking Cancelled
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "18px", lineHeight: 1.6 }}>
            Your waste pickup has been cancelled. No charges apply for free-window cancellations.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/book")}
          >
            Schedule a New Pickup
          </button>
        </div>
      )}

      {/* ─── Cancel Pickup Bottom Action ─── */}
      {canCancel && (
        <div
          className="glass-card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            padding: "20px 24px",
            borderRadius: "16px",
            border: "1px solid rgba(244, 63, 94, 0.25)",
            background: "rgba(244, 63, 94, 0.03)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                Need to cancel this pickup?
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                {partnerEnRoute
                  ? "Partner is currently on the way. Cancelling now incurs a ₹50 compensation fee."
                  : "Free cancellation — no charges apply before partner is dispatched."}
              </div>
            </div>

            <button
              id="cancel-pickup-btn"
              type="button"
              onClick={() => setShowCancelModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "11px 22px",
                borderRadius: "12px",
                border: "1.5px solid #f43f5e",
                background: "rgba(244, 63, 94, 0.08)",
                color: "#f43f5e",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(244, 63, 94, 0.16)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(244, 63, 94, 0.08)";
              }}
            >
              <XCircle size={16} />
              Cancel Pickup
            </button>
          </div>
        </div>
      )}

      {/* ─── Cancel Confirmation Modal ─── */}
      {showCancelModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1000,
          }}
        >
          <div
            className="glass-card"
            style={{ maxWidth: "400px", width: "100%", padding: "28px" }}
          >
            {/* Icon */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(244, 63, 94, 0.1)",
                border: "1.5px solid rgba(244, 63, 94, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <XCircle size={28} color="#f43f5e" />
            </div>

            <h3 style={{ fontSize: "18px", fontWeight: 800, textAlign: "center", marginBottom: "8px" }}>
              Cancel This Pickup?
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.6, marginBottom: "14px" }}>
              {partnerEnRoute
                ? "A partner is already on their way to your doorstep."
                : "Your partner has not been dispatched yet."}
            </p>

            {/* Fee pill */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                background: partnerEnRoute
                  ? "rgba(251, 191, 36, 0.08)"
                  : "rgba(5, 150, 105, 0.06)",
                border: partnerEnRoute
                  ? "1px solid rgba(251, 191, 36, 0.35)"
                  : "1px solid rgba(5, 150, 105, 0.2)",
                fontSize: "13px",
                fontWeight: 700,
                color: partnerEnRoute ? "#b45309" : "#047857",
                marginBottom: "22px",
                textAlign: "center",
              }}
            >
              {partnerEnRoute
                ? "⚠️  Cancellation fee: ₹50 partner compensation"
                : "✅  Free cancellation — zero charges"}
            </div>

            {cancelError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(244, 63, 94, 0.1)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  color: "#f43f5e",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "16px",
                  textAlign: "center",
                }}
              >
                {cancelError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCancelModal(false)}
                style={{ padding: "13px", fontWeight: 700, fontSize: "14px" }}
              >
                Keep Booking
              </button>
              <button
                id="confirm-cancel-btn"
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
                style={{
                  padding: "13px",
                  borderRadius: "12px",
                  background: cancelMutation.isPending
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: cancelMutation.isPending ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxShadow: cancelMutation.isPending
                    ? "none"
                    : "0 4px 14px rgba(244, 63, 94, 0.35)",
                  transition: "all 0.2s ease",
                }}
              >
                {cancelMutation.isPending ? (
                  "Cancelling..."
                ) : (
                  <>
                    <XCircle size={15} /> Confirm Cancel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
