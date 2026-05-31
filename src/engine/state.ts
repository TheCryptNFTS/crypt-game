export type PlayerId = "P1" | "P2";
export type Lane = "front" | "back";

/**
 * Energy / hand constants — the LIVED single-player values, promoted from the
 * hook so the engine reducer is the single source of truth. The hook's old
 * `BASE_MAX_ENERGY` / `ENERGY_CAP` / `OPENING_HAND_SIZE` now re-export these.
 */
export const BASE_MAX_ENERGY = 3;
export const ENERGY_CAP = 10;
export const OPENING_HAND_SIZE = 6;

/** Starting face HP for each player's nexus. */
export const STARTING_NEXUS_HEALTH = 20;

export interface UnitInPlay {
  instanceId: string;
  cardId: string;
  lane: Lane;
  attack: number;
  health: number;
  maxHealth: number;
  speed: number;
  armor: number;
  keywords: string[];
  exhausted: boolean;
  summoningSick: boolean;
  /**
   * WARD / DIVINE_SHIELD bookkeeping: when true, the next instance of combat
   * damage this unit would take is fully absorbed and the flag clears. Set at
   * summon for units carrying a shield keyword. Optional so existing fixtures /
   * constructed test units (which omit it) are treated as unshielded.
   */
  shielded?: boolean;
  /**
   * STEALTH bookkeeping: while true the unit cannot be targeted by enemy
   * attacks. Set at summon for STEALTH units and cleared the moment the unit
   * attacks (it reveals itself). Optional so existing fixtures default to
   * non-stealthed.
   */
  stealthed?: boolean;
  /**
   * WINDFURY bookkeeping: true once this unit has used its bonus (second) attack
   * window this turn. A WINDFURY unit's first swing leaves it un-exhausted and
   * sets this flag; the second swing exhausts it normally. Cleared at the start
   * of the controller's turn alongside `exhausted`. Optional so fixtures default
   * to "bonus available".
   */
  windfuryStruck?: boolean;
  /**
   * AURA bookkeeping: the attack / max-health bonus this unit is currently
   * receiving from continuous faction auras ("Other <Faction> gain +X/+Y while
   * in play"). The reducer recomputes auras after every board change by first
   * stripping exactly these amounts, then re-deriving from the live aura
   * sources, so the bonus is idempotent and removed cleanly when a source
   * leaves play. Optional so constructed fixtures default to no aura bonus.
   */
  auraAtk?: number;
  auraHp?: number;
  /**
   * AURA-GRANTED KEYWORDS: keywords a unit is currently receiving from a
   * continuous keyword aura ("allies gain GUARD while this is in play"). These
   * are NEVER merged into the unit's printed `keywords`; they are cleared and
   * re-derived from the live aura sources on every recomputeAuras pass, so they
   * vanish cleanly when a source leaves play. `unitHasKeyword` consults both the
   * printed keywords and this derived set. Optional so fixtures default to none.
   */
  auraKeywords?: string[];
}

/**
 * A slim record of a unit that died. Carries exactly enough to reconstruct a
 * playable unit (RESURRECT) or to hand its card back (RETURN_FROM_GRAVE). Tokens
 * never enter the graveyard — they cease to exist — so every record's cardId is
 * a real catalog id. Kept minimal (no transient combat/aura bookkeeping) so the
 * zone is deterministic and structuredClone-stable for e2e/determinism gates.
 */
export interface GraveyardRecord {
  cardId: string;
  attack: number;
  maxHealth: number;
  keywords: string[];
}

/**
 * An artifact resolved into play. effectSystem.ts builds these ad-hoc today;
 * promoting the field here makes the shape explicit and lets the reducer treat
 * `player.artifacts` as a first-class zone.
 */
export interface ArtifactInPlay {
  cardId: string;
  name?: string;
  effectTags?: string[];
  rarity?: string;
  faction?: string;
  attack?: number;
  health?: number;
  speed?: number;
  armor?: number;
  crit?: number;
  utility?: number;
  commanderTags?: string[];
  passives?: string[];
  modifiers?: Record<string, unknown>;
}

export interface PlayerState {
  id: PlayerId;
  /**
   * Face HP. `nexusHealth` is the LIVED value players experience (starts at 20)
   * and is the value the live win-detector reads.
   *
   * `health` is still written by the live setup (createPlayer) and read/written
   * by live unitAbilities (DEATH_BLAST / BATTLECRY_HERO_HIT win-affecting
   * effects in cleanup), so it is NOT vestigial and must remain on the type.
   */
  nexusHealth: number;
  health: number;
  energy: number;
  maxEnergy: number;
  commanderId: string;
  deck: string[];
  hand: string[];
  discard: string[];
  /**
   * The GRAVEYARD zone: non-token units that have died, most-recent LAST. Distinct
   * from `discard` (which is an id-list for spent spells). A record carries enough
   * to reconstruct a playable unit (RESURRECT) or return its card (RETURN_FROM_GRAVE).
   */
  graveyard: GraveyardRecord[];
  deckCount: number;
  artifacts: ArtifactInPlay[];
  board: {
    front: UnitInPlay[];
    back: UnitInPlay[];
  };
  turnFlags: {
    firstUnitCostReduction: number;
    firstUnitPlayed: boolean;
  };
}

export interface MatchState {
  turn: number;
  activePlayer: PlayerId;
  winner: PlayerId | null;
  /**
   * Seed the match was created from. Combined with the action list this makes
   * the match fully reproducible (server and client derive the same state).
   */
  seed: number;
  /**
   * Monotonic counter for deterministic instance ids. Every minted unit id is
   * `unit_${seed}_${idCounter}` and the counter increments, so ids are stable
   * and collision-free for a given seed + action order.
   */
  idCounter: number;
  /**
   * How many RNG draws the match has consumed since creation. The reducer
   * rebuilds `makeRng(seed)` and fast-forwards it `rngCursor` steps, so any
   * randomness (currently only mulligan reshuffles, if added) is reproducible
   * from `(seed, actionList)` alone with no external input.
   */
  rngCursor: number;
  players: {
    P1: PlayerState;
    P2: PlayerState;
  };
}
