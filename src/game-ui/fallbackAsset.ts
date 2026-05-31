export const fallbackAsset =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#07090d"/>
      <stop offset="100%" stop-color="#141b29"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="28%" r="45%">
      <stop offset="0%" stop-color="rgba(141,92,255,0.45)"/>
      <stop offset="100%" stop-color="rgba(141,92,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="800" height="1100" fill="url(#bg)"/>
  <rect x="18" y="18" width="764" height="1064" rx="34" fill="none" stroke="rgba(141,92,255,0.38)" stroke-width="4"/>
  <circle cx="400" cy="300" r="180" fill="url(#glow)"/>
  <text x="400" y="335" text-anchor="middle" fill="#edf2f8" font-family="Arial, sans-serif" font-size="78" font-weight="700">CRYPT</text>
  <text x="400" y="415" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="30">LIVE MATCH PREVIEW</text>
  <rect x="74" y="700" width="652" height="140" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
  <text x="400" y="770" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="34">Safe placeholder asset</text>
</svg>
`);
