import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { t as tr } from "../i18n";
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
    const text = `CRYPT · Crypt Legends · daily vault · +${state.cryptDelta} ⬡ HEX · +${state.passXpDelta} pass XP (device)`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="crypt-page crypt-pack">
      <header className="crypt-page-header">
        <h1 className="crypt-page-title">{tr("dailypack.title")}</h1>
        <p className="crypt-page-subtitle">
          {tr("dailypack.subtitle")}
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
                <span className="crypt-pack-slot-label">{tr("dailypack.slot.label")}</span>
                <span className="crypt-pack-slot-rarity">{tr("dailypack.slot.rarity")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="crypt-pack-summary" aria-label={tr("dailypack.summary.aria")}>
        <p className="crypt-pack-summary-title">{tr("dailypack.summary.title")}</p>
        <ul className="crypt-pack-summary-list">
          <li>+{state.cryptDelta} ⬡ HEX (device)</li>
          <li>+{state.passXpDelta} pass XP (device)</li>
        </ul>
        <p className="crypt-pack-summary-balance">
          Balance now: <strong>{snap.cryptBalance}</strong> ⬡ HEX (device) · pass <strong>{snap.passXp}</strong> XP
        </p>
      </section>

      <div className="crypt-pack-actions">
        <Link to="/home" className="crypt-result-cta-primary">
          {tr("dailypack.actions.hub")}
        </Link>
        <button type="button" className="crypt-result-cta-tertiary" onClick={onSharePull}>
          {tr("dailypack.actions.copy")}
        </button>
        <p className="crypt-pack-share-note">
          {tr("dailypack.share.note")}
        </p>
      </div>
    </div>
  );
}
