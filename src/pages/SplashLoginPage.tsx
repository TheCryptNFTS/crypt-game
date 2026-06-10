import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setGuestSessionStub } from "../lib/appSession";
import { useAppSessionStubSnapshot } from "../hooks/useAppSessionStub";
import { isOnboarded } from "../lib/localProgress";
import { ensureStarterDeckEquipped } from "../lib/starterDeck";
import { funnelOnce } from "../lib/funnel";
import commanderArt from "../data/commanderArt.json";

const ART = commanderArt as Record<string, string>;
/** Real TCG commander art fanned behind the wordmark — the front door SHOWS the
 *  game's best asset instead of gating it behind a login. Center card forward. */
const HERO_FAN = [
  "cmd_iron_warlord",
  "cmd_bronze_raider",
  "cmd_stone_warden",
  "cmd_silver_oracle",
  "cmd_golden_emperor",
];

/**
 * Game entry — CRYPT client, not a dashboard.
 * A brand-new pilot is sent into the guided onboarding on-ramp (/onboarding:
 * pick a starter deck -> first match); a returning (onboarded) pilot lands on
 * /home. Either way we auto-equip the curated starter deck so "Play" works with
 * zero deckbuilding even if they skip the picker.
 * TODO: wire Sign in / Create account / Wallet when auth APIs exist.
 */
export default function SplashLoginPage() {
  const navigate = useNavigate();
  const session = useAppSessionStubSnapshot();
  const [soonKind, setSoonKind] = useState<"account" | "wallet" | null>(null);

  // First entry (no tutorial flag, no first win) → guided onboarding on-ramp;
  // otherwise → home.
  const entryRoute = () => (isOnboarded() ? "/home" : "/onboarding");

  // FTUE funnel stage 1 (once per device).
  useEffect(() => {
    funnelOnce("splash_view");
  }, []);

  useEffect(() => {
    if (session === "guest") {
      ensureStarterDeckEquipped();
      navigate(entryRoute(), { replace: true });
    }
  }, [navigate, session]);

  const onGuest = () => {
    setGuestSessionStub();
    ensureStarterDeckEquipped();
    navigate(entryRoute(), { replace: true });
  };

  return (
    <div className="crypt-splash">
      <div className="crypt-splash-backdrop" aria-hidden />
      <div className="crypt-splash-atmosphere" aria-hidden />

      <div className="crypt-splash-main">
        <div className="crypt-splash-hero">
          <div className="crypt-splash-fan" aria-hidden>
            {HERO_FAN.map((id, i) => (
              <span key={id} className="crypt-splash-fan-card" data-pos={i}>
                <img src={ART[id]} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" />
              </span>
            ))}
          </div>

          <div className="crypt-splash-brand">
            <p className="crypt-splash-wordmark">CRYPT</p>
            <h1 className="crypt-splash-hook">Command the dead. Duel for the Hex.</h1>
            <p className="crypt-splash-tagline">Crypt Legends · a dark collectible card game</p>
          </div>
        </div>

        <div className="crypt-splash-actions">
          <button type="button" className="crypt-splash-cta-guest" onClick={onGuest}>
            Play now — enter the Crypt
          </button>

          <div className="crypt-splash-row-secondary">
            <button type="button" className="crypt-splash-cta-secondary" onClick={() => setSoonKind("account")}>
              Sign in
            </button>
            <span className="crypt-splash-divider" aria-hidden>·</span>
            <button type="button" className="crypt-splash-cta-secondary" onClick={() => setSoonKind("account")}>
              Create account
            </button>
            <span className="crypt-splash-divider" aria-hidden>·</span>
            <button type="button" className="crypt-splash-cta-secondary" onClick={() => setSoonKind("wallet")}>
              Link wallet
            </button>
          </div>

          {soonKind === "account" && (
            <p className="crypt-splash-soon">
              Accounts aren't live yet — Play now runs the full duel on device; progress stays local until cloud saves ship.
            </p>
          )}
          {soonKind === "wallet" && (
            <p className="crypt-splash-soon">
              Wallet link follows real accounts. Crypt OG Skulls and Digital Trading Cards stay collectible-first — policy and timing TBD.
            </p>
          )}
        </div>
      </div>

      <footer className="crypt-splash-footer">
        <span className="crypt-splash-foot-note">
          Closed alpha · Crypt Legends. Guest saves on device. Reliquary is preview-only—no checkout.
        </span>
        <span className="crypt-splash-foot-source">Crypt Legends · @thecryptnfts on Medium</span>
      </footer>
    </div>
  );
}
