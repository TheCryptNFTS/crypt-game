/**
 * Social-share helpers — browser-safe (no node globals at import).
 *
 * Provides the primitives every share surface uses: an absolute share URL,
 * an X/Twitter intent link, clipboard copy, and a native-share-sheet helper
 * that falls back to copying. The SPA is static (no server), so dynamic OG
 * images live in the city (Next) — here we share links + text + client-rendered
 * cards.
 */

export function shareBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://play.freeloncity.com";
}

/** Turn a path ("/d/ABC") or share code into an absolute URL. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const base = shareBaseUrl().replace(/\/$/, "");
  return base + (pathOrUrl.startsWith("/") ? pathOrUrl : "/" + pathOrUrl);
}

/** X/Twitter web-intent URL. */
export function tweetUrl(text: string, url?: string): string {
  const params = new URLSearchParams();
  params.set("text", text);
  if (url) params.set("url", url);
  params.set("hashtags", "CRYPT,FreelonCity");
  return "https://twitter.com/intent/tweet?" + params.toString();
}

export function openTweet(text: string, url?: string): void {
  if (typeof window === "undefined") return;
  window.open(tweetUrl(text, url), "_blank", "noopener,noreferrer");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export type ShareData = { title?: string; text: string; url?: string };

/**
 * Native share sheet (mobile / supported browsers); falls back to copying the
 * text + url to the clipboard. Returns what happened so the UI can toast.
 */
export async function shareOrCopy(data: ShareData): Promise<"shared" | "copied" | "failed"> {
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      await nav.share({ title: data.title, text: data.text, url: data.url });
      return "shared";
    }
  } catch {
    /* user cancelled or unsupported → copy fallback */
  }
  const ok = await copyToClipboard([data.text, data.url].filter(Boolean).join("  "));
  return ok ? "copied" : "failed";
}
