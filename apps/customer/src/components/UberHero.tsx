import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Clock,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Check,
  Loader2,
  X,
  Building2,
} from "lucide-react";
import { INDIAN_CITIES, type IndianCity } from "./Header.js";
import {
  searchLocations,
  detectCurrentLocation,
  saveRecentLocation,
  INDIAN_LOCATIONS_DIRECTORY,
  type LocationItem,
} from "../services/locationService.js";

export interface HeroSlide {
  id: number;
  image: string;
  alt: string;
  caption: string;
}

const UBER_HERO_SLIDES: HeroSlide[] = [
  {
    id: 1,
    image: "/uber-collecting-garbage.jpg",
    alt: "Sanitary specialist in official SANITARY uniform collecting doorstep garbage bags and recycling box at residential apartment",
    caption: "Collecting Waste & Recyclables at Your Doorstep",
  },
  {
    id: 2,
    image: "/uber-doorstep-pickup.jpg",
    alt: "Sanitary partner in branded uniform at residential doorstep handover in Bangalore",
    caption: "Doorstep Collection in Under 15 Minutes",
  },
  {
    id: 3,
    image: "/uber-partner-van.jpg",
    alt: "Verified Sanitary specialist in branded polo uniform standing beside white electric cargo van with SANITARY logo",
    caption: "Official SANITARY Uniform & 100% Electric EV Van",
  },
  {
    id: 4,
    image: "/uber-fleet-dispatch.jpg",
    alt: "Sanitary specialist in branded uniform giving thumbs up with tablet beside branded EV fleet",
    caption: "Real-Time GPS Dispatch Across Indian Metros",
  },
];

export const UBER_WASTE_OPTIONS = [
  { slug: "small-bag", label: "Standard Household Bag", price: "₹49", icon: "🎒" },
  { slug: "medium", label: "Medium Declutter Sack", price: "₹99", icon: "📦" },
  { slug: "bulk-furniture", label: "Bulky Furniture & Items", price: "₹299", icon: "🛋️" },
  { slug: "garden-waste", label: "Garden & Green Sack", price: "₹79", icon: "🌿" },
  { slug: "e-waste", label: "E-Waste & Appliances", price: "₹149", icon: "💻" },
];

export const UberHero: React.FC = () => {
  const navigate = useNavigate();

  // Uber Card State
  const [selectedCity, setSelectedCity] = useState<IndianCity>(INDIAN_CITIES[0] as IndianCity);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [pickupTime, setPickupTime] = useState<"now" | "later">("now");
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [selectedItemSlug, setSelectedItemSlug] = useState("small-bag");

  // Location Dropdown & GPS Autocomplete State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locatingStatus, setLocatingStatus] = useState<string>("");
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Background Slider State (3-second auto-slide)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev + 1) % UBER_HERO_SLIDES.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 3000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  // Click outside to close location dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for locations based on input & selected city
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLocations(address, selectedCity.id);
        if (!isCancelled) {
          setSuggestions(results);
        }
      } catch {
        if (!isCancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 180);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [address, selectedCity.id]);

  // High-accuracy "Use current location" with reverse geocoding
  const handleDetectLocation = async () => {
    setLocating(true);
    setLocatingStatus("Acquiring GPS location...");
    try {
      const detected = await detectCurrentLocation();
      setLocatingStatus("Locating doorstep address...");
      const fullDisplay = detected.name.includes(detected.city)
        ? detected.name
        : `${detected.name}, ${detected.city}`;
      setAddress(fullDisplay);
      setSelectedLocation(detected);
      saveRecentLocation(detected);

      // Auto-switch selected city if detected in another metro
      const matchedCity = INDIAN_CITIES.find((c) => c.id === detected.cityId);
      if (matchedCity) {
        setSelectedCity(matchedCity);
      }

      setIsDropdownOpen(false);
    } catch (err: unknown) {
      console.warn("Geolocation fallback to city hub:", err);
      // Fallback: pick the primary hub for this city so address is immediately populated
      const cityHub =
        INDIAN_LOCATIONS_DIRECTORY.find((l) => l.cityId === selectedCity.id) ||
        INDIAN_LOCATIONS_DIRECTORY[0]!;
      const fullDisplay = `${cityHub.name}, ${cityHub.city}`;
      setAddress(fullDisplay);
      setSelectedLocation(cityHub);
      saveRecentLocation(cityHub);
      setIsDropdownOpen(false);
    } finally {
      setLocating(false);
      setLocatingStatus("");
    }
  };

  const handleSelectLocation = (item: LocationItem) => {
    const fullDisplay = item.name.includes(item.city) ? item.name : `${item.name}, ${item.city}`;
    setAddress(fullDisplay);
    setSelectedLocation(item);
    saveRecentLocation(item);

    // Auto-match city
    const matchedCity = INDIAN_CITIES.find((c) => c.id === item.cityId);
    if (matchedCity) {
      setSelectedCity(matchedCity);
    }

    setIsDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        handleSelectLocation(suggestions[activeSuggestionIndex]!);
      } else {
        handleSeePrices(e);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  const handleSeePrices = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAddress = address.trim() || `${selectedCity.name} Metro Area`;
    const cityHub =
      INDIAN_LOCATIONS_DIRECTORY.find((l) => l.cityId === selectedCity.id) ||
      INDIAN_LOCATIONS_DIRECTORY[0]!;
    const lat = selectedLocation?.lat ?? cityHub.lat;
    const lng = selectedLocation?.lng ?? cityHub.lng;
    const pincode = selectedLocation?.pincode ?? cityHub.pincode;

    navigate(
      `/book?city=${selectedCity.id}&address=${encodeURIComponent(finalAddress)}&lat=${lat}&lng=${lng}&pincode=${pincode}&item=${selectedItemSlug}`,
    );
  };

  const activeSlide = UBER_HERO_SLIDES[currentSlideIndex]!;

  return (
    <div
      className="uber-hero-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Expansive Transparent Background Image Slider (Bigger in size, occupies transparently) */}
      <div className="uber-hero-bg">
        <img
          key={activeSlide.image}
          src={activeSlide.image}
          alt={activeSlide.alt}
          className="uber-hero-bg-img"
        />

        {/* Floating Slide Counter Pill at bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "24px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(12px)",
            padding: "6px 14px",
            borderRadius: "9999px",
            zIndex: 15,
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          <Sparkles size={12} color="#10b981" />
          <span>{activeSlide.caption}</span>
          <span style={{ opacity: 0.5 }}>•</span>
          <span>
            {currentSlideIndex + 1}/{UBER_HERO_SLIDES.length}
          </span>
        </div>
      </div>

      {/* 2. Left Uber Booking Widget (Exact replica of Uber hero request widget) */}
      <div className="uber-booking-widget">
        {/* City Selector Pill: "📍 Bengaluru, IN Change city" */}
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            <MapPin size={15} color="var(--color-brand)" />
            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {selectedCity.name}, IN
            </span>
            <span
              style={{
                textDecoration: "underline",
                color: "var(--text-muted)",
                marginLeft: "2px",
              }}
            >
              Change city
            </span>
            <ChevronDown size={13} color="var(--text-muted)" />
          </button>

          {/* City Selection Popover */}
          {cityDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                width: "260px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-medium)",
                borderRadius: "16px",
                padding: "8px",
                boxShadow: "0 16px 36px rgba(0, 0, 0, 0.2)",
                zIndex: 50,
              }}
            >
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
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: selectedCity.id === c.id ? "rgba(5, 150, 105, 0.1)" : "transparent",
                    color: selectedCity.id === c.id ? "var(--color-brand)" : "var(--text-primary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{c.name}</span>
                  {selectedCity.id === c.id && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Highlighted Tag: "Book now and we will collect your wastes" */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            borderRadius: "9999px",
            background: "rgba(5, 150, 105, 0.1)",
            border: "1px solid rgba(5, 150, 105, 0.28)",
            color: "var(--color-brand)",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.02em",
            marginBottom: "16px",
            boxShadow: "0 2px 8px rgba(5, 150, 105, 0.08)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#059669",
              boxShadow: "0 0 8px #059669",
            }}
          />
          <span>Book now and we will collect your wastes</span>
        </div>

        {/* Uber Hero Heading: "Request a pickup" */}
        <h1
          style={{
            fontSize: "clamp(32px, 4vw, 42px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            marginBottom: "18px",
            color: "var(--text-primary)",
          }}
        >
          Request a pickup
        </h1>

        {/* Uber Time Selector Pill: "🕒 Pickup now ⌵" */}
        <div style={{ position: "relative", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => setTimeDropdownOpen(!timeDropdownOpen)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "9999px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.2s ease",
            }}
          >
            <Clock size={16} />
            <span>{pickupTime === "now" ? "Pickup now" : "Schedule for later"}</span>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {timeDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                width: "220px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-medium)",
                borderRadius: "14px",
                padding: "6px",
                boxShadow: "0 12px 30px rgba(0, 0, 0, 0.15)",
                zIndex: 50,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setPickupTime("now");
                  setTimeDropdownOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: pickupTime === "now" ? "rgba(5, 150, 105, 0.1)" : "transparent",
                  color: pickupTime === "now" ? "var(--color-brand)" : "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                ⚡ Pickup now (under 15 mins)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPickupTime("later");
                  setTimeDropdownOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: pickupTime === "later" ? "rgba(5, 150, 105, 0.1)" : "transparent",
                  color: pickupTime === "later" ? "var(--color-brand)" : "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                📅 Schedule for later
              </button>
            </div>
          )}
        </div>

        {/* Uber Connected Two-Input Module with vertical connecting line */}
        <form onSubmit={handleSeePrices}>
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            {/* The vertical connecting line */}
            <div className="uber-connector-line" />

            {/* Input 1: Pickup Location (with circle icon '◉', GPS locate '➤', and Autocomplete Dropdown) */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#0f172a",
                  zIndex: 3,
                }}
              />
              <input
                ref={inputRef}
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (!isDropdownOpen) setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Enter pickup address"
                className="uber-input-field"
                style={{ paddingRight: "76px" }}
              />

              {/* Action buttons inside input: Clear button (if text present) + GPS locate button */}
              <div
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  zIndex: 3,
                }}
              >
                {address.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddress("");
                      setSelectedLocation(null);
                      inputRef.current?.focus();
                    }}
                    title="Clear address"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                    }}
                  >
                    <X size={15} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDetectLocation}
                  title="Use current location via GPS"
                  disabled={locating}
                  style={{
                    background: locating ? "rgba(5, 150, 105, 0.15)" : "transparent",
                    border: "none",
                    color: locating ? "var(--color-brand)" : "var(--text-muted)",
                    cursor: "pointer",
                    padding: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                  }}
                >
                  {locating ? (
                    <Loader2 size={17} className="spin" />
                  ) : (
                    <Navigation size={17} style={{ transform: "rotate(45deg)" }} />
                  )}
                </button>
              </div>

              {/* Uber Location Dropdown List */}
              {isDropdownOpen && (
                <div ref={dropdownRef} className="uber-location-dropdown">
                  {/* 1. "Use Current Location" item at the very top */}
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={locating}
                    className="uber-location-item"
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      padding: "12px 16px",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "rgba(5, 150, 105, 0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--color-brand)",
                        flexShrink: 0,
                      }}
                    >
                      {locating ? (
                        <Loader2 size={18} className="spin" />
                      ) : (
                        <Navigation size={18} style={{ transform: "rotate(45deg)" }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "14px",
                          color: "var(--color-brand)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span>{locating ? (locatingStatus || "Detecting GPS location...") : "Use current location"}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        Instant GPS doorstep pickup address
                      </div>
                    </div>
                    <span className="badge badge-emerald" style={{ fontSize: "10px", padding: "2px 8px" }}>
                      GPS Live
                    </span>
                  </button>

                  {/* 2. Suggestions section header */}
                  <div
                    style={{
                      padding: "10px 16px 4px",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{address.trim() ? "Search Results" : `Popular in ${selectedCity.name}`}</span>
                    {isSearching && (
                      <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--color-brand)" }}>
                        Searching...
                      </span>
                    )}
                  </div>

                  {/* 3. Suggestions list */}
                  <div style={{ overflowY: "auto", flex: 1, maxHeight: "280px" }}>
                    {suggestions.length === 0 && !isSearching ? (
                      address.trim() ? (
                        <button
                          type="button"
                          onClick={() => {
                            const cityHub =
                              INDIAN_LOCATIONS_DIRECTORY.find((l) => l.cityId === selectedCity.id) ||
                              INDIAN_LOCATIONS_DIRECTORY[0]!;
                            handleSelectLocation({
                              id: `custom-${Date.now()}`,
                              name: address.trim(),
                              subtitle: `Doorstep Pickup in ${selectedCity.name}`,
                              city: selectedCity.name,
                              cityId: selectedCity.id,
                              state: selectedCity.state,
                              pincode: cityHub.pincode,
                              lat: cityHub.lat,
                              lng: cityHub.lng,
                              category: "live",
                            });
                          }}
                          className="uber-location-item"
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              background: "rgba(5, 150, 105, 0.12)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--color-brand)",
                              flexShrink: 0,
                            }}
                          >
                            <MapPin size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "13px",
                                color: "var(--color-brand)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              Pick up from "{address.trim()}"
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                              Use as custom doorstep pickup address in {selectedCity.name}
                            </div>
                          </div>
                        </button>
                      ) : (
                        <div
                          style={{
                            padding: "24px 16px",
                            textAlign: "center",
                            color: "var(--text-secondary)",
                            fontSize: "13px",
                          }}
                        >
                          No matching Indian locality found.
                          <div style={{ fontSize: "12px", marginTop: "4px", color: "var(--text-muted)" }}>
                            Try searching by area, apartment or landmark.
                          </div>
                        </div>
                      )
                    ) : (
                      suggestions.map((item, idx) => {
                        const isActive = idx === activeSuggestionIndex;
                        const isCustom = item.id.startsWith("custom-");
                        return (
                          <button
                            key={item.id + idx}
                            type="button"
                            onClick={() => handleSelectLocation(item)}
                            className={`uber-location-item ${isActive ? "active-item" : ""}`}
                            style={{ padding: "10px 16px" }}
                          >
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: isCustom
                                  ? "rgba(5, 150, 105, 0.14)"
                                  : item.isRecent
                                    ? "rgba(245, 158, 11, 0.12)"
                                    : "rgba(15, 23, 42, 0.06)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: isCustom
                                  ? "var(--color-brand)"
                                  : item.isRecent
                                    ? "#f59e0b"
                                    : "var(--text-secondary)",
                                flexShrink: 0,
                              }}
                            >
                              {isCustom ? (
                                <Navigation size={16} style={{ transform: "rotate(45deg)" }} />
                              ) : item.isRecent ? (
                                <Clock size={16} />
                              ) : item.category === "tech" ? (
                                <Building2 size={16} />
                              ) : (
                                <MapPin size={16} />
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: "13px",
                                  color: isCustom ? "var(--color-brand)" : "var(--text-primary)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {isCustom ? `Use: "${item.name}"` : item.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-secondary)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {item.subtitle} • {item.city} {item.pincode ? `(${item.pincode})` : ""}
                              </div>
                            </div>
                            {isCustom ? (
                              <span
                                className="badge badge-emerald"
                                style={{ fontSize: "10px", padding: "2px 6px" }}
                              >
                                Direct
                              </span>
                            ) : item.isRecent ? (
                              <span
                                className="badge"
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  background: "rgba(245, 158, 11, 0.12)",
                                  color: "#b45309",
                                }}
                              >
                                Recent
                              </span>
                            ) : item.category && item.category !== "live" ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  textTransform: "capitalize",
                                  color: "var(--text-muted)",
                                  background: "rgba(15, 23, 42, 0.05)",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  flexShrink: 0,
                                }}
                              >
                                {item.category}
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Input 2: Waste Type / Bag Plan (with square icon '■') */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  background: "#0f172a",
                  zIndex: 3,
                }}
              />
              <select
                value={selectedItemSlug}
                onChange={(e) => setSelectedItemSlug(e.target.value)}
                className="uber-input-field"
                style={{
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                  paddingRight: "36px",
                }}
              >
                {UBER_WASTE_OPTIONS.map((opt) => (
                  <option key={opt.slug} value={opt.slug}>
                    {opt.icon} {opt.label} — {opt.price}
                  </option>
                ))}
              </select>
              <div
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "var(--text-muted)",
                }}
              >
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {/* Solid Black Button: "See prices" (Uber Style) */}
          <button type="submit" className="uber-btn-black">
            <span>See prices</span>
            <ArrowRight size={17} />
          </button>
        </form>

        {/* Uber Trust Footnote */}
        <div
          style={{
            marginTop: "16px",
            fontSize: "12px",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ color: "var(--color-brand)", fontWeight: 700 }}>⚡</span>
          <span>Verified Sanitary partner in electric EV arrives in under 15 mins</span>
        </div>
      </div>
    </div>
  );
};
