import fs from "fs";

// Refined Option 5: SpaceX Aerospace Thrust Fin S with Cleaning Sparkle & Kinetic Slits
const testSvg = `
<svg width="400" height="120" viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="finGrad" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="thrustGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6EE7B7"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
  </defs>

  <rect width="400" height="120" rx="16" fill="#090D16"/>

  <!-- Standalone Option 5 Mark: 38x38 grid -->
  <g transform="translate(40, 25)">
    <!-- Top Winglet Bar with 45° Chamfer -->
    <path d="M1 6L7 0.5H34L29 6.5H8L1 6Z" fill="url(#finGrad)"/>

    <!-- Upper Vertical Aero-Spine -->
    <path d="M1 6V17L9 21.5V11L4 6H1Z" fill="url(#finGrad)"/>

    <!-- Kinetic Central Thrust Bridge (Slanted Dynamic Crossing) -->
    <path d="M3 17.5L34 17.5L28 24.5L1 24.5L3 17.5Z" fill="url(#thrustGrad)"/>

    <!-- Lower Vertical Aero-Spine -->
    <path d="M34 21V32L26 36.5V26.5L31 21H34Z" fill="url(#finGrad)"/>

    <!-- Bottom Winglet Bar with 45° Chamfer -->
    <path d="M34 32L28 37.5H1L6 31.5H27L34 32Z" fill="url(#finGrad)"/>

    <!-- Integrated Diamond Cleaning Gleam Beacon -->
    <path d="M31 1.5C31 4 33.5 4 33.5 4C33.5 4 31 4 31 6.5C31 4 28.5 4 28.5 4C28.5 4 31 4 31 1.5Z" fill="#A7F3D0"/>
  </g>
</svg>
`;

fs.writeFileSync("/Users/dineshrajneelakandan/Desktop/Sanitary/apps/customer/public/test-option5-preview.svg", testSvg);
console.log("Option 5 test preview SVG generated!");
