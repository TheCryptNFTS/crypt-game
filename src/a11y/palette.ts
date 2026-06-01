/**
 * palette.ts — a11y COLORBLIND-SAFE PALETTE toggle (A6 scaffold).
 *
 * A tiny, persisted accessibility preference: when ON, a `data-palette="cb-safe"`
 * attribute is set on <html>, which CSS keys off to swap the faction / status hues
 * for a colorblind-safe (blue/orange-anchored) set. The preference is device-local
 * (localStorage) and applied to the document root.
 *
 * BROWSER-SAFE: every DOM / storage access is guarded so importing this in a Node
 * proof or SSR context is inert. No node globals at import.
 */

const PALETTE_STORAGE_KEY = "crypt.a11y.palette";
const CB_SAFE = "cb-safe";

/** Read the persisted preference (false unless explicitly enabled). */
export function isColorblindSafe(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(PALETTE_STORAGE_KEY) === CB_SAFE;
  } catch {
    return false;
  }
}

/** Apply (or clear) the `data-palette` attribute on the document root. */
export function applyPalette(enabled: boolean): void {
  try {
    if (typeof document === "undefined" || !document.documentElement) return;
    if (enabled) document.documentElement.setAttribute("data-palette", CB_SAFE);
    else document.documentElement.removeAttribute("data-palette");
  } catch {
    /* non-browser -> no-op */
  }
}

/** Persist + apply the preference. Returns the new state. */
export function setColorblindSafe(enabled: boolean): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      if (enabled) localStorage.setItem(PALETTE_STORAGE_KEY, CB_SAFE);
      else localStorage.removeItem(PALETTE_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
  applyPalette(enabled);
  return enabled;
}

/** Initialise the palette from the persisted preference (call once at boot). */
export function initPalette(): void {
  applyPalette(isColorblindSafe());
}

/** Flip the preference; returns the new state. */
export function toggleColorblindSafe(): boolean {
  return setColorblindSafe(!isColorblindSafe());
}
