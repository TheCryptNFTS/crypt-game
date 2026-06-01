import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setGuestSessionStub } from "../lib/appSession";
import { useAppSessionStubSnapshot } from "../hooks/useAppSessionStub";
import { isOnboarded } from "../lib/localProgress";
import { ensureStarterDeckEquipped } from "../lib/starterDeck";

/**
 * Game entry — CRYPT client, not a dashboard.
 * A brand-new pilot is sent straight into the forced first-time tutorial; a
 * returning (onboarded) pilot lands on /home. Either way we auto-equip the
 * curated starter deck so "Play" works with zero deckbuilding.
 * TODO: wire Sign in / Create account / Wallet when auth APIs exist.
 */
export default function SplashLoginPage() {
  const navigate = useNavigate();
  const session = useAppSessionStubSnapshot();
  const [soonKind, setSoonKind] = useState<"account" | "wallet" | null>(null);

  // First entry (no tutorial flag, no first win) → tutorial; otherwise → home.
  const entryRoute = () => (isOnboarded() ? "/home" : "/tutorial");

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
      <div className="crypt-splash-atmosphere" aria-hidden />

      <div className="crypt-splash-main">
        <div className="crypt-splash-brand">
          <div className="crypt-splash-mark-wrap">
            <span className="crypt-splash-mark-glow" aria-hidden />
            <span className="crypt-brand-icon crypt-splash-mark" aria-hidden />
          </div>
          <p className="crypt-splash-wordmark">CRYPT</p>
          <p className="crypt-splash-ingress">Enter the Crypt</p>
          <p className="crypt-splash-tagline">Crypt Legends · collectible-first tactical TCG</p>
        </div>

        <div className="crypt-splash-actions">
          <button type="button" className="crypt-splash-cta-guest" onClick={onGuest}>
            Continue as guest
          </button>

          <div className="crypt-splash-row-secondary">
            <button type="button" className="crypt-splash-cta-secondary" onClick={() => setSoonKind("account")}>
              Sign in
            </button>
            <span className="crypt-splash-divider" aria-hidden>
              ·
            </span>
            <button type="button" className="crypt-splash-cta-secondary" onClick={() => setSoonKind("account")}>
              Create account
            </button>
          </div>

          <button
            type="button"
            className="crypt-splash-cta-wallet"
            onClick={() => setSoonKind("wallet")}
          >
            Link wallet
          </button>

          {soonKind === "account" && (
            <p className="crypt-splash-soon">
              Accounts are not live yet. Guest runs the full duel loop on device—progress stays local until cloud saves
              ship.
            </p>
          )}
          {soonKind === "wallet" && (
            <p className="crypt-splash-soon">
              Wallet link follows real accounts. Crypt OG Skulls and Crypt Digital Trading Cards stay collectible-first—policy
              and timing TBD.
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
