/**
 * seasons.ts — SEASON CADENCE ENGINE (A7).
 *
 * A season is a curated, ROTATABLE framing layer on top of the existing
 * deterministic engine: it names the live constructed environment (which Format
 * is "in season"), a spotlight ruleset variation, and an "archetype of the
 * season" the meta is tuned around. It is PURE DATA + SELECTORS — no chain, no
 * clock, no RNG, no new tokens, and (critically) it does NOT change a live match
 * unless a caller explicitly opts a match into the season's ruleset.
 *
 * HARD INVARIANTS (mirroring formats.ts / abilityEnrichment.ts discipline):
 *   - BROWSER-SAFE. No node globals at import; no `process`, no `Date.now()` at
 *     module load. The "active season" is a fixed, committed pointer, not a wall
 *     clock — so server and client always agree and a replay is reproducible.
 *   - ADDITIVE / INERT. Importing this module attaches nothing to any match. The
 *     reducer is never touched. A season's `ruleset` is only ever applied if a
 *     caller passes it into match creation (createMatchFromDecks's `rules`), and
 *     it is always a SUBSET of the already-shipped MatchRules flags — no new
 *     mechanics, no new tokens, nothing the engine can't already replay.
 *   - DETERMINISTIC. Every selector is a pure function of this static table.
 *   - ROTATES THE CORE FORMAT/SPOTLIGHT WITHOUT NEW TOKENS. A season references
 *     an EXISTING Format ("Open" | "Core") and an EXISTING archetype/spotlight
 *     name; rotating the active season changes which of those is "in season",
 *     never the catalog or the rules vocabulary.
 */

import type { Format } from "./formats";
import { DEFAULT_FORMAT } from "./formats";
import type { MatchRules } from "./state";
import { CORE_RULESET } from "./state";

/**
 * The mechanic/archetype a season spotlights. These are LABELS over already-
 * existing behaviors (faction identities, the trait-resonance hook, the curated
 * Core pool) — not new engine features. The meta description and the spotlight
 * ruleset are what shift per season.
 */
export type SeasonArchetype =
  | "RESONANCE" // shared-keyword synergy decks (traitResonance hook)
  | "BULWARK" // durable, defensive boards (faction identity / GUARD)
  | "ONSLAUGHT" // fast aggressive tempo (Bronze-style chip)
  | "ASCENDANCY"; // board-control / indirect-win meta (no-burn ascendancy)

/**
 * A season config. PURE DATA. `formatRef` names which already-shipped Format is
 * the in-season constructed environment; `ruleset` is the OPTIONAL spotlight
 * variation a caller may opt a match into (always a subset of shipped MatchRules
 * flags). Nothing here mints tokens or invents a rule.
 */
export interface SeasonConfig {
  /** Stable id, e.g. "S1". Used as the rotation key; never displayed raw. */
  seasonId: string;
  /** Ordinal (1-based) for sorting / display ("Season 3"). */
  ordinal: number;
  /** Display name for the client. Never read by engine logic. */
  name: string;
  /** One-line meta framing for the client. Never read by engine logic. */
  tagline: string;
  /** Which shipped Format is "in season" (the active Core/Open rotation ref). */
  formatRef: Format;
  /** The archetype/mechanic this season spotlights (a label over existing play). */
  spotlight: SeasonArchetype;
  /**
   * OPTIONAL spotlight ruleset. A SUBSET of the shipped MatchRules flags a caller
   * may opt a match into for this season. Undefined => the season changes only the
   * framing (format + spotlight), not the rules. Never contains a flag the engine
   * can't already replay.
   */
  ruleset?: MatchRules;
}

/**
 * THE SEASON TABLE — committed, ordered, deterministic. Rotating the meta is a
 * one-line change to `ACTIVE_SEASON_ID`; the catalog and rules vocabulary never
 * move. Every `ruleset` here is a subset of CORE_RULESET / shipped flags.
 */
export const SEASONS: readonly SeasonConfig[] = [
  {
    seasonId: "S1",
    ordinal: 1,
    name: "Season of Resonance",
    tagline: "Themed decks awaken. Shared-keyword units strengthen each other.",
    formatRef: "Core",
    spotlight: "RESONANCE",
    // The shipped CORE ruleset: faction identities + the trait-resonance hook.
    ruleset: { ...CORE_RULESET },
  },
  {
    seasonId: "S2",
    ordinal: 2,
    name: "Season of the Bulwark",
    tagline: "The line holds. Durable boards and defensive faction identities reign.",
    formatRef: "Core",
    spotlight: "BULWARK",
    // Identities ON, resonance OFF — a flatter, grindier defensive meta.
    ruleset: { factionIdentities: true },
  },
  {
    seasonId: "S3",
    ordinal: 3,
    name: "Season of Ascendancy",
    tagline: "Win by the board. An indirect, no-burn control race to dominance.",
    formatRef: "Open",
    spotlight: "ASCENDANCY",
    // The full-pool control season: identities + resonance + the no-burn
    // ascendancy alt-win axis (board control to 7).
    ruleset: { ...CORE_RULESET, ascendancyToWin: 7 },
  },
] as const;

/**
 * The ACTIVE season pointer. A fixed, committed id (NOT a wall clock), so the
 * "current season" is identical on every client/server and across replays.
 * Rotating the meta = change this one constant.
 */
export const ACTIVE_SEASON_ID = "S1";

/** Lookup a season by id; undefined if unknown. Pure. */
export function getSeasonById(seasonId: string): SeasonConfig | undefined {
  return SEASONS.find((s) => s.seasonId === seasonId);
}

/** The active season config. Falls back to the first season if the pointer is
 *  ever stale, so a selector can never return undefined. Pure. */
export function getActiveSeason(): SeasonConfig {
  return getSeasonById(ACTIVE_SEASON_ID) ?? SEASONS[0];
}

/** The Format that is "in season" right now (the active Core/Open rotation ref).
 *  Falls back to the engine DEFAULT_FORMAT if a season ever lacks one. Pure. */
export function activeSeasonFormat(): Format {
  return getActiveSeason().formatRef ?? DEFAULT_FORMAT;
}

/** The spotlight archetype of the active season. Pure. */
export function activeSeasonSpotlight(): SeasonArchetype {
  return getActiveSeason().spotlight;
}

/**
 * The OPTIONAL ruleset a caller may opt a match into for the active season. A
 * caller passes the RESULT to createMatchFromDecks's `rules` to play "in season";
 * a caller that ignores it gets the engine default (vanilla / CORE) — so this is
 * inert until explicitly selected. Returns a fresh object (never a shared ref) so
 * a caller mutating it can't poison the table. Null if the season has no spotlight
 * ruleset (framing-only). Pure.
 */
export function activeSeasonRuleset(): MatchRules | null {
  const r = getActiveSeason().ruleset;
  return r ? { ...r } : null;
}

/** All seasons in ordinal order — handy for a client timeline / proofs. Pure. */
export function allSeasonsInOrder(): readonly SeasonConfig[] {
  return [...SEASONS].sort((a, b) => a.ordinal - b.ordinal);
}
