/**
 * registry.ts — the LOCALE REGISTRY + `t(key)` helper (A6 scaffold).
 *
 * A tiny, dependency-free i18n seam:
 *   - Locales register a (possibly PARTIAL) message table keyed by MessageKey.
 *   - `t(key)` resolves against the ACTIVE locale, falling back KEY-BY-KEY to
 *     'en', then to the key itself (so a missing string is visible, never blank).
 *   - The active locale is device-local (localStorage), defaulting to 'en'.
 *
 * BROWSER-SAFE: localStorage access is fully guarded (SSR / Node proofs that
 * import this never touch a missing global). No node globals at import.
 *
 * SCAFFOLD: only 'en' ships a full table; a stub 'es' locale is registered with a
 * couple of strings purely to PROVE per-key fallback works. Adding a real locale
 * later is one `registerLocale` call.
 */

import { en, type MessageKey } from "./en";

export type LocaleCode = "en" | "es";

/** A locale table is a partial map of canonical keys to translated strings. */
export type LocaleTable = Partial<Record<MessageKey, string>>;

const ACTIVE_LOCALE_STORAGE_KEY = "crypt.i18n.locale";
const DEFAULT_LOCALE: LocaleCode = "en";

/** The locale registry. 'en' is the complete base table. */
const LOCALES: Record<string, LocaleTable> = {
  en,
  // Stub locale — intentionally PARTIAL, to demonstrate per-key fallback to 'en'.
  es: {
    "home.hero.playLabel": "Jugar",
  },
};

/** Register (or extend) a locale's table. Additive; later keys win. */
export function registerLocale(code: string, table: LocaleTable): void {
  LOCALES[code] = { ...(LOCALES[code] ?? {}), ...table };
}

/** Read the device-local active locale, guarded for non-browser contexts. */
export function getActiveLocale(): LocaleCode {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_LOCALE;
    const v = localStorage.getItem(ACTIVE_LOCALE_STORAGE_KEY);
    if (v && v in LOCALES) return v as LocaleCode;
  } catch {
    /* non-browser / blocked storage -> default */
  }
  return DEFAULT_LOCALE;
}

/** Persist the active locale (best-effort; no-op outside the browser). */
export function setActiveLocale(code: LocaleCode): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(ACTIVE_LOCALE_STORAGE_KEY, code);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Resolve a message key for the active (or an explicit) locale, falling back
 * KEY-BY-KEY to 'en', then to the raw key. Pure given the active locale.
 */
export function t(key: MessageKey, locale: LocaleCode = getActiveLocale()): string {
  const table = LOCALES[locale];
  if (table && table[key] != null) return table[key] as string;
  if (en[key] != null) return en[key];
  return key;
}

/** All registered locale codes (for a future language picker). */
export function availableLocales(): string[] {
  return Object.keys(LOCALES);
}
