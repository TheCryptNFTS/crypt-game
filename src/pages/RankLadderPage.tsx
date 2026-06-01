import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { loadProfile, deriveLevel, type PlayerProfile } from "../meta/progression";
import { rankFromMmr, type RankTierName } from "../meta/ladder";

/**
 * WS3 · LADDER UI — makes the (previously invisible) progression engine FELT.
 * Reads the device-local PlayerProfile (src/meta/progression.loadProfile) and
 * VISUALIZES it: rank tier badge, MMR + progress to the next tier, season banner
 * with stars, and the XP / level bar + win-loss record. Pure read of the meta
 * engine — no engine/reducer/meta logic is changed here.
 */

/** Ordered tier ladder (low -> high). Mirrors meta/ladder TIER_BANDS labels. */
const TIER_ORDER: RankTierName[] = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
];

/** The MMR floor each tier opens at — mirrors TIER_BANDS in meta/ladder.ts so we
 *  can draw a "progress to next tier" bar without importing private internals. */
const TIER_FLOORS: Record<RankTierName, number> = {
  Bronze: 0,
  Silver: 900,
  Gold: 1200,
  Platinum: 1500,
  Diamond: 1800,
  Master: 2200,
};

/** Tier accent color (purely cosmetic display). */
const TIER_COLOR: Record<RankTierName, string> = {
  Bronze: "#b07a4a",
  Silver: "#c8cdd6",
  Gold: "#e9c984",
  Platinum: "#7fe3d2",
  Diamond: "#7fb8ff",
  Master: "#c79bff",
};

/** Compute progress within the current tier toward the NEXT tier's floor. */
function tierProgress(mmr: number, tier: RankTierName): {
  pct: number;
  nextTier: RankTierName | null;
  toNext: number;
} {
  const idx = TIER_ORDER.indexOf(tier);
  const floor = TIER_FLOORS[tier];
  const nextTier = idx >= 0 && idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
  if (!nextTier) {
    // Master is open-ended: show a full bar, nothing above to climb to.
    return { pct: 100, nextTier: null, toNext: 0 };
  }
  const nextFloor = TIER_FLOORS[nextTier];
  const span = Math.max(1, nextFloor - floor);
  const into = Math.max(0, Math.min(span, mmr - floor));
  return {
    pct: Math.round((into / span) * 100),
    nextTier,
    toNext: Math.max(0, nextFloor - mmr),
  };
}

export default function RankLadderPage() {
  // The profile is device-local + synchronous; load on mount and refresh on
  // window focus so a match finished elsewhere shows up when the player returns.
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    const refresh = () => setProfile(loadProfile());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const view = useMemo(() => {
    if (!profile) return null;
    const rank = rankFromMmr(profile.rating);
    const lvl = deriveLevel(profile.xp);
    const prog = tierProgress(profile.rating, rank.tier);
    const games = profile.wins + profile.losses;
    const winRate = games > 0 ? Math.round((profile.wins / games) * 100) : null;
    const xpPct =
      lvl.nextLevelXp > 0
        ? Math.min(100, Math.round((lvl.currentLevelXp / lvl.nextLevelXp) * 100))
        : 0;
    return { rank, lvl, prog, games, winRate, xpPct };
  }, [profile]);

  const accent = view ? TIER_COLOR[view.rank.tier] : "#e9c984";

  return (
    <CryptPageFrame
      eyebrow="Tier 1 · Your ascent"
      title="Ranked ladder"
      lead={
        <>
          Your competitive standing on this device.{" "}
          <span className="text-[color:var(--color-crypt-muted)]">
            Climb the tiers, bank season stars, and level up.
          </span>
        </>
      }
    >
      {/* Season banner. */}
      <section className="crypt-rank-season" aria-label="Current season">
        <span className="crypt-rank-season-kicker">⬡ Season</span>
        <span className="crypt-rank-season-id">
          Season {profile?.season.seasonId ?? 1}
        </span>
        <span className="crypt-rank-season-stars" aria-label="Season stars">
          {profile && profile.seasonStars > 0
            ? `★ ${profile.seasonStars} star${profile.seasonStars === 1 ? "" : "s"}`
            : "No stars yet"}
        </span>
      </section>

      {/* Rank badge + progress to next tier. */}
      <section className="crypt-profile-section" aria-label="Rank tier">
        <div className="crypt-profile-section-label">Rank · this season</div>
        {view ? (
          <div className="crypt-rank-badge-row">
            <div
              className="crypt-rank-badge"
              style={{ borderColor: accent, color: accent }}
              aria-hidden
            >
              <span className="crypt-rank-badge-tier">{view.rank.tier}</span>
              <span className="crypt-rank-badge-div">{view.rank.label}</span>
            </div>
            <div className="crypt-rank-badge-meta">
              <p className="crypt-rank-badge-label">{view.rank.label}</p>
              <p className="crypt-rank-badge-mmr">{profile!.rating} MMR</p>
              <div
                className="crypt-rank-bar"
                role="progressbar"
                aria-valuenow={view.prog.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to next tier"
              >
                <span
                  className="crypt-rank-bar-fill"
                  style={{ width: `${view.prog.pct}%`, background: accent }}
                />
              </div>
              <p className="crypt-rank-bar-meta">
                {view.prog.nextTier
                  ? `${view.prog.toNext} MMR to ${view.prog.nextTier}`
                  : "Apex tier — Master"}
              </p>
            </div>
          </div>
        ) : (
          <div className="crypt-profile-placeholder">Reading your standing…</div>
        )}
      </section>

      {/* XP / level. */}
      <section className="crypt-profile-section" aria-label="Level and XP">
        <div className="crypt-profile-section-label">Level · experience</div>
        {view ? (
          <div className="crypt-rank-level">
            <div className="crypt-rank-level-head">
              <span className="crypt-rank-level-num">Level {view.lvl.level}</span>
              <span className="crypt-rank-level-xp">
                {view.lvl.currentLevelXp} / {view.lvl.nextLevelXp} XP
              </span>
            </div>
            <div
              className="crypt-rank-bar"
              role="progressbar"
              aria-valuenow={view.xpPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress to next level"
            >
              <span
                className="crypt-rank-bar-fill crypt-rank-bar-fill--xp"
                style={{ width: `${view.xpPct}%` }}
              />
            </div>
            <p className="crypt-rank-bar-meta">{view.lvl.totalXp} total XP earned</p>
          </div>
        ) : (
          <div className="crypt-profile-placeholder">Reading your XP…</div>
        )}
      </section>

      {/* Win / loss record. */}
      <section className="crypt-profile-section" aria-label="Record">
        <div className="crypt-profile-section-label">Record · ranked</div>
        {view ? (
          <div className="crypt-rank-record">
            <div className="crypt-rank-stat">
              <span className="crypt-rank-stat-val crypt-rank-stat-val--win">
                {profile!.wins}
              </span>
              <span className="crypt-rank-stat-label">Wins</span>
            </div>
            <div className="crypt-rank-stat">
              <span className="crypt-rank-stat-val crypt-rank-stat-val--loss">
                {profile!.losses}
              </span>
              <span className="crypt-rank-stat-label">Losses</span>
            </div>
            <div className="crypt-rank-stat">
              <span className="crypt-rank-stat-val">
                {view.winRate != null ? `${view.winRate}%` : "—"}
              </span>
              <span className="crypt-rank-stat-label">Win rate</span>
            </div>
          </div>
        ) : (
          <div className="crypt-profile-placeholder">No duels recorded yet.</div>
        )}
        {view && view.games === 0 ? (
          <p className="crypt-profile-secondary">
            Play a match to start your climb — every ranked duel moves your MMR.
          </p>
        ) : null}
      </section>

      <p className="crypt-profile-secondary">
        Jump in from the{" "}
        <Link
          to="/play"
          className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline"
        >
          Play hub
        </Link>
        , or see how you stack up on the{" "}
        <Link
          to="/leaderboard"
          className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline"
        >
          season ladder
        </Link>
        .
      </p>
    </CryptPageFrame>
  );
}
