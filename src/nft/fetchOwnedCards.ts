/**
 * Fetch a wallet's owned Combat Archives token ids from the FREELON CITY
 * backend (Slice 2 of the TCG ↔ city link).
 *
 * Why a backend call: the `crypttradingcards` contract is a plain ERC-721
 * (NOT ERC721Enumerable, verified on-chain), so the token ids a wallet holds
 * cannot be enumerated client-side — that needs an indexer. The city site runs
 * the OpenSea lookup server-side (its API key never reaches the browser) and
 * exposes the result at `GET /api/owned-cards?addr=`. We just read it.
 *
 * Base URL is configurable for local dev (city on :3000, TCG on :5173) via
 * `VITE_CITY_API_BASE`; defaults to production.
 */

const CITY_API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_CITY_API_BASE || "https://freeloncity.com";

/** Pinned response-contract version. Must match the city endpoint's
 *  CONTRACT_VERSION; a mismatch means the shape may have changed under us, so
 *  we treat it as unknown rather than trusting a possibly-renamed field. */
const EXPECTED_VERSION = 2;

type OwnedCardsResponse = {
  version?: number;
  address: string;
  tokenIds: string[];
  count: number;
  /** Case (A): clean cap at MAX_PAGES (>1000-card whale). List is valid. */
  truncated?: boolean;
  /** Case (B): a page errored mid-scan; list is genuinely incomplete/suspect. */
  incomplete?: boolean;
  unknown?: boolean;
};

/**
 * Returns the wallet's owned Combat Archives token ids, or null when the
 * lookup is unknown (network error, the endpoint reported `unknown`, or a
 * non-OK status). Callers MUST treat null as "unverified" and never as a
 * confirmed empty deck — an outage must not strip a real holder's cards.
 */
export async function fetchOwnedCardTokenIds(
  address: string,
): Promise<string[] | null> {
  if (!address) return null;
  try {
    const res = await fetch(
      `${CITY_API_BASE}/api/owned-cards?addr=${encodeURIComponent(address)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) {
      console.warn(`[TCG] owned-cards lookup failed: HTTP ${res.status} — using demo deck`);
      return null;
    }
    const data = (await res.json()) as OwnedCardsResponse;
    if (data.version !== undefined && data.version !== EXPECTED_VERSION) {
      console.warn(
        `[TCG] owned-cards contract version ${data.version} != expected ${EXPECTED_VERSION} — treating as unknown`,
      );
      return null;
    }
    if (data.unknown) {
      console.warn("[TCG] owned-cards lookup unknown (city/OpenSea outage) — using demo deck");
      return null;
    }
    if (!Array.isArray(data.tokenIds)) return null;
    // Case (B): a page failed mid-scan. The list may be short, but it's almost
    // certainly still ≥200 ids — plenty for the 30-card deck cap — so we use it
    // rather than fail-closing to the demo deck. Warn so it isn't silent.
    if (data.incomplete) {
      console.warn(
        `[TCG] owned-cards fetch was incomplete (OpenSea page error mid-scan) — using ${data.tokenIds.length} recovered ids; deck may be partial`,
      );
    }
    // Case (A): clean truncation at the page cap (>1000-card whale). The list
    // is valid and far exceeds the deck cap — use it normally, no warning.
    return data.tokenIds;
  } catch (err) {
    console.warn("[TCG] owned-cards unreachable — using demo deck", err);
    return null;
  }
}
