// On-brand fallback for a card whose real reveal art can't be resolved (e.g. a
// generated commander whose token has no entry in the playable art manifest).
// It must read as a REAL Crypt card, never a debug placeholder: warm near-black
// ground + a gold ⬡ frame and sigil, and ZERO "preview / placeholder" text on a
// screen we're selling. (Replaces the old off-brand purple #8D5CFF "LIVE MATCH
// PREVIEW / Safe placeholder asset" SVG.)
export const fallbackAsset =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0b0907"/>
      <stop offset="100%" stop-color="#1a140c"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="52%">
      <stop offset="0%" stop-color="rgba(233,201,132,0.30)"/>
      <stop offset="100%" stop-color="rgba(233,201,132,0)"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#E9C984"/>
      <stop offset="100%" stop-color="#C8A75D"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1100" fill="url(#bg)"/>
  <circle cx="400" cy="450" r="320" fill="url(#glow)"/>
  <rect x="20" y="20" width="760" height="1060" rx="36" fill="none" stroke="url(#gold)" stroke-width="5" opacity="0.85"/>
  <rect x="40" y="40" width="720" height="1020" rx="28" fill="none" stroke="#C8A75D" stroke-width="1.5" opacity="0.35"/>
  <g transform="translate(400 450)" fill="none" stroke="url(#gold)" stroke-width="14" stroke-linejoin="round">
    <polygon points="0,-150 130,-75 130,75 0,150 -130,75 -130,-75"/>
    <polygon points="0,-78 68,-39 68,39 0,78 -68,39 -68,-39" stroke-width="8" opacity="0.6"/>
  </g>
</svg>
`);
