import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from "lucide-react";
import { SanitaryLogo, SanitaryMark } from "./SanitaryLogo.js";

export interface HeroSlide {
  id: number;
  image: string;
  alt: string;
  tag: string;
  title: string;
  description: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 1,
    image: "/simple-customer-phone.jpg",
    alt: "Smiling Indian resident scheduling doorstep waste pickup simply on her smartphone",
    tag: "Simple Flat Pricing • From ₹49",
    title: "Zero Guesswork Pickup",
    description: "Choose bags or snap a photo. Uniformed partners arrive in under 15 minutes.",
  },
  {
    id: 2,
    image: "/simple-sanitary-partner.jpg",
    alt: "Verified Sanitary specialist in uniform smiling warmly at apartment doorstep",
    tag: "Verified Partner • In Uniform",
    title: "Verified Doorstep Service",
    description:
      "Verified Sanitary partners arrive at your door. No weighing scales or math needed.",
  },
  {
    id: 3,
    image: "/simple-ev-doorstep.jpg",
    alt: "Friendly Sanitary partner walking to doorstep beside clean electric zero-emission EV van",
    tag: "Under 15 Mins • 100% EV",
    title: "Zero-Emission Electric Fleet",
    description:
      "Rapid electric vehicle dispatch across Bangalore, Mumbai, Delhi-NCR, and major metros.",
  },
];

// Flat Rate Options for the Reference-Inspired Floating Card
const FLOATING_OPTIONS = [
  { icon: "📱", label: "Instant UPI Pay", price: "Fast", sub: "GPay, PhonePe, Paytm" },
  { icon: "🎒", label: "Standard Bag", price: "₹49", sub: "Domestic kitchen bin" },
  { icon: "📦", label: "Medium Declutter", price: "₹99", sub: "Cartons & mixed waste" },
  { icon: "💵", label: "Cash on Pickup", price: "₹0 Fee", sub: "Pay partner at doorstep" },
];

// Mini weekly volume data for the reference chart card (Mon - Fri)
const WEEKLY_CHART = [
  { day: "Mon", height: "48%" },
  { day: "Tue", height: "82%" },
  { day: "Wed", height: "64%" },
  { day: "Thu", height: "92%" },
  { day: "Fri", height: "70%" },
];

export const HeroProcessSlider: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // Parallax Tilt state
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const SLIDE_DURATION = 3000; // Exact 3-second auto-slide as requested
  const PROGRESS_TICK = 50;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    setProgress(0);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
    setProgress(0);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setProgress(0);
  };

  // 3-second auto-play timer with smooth progress bar
  useEffect(() => {
    if (isPaused) return;

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextSlide();
          return 0;
        }
        return prev + (PROGRESS_TICK / SLIDE_DURATION) * 100;
      });
    }, PROGRESS_TICK);

    return () => {
      clearInterval(progressInterval);
    };
  }, [isPaused, nextSlide]);

  // Subtle 3D parallax tilt on mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = ((y - centerY) / centerY) * -3; // max 3 deg
    const tiltY = ((x - centerX) / centerX) * 3;

    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsPaused(false);
  };

  const activeSlide = HERO_SLIDES[currentIndex]!;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        perspective: "1200px",
        width: "100%",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Decorative Halftone Dot Cluster - Top Right (Matching Reference Page) */}
      <div
        className="hero-dot-grid"
        style={{
          position: "absolute",
          top: "-24px",
          right: "-20px",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Decorative Floating Ring (Matching Reference Page) */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          right: "-32px",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          border: "2px solid rgba(244, 63, 94, 0.35)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Decorative Soft Floating Upward Arrows (Matching Reference Page) */}
      <div
        style={{
          position: "absolute",
          top: "6%",
          left: "22%",
          fontSize: "36px",
          color: "rgba(244, 63, 94, 0.28)",
          fontWeight: 300,
          pointerEvents: "none",
          zIndex: 1,
          userSelect: "none",
        }}
      >
        ↑
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "18%",
          left: "-18px",
          fontSize: "42px",
          color: "rgba(244, 63, 94, 0.25)",
          fontWeight: 300,
          pointerEvents: "none",
          zIndex: 1,
          userSelect: "none",
        }}
      >
        ↑
      </div>

      {/* Ambient Warm Blush / Peach Lighting Glow Behind Image */}
      <div
        style={{
          position: "absolute",
          top: "5%",
          right: "5%",
          width: "420px",
          height: "420px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(254, 205, 211, 0.45) 0%, rgba(254, 242, 242, 0.25) 50%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      {/* Main Expansive Pixar & Reference Hero Slider Container */}
      <div
        style={{
          position: "relative",
          borderRadius: "28px",
          overflow: "hidden",
          background: "#ffffff",
          border: "1px solid rgba(226, 232, 240, 0.8)",
          boxShadow: "0 24px 64px -12px rgba(15, 23, 42, 0.12), 0 0 30px rgba(244, 63, 94, 0.06)",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: "transform 0.15s cubic-bezier(0.2, 0, 0, 1)",
          zIndex: 2,
        }}
      >
        {/* Top 3-Second Progress Bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "rgba(0, 0, 0, 0.06)",
            zIndex: 30,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #852d2d 0%, #059669 100%)",
              transition: isPaused ? "none" : "width 0.05s linear",
            }}
          />
        </div>

        {/* Big Expansive Visual Viewport (540px Height on Desktop) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "540px",
            background: "linear-gradient(180deg, #fafaf9 0%, #ffffff 100%)",
            overflow: "hidden",
          }}
        >
          {/* Main Clean Photorealistic Image */}
          <img
            key={activeSlide.image}
            src={activeSlide.image}
            alt={activeSlide.alt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 20%",
              display: "block",
              animation: "kenBurnsZoom 3s ease-out forwards",
            }}
          />

          {/* Top Clean Brand Watermark & Slide Counter */}
          <div
            style={{
              position: "absolute",
              top: "18px",
              left: "18px",
              right: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 20,
            }}
          >
            {/* Branded Pill Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.94)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(226, 232, 240, 0.9)",
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
              }}
            >
              <SanitaryMark size={16} color="#852d2d" />
              <SanitaryLogo variant="full" size={17} color="#0f172a" />
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#059669",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  paddingLeft: "6px",
                  borderLeft: "1px solid rgba(0, 0, 0, 0.1)",
                }}
              >
                Zero Guesswork
              </span>
            </div>

            {/* Auto-Slide Indicator Pill */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.92)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(226, 232, 240, 0.9)",
                padding: "6px 12px",
                borderRadius: "var(--radius-full)",
                color: "#0f172a",
                fontSize: "11px",
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
              }}
            >
              <Sparkles size={12} color="#852d2d" />
              <span>3s Auto Slide • {currentIndex + 1}/3</span>
            </div>
          </div>

          {/* Previous / Next Slide Chevron Arrows */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous Slide"
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 25,
              transition: "all 0.2s ease",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.1)",
            }}
          >
            <ChevronLeft size={22} />
          </button>

          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next Slide"
            style={{
              position: "absolute",
              right: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 25,
              transition: "all 0.2s ease",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.1)",
            }}
          >
            <ChevronRight size={22} />
          </button>

          {/* FLOATING CARD 1: Exact Match to Reference 'Select Payment Option' Card (Bottom Right) */}
          <div
            className="hero-floating-card"
            style={{
              position: "absolute",
              bottom: "20px",
              right: "20px",
              width: "275px",
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              borderRadius: "20px",
              padding: "16px 18px",
              boxShadow: "0 20px 48px -8px rgba(15, 23, 42, 0.2), 0 0 1px rgba(0, 0, 0, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.9)",
              zIndex: 20,
              color: "#0f172a",
            }}
          >
            {/* Header: Logo & Starting Flat Rate */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
                borderBottom: "1px solid #f1f5f9",
                paddingBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <SanitaryMark size={14} color="#852d2d" />
                <SanitaryLogo variant="full" size={15} color="#0f172a" />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#059669",
                  background: "rgba(5, 150, 105, 0.1)",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                }}
              >
                ₹49 FLAT
              </span>
            </div>

            <div
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "#64748b",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              SELECT PAYMENT / PICKUP OPTION
            </div>

            {/* List with Chevron Right Matching Reference Screenshot */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {FLOATING_OPTIONS.map((opt) => (
                <Link
                  key={opt.label}
                  to="/book"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: "#0f172a",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px" }}>{opt.icon}</span>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700 }}>{opt.label}</div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>{opt.sub}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#852d2d" }}>
                      {opt.price}
                    </span>
                    <ChevronRight size={13} color="#94a3b8" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Big Terracotta / Crimson Pill Button: Matching 'Pay Now' Button in Reference */}
            <Link
              to="/book"
              className="btn"
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "11px 16px",
                background: "#852d2d",
                color: "#ffffff",
                borderRadius: "9999px",
                fontSize: "13px",
                fontWeight: 800,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 6px 18px rgba(133, 45, 45, 0.35)",
                border: "none",
              }}
            >
              <span>Schedule Pickup Now</span>
              <ArrowRight size={15} />
            </Link>

            <div
              style={{
                fontSize: "9px",
                color: "#64748b",
                textAlign: "center",
                marginTop: "6px",
                fontWeight: 600,
              }}
            >
              No weighing scales needed • Verified partner in 15 mins
            </div>
          </div>

          {/* FLOATING CARD 2: Exact Match to Reference Analytics Bar Chart Card (Bottom Left) */}
          <div
            className="hero-floating-stat"
            style={{
              position: "absolute",
              bottom: "20px",
              left: "20px",
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(18px)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              borderRadius: "18px",
              padding: "14px 16px",
              color: "#0f172a",
              zIndex: 20,
              width: "210px",
              boxShadow: "0 18px 40px -8px rgba(15, 23, 42, 0.16), 0 0 1px rgba(0, 0, 0, 0.12)",
            }}
          >
            {/* Mini Bar Chart Matching Reference */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                height: "44px",
                paddingBottom: "4px",
                borderBottom: "1px solid #f1f5f9",
                marginBottom: "10px",
              }}
            >
              {WEEKLY_CHART.map((b) => (
                <div
                  key={b.day}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: b.height,
                      borderRadius: "4px",
                      background: b.day === "Thu" ? "#852d2d" : "#fca5a5",
                    }}
                  />
                  <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 600 }}>
                    {b.day}
                  </span>
                </div>
              ))}
            </div>

            {/* Recent Doorstep Completed Dispatches */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "#059669",
                      color: "#ffffff",
                      fontSize: "9px",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    BL
                  </div>
                  <span style={{ fontWeight: 600, color: "#334155" }}>Bengaluru</span>
                </div>
                <span style={{ fontWeight: 800, color: "#059669" }}>₹49.00</span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "#852d2d",
                      color: "#ffffff",
                      fontSize: "9px",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    MU
                  </div>
                  <span style={{ fontWeight: 600, color: "#334155" }}>Mumbai</span>
                </div>
                <span style={{ fontWeight: 800, color: "#852d2d" }}>₹49.00</span>
              </div>
            </div>
          </div>

          {/* Bottom Slide Dots Indicator */}
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              zIndex: 25,
            }}
          >
            {HERO_SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                style={{
                  width: idx === currentIndex ? "24px" : "8px",
                  height: "7px",
                  borderRadius: "var(--radius-full)",
                  background: idx === currentIndex ? "#852d2d" : "rgba(15, 23, 42, 0.2)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  padding: 0,
                  boxShadow: idx === currentIndex ? "0 0 6px rgba(133, 45, 45, 0.4)" : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
