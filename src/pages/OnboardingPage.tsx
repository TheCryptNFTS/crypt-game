import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { buildCuratedDeck } from "../lib/buildCuratedDeck";
import {
  LS_DECK_BUILDER_COMMANDER,
  LS_DECK_BUILDER_MAIN_DECK,
} from "../lib/deckBuilderStorage";

/**
 * WS5 · ONBOARDING / NPE — the guided first-run on-ramp. Billy's #1 complaint is
 * "app too complex"; this collapses the first 60 seconds into three obvious
 * steps with progressive disclosure:
 *   1. PICK a starter identity (3 curated commanders — no deckbuilding).
 *   2. We equip a balanced 30-card curated deck for that pick (reuses
 *      buildCuratedDeck — real, balanced content, no new cards).
 *   3. PLAY your first match — routed into the existing forced tutorial duel.
 *
 * Advanced surfaces stay gated by OnboardingGate; this page only writes the
 * deck-builder storage the rest of the app already reads. No engine/meta change.
 */

/** The three newcomer-friendly identities, each a clear archetype one-liner. */
const STARTER_PICKS = [
  {
    id: "cmd_stone_warden",
    tagline: "Defensive wall",
    blurb: "Guard units soak hits while you grind the long game. The forgiving pick.",
    accent: "#7fb8ff",
  },
  {
    id: "cmd_bronze_raider",
    tagline: "Fast aggression",
    blurb: "Flood the board and chip the enemy nexus every turn. End games early.",
    accent: "#e9a35a",
  },
  {
    id: "cmd_silver_oracle",
    tagline: "Cards & control",
    blurb: "Scry, out-draw, and answer threats. The thinking-player's deck.",
    accent: "#c79bff",
  },
] as const;

type Step = "pick" | "ready";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("pick");
  const [chosen, setChosen] = useState<string | null>(null);

  const picks = useMemo(
    () =>
      STARTER_PICKS.map((p) => ({
        ...p,
        spec: COMMANDER_SPECS[p.id],
      })).filter((p) => !!p.spec),
    [],
  );

  /** Equip the curated deck for the chosen commander into the shared storage. */
  const equip = (commanderId: string) => {
    try {
      const deck = buildCuratedDeck(commanderId);
      localStorage.setItem(LS_DECK_BUILDER_COMMANDER, commanderId);
      localStorage.setItem(LS_DECK_BUILDER_MAIN_DECK, JSON.stringify(deck));
    } catch {
      /* private mode — the tutorial still falls back to its own starter deck */
    }
  };

  const onPick = (commanderId: string) => {
    setChosen(commanderId);
    equip(commanderId);
    setStep("ready");
  };

  const chosenSpec = chosen ? COMMANDER_SPECS[chosen] : null;

  return (
    <CryptPageFrame
      eyebrow="Welcome · first run"
      title={step === "pick" ? "Choose your style" : "You're ready"}
      lead={
        step === "pick" ? (
          <>
            Pick a starting deck — we handle the rest.{" "}
            <span className="text-[color:var(--color-crypt-muted)]">
              No deckbuilding. You can change it later.
            </span>
          </>
        ) : (
          <>
            Your deck is equipped. Next: play one guided match to learn the loop.
          </>
        )
      }
    >
      {/* Three-step rail so a newcomer always sees where they are. */}
      <ol className="crypt-npe-steps" aria-label="Onboarding steps">
        <li className={step === "pick" ? "is-active" : "is-done"}>1 · Pick a deck</li>
        <li className={step === "ready" ? "is-active" : ""}>2 · First match</li>
        <li>3 · Play freely</li>
      </ol>

      {step === "pick" ? (
        <section className="crypt-npe-picks" aria-label="Starter deck options">
          {picks.map((p) => (
            <button
              key={p.id}
              type="button"
              className="crypt-npe-pick"
              style={{ borderColor: p.accent }}
              onClick={() => onPick(p.id)}
            >
              <span className="crypt-npe-pick-tag" style={{ color: p.accent }}>
                {p.tagline}
              </span>
              <span className="crypt-npe-pick-name">{p.spec.name}</span>
              <span className="crypt-npe-pick-blurb">{p.blurb}</span>
              <span className="crypt-npe-pick-passive">{p.spec.passive}</span>
              <span className="crypt-npe-pick-cta" style={{ color: p.accent }}>
                Choose →
              </span>
            </button>
          ))}
        </section>
      ) : (
        <section className="crypt-npe-ready" aria-label="Start first match">
          <div className="crypt-npe-ready-card">
            <p className="crypt-npe-ready-kicker">⬡ Equipped</p>
            <h2 className="crypt-npe-ready-name">{chosenSpec?.name}</h2>
            <p className="crypt-npe-ready-copy">
              A balanced 30-card deck is ready. Your first match is a guided duel
              against a gentle opponent — you'll learn lanes, deploying units, and
              attacking in about a minute.
            </p>
            <button
              type="button"
              className="crypt-npe-ready-cta"
              onClick={() => navigate("/tutorial")}
            >
              Play your first match
            </button>
            <button
              type="button"
              className="crypt-npe-ready-back"
              onClick={() => setStep("pick")}
            >
              ← Pick a different deck
            </button>
          </div>
        </section>
      )}
    </CryptPageFrame>
  );
}
