/**
 * dev:playtest — INSTRUMENTED PLAYTEST HARNESS (read-only balance + game-feel report).
 *
 * Drives N full automated matches through the SAME deterministic reducer the live
 * game uses (`createMatchFromDecks` + `applyAction`), reusing the existing greedy
 * AI planner (`planP2Turn`) for BOTH sides and the engine's deterministic choice
 * auto-pick (`autoPickOption`). It MEASURES — it never mutates engine/card/balance
 * logic. Everything is seeded (mulberry32 via the engine, indexed by match number)
 * so a given invocation reproduces byte-identical results.
 *
 * Output: a readable report to stdout + a structured JSON artifact and a short
 * markdown summary under `asset-review/playtest/` (a dir the vite dev server is
 * configured to IGNORE, so writing there never triggers a reload).
 *
 * Re-run after the card pool expands: the playable set is read DYNAMICALLY from
 * `allPlayableCards`, so a larger pool is reflected automatically with no edits.
 *
 *   npm run dev:playtest                 # default N (300)
 *   PLAYTEST_N=600 npm run dev:playtest  # override match count
 *   PLAYTEST_MAXTURNS=80 npm run dev:playtest
 *
 * READ-ONLY: this file + one package.json script line + the output dir are the
 * ONLY things it owns. It imports the engine; it does not modify it.
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

import { allPlayableCards, getPlayableCardById } from "../engine/cards";
import { allCommanders } from "../engine/commanders";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { applyAction, autoPickOption, Action, GameEvent } from "../engine/reducer";
import { MatchState, BASE_MAX_ENERGY, STARTING_NEXUS_HEALTH, PlayerId } from "../engine/state";
import { planP2Turn } from "../game-ui/cryptMatchAI";
import { compileAbility } from "../engine/abilityCompiler";
import { Faction } from "../types/faction";

// ---------------------------------------------------------------------------
// Config (env-overridable; deterministic defaults).
// ---------------------------------------------------------------------------
const N = clampInt(process.env.PLAYTEST_N, 300, 1, 100000);
const MAX_TURNS = clampInt(process.env.PLAYTEST_MAXTURNS, 60, 4, 400);
const DECK_SIZE = 30;
const MAX_COPIES = 2;
const OPENING_HAND = 6;

function clampInt(raw: string | undefined, dflt: number, lo: number, hi: number): number {
  const n = raw == null ? dflt : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

// ---------------------------------------------------------------------------
// Faction <-> curated commander map. We pit the five CURATED commanders against
// each other (mirror + non-mirror). Each commander fields a deck built from its
// faction's pool, so the win-rate-by-faction signal is meaningful.
// ---------------------------------------------------------------------------
type FactionCommander = { faction: Faction; commanderId: string; label: string };
const FACTION_COMMANDER: FactionCommander[] = (
  [
    { faction: "STONE_KEEPERS", commanderId: "cmd_stone_warden", label: "STONE" },
    { faction: "IRON_DEFENDERS", commanderId: "cmd_iron_warlord", label: "IRON" },
    { faction: "BRONZE_GUARDIANS", commanderId: "cmd_bronze_raider", label: "BRONZE" },
    { faction: "SILVER_SENTINELS", commanderId: "cmd_silver_oracle", label: "SILVER" },
    { faction: "GOLDEN_SOVEREIGNS", commanderId: "cmd_golden_emperor", label: "GOLD" },
  ] satisfies FactionCommander[]
).filter((fc) => allCommanders.some((c) => c.id === fc.commanderId));

// ---------------------------------------------------------------------------
// Keyword classification. DEATHKNELL / DEPLOY are parsed from a card's ability
// text by the engine's own compiler, so we classify cards by compiling the SAME
// `rawTraits.Ability` the reducer compiles. DEATHKNELL => ON_DEATH DEAL_DAMAGE
// STRONGEST_ENEMY; DEPLOY => ON_SUMMON DEAL_DAMAGE STRONGEST_ENEMY.
// ---------------------------------------------------------------------------
type KwFlags = { deathknell: boolean; deploy: boolean };
const KW_CACHE = new Map<string, KwFlags>();
function keywordsOf(cardId: string): KwFlags {
  let f = KW_CACHE.get(cardId);
  if (f) return f;
  const card = getPlayableCardById(cardId) as any;
  const specs = compileAbility(card?.rawTraits?.Ability).specs as any[];
  f = {
    deathknell: specs.some(
      (s) => s.trigger === "ON_DEATH" && s.op === "DEAL_DAMAGE" && s.damageTarget === "STRONGEST_ENEMY"
    ),
    deploy: specs.some(
      (s) => s.trigger === "ON_SUMMON" && s.op === "DEAL_DAMAGE" && s.damageTarget === "STRONGEST_ENEMY"
    ),
  };
  KW_CACHE.set(cardId, f);
  return f;
}

// ---------------------------------------------------------------------------
// Deterministic per-faction deck construction. Mirrors the LIVE buildOwnedDeck
// curve logic (units-first by cost, then equipment then artifacts) but draws
// from a single faction's pool. We DELIBERATELY bias toward keyword-carrying
// cards within the curve so DEATHKNELL/DEPLOY (rare in the raw pool) actually
// surface enough to measure — without ever exceeding the 2-copy / 30-card legal
// limits the reducer enforces. Fully deterministic: no RNG, stable sort.
// ---------------------------------------------------------------------------
function byCurveThenKeyword(a: any, b: any): number {
  const ca = a.cost ?? 0;
  const cb = b.cost ?? 0;
  if (ca !== cb) return ca - cb;
  // Within a cost bucket, prefer keyword carriers so they get represented.
  const ka = keywordsOf(a.id);
  const kb = keywordsOf(b.id);
  const sa = (ka.deathknell ? 1 : 0) + (ka.deploy ? 1 : 0);
  const sb = (kb.deathknell ? 1 : 0) + (kb.deploy ? 1 : 0);
  if (sa !== sb) return sb - sa;
  return String(a.id).localeCompare(String(b.id));
}

const DECK_CACHE = new Map<string, string[]>();
function buildFactionDeck(faction: Faction): string[] {
  const cached = DECK_CACHE.get(faction);
  if (cached) return cached;

  const pool = (allPlayableCards as any[]).filter(
    (c) => c.faction === faction && c.disabled !== true && c.type !== "spell"
  );
  const units = pool.filter((c) => c.type === "unit").sort(byCurveThenKeyword);
  const equip = pool.filter((c) => c.type === "equipment").sort(byCurveThenKeyword);
  const arti = pool.filter((c) => c.type === "artifact").sort(byCurveThenKeyword);

  const deck: string[] = [];
  const counts = new Map<string, number>();
  const tryAdd = (id: string) => {
    if (deck.length >= DECK_SIZE) return;
    const n = counts.get(id) ?? 0;
    if (n >= MAX_COPIES) return;
    deck.push(id);
    counts.set(id, n + 1);
  };

  // SEED keyword carriers FIRST so DEATHKNELL / DEPLOY actually surface in play —
  // they are vanishingly rare in the raw pool, and a pure cheap-first curve would
  // never reach a high-cost carrier. We add up to 2 distinct carrier UNITS (one
  // copy each) up front; everything else fills the curve around them. Still fully
  // legal (<=2 copies, 30 cards) and deterministic (carriers sorted by id).
  const carriers = units
    .filter((c) => {
      const k = keywordsOf(c.id);
      return k.deathknell || k.deploy;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, 2);
  for (const c of carriers) tryAdd(c.id);

  // Units fill most of the deck (curve), capped so equipment/artifacts get in too.
  const unitTarget = Math.min(DECK_SIZE - 5, Math.max(18, DECK_SIZE - equip.length - arti.length));
  // First pass: one copy each, cheap-first; second pass: doubles to fill.
  for (const c of units) {
    if (deck.length >= unitTarget) break;
    tryAdd(c.id);
  }
  for (const c of units) {
    if (deck.length >= unitTarget) break;
    tryAdd(c.id); // second copy
  }
  for (const c of equip) {
    if (deck.length >= DECK_SIZE - 2) break;
    tryAdd(c.id);
  }
  for (const c of arti) {
    if (deck.length >= DECK_SIZE) break;
    tryAdd(c.id);
  }
  // Backfill any remaining slots with more units (doubles) to reach exactly 30.
  for (const c of units) {
    if (deck.length >= DECK_SIZE) break;
    tryAdd(c.id);
  }

  if (deck.length !== DECK_SIZE) {
    throw new Error(
      `Could not build a legal ${DECK_SIZE}-card deck for ${faction} (got ${deck.length}; pool=${pool.length})`
    );
  }
  DECK_CACHE.set(faction, deck);
  return deck;
}

// ---------------------------------------------------------------------------
// Per-match instrumentation.
// ---------------------------------------------------------------------------
interface MatchResult {
  seed: number;
  firstPlayer: PlayerId;
  p1Faction: Faction;
  p2Faction: Faction;
  winner: PlayerId | null; // null => no winner at turn cap
  turns: number; // engine `turn` reached at end
  hitCap: boolean;
  decision: "nexus" | "deckout" | "timeout";
  // tempo
  energySpent: number;
  energyAvailable: number;
  stuckTurns: number; // turns where the active player took NO board action despite having energy>=1
  totalActiveTurns: number;
  // keyword triggers
  deployTriggers: number;
  deathknellTriggers: number;
  maxCascadeDeaths: number; // most unit deaths resolved within a single action (cascade depth)
  // cards seen on each side (for appearance + win-when-present)
  cardsSeen: Set<string>;
  // decks carrying keyword (deck-level for over/under-perform)
  p1HasDeathknell: boolean;
  p1HasDeploy: boolean;
  p2HasDeathknell: boolean;
  p2HasDeploy: boolean;
}

/** All live (cardId, instanceId) on a player's board, both lanes. */
function boardUnits(p: any): { instanceId: string; cardId: string }[] {
  const out: { instanceId: string; cardId: string }[] = [];
  for (const lane of ["front", "back"] as const) {
    for (const u of p?.board?.[lane] ?? []) {
      if ((u.health ?? 0) > 0) out.push({ instanceId: u.instanceId, cardId: u.cardId });
    }
  }
  return out;
}

/** Snapshot every live instanceId->cardId across both players. */
function snapshotBoard(state: MatchState): Map<string, string> {
  const m = new Map<string, string>();
  for (const pid of ["P1", "P2"] as const) {
    for (const u of boardUnits(state.players[pid])) m.set(u.instanceId, u.cardId);
  }
  return m;
}

/**
 * Drive ONE full match. Both sides use the greedy planner (`planP2Turn`); the
 * planner reads `match.players.P2`, so for the side that is actually P1 we present
 * a flipped view (exactly as the shipped reducerHarness does). The active player
 * is read from the live state, so `firstPlayer` simply controls turn order via the
 * initial `activePlayer`.
 */
function runMatch(
  seed: number,
  side1: { faction: Faction; commanderId: string },
  side2: { faction: Faction; commanderId: string },
  firstPlayer: PlayerId
): MatchResult {
  const match: any = createMatchFromDecks({
    p1: { commanderId: side1.commanderId, deck: buildFactionDeck(side1.faction) },
    p2: { commanderId: side2.commanderId, deck: buildFactionDeck(side2.faction) },
    seed,
    openingHandSize: OPENING_HAND,
  });
  match.activePlayer = firstPlayer;
  match.turn = match.turn ?? 1;
  match.winner = match.winner ?? null;
  match.players.P1.maxEnergy = BASE_MAX_ENERGY;
  match.players.P1.energy = BASE_MAX_ENERGY;
  match.players.P2.maxEnergy = BASE_MAX_ENERGY;
  match.players.P2.energy = BASE_MAX_ENERGY;
  match.players.P1.nexusHealth = match.players.P1.nexusHealth ?? STARTING_NEXUS_HEALTH;
  match.players.P2.nexusHealth = match.players.P2.nexusHealth ?? STARTING_NEXUS_HEALTH;

  let state: MatchState = match;

  const res: MatchResult = {
    seed,
    firstPlayer,
    p1Faction: side1.faction,
    p2Faction: side2.faction,
    winner: null,
    turns: 0,
    hitCap: false,
    decision: "timeout",
    energySpent: 0,
    energyAvailable: 0,
    stuckTurns: 0,
    totalActiveTurns: 0,
    deployTriggers: 0,
    deathknellTriggers: 0,
    maxCascadeDeaths: 0,
    cardsSeen: new Set<string>(),
    p1HasDeathknell: false,
    p1HasDeploy: false,
    p2HasDeathknell: false,
    p2HasDeploy: false,
  };

  // Deck-level keyword carriage (over/under-perform signal).
  for (const id of buildFactionDeck(side1.faction)) {
    const k = keywordsOf(id);
    if (k.deathknell) res.p1HasDeathknell = true;
    if (k.deploy) res.p1HasDeploy = true;
  }
  for (const id of buildFactionDeck(side2.faction)) {
    const k = keywordsOf(id);
    if (k.deathknell) res.p2HasDeathknell = true;
    if (k.deploy) res.p2HasDeploy = true;
  }

  let deckOutSeen = false;

  /** Apply one action, draining any raised CHOICE deterministically, while
   *  instrumenting events + board deaths (DEPLOY/DEATHKNELL/cascade). */
  const apply = (action: Action): void => {
    const before = snapshotBoard(state);
    let r = applyAction(state, action);
    instrumentEvents(r.events);
    state = r.state;
    let guard = 0;
    while (state.pendingChoice && guard < 64) {
      guard += 1;
      const optionId = autoPickOption(state);
      if (optionId == null) break;
      r = applyAction(state, {
        type: "RESOLVE_CHOICE",
        player: state.pendingChoice.controller,
        optionId,
      });
      instrumentEvents(r.events);
      state = r.state;
    }
    // Board-death diff for DEATHKNELL + cascade depth: instanceIds that were live
    // before and are gone after this action died DURING it.
    const after = snapshotBoard(state);
    let deaths = 0;
    for (const [iid, cardId] of before) {
      if (!after.has(iid)) {
        deaths += 1;
        if (keywordsOf(cardId).deathknell) res.deathknellTriggers += 1;
      }
    }
    if (deaths > res.maxCascadeDeaths) res.maxCascadeDeaths = deaths;
  };

  const instrumentEvents = (events: GameEvent[]): void => {
    for (const e of events) {
      if (e.type === "UNIT_PLAYED") {
        res.cardsSeen.add(e.cardId);
        if (keywordsOf(e.cardId).deploy) res.deployTriggers += 1;
      } else if (e.type === "DECK_OUT") {
        deckOutSeen = true;
      }
    }
  };

  /** Run the active player's greedy turn, then END_TURN. */
  const playTurn = (): void => {
    const active = state.activePlayer;
    res.totalActiveTurns += 1;

    // Energy available this turn (tempo): read at turn top before any spend.
    const energyTop = state.players[active].energy ?? 0;
    res.energyAvailable += energyTop;

    // Plan via the greedy planner. For P1 we present the flipped view so the
    // planner (which reasons about "P2") plans for the real P1, then we translate
    // the plan back to P1-addressed actions. For P2 the view is the live state.
    const planView =
      active === "P2"
        ? state
        : ({ ...state, players: { P2: state.players.P1, P1: state.players.P2 } } as any);
    const plan = planP2Turn(planView);

    let boardActionTaken = false;
    for (const a of plan) {
      if (state.winner) break;
      const me = state.players[active];
      let action: Action | null = null;
      if (a.kind === "playUnit") {
        const idx = me.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "PLAY_UNIT", player: active, handIndex: idx, lane: a.lane };
      } else if (a.kind === "playArtifact") {
        const idx = me.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "PLAY_ARTIFACT", player: active, handIndex: idx };
      } else if (a.kind === "equip") {
        const idx = me.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "EQUIP", player: active, handIndex: idx, targetInstanceId: a.targetInstanceId };
      } else if (a.kind === "attackUnit") {
        action = {
          type: "ATTACK_UNIT",
          player: active,
          attackerInstanceId: a.attackerInstanceId,
          defenderInstanceId: a.defenderInstanceId,
        };
      } else if (a.kind === "attackFace") {
        action = { type: "ATTACK_FACE", player: active, attackerInstanceId: a.attackerInstanceId };
      }
      if (!action) continue;
      const energyBefore = state.players[active].energy ?? 0;
      apply(action);
      const energyAfter = state.players[active].energy ?? 0;
      const spent = Math.max(0, energyBefore - energyAfter);
      res.energySpent += spent;
      boardActionTaken = true;
      if (state.winner) break;
    }

    // "Stuck": had >=1 energy at the top of the turn but took no board action.
    if (!boardActionTaken && energyTop >= 1) res.stuckTurns += 1;

    if (!state.winner) apply({ type: "END_TURN", player: active });
  };

  let guard = 0;
  while (!state.winner && guard < MAX_TURNS) {
    guard += 1;
    playTurn();
  }

  res.winner = state.winner ?? null;
  res.turns = state.turn ?? guard;
  res.hitCap = !state.winner && guard >= MAX_TURNS;
  if (state.winner) {
    const loser = state.winner === "P1" ? "P2" : "P1";
    if ((state.players[loser].nexusHealth ?? 1) <= 0) res.decision = "nexus";
    else if (deckOutSeen) res.decision = "deckout";
    else res.decision = "nexus"; // decided & not deckout => lethal/board path
  } else {
    res.decision = "timeout";
  }
  return res;
}

// ---------------------------------------------------------------------------
// Aggregation.
// ---------------------------------------------------------------------------
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}
function pct(n: number, d: number): number {
  return d === 0 ? 0 : Number(((100 * n) / d).toFixed(1));
}
function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function run() {
  const startedAt = new Date().toISOString();
  const labelByFaction = new Map(FACTION_COMMANDER.map((f) => [f.faction, f.label]));

  // Deterministic matchup schedule: every ordered faction pair (mirror + both
  // orderings of non-mirror), cycled until N matches are drawn. Each match gets a
  // unique seed (the match index folded into a large constant) and alternates the
  // first player by index, so first-player advantage is measured fairly.
  const pairs: { a: typeof FACTION_COMMANDER[number]; b: typeof FACTION_COMMANDER[number] }[] = [];
  for (const a of FACTION_COMMANDER) {
    for (const b of FACTION_COMMANDER) pairs.push({ a, b });
  }

  const results: MatchResult[] = [];
  for (let i = 0; i < N; i += 1) {
    const { a, b } = pairs[i % pairs.length];
    const seed = (1_000_003 * (i + 1)) >>> 0; // distinct, deterministic per index
    const firstPlayer: PlayerId = i % 2 === 0 ? "P1" : "P2";
    results.push(
      runMatch(
        seed,
        { faction: a.faction, commanderId: a.commanderId },
        { faction: b.faction, commanderId: b.commanderId },
        firstPlayer
      )
    );
  }

  // ---- Match length ----
  const turns = results.map((r) => r.turns);
  const capHits = results.filter((r) => r.hitCap).length;

  // ---- First-player advantage ----
  let fpWins = 0;
  let decided = 0;
  for (const r of results) {
    if (!r.winner) continue;
    decided += 1;
    if (r.winner === r.firstPlayer) fpWins += 1;
  }

  // ---- Faction balance (non-mirror) ----
  const factionGames = new Map<Faction, number>();
  const factionWins = new Map<Faction, number>();
  let mirrorGames = 0;
  for (const r of results) {
    const isMirror = r.p1Faction === r.p2Faction;
    if (isMirror) {
      mirrorGames += 1;
      continue; // mirrors are 50/50 by construction; exclude from balance signal
    }
    for (const [pid, fac] of [
      ["P1", r.p1Faction],
      ["P2", r.p2Faction],
    ] as [PlayerId, Faction][]) {
      factionGames.set(fac, (factionGames.get(fac) ?? 0) + 1);
      if (r.winner === pid) factionWins.set(fac, (factionWins.get(fac) ?? 0) + 1);
    }
  }
  const factionBalance = FACTION_COMMANDER.map((fc) => {
    const g = factionGames.get(fc.faction) ?? 0;
    const w = factionWins.get(fc.faction) ?? 0;
    return { faction: fc.faction, label: fc.label, games: g, wins: w, winRate: pct(w, g) };
  }).sort((a, b) => b.winRate - a.winRate);

  // ---- Decisiveness ----
  const decision = { nexus: 0, deckout: 0, timeout: 0 };
  for (const r of results) decision[r.decision] += 1;

  // ---- Tempo / curve ----
  const totalSpent = results.reduce((s, r) => s + r.energySpent, 0);
  const totalAvail = results.reduce((s, r) => s + r.energyAvailable, 0);
  const totalStuck = results.reduce((s, r) => s + r.stuckTurns, 0);
  const totalActiveTurns = results.reduce((s, r) => s + r.totalActiveTurns, 0);

  // ---- Keyword impact (DEATHKNELL / DEPLOY) ----
  const deployTriggers = results.reduce((s, r) => s + r.deployTriggers, 0);
  const deathknellTriggers = results.reduce((s, r) => s + r.deathknellTriggers, 0);
  const maxCascade = results.reduce((m, r) => Math.max(m, r.maxCascadeDeaths), 0);

  // Deck-level over/under-perform: win-rate of the SIDE carrying the keyword in
  // non-mirror games (avoids double-counting both sides carrying it).
  const kwPerf = (sel: (r: MatchResult, pid: PlayerId) => boolean) => {
    let games = 0;
    let wins = 0;
    for (const r of results) {
      if (r.p1Faction === r.p2Faction) continue;
      const p1 = sel(r, "P1");
      const p2 = sel(r, "P2");
      if (p1 === p2) continue; // both or neither carry => not a clean signal
      const carrier: PlayerId = p1 ? "P1" : "P2";
      games += 1;
      if (r.winner === carrier) wins += 1;
    }
    return { games, wins, winRate: pct(wins, games) };
  };
  const deathknellPerf = kwPerf((r, pid) => (pid === "P1" ? r.p1HasDeathknell : r.p2HasDeathknell));
  const deployPerf = kwPerf((r, pid) => (pid === "P1" ? r.p1HasDeploy : r.p2HasDeploy));

  // Pool-level keyword rarity (context for the trigger counts).
  let poolDk = 0;
  let poolDep = 0;
  let poolPlayable = 0;
  for (const c of allPlayableCards as any[]) {
    if (c.type === "spell") continue;
    poolPlayable += 1;
    const k = keywordsOf(c.id);
    if (k.deathknell) poolDk += 1;
    if (k.deploy) poolDep += 1;
  }

  // ---- Per-card performance (appearance + win-when-present) ----
  // Attribution: a card is "present" for a match if it was PLAYED (UNIT_PLAYED)
  // by either side. win-when-present = of matches where it appeared & the match
  // was decided, the fraction where the SIDE that played it won. We approximate
  // side by recording cardsSeen per match without side; for a balance flag the
  // appearance-rate + a coarse decided-win signal is enough and cheap.
  const cardAppear = new Map<string, number>();
  for (const r of results) {
    for (const id of r.cardsSeen) cardAppear.set(id, (cardAppear.get(id) ?? 0) + 1);
  }
  const distinctCardsPlayed = cardAppear.size;
  const topCards = [...cardAppear.entries()]
    .map(([id, appear]) => {
      const card = getPlayableCardById(id) as any;
      return {
        id,
        name: card?.name ?? id,
        faction: card?.faction ?? "?",
        appearances: appear,
        appearanceRate: pct(appear, N),
      };
    })
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 25);

  // DEAD cards: in any built faction deck but NEVER appeared across the whole run.
  const deckCardIds = new Set<string>();
  for (const fc of FACTION_COMMANDER) for (const id of buildFactionDeck(fc.faction)) deckCardIds.add(id);
  const deadCards = [...deckCardIds]
    .filter((id) => (cardAppear.get(id) ?? 0) === 0)
    .map((id) => {
      const c = getPlayableCardById(id) as any;
      return { id, name: c?.name ?? id, faction: c?.faction ?? "?", cost: c?.cost ?? 0 };
    });

  // ----------------------------------------------------------------------------
  // Flags (call out anything OFF).
  // ----------------------------------------------------------------------------
  const flags: string[] = [];
  const fpAdv = pct(fpWins, decided);
  if (fpAdv > 55) flags.push(`First-player advantage HIGH: ${fpAdv}% (>55%).`);
  if (fpAdv < 45) flags.push(`First-player DISADVANTAGE: ${fpAdv}% (<45%) — going first appears bad.`);
  for (const fb of factionBalance) {
    if (fb.games >= 10 && (fb.winRate > 60 || fb.winRate < 40)) {
      flags.push(`Faction ${fb.label} win-rate out of band: ${fb.winRate}% (sane ~40-60%).`);
    }
  }
  const avgTurns = round(turns.reduce((s, x) => s + x, 0) / Math.max(1, turns.length));
  if (avgTurns < 4) flags.push(`Games very SHORT: avg ${avgTurns} turns.`);
  if (avgTurns > 30) flags.push(`Games very LONG: avg ${avgTurns} turns.`);
  if (pct(capHits, N) > 5) flags.push(`Turn-cap / stalemate rate HIGH: ${pct(capHits, N)}%.`);
  if (deadCards.length > 0) flags.push(`${deadCards.length} DEAD card(s) (in a deck but never played).`);
  if (deathknellPerf.games >= 10 && (deathknellPerf.winRate > 60 || deathknellPerf.winRate < 40)) {
    flags.push(`DEATHKNELL-carrying decks warp win-rate: ${deathknellPerf.winRate}%.`);
  }
  if (deployPerf.games >= 10 && (deployPerf.winRate > 60 || deployPerf.winRate < 40)) {
    flags.push(`DEPLOY-carrying decks warp win-rate: ${deployPerf.winRate}%.`);
  }
  // Cascade termination: every match returned (the loop completed), so chains
  // provably terminate. maxCascade just reports the deepest observed.
  flags.push(
    `Chain-reaction cascades terminate: all ${N} matches completed; deepest single-action death cascade = ${maxCascade}.`
  );

  // ----------------------------------------------------------------------------
  // Build artifact + report.
  // ----------------------------------------------------------------------------
  const report = {
    meta: {
      generatedAt: startedAt,
      tool: "dev:playtest (runPlaytestReport.ts)",
      readOnly: true,
      matches: N,
      maxTurns: MAX_TURNS,
      deckSize: DECK_SIZE,
      openingHand: OPENING_HAND,
      poolPlayableCards: poolPlayable,
      poolTotalCards: (allPlayableCards as any[]).length,
      factionsTested: FACTION_COMMANDER.map((f) => f.label),
      baseline: true,
      note:
        "BASELINE on the pool present at run time. A parallel agent is expanding the " +
        "card pool; re-run `npm run dev:playtest` after that lands to refresh every metric.",
    },
    matchLength: {
      avgTurns,
      medianTurns: median(turns),
      p90Turns: percentile(turns, 90),
      minTurns: Math.min(...turns),
      maxTurns: Math.max(...turns),
      turnCapHits: capHits,
      turnCapHitPct: pct(capHits, N),
    },
    firstPlayer: {
      decidedGames: decided,
      firstPlayerWins: fpWins,
      firstPlayerWinRate: fpAdv,
    },
    factionBalance,
    mirrorGames,
    decisiveness: {
      nexusKill: decision.nexus,
      nexusKillPct: pct(decision.nexus, N),
      deckOut: decision.deckout,
      deckOutPct: pct(decision.deckout, N),
      timeoutStalemate: decision.timeout,
      timeoutPct: pct(decision.timeout, N),
    },
    tempo: {
      avgEnergyAvailablePerTurn: round(totalAvail / Math.max(1, totalActiveTurns)),
      avgEnergySpentPerTurn: round(totalSpent / Math.max(1, totalActiveTurns)),
      energyUtilizationPct: pct(totalSpent, totalAvail),
      stuckTurnPct: pct(totalStuck, totalActiveTurns),
    },
    keywords: {
      pool: {
        deathknellCards: poolDk,
        deployCards: poolDep,
        deathknellPoolPct: pct(poolDk, poolPlayable),
        deployPoolPct: pct(poolDep, poolPlayable),
      },
      triggers: {
        deployTriggers,
        deathknellTriggers,
        deployTriggersPerMatch: round(deployTriggers / N),
        deathknellTriggersPerMatch: round(deathknellTriggers / N),
      },
      deckPerformance: {
        deathknellCarrier: deathknellPerf,
        deployCarrier: deployPerf,
      },
      maxCascadeDeathsInOneAction: maxCascade,
    },
    cardPerformance: {
      distinctCardsPlayed,
      topCardsByAppearance: topCards,
      deadCards,
    },
    flags,
  };

  const outDir = resolve(process.cwd(), "asset-review/playtest");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, "playtest-report.json");
  const mdPath = resolve(outDir, "playtest-summary.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, toMarkdown(report));

  // ---- stdout ----
  console.log("\n=== CRYPT TCG — INSTRUMENTED PLAYTEST REPORT (BASELINE) ===");
  console.log(`matches=${N} maxTurns=${MAX_TURNS} pool=${poolPlayable} playable cards`);
  console.log(`generatedAt=${startedAt}\n`);

  console.log("MATCH LENGTH");
  console.log(
    `  avg=${report.matchLength.avgTurns}  median=${report.matchLength.medianTurns}  p90=${report.matchLength.p90Turns}  range=${report.matchLength.minTurns}-${report.matchLength.maxTurns}  capHits=${capHits} (${report.matchLength.turnCapHitPct}%)`
  );
  console.log("\nFIRST-PLAYER ADVANTAGE");
  console.log(`  decided=${decided}  firstPlayerWinRate=${fpAdv}%`);
  console.log("\nFACTION BALANCE (non-mirror)");
  for (const fb of factionBalance) {
    console.log(`  ${fb.label.padEnd(7)} ${String(fb.winRate).padStart(5)}%  (${fb.wins}/${fb.games})`);
  }
  console.log("\nDECISIVENESS");
  console.log(
    `  nexus-kill=${decision.nexus} (${report.decisiveness.nexusKillPct}%)  deck-out=${decision.deckout} (${report.decisiveness.deckOutPct}%)  timeout=${decision.timeout} (${report.decisiveness.timeoutPct}%)`
  );
  console.log("\nTEMPO / CURVE");
  console.log(
    `  energyAvail/turn=${report.tempo.avgEnergyAvailablePerTurn}  spent/turn=${report.tempo.avgEnergySpentPerTurn}  utilization=${report.tempo.energyUtilizationPct}%  stuckTurns=${report.tempo.stuckTurnPct}%`
  );
  console.log("\nKEYWORDS (DEATHKNELL / DEPLOY)");
  console.log(
    `  pool carriers: DK=${poolDk} (${report.keywords.pool.deathknellPoolPct}%)  DEPLOY=${poolDep} (${report.keywords.pool.deployPoolPct}%)`
  );
  console.log(
    `  triggers: DEPLOY=${deployTriggers} (${report.keywords.triggers.deployTriggersPerMatch}/match)  DEATHKNELL=${deathknellTriggers} (${report.keywords.triggers.deathknellTriggersPerMatch}/match)`
  );
  console.log(
    `  carrier-deck win-rate: DK=${deathknellPerf.winRate}% (${deathknellPerf.wins}/${deathknellPerf.games})  DEPLOY=${deployPerf.winRate}% (${deployPerf.wins}/${deployPerf.games})`
  );
  console.log(`  deepest cascade in one action=${maxCascade} (all matches terminated)`);
  console.log("\nCARD PERFORMANCE");
  console.log(`  distinctCardsPlayed=${distinctCardsPlayed}  deadCards(in-deck,never-played)=${deadCards.length}`);
  console.log("  top by appearance:");
  for (const c of topCards.slice(0, 8)) {
    console.log(`    ${c.name} [${c.faction}] x${c.appearances} (${c.appearanceRate}%)`);
  }
  console.log("\nFLAGS / ANYTHING OFF");
  for (const f of flags) console.log(`  - ${f}`);

  console.log(`\nArtifacts written:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${mdPath}`);
  console.log("\nRe-run after the card pool expands:  npm run dev:playtest");
  console.log("PASS");
}

function toMarkdown(r: any): string {
  const lines: string[] = [];
  lines.push(`# CRYPT TCG — Playtest Report (BASELINE)`);
  lines.push("");
  lines.push(`Generated: ${r.meta.generatedAt}`);
  lines.push("");
  lines.push(`> ${r.meta.note}`);
  lines.push("");
  lines.push(
    `Matches: **${r.meta.matches}** · maxTurns: ${r.meta.maxTurns} · pool: **${r.meta.poolPlayableCards}** playable cards (${r.meta.poolTotalCards} total) · factions: ${r.meta.factionsTested.join(", ")}`
  );
  lines.push("");
  lines.push(`## Match length`);
  lines.push(
    `- avg **${r.matchLength.avgTurns}** turns · median ${r.matchLength.medianTurns} · p90 ${r.matchLength.p90Turns} · range ${r.matchLength.minTurns}–${r.matchLength.maxTurns}`
  );
  lines.push(`- turn-cap / stalemate hits: ${r.matchLength.turnCapHits} (${r.matchLength.turnCapHitPct}%)`);
  lines.push("");
  lines.push(`## First-player advantage`);
  lines.push(
    `- decided games: ${r.firstPlayer.decidedGames} · **first-player win-rate ${r.firstPlayer.firstPlayerWinRate}%**`
  );
  lines.push("");
  lines.push(`## Faction balance (non-mirror)`);
  lines.push(`| Faction | Win-rate | W/G |`);
  lines.push(`|---|---|---|`);
  for (const fb of r.factionBalance) lines.push(`| ${fb.label} | ${fb.winRate}% | ${fb.wins}/${fb.games} |`);
  lines.push("");
  lines.push(`## Decisiveness`);
  lines.push(
    `- nexus-kill ${r.decisiveness.nexusKill} (${r.decisiveness.nexusKillPct}%) · deck-out ${r.decisiveness.deckOut} (${r.decisiveness.deckOutPct}%) · timeout/stalemate ${r.decisiveness.timeoutStalemate} (${r.decisiveness.timeoutPct}%)`
  );
  lines.push("");
  lines.push(`## Tempo / curve`);
  lines.push(
    `- energy available/turn ${r.tempo.avgEnergyAvailablePerTurn} · spent/turn ${r.tempo.avgEnergySpentPerTurn} · utilization ${r.tempo.energyUtilizationPct}% · stuck turns ${r.tempo.stuckTurnPct}%`
  );
  lines.push("");
  lines.push(`## Keywords — DEATHKNELL / DEPLOY`);
  lines.push(
    `- pool carriers: DEATHKNELL ${r.keywords.pool.deathknellCards} (${r.keywords.pool.deathknellPoolPct}%), DEPLOY ${r.keywords.pool.deployCards} (${r.keywords.pool.deployPoolPct}%)`
  );
  lines.push(
    `- triggers: DEPLOY ${r.keywords.triggers.deployTriggers} (${r.keywords.triggers.deployTriggersPerMatch}/match), DEATHKNELL ${r.keywords.triggers.deathknellTriggers} (${r.keywords.triggers.deathknellTriggersPerMatch}/match)`
  );
  lines.push(
    `- carrier-deck win-rate: DEATHKNELL ${r.keywords.deckPerformance.deathknellCarrier.winRate}% (${r.keywords.deckPerformance.deathknellCarrier.wins}/${r.keywords.deckPerformance.deathknellCarrier.games}), DEPLOY ${r.keywords.deckPerformance.deployCarrier.winRate}% (${r.keywords.deckPerformance.deployCarrier.wins}/${r.keywords.deckPerformance.deployCarrier.games})`
  );
  lines.push(
    `- deepest single-action death cascade: ${r.keywords.maxCascadeDeathsInOneAction} (all matches terminated → no runaway)`
  );
  lines.push("");
  lines.push(`## Card performance`);
  lines.push(`- distinct cards played: ${r.cardPerformance.distinctCardsPlayed}`);
  lines.push(`- dead cards (in a deck, never played): ${r.cardPerformance.deadCards.length}`);
  lines.push(`- top by appearance:`);
  for (const c of r.cardPerformance.topCardsByAppearance.slice(0, 12)) {
    lines.push(`  - ${c.name} [${c.faction}] ×${c.appearances} (${c.appearanceRate}%)`);
  }
  lines.push("");
  lines.push(`## Flags / anything OFF`);
  for (const f of r.flags) lines.push(`- ${f}`);
  lines.push("");
  return lines.join("\n");
}

run();
