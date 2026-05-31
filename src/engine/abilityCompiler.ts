/**
 * abilityCompiler — Phase A of the effect system.
 *
 * Pure, deterministic compiler that turns a card's free-text mechanical ability
 * (`generatedTcgCards.json` -> `rawTraits.Ability`) into a typed Effect IR
 * (`EffectSpec[]`). NOTHING here mutates match state; this is the parse layer.
 * The resolver (Phase B) and reducer trigger wiring (Phase C) consume this IR.
 *
 * Two hard rules established by the Phase-A data investigation:
 *   1. "+X Attack. +Y Health." stat lines are STATIC — the printed stats are
 *      already baked into the live runtime tuple (verified 964/964). They must
 *      NOT become additive buffs or every stat doubles. We classify them as
 *      `STAT_LINE` (recognized, but emits no runtime op).
 *   2. Keywords already wired into the reducer (GUARD, DEATHRATTLE, LIFESTEAL,
 *      FLYING, EXECUTE, RUSH/CHARGE, CRUSH/TRAMPLE, SCRY, REGROW, WARD,
 *      DIVINE_SHIELD, ARMORED, STEALTH) are reminder-only here -> `KEYWORD_WIRED`
 *      (recognized, emits no op) so effects never double-fire.
 *
 * Only the genuinely-new clauses (Summon token, Rally, Judgment, Decay, Fear,
 * Patient, Oath/Vow/Martyr, Taunt riders, ...) compile to real ops.
 */

export type EffectTrigger =
  | "ON_SUMMON"
  | "ON_DEATH"
  | "ON_ATTACK"
  | "ON_DAMAGE"
  | "ON_TURN_START"
  | "ON_TURN_END"
  | "PASSIVE"
  | "STATIC";

export type EffectOp =
  | "DEAL_DAMAGE"
  | "HEAL"
  | "BUFF_SELF"
  | "BUFF_ALLIES"
  | "DEBUFF_ENEMY"
  | "SUMMON_TOKEN"
  | "PIERCE_ARMOR"
  | "RESTRICT_ATTACK"
  | "DRAW"
  | "DESTROY_UNIT" // hard removal: reduce a targeted unit to 0 health outright
  | "HEAL_NEXUS" // restore N to the controller's own nexus (capped at start HP)
  | "RETURN_TO_HAND" // bounce: remove a targeted unit and return its card to hand
  | "CLEAVE" // on-attack splash: damage the struck defender's board-neighbors
  | "DAMAGE_ADJACENT_ENEMIES" // self-anchored: damage the enemy unit(s) adjacent to the source
  | "COPY_UNIT" // on-summon: copy a target unit's stats/keywords/abilities onto self
  | "RESURRECT" // graveyard: resummon a dead friendly unit onto the controller's board
  | "RETURN_FROM_GRAVE" // graveyard: return a dead friendly unit's card to the controller's hand
  | "AURA_FACTION_STAT" // continuous: "Other <Faction> gain +X/+Y while this is in play"
  | "AURA_ALLY_STAT" // continuous: "[other] allied units gain +X/+Y while this is in play" (non-faction)
  | "AURA_KEYWORD" // continuous: "[other/adjacent] allies gain <KEYWORD> while this is in play"
  | "AURA_ADJACENT_STAT" // continuous: "adjacent allies gain +X/+Y" (same-lane index ±1)
  | "DESTROY_ENEMY_SELECT" // on-summon: destroy one enemy unit chosen by a selector
  | "DEBUFF_ALL_ENEMIES" // on-summon: -N attack to ALL enemy units, this turn only
  | "COMMANDER_SHIELD" // passive: enemies cannot attack the controller's nexus directly
  | "MIRROR_ATTACK" // on-attack: a phantom copy strikes the same defender, then vanishes
  | "AURA_COST_REDUCTION" // continuous: friendly units cost N less to play (floor 0)
  | "RESURRECT_AS_TOKEN" // graveyard: resummon a dead friendly unit as a 1/1 token
  | "SUMMON_ON_ANY_DEATH" // watcher: ANY unit dies -> summon a token for the controller
  | "PASSIVE_FLOOR_HP" // passive: no single damage instance reduces this unit below 1
  | "ONCEDEATH_REVIVE" // once-per-match: on death, return to board at full HP instead
  | "SWAP_STATS_ALL_ENEMIES" // on-summon: swap attack/health of every enemy unit
  | "DOUBLE_ATTACK" // passive: this unit may attack twice per turn
  | "AURA_SPELL_COST" // continuous: friendly spells cost N less
  | "AURA_ABILITY_SILENCE" // continuous: enemy units cannot trigger their abilities
  // Deck-manipulation ops (deterministic; operate on the controller's own deck):
  | "TUTOR_FROM_DECK" // search the deck for a selector-matched card -> hand
  | "DRAW_FILTERED" // draw the first N cards of a given type from the deck top -> hand
  | "SCRY_DYNAMIC" // reorder the top N of the deck deterministically (parameterized scryDeck)
  | "MILL_FROM_DECK" // move the top N cards of the deck to the discard pile (no hand)
  // Recognized-but-no-op classifications (so coverage can be measured):
  | "STAT_LINE" // static stat text, already in the card's stats
  | "GRANT_KEYWORD" // "Grants X" — keyword already on the tuple, descriptive
  | "KEYWORD_WIRED" // reminder for a keyword already live in the reducer
  | "GLOBAL_UNPARSED" // "Global effect active while in play." — body varies
  | "UNKNOWN"; // long-tail / bespoke text not yet templated

export interface EffectSpec {
  trigger: EffectTrigger;
  op: EffectOp;
  /** Primary magnitude (damage dealt, healed, attack debuff, etc.). */
  amount?: number;
  /** Stat deltas for buffs and token stats. */
  attack?: number;
  health?: number;
  /** SUMMON_TOKEN: the token's display name (e.g. "Revenant"). */
  token?: string;
  /** GRANT_KEYWORD / KEYWORD_WIRED: the keyword involved. */
  keyword?: string;
  /** FEAR / RESTRICT_ATTACK: only enemies at/below this cost are restricted. */
  costThreshold?: number;
  /** OATH / VOW / MARTYR: faction the buff scales by. */
  scaleFaction?: string;
  /** Generic per-X scaling for a BUFF_SELF: multiply the attack/health delta by a
   *  live board/hand count. The faction path (`scaleFaction`) is kept separate. */
  scaleBy?: "ALLY_COUNT" | "ENEMY_COUNT" | "CARDS_IN_HAND" | "ADJACENT_UNITS";
  /** SUMMON_TOKEN: mint this many copies of the token (defaults to 1). */
  count?: number;
  /** DAMAGE_ADJACENT_ENEMIES: true = hit ALL adjacent enemies ("all adjacent
   *  foes/lanes"); false/undefined = hit a single adjacent enemy ("an adjacent
   *  enemy", e.g. Decay). Same-lane array index±1 only — no cross-lane grid. */
  allAdjacent?: boolean;
  /** A keyword to stamp onto a summoned token's `keywords` array. */
  tokenKeyword?: string;
  /** Optional gate evaluated against the live ctx before the effect resolves. If
   *  the predicate is false the spec no-ops. Conditions are deterministic:
   *   - SURVIVED          — ctx.source.health > 0 (post-combat "if it survives").
   *   - ALLY_COUNT_GTE    — controller controls >= value allied units.
   *   - SELF_HEALTH_BELOW — ctx.source.health <= value. */
  condition?: { kind: "SURVIVED" | "ALLY_COUNT_GTE" | "SELF_HEALTH_BELOW"; value?: number };
  /** DEAL_DAMAGE / HEAL: when true the effect targets the SOURCE unit itself
   *  (end-of-turn self-decay / self-heal), so no explicit ctx.target is needed. */
  self?: boolean;
  /** Continuous auras (AURA_*_STAT / AURA_KEYWORD): when true the source unit is
   *  ALSO a beneficiary ("your X gain ..." with no "other"). Default false =
   *  "other" semantics (the source excludes itself). */
  includeSelf?: boolean;
  /** DESTROY_ENEMY_SELECT: how the victim is chosen, deterministically.
   *   - HIGHEST_COST     — the highest-cost enemy unit (tie-break: board index).
   *   - RANDOM_COST_GATE — highest-cost enemy whose cost <= the source's attack. */
  selector?: "HIGHEST_COST" | "RANDOM_COST_GATE" | "ATTACK_GATE";
  /** RESURRECT_AS_TOKEN: stamp this keyword onto the revived 1/1 token. */
  reviveKeyword?: string;
  /** TUTOR_FROM_DECK: how the searched card is chosen, deterministically. The pick
   *  is by the selector's ordering with a deck-index tie-break; empty/no-match is a
   *  clean no-op. */
  tutorSelector?: "LOWEST_COST_UNIT" | "LOWEST_COST_SPELL" | "HIGHEST_COST_UNIT";
  /** DRAW_FILTERED: the card type to draw from the deck top (others are skipped). */
  drawType?: "UNIT" | "SPELL";
  /** The source clause this spec was compiled from (for debugging/proofs). */
  raw: string;
}

export interface CompiledAbility {
  /** Real runtime effects (excludes STATIC / KEYWORD_WIRED / GRANT_KEYWORD). */
  specs: EffectSpec[];
  /** Every classification, including the no-op recognized ones. */
  classified: EffectSpec[];
  /** True if every meaningful clause was classified (nothing left UNKNOWN). */
  recognized: boolean;
}

/** Keywords already implemented in the live reducer — reminder text only. */
const WIRED_KEYWORDS: Record<string, string> = {
  guard: "GUARD",
  taunt: "GUARD", // Taunt's redirect maps onto GUARD; riders parsed separately
  deathrattle: "DEATHRATTLE",
  lifedrain: "LIFESTEAL",
  lifesteal: "LIFESTEAL",
  flying: "FLYING",
  execute: "EXECUTE",
  charge: "RUSH",
  rush: "RUSH",
  trample: "CRUSH",
  crush: "CRUSH",
  scry: "SCRY",
  regrow: "REGROW",
  ward: "WARD",
  armored: "ARMORED",
  stealth: "STEALTH",
  veil: "STEALTH",
  shield: "SHIELD",
  "divine shield": "DIVINE_SHIELD",
};

/** Split an ability into independent clauses on sentence boundaries. */
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!])\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

const STAT_LINE_RE = /^(?:\+\d+\s+(?:attack|health)\.?\s*)+$/i;
// Stat prefix followed only by a "Grants <KW>" clause: still fully static — the
// stats are baked into the tuple and the granted keyword is already on it.
const STAT_THEN_GRANT_RE = /^(?:\+\d+\s+(?:attack|health)\.?\s*)+grants?\s+[a-z _]+\.?$/i;
const GRANTS_RE = /grants?\s+([a-z _]+?)(?:\.|$)/i;
const TOKEN_RE = /create\s+(?:a|an|one)?\s*(\d+)\s*\/\s*(\d+)\s+([a-z][a-z ]*?)\s+token/i;
const COST_THRESHOLD_RE = /(\d+)\s*cost\s*or\s*(?:less|fewer)/i;
const ATTACK_DELTA_RE = /\+(\d+)\s*attack/i;
const HEALTH_DELTA_RE = /\+(\d+)\s*health/i;
const NN_DELTA_RE = /\+?(\d+)\s*\/\s*\+?(\d+)/;
const FOR_EACH_RE = /\+(\d+)\s*\/\s*\+?(\d+)\s+for\s+each\s+([a-z][a-z ]*)/i;
const DEAL_RE = /deals?\s+(\d+)\s+damage/i;
// Nexus heal ("restore/heal/gain N ... to your nexus/hero/face"): the trailing
// nexus noun is required so this never swallows a unit-target heal.
const NEXUS_HEAL_RE = /(?:heal|restore|gain)\s+(\d+)[^.]*\b(?:nexus|hero|face)\b/i;
// Hard removal ("destroy ...") and bounce ("return/bounce ... to ... hand").
const DESTROY_RE = /\bdestroy\b/i;
const RETURN_HAND_RE = /\b(?:return|bounce)\b[^.]*\bto\b[^.]*\bhand\b/i;
const HEAL_RE = /(?:heal|restore)\s+(?:them\s+|your\s+\w+\s+)?(?:to\s+full|(\d+)\s*(?:health|life)?)/i;
// GRAVEYARD ops. A clause must mention the graveyard/grave AND a clear verb to be
// classified — anything ambiguous is left UNKNOWN (the honest default).
//
//   RETURN_FROM_GRAVE: "return/restore/recall ... from [your] graveyard ... to
//     [your] hand". The trailing "hand" noun is required so a return-to-board
//     ("to play") is never misread as a return-to-hand.
const RETURN_FROM_GRAVE_RE =
  /\b(?:return|restore|recall|recover)\b[^.]*\b(?:grave(?:yard)?)\b[^.]*\bto\b[^.]*\bhand\b|\brecalls?\b[^.]*\bgrave(?:yard)?\b[^.]*\bto\b[^.]*\bhand\b/i;
//   RESURRECT: "resurrect/resummon/reanimate/revive/return a friendly unit from
//     your graveyard to play/the battlefield". Requires both a resurrect verb and
//     a "to play / to the battlefield / onto the battlefield" board destination —
//     so it never collides with the return-to-hand path above.
const RESURRECT_RE =
  /\b(?:resurrect|resummon|reanimate)\b[^.]*\bgrave(?:yard)?\b|\b(?:revive|return|raise)\b[^.]*\bgrave(?:yard)?\b[^.]*\bto\b[^.]*\b(?:play|the battlefield|the field)\b/i;
// Regrow self-recursion ("When this unit dies, return/restore IT to your hand
// [after N turns / at the start of your next turn / with +N/+N]"). The unit is
// already recorded in its owner's graveyard before its ON_DEATH fires, so the
// existing RETURN_FROM_GRAVE op (pop most-recent grave record back to hand) is the
// exact behavior. The "to your hand" destination is REQUIRED — a "return to deck"
// has no engine op and must stay UNKNOWN. The timing words are flavor we ignore.
const REGROW_RETURN_RE =
  /\b(?:return|restore|recall)\b[^.]*\bit\b[^.]*\bto\s+your\s+hand\b/i;
const DECAY_RE = /(?:reduce[s]?\s+(?:the\s+target's\s+)?attack\s+by|loses?\s+)(\d+)\s*attack/i;
const DRAW_RE = /draw\s+(?:a\s+card|(\d+)\s+cards?)/i;
// On-death trigger phrasing ("When this unit dies/is destroyed", "Upon death").
const ON_DEATH_RE = /(?:when this unit (?:is )?(?:dies|destroyed|defeated|killed)|upon death|on death)/i;
// Count words for "summon two/three N/M X".
const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
// Full summon-body matcher: count word, N/M stats, token name, optional "with <KW>".
const SUMMON_BODY_RE =
  /summon\s+(a|an|one|two|three|four|\d+)?\s*(\d+)\s*\/\s*(\d+)\s+([a-z][a-z ]*?)(?:\s+with\s+([a-z][a-z ]*?))?(?=\s+adjacent\b|[.,]|$)/i;

/** Parse a "summon [count] N/M <name> [with <keyword>]" body into a SUMMON_TOKEN
 *  spec carrying count + tokenKeyword. Returns null when no summon body matches. */
function parseSummonBody(text: string, trigger: EffectTrigger): EffectSpec | null {
  const m = text.match(SUMMON_BODY_RE);
  if (!m) return null;
  const countTok = (m[1] ?? "").toLowerCase();
  const count = COUNT_WORDS[countTok] ?? (/^\d+$/.test(countTok) ? +countTok : 1);
  const tokenKeyword = m[5] ? m[5].trim().toUpperCase().replace(/\s+/g, "_") : undefined;
  return {
    trigger,
    op: "SUMMON_TOKEN",
    attack: +m[2],
    health: +m[3],
    token: m[4].trim(),
    ...(count > 1 ? { count } : {}),
    ...(tokenKeyword ? { tokenKeyword } : {}),
    raw: text,
  };
}
// Natural-language summon trigger ("When this unit is summoned / enters play").
const SUMMON_TRIGGER_RE = /when (?:this unit (?:is summoned|enters (?:play|the battlefield))|summoned)/i;
// Natural-language on-damage trigger. The reducer fires ON_DAMAGE for a unit that
// took combat damage AND for a unit that was attacked (ctx.target = the attacker),
// so "when/whenever this unit takes damage / is damaged / is attacked" all map here.
const ON_DAMAGE_TRIGGER_RE = /(?:when|whenever) this unit (?:takes damage|is damaged|is attacked)/i;
// "for each [other] <Faction>" — the faction scaler on a summon buff.
const FOR_EACH_FACTION_RE = /for each (?:(other)\s+)?(stone keeper|iron defender|bronze guardian|silver sentinel|golden sovereign|god)s?\b/i;

// Generic (non-faction) per-X scalers. ENEMY must be tested BEFORE the ally/unit
// scaler so "for each enemy unit" is not miscounted as an ally scaler.
const FOR_EACH_ENEMY_RE = /for each enemy(?:\s+unit)?\b/i;
const FOR_EACH_HAND_RE = /for each card in (?:your )?hand\b/i;
const FOR_EACH_ALLY_RE = /for each (?:(?:other|friendly|allied)\s+)?(?:ally|allies|unit|units|minion|minions)\b/i;
// "for each adjacent unit/ally/minion" — counts the source's own same-lane
// board-neighbors at index ±1 (scaleBy ADJACENT_UNITS). Tested before the plain
// ally scaler so "adjacent" is not swallowed as a generic ally count.
const FOR_EACH_ADJACENT_RE = /for each adjacent\s+(?:unit|units|ally|allies|minion|minions)\b/i;

/** Detect a generic (non-faction) per-X scaler in `text`. Returns the scaleBy
 *  bucket or null. Faction scalers are handled separately and take precedence. */
function genericScaleBy(text: string): EffectSpec["scaleBy"] | null {
  if (FOR_EACH_FACTION_RE.test(text)) return null; // faction path owns these
  if (FOR_EACH_ENEMY_RE.test(text)) return "ENEMY_COUNT";
  if (FOR_EACH_HAND_RE.test(text)) return "CARDS_IN_HAND";
  if (FOR_EACH_ALLY_RE.test(text)) return "ALLY_COUNT";
  return null;
}

// --- Conditional triggers (Part A) -------------------------------------------
// Only honest, deterministically-evaluable predicates. Anything else stays
// UNKNOWN rather than faking a behavior.
const COND_SURVIVED_RE = /\bif\s+(?:it|this unit)\s+survives|if\s+this unit\s+(?:is\s+)?still\s+alive|if\s+it\s+is\s+still\s+alive/i;
const COND_ALLY_GTE_RE = /if you control (\d+)(?:\s*or more|\+)?\s+(?:or more\s+)?(?:allies|units|minions)\b/i;
const COND_SELF_HP_BELOW_RE = /(?:this unit (?:has|is at)|if (?:it|this unit) has)\s+(\d+)\s+or\s+(?:less|fewer)\s+health|(?:health\s+(?:is\s+)?below|below)\s+(\d+)\s+health/i;

/** Parse a deterministic condition out of a clause, or null. */
function parseCondition(text: string): EffectSpec["condition"] | null {
  const ally = text.match(COND_ALLY_GTE_RE);
  if (ally) return { kind: "ALLY_COUNT_GTE", value: +ally[1] };
  const hp = text.match(COND_SELF_HP_BELOW_RE);
  if (hp) return { kind: "SELF_HEALTH_BELOW", value: +(hp[1] ?? hp[2]) };
  if (COND_SURVIVED_RE.test(text)) return { kind: "SURVIVED" };
  return null;
}

/** "This unit gains +N/+M for each [other] <Faction|ally|enemy|card in hand>" with
 *  NO trigger word — an untriggered self-scale buff. Modeled as a ONE-SHOT
 *  ON_SUMMON BUFF_SELF (identical to the existing Oath/Vow keyword: snapshot the
 *  scaler at summon). Only emitted when a recognized faction/generic scaler
 *  matches; bespoke scalers ("for each attack prevented / turn on board / enemy
 *  that targets it") have no deterministic count and stay UNKNOWN. */
function parseUntriggeredSelfScaleBuff(text: string): EffectSpec | null {
  // Must NOT carry an explicit trigger (those are handled by the summon/attack/
  // damage rider parsers); this is the bare "this unit gains ... for each" form.
  if (/\b(?:when|whenever|on play|battlecry|takes? damage|is attacked|is damaged|end of|start of|attacks?\b|enters?\b)/i.test(text)) {
    return null;
  }
  const nm = text.match(/this unit gains?\s+\+?(\d+)\s*\/\s*\+?(\d+)\s+for each/i);
  if (!nm) return null;
  const fe = text.match(FOR_EACH_FACTION_RE);
  const generic = fe ? null : genericScaleBy(text);
  if (!fe && !generic) return null;
  if (fe) {
    const scaleFaction = `${fe[1] ? `${fe[1]} ` : ""}${fe[2]}`.trim();
    return { trigger: "ON_SUMMON", op: "BUFF_SELF", attack: +nm[1], health: +nm[2], scaleFaction, raw: text };
  }
  return { trigger: "ON_SUMMON", op: "BUFF_SELF", attack: +nm[1], health: +nm[2], scaleBy: generic!, raw: text };
}

/** "When summoned, gain +N/+M (or +N attack / N health/life) for each [other]
 *  <Faction>" — a faction-scaled battlecry that uses the existing scaleFaction
 *  path (Oath/Vow/Martyr resolver math), but without an Oath/Vow/Martyr keyword. */
function parseSummonScaledBuff(text: string): EffectSpec | null {
  if (!SUMMON_TRIGGER_RE.test(text)) return null;
  const fe = text.match(FOR_EACH_FACTION_RE);
  const generic = fe ? null : genericScaleBy(text);
  if (!fe && !generic) return null;
  let attack = 0;
  let health = 0;
  const nm = text.match(/gains?\s+\+?(\d+)\s*\/\s*\+?(\d+)/i);
  if (nm) {
    attack = +nm[1];
    health = +nm[2];
  } else {
    const at = text.match(/gains?\s+\+?(\d+)\s*attack/i);
    const hp = text.match(/(?:gains?|regain)\s+\+?(\d+)\s*(?:health|life|hp)/i);
    if (at) attack = +at[1];
    if (hp) health = +hp[1];
  }
  if (!attack && !health) return null;
  if (fe) {
    const scaleFaction = `${fe[1] ? `${fe[1]} ` : ""}${fe[2]}`.trim();
    return { trigger: "ON_SUMMON", op: "BUFF_SELF", attack, health, scaleFaction, raw: text };
  }
  return { trigger: "ON_SUMMON", op: "BUFF_SELF", attack, health, scaleBy: generic!, raw: text };
}

/** "When summoned, gain +N/+M if <condition>" — a conditional battlecry buff
 *  whose predicate (ally-count / self-health) is honestly evaluable at resolve. */
function parseConditionalSummonBuff(text: string): EffectSpec | null {
  if (!SUMMON_TRIGGER_RE.test(text)) return null;
  const cond = parseCondition(text);
  if (!cond || cond.kind === "SURVIVED") return null; // SURVIVED is an ON_DAMAGE gate
  const nm = text.match(/gains?\s+\+?(\d+)\s*\/\s*\+?(\d+)/i);
  if (!nm) return null;
  return {
    trigger: "ON_SUMMON",
    op: "BUFF_SELF",
    attack: +nm[1],
    health: +nm[2],
    condition: cond,
    raw: text,
  };
}

// A chosen-target phrase on a battlecry ("to target ally", "to a friendly unit",
// "to an allied Stone Keeper"). Distinguishes a single-target heal from an
// untargeted self/AoE heal so we only emit a target-dependent spec when a target
// is actually named (the reducer must then thread `targetInstanceId`).
const SUMMON_TARGET_PHRASE_RE =
  /to\s+(?:a\s+|an\s+|the\s+)?(?:target|friendly|allied|another)\b|to\s+(?:a\s+|an\s+)?ally\b/i;

/** "When summoned, heal/restore N (health) to target ally" — a single-target
 *  heal battlecry. Emits ON_SUMMON HEAL (resolved against the reducer-threaded
 *  ctx.target). A trailing "gain +A/+H" rider is approximated as a fixed self
 *  buff (the dynamic "per health restored" scaling is not modeled). */
function parseSummonTargetedHeal(text: string): EffectSpec[] | null {
  if (!SUMMON_TRIGGER_RE.test(text)) return null;
  if (!SUMMON_TARGET_PHRASE_RE.test(text)) return null;
  const h = text.match(/(?:heal|restore)\s+(\d+)/i);
  if (!h) return null;
  const specs: EffectSpec[] = [{ trigger: "ON_SUMMON", op: "HEAL", amount: +h[1], raw: text }];
  const buff = text.match(/gain\s+\+(\d+)\s*\/\s*\+?(\d+)/i);
  if (buff) specs.push({ trigger: "ON_SUMMON", op: "BUFF_SELF", attack: +buff[1], health: +buff[2], raw: text });
  return specs;
}

/** "When this unit takes damage, summon a N/M X" or "...draw a card" — an
 *  on-damage reaction the reducer already fires for the damaged unit. */
function parseOnDamageReaction(text: string): EffectSpec | null {
  if (!ON_DAMAGE_TRIGGER_RE.test(text)) return null;
  const body = parseSummonBody(text, "ON_DAMAGE");
  if (body) return body;
  // Reuse the taunt-rider body parser (deal-to-attacker / gain +N/+N / self-heal /
  // token) so units that carry an on-damage reaction WITHOUT a leading Taunt
  // (Ward/Shield/Armored or keyword-less) wire the same effects.
  const rider = parseTauntRider(text);
  if (rider) return rider;
  if (DRAW_RE.test(text)) return { trigger: "ON_DAMAGE", op: "DRAW", amount: 1, raw: text };
  return null;
}

// On-play trigger phrasing for a battlecry that has no leading keyword OR rides a
// Charge/Rush keyword ("when this unit enters play/the battlefield", "on play",
// "upon entering"). Used by the on-play deal-damage rider.
const ON_PLAY_TRIGGER_RE =
  /(?:when this unit enters (?:play|the battlefield)|on play\b|upon entering(?:\s+the battlefield)?|when summoned|enters? the battlefield)/i;

/** "Charge. When this unit enters play, deal N damage to target enemy unit." — an
 *  on-play single-target strike. ctx.target is the chosen ENEMY unit (the reducer
 *  searches the opponent board for a DEAL_DAMAGE battlecry). Burn-violating
 *  variants ("to the enemy nexus/commander/face") stay UNKNOWN. */
function parseOnPlayDealRider(text: string): EffectSpec | null {
  if (!ON_PLAY_TRIGGER_RE.test(text)) return null;
  const deal = text.match(DEAL_RE);
  if (!deal) return null;
  // Must explicitly aim at an enemy UNIT/target; never the nexus/commander/face.
  if (/\b(?:nexus|commander|hero|face)\b/i.test(text)) return null;
  if (!/\b(?:target\s+)?enem(?:y|ies)(?:\s+unit)?\b|\btarget\s+(?:unit|minion)\b/i.test(text)) return null;
  // "deal N to ALL/adjacent enemies" is splash — route to the self-anchored AoE.
  if (/\ball\s+enem|adjacent/i.test(text)) {
    return { trigger: "ON_SUMMON", op: "DAMAGE_ADJACENT_ENEMIES", amount: +deal[1], allAdjacent: true, raw: text };
  }
  return { trigger: "ON_SUMMON", op: "DEAL_DAMAGE", amount: +deal[1], raw: text };
}

// Natural-language on-attack trigger ("When this unit attacks ...").
const ON_ATTACK_TRIGGER_RE = /when this unit attacks\b/i;

/** "Charge. When this unit attacks, <gains +N/+M [for each <Faction>] | deals N to
 *  target enemy unit>." The reducer fires ON_ATTACK for the attacker with the
 *  struck DEFENDER as ctx.target, so a DEAL_DAMAGE rider lands on that enemy unit.
 *  A buff may carry a faction or generic per-X scaler (reusing the existing
 *  scaleFaction / scaleBy math). Burn variants (excess to nexus/fortifications)
 *  stay UNKNOWN. */
function parseOnAttackRider(text: string): EffectSpec | null {
  if (!ON_ATTACK_TRIGGER_RE.test(text)) return null;
  // Buff form: "it gains +N/+M [for each <X>]".
  const nm = text.match(/gains?\s+\+?(\d+)\s*\/\s*\+?(\d+)/i);
  if (nm) {
    const fe = text.match(FOR_EACH_FACTION_RE);
    if (fe) {
      const scaleFaction = `${fe[1] ? `${fe[1]} ` : ""}${fe[2]}`.trim();
      return { trigger: "ON_ATTACK", op: "BUFF_SELF", attack: +nm[1], health: +nm[2], scaleFaction, raw: text };
    }
    const generic = genericScaleBy(text);
    if (generic) return { trigger: "ON_ATTACK", op: "BUFF_SELF", attack: +nm[1], health: +nm[2], scaleBy: generic, raw: text };
    return { trigger: "ON_ATTACK", op: "BUFF_SELF", attack: +nm[1], health: +nm[2], raw: text };
  }
  // Deal form: "deal[s] N damage to (a/the/target) enemy/opposing unit". Never the
  // nexus/commander/face (burn) and never an AoE/excess clause.
  const deal = text.match(DEAL_RE);
  if (deal && !/\b(?:nexus|commander|hero|face|fortif)/i.test(text) && /\b(?:enemy|opposing|target)\b/i.test(text)) {
    return { trigger: "ON_ATTACK", op: "DEAL_DAMAGE", amount: +deal[1], raw: text };
  }
  return null;
}

/** "... If it survives, gain +N/+M." — a post-combat conditional self-buff. The
 *  reducer fires ON_DAMAGE after combat resolves, so "survives" is checked then
 *  via the SURVIVED condition (ctx.source.health > 0). Only emitted when the card
 *  actually engages in combat (deals/takes damage), which is when ON_DAMAGE fires. */
function parseSurvivesBuff(text: string): EffectSpec | null {
  if (!COND_SURVIVED_RE.test(text)) return null;
  // The unit must take part in combat for ON_DAMAGE to fire for it.
  if (!/deals?\s+damage|takes?\s+damage|is damaged|attacks?\b|combat/i.test(text)) return null;
  const nm = text.match(/(?:if\s+(?:it|this unit)\s+survives[^.]*?)gains?\s+\+?(\d+)\s*\/\s*\+?(\d+)/i);
  if (!nm) return null;
  return {
    trigger: "ON_DAMAGE",
    op: "BUFF_SELF",
    attack: +nm[1],
    health: +nm[2],
    condition: { kind: "SURVIVED" },
    raw: text,
  };
}
// Continuous faction aura: "[your] Other <Faction> [you control] gain +X/+Y
// while this ...". The "Other" subject and trailing "gain +N/+N" distinguish it
// from an Oath self-buff ("gain +1/+1 for each other <Faction>"), where the
// faction noun comes AFTER "gain" and has no second "gain".
const AURA_RE =
  /\bother\s+(stone keeper|iron defender|bronze guardian|silver sentinel|golden sovereign|god)s?\b[^.]*?gain\s+\+(\d+)\s*\/\s*\+?(\d+)/i;

const FACTION_NOUN = /(stone keeper|iron defender|bronze guardian|silver sentinel|golden sovereign|god)s?/;

/** Gating phrase that marks a clause as a CONTINUOUS "while in play" effect (vs.
 *  a one-shot battlecry/trigger). Required for the general aura riders so we do
 *  not misread a triggered "allies gain +N/+N" as a continuous one. */
const WHILE_IN_PLAY_RE =
  /while\s+(?:this(?:\s+unit)?\s+is\s+in\s+play|this(?:\s+unit)?\s+(?:is\s+)?on\s+the\s+(?:board|battlefield)|in\s+play|on\s+the\s+board)/i;

/** "adjacent <allies|Faction> gain +N/+N" — same-lane neighbours (index ±1). The
 *  subject may be a faction noun (scope to that faction) or generic allies. */
const AURA_ADJACENT_RE =
  /\badjacent\s+(?:(stone keeper|iron defender|bronze guardian|silver sentinel|golden sovereign|god)s?|allies|allied units?|friendly units?|units?|minions?)\b[^.]*?gain\s+\+(\d+)\s*\/\s*\+?(\d+)/i;

/** Non-"other" faction buff: "your <Faction> gain +N/+N" (no "other", so the
 *  source itself is INCLUDED). Distinct from AURA_RE which requires "other". */
const AURA_FACTION_INCLUSIVE_RE =
  /\byour\s+(stone keeper|iron defender|bronze guardian|silver sentinel|golden sovereign|god)s?\b[^.]*?gain\s+\+(\d+)\s*\/\s*\+?(\d+)/i;

/** Generic (non-faction) ally stat aura: "[your] [other] allied units gain
 *  +N/+N". Faction nouns are deliberately excluded (those take the faction
 *  path). The subject MUST carry an ally qualifier (your/other/allied/friendly)
 *  so the gating phrase "this unit is in play" can never be mistaken for the
 *  subject. Captures "other" so the source can be excluded. */
const AURA_ALLY_STAT_RE =
  /\b(your\s+)?(other\s+)?(?:allied units?|friendly units?|allies|other units?|other minions?)\b(?![^.]*\b(?:stone keeper|iron defender|bronze guardian|silver sentinel|golden sovereign|god)s?\b)[^.]*?gain\s+\+(\d+)\s*\/\s*\+?(\d+)/i;

/** Continuous keyword grant to allies: "[adjacent] [other] allies gain <KW>".
 *  The beneficiary subject MUST carry an ally qualifier (adjacent/your/other/
 *  allied/friendly) or be a faction noun. Bare "unit(s)"/"minion(s)" is only a
 *  valid subject when explicitly qualified (your/other/adjacent), so the gating
 *  "while this unit is in play" preamble can never be mistaken for the subject
 *  (which would wrongly flip includeSelf on for the source). */
const AURA_KEYWORD_RE =
  /\b(adjacent\s+)?(your\s+)?(other\s+)?((?:(?:adjacent|your|other)\s+(?:units?|minions?))|allies|allied units?|friendly units?|stone keepers?|iron defenders?|bronze guardians?|silver sentinels?|golden sovereigns?|gods?)\b[^.]*?\bgain[s]?\b[^.]*?\b(guard|taunt|ward|flying|lifesteal|lifedrain|rush|charge|stealth|veil|shield|armored|crush|trample|ranged)\b/i;

const AURA_KW_NORMALIZE: Record<string, string> = {
  taunt: "GUARD",
  guard: "GUARD",
  ward: "WARD",
  flying: "FLYING",
  lifesteal: "LIFESTEAL",
  lifedrain: "LIFESTEAL",
  rush: "RUSH",
  charge: "RUSH",
  stealth: "STEALTH",
  veil: "STEALTH",
  // Normalize to the canonical DIVINE_SHIELD the shield system recognizes
  // (unitHasShieldKeyword / consumeShield). "SHIELD" was inert — never matched.
  shield: "DIVINE_SHIELD",
  armored: "ARMORED",
  crush: "CRUSH",
  trample: "CRUSH",
  ranged: "RANGED",
};

function firstKeyword(cs: string[]): { kw: string; idx: number } | null {
  for (let i = 0; i < cs.length; i += 1) {
    const lead = cs[i].toLowerCase().match(/^([a-z]+(?:\s+shield)?)/);
    if (!lead) continue;
    const token = lead[1].trim();
    const norm = token === "divine" ? "divine shield" : token;
    if (WIRED_KEYWORDS[norm] || REAL_OP_KEYWORDS.has(norm)) {
      return { kw: norm, idx: i };
    }
  }
  return null;
}

const REAL_OP_KEYWORDS = new Set([
  "summon",
  "cleave",
  "rally",
  "judgment",
  "decay",
  "decayed",
  "fear",
  "patient",
  "oath",
  "vow",
  "martyr",
  "bless",
  "mire",
  "global",
]);

/** Parse the optional rider that trails a Taunt keyword:
 *  "When this unit takes damage, <gain N/N | deal N | draw | create token>." */
function parseTauntRider(text: string): EffectSpec | null {
  const lower = text.toLowerCase();
  // The rider fires when this unit took damage OR was attacked — the reducer fires
  // ON_DAMAGE for the defender in both cases (ctx.target = the attacking enemy).
  if (!/takes?\s+damage|is\s+damaged|is\s+attacked/.test(lower)) return null;
  const token = text.match(TOKEN_RE);
  if (token) {
    return { trigger: "ON_DAMAGE", op: "SUMMON_TOKEN", attack: +token[1], health: +token[2], token: token[3].trim(), raw: text };
  }
  const nn = text.match(NN_DELTA_RE);
  if (nn && /gain/.test(lower)) {
    return { trigger: "ON_DAMAGE", op: "BUFF_SELF", attack: +nn[1], health: +nn[2], raw: text };
  }
  const deal = text.match(DEAL_RE);
  if (deal) {
    // "deal N damage to all adjacent enemies/foes/lanes" — self-anchored AoE on
    // the source's same-lane board-neighbors (index ±1) of the OPPONENT board.
    if (/adjacent/i.test(text)) {
      return { trigger: "ON_DAMAGE", op: "DAMAGE_ADJACENT_ENEMIES", amount: +deal[1], allAdjacent: true, raw: text };
    }
    // "deal N damage to the attacker" — ctx.target IS the attacker on an ON_DAMAGE
    // fired for the defender (reducer threads attacker as the target). Plain
    // DEAL_DAMAGE lands on it. A clause that instead damages the enemy nexus/face
    // is a burn violation and must stay UNKNOWN.
    if (/\b(?:nexus|face|hero|commander)\b/i.test(text)) return null;
    return { trigger: "ON_DAMAGE", op: "DEAL_DAMAGE", amount: +deal[1], raw: text };
  }
  // "gain/restore N health/life [to itself]" — a single-stat self-heal reaction.
  // Only the SELF-targeted form is honest here: the reducer threads the ATTACKER
  // (an enemy) as ctx.target on this ON_DAMAGE, so "to a friendly unit" can't be
  // routed. We require either an explicit self target or no other-unit target.
  // DRAW takes precedence over the self-heal: a "...and draw a card" clause is
  // wired as DRAW (the existing behavior), so the heal branch must not swallow it.
  if (DRAW_RE.test(text)) return { trigger: "ON_DAMAGE", op: "DRAW", amount: 1, raw: text };
  const selfHeal = text.match(/(?:gain|restore|heal)\s+(\d+)\s*(?:health|life|hp)\b/i);
  if (selfHeal && !/\bfor each\b/i.test(text) && !/to\s+(?:a\s+|an\s+|another\s+|target\s+|friendly|allied)/i.test(text)) {
    return { trigger: "ON_DAMAGE", op: "HEAL", amount: +selfHeal[1], self: true, raw: text };
  }
  return null;
}

function compileKeyword(kw: string, full: string, clauseText: string): EffectSpec[] {
  // Already-wired keywords: reminder only, no runtime op.
  if (WIRED_KEYWORDS[kw]) {
    const specs: EffectSpec[] = [{ trigger: "PASSIVE", op: "KEYWORD_WIRED", keyword: WIRED_KEYWORDS[kw], raw: clauseText }];
    if (kw === "taunt") {
      const rider = parseTauntRider(full);
      if (rider) specs.push(rider);
    }
    return specs;
  }

  switch (kw) {
    case "summon": {
      const t = full.match(TOKEN_RE);
      if (t) {
        return [{ trigger: "ON_SUMMON", op: "SUMMON_TOKEN", attack: +t[1], health: +t[2], token: t[3].trim(), raw: clauseText }];
      }
      // "Summon. ... summon [two] N/M X [with KW]." — the richer body parser.
      const body = parseSummonBody(full, "ON_SUMMON");
      if (body) return [body];
      return [{ trigger: "ON_SUMMON", op: "SUMMON_TOKEN", attack: 1, health: 1, token: "Token", raw: clauseText }];
    }
    case "cleave": {
      // "Cleave. ... deals N damage to an enemy in addition to its normal attack."
      // is a flat bonus to the STRUCK enemy (reuses DEAL_DAMAGE on attack). The
      // "half its attack ... to adjacent enemies" variant is real splash (CLEAVE,
      // amount left undefined so the resolver computes floor(attack/2)).
      const deal = full.match(DEAL_RE);
      if (deal && !/half|adjacent/i.test(full)) {
        return [{ trigger: "ON_ATTACK", op: "DEAL_DAMAGE", amount: +deal[1], raw: full }];
      }
      return [{ trigger: "ON_ATTACK", op: "CLEAVE", raw: full }];
    }
    case "rally": {
      const a = full.match(ATTACK_DELTA_RE);
      return [{ trigger: "ON_ATTACK", op: "BUFF_ALLIES", attack: a ? +a[1] : 1, health: 0, raw: clauseText }];
    }
    case "judgment":
      return [{ trigger: "PASSIVE", op: "PIERCE_ARMOR", raw: clauseText }];
    case "decay":
    case "decayed":
    case "mire": {
      // "At the end of [each|your] turn, ..." Decay is a DIFFERENT mechanic
      // (self HP loss / adjacent AoE), not the on-hit attack debuff. Don't
      // misfire it on attack.
      if (/end of (?:each|your|the)?\s*turn/i.test(full)) {
        // Self-decay we can resolve deterministically with no targeting:
        //   "this unit loses N health [and gains +X attack]".
        const lose = full.match(/loses?\s+(\d+)\s*health/i);
        if (lose && /this unit/i.test(full)) {
          const specs: EffectSpec[] = [
            { trigger: "ON_TURN_END", op: "DEAL_DAMAGE", amount: +lose[1], self: true, raw: clauseText },
          ];
          const gain = full.match(/gains?\s+\+(\d+)\s*attack/i);
          if (gain) specs.push({ trigger: "ON_TURN_END", op: "BUFF_SELF", attack: +gain[1], health: 0, raw: clauseText });
          return specs;
        }
        // "deal N damage to an/all adjacent enemy unit(s)" — self-anchored splash
        // onto the source's same-lane enemy board-neighbors (index ±1). "all"/
        // plural -> every adjacent enemy; "an"/singular -> the nearest one.
        const adjDeal = full.match(DEAL_RE);
        if (adjDeal && /adjacent/i.test(full) && /enem|foe/i.test(full)) {
          const allAdjacent = /\ball\b|enemies|foes|lanes/i.test(full);
          return [
            { trigger: "ON_TURN_END", op: "DAMAGE_ADJACENT_ENEMIES", amount: +adjDeal[1], allAdjacent, raw: clauseText },
          ];
        }
        // Other end-of-turn decay we don't model yet: honest inert.
        return [{ trigger: "PASSIVE", op: "GLOBAL_UNPARSED", raw: clauseText }];
      }
      const d = full.match(DECAY_RE);
      return [{ trigger: "ON_ATTACK", op: "DEBUFF_ENEMY", amount: d ? +d[1] : 1, raw: clauseText }];
    }
    case "fear": {
      const c = full.match(COST_THRESHOLD_RE);
      return [{ trigger: "PASSIVE", op: "RESTRICT_ATTACK", costThreshold: c ? +c[1] : 2, raw: clauseText }];
    }
    case "patient": {
      // EOT self-heal variant: "At the end of your turn, restore/heal N ... to
      // this unit" — a regenerator, NOT a turn-start grower. Route to a
      // self-targeted ON_TURN_END HEAL instead of the +1/+1 growth.
      if (/end of (?:each|your|the)?\s*turn/i.test(full) && /this unit/i.test(full) && /(restore|heal)/i.test(full)) {
        const hn = full.match(/(?:restore|heal)\s+(\d+)/i);
        return [
          { trigger: "STATIC", op: "RESTRICT_ATTACK", raw: clauseText },
          { trigger: "ON_TURN_END", op: "HEAL", amount: hn ? +hn[1] : 1, self: true, raw: clauseText },
        ];
      }
      // "At the end of your turn, gain +N/+M for each adjacent unit" — an EOT
      // self-buff scaled by the source's same-lane board-neighbor count (index
      // ±1). Fires on ON_TURN_END (the reducer fires it for the ending player).
      if (/end of (?:each|your|the)?\s*turn/i.test(full) && FOR_EACH_ADJACENT_RE.test(full)) {
        const nm = full.match(NN_DELTA_RE);
        const at = full.match(ATTACK_DELTA_RE);
        const hp = full.match(HEALTH_DELTA_RE);
        const attack = nm ? +nm[1] : at ? +at[1] : 1;
        const health = nm ? +nm[2] : hp ? +hp[1] : 1;
        return [
          { trigger: "STATIC", op: "RESTRICT_ATTACK", raw: clauseText },
          { trigger: "ON_TURN_END", op: "BUFF_SELF", attack, health, scaleBy: "ADJACENT_UNITS", raw: clauseText },
        ];
      }
      const fe = full.match(FOR_EACH_RE);
      const a = full.match(ATTACK_DELTA_RE);
      const h = full.match(HEALTH_DELTA_RE);
      void fe;
      return [
        { trigger: "STATIC", op: "RESTRICT_ATTACK", raw: clauseText },
        { trigger: "ON_TURN_START", op: "BUFF_SELF", attack: a ? +a[1] : 1, health: h ? +h[1] : 1, raw: clauseText },
      ];
    }
    case "oath":
    case "vow":
    case "martyr": {
      const fe = full.match(FOR_EACH_RE);
      return [
        {
          trigger: "ON_SUMMON",
          op: "BUFF_SELF",
          attack: fe ? +fe[1] : 1,
          health: fe ? +fe[2] : 1,
          scaleFaction: fe ? fe[3].trim() : undefined,
          raw: clauseText,
        },
      ];
    }
    case "bless": {
      const a = full.match(ATTACK_DELTA_RE);
      const h = full.match(HEALTH_DELTA_RE);
      return [{ trigger: "ON_SUMMON", op: "BUFF_ALLIES", attack: a ? +a[1] : 1, health: h ? +h[1] : 0, raw: clauseText }];
    }
    case "global":
      return [{ trigger: "PASSIVE", op: "GLOBAL_UNPARSED", raw: clauseText }];
    default:
      return [{ trigger: "PASSIVE", op: "UNKNOWN", raw: clauseText }];
  }
}

// --- Deck-manipulation clause matchers (deterministic; own-deck only) ---------
// TUTOR: "search/tutor your deck for the lowest-cost unit/spell | highest-cost
//   unit (and put it into your hand)". The selector noun + cost ordering is the
//   deterministic pick; an empty/no-match deck is a clean no-op at resolve.
const TUTOR_RE =
  /\b(?:search|tutor)\b[^.]*\b(?:deck|library)\b[^.]*\b(lowest|highest)[- ]?cost\s+(unit|spell|minion)\b/i;
// DRAW_FILTERED: "draw N unit(s)/spell(s) from your deck" — draw the first N cards
//   of that type from the deck top, skipping non-matching cards.
const DRAW_FILTERED_RE = /draw\s+(\d+)\s+(unit|spell|minion)s?\b/i;
// SCRY_DYNAMIC: "scry N" / "look at the top N cards of your deck (and reorder)".
const SCRY_DYNAMIC_RE = /\bscry\s+(\d+)\b|look at the top\s+(\d+)\s+cards?\s+of\s+your\s+(?:deck|library)/i;
// MILL_FROM_DECK: "mill N" / "put the top N cards of your deck into your discard".
const MILL_RE = /\bmill\s+(\d+)\b|(?:put|move|send)\s+the\s+top\s+(\d+)\s+cards?\s+of\s+your\s+(?:deck|library)\s+(?:into|to)\s+(?:your\s+)?(?:discard|graveyard)/i;

/** Parse a deck-manipulation body (tutor / filtered-draw / scry / mill) into a
 *  single EffectSpec, or null. Order matters: the more specific filtered-draw is
 *  matched before a generic "scry/mill N" so a numeric body is not misrouted. */
function parseDeckManipBody(body: string, trigger: EffectTrigger, raw: string): EffectSpec | null {
  const tutor = body.match(TUTOR_RE);
  if (tutor) {
    const dir = tutor[1].toLowerCase();
    const noun = tutor[2].toLowerCase();
    let sel: NonNullable<EffectSpec["tutorSelector"]>;
    if (noun === "spell") sel = "LOWEST_COST_SPELL";
    else sel = dir === "highest" ? "HIGHEST_COST_UNIT" : "LOWEST_COST_UNIT";
    return { trigger, op: "TUTOR_FROM_DECK", tutorSelector: sel, raw };
  }
  const df = body.match(DRAW_FILTERED_RE);
  if (df) {
    const noun = df[2].toLowerCase();
    const drawType = noun === "spell" ? "SPELL" : "UNIT";
    return { trigger, op: "DRAW_FILTERED", amount: +df[1], drawType, raw };
  }
  const scry = body.match(SCRY_DYNAMIC_RE);
  if (scry) {
    return { trigger, op: "SCRY_DYNAMIC", amount: +(scry[1] ?? scry[2]), raw };
  }
  const mill = body.match(MILL_RE);
  if (mill) {
    return { trigger, op: "MILL_FROM_DECK", amount: +(mill[1] ?? mill[2]), raw };
  }
  return null;
}

/** Colon-trigger syntax: "On play: ...", "End of turn: ...", "Damage taken: ...". */
function compileColonTrigger(text: string): EffectSpec[] | null {
  const m = text.match(/^([a-z][a-z ]+?):\s*(.+)$/i);
  if (!m) return null;
  const head = m[1].toLowerCase();
  const body = m[2];
  let trigger: EffectTrigger | null = null;
  if (/on play|when summoned|battlecry/.test(head)) trigger = "ON_SUMMON";
  else if (/end of (your )?turn/.test(head)) trigger = "ON_TURN_END";
  else if (/start of (your )?turn/.test(head)) trigger = "ON_TURN_START";
  else if (/damage taken|when.*damaged/.test(head)) trigger = "ON_DAMAGE";
  if (!trigger) return null;

  const t = body.match(TOKEN_RE);
  if (t) return [{ trigger, op: "SUMMON_TOKEN", attack: +t[1], health: +t[2], token: t[3].trim(), raw: text }];
  // "On play: summon [two] N/M X [with KW]" that TOKEN_RE (which requires the
  // literal "token" word) misses. Checked before the deal/heal bodies.
  const summonBody = parseSummonBody(body, trigger);
  if (summonBody) return [summonBody];
  // Nexus heal must be checked BEFORE the unit-heal/deal bodies (the nexus noun
  // disambiguates "restore N to your nexus" from "heal N" on a unit).
  const nexus = body.match(NEXUS_HEAL_RE);
  if (nexus) return [{ trigger, op: "HEAL_NEXUS", amount: +nexus[1], raw: text }];
  const deal = body.match(DEAL_RE);
  if (deal) return [{ trigger, op: "DEAL_DAMAGE", amount: +deal[1], raw: text }];
  if (RETURN_HAND_RE.test(body)) return [{ trigger, op: "RETURN_TO_HAND", raw: text }];
  if (DESTROY_RE.test(body)) return [{ trigger, op: "DESTROY_UNIT", raw: text }];
  // "copy stats and abilities of <enemy>" — clone a target onto self.
  if (/\bcopy\b/i.test(body)) return [{ trigger, op: "COPY_UNIT", raw: text }];
  if (HEAL_RE.test(body)) {
    const h = body.match(HEAL_RE);
    return [{ trigger, op: "HEAL", amount: h && h[1] ? +h[1] : 0, raw: text }];
  }
  // Deck-manipulation bodies (controller's own deck; no target). Checked BEFORE
  // the plain DRAW body so "draw N units/spells" (filtered) is not swallowed by
  // the generic draw. All are deterministic and no-op cleanly on an empty deck.
  const deckOp = parseDeckManipBody(body, trigger, text);
  if (deckOp) return [deckOp];
  const draw = body.match(DRAW_RE);
  if (draw) return [{ trigger, op: "DRAW", amount: draw[1] ? +draw[1] : 1, raw: text }];
  // "gain +A/+H" — a self/target buff (BUFF_SELF buffs ctx.source; a spell wires
  // the chosen ally as source). Completes the colon-trigger parser symmetry with
  // the deal/heal/draw bodies above.
  const buff = body.match(/gain\s+\+?(\d+)\s*\/\s*\+?(\d+)/i);
  if (buff) return [{ trigger, op: "BUFF_SELF", attack: +buff[1], health: +buff[2], raw: text }];
  // "loses N attack" / "reduce attack by N" — a target attack debuff.
  const debuff = body.match(DECAY_RE);
  if (debuff) return [{ trigger, op: "DEBUFF_ENEMY", amount: +debuff[1], raw: text }];
  return [{ trigger, op: "UNKNOWN", raw: text }];
}

/**
 * Parse the 13 bespoke "named-mechanic" ops that don't fit the generic
 * keyword/aura templates. Each is matched on distinctive phrasing from the
 * marquee card it serves. Burn-violating riders (enemy commander/face damage)
 * are deliberately NOT parsed here — they stay UNKNOWN per the engine's content
 * rules. Returns every spec it can prove from the text (possibly empty).
 */
function parseNamedMechanics(text: string): EffectSpec[] {
  const out: EffectSpec[] = [];
  const lower = text.toLowerCase();

  // 1. DESTROY_ENEMY_SELECT — "destroy ... highest-cost enemy" (HIGHEST_COST) or
  //    "destroy ... enemy with cost <= own attack" (RANDOM_COST_GATE). Both are
  //    ON_SUMMON ("On play" / "Start of combat" both resolve as the battlecry).
  if (/\bdestroy\b/i.test(text) && /\benem/i.test(text)) {
    if (/cost\s*(?:≤|<=|<|or\s+(?:less|fewer))\s*(?:own|its|this unit's)?\s*attack|cost\s*(?:≤|<=)\s*own attack/i.test(text)) {
      out.push({ trigger: "ON_SUMMON", op: "DESTROY_ENEMY_SELECT", selector: "RANDOM_COST_GATE", raw: text });
    } else if (/highest[- ]?cost/i.test(text)) {
      out.push({ trigger: "ON_SUMMON", op: "DESTROY_ENEMY_SELECT", selector: "HIGHEST_COST", raw: text });
    }
  }

  // 2. DEBUFF_ALL_ENEMIES — "enemy units -N attack this turn" (+ the permanent
  //    "allies +N/+N" rider routes through BUFF_ALLIES).
  const tempDebuff = text.match(/enem(?:y|ies)\s+units?\s+-(\d+)\s+attack\s+this\s+turn/i);
  if (tempDebuff) {
    out.push({ trigger: "ON_SUMMON", op: "DEBUFF_ALL_ENEMIES", amount: +tempDebuff[1], raw: text });
    const allyBuff = text.match(/allies?\s+\+(\d+)\s*\/\s*\+?(\d+)\s+permanent/i);
    if (allyBuff) out.push({ trigger: "ON_SUMMON", op: "BUFF_ALLIES", attack: +allyBuff[1], health: +allyBuff[2], raw: text });
  }

  // 3. COMMANDER_SHIELD — "Enemies cannot attack your commander directly."
  if (/enem(?:y|ies)\s+cannot\s+attack\s+(?:your\s+)?(?:commander|nexus)\s+directly/i.test(text)) {
    out.push({ trigger: "PASSIVE", op: "COMMANDER_SHIELD", raw: text });
  }

  // 4. MIRROR_ATTACK — "On attack: mirror copy also attacks."
  if (/mirror\s+copy\s+also\s+attacks|on\s+attack:\s*mirror/i.test(text)) {
    out.push({ trigger: "ON_ATTACK", op: "MIRROR_ATTACK", raw: text });
  }

  // 5. AURA_COST_REDUCTION — "friendly units cost N less" (continuous).
  const unitCost = text.match(/(?:friendly\s+)?units?\s+cost\s+(\d+)\s+less/i);
  if (unitCost) {
    out.push({ trigger: "PASSIVE", op: "AURA_COST_REDUCTION", amount: +unitCost[1], raw: text });
  }

  // 6. RESURRECT_AS_TOKEN — "raise a ... unit from your graveyard as a 1/1 X".
  const raiseToken = text.match(/(?:raise|revive|resurrect)\b[^.]*\bgrave(?:yard)?\b[^.]*\bas\s+a\s+\d+\s*\/\s*\d+\s+([a-z][a-z ]*)/i);
  if (raiseToken) {
    const trig: EffectTrigger = /end of (?:your |each |the )?turn/i.test(text) ? "ON_TURN_END" : "ON_SUMMON";
    out.push({
      trigger: trig,
      op: "RESURRECT_AS_TOKEN",
      reviveKeyword: raiseToken[1].trim().toUpperCase().replace(/\s+/g, "_"),
      raw: text,
    });
  }

  // 7. SUMMON_ON_ANY_DEATH — "Any unit dies: place a N/M X ...".
  const anyDeath = text.match(/any\s+unit\s+dies:\s*place\s+(?:a\s+|an\s+|one\s+)?(\d+)\s*\/\s*(\d+)\s+([a-z][a-z ]*?)(?:\s+in|\.|,|$)/i);
  if (anyDeath) {
    out.push({
      trigger: "PASSIVE",
      op: "SUMMON_ON_ANY_DEATH",
      attack: +anyDeath[1],
      health: +anyDeath[2],
      token: anyDeath[3].trim(),
      raw: text,
    });
  }

  // 8. PASSIVE_FLOOR_HP — "Cannot be reduced below 1 HP by any single source."
  if (/cannot\s+be\s+reduced\s+below\s+1\s+hp\b/i.test(text)) {
    out.push({ trigger: "PASSIVE", op: "PASSIVE_FLOOR_HP", raw: text });
  }

  // 9. ONCEDEATH_REVIVE — "Once per match, return to the board at full HP on death."
  if (/once\s+per\s+match[^.]*\breturn\s+to\s+the\s+board\b[^.]*\b(?:full\s+hp|on\s+death)/i.test(text)) {
    out.push({ trigger: "ON_DEATH", op: "ONCEDEATH_REVIVE", raw: text });
  }

  // 10. SWAP_STATS_ALL_ENEMIES — "swap attack and health of all enemy units".
  if (/swap\s+attack\s+and\s+health\s+of\s+all\s+enem/i.test(text)) {
    out.push({ trigger: "ON_SUMMON", op: "SWAP_STATS_ALL_ENEMIES", raw: text });
  }

  // 11. DOUBLE_ATTACK — "Attacks twice per turn."
  if (/attacks?\s+twice\s+per\s+turn/i.test(text)) {
    out.push({ trigger: "PASSIVE", op: "DOUBLE_ATTACK", raw: text });
  }

  // 12. AURA_SPELL_COST — "Spells cost N less while ... on board."
  const spellCost = text.match(/spells?\s+cost\s+(\d+)\s+less/i);
  if (spellCost) {
    out.push({ trigger: "PASSIVE", op: "AURA_SPELL_COST", amount: +spellCost[1], raw: text });
  }

  // 13. AURA_ABILITY_SILENCE — "Enemy units cannot trigger abilities while on board."
  if (/enem(?:y|ies)\s+units?\s+cannot\s+trigger\s+abilit/i.test(text)) {
    out.push({ trigger: "PASSIVE", op: "AURA_ABILITY_SILENCE", raw: text });
  }

  // ADAPTATIONS for burn-violating cards: script ONLY the allowed clause.
  //  - "Healing received: you heal equal" (Good vs Evil) -> heal own nexus echo.
  //    DROP the "enemy commander takes equal" clause (left UNKNOWN).
  if (/healing\s+received:\s*you\s+heal\s+equal/i.test(text)) {
    out.push({ trigger: "ON_DAMAGE", op: "HEAL_NEXUS", amount: 1, raw: text });
  }
  //  - Golden Samurai God: turn-start "heal 2" to own nexus; DROP enemy damage.
  if (/turn\s+start:\s*heal\s+(\d+)/i.test(text) && /enemy\s+commander/i.test(text)) {
    const h = text.match(/turn\s+start:\s*heal\s+(\d+)/i);
    if (h) out.push({ trigger: "ON_TURN_START", op: "HEAL_NEXUS", amount: +h[1], raw: text });
  }
  //  - Mr LOL: conditional "destroy unit >=4 attack"; DROP the commander rider.
  const lolGate = text.match(/destroy\s+unit\s*(?:with\s+)?(?:≥|>=)\s*(\d+)\s+attack/i);
  if (lolGate) {
    out.push({ trigger: "ON_DAMAGE", op: "DESTROY_ENEMY_SELECT", selector: "ATTACK_GATE", amount: +lolGate[1], raw: text });
  }

  return out;
}

/**
 * Compile a single ability string into its Effect IR.
 * `recognized` is true when the ability was classified with no UNKNOWN ops.
 */
export function compileAbility(ability: string | null | undefined): CompiledAbility {
  const text = (ability ?? "").trim();
  if (!text) return { specs: [], classified: [], recognized: true };

  const cs = clauses(text);
  const classified: EffectSpec[] = [];

  // 1. Pure stat line -> STATIC (already baked into stats).
  if (STAT_LINE_RE.test(text)) {
    classified.push({ trigger: "STATIC", op: "STAT_LINE", raw: text });
  } else {
    // 2. Leading-keyword classification (covers ~98.6% of the corpus).
    const found = firstKeyword(cs);
    if (found) {
      classified.push(...compileKeyword(found.kw, text, cs[found.idx]));
    } else {
      // 3. Colon-trigger alternate syntax.
      const colon = compileColonTrigger(text);
      if (colon) classified.push(...colon);
      // 3b. Stat prefix + "Grants <KW>" — fully static (handled by the rider below).
      else if (STAT_THEN_GRANT_RE.test(text)) classified.push({ trigger: "STATIC", op: "STAT_LINE", raw: text });
      else classified.push({ trigger: "PASSIVE", op: "UNKNOWN", raw: text });
    }
  }

  // 4. "Grants <KEYWORD>" rider (keyword already on the tuple — descriptive).
  const grants = text.match(GRANTS_RE);
  if (grants) {
    classified.push({ trigger: "STATIC", op: "GRANT_KEYWORD", keyword: grants[1].trim().toUpperCase().replace(/\s+/g, "_"), raw: text });
  }

  // 5. Continuous stat / keyword auras (trail a Taunt/Ward/Shield keyword). These
  //    are RECOMPUTED from board state by the reducer, never one-shot. Precedence:
  //    (a) "other <Faction> gain +N/+N"  -> AURA_FACTION_STAT (existing path)
  //    (b) "adjacent <ally|Faction> gain +N/+N" -> AURA_ADJACENT_STAT
  //    (c) "your <Faction> gain +N/+N" (no "other", source included) -> AURA_FACTION_STAT
  //    (d) "[other] allied units gain +N/+N" (generic) -> AURA_ALLY_STAT
  //    Only emitted when the clause is gated by a continuous "while in play"
  //    phrase, so a triggered "allies gain +N/+N" battlecry is not mistaken for
  //    one. A faction stat aura is emitted at most once.
  const aura = text.match(AURA_RE);
  let emittedFactionStat = false;
  if (aura) {
    classified.push({
      trigger: "PASSIVE",
      op: "AURA_FACTION_STAT",
      attack: +aura[2],
      health: +aura[3],
      scaleFaction: aura[1].trim(),
      raw: text,
    });
    emittedFactionStat = true;
  }

  if (WHILE_IN_PLAY_RE.test(text)) {
    // (b) Adjacent stat aura — same-lane neighbours (index ±1). Faction subjects
    //     scope the buff to that faction; generic subjects hit any adjacent ally.
    const adj = text.match(AURA_ADJACENT_RE);
    if (adj) {
      classified.push({
        trigger: "PASSIVE",
        op: "AURA_ADJACENT_STAT",
        attack: +adj[2],
        health: +adj[3],
        scaleFaction: adj[1] ? adj[1].trim() : undefined,
        raw: text,
      });
    }

    // (c) Inclusive faction stat aura ("your <Faction> gain", no "other"): the
    //     source benefits too. Skipped if (a) already emitted an "other" aura or
    //     (b) claimed an adjacent faction buff for the same clause.
    if (!emittedFactionStat && !adj) {
      const incl = text.match(AURA_FACTION_INCLUSIVE_RE);
      if (incl) {
        classified.push({
          trigger: "PASSIVE",
          op: "AURA_FACTION_STAT",
          attack: +incl[2],
          health: +incl[3],
          scaleFaction: incl[1].trim(),
          includeSelf: true,
          raw: text,
        });
        emittedFactionStat = true;
      }
    }

    // (d) Generic ally stat aura (no faction noun). Only when no faction/adjacent
    //     stat aura already claimed the clause.
    if (!emittedFactionStat && !adj) {
      const ally = text.match(AURA_ALLY_STAT_RE);
      if (ally) {
        classified.push({
          trigger: "PASSIVE",
          op: "AURA_ALLY_STAT",
          attack: +ally[3],
          health: +ally[4],
          includeSelf: !/\bother\b/i.test(ally[0]), // "other" anywhere -> exclude source
          raw: text,
        });
      }
    }

    // Continuous keyword grant: "[adjacent] [other] allies gain <KW>". Coexists
    // with a stat aura on the same clause (e.g. "+1 armor and take no damage").
    const kw = text.match(AURA_KEYWORD_RE);
    if (kw) {
      const norm = AURA_KW_NORMALIZE[kw[5].toLowerCase()];
      if (norm) {
        classified.push({
          trigger: "PASSIVE",
          op: "AURA_KEYWORD",
          keyword: norm,
          allAdjacent: !!kw[1], // "adjacent" scope
          scaleFaction: /stone keeper|iron defender|bronze guardian|silver sentinel|golden sovereign|god/i.test(kw[4]) ? kw[4].replace(/s$/i, "").trim() : undefined,
          // Source is included ONLY when the matched beneficiary clause has no
          // "other" qualifier. Test the whole matched clause (kw[0]) rather than a
          // single group: an "other" can be consumed by either the standalone
          // group (kw[3]) or the subject group (e.g. "other units"), so group
          // presence alone under-detects it and would wrongly buff the source.
          includeSelf: !/\bother\b/i.test(kw[0]),
          raw: text,
        });
      }
    }
  }

  // 6. On-death summon rider ("When this unit dies, summon a N/M X"). Applies
  //    regardless of the leading keyword (Martyr/Vow units summon on death too),
  //    so a deathrattle that spawns a token actually mints it at death.
  if (ON_DEATH_RE.test(text)) {
    const body = parseSummonBody(text, "ON_DEATH");
    if (body) {
      classified.push(body);
      // The on-death summon fully accounts for an otherwise-UNKNOWN clause that
      // had no leading keyword (e.g. "When this unit dies, summon a 1/1 X").
      for (let i = classified.length - 2; i >= 0; i -= 1) {
        if (classified[i].op === "UNKNOWN") classified.splice(i, 1);
      }
    }
  }

  // 6b. On-play summon-body rider ("[Keyword.] On play: summon [two] N/M X [with
  //     KW]"). Applies regardless of a leading keyword (e.g. "Guard, Trample. On
  //     play: summon two 2/2 ..."), as long as no ON_SUMMON summon was already
  //     classified. A trailing UNKNOWN from the leading-keyword pass is dropped.
  if (
    /(?:^|\b)on play:\s*summon|when (?:this unit is summoned|summoned)[^.]*\bsummon\b/i.test(text) &&
    !classified.some((s) => s.trigger === "ON_SUMMON" && s.op === "SUMMON_TOKEN")
  ) {
    const colonBody = text.match(/(?:on play:\s*|summoned[^.]*?)(summon\s+(?:a|an|one|two|three|four|\d+)?\s*\d+\s*\/\s*\d+[^.]*)/i);
    const body = colonBody ? parseSummonBody(colonBody[1], "ON_SUMMON") : null;
    if (body) {
      classified.push(body);
      for (let i = classified.length - 2; i >= 0; i -= 1) {
        if (classified[i].op === "UNKNOWN") classified.splice(i, 1);
      }
    }
  }

  // 6c. Graveyard recursion rider. A clause that clearly returns a dead friendly
  //     unit's CARD to hand (RETURN_FROM_GRAVE) or resummons a dead friendly unit
  //     onto the board (RESURRECT). Trigger is ON_DEATH when the text reads as a
  //     deathrattle ("When this unit dies, ..."), otherwise the on-play battlecry
  //     (ON_SUMMON). The return-to-hand path is checked first; the two REs are
  //     destination-disjoint (hand vs. play) so they never both match.
  if (!classified.some((s) => s.op === "RETURN_FROM_GRAVE" || s.op === "RESURRECT")) {
    const graveTrigger: EffectTrigger = ON_DEATH_RE.test(text) ? "ON_DEATH" : "ON_SUMMON";
    let graveSpec: EffectSpec | null = null;
    if (RETURN_FROM_GRAVE_RE.test(text)) {
      graveSpec = { trigger: graveTrigger, op: "RETURN_FROM_GRAVE", raw: text };
    } else if (RESURRECT_RE.test(text)) {
      graveSpec = { trigger: graveTrigger, op: "RESURRECT", raw: text };
    } else if (ON_DEATH_RE.test(text) && REGROW_RETURN_RE.test(text)) {
      // Regrow self-recursion: on death, the unit's own card returns to hand. Only
      // when the unit actually DIES (ON_DEATH) — the just-died card is the
      // most-recent grave record RETURN_FROM_GRAVE pops back.
      graveSpec = { trigger: "ON_DEATH", op: "RETURN_FROM_GRAVE", raw: text };
    }
    if (graveSpec) {
      classified.push(graveSpec);
      for (let i = classified.length - 2; i >= 0; i -= 1) {
        if (classified[i].op === "UNKNOWN") classified.splice(i, 1);
      }
    }
  }

  // 7. Natural-language battlecry riders that have no leading keyword:
  //    faction-scaled summon buffs and on-damage reactions. Skipped when the
  //    leading-keyword pass already emitted the equivalent trigger (e.g. an Oath
  //    ON_SUMMON BUFF_SELF, or a Taunt ON_DAMAGE rider) so the buff is not
  //    applied twice. When a rider classifies an otherwise-UNKNOWN clause, drop
  //    the UNKNOWN — it is now a real, behaviorally-wired effect.
  const naturalRiders: EffectSpec[] = [];
  if (!classified.some((s) => s.trigger === "ON_SUMMON" && s.op === "BUFF_SELF")) {
    const s = parseSummonScaledBuff(text);
    if (s) naturalRiders.push(s);
  }
  if (!classified.some((s) => s.trigger === "ON_SUMMON" && s.op === "BUFF_SELF") && !naturalRiders.some((s) => s.trigger === "ON_SUMMON" && s.op === "BUFF_SELF")) {
    const s = parseConditionalSummonBuff(text);
    if (s) naturalRiders.push(s);
  }
  // Untriggered self-scale buff ("This unit gains +N/+M for each <Faction>") —
  // a one-shot ON_SUMMON snapshot (Oath-equivalent). Only when no ON_SUMMON
  // BUFF_SELF was already produced.
  if (!classified.some((s) => s.trigger === "ON_SUMMON" && s.op === "BUFF_SELF") && !naturalRiders.some((s) => s.trigger === "ON_SUMMON" && s.op === "BUFF_SELF")) {
    const s = parseUntriggeredSelfScaleBuff(text);
    if (s) naturalRiders.push(s);
  }
  if (!classified.some((s) => s.trigger === "ON_DAMAGE")) {
    const s = parseOnDamageReaction(text);
    if (s) naturalRiders.push(s);
  }
  // "If it survives, gain +N/+M" — a conditional ON_DAMAGE self-buff. Only added
  // when no ON_DAMAGE buff already exists (a Taunt rider may have claimed it).
  if (!classified.some((s) => s.trigger === "ON_DAMAGE" && s.op === "BUFF_SELF") && !naturalRiders.some((s) => s.trigger === "ON_DAMAGE" && s.op === "BUFF_SELF")) {
    const s = parseSurvivesBuff(text);
    if (s) naturalRiders.push(s);
  }
  if (!classified.some((s) => s.trigger === "ON_SUMMON" && s.op === "HEAL")) {
    const s = parseSummonTargetedHeal(text);
    if (s) naturalRiders.push(...s);
  }
  // On-play single-target strike ("Charge. When this unit enters play, deal N to
  // target enemy unit"). Only when no ON_SUMMON damage was already classified.
  if (
    !classified.some((s) => s.trigger === "ON_SUMMON" && (s.op === "DEAL_DAMAGE" || s.op === "DAMAGE_ADJACENT_ENEMIES")) &&
    !naturalRiders.some((s) => s.trigger === "ON_SUMMON" && (s.op === "DEAL_DAMAGE" || s.op === "DAMAGE_ADJACENT_ENEMIES"))
  ) {
    const s = parseOnPlayDealRider(text);
    if (s) naturalRiders.push(s);
  }
  // On-attack rider ("Charge. When this unit attacks, gains +N/+M for each <X> /
  // deals N to target enemy unit"). Skipped if an ON_ATTACK op (e.g. Rally/Cleave)
  // already exists.
  if (
    !classified.some((s) => s.trigger === "ON_ATTACK") &&
    !naturalRiders.some((s) => s.trigger === "ON_ATTACK")
  ) {
    const s = parseOnAttackRider(text);
    if (s) naturalRiders.push(s);
  }
  if (naturalRiders.length) {
    classified.push(...naturalRiders);
    for (let i = classified.length - naturalRiders.length - 1; i >= 0; i -= 1) {
      if (classified[i].op === "UNKNOWN") classified.splice(i, 1);
    }
  }

  // 8. Bespoke named-mechanic ops (destroy-select, mirror, cost auras, silence,
  //    once-death revive, ...). These have distinctive phrasing that the generic
  //    keyword/aura templates above never match, so a clause carrying one would
  //    otherwise be left UNKNOWN. Each emitted op is added only if an identical
  //    (op,trigger) pair was not already classified, then any UNKNOWN is dropped.
  const named = parseNamedMechanics(text);
  if (named.length) {
    const added: EffectSpec[] = [];
    for (const ns of named) {
      if (!classified.some((s) => s.op === ns.op && s.trigger === ns.trigger)) {
        classified.push(ns);
        added.push(ns);
      }
    }
    if (added.length) {
      for (let i = classified.length - added.length - 1; i >= 0; i -= 1) {
        if (classified[i].op === "UNKNOWN") classified.splice(i, 1);
      }
    }
  }

  const NO_OP: EffectOp[] = ["STAT_LINE", "GRANT_KEYWORD", "KEYWORD_WIRED", "GLOBAL_UNPARSED"];
  const specs = classified.filter((s) => !NO_OP.includes(s.op) && s.op !== "UNKNOWN");
  const recognized = classified.length > 0 && !classified.some((s) => s.op === "UNKNOWN");

  return { specs, classified, recognized };
}
