import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { KEYWORD_DESCRIPTIONS } from "../engine/keywordDescriptions";
import { t } from "../i18n";

/**
 * HELP · in-app glossary + how-to-play reference. Newcomer complexity is the
 * owner's #1 complaint, so this is the one calm place a confused player can land:
 * the turn loop, the board (lanes + nexus), energy, the factions, and a live
 * keyword glossary pulled straight from the engine's single source of truth
 * (keywordDescriptions.ts) so it can never drift from real card text.
 *
 * Pure reference — no engine, meta, or storage writes. Reachable at /help.
 */

const GOLD = "var(--color-crypt-accent)";
const PURPLE = "var(--color-crypt-ice)";
const TEXT = "var(--color-crypt-text)";
const MUTED = "var(--color-crypt-muted)";
const BORDER = "var(--color-crypt-border)";
const BORDER_STRONG = "var(--color-crypt-border-strong)";

type Basic = { term: string; body: string };

/** The five things that confuse a brand-new pilot most — kept plain. */
const TURN_FLOW: Basic[] = [
  {
    term: "1 · Draw & gain energy",
    body: "Each turn you draw a card and your energy pool refreshs and grows. Early turns are small; the game opens up as energy climbs.",
  },
  {
    term: "2 · Deploy units",
    body: "Spend energy to play units from your hand onto your board. A freshly-played unit has summoning sickness — it can't attack until your next turn (unless it has Rush).",
  },
  {
    term: "3 · Attack",
    body: "Send your ready units at enemy units or straight at their Hex. Guard / Taunt units must be cleared first.",
  },
  {
    term: "4 · End turn",
    body: "Pass to your opponent. Reduce the enemy Hex to 0 to win.",
  },
];

const BOARD: Basic[] = [
  {
    term: "Hex",
    body: "Your life total and the win condition. Both sides start at full Hex health; drop the enemy's to 0 and the match is yours.",
  },
  {
    term: "Energy",
    body: "Your per-turn resource. Every unit and spell has an energy cost. You can't play what you can't afford, so curve matters.",
  },
  {
    term: "Front lane",
    body: "The front row meets attackers first. Park your Guard bodies here to wall the enemy off your softer units and your Hex.",
  },
  {
    term: "Back lane",
    body: "The back row is shielded by the front — ideal for fragile value units and ranged/flying threats that strike without being hit.",
  },
];

const FACTIONS: { name: string; tag: string; body: string }[] = [
  { name: "Stone Keepers", tag: "Wall", body: "Durable guardians and anchored midrange. Hard to remove, oppressive on board — leans Guard & Crush." },
  { name: "Iron Defenders", tag: "Tempo", body: "Weapon-heavy, immediate pressure. Sharp and tempo-positive — leans Rush & Crush." },
  { name: "Bronze Guardians", tag: "Aggro", body: "Fast skirmishers that punish slow starts. Opens early and chips the Hex — leans Rush & Quickstep." },
  { name: "Silver Sentinels", tag: "Tricks", body: "Arcane tricksters with evasive tools and artifacts. Slippery and technical — leans Flying & spell value." },
  { name: "Golden Sovereigns", tag: "Top-end", body: "Elite finishers and premium bodies. Slower but powerful — leans Command, Mythic & Guard." },
  { name: "Gods", tag: "Mythic", body: "Rare, loud splash cards with unfair presence and hard restrictions. Capped on purpose." },
];

/** How many of KEYWORD_ORDER are the "core" combat keywords a newcomer needs first
 *  (RUSH, GUARD, TAUNT, FLYING, RANGED, CRUSH). The rest collapse behind a toggle. */
const CORE_KEYWORD_COUNT = 6;

/** Curated reading order so the most common combat keywords lead. */
const KEYWORD_ORDER = [
  "RUSH", "GUARD", "TAUNT", "FLYING", "RANGED", "CRUSH",
  // DIVINE_SHIELD shares WARD's mechanic and now displays as "Ward" too, so we
  // omit it here to avoid a duplicate glossary row. WINDFURY displays as "Relay".
  "LIFESTEAL", "SHIELD", "WARD", "WINDFURY",
  "QUICKSTEP", "MYTHIC", "COMMAND", "EXECUTE_PRESSURE",
  "DEATH_BLAST", "BATTLECRY_HERO_HIT", "DEATHKNELL", "DEPLOY", "ARMOR_GAIN",
];

/** Extra player-facing combat keywords described in this reference (the
 *  glossary table in keywordDescriptions covers engine keywords; Fear & Cleave
 *  are compiled abilities, summarized here so the table reads complete). */
const EXTRA_KEYWORDS: { label: string; description: string }[] = [
  { label: "Fear", description: "Low-cost enemy units can't block or attack into this unit — only their bigger threats can answer it." },
  { label: "Cleave", description: "On attack, splashes damage to the struck enemy's board-neighbors — punishes clustered defenders." },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  // 2026-06-17 (Algorithm review · "the app's too complex"): a newcomer sees only the
  // CORE combat keywords first (the six that lead KEYWORD_ORDER — RUSH/GUARD/TAUNT/
  // FLYING/RANGED/CRUSH); the rest collapse behind a toggle so /help isn't a 20-row
  // wall. Searching always spans the full glossary.
  const [showAllKeywords, setShowAllKeywords] = useState(false);

  const { keywords, totalKeywords } = useMemo(() => {
    const ordered = KEYWORD_ORDER
      .map((k) => KEYWORD_DESCRIPTIONS[k])
      .filter((k): k is NonNullable<typeof k> => !!k && !k.decorative)
      .map((k) => ({ label: k.label, description: k.description }));
    const all = [...ordered, ...EXTRA_KEYWORDS];
    const q = query.trim().toLowerCase();
    if (q) {
      return {
        keywords: all.filter(
          (k) =>
            k.label.toLowerCase().includes(q) ||
            k.description.toLowerCase().includes(q),
        ),
        totalKeywords: all.length,
      };
    }
    return {
      keywords: showAllKeywords ? all : all.slice(0, CORE_KEYWORD_COUNT),
      totalKeywords: all.length,
    };
  }, [query, showAllKeywords]);

  return (
    <CryptPageFrame
      eyebrow={t("help.eyebrow")}
      title={t("help.title")}
      lead={
        <>
          {t("help.lead.intro")}{" "}
          <Link to="/tutorial" style={{ color: GOLD, textDecoration: "underline" }}>
            {t("help.lead.guided")}
          </Link>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 760 }}>
        <Section title={t("help.section.turnLoop")} accent={PURPLE}>
          <Grid items={TURN_FLOW} accent={PURPLE} />
        </Section>

        <Section title={t("help.section.board")} accent={GOLD}>
          <Grid items={BOARD} accent={GOLD} />
        </Section>

        <Section title={t("help.section.keywords")} accent={PURPLE}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("help.keywords.filterPlaceholder")}
            aria-label={t("help.keywords.filterAria")}
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${BORDER_STRONG}`,
              background: "rgba(8, 6, 10, 0.6)",
              color: TEXT,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              outline: "none",
            }}
          />
          {keywords.length === 0 ? (
            <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>
              No keyword matches “{query}”.
            </p>
          ) : (
            <dl style={{ margin: 0, display: "grid", gap: 1, background: BORDER, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDER}` }}>
              {keywords.map((k) => (
                <div
                  key={k.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(96px, 132px) 1fr",
                    gap: 14,
                    padding: "12px 14px",
                    background: "rgba(16, 12, 18, 0.96)",
                  }}
                >
                  <dt
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: 14,
                      color: GOLD,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {k.label}
                  </dt>
                  <dd style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: MUTED }}>
                    {k.description}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {!query.trim() && totalKeywords > CORE_KEYWORD_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllKeywords((v) => !v)}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${BORDER_STRONG}`,
                background: "rgba(8, 6, 10, 0.6)",
                color: GOLD,
                fontFamily: "var(--font-display)",
                fontSize: 13,
                letterSpacing: "0.04em",
                cursor: "pointer",
              }}
            >
              {showAllKeywords
                ? "Show fewer"
                : `Show all ${totalKeywords} keywords →`}
            </button>
          )}
        </Section>

        <Section title={t("help.section.factions")} accent={GOLD}>
          <div style={{ display: "grid", gap: 10 }}>
            {FACTIONS.map((f) => (
              <div
                key={f.name}
                style={{
                  padding: "13px 15px",
                  borderRadius: 10,
                  border: `1px solid ${BORDER}`,
                  background: "linear-gradient(170deg, rgba(16,12,13,0.9), rgba(8,6,6,0.85))",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: TEXT }}>
                    {f.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: PURPLE,
                    }}
                  >
                    {f.tag}
                  </span>
                </div>
                <p style={{ margin: "5px 0 0", fontSize: 13, lineHeight: 1.5, color: MUTED }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
          <Link
            to="/tutorial"
            style={{
              padding: "11px 18px",
              borderRadius: 10,
              background: "linear-gradient(180deg, #C8A75D, var(--color-crypt-accent))",
              color: "#060507",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            {t("help.cta.tutorial")}
          </Link>
          <Link
            to="/play"
            style={{
              padding: "11px 18px",
              borderRadius: 10,
              border: `1px solid ${BORDER_STRONG}`,
              color: TEXT,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            {t("help.cta.match")}
          </Link>
        </div>
      </div>
    </CryptPageFrame>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 600,
          color: TEXT,
          margin: "0 0 12px",
          paddingLeft: 12,
          borderLeft: `3px solid ${accent}`,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ items, accent }: { items: Basic[]; accent: string }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      }}
    >
      {items.map((it) => (
        <div
          key={it.term}
          style={{
            padding: "13px 15px",
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: "rgba(16, 12, 18, 0.7)",
          }}
        >
          <p
            style={{
              margin: "0 0 5px",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 14,
              color: accent,
            }}
          >
            {it.term}
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: MUTED }}>
            {it.body}
          </p>
        </div>
      ))}
    </div>
  );
}
