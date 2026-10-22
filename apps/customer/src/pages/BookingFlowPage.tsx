import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, MapPin, Calendar, CreditCard, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { getWasteTypes, calculateQuote, FALLBACK_WASTE_TYPES, type PricingBreakdown } from "../api/wasteTypes.js";
import { createBooking, type BookingSlot } from "../api/bookings.js";
import { type Address } from "../api/addresses.js";
import { SanitaryMark } from "../components/SanitaryLogo.js";
import { BagSizeSelector } from "../components/BagSizeSelector.js";
import { AddressMapPicker } from "../components/AddressMapPicker.js";
import { SlotPicker } from "../components/SlotPicker.js";
import { InstantQuoteCard } from "../components/InstantQuoteCard.js";
import { PaymentView } from "../components/PaymentView.js";
import { FindingPartnerView } from "../components/FindingPartnerView.js";

type BookingStep = "waste" | "address" | "slot" | "review" | "finding" | "payment";

export const BookingFlowPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlAddress = searchParams.get("address");
  const urlItem = searchParams.get("item");
  const urlItemsJson = searchParams.get("items");
  const urlLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
  const urlLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null;
  const urlPincode = searchParams.get("pincode");
  const urlCity = searchParams.get("city");

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth", { state: { from: "/book" } });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load catalog (instant fallback data prevents any loading flash or empty states)
  const { data: catalogData } = useQuery({
    queryKey: ["wasteTypes"],
    queryFn: getWasteTypes,
    initialData: { wasteTypes: FALLBACK_WASTE_TYPES },
  });

  const wasteTypes = catalogData?.wasteTypes || FALLBACK_WASTE_TYPES;

  // Flow State
  const [currentStep, setCurrentStep] = useState<BookingStep>("waste");
  const [selectedItems, setSelectedItems] = useState<
    Array<{ wasteTypeId: string; quantity: number; estimatedWeightKg: number }>
  >([]);
  const [quote, setQuote] = useState<PricingBreakdown | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [slot, setSlot] = useState<BookingSlot>({
    date: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: "12:00",
    type: "asap",
  });
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Stable ref to avoid stale-closure issues in useEffects that call quoteMutation
  const quoteMutationRef = useRef<typeof quoteMutation | null>(null);

  // Auto-select waste item from URL query if provided (e.g. from Uber Hero card)
  // Runs only once when catalog loads — no selectedItems in deps to avoid infinite loop
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (wasteTypes.length > 0 && !didAutoSelectRef.current) {
      didAutoSelectRef.current = true;

      // 1. Check for serialized items array from HomePage
      if (urlItemsJson) {
        try {
          const parsed = JSON.parse(urlItemsJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedItems(parsed);
            quoteMutationRef.current?.mutate(parsed);
            return;
          }
        } catch {
          // Ignored if JSON parsing fails, fall through to urlItem
        }
      }

      // 2. Single item slug match or default to first category
      const match = urlItem
        ? (wasteTypes.find(
            (w) =>
              w.slug === urlItem ||
              w.name.toLowerCase().includes(urlItem.toLowerCase()) ||
              (urlItem === "small-bag" && w.slug.includes("bag")) ||
              (urlItem === "medium" && w.slug.includes("segregated")) ||
              (urlItem === "bulk-furniture" && w.slug.includes("bulk")),
          ) || wasteTypes[0])
        : wasteTypes[0];

      if (match) {
        const initialItems = [
          {
            wasteTypeId: match._id,
            quantity: 1,
            estimatedWeightKg: 1,
          },
        ];
        setSelectedItems(initialItems);
        // Use ref to avoid stale closure on quoteMutation
        quoteMutationRef.current?.mutate(initialItems);
      }
    }
  }, [urlItem, urlItemsJson, wasteTypes]);

  // Keep selectedItems IDs in sync with current wasteTypes catalog
  // Use a ref to track previous item IDs to avoid the selectedItems → setState → re-trigger loop
  const prevItemIdsRef = useRef<string>("");
  useEffect(() => {
    if (wasteTypes.length === 0 || selectedItems.length === 0) return;
    const currentIds = selectedItems.map((it) => it.wasteTypeId).join(",");
    if (prevItemIdsRef.current === currentIds) return; // no change

    const hasInvalidId = selectedItems.some(
      (it) => !wasteTypes.some((w) => w._id === it.wasteTypeId),
    );
    if (hasInvalidId) {
      const normalized = selectedItems.map((it) => {
        const match =
          wasteTypes.find(
            (w) =>
              w._id === it.wasteTypeId ||
              it.wasteTypeId.includes(w.slug) ||
              w.slug.includes(it.wasteTypeId),
          ) || wasteTypes[0];
        return {
          ...it,
          wasteTypeId: match ? match._id : it.wasteTypeId,
        };
      });
      const normalizedIds = normalized.map((it) => it.wasteTypeId).join(",");
      prevItemIdsRef.current = normalizedIds;
      setSelectedItems(normalized);
      quoteMutationRef.current?.mutate(normalized);
    } else {
      prevItemIdsRef.current = currentIds;
    }
  }, [wasteTypes, selectedItems]);

  // Quote recalculation based on bag & waste sizes
  const quoteMutation = useMutation({
    mutationFn: (itemsOverride?: Array<{ wasteTypeId: string; quantity: number; estimatedWeightKg: number }>) => {
      const itemsToCalculate = itemsOverride || selectedItems;
      return calculateQuote(
        itemsToCalculate.map((it) => ({
          wasteTypeId: it.wasteTypeId,
          quantity: it.quantity,
          weightKg: it.estimatedWeightKg,
        })),
        2,
        false,
        1.0,
      );
    },
    onSuccess: (res) => {
      setQuote(res.breakdown);
    },
  });
  // Always keep the ref in sync so effects never hold a stale reference
  quoteMutationRef.current = quoteMutation;

  const handleBagItemsChange = useCallback(
    (items: Array<{ wasteTypeId: string; quantity: number; estimatedWeightKg: number }>) => {
      setSelectedItems(items);
      if (items.length > 0) {
        quoteMutation.mutate(items);
      } else {
        setQuote(null);
      }
      setErrorMessage(null);
    },
    [quoteMutation],
  );

  // Booking creation mutation
  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAddress) throw new Error("Please select a pickup address");
      if (selectedItems.length === 0) throw new Error("Please provide waste items");

      const idempotencyKey = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return createBooking(
        {
          addressId: selectedAddress._id,
          items: selectedItems,
          slot,
          customerNotes: customerNotes || undefined,
        },
        idempotencyKey,
      );
    },
    onSuccess: (booking) => {
      const bId = booking._id || booking.id || "";
      setCreatedBookingId(bId);
      setCurrentStep("finding");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to schedule pickup";
      setErrorMessage(msg);
    },
  });

  // Step Indicators
  const STEPS: Array<{ key: BookingStep; label: string; icon: React.ReactNode }> = [
    { key: "waste", label: "Bags & Items", icon: <Sparkles size={14} /> },
    { key: "address", label: "Address", icon: <MapPin size={14} /> },
    { key: "slot", label: "Schedule", icon: <Calendar size={14} /> },
    { key: "review", label: "Review", icon: <CreditCard size={14} /> },
    { key: "payment", label: "Partner & Pay", icon: <Sparkles size={14} /> },
  ];

  const currentStepIndex = useMemo(() => {
    switch (currentStep) {
      case "waste":
        return 0;
      case "address":
        return 1;
      case "slot":
        return 2;
      case "review":
        return 3;
      case "finding":
      case "payment":
        return 4;
    }
  }, [currentStep]);

  return (
    <div
      style={{
        maxWidth: "780px",
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Step Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <SanitaryMark size={28} />
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
              Book Doorstep Pickup
            </h1>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "13px", color: "var(--color-brand)", fontWeight: 700, marginTop: "2px" }}>
            {STEPS[currentStepIndex]?.label}
          </div>
        </div>
        <span
          style={{
            fontSize: "12px",
            color: "var(--color-brand)",
            fontWeight: 800,
            background: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            padding: "4px 12px",
            borderRadius: "9999px",
          }}
        >
          Step {currentStepIndex + 1} of {STEPS.length}
        </span>
      </div>

      {/* Step Progress Bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          background: "var(--bg-secondary)",
          padding: "5px",
          borderRadius: "9999px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {STEPS.map((s, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone = idx < currentStepIndex;
          return (
            <div
              key={s.key}
              style={{
                flex: 1,
                height: "6px",
                borderRadius: "9999px",
                background: isActive
                  ? "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)"
                  : isDone
                    ? "var(--color-brand)"
                    : "#e2e8f0",
                boxShadow: isActive ? "0 0 8px rgba(56, 189, 248, 0.4)" : "none",
                transition: "all 0.3s ease",
              }}
              title={s.label}
            />
          );
        })}
      </div>

      {errorMessage && (
        <div
          style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            color: "#be123c",
            fontSize: "13px",
          }}
        >
          {errorMessage}
        </div>
      )}

      {urlAddress && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 18px",
            borderRadius: "14px",
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 253, 244, 0.94) 100%), url('/uber-fleet-dispatch.jpg') right center/cover no-repeat",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            boxShadow: "0 4px 16px rgba(56, 189, 248, 0.1)",
            fontSize: "13px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(56, 189, 248, 0.35)",
            }}
          >
            <MapPin size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 800, color: "var(--color-brand)" }}>Pickup Location: </span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{urlAddress}</span>
          </div>
        </div>
      )}

      {/* Step 1: Bag & Waste Size Selection */}
      {currentStep === "waste" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <BagSizeSelector
            wasteTypes={wasteTypes}
            selectedItems={selectedItems}
            onItemsChange={handleBagItemsChange}
          />

          {quote && <InstantQuoteCard quote={quote} isLoading={quoteMutation.isPending} />}

          <button
            type="button"
            disabled={selectedItems.length === 0}
            className="btn btn-primary btn-block"
            onClick={() => setCurrentStep("address")}
          >
            Continue to Address <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Step 2: Address Picker */}
      {currentStep === "address" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <AddressMapPicker
            selectedAddressId={selectedAddress?._id || null}
            onSelectAddress={(addr) => setSelectedAddress(addr)}
            initialLocation={{
              address: urlAddress,
              lat: urlLat,
              lng: urlLng,
              pincode: urlPincode,
              city: urlCity,
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep("waste")}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              disabled={!selectedAddress}
              className="btn btn-primary"
              onClick={() => setCurrentStep("slot")}
            >
              Confirm Address <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Slot Selection */}
      {currentStep === "slot" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SlotPicker
            slot={slot}
            customerNotes={customerNotes}
            onSlotChange={setSlot}
            onNotesChange={setCustomerNotes}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setCurrentStep("address"); setErrorMessage(null); }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep("review")}
            >
              Review Booking <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Fare Review & Booking Confirmation */}
      {currentStep === "review" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <InstantQuoteCard quote={quote} />

          {/* Pickup Summary Card */}
          <div
            className="glass-card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              borderRadius: "18px",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(240, 253, 244, 0.93) 100%), url('/uber-doorstep-pickup.jpg') right center/cover no-repeat",
              boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.05)",
            }}
          >
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--color-brand)",
              }}
            >
              Booking Summary
            </h4>

            {selectedAddress && (
              <div
                style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "13px" }}
              >
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    background: "rgba(56, 189, 248, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-brand)",
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={16} />
                </div>
                <div>
                  <strong style={{ color: "var(--text-primary)", fontSize: "14px" }}>{selectedAddress.addressLine1}</strong>
                  <div style={{ color: "#64748b", marginTop: "2px" }}>
                    {selectedAddress.city} • {selectedAddress.pincode}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px" }}>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                  background: "rgba(56, 189, 248, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-brand)",
                  flexShrink: 0,
                }}
              >
                <Calendar size={16} />
              </div>
              <div>
                <strong style={{ color: "var(--text-primary)", fontSize: "14px" }}>
                  {slot.type === "asap"
                    ? "ASAP (15-30 mins guaranteed arrival)"
                    : `${slot.date} (${slot.startTime} - ${slot.endTime})`}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setCurrentStep("slot"); setErrorMessage(null); }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              disabled={bookingMutation.isPending}
              className="btn btn-primary"
              onClick={() => bookingMutation.mutate()}
            >
              {bookingMutation.isPending ? "Connecting Nearby Partner..." : "Book & Find Nearby Partner"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4.5: Finding Nearby Partner Radar UI */}
      {currentStep === "finding" && createdBookingId && (
        <FindingPartnerView
          bookingId={createdBookingId}
          customerAddress={
            selectedAddress
              ? `${selectedAddress.addressLine1}, ${selectedAddress.city}`
              : urlAddress || "Your Doorstep"
          }
          totalRs={quote ? (quote.total / 100).toFixed(0) : "0"}
          onProceedToPayment={() => {
            setCurrentStep("payment");
          }}
        />
      )}

      {/* Step 5: Payment */}
      {currentStep === "payment" && createdBookingId && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <PaymentView
            bookingId={createdBookingId}
            totalPaise={quote?.total ?? 0}
            onPaymentSuccess={() => {
              navigate(`/tracking/${createdBookingId}`, { replace: true });
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              navigate(`/tracking/${createdBookingId}`, { replace: true });
            }}
            style={{ fontSize: "13px", color: "var(--color-brand)" }}
          >
            Track Nearby Partner on Live Map <ArrowRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
};
