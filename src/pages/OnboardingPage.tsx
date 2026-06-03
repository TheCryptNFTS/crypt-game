import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { t } from "../i18n";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { buildCuratedDeck } from "../lib/buildCuratedDeck";
import commanderArt from "../data/commanderArt.json";
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
const ART = commanderArt as Record<string, string>;

const STARTER_PICKS = [
  {
    id: "cmd_stone_warden",
    faction: "Stone Keepers",
    tagline: "Defensive wall",
    blurb: "Guard units soak hits while you grind the long game. The forgiving pick.",
    accent: "#b0b4c4",
    sigil: "/crypt-assets/sigil-stone.png",
    // Real NFT skull art for the commander.
    art: ART["cmd_stone_warden"],
  },
  {
    id: "cmd_bronze_raider",
    faction: "Bronze Guardians",
    tagline: "Fast aggression",
    blurb: "Flood the board and chip the enemy nexus every turn. End games early.",
    accent: "#c98b48",
    sigil: "/crypt-assets/sigil-bronze.png",
    art: ART["cmd_bronze_raider"],
  },
  {
    id: "cmd_silver_oracle",
    faction: "Silver Sentinels",
    tagline: "Cards & control",
    blurb: "Scry, out-draw, and answer threats. The thinking-player's deck.",
    accent: "#96d7eb",
    sigil: "/crypt-assets/sigil-silver.png",
    // silver_oracle is a curated identity with no minted NFT — borrow a real
    // Silver Sentinels commander skull so the pick still shows premium art.
    art: ART["cmd_grave_oracle"],
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
      eyebrow={t("onboarding.eyebrow")}
      title={step === "pick" ? t("onboarding.title.pick") : t("onboarding.title.ready")}
      lead={
        step === "pick" ? (
          <>
            {t("onboarding.lead.pickIntro")}{" "}
            <span className="text-[color:var(--color-crypt-muted)]">
              {t("onboarding.lead.pickSub")}
            </span>
          </>
        ) : (
          <>
            {t("onboarding.lead.ready")}
          </>
        )
      }
    >
      {/* Three-step rail so a newcomer always sees exactly where they are. */}
      <ol className="crypt-npe-steps" aria-label={t("onboarding.steps.aria")}>
        <li className={step === "pick" ? "is-active" : "is-done"}>
          {step === "pick" ? t("onboarding.steps.pickActive") : t("onboarding.steps.pickDone")}
        </li>
        <li className={step === "ready" ? "is-active" : ""}>{t("onboarding.steps.match")}</li>
        <li>{t("onboarding.steps.free")}</li>
      </ol>

      {/* Always-available escape hatch into the full how-to-play reference. */}
      <p
        style={{
          margin: "-8px 0 18px",
          fontSize: 13,
          color: "var(--color-crypt-muted)",
        }}
      >
        {t("onboarding.help.prompt")}
        <Link
          to="/help"
          style={{ color: "var(--color-crypt-accent)", textDecoration: "underline" }}
        >
          {t("onboarding.help.link")}
        </Link>
      </p>

      {step === "pick" ? (
        <section className="crypt-npe-picks" aria-label={t("onboarding.picks.aria")}>
          {picks.map((p) => (
            <button
              key={p.id}
              type="button"
              className="crypt-npe-pick"
              style={{ borderColor: p.accent, ["--pick-accent" as string]: p.accent }}
              onClick={() => onPick(p.id)}
            >
              {/* Commander skull art header — the premium first impression. */}
              <span className="crypt-npe-pick-art" aria-hidden>
                {p.art ? <img src={p.art} alt="" loading="eager" decoding="async" /> : null}
                <span className="crypt-npe-pick-art-fade" />
                {p.sigil ? <img className="crypt-npe-pick-sigil" src={p.sigil} alt="" /> : null}
              </span>
              <span className="crypt-npe-pick-tag" style={{ color: p.accent }}>
                {p.tagline}
              </span>
              <span className="crypt-npe-pick-name">{p.spec.name}</span>
              <span className="crypt-npe-pick-faction">{p.faction}</span>
              <span className="crypt-npe-pick-blurb">{p.blurb}</span>
              <span className="crypt-npe-pick-passive">{p.spec.passive}</span>
              <span className="crypt-npe-pick-cta" style={{ color: p.accent }}>
                {t("onboarding.picks.choose")}
              </span>
            </button>
          ))}
        </section>
      ) : (
        <section className="crypt-npe-ready" aria-label={t("onboarding.ready.aria")}>
          <div className="crypt-npe-ready-card">
            <p className="crypt-npe-ready-kicker">{t("onboarding.ready.kicker")}</p>
            <h2 className="crypt-npe-ready-name">{chosenSpec?.name}</h2>
            <p className="crypt-npe-ready-copy">
              {t("onboarding.ready.copy")}
            </p>
            <button
              type="button"
              className="crypt-npe-ready-cta"
              onClick={() => navigate("/tutorial")}
            >
              {t("onboarding.ready.cta")}
            </button>
            <button
              type="button"
              className="crypt-npe-ready-back"
              onClick={() => setStep("pick")}
            >
              {t("onboarding.ready.back")}
            </button>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--color-crypt-muted)" }}>
              {t("onboarding.ready.rulesPrompt")}
              <Link
                to="/help"
                style={{ color: "var(--color-crypt-accent)", textDecoration: "underline" }}
              >
                {t("onboarding.ready.rulesLink")}
              </Link>
            </p>
          </div>
        </section>
      )}
    </CryptPageFrame>
  );
}
