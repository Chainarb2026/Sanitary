import fs from "fs";

// Generate full Sanitary Pixar x SpaceX logo SVG
const fullLogoSvg = `
<svg width="260" height="48" viewBox="0 0 260 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Bio-Emerald & Cyan Aero Gradients -->
    <linearGradient id="snAeroGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="snGleamGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6EE7B7"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
  </defs>

  <!-- 1. HERO 'S': CIRCULAR AERO-VORTEX (SpaceX trajectory meets clean recycling vortex) -->
  <g transform="translate(4, 6)">
    <!-- Upper Orbital Sweep Blade -->
    <path d="M30 8.5C27 3.5 21 0.5 14.5 0.5C6.5 0.5 0 7 0 15C0 18.2 1.1 21.2 3 23.5L8.2 19.3C7.1 18.1 6.5 16.6 6.5 15C6.5 10.6 10.1 7 14.5 7C18.2 7 21.3 9.5 22.2 13L28.8 11.2C27.6 7.4 24.5 4.5 20.5 3.5" fill="url(#snAeroGrad)"/>
    
    <!-- Lower Orbital Sweep Blade -->
    <path d="M6.5 27.5C9.5 32.5 15.5 35.5 22 35.5C30 35.5 36.5 29 36.5 21C36.5 17.8 35.4 14.8 33.5 12.5L28.3 16.7C29.4 17.9 30 19.4 30 21C30 25.4 26.4 29 22 29C18.3 29 15.2 26.5 14.3 23L7.7 24.8C8.9 28.6 12 31.5 16 32.5" fill="url(#snAeroGrad)"/>
    
    <!-- High-Velocity Central Kinetic Bridge -->
    <path d="M9 14.5L27.5 21.5H19.5L7 14.5H9Z" fill="#10B981"/>
    
    <!-- Four-Point Diamond Cleaning Gleam Beacon -->
    <path d="M26 4C26 7 29 7 29 7C29 7 26 7 26 10C26 7 23 7 23 7C23 7 26 7 26 4Z" fill="url(#snGleamGrad)"/>
  </g>

  <!-- 2. PIXAR x SPACEX HYBRID WORDMARK: 'A N I T A R Y' -->
  <g transform="translate(48, 8)" fill="#0F172A">
    <!-- Letter 'A' (x = 0) -->
    <g transform="translate(0, 0)">
      <path d="M10.5 3L1.5 29H6.5L8.5 23H15.5L17.5 29H22.5L13.5 3H10.5ZM12 8L14.3 18.5H9.7L12 8Z"/>
      <!-- SpaceX subtle aero chamfer notch on crossbar -->
      <path d="M8.5 21.5H15.5V23H8.5V21.5Z" fill="#10B981"/>
    </g>

    <!-- Letter 'N' (x = 26) -->
    <g transform="translate(26, 0)">
      <path d="M0 3H4.8L14.2 21.2V3H19V29H14.2L4.8 10.8V29H0V3Z"/>
    </g>

    <!-- Letter 'I' (x = 49) -->
    <g transform="translate(49, 0)">
      <path d="M0 4.5L1.5 3H4.5L6 4.5V27.5L4.5 29H1.5L0 27.5V4.5Z"/>
      <!-- Tech accent core slit -->
      <circle cx="3" cy="3" r="1.5" fill="#10B981"/>
    </g>

    <!-- Letter 'T' (x = 59) -->
    <g transform="translate(59, 0)">
      <path d="M0 5L2 3H17L19 5V7.5H11.8V29H7.2V7.5H0V5Z"/>
    </g>

    <!-- Letter 'A' (x = 82) -->
    <g transform="translate(82, 0)">
      <path d="M10.5 3L1.5 29H6.5L8.5 23H15.5L17.5 29H22.5L13.5 3H10.5ZM12 8L14.3 18.5H9.7L12 8Z"/>
      <path d="M8.5 21.5H15.5V23H8.5V21.5Z" fill="#10B981"/>
    </g>

    <!-- Letter 'R' (x = 108) -->
    <g transform="translate(108, 0)">
      <path d="M0 3H10.5C14.5 3 17.5 5.8 17.5 10C17.5 13.2 15.3 15.8 12.2 16.6L18 29H12.8L7.5 17.5H4.8V29H0V3ZM4.8 7.5V13.5H10.2C12.4 13.5 13.8 12.2 13.8 10.5C13.8 8.8 12.4 7.5 10.2 7.5H4.8Z"/>
    </g>

    <!-- Letter 'Y' (x = 130) -->
    <g transform="translate(130, 0)">
      <path d="M0 3L7.5 15V29H12.5V15L20 3H15L10 11.8L5 3H0Z"/>
    </g>
  </g>

  <!-- 3. SUBTITLE: DOORSTEP RECYCLING -->
  <text x="50" y="44" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#059669" letter-spacing="0.18em">DOORSTEP RECYCLING</text>
</svg>
`;

fs.writeFileSync("/Users/dineshrajneelakandan/Desktop/Sanitary/apps/customer/public/test-full-logo.svg", fullLogoSvg);
console.log("Full logo SVG generated successfully!");
