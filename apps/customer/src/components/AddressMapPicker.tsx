import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Navigation, Plus, Check, Home, Briefcase, Bookmark } from "lucide-react";
import {
  type Address,
  type CreateAddressInput,
  getAddresses,
  createAddress,
} from "../api/addresses.js";
import { detectCurrentLocation } from "../services/locationService.js";

const BENGALURU_HUBS = [
  { name: "Electronic City", lat: 12.8526, lng: 77.6704, pincode: "560100" },
  { name: "Indiranagar", lat: 12.9784, lng: 77.6408, pincode: "560038" },
  { name: "Koramangala", lat: 12.9352, lng: 77.6245, pincode: "560034" },
  { name: "HSR Layout", lat: 12.9121, lng: 77.6446, pincode: "560102" },
  { name: "Whitefield", lat: 12.9698, lng: 77.75, pincode: "560066" },
  { name: "Jayanagar", lat: 12.925, lng: 77.5938, pincode: "560041" },
];

export interface AddressMapPickerProps {
  selectedAddressId: string | null;
  onSelectAddress: (address: Address) => void;
  initialLocation?: {
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    pincode?: string | null;
    city?: string | null;
  };
}

export const AddressMapPicker: React.FC<AddressMapPickerProps> = ({
  selectedAddressId,
  onSelectAddress,
  initialLocation,
}) => {
  const queryClient = useQueryClient();
  const [showAddNew, setShowAddNew] = useState<boolean>(false);

  // Form State initialized from initialLocation if provided
  const [addressLine1, setAddressLine1] = useState<string>(
    () => initialLocation?.address || "",
  );
  const [addressLine2, setAddressLine2] = useState<string>("");
  const [city] = useState<string>(() => initialLocation?.city || "Bengaluru");
  const [state] = useState<string>("Karnataka");
  const [pincode, setPincode] = useState<string>(
    () => initialLocation?.pincode || "560100",
  );
  const [lat, setLat] = useState<number>(() => initialLocation?.lat || 12.8526);
  const [lng, setLng] = useState<number>(() => initialLocation?.lng || 77.6704);
  const [label, setLabel] = useState<"home" | "work" | "other">("home");
  const [geoLocating, setGeoLocating] = useState<boolean>(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  // Sync state if initialLocation changes (e.g. navigation query params)
  useEffect(() => {
    if (initialLocation?.address && !addressLine1) {
      setAddressLine1(initialLocation.address);
    }
    if (initialLocation?.lat && (!lat || lat === 12.9784 || lat === 12.8526)) {
      setLat(initialLocation.lat);
    }
    if (initialLocation?.lng && (!lng || lng === 77.6408 || lng === 77.6704)) {
      setLng(initialLocation.lng);
    }
    if (initialLocation?.pincode && (pincode === "560038" || pincode === "560100")) {
      setPincode(initialLocation.pincode);
    }
  }, [initialLocation]);

  // Fetch saved addresses
  const { data } = useQuery({
    queryKey: ["addresses"],
    queryFn: getAddresses,
  });

  const savedAddresses = data?.addresses || [];

  // Automatically select default or first address if none selected
  useEffect(() => {
    if (!selectedAddressId && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
      if (defaultAddr) {
        onSelectAddress(defaultAddr);
      }
    }
  }, [savedAddresses, selectedAddressId, onSelectAddress]);

  const createMutation = useMutation({
    mutationFn: (newAddr: CreateAddressInput) => createAddress(newAddr),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["addresses"] });
      onSelectAddress(created);
      setShowAddNew(false);
      // Reset form
      setAddressLine1("");
      setAddressLine2("");
    },
  });

  const handleUseCurrentLocation = useCallback(async () => {
    setGeoLocating(true);
    setLocationNotice(null);
    try {
      const loc = await detectCurrentLocation();
      setLat(loc.lat);
      setLng(loc.lng);
      setAddressLine1(loc.name);
      if (loc.subtitle) {
        setAddressLine2(loc.subtitle);
      }
      setPincode(loc.pincode);
      setLocationNotice("📍 GPS location acquired successfully!");
      setTimeout(() => setLocationNotice(null), 3500);
    } catch (err: unknown) {
      const errorObj = err as { code?: number; message?: string };
      if (errorObj?.code === 1) {
        setLocationNotice(
          "Location permission blocked in browser. Nearest Bengaluru sector hub selected. You can drag or pick an area below.",
        );
      } else {
        setLocationNotice(
          "Device GPS unavailable or timed out. Placed pin at nearest sector hub.",
        );
      }
      // Resilient fallback to nearest hub instead of crashing
      const fallback = BENGALURU_HUBS[0];
      if (fallback) {
        setLat(fallback.lat);
        setLng(fallback.lng);
        setPincode(fallback.pincode);
        if (!addressLine1) {
          setAddressLine1(`${fallback.name}, Bengaluru`);
        }
      }
    } finally {
      setGeoLocating(false);
    }
  }, [addressLine1]);

  const handleHubSelect = (hub: (typeof BENGALURU_HUBS)[0]) => {
    setLat(hub.lat);
    setLng(hub.lng);
    setPincode(hub.pincode);
    if (!addressLine1) {
      setAddressLine1(`${hub.name}, Bengaluru`);
    }
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLine1 || !pincode) return;

    createMutation.mutate({
      addressLine1,
      addressLine2: addressLine2 || undefined,
      city,
      state,
      pincode,
      latitude: lat,
      longitude: lng,
      label,
      isDefault: savedAddresses.length === 0,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Existing Saved Addresses */}
      {savedAddresses.length > 0 && !showAddNew && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="input-label">Select Pickup Address</span>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: "4px 10px", fontSize: "12px" }}
              onClick={() => setShowAddNew(true)}
            >
              <Plus size={14} /> Add New
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {savedAddresses.map((addr) => {
              const isSelected = selectedAddressId === addr._id;
              return (
                <div
                  key={addr._id}
                  className={`glass-card glass-card-interactive ${isSelected ? "selected-card" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                    padding: "16px",
                    borderRadius: "16px",
                    border: isSelected ? "2px solid #059669" : "1px solid #e2e8f0",
                    background: isSelected
                      ? "linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)"
                      : "#ffffff",
                    boxShadow: isSelected
                      ? "0 4px 14px rgba(5, 150, 105, 0.12)"
                      : "0 2px 6px rgba(15, 23, 42, 0.03)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => onSelectAddress(addr)}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: isSelected
                        ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                        : "#f8fafc",
                      border: isSelected ? "1px solid #059669" : "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isSelected ? "#ffffff" : "#059669",
                      flexShrink: 0,
                      boxShadow: isSelected ? "0 2px 6px rgba(5, 150, 105, 0.25)" : "none",
                    }}
                  >
                    {addr.label === "home" ? (
                      <Home size={18} />
                    ) : addr.label === "work" ? (
                      <Briefcase size={18} />
                    ) : (
                      <Bookmark size={18} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{ fontWeight: 800, fontSize: "14px", textTransform: "capitalize", color: "#0f172a" }}
                      >
                        {addr.label}
                      </span>
                      {addr.isDefault && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: "#ecfdf5",
                            color: "#059669",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#475569",
                        marginTop: "2px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {addr.addressLine1}
                      {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      {addr.city} • {addr.pincode}
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                      }}
                    >
                      <Check size={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add New Address Form with Interactive Map Visualizer */}
      {(showAddNew || savedAddresses.length === 0) && (
        <form
          onSubmit={handleSaveAddress}
          className="glass-card"
          style={{
            padding: "20px",
            borderRadius: "18px",
            border: "1px solid rgba(5, 150, 105, 0.22)",
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 253, 250, 0.94) 100%), url('/uber-fleet-dispatch.jpg') right bottom/cover no-repeat",
            boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Pin Pickup Location</h3>
            {savedAddresses.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "8px" }}
                onClick={() => setShowAddNew(false)}
              >
                Cancel
              </button>
            )}
          </div>

          {/* Gentle Inline Location Notice (No intrusive alert modals) */}
          {locationNotice && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "10px",
                background: locationNotice.includes("successfully")
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(245, 158, 11, 0.12)",
                border: locationNotice.includes("successfully")
                  ? "1px solid #10b981"
                  : "1px solid #f59e0b",
                color: locationNotice.includes("successfully") ? "#065f46" : "#92400e",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "12px",
                animation: "fadeIn 0.2s ease-in-out",
              }}
            >
              <span>{locationNotice}</span>
              <button
                type="button"
                onClick={() => setLocationNotice(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  fontSize: "16px",
                  lineHeight: "1",
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Prefilled Location Badge */}
          {initialLocation?.address && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(5, 150, 105, 0.08)",
                border: "1px solid rgba(5, 150, 105, 0.2)",
                color: "#065f46",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              <MapPin size={14} color="#059669" />
              <span>Location set from search: <strong>{initialLocation.address}</strong></span>
            </div>
          )}

          {/* Interactive Map Visualizer Box */}
          <div
            style={{
              height: "160px",
              background: "linear-gradient(135deg, #042f2e 0%, #064e3b 100%)",
              borderRadius: "14px",
              position: "relative",
              overflow: "hidden",
              border: "1px solid rgba(5, 150, 105, 0.35)",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.25)",
            }}
          >
            {/* Ambient Map Grid Simulation */}
            <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.25 }}>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#34d399" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Radar Pulsing Waves */}
            <div
              style={{
                position: "absolute",
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(52, 211, 153, 0.35) 0%, transparent 70%)",
                animation: "pulse 2s infinite ease-out",
              }}
            />

            {/* Central Pin */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  borderRadius: "50%",
                  padding: "8px",
                  boxShadow: "0 0 20px rgba(52, 211, 153, 0.8)",
                  color: "#ffffff",
                }}
              >
                <MapPin size={22} />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#064e3b",
                  background: "rgba(255, 255, 255, 0.95)",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  marginTop: "6px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }}
              >
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            </div>

            {/* Locate Me Button Overlay */}
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={geoLocating}
              style={{
                position: "absolute",
                bottom: "10px",
                right: "10px",
                background: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #a7f3d0",
                borderRadius: "8px",
                color: "#065f46",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
                zIndex: 5,
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              <Navigation size={13} color="#059669" />
              <span>{geoLocating ? "Locating..." : "Locate Me"}</span>
            </button>
          </div>

          {/* Quick Hub Selector */}
          <div style={{ marginBottom: "14px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#475569",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Quick Select Sector Hub:
            </span>
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
              {BENGALURU_HUBS.map((hub) => {
                const isActive = Math.abs(lat - hub.lat) < 0.001;
                return (
                  <button
                    type="button"
                    key={hub.name}
                    onClick={() => handleHubSelect(hub)}
                    style={{
                      background: isActive
                        ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                        : "#ffffff",
                      color: isActive ? "#ffffff" : "#0f172a",
                      border: isActive ? "1px solid #059669" : "1px solid #cbd5e1",
                      borderRadius: "9999px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: isActive ? "0 2px 6px rgba(5, 150, 105, 0.25)" : "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    {hub.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Address Inputs */}
          <div className="input-group">
            <label className="input-label">Address Line 1 (House/Flat, Street)</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. #42, 5th Main, 100ft Road"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Apartment / Landmark (Optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Green Meadows Society"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="input-group">
              <label className="input-label">PIN Code</label>
              <input
                type="text"
                required
                maxLength={6}
                className="input-field"
                placeholder="560038"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">City</label>
              <input type="text" disabled className="input-field" value={city} />
            </div>
          </div>

          {/* Label Selector */}
          <div style={{ marginBottom: "16px" }}>
            <label className="input-label" style={{ display: "block", marginBottom: "6px" }}>
              Save As
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              {(["home", "work", "other"] as const).map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setLabel(l)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "var(--radius-md)",
                    border:
                      label === l
                        ? "1px solid var(--color-teal)"
                        : "1px solid var(--border-subtle)",
                    background: label === l ? "rgba(20, 184, 166, 0.15)" : "transparent",
                    color: label === l ? "var(--color-teal)" : "var(--text-secondary)",
                    fontWeight: 600,
                    fontSize: "13px",
                    textTransform: "capitalize",
                    cursor: "pointer",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending || !addressLine1 || !pincode}
            className="btn btn-primary btn-block"
          >
            {createMutation.isPending ? "Saving Address..." : "Confirm & Use Address"}
          </button>
        </form>
      )}
    </div>
  );
};
