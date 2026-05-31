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

/**
 * Maximum live units a single lane (front / back) may hold. The board has no
 * prior hard cap; token-minting death-watchers (SUMMON_ON_ANY_DEATH) could mint
 * unbounded tokens via mutual-death loops. This Hearthstone-style 7-wide lane
 * cap bounds the board so a full lane makes a token mint a clean no-op.
 */
export const MAX_LANE_UNITS = 7;

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
  /**
   * TEMP-DEBUFF bookkeeping (DEBUFF_ALL_ENEMIES, e.g. Lucifer): the attack
   * reduction applied "this turn only". Stored so the reducer's turn-end hook can
   * add it back to restore the unit's attack when the turn that applied it ends.
   * Optional so fixtures default to no temp debuff.
   */
  tempAtkDebuff?: number;
  /**
   * DOUBLE_ATTACK bookkeeping (e.g. Harley): how many attacks the unit has made
   * this turn. Reset to 0 at the start of the controller's turn (alongside
   * `exhausted`). A DOUBLE_ATTACK unit may strike while this is < 2; others while
   * it is < 1. Optional so fixtures default to 0.
   */
  attacksThisTurn?: number;
  /**
   * ONCEDEATH_REVIVE bookkeeping (e.g. Jean): true once the unit has used its
   * once-per-match self-revive. Tracked on the instance so it never revives
   * twice. Optional so fixtures default to "revive available".
   */
  reviveUsed?: boolean;
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

/**
 * A pending death-trigger to be resolved by `drainTriggerQueue`. Deaths are no
 * longer fired inline during the board sweep; instead each newly-dead unit
 * ENQUEUES one entry per trigger kind (in canonical board order), and the queue
 * is then drained FIFO to completion so a chained death (an ON_DEATH/watcher
 * effect that kills another unit) fires that unit's own triggers within the
 * SAME action. See `src/engine/RESOLUTION_MODEL.md`.
 *
 *   - ON_DEATH               — fire the dead unit's compiled ON_DEATH specs.
 *   - SUMMON_ON_ANY_DEATH    — fire every live watcher's mint for this death.
 *
 * `controller` is the dead unit's owner; `source` is the dead unit itself
 * (still referenced after it has been spliced off the board, so its ON_DEATH /
 * watcher exclusion can resolve against a stable identity).
 */
export interface TriggerQueueEntry {
  kind: "ON_DEATH" | "SUMMON_ON_ANY_DEATH";
  controller: PlayerId;
  source: UnitInPlay;
  dead?: UnitInPlay;
}

export interface MatchState {
  turn: number;
  activePlayer: PlayerId;
  winner: PlayerId | null;
  /**
   * FIFO queue of pending death triggers (ON_DEATH / SUMMON_ON_ANY_DEATH) drained
   * to completion by `drainTriggerQueue` during death resolution. Reset to `[]`
   * at every action entry. Transient within a single `applyAction` — it is always
   * empty between actions, so it does not affect cross-action determinism /
   * structuredClone stability. Optional so existing fixtures default to empty.
   */
  triggerQueue?: TriggerQueueEntry[];
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
