/**
 * dev:behavioral-coverage — the HONEST coverage report.
 *
 * The existing `dev:effect-coverage` report claims ~99% "recognized", but
 * "recognized" only means the parser CLASSIFIED the text. It counts no-op
 * classes (STAT_LINE / GRANT_KEYWORD / KEYWORD_WIRED / GLOBAL_UNPARSED) and
 * parsed-but-never-fired triggers (ON_DEATH / ON_TURN_END) as wins. None of
 * those change a single value at runtime.
 *
 * This report measures the number that actually matters: over allPlayableCards,
 * what fraction have an ability that ACTUALLY DOES SOMETHING when the reducer
 * runs — i.e. at least one compiled spec whose op is ACTIVE *and* whose trigger
 * is one the reducer fires (ON_SUMMON / ON_ATTACK / ON_DAMAGE / ON_TURN_START),
 * OR a consumed PASSIVE op (PIERCE_ARMOR / RESTRICT_ATTACK / AURA_FACTION_STAT).
 * Call that "behaviorally wired". Everything else is "inert".
 *
 * NOTHING here mutates match state. It only reads the compiler output. This is a
 * REPORT, not a gate: it always exits 0.
 */

import { compileAbility, EffectOp, EffectTrigger } from "../engine/abilityCompiler";
import { allPlayableCards } from "../engine/cards";

// Triggers the reducer (reducer.ts) actually fires:
//   ON_SUMMON  -> PLAY_UNIT
//   ON_ATTACK  -> ATTACK_UNIT / ATTACK_FACE
//   ON_DAMAGE  -> ATTACK_UNIT (taunt riders + on-damage reactions)
//   ON_TURN_START -> END_TURN (start of the beginning player's turn)
//   ON_TURN_END   -> END_TURN (end of the ending player's turn: self-decay/heal)
//   ON_DEATH      -> resolveDeaths() (summon-on-death)
const FIRED_TRIGGERS = new Set<EffectTrigger>([
  "ON_SUMMON",
  "ON_ATTACK",
  "ON_DAMAGE",
  "ON_TURN_START",
  "ON_TURN_END",
  "ON_DEATH",
]);

// PASSIVE ops the reducer consumes directly (combat math / aura recompute):
//   PIERCE_ARMOR     -> passiveSpec(..., "PIERCE_ARMOR") at attack time
//   RESTRICT_ATTACK  -> passiveSpec(..., "RESTRICT_ATTACK") (Fear, PASSIVE only)
//   AURA_FACTION_STAT-> recomputeAuras()
const CONSUMED_PASSIVE_OPS = new Set<EffectOp>(["PIERCE_ARMOR", "RESTRICT_ATTACK", "AURA_FACTION_STAT"]);

// Active (non-no-op) ops. STAT_LINE/GRANT_KEYWORD/KEYWORD_WIRED/GLOBAL_UNPARSED/
// UNKNOWN are no-ops. compiled.specs already excludes those, but we re-check op
// membership defensively against this explicit allow-list.
const ACTIVE_OPS = new Set<EffectOp>([
  "DEAL_DAMAGE",
  "DAMAGE_ADJACENT_ENEMIES",
  "HEAL",
  "HEAL_NEXUS",
  "BUFF_SELF",
  "BUFF_ALLIES",
  "DEBUFF_ENEMY",
  "SUMMON_TOKEN",
  "DRAW",
  "DESTROY_UNIT",
  "RETURN_TO_HAND",
  "CLEAVE",
  "COPY_UNIT",
  "RESURRECT",
  "RETURN_FROM_GRAVE",
  "PIERCE_ARMOR",
  "RESTRICT_ATTACK",
  "AURA_FACTION_STAT",
  // Deck-manipulation ops (live via the SPELL archetype; resolved deterministically
  // against the controller's own deck on an ON_SUMMON/cast trigger).
  "TUTOR_FROM_DECK",
  "DRAW_FILTERED",
  "SCRY_DYNAMIC",
  "MILL_FROM_DECK",
]);

/** Does this single spec actually do something at runtime? */
function specIsWired(op: EffectOp, trigger: EffectTrigger): boolean {
  if (!ACTIVE_OPS.has(op)) return false;
  // Consumed passives are wired regardless of trigger label (the reducer reads
  // them by op directly), but the compiler emits them with trigger PASSIVE.
  if (CONSUMED_PASSIVE_OPS.has(op)) {
    // RESTRICT_ATTACK is only consumed as a Fear passive when trigger===PASSIVE
    // (Patient emits a STATIC RESTRICT_ATTACK that the reducer's passiveSpec gate
    // explicitly excludes — see reducer.ts passiveSpec()).
    if (op === "RESTRICT_ATTACK") return trigger === "PASSIVE";
    return true;
  }
  // Everything else needs a trigger the reducer fires.
  return FIRED_TRIGGERS.has(trigger);
}

let total = 0;
let wired = 0;
let inert = 0;
const opHistogram = new Map<EffectOp, number>(); // primary fired op per wired card
const dormantTriggers = new Map<EffectTrigger, number>(); // parsed-but-never-fired specs

for (const card of allPlayableCards) {
  total += 1;
  const ability = card.rawTraits?.Ability;
  const compiled = compileAbility(ability);

  let cardWired = false;
  let primaryOp: EffectOp | null = null;

  for (const spec of compiled.specs) {
    if (specIsWired(spec.op, spec.trigger)) {
      cardWired = true;
      if (primaryOp === null) primaryOp = spec.op; // first wired spec = primary
    } else if (
      // A real, active op that exists but whose trigger the reducer never fires:
      // the "parsed-but-dormant" set (e.g. ON_TURN_END, ON_DEATH, STATIC).
      ACTIVE_OPS.has(spec.op) &&
      !CONSUMED_PASSIVE_OPS.has(spec.op) &&
      !FIRED_TRIGGERS.has(spec.trigger)
    ) {
      dormantTriggers.set(spec.trigger, (dormantTriggers.get(spec.trigger) ?? 0) + 1);
    } else if (
      // RESTRICT_ATTACK emitted as STATIC (Patient marker) is also dormant.
      spec.op === "RESTRICT_ATTACK" &&
      spec.trigger !== "PASSIVE"
    ) {
      dormantTriggers.set(spec.trigger, (dormantTriggers.get(spec.trigger) ?? 0) + 1);
    }
  }

  if (cardWired && primaryOp) {
    wired += 1;
    opHistogram.set(primaryOp, (opHistogram.get(primaryOp) ?? 0) + 1);
  } else {
    inert += 1;
  }
}

const pct = (n: number) => (total === 0 ? "0.00" : ((n / total) * 100).toFixed(2));

console.log("\n=== BEHAVIORAL COVERAGE (does the ability actually DO something?) ===\n");
console.log(`Total playable cards:        ${total}`);
console.log(`Behaviorally wired:          ${wired}  (${pct(wired)}%)`);
console.log(`Inert (no-op / unfired):     ${inert}  (${pct(inert)}%)`);

console.log("\n--- Behaviorally-wired cards by primary fired op ---");
const opRows = [...opHistogram.entries()].sort((a, b) => b[1] - a[1]);
if (opRows.length === 0) {
  console.log("  (none)");
} else {
  for (const [op, n] of opRows) {
    console.log(`  ${op.padEnd(18)} ${String(n).padStart(5)}`);
  }
}

console.log("\n--- Parsed-but-dormant specs (active op, trigger the reducer never fires) ---");
const dormantRows = [...dormantTriggers.entries()].sort((a, b) => b[1] - a[1]);
if (dormantRows.length === 0) {
  console.log("  (none)");
} else {
  for (const [trigger, n] of dormantRows) {
    console.log(`  ${String(trigger).padEnd(18)} ${String(n).padStart(5)}`);
  }
}

console.log(
  `\n=== HEADLINE: ${pct(wired)}% behaviorally wired ` +
    `(vs the misleading ~99.10% "recognized" parse number) ===\n`
);

// REPORT, not a gate: always succeed.
process.exit(0);
