import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { getProgressSnapshot } from "../lib/localProgress";

type PackLocationState = {
  cryptDelta: number;
  passXpDelta: number;
};

/**
 * Daily pack “opening” beat after claim — local stub, no real cards yet.
 * TODO: manifest pulls, rarity reveal, share image.
 */
export default function DailyPackPage() {
  const location = useLocation();
  const state = location.state as PackLocationState | null;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (state == null) return;
    const t = window.setTimeout(() => setRevealed(true), 400);
    return () => window.clearTimeout(t);
  }, [state]);

  const snap = getProgressSnapshot(Date.now());

  if (state == null || typeof state.cryptDelta !== "number") {
    return <Navigate to="/home" replace />;
  }

  const onSharePull = async () => {
    const text = `CRYPT · Crypt Legends · daily vault · +${state.cryptDelta} $CRYPT · +${state.passXpDelta} pass XP (device)`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="crypt-page crypt-pack">
      <header className="crypt-page-header">
        <h1 className="crypt-page-title">Daily vault</h1>
        <p className="crypt-page-subtitle">
          Ritual is local-only—no relic mints yet. You still claimed device ledger currency on the last step.
        </p>
      </header>

      <div className="crypt-pack-stage">
        <div className={`crypt-pack-orb ${revealed ? "crypt-pack-orb--open" : ""}`} aria-hidden />
        <div className="crypt-pack-cards">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={["crypt-pack-slot", revealed ? "crypt-pack-slot--reveal" : ""].filter(Boolean).join(" ")}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <span className="crypt-pack-slot-back" aria-hidden />
              <div className="crypt-pack-slot-front">
                <span className="crypt-pack-slot-label">Sealed pull</span>
                <span className="crypt-pack-slot-rarity">Alpha</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="crypt-pack-summary" aria-label="Rewards">
        <p className="crypt-pack-summary-title">This claim</p>
        <ul className="crypt-pack-summary-list">
          <li>+{state.cryptDelta} $CRYPT (device)</li>
          <li>+{state.passXpDelta} pass XP (device)</li>
        </ul>
        <p className="crypt-pack-summary-balance">
          Balance now: <strong>{snap.cryptBalance}</strong> $CRYPT · pass <strong>{snap.passXp}</strong> XP
        </p>
      </section>

      <div className="crypt-pack-actions">
        <Link to="/home" className="crypt-result-cta-primary">
          Command hub
        </Link>
        <button type="button" className="crypt-result-cta-tertiary" onClick={onSharePull}>
          Copy pull summary
        </button>
        <p className="crypt-pack-share-note">
          Branded vault-pull shares ship with the live archive—closed alpha is copy-only for now.
        </p>
      </div>
    </div>
  );
}
