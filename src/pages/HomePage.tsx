import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import CommanderCard from "../components/cards/CommanderCard";
import PlayableCard from "../components/cards/PlayableCard";
import {
  claimDailyPack,
  formatDurationMs,
  getProgressSnapshot,
  hasClaimedDailyPackToday,
  hasCompletedAnyMatch,
} from "../lib/localProgress";
import { loadStoredCommanderId, loadStoredMainDeckCardIds } from "../lib/deckBuilderStorage";
import { useRenderManifest } from "../hooks/useRenderManifest";

const PASS_TIER_XP = 800;

/**
 * Mobile-first home — premium TCG field hub (not dashboard tiles).
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { commanders, playable, entryById, loading, error, ready } = useRenderManifest();
  const [tick, setTick] = useState(0);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const snap = useMemo(() => getProgressSnapshot(Date.now()), [tick]);

  const onClaimDaily = useCallback(() => {
    setClaimMsg(null);
    const r = claimDailyPack(Date.now());
    if (r.ok) {
      setTick((t) => t + 1);
      navigate("/daily-pack", {
        replace: false,
        state: { cryptDelta: r.cryptDelta, passXpDelta: r.passXpDelta },
      });
      return;
    }
    setClaimMsg(`Next pack in ${formatDurationMs(r.nextClaimAt - Date.now())}`);
    setTick((t) => t + 1);
  }, [navigate]);

  const matchQuestDone = hasCompletedAnyMatch();
  const dailyQuestDone = hasClaimedDailyPackToday(Date.now());

  const commanderId = loadStoredCommanderId();
  const featuredCommander = entryById.get(commanderId) ?? commanders[0];
  const deckIds = loadStoredMainDeckCardIds();
  const featuredCardEntry =
    (deckIds[0] ? entryById.get(deckIds[0]) : null) ??
    playable[0] ??
    null;

  const seasonTier = Math.floor(snap.passXp / PASS_TIER_XP) + 1;
  const seasonIntoTier = snap.passXp % PASS_TIER_XP;
  const seasonPct = Math.min(100, Math.round((seasonIntoTier / PASS_TIER_XP) * 100));

  const packCountdown =
    snap.nextClaimAt != null ? formatDurationMs(snap.nextClaimAt - Date.now()) : "—";

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <div className="crypt-home-m">
        <section className="crypt-home-m-hero" aria-label="Home">
          <div className="crypt-home-m-hero-accent" aria-hidden />
          <div className="crypt-home-m-hero-inner">
            <p className="crypt-home-m-kicker">CRYPT · Crypt Legends · closed alpha</p>
            <h1 className="crypt-home-m-headline">
              Command
              <span className="crypt-home-m-headline-sub"> the archive</span>
            </h1>
            <p className="crypt-home-m-deck">
              Legends do not stay buried. Sacred commanders and Crypt Digital Trading Cards clash in Cryptopia on one
              tactical field—gods, monsters, and heroes in play—while duels run on device; ranked seasons and five-faction
              territory ship with the live vault.
            </p>

            <div className="crypt-home-m-ledger" role="group" aria-label="Field ledger">
              <div className="crypt-home-m-ledger-row">
                <span className="crypt-home-m-ledger-label">$CRYPT</span>
                <span className="crypt-home-m-ledger-value crypt-home-m-ledger-value--gold">
                  {snap.cryptBalance.toLocaleString()}
                </span>
              </div>
              <div className="crypt-home-m-ledger-divider" aria-hidden />
              <div className="crypt-home-m-ledger-row">
                <span className="crypt-home-m-ledger-label">Pass XP</span>
                <span className="crypt-home-m-ledger-value">{snap.passXp.toLocaleString()}</span>
              </div>
            </div>

            {snap.lastMatchSummary && (
              <p className="crypt-home-m-echo" role="status">
                {snap.lastMatchSummary}
              </p>
            )}

            <Link to="/play" className="crypt-home-m-play">
              <span className="crypt-home-m-play-label">Play</span>
              <span className="crypt-home-m-play-meta">Build your legend · quick duel</span>
            </Link>

            <p className="crypt-home-m-more-nav">
              <Link to="/shop" className="crypt-home-m-more-link">
                Reliquary
              </Link>
              <span> — preview only. No cart, no mint claims.</span>
            </p>
          </div>
        </section>

        <section className="crypt-home-m-fw" aria-labelledby="crypt-fw-title">
          <div className="crypt-home-m-fw-inner">
            <div className="crypt-home-m-fw-copy">
              <p className="crypt-home-m-fw-kicker">Five factions · reserved</p>
              <h2 id="crypt-fw-title" className="crypt-home-m-fw-title">
                Faction conflict
              </h2>
              <p className="crypt-home-m-fw-lead">
                From Mid World dust to Aqualon's deep—the five factions wait on real territory rules. Not a queue yet;
                this banner seals until live seasons ship.
              </p>
            </div>
            <button type="button" className="crypt-home-m-fw-cta" disabled>
              War table sealed
            </button>
          </div>
        </section>

        <section className="crypt-home-m-rhythm" aria-label="Today in the Crypt">
          <h2 className="crypt-home-m-section-title">Today in the Crypt</h2>

          <div className="crypt-home-m-rhythm-stack">
            <div className="crypt-home-m-panel crypt-home-m-panel--pack">
              <div className="crypt-home-m-panel-top">
                <span className="crypt-home-m-panel-kicker">Daily vault</span>
                {snap.dailyReady ? (
                  <span className="crypt-home-m-badge crypt-home-m-badge--ready">Ready</span>
                ) : (
                  <span className="crypt-home-m-badge">Cooldown</span>
                )}
              </div>
              <p className="crypt-home-m-timer" aria-live="polite">
                {snap.dailyReady ? "Claim available" : packCountdown}
              </p>
              {snap.dailyReady ? (
                <button type="button" className="crypt-home-m-panel-cta" onClick={onClaimDaily}>
                  Claim the relic
                </button>
              ) : (
                <p className="crypt-home-m-panel-hint">Reopens when the timer ends.</p>
              )}
              {claimMsg && <p className="crypt-home-m-panel-flash">{claimMsg}</p>}
            </div>

            <div className="crypt-home-m-panel crypt-home-m-panel--quests">
              <span className="crypt-home-m-panel-kicker">Daily rites</span>
              <ul className="crypt-home-m-questlist">
                <li className={matchQuestDone ? "is-done" : ""}>
                  <span className="crypt-home-m-quest-mark" aria-hidden />
                  Close a duel
                </li>
                <li className={dailyQuestDone ? "is-done" : ""}>
                  <span className="crypt-home-m-quest-mark" aria-hidden />
                  Open the daily vault
                </li>
                <li className="crypt-home-m-questlist-locked">
                  <span className="crypt-home-m-quest-mark" aria-hidden />
                  Faction sorties
                </li>
              </ul>
            </div>

            <div className="crypt-home-m-panel crypt-home-m-panel--season">
              <div className="crypt-home-m-season-head">
                <span className="crypt-home-m-panel-kicker">Season archive</span>
                <span className="crypt-home-m-season-tier">Tier {seasonTier}</span>
              </div>
              <div
                className="crypt-home-m-season-bar"
                role="progressbar"
                aria-valuenow={seasonIntoTier}
                aria-valuemin={0}
                aria-valuemax={PASS_TIER_XP}
                aria-label="Progress to next tier"
              >
                <span className="crypt-home-m-season-fill" style={{ width: `${seasonPct}%` }} />
              </div>
              <p className="crypt-home-m-season-meta">
                {seasonIntoTier.toLocaleString()} / {PASS_TIER_XP.toLocaleString()} XP · device-only until seasons ship
              </p>
            </div>
          </div>
        </section>

        <section className="crypt-home-m-spotlight" aria-labelledby="crypt-spot-title">
          <div className="crypt-home-m-spotlight-head">
            <h2 id="crypt-spot-title" className="crypt-home-m-section-title crypt-home-m-section-title--inline">
              Your legend
            </h2>
            <p className="crypt-home-m-spotlight-sub">
              Your commander leads. A signature card follows.
            </p>
            <p className="crypt-home-m-spotlight-support">Shape both in your loadout.</p>
          </div>

          <div className="crypt-home-m-spotlight-stage">
            <div className="crypt-home-m-commander-wrap">
              {featuredCommander ? (
                <div className="crypt-home-m-commander-halo">
                  <CommanderCard entry={featuredCommander} scale="dominant" variant="catalog" />
                </div>
              ) : (
                <div className="crypt-home-m-fallback" aria-hidden>
                  Commander
                </div>
              )}
              {featuredCommander && (
                <p className="crypt-home-m-commander-name">{featuredCommander.name}</p>
              )}
            </div>

            <div className="crypt-home-m-card-wrap">
              <span className="crypt-home-m-card-kicker">Signature</span>
              {featuredCardEntry ? (
                <div className="crypt-home-m-card-slot">
                  <PlayableCard entry={featuredCardEntry} mode="collection" />
                </div>
              ) : (
                <div className="crypt-home-m-fallback crypt-home-m-fallback--card" aria-hidden>
                  Card
                </div>
              )}
              <Link to="/deck" className="crypt-home-m-spotlight-link">
                Forge loadout →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </CatalogLoader>
  );
}
