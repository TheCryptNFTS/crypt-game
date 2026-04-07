import { COMMANDER_SPECS } from "../design/commanderSpecs";

/** Kept in sync with deck builder UI persistence — no server. */
export const LS_DECK_BUILDER_COMMANDER = "crypt-deck-builder-commander";
export const LS_DECK_BUILDER_MAIN_DECK = "crypt-deck-builder-main-deck";

const commanderIdsSorted = Object.keys(COMMANDER_SPECS).sort();

export function loadStoredCommanderId(): string {
  try {
    const raw = localStorage.getItem(LS_DECK_BUILDER_COMMANDER);
    if (raw && COMMANDER_SPECS[raw]) return raw;
  } catch {
    /* private mode */
  }
  return commanderIdsSorted[0] ?? "cmd_stone_warden";
}

export function loadStoredMainDeckCardIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_DECK_BUILDER_MAIN_DECK);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}
