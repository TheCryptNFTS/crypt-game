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
  /**
   * "PATIENT / per turn undamaged" bookkeeping (BUFF_IF_UNDAMAGED). Set true the
   * moment this unit takes ANY damage (combat or ability), so the controller's
   * turn-boundary grower can tell whether the unit went a full round untouched.
   * The reducer checks it at the unit's ON_TURN_START — if still falsy, it fires
   * the +N/+N growth — then resets it to false (a fresh undamaged window begins).
   * Optional so fixtures default to "undamaged".
   */
  tookDamageThisTurn?: boolean;
  /**
   * "TAUNT / gain +N/+N per point of damage taken" bookkeeping. Accumulates the
   * total points of damage this unit has taken during the current turn window;
   * `lastDamageTaken` records the points from the SINGLE most-recent hit, which is
   * what the ON_DAMAGE per-point grower (BUFF_PER_DAMAGE_TAKEN) scales by ("per
   * point of damage taken" = per point of THAT hit). The accumulator is reset at
   * the controller's turn boundary. Both deterministic; optional so fixtures
   * default to 0 (no damage taken).
   */
  damageTakenThisTurn?: number;
  lastDamageTaken?: number;
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

/**
 * An armed SECRET / TRAP (#2) — a face-down reactive trigger a player sets on
 * their own turn that fires AUTOMATICALLY the instant the opponent takes the
 * matching action. There is no live decision and no priority pass when it fires,
 * so it preserves the engine's locked no-stack / no-response model
 * (RESOLUTION_MODEL.md §1): a secret is a pre-committed, deterministic reaction,
 * NOT a response window. One-shot — it is consumed (removed) the moment it fires.
 */
export interface ArmedSecret {
  /** Stable id for events / dedupe (e.g. "secret_<seed>_<n>"). */
  id: string;
  /** What enemy action springs it. Today only the attack-declaration window. */
  trigger: "ON_ENEMY_ATTACK";
  /** The reaction. "DEAL_DAMAGE" hits the triggering ENEMY UNIT (never the face —
   *  no-burn). Kept deliberately small; new ops are additive. */
  op: "DEAL_DAMAGE";
  /** Magnitude for the reaction op. */
  amount: number;
  /** Display label for the client; never read by game logic. */
  name?: string;
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
  /**
   * Armed SECRETS / TRAPS (#2). ABSENT by default — a player who never sets a
   * secret carries no field, so `structuredClone` keeps it `undefined` and the
   * reducer-equivalence golden JSON (which has no secret-setting actions) is
   * unmoved. The combat hook that fires these is a pure no-op on an empty/missing
   * zone, so vanilla matches are byte-identical.
   */
  secrets?: ArmedSecret[];
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

/**
 * One offered option in a mid-resolution player CHOICE (Discover / choose-one).
 * Pure data so the whole `pendingChoice` record is structuredClone-stable and
 * carries cleanly across the single action boundary it lives on. The `id` is the
 * stable token the client echoes back in RESOLVE_CHOICE; for a Discover this IS
 * the catalog cardId, for a future choose-one it is the mode index as a string.
 */
export interface ChoiceOption {
  /** Stable id the client echoes back in RESOLVE_CHOICE. */
  id: string;
  /** Optional UI label / cardId; never read by game logic (the `id` is canonical). */
  cardId?: string;
}

export type PendingChoiceKind = "DISCOVER";

/**
 * A paused effect awaiting one player decision. See `src/engine/RESOLUTION_MODEL.md`
 * §8. While `MatchState.pendingChoice` is non-null the reducer accepts ONLY a
 * matching RESOLVE_CHOICE; every other action reject-softs (`choice-pending`).
 * The record holds ONLY plain data (no closures / Maps / Sets) so structuredClone
 * at the reducer entry preserves it byte-for-byte, and the resume tail is replayed
 * purely from the logged `optionId` — keeping `(seed, actions)` fully determining.
 */
export interface PendingChoice {
  kind: PendingChoiceKind;
  /** ONLY this player may resolve it (the active player in v1). */
  controller: PlayerId;
  /** The offered options, in deterministic (seeded) draw order. The order is
   *  authoritative: a replay regenerates the identical list, so the picked
   *  `optionId` resolves to the same option every time. */
  options: ChoiceOption[];
  /** The continuation — enough to run the post-choice tail with NO frozen stack. */
  resume: {
    /** The resume op the RESOLVE_CHOICE branch interprets once a pick lands. */
    op: "ADD_CARD_TO_HAND";
    /** Where a DISCOVER pulls its picked card from: "deck" removes the chosen
     *  cardId from the controller's deck, "pool" mints it fresh into hand. */
    source?: "deck" | "pool";
  };
}

export interface MatchState {
  turn: number;
  activePlayer: PlayerId;
  winner: PlayerId | null;
  /**
   * Set when an effect PAUSED for a player choice (Discover / choose-one). While
   * non-null the reducer accepts ONLY a matching RESOLVE_CHOICE; every other action
   * reject-softs with `choice-pending`. Always null between fully-resolved actions.
   * Unlike `triggerQueue` (reset to [] every entry because it never crosses an
   * action) this DOES cross exactly one action boundary by design — it is read at
   * entry to gate legality and cleared by RESOLVE_CHOICE. It holds only plain data,
   * so it is structuredClone-stable and absent (undefined) from every committed
   * fixture, keeping the reducer-equivalence golden JSON unmoved. See
   * `src/engine/RESOLUTION_MODEL.md` §8.
   */
  pendingChoice?: PendingChoice | null;
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
  /**
   * Optional match RULESET (alt win conditions, #4). ABSENT by default, so a
   * vanilla match plays exactly as before and the reducer-equivalence golden JSON
   * stays unmoved (undefined survives structuredClone). When `ascendancyToWin` is
   * set, the reducer tracks the board-control meter below and awards a second,
   * purely INDIRECT victory axis (no face/nexus burn — earned by board dominance).
   */
  rules?: MatchRules | null;
  /**
   * ASCENDANCY meter (#4) — the no-burn alternate win track. Only present once a
   * match enables `rules.ascendancyToWin`; absent (undefined) otherwise, so default
   * matches and fixtures carry no extra field. At each player's turn END the reducer
   * increments that player's counter if they hold STRICTLY more live units than the
   * opponent (sustained board dominance), and RESETS it to 0 otherwise. Reaching the
   * threshold is a control victory — a win earned through the board, never burn.
   */
  ascendancy?: { P1: number; P2: number } | null;
  /**
   * RESPONSE STACK (opt-in `rules.responseStack`). ABSENT by default, so a vanilla
   * match carries no field and the reducer-equivalence golden JSON is byte-identical
   * (undefined survives structuredClone; every stack hook is a clean no-op without
   * the flag). When the flag is ON, a "slow" action (the BASE entry) does not resolve
   * immediately: it is pushed here and a response window opens. Players may push FAST
   * responses on top (LIFO) via CAST_RESPONSE; when both players PASS consecutively
   * the stack resolves top-down (the most-recent response first), so a response can
   * counter / pump / shield the entry beneath it before it resolves. Always `[]` /
   * absent between fully-resolved actions. Holds ONLY plain data, so it is
   * structuredClone-stable. See `src/engine/RESOLUTION_MODEL.md` §9.
   */
  responseStack?: ResponseStackEntry[] | null;
  /**
   * The OPEN response window (opt-in `rules.responseStack`). Non-null exactly while
   * the stack is awaiting priority passes. While set, the reducer accepts ONLY
   * CAST_RESPONSE / PASS_RESPONSE (every other action reject-softs `response-pending`),
   * mirroring the `pendingChoice` global gate. `priority` is whose turn it is to act in
   * the window; `passes` counts CONSECUTIVE passes — at 2 (both players passed in a row)
   * the window closes and the stack resolves LIFO. Absent (undefined/null) in a vanilla
   * match, so fixtures are unmoved.
   */
  pendingResponse?: PendingResponse | null;
  players: {
    P1: PlayerState;
    P2: PlayerState;
  };
}

/**
 * One entry on the response stack (opt-in `rules.responseStack`). Pure plain data so
 * the whole stack is structuredClone-stable. The BASE entry is the slow action that
 * opened the window (today: a unit attack or a spell-like cast); entries pushed on top
 * are FAST responses. Resolution is LIFO — the entry with the HIGHEST index resolves
 * first, so a response resolves before (and can modify/fizzle) the entry beneath it.
 */
export interface ResponseStackEntry {
  /** Stable id for events / counter-targeting (e.g. "resp_<seed>_<n>"). */
  id: string;
  /** Who put this entry on the stack. */
  controller: PlayerId;
  /**
   * The kind of entry, deciding how the reducer resolves it when it pops:
   *  - "ATTACK"        — a deferred unit attack (the BASE of an attack window). Carries
   *                      attacker/defender instance ids; resolves through the normal
   *                      combat path when it pops, reading the (possibly pumped/shielded)
   *                      LIVE units, so a response beneath-resolving-later changed them.
   *  - "EFFECT"        — a fast spell-like effect (pump / shield / direct unit damage /
   *                      nexus heal). Carries an explicit EffectSpec + optional target,
   *                      resolved via the shared effectResolver (no abilityCompiler edit).
   *  - "COUNTER"       — fizzles the entry DIRECTLY BENEATH it on the stack (LIFO), so a
   *                      counter neutralizes the action it was played in response to, and
   *                      a counter-the-counter (a COUNTER targeting another COUNTER) is
   *                      itself just an entry that fizzles the one below — resolving
   *                      correctly LIFO.
   */
  kind: "ATTACK" | "EFFECT" | "COUNTER";
  /** ATTACK: the attacking unit's instanceId. */
  attackerInstanceId?: string;
  /** ATTACK: the defending unit's instanceId, OR undefined for a face swing. */
  defenderInstanceId?: string;
  /** ATTACK: true for a face (nexus) swing rather than a unit attack. */
  face?: boolean;
  /** EFFECT: the explicit effect to resolve when this pops (carried by CAST_RESPONSE,
   *  so no new card-text parsing / abilityCompiler edit is needed). */
  effect?: ResponseEffectSpec;
  /** EFFECT: optional target unit instanceId, resolved against the LIVE board at pop. */
  targetInstanceId?: string;
  /** Set true when a COUNTER above this entry fizzled it; a fizzled entry is a clean
   *  no-op when it pops (it never resolves its attack/effect). */
  fizzled?: boolean;
}

/**
 * A self-contained fast-effect descriptor a CAST_RESPONSE carries (opt-in
 * `rules.responseStack`). Deliberately a SMALL, explicit shape (NOT parsed from card
 * text), so the response system needs no `abilityCompiler.ts` edit. The resolver maps
 * each op to an existing, proven effectResolver/no-burn primitive when the entry pops.
 * A content agent could later compile real "instant" cards into this same shape.
 */
export interface ResponseEffectSpec {
  /**
   *  - "PUMP_ALLY"    — +attack/+health to one of the CONTROLLER's own units
   *                     (BUFF_SELF on the target). Changes a combat outcome mid-window.
   *  - "SHIELD_ALLY"  — arm WARD/DIVINE_SHIELD on one of the controller's own units,
   *                     absorbing the next damage instance (no-burn; defensive).
   *  - "DAMAGE_UNIT"  — direct damage to an ENEMY unit (never the face — no-burn).
   *  - "HEAL_NEXUS"   — heal the CONTROLLER's own nexus (no-burn; self only). */
  op: "PUMP_ALLY" | "SHIELD_ALLY" | "DAMAGE_UNIT" | "HEAL_NEXUS";
  amount?: number;
  attack?: number;
  health?: number;
}

/**
 * The open response window (opt-in `rules.responseStack`). Pure plain data, crosses
 * action boundaries while the window is open, cleared when the stack resolves. See
 * `src/engine/RESOLUTION_MODEL.md` §9.
 */
export interface PendingResponse {
  /** Whose turn it is to act in the window (CAST_RESPONSE or PASS_RESPONSE). */
  priority: PlayerId;
  /** Consecutive PASS count. At 2 (both players passed in a row) the window closes and
   *  the stack resolves LIFO. A CAST_RESPONSE resets it to 0 (the opponent regains a
   *  chance to respond to the new top entry). */
  passes: number;
}

/**
 * Per-match ruleset (#4). Optional and additive: an undefined field means "vanilla".
 */
export interface MatchRules {
  /**
   * RESPONSE STACK (headline interactivity). When true, "slow" actions open a LIFO
   * response window: players may play FAST responses (CAST_RESPONSE) that resolve
   * before the action beneath them — a counter that fizzles it, a pump/shield that
   * changes a combat outcome, or a counter-the-counter, all resolving LIFO. ABSENT/
   * false by default, so a vanilla match plays EXACTLY as today (slow actions resolve
   * immediately, no window) and the reducer-equivalence golden JSON stays byte-identical.
   * See `src/engine/RESOLUTION_MODEL.md` §9.
   */
  responseStack?: boolean;
  /**
   * DECKOUT LOSS (alt win-con, opt-in). When true, drawing from an EMPTY deck loses you
   * the game (classic mill/fatigue). The vanilla draw already sets the opponent as winner
   * on an empty deck, so this flag makes the loss EXPLICIT and gateable; OFF by default it
   * is a clean no-op and the golden fixture is unmoved. Lethal-nexus still takes precedence.
   */
  deckoutLoss?: boolean;
  /**
   * ASSEMBLE / LIBRARY win (alt win-con, opt-in, no-burn). When set to N, a player who
   * holds at least N cards in HAND at the end of their own turn wins by "assembling the
   * archive" — a deck-building/card-advantage victory that never touches the enemy face.
   * ABSENT by default = no-op, fixtures unmoved. Lethal-nexus and deckout precede it.
   */
  assembleToWin?: number;
  /**
   * When set (e.g. 7), a player who holds strictly more live units than their
   * opponent at the end of `ascendancyToWin` consecutive own turns wins by board
   * control — an INDIRECT, no-burn second win axis. Unset = the only win axis is
   * nexus depletion / deck-out (the historical behavior).
   */
  ascendancyToWin?: number;
  /**
   * FACTION IDENTITIES (#8). When true, the five curated factions gain a distinct
   * mechanical identity (durability / tempo / card-smoothing / gear / top-end
   * value) via the additive, no-burn hooks in `factionIdentity.ts`. ABSENT/false
   * by default, so a vanilla match plays exactly as before and the reducer-
   * equivalence golden JSON stays byte-identical (undefined survives
   * structuredClone, and every identity hook is a clean no-op without this flag).
   */
  factionIdentities?: boolean;
}
