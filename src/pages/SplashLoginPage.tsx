import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setGuestSessionStub } from "../lib/appSession";
import { useAppSessionStubSnapshot } from "../hooks/useAppSessionStub";
import { isOnboarded } from "../lib/localProgress";
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
  // 2026-06-18 (holder feedback, NikoDaTroof: "am I able to connect my wallet to TCG?").
  // Wallet play was already LIVE — /match auto-adopts a connected wallet and fields your
  // owned Crypt cards — but the splash button said "coming soon," so holders thought they
  // couldn't. Make "Link wallet" actually connect; the match then loads your collection.
  const [walletState, setWalletState] = useState<"idle" | "connecting" | "connected" | "no-wallet">("idle");

  const connectWallet = async () => {
    setSoonKind(null);
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<unknown> } }).ethereum;
    if (!eth?.request) { setWalletState("no-wallet"); return; }
    setWalletState("connecting");
    try {
      const accs = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setWalletState(accs?.[0] ? "connected" : "idle");
    } catch { setWalletState("idle"); }
  };

  // First entry (no tutorial flag, no first win) → guided onboarding on-ramp;
  // otherwise → home.
  const entryRoute = () => (isOnboarded() ? "/home" : "/onboarding");

  // FTUE funnel stage 1 (once per device).
  useEffect(() => {
    funnelOnce("splash_view");
  }, []);

  useEffect(() => {
    if (session === "guest") {
      // Lazy-load the starter-deck builder so its ~7.5MB card-master data DOESN'T
      // ride the eager splash chunk (it blocked first paint on slow connections).
      // Equip THEN navigate so the deck is ready before the player can enter a match.
      void (async () => {
        const { ensureStarterDeckEquipped } = await import("../lib/starterDeck");
        ensureStarterDeckEquipped();
        navigate(entryRoute(), { replace: true });
      })();
    }
  }, [navigate, session]);

  const onGuest = async () => {
    setGuestSessionStub();
    const { ensureStarterDeckEquipped } = await import("../lib/starterDeck");
    ensureStarterDeckEquipped();
    navigate(entryRoute(), { replace: true });
  };

  return (
    <div className="crypt-splash">
      <div className="crypt-splash-backdrop" aria-hidden />
      {/* Title ambient loop (Grok img2vid 2026-06-11, animated FROM the
          gold-sovereignty key art — replaces the cut asset-review loop).
          Muted attr set for real (React omits it → autoplay blocked); the
          static backdrop stays as the reduced-motion / refused-play fallback. */}
      <video
        className="crypt-splash-video"
        src="/crypt-assets/title-hero-loop.mp4"
        poster="/crypt-assets/gold-sovereignty-district.jpg"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        ref={(el) => {
          if (el && !el.hasAttribute("muted")) {
            el.setAttribute("muted", "");
            el.muted = true;
            el.play().catch(() => {/* poster/backdrop remain */});
          }
        }}
      />
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
            <h1 className="crypt-splash-hook">Command the dead. Duel for the Nexus.</h1>
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
            <button type="button" className="crypt-splash-cta-secondary" onClick={connectWallet} disabled={walletState === "connecting"}>
              {walletState === "connecting" ? "Connecting…" : "Link wallet"}
            </button>
          </div>

          {soonKind === "account" && (
            <p className="crypt-splash-soon">
              Accounts aren't live yet — Play now runs the full duel on device; progress stays local until cloud saves ship.
            </p>
          )}
          {walletState === "connected" && (
            <p className="crypt-splash-soon">
              ✓ Wallet connected — hit <strong>Play now</strong> and your owned Crypt cards are fielded automatically.
            </p>
          )}
          {walletState === "no-wallet" && (
            <p className="crypt-splash-soon">
              No wallet in this browser — open the Crypt in your wallet app (or install one), then Link wallet to field your Crypt cards.
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
