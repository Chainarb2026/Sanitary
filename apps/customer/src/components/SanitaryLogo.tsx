import React from "react";

interface SanitaryLogoProps {
  /**
   * "full" = Wordmark S [▲] N I T [▲] R Y
   * "mark" = Standalone geometric stencil symbol
   */
  variant?: "full" | "mark";
  /** Size in pixels (height for full wordmark, width/height for mark) */
  size?: number;
  /** Fill color for the letters and mark. Defaults to currentColor */
  color?: string;
  /** Optional secondary accent color */
  accentColor?: string;
  className?: string;
}

/**
 * Geometric Stencil "A" Mark (from user reference image).
 * Composed of a sharp right-leaning architectural wedge + parallel slanted pillar.
 */
export const SanitaryMark: React.FC<{
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ size = 28, color = "currentColor", className = "", style }) => {
  return (
    <svg
      width={size * 0.85}
      height={size}
      viewBox="0 0 28 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      aria-label="Sanitary Symbol"
    >
      {/* Left Architectural Wedge / Spire */}
      <path d="M1 32L15 2L17.2 32H1Z" fill={color} />
      {/* Right Parallel Slanted Pillar */}
      <path d="M19.8 9H23.4L27 32H23.2L19.8 9Z" fill={color} />
    </svg>
  );
};

/**
 * Official Sanitary Brand Logo:
 * Implements S [▲] N I T [▲] R Y with double stencil 'A's,
 * bold geometric typography, wide tracking, and precision kerning.
 */
export const SanitaryLogo: React.FC<SanitaryLogoProps> = ({
  variant = "full",
  size = 28,
  color = "currentColor",
  className = "",
}) => {
  if (variant === "mark") {
    return <SanitaryMark size={size} color={color} className={className} />;
  }

  // Full Wordmark: S [▲] N I T [▲] R Y
  const markHeight = size;
  const markWidth = Math.round(size * 0.82);

  return (
    <span
      className={`sanitary-brand-logo ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        color,
        fontWeight: 900,
        fontFamily: "var(--font-display)",
        letterSpacing: "0.08em",
        fontSize: `${size * 0.82}px`,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      <span>S</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          margin: "0 2px",
          transform: "translateY(-1px)",
        }}
      >
        <svg
          width={markWidth}
          height={markHeight}
          viewBox="0 0 28 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M1 32L15 2L17.2 32H1Z" fill={color} />
          <path d="M19.8 9H23.4L27 32H23.2L19.8 9Z" fill={color} />
        </svg>
      </span>
      <span>N</span>
      <span>I</span>
      <span>T</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          margin: "0 2px",
          transform: "translateY(-1px)",
        }}
      >
        <svg
          width={markWidth}
          height={markHeight}
          viewBox="0 0 28 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M1 32L15 2L17.2 32H1Z" fill={color} />
          <path d="M19.8 9H23.4L27 32H23.2L19.8 9Z" fill={color} />
        </svg>
      </span>
      <span>R</span>
      <span>Y</span>
    </span>
  );
};
