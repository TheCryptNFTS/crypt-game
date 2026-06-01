import { useCallback, useMemo, useState } from "react";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import LiveCryptMatchPage from "./LiveCryptMatchPage";
import {
  generateSealedPool,
  buildLimitedDeckFromPool,
  validateLimitedDeck,
  pickLimitedCommander,
  type SealedPool,
  type SealedPoolCard,
  LIMITED_MAX_DECK,
  SEALED_DEFAULT_PACKS,
} from "../engine/sealedMode";
import {
  saveSealedRun,
  loadStoredSealedSeed,
} from "../lib/sealedDeckStorage";

/**
 * SEALED / DRAFT build screen.
 *
 * Sealed: open a seeded ~90-card pool from the curated set, build a legal 30-card
 * limited deck, then "Play with this deck" enters the SAME solo match-start the
 * Play hub uses (LiveCryptMatchPage with the limited deck as the player's deck).
 *
 * Everything is seeded + deterministic: a run is identified by its `seed`, so the
 * exact same pool reopens for the same seed (shareable / auditable). No
 * Math.random is used for pool generation — the seed is the only entropy, and it
 * feeds the engine's seeded PRNG.
 *
 * Guest / offline degrades gracefully: storage is best-effort (private mode just
 * makes the run non-persistent) and no network is required.
 *
 * Theme: purple #8D5CFF, gold #E9C984. No emojis — ⬡ glyph + typographic marks.
 */

const PURPLE = "#8D5CFF";
const GOLD = "#E9C984";
const INK = "#0d0b16";
const PANEL = "#161325";
const LINE = "#2a2440";
const MUTE = "#9a93b8";

const TYPE_LABEL: Record<SealedPoolCard["type"], string> = {
  unit: "Unit",
  equipment: "Equip",
  artifact: "Artifact",
  spell: "Spell",
};

const FACTION_LABEL: Record<string, string> = {
  STONE_KEEPERS: "Stone",
  IRON_DEFENDERS: "Iron",
  BRONZE_GUARDIANS: "Bronze",
  SILVER_SENTINELS: "Silver",
  GOLDEN_SOVEREIGNS: "Gold",
  GODS: "Gods",
};

/** A fresh seed for a NEW run. The seed is just a run identifier; pool generation
 *  itself stays fully seeded/deterministic. Mixes time + a counter so repeated
 *  clicks differ, but the resulting pool is always reproducible from the seed. */
let seedNonce = 0;
function freshSeed(): number {
  seedNonce += 1;
  return (Date.now() ^ (seedNonce * 0x9e3779b1)) >>> 0;
}

function CardChip({
  card,
  count,
  onClick,
  picked,
}: {
  card: SealedPoolCard;
  count: number;
  onClick: () => void;
  picked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${card.name} — cost ${card.cost}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        borderRadius: 8,
        border: `1px solid ${picked ? GOLD : LINE}`,
        background: picked ? "rgba(233,201,132,0.08)" : PANEL,
        color: "#e9e6f5",
        cursor: "pointer",
        fontSize: 12,
        lineHeight: 1.2,
      }}
    >
      <span
        aria-hidden
        style={{
          minWidth: 20,
          height: 20,
          display: "grid",
          placeItems: "center",
          borderRadius: 5,
          background: INK,
          color: GOLD,
          fontWeight: 700,
        }}
      >
        {card.cost}
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {card.name}
      </span>
      <span style={{ color: MUTE, fontSize: 10 }}>
        {FACTION_LABEL[card.faction] ?? card.faction} · {TYPE_LABEL[card.type] ?? card.type}
      </span>
      {count > 0 && (
        <span style={{ color: GOLD, fontWeight: 700 }}>×{count}</span>
      )}
    </button>
  );
}

export default function DraftPage() {
  const [seed, setSeed] = useState<number>(() => loadStoredSealedSeed() ?? freshSeed());
  const [pool, setPool] = useState<SealedPool>(() => generateSealedPool(seed, SEALED_DEFAULT_PACKS));
  // Deck is a multiset of pool card ids the player has picked.
  const [deck, setDeck] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);

  const reopen = useCallback((nextSeed: number) => {
    setSeed(nextSeed);
    setPool(generateSealedPool(nextSeed, SEALED_DEFAULT_PACKS));
    setDeck([]);
    setPlaying(false);
  }, []);

  const supply = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of pool.cards) m.set(c.id, (m.get(c.id) ?? 0) + 1);
    return m;
  }, [pool]);

  const deckCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of deck) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [deck]);

  const validation = useMemo(() => validateLimitedDeck(deck, pool), [deck, pool]);

  // Stable display order: cost, then faction, then name.
  const sortedPool = useMemo(() => {
    const seen = new Set<string>();
    const uniq: SealedPoolCard[] = [];
    for (const c of pool.cards) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      uniq.push(c);
    }
    return uniq.sort(
      (a, b) =>
        a.cost - b.cost ||
        (a.faction < b.faction ? -1 : a.faction > b.faction ? 1 : 0) ||
        a.name.localeCompare(b.name),
    );
  }, [pool]);

  const deckCards = useMemo(() => {
    const byId = new Map(pool.cards.map((c) => [c.id, c]));
    return deck
      .map((id) => byId.get(id))
      .filter((c): c is SealedPoolCard => !!c)
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [deck, pool]);

  const addCard = useCallback(
    (id: string) => {
      setDeck((prev) => {
        if (prev.length >= LIMITED_MAX_DECK) return prev;
        const have = prev.filter((x) => x === id).length;
        const opened = supply.get(id) ?? 0;
        if (have >= opened) return prev; // can't run more than you opened
        return [...prev, id];
      });
    },
    [supply],
  );

  const removeCard = useCallback((id: string) => {
    setDeck((prev) => {
      const idx = prev.lastIndexOf(id);
      if (idx < 0) return prev;
      const next = prev.slice();
      next.splice(idx, 1);
      return next;
    });
  }, []);

  const autoBuild = useCallback(() => {
    setDeck(buildLimitedDeckFromPool(pool));
  }, [pool]);

  const playWithDeck = useCallback(() => {
    if (!validation.valid) return;
    const commanderId = pickLimitedCommander(deck);
    saveSealedRun({ seed: pool.seed, deck, commanderId });
    setPlaying(true);
  }, [validation.valid, deck, pool.seed]);

  // PLAY: reuse the SAME solo match-start as the Play hub. LiveCryptMatchPage
  // takes the player's deck via `ownedCardIds` and runs it through the shared
  // createMatchFromDecks path — no forked match logic.
  if (playing) {
    return (
      <div>
        <div style={{ padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setPlaying(false)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${LINE}`,
              background: PANEL,
              color: GOLD,
              cursor: "pointer",
            }}
          >
            ← Back to build
          </button>
          <span style={{ color: MUTE, fontSize: 12 }}>
            Limited run · seed {pool.seed}
          </span>
        </div>
        <LiveCryptMatchPage ownedCardIds={deck} />
      </div>
    );
  }

  const remaining = LIMITED_MAX_DECK - deck.length;

  return (
    <CryptPageFrame
      eyebrow="Limited"
      title="Sealed / Draft"
      lead={
        <>
          Open a sealed pool from the curated set and forge a {LIMITED_MAX_DECK}-card
          limited deck. Same seed, same pool — runs are reproducible.
        </>
      }
    >
      {/* Run controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${LINE}`,
          background: PANEL,
          marginBottom: 14,
        }}
      >
        <span style={{ color: GOLD, fontWeight: 700, letterSpacing: 0.4 }}>⬡ Seal</span>
        <label style={{ color: MUTE, fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) reopen(n >>> 0);
            }}
            style={{
              width: 130,
              padding: "5px 8px",
              borderRadius: 7,
              border: `1px solid ${LINE}`,
              background: INK,
              color: "#e9e6f5",
              fontSize: 12,
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => reopen(freshSeed())}
          style={ctaStyle(false)}
        >
          Open new pool
        </button>
        <button type="button" onClick={autoBuild} style={ctaStyle(false)}>
          Auto-build
        </button>
        <button type="button" onClick={() => setDeck([])} style={ctaStyle(false)}>
          Clear deck
        </button>
        <span style={{ color: MUTE, fontSize: 12 }}>
          Pool: {pool.cards.length} cards · {SEALED_DEFAULT_PACKS} packs
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* POOL */}
        <section>
          <h2 style={sectionLabel}>Your pool</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 6,
              maxHeight: 520,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {sortedPool.map((card) => {
              const opened = supply.get(card.id) ?? 0;
              const used = deckCount.get(card.id) ?? 0;
              const exhausted = used >= opened || deck.length >= LIMITED_MAX_DECK;
              return (
                <div key={card.id} style={{ opacity: exhausted ? 0.45 : 1 }}>
                  <CardChip
                    card={card}
                    count={used}
                    picked={used > 0}
                    onClick={() => addCard(card.id)}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* DECK + legality */}
        <section>
          <h2 style={sectionLabel}>
            Limited deck · {deck.length}/{LIMITED_MAX_DECK}
          </h2>

          <div
            style={{
              borderRadius: 10,
              border: `1px solid ${validation.valid ? GOLD : LINE}`,
              background: PANEL,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: MUTE, marginBottom: 8 }}>
              <span>Units {validation.stats.units}</span>
              <span>Equip {validation.stats.equipment}</span>
              <span>Artifacts {validation.stats.artifacts}</span>
              {remaining > 0 && <span style={{ color: GOLD }}>{remaining} to go</span>}
            </div>

            {validation.valid ? (
              <p style={{ color: GOLD, fontSize: 12, margin: 0 }}>
                ⬡ Legal limited deck — ready to play.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 16, color: "#ff9a9a", fontSize: 12 }}>
                {validation.errors.slice(0, 3).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {validation.warnings.length > 0 && (
              <p style={{ color: MUTE, fontSize: 11, margin: "6px 0 0" }}>
                {validation.warnings[0]}
              </p>
            )}

            <button
              type="button"
              onClick={playWithDeck}
              disabled={!validation.valid}
              style={ctaStyle(true, !validation.valid)}
            >
              Play with this deck →
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            {deckCards.length === 0 ? (
              <p style={{ color: MUTE, fontSize: 12 }}>
                Pick cards from your pool — or hit Auto-build for a quick legal deck.
              </p>
            ) : (
              deckCards.map((card, i) => (
                <CardChip
                  key={`${card.id}-${i}`}
                  card={card}
                  count={0}
                  onClick={() => removeCard(card.id)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </CryptPageFrame>
  );
}

const sectionLabel: React.CSSProperties = {
  color: PURPLE,
  fontSize: 13,
  letterSpacing: 1,
  textTransform: "uppercase",
  margin: "0 0 8px",
};

function ctaStyle(primary: boolean, disabled = false): React.CSSProperties {
  return {
    padding: primary ? "9px 14px" : "6px 12px",
    marginTop: primary ? 10 : 0,
    width: primary ? "100%" : undefined,
    borderRadius: 8,
    border: `1px solid ${primary ? GOLD : LINE}`,
    background: primary ? (disabled ? "#3a3550" : `linear-gradient(180deg, ${PURPLE}, #6f45d6)`) : PANEL,
    color: primary ? (disabled ? MUTE : "#fff") : "#e9e6f5",
    fontWeight: primary ? 700 : 500,
    fontSize: primary ? 14 : 12,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}
