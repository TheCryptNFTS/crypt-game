/**
 * Persistence for SEALED / DRAFT (limited) runs.
 *
 * Completely separate from the constructed deck-builder storage
 * (`deckBuilderStorage.ts`) — different localStorage keys — so a limited run can
 * never overwrite or corrupt the player's constructed deck. This lets the limited
 * deck flow into the same match-start path while the constructed loadout stays
 * exactly where it was.
 */

export const LS_SEALED_SEED = "crypt-sealed-seed";
export const LS_SEALED_DECK = "crypt-sealed-deck";
export const LS_SEALED_COMMANDER = "crypt-sealed-commander";

export type StoredSealedRun = {
  seed: number;
  deck: string[];
  commanderId: string;
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode / no storage
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — degrade gracefully, run is just non-persistent */
  }
}

export function saveSealedRun(run: StoredSealedRun): void {
  safeSet(LS_SEALED_SEED, String(run.seed >>> 0));
  safeSet(LS_SEALED_DECK, JSON.stringify(run.deck));
  safeSet(LS_SEALED_COMMANDER, run.commanderId);
}

export function loadStoredSealedSeed(): number | null {
  const raw = safeGet(LS_SEALED_SEED);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n >>> 0 : null;
}

export function loadStoredSealedDeck(): string[] {
  const raw = safeGet(LS_SEALED_DECK);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
  } catch {
    /* ignore corrupt entry */
  }
  return [];
}

export function loadStoredSealedCommander(): string | null {
  return safeGet(LS_SEALED_COMMANDER);
}
