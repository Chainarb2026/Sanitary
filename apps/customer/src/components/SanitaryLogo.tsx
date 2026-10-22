import React, { useId } from "react";

export interface SanitaryLogoProps {
  /**
   * "full" = Complete Wordmark with Option 5 S + A N I T A R Y
   * "mark" = Standalone S Emblem
   */
  variant?: "full" | "mark";
  /** Size in pixels (height for full wordmark, width/height for mark) */
  size?: number;
  /** Fill color for letters and structural elements. Defaults to currentColor */
  color?: string;
  /** Accent color for cleaning gleams and kinetic vortex bridges. Defaults to cyber-cyan #38BDF8 */
  accentColor?: string;
  /** Whether to render the 'DOORSTEP RECYCLING' subtitle under the wordmark */
  showSubtitle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Option 5: SpaceX Thrust & Fin "S" Emblem
 * Standard 38x38 bounding coordinate system.
 */
export const Option5Glyph: React.FC<{
  finGradId: string;
  thrustGradId: string;
  gleamGradId: string;
  color?: string;
  isCustomColor?: boolean;
}> = ({ finGradId, thrustGradId, gleamGradId, color, isCustomColor = false }) => {
  return (
    <g>
      {/* 1. Top Winglet Bar with 45° Aerospace Chamfers */}
      <path d="M1 6L7 0.5H34L29 6.5H8L1 6Z" fill={`url(#${finGradId})`} />

      {/* 2. Upper Vertical Aero-Spine */}
      <path d="M1 6V17L9 21.5V11L4 6H1Z" fill={`url(#${finGradId})`} />

      {/* 3. Kinetic Central Thrust Crossing (Slanted Speed Slit) */}
      <path
        d="M3 17.5L34 17.5L28 24.5L1 24.5L3 17.5Z"
        fill={isCustomColor ? color : `url(#${thrustGradId})`}
        opacity={isCustomColor ? 0.9 : 1}
      />

      {/* 4. Lower Vertical Aero-Spine */}
      <path d="M34 21V32L26 36.5V26.5L31 21H34Z" fill={`url(#${finGradId})`} />

      {/* 5. Bottom Winglet Bar with 45° Chamfers */}
      <path d="M34 32L28 37.5H1L6 31.5H27L34 32Z" fill={`url(#${finGradId})`} />

      {/* 6. Four-Point Diamond Cleaning Gleam Beacon */}
      <path
        d="M31 1.5C31 4 33.5 4 33.5 4C33.5 4 31 4 31 6.5C31 4 28.5 4 28.5 4C28.5 4 31 4 31 1.5Z"
        fill={`url(#${gleamGradId})`}
      />
    </g>
  );
};

/**
 * Standalone Sanitary Emblem (Option 5 S Mark)
 * Aerospace Cyber-Cyan Palette: #38BDF8 -> #0284C7
 */
export const SanitaryMark: React.FC<{
  size?: number;
  color?: string;
  accentColor?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({
  size = 32,
  color = "currentColor",
  accentColor = "#38bdf8",
  className = "",
  style,
}) => {
  const uniqueId = useId();
  const finGradId = `sn-mark-fin-${uniqueId}`;
  const thrustGradId = `sn-mark-thrust-${uniqueId}`;
  const gleamGradId = `sn-mark-gleam-${uniqueId}`;

  const isCustomColor = color !== "currentColor";
  const primaryFinColor = isCustomColor ? color : "#38bdf8";
  const secondaryFinColor = isCustomColor ? color : "#0284c7";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 38 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`sanitary-aero-mark ${className}`}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
      aria-label="Sanitary SpaceX Cyber-Cyan Symbol"
    >
      <defs>
        {/* SpaceX Cyber-Cyan Aero Fin Gradient */}
        <linearGradient id={finGradId} x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={primaryFinColor} />
          <stop offset="100%" stopColor={secondaryFinColor} />
        </linearGradient>
        {/* Central Kinetic Velocity Slit Gradient */}
        <linearGradient id={thrustGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor={accentColor} />
        </linearGradient>
        {/* Cleaning Diamond Gleam Gradient */}
        <linearGradient id={gleamGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      <Option5Glyph
        finGradId={finGradId}
        thrustGradId={thrustGradId}
        gleamGradId={gleamGradId}
        color={color}
        isCustomColor={isCustomColor}
      />
    </svg>
  );
};

/**
 * Official Sanitary Brand Logo:
 * Implements Option 5 ("SpaceX Thrust & Fin" S) with mathematically flushed baseline (y=28)
 * and cap-height (y=4) optical alignment, paired with Pixar x SpaceX hybrid letterforms
 * in the official SpaceX Cyber-Cyan & Deep Black color system.
 */
export const SanitaryLogo: React.FC<SanitaryLogoProps> = ({
  variant = "full",
  size = 28,
  color = "currentColor",
  accentColor = "#38bdf8",
  showSubtitle = false,
  className = "",
  style,
}) => {
  const uniqueId = useId();
  const finGradId = `sn-logo-fin-${uniqueId}`;
  const thrustGradId = `sn-logo-thrust-${uniqueId}`;
  const gleamGradId = `sn-logo-gleam-${uniqueId}`;

  if (variant === "mark") {
    return (
      <SanitaryMark
        size={size}
        color={color}
        accentColor={accentColor}
        className={className}
        style={style}
      />
    );
  }

  // Unified viewBox: 205 width x (showSubtitle ? 44 : 34) height
  // Baseline is at y = 28. Cap-height is at y = 4 (height = 24px)
  const baseWidth = 205;
  const baseHeight = showSubtitle ? 44 : 34;
  const scaledWidth = Math.round((size / 30) * baseWidth);
  const scaledHeight = Math.round((size / 30) * baseHeight);

  return (
    <span
      className={`sanitary-brand-logo ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
        userSelect: "none",
        ...style,
      }}
    >
      <svg
        width={scaledWidth}
        height={scaledHeight}
        viewBox={`0 0 ${baseWidth} ${baseHeight}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Sanitary Doorstep Recycling"
      >
        <defs>
          <linearGradient
            id={finGradId}
            x1="0"
            y1="0"
            x2="38"
            y2="38"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id={thrustGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor={accentColor} />
          </linearGradient>
          <linearGradient id={gleamGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        {/* 1. HERO 'S': OPTION 5 SPACEX THRUST & FIN EMBLEM
            MATHEMATICALLY FLUSHED ALIGNMENT:
            - Cap-height top: y = 4.0
            - Baseline bottom: y = 28.0
            - Kerning gap to 'A': 5.95px
        */}
        <g transform="translate(2, 3.67) scale(0.6486)">
          <Option5Glyph
            finGradId={finGradId}
            thrustGradId={thrustGradId}
            gleamGradId={gleamGradId}
            color={color}
            isCustomColor={false}
          />
        </g>

        {/* 2. PIXAR x SPACEX HYBRID WORDMARK: 'A N I T A R Y' */}
        <g transform="translate(30, 2)" fill={color}>
          {/* Letter 'A' (x = 0) */}
          <g transform="translate(0, 0)">
            <path d="M9.5 2L1 26H5.8L7.6 20.5H14.4L16.2 26H21L12.5 2H9.5ZM11 6.8L13.2 16.2H8.8L11 6.8Z" />
            {/* SpaceX chamfer accent on crossbar */}
            <path d="M7.6 19H14.4V20.5H7.6V19Z" fill={accentColor} />
          </g>

          {/* Letter 'N' (x = 24) */}
          <g transform="translate(24, 0)">
            <path d="M0 2H4.4L13.6 18.8V2H18V26H13.6L4.4 9.2V26H0V2Z" />
          </g>

          {/* Letter 'I' (x = 46) */}
          <g transform="translate(46, 0)">
            <path d="M0 3.5L1.5 2H4.5L6 3.5V24.5L4.5 26H1.5L0 24.5V3.5Z" />
            <circle cx="3" cy="2" r="1.3" fill={accentColor} />
          </g>

          {/* Letter 'T' (x = 56) */}
          <g transform="translate(56, 0)">
            <path d="M0 4L1.8 2H16.2L18 4V6.5H11.2V26H6.8V6.5H0V4Z" />
          </g>

          {/* Letter 'A' (x = 77) */}
          <g transform="translate(77, 0)">
            <path d="M9.5 2L1 26H5.8L7.6 20.5H14.4L16.2 26H21L12.5 2H9.5ZM11 6.8L13.2 16.2H8.8L11 6.8Z" />
            <path d="M7.6 19H14.4V20.5H7.6V19Z" fill={accentColor} />
          </g>

          {/* Letter 'R' (x = 101) */}
          <g transform="translate(101, 0)">
            <path d="M0 2H9.8C13.8 2 16.8 4.6 16.8 8.6C16.8 11.6 14.6 14 11.5 14.8L17 26H12L7.2 15.5H4.4V26H0V2ZM4.4 6.2V11.8H9.5C11.6 11.8 12.8 10.6 12.8 9C12.8 7.4 11.6 6.2 9.5 6.2H4.4Z" />
          </g>

          {/* Letter 'Y' (x = 121) */}
          <g transform="translate(121, 0)">
            <path d="M0 2L7 13.5V26H11.6V13.5L18.6 2H13.8L9.3 10.2L4.8 2H0Z" />
          </g>
        </g>

        {/* 3. OPTIONAL HIGH-PRECISION SUBTITLE */}
        {showSubtitle && (
          <text
            x="32"
            y="39"
            fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
            fontSize="7.5"
            fontWeight="800"
            fill={accentColor}
            letterSpacing="0.18em"
          >
            DOORSTEP RECYCLING
          </text>
        )}
      </svg>
    </span>
  );
};
