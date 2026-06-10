import { describe, it, expect } from "vitest";
import { applyAction } from "../reducer";
import { allPlayableCards } from "../cards";
import { compileAbility } from "../abilityCompiler";
import { validateDeck } from "../deckRules";
import { makeSeededMatch } from "../../dev/reducerHarness";

/**
 * Engine-trust regression tests for the 2026-06-10 teardown bugs (D1/D2/D3/D4/D6
 * in docs/CRYPT_TCG_TEARDOWN_2026-06-10.md). Each of these reproduced against
 * the live reducer before the fix; they are pinned here as REAL vitest tests
 * (not proof scripts) so `npm test` guards them forever.
 */

function unit(id: string, over: Partial<any> = {}): any {
  return {
    instanceId: id,
    cardId: "t",
    lane: "front",
    attack: 0,
    health: 5,
    maxHealth: 5,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...over,
  };
}

describe("D1 — heals never damage the live player", () => {
  it("lifesteal at a 25-Hex start (newcomer cushion) keeps 25, never clamps down to 20", () => {
    const s = makeSeededMatch(9101);
    // The live hook's cushion: P1 starts above the standard cap and stamps its own max.
    s.players.P1.nexusHealth = 25;
    s.players.P1.maxNexusHealth = 25;
    s.players.P1.board.front = [unit("ls", { attack: 3, keywords: ["LIFESTEAL"] })];
    s.players.P2.board.front = [unit("d", { attack: 0, health: 10 })];
    const { state } = applyAction(s, {
      type: "ATTACK_UNIT",
      player: "P1",
      attackerInstanceId: "ls",
      defenderInstanceId: "d",
    });
    expect(state.players.P1.nexusHealth).toBe(25);
  });

  it("legacy state without maxNexusHealth: a heal NEVER reduces a face pool above 20", () => {
    const s = makeSeededMatch(9102);
    s.players.P1.nexusHealth = 25;
    delete (s.players.P1 as any).maxNexusHealth; // serialized pre-fix state shape
    s.players.P1.board.front = [unit("ls", { attack: 4, keywords: ["LIFESTEAL"] })];
    s.players.P2.board.front = [unit("d", { attack: 0, health: 10 })];
    const { state } = applyAction(s, {
      type: "ATTACK_UNIT",
      player: "P1",
      attackerInstanceId: "ls",
      defenderInstanceId: "d",
    });
    // cap = max(default 20, current 25) -> heal holds the line, never damages.
    expect(state.players.P1.nexusHealth).toBe(25);
  });

  it("a below-cap heal still caps at the player's own starting Hex", () => {
    const s = makeSeededMatch(9103);
    s.players.P1.nexusHealth = 18;
    s.players.P1.maxNexusHealth = 20;
    s.players.P1.board.front = [unit("ls", { attack: 5, keywords: ["LIFESTEAL"] })];
    s.players.P2.board.front = [unit("d", { attack: 0, health: 10 })];
    const { state } = applyAction(s, {
      type: "ATTACK_UNIT",
      player: "P1",
      attackerInstanceId: "ls",
      defenderInstanceId: "d",
    });
    expect(state.players.P1.nexusHealth).toBe(20); // 18 + 5 capped at 20, not 23
  });
});

describe("D2 — a legal cost-discounted play succeeds and never throws", () => {
  // Any catalog card carrying the continuous unit-cost-reduction aura
  // (e.g. King Tomb tcg_3370 "friendly units cost 1 less").
  const auraSource = (allPlayableCards as any[]).find(
    (c) =>
      c.type === "unit" &&
      compileAbility(c.rawTraits?.Ability).specs.some((s: any) => s.op === "AURA_COST_REDUCTION")
  );
  const playable = (allPlayableCards as any[]).find((c) => c.type === "unit" && c.cost === 3);

  it("the catalog still contains the cards this repro needs", () => {
    expect(auraSource).toBeTruthy();
    expect(playable).toBeTruthy();
  });

  it("energy = printed cost - 1 with a -1 aura on board: play resolves, energy hits 0", () => {
    const s = makeSeededMatch(9201);
    s.players.P1.board.front = [unit("tomb", { cardId: auraSource.id, health: 12 })];
    s.players.P1.hand = [playable.id];
    s.players.P1.energy = playable.cost - 1; // legal ONLY via the discount
    s.players.P1.maxEnergy = 10;
    let res!: ReturnType<typeof applyAction>;
    expect(() => {
      res = applyAction(s, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
    }).not.toThrow();
    const evTypes = res.events.map((e: any) => e.type);
    expect(evTypes).toContain("UNIT_PLAYED");
    expect(evTypes).not.toContain("REJECTED");
    expect(res.state.players.P1.energy).toBe(0); // charged the DISCOUNTED cost
    expect(res.state.players.P1.board.front.length).toBe(2);
  });

  it("crash containment: an engine exception inside applyAction reject-softs instead of escaping", () => {
    const s = makeSeededMatch(9202);
    s.players.P1.hand = [playable.id];
    s.players.P1.energy = 10;
    (s.players.P1.board as any).front = undefined; // corrupt state: forces a throw past validation
    let res!: ReturnType<typeof applyAction>;
    expect(() => {
      res = applyAction(s, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
    }).not.toThrow();
    expect(res.state).toBe(s); // clean rollback to the untouched input state
    expect(res.events).toHaveLength(1);
    expect(res.events[0].type).toBe("REJECTED");
    expect((res.events[0] as any).reason).toMatch(/^internal-error:/);
  });
});

describe("D4 — END_TURN deaths go through the full death pipeline", () => {
  // A real catalog unit whose ability self-damages at end of turn (DECAY tier).
  const decayCard = (allPlayableCards as any[]).find(
    (c) =>
      c.type === "unit" &&
      compileAbility(c.rawTraits?.Ability).specs.some(
        (s: any) => s.trigger === "ON_TURN_END" && s.op === "DEAL_DAMAGE" && s.self
      )
  );

  it("the catalog still contains an end-of-turn self-damage (decay) unit", () => {
    expect(decayCard).toBeTruthy();
  });

  it("a unit decayed to death at END_TURN reaches the graveyard and fires its death rules", () => {
    const s = makeSeededMatch(9301);
    const hasRattle = (decayCard.keywords ?? []).includes("DEATHRATTLE");
    s.players.P1.board.front = [
      unit("doomed", {
        cardId: decayCard.id,
        attack: decayCard.stats?.attack ?? 1,
        health: 1, // the end-of-turn decay tick kills it
        maxHealth: decayCard.stats?.health ?? 1,
        keywords: [...(decayCard.keywords ?? [])],
      }),
    ];
    const enemyHexBefore = s.players.P2.nexusHealth;
    const { state, events } = applyAction(s, { type: "END_TURN", player: "P1" });
    // Pre-fix: the corpse was silently filtered by the aura sweep — board empty
    // but graveyard EMPTY and no death rules fired. Post-fix: full pipeline.
    expect(state.players.P1.board.front.find((u: any) => u.instanceId === "doomed")).toBeUndefined();
    expect(state.players.P1.graveyard.map((g: any) => g.cardId)).toContain(decayCard.id);
    if (hasRattle) {
      expect(state.players.P2.nexusHealth).toBe(enemyHexBefore - 2); // DEATHRATTLE burst
    }
    expect(events.map((e: any) => e.type)).toContain("TURN_END");
  });
});

describe("god cap — the limit the UI advertises is actually enforced", () => {
  const gods = (allPlayableCards as any[]).filter((c) => c.faction === "GODS").map((c) => c.id);
  const stoneUnits = (allPlayableCards as any[])
    .filter((c) => c.faction === "STONE_KEEPERS" && c.type === "unit")
    .map((c) => c.id);

  it("the catalog still has gods and enough filler to build a 30-card deck", () => {
    expect(gods.length).toBeGreaterThanOrEqual(2);
    expect(stoneUnits.length).toBeGreaterThanOrEqual(28);
  });

  it("a deck exceeding maxGodCards is REJECTED (pre-fix it validated as legal)", () => {
    // 4 gods (2 ids × 2 copies) + 26 stone filler = 30 cards.
    const deck = [gods[0], gods[0], gods[1], gods[1], ...stoneUnits.slice(0, 26)];
    expect(deck.length).toBe(30);
    const res = validateDeck(deck, "cmd_stone_warden", {
      deckSize: 30,
      maxCopies: 2,
      allowGodCards: true,
      maxGodCards: 1,
    });
    expect(res.stats.godCount).toBe(4);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /GOD cards/.test(e))).toBe(true);
  });

  it("a deck within the god cap still validates", () => {
    const deck = [gods[0], ...stoneUnits.slice(0, 29)];
    const res = validateDeck(deck, "cmd_stone_warden", {
      deckSize: 30,
      maxCopies: 2,
      allowGodCards: true,
      maxGodCards: 1,
    });
    expect(res.stats.godCount).toBe(1);
    expect(res.valid).toBe(true);
  });
});

describe("D3 — artifacts can never wipe your own board (disabled in V1)", () => {
  // Artifacts stay in the catalog as dormant relics; the reducer must reject
  // the play BEFORE the legacy resolver path (refreshArtifactAuras ->
  // resetUnitToBase) can flatten the controller's own buffed front lane.
  const artifact = (allPlayableCards as any[]).find((c) => c.type === "artifact");

  it("the catalog still carries the dormant artifact cards this repro needs", () => {
    expect(artifact).toBeTruthy();
  });

  it("PLAY_ARTIFACT reject-softs and a buffed front lane keeps every buff (no resetUnitToBase wipe)", () => {
    const s = makeSeededMatch(9501);
    // A unit visibly above its base statline — equipment, PATIENT growth,
    // resonance and commander buffs all look like this. Pre-fix, ANY artifact
    // play reset it to base (2 attack, 0 armor) for 2-5 energy.
    s.players.P1.board.front = [
      unit("buffed", {
        attack: 7,
        baseAttack: 2,
        health: 9,
        maxHealth: 9,
        baseHealth: 4,
        armor: 3,
        baseArmor: 0,
        keywords: ["GUARD"],
      }),
    ];
    s.players.P1.hand = [artifact.id];
    s.players.P1.energy = 10;
    let res!: ReturnType<typeof applyAction>;
    expect(() => {
      res = applyAction(s, { type: "PLAY_ARTIFACT", player: "P1", handIndex: 0 });
    }).not.toThrow();
    expect(res.events).toEqual([{ type: "REJECTED", reason: "artifacts-disabled" }]);
    // Reject contract: the input state comes back untouched — nothing spent,
    // nothing wiped, the dead card simply stays in hand.
    expect(res.state).toBe(s);
    const u = res.state.players.P1.board.front[0] as any;
    expect(u.attack).toBe(7);
    expect(u.health).toBe(9);
    expect(u.armor).toBe(3);
    expect(u.keywords).toContain("GUARD");
    expect(res.state.players.P1.hand).toEqual([artifact.id]);
    expect(res.state.players.P1.energy).toBe(10);
  });
});

describe("D6 — STEALTH expires at its controller's next turn start", () => {
  it("a STEALTH+GUARD wall is untargetable for ONE enemy turn, then attackable (no permanent lock)", () => {
    const s = makeSeededMatch(9401);
    s.players.P1.board.front = [unit("atk", { attack: 2, health: 8 })];
    s.players.P2.board.front = [
      unit("wall", { attack: 0, health: 6, keywords: ["STEALTH", "GUARD"], stealthed: true }),
    ];

    // P1's turn: the stealthed GUARD blocks everything — and cannot itself be hit.
    const swing1 = applyAction(s, {
      type: "ATTACK_UNIT",
      player: "P1",
      attackerInstanceId: "atk",
      defenderInstanceId: "wall",
    });
    expect(swing1.events).toEqual([{ type: "REJECTED", reason: "defender-is-stealthed" }]);

    // Pass the turn to P2 (its controller): stealth lapses at P2's turn start.
    const afterEnd = applyAction(s, { type: "END_TURN", player: "P1" }).state;
    const wallAfter = afterEnd.players.P2.board.front.find((u: any) => u.instanceId === "wall");
    expect(wallAfter?.stealthed).toBe(false);

    // Back to P1: the wall is now a legal target — the lock is dead.
    const backToP1 = applyAction(afterEnd, { type: "END_TURN", player: "P2" }).state;
    const swing2 = applyAction(backToP1, {
      type: "ATTACK_UNIT",
      player: "P1",
      attackerInstanceId: "atk",
      defenderInstanceId: "wall",
    });
    expect(swing2.events.map((e: any) => e.type)).toContain("ATTACK");
    expect(swing2.events.map((e: any) => e.type)).not.toContain("REJECTED");
  });
});
