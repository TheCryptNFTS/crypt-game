import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { loadProfile, deriveLevel, type PlayerProfile } from "../meta/progression";
import { rankFromMmr, type RankTierName } from "../meta/ladder";
import { absoluteUrl, openTweet, shareOrCopy } from "../lib/share";
import { t } from "../i18n";

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

  // "Share rank" → a brand line drawn from the live profile + the play URL.
  const [shareNote, setShareNote] = useState<string>("");

  const shareText = useMemo(() => {
    if (!profile || !view) return "";
    const season = profile.season.seasonId ?? 1;
    return `⬡ ${view.rank.tier} · ${profile.rating} MMR · Season ${season} — climbing the CRYPT ladder.`;
  }, [profile, view]);

  const shareUrl = absoluteUrl("/play");

  const onShareRank = useCallback(async () => {
    if (!shareText) return;
    const result = await shareOrCopy({
      title: t("ladder.share.title"),
      text: shareText,
      url: shareUrl,
    });
    setShareNote(
      result === "shared"
        ? t("ladder.share.shared")
        : result === "copied"
          ? t("ladder.share.copied")
          : t("ladder.share.failed")
    );
  }, [shareText, shareUrl]);

  const onTweetRank = useCallback(() => {
    if (!shareText) return;
    openTweet(shareText, shareUrl);
    setShareNote(t("ladder.share.openingX"));
  }, [shareText, shareUrl]);

  return (
    <CryptPageFrame
      eyebrow={t("ladder.eyebrow")}
      title={t("ladder.title")}
      lead={
        <>
          {t("ladder.lead.intro")}{" "}
          <span className="text-[color:var(--color-crypt-muted)]">
            {t("ladder.lead.sub")}
          </span>
        </>
      }
    >
      {/* Season banner. */}
      <section className="crypt-rank-season" aria-label={t("ladder.season.aria")}>
        <span className="crypt-rank-season-kicker">{t("ladder.season.kicker")}</span>
        <span className="crypt-rank-season-id">
          Season {profile?.season.seasonId ?? 1}
        </span>
        <span className="crypt-rank-season-stars" aria-label={t("ladder.season.starsAria")}>
          {profile && profile.seasonStars > 0
            ? `★ ${profile.seasonStars} star${profile.seasonStars === 1 ? "" : "s"}`
            : t("ladder.season.noStars")}
        </span>
      </section>

      {/* Rank badge + progress to next tier. */}
      <section className="crypt-profile-section" aria-label={t("ladder.rank.aria")}>
        <div className="crypt-profile-section-label">{t("ladder.rank.label")}</div>
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
                aria-label={t("ladder.rank.progressAria")}
              >
                <span
                  className="crypt-rank-bar-fill"
                  style={{ width: `${view.prog.pct}%`, background: accent }}
                />
              </div>
              <p className="crypt-rank-bar-meta">
                {view.prog.nextTier
                  ? `${view.prog.toNext} MMR to ${view.prog.nextTier}`
                  : t("ladder.rank.apex")}
              </p>
              <div
                className="crypt-rank-share"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginTop: "0.85rem",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="crypt-challenge__cta"
                  onClick={() => void onShareRank()}
                  style={{
                    borderColor: accent,
                    color: accent,
                    fontFamily: '"Clash Display", system-ui, sans-serif',
                    letterSpacing: "0.02em",
                  }}
                >
                  {t("ladder.rank.share")}
                </button>
                <button
                  type="button"
                  className="crypt-challenge__cancel"
                  onClick={onTweetRank}
                  style={{
                    fontFamily: '"Clash Display", system-ui, sans-serif',
                  }}
                >
                  {t("ladder.rank.postX")}
                </button>
                {shareNote ? (
                  <span
                    className="crypt-rank-bar-meta"
                    aria-live="polite"
                    style={{ color: accent }}
                  >
                    {shareNote}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="crypt-profile-placeholder">{t("ladder.rank.reading")}</div>
        )}
      </section>

      {/* XP / level. */}
      <section className="crypt-profile-section" aria-label={t("ladder.level.aria")}>
        <div className="crypt-profile-section-label">{t("ladder.level.label")}</div>
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
              aria-label={t("ladder.level.progressAria")}
            >
              <span
                className="crypt-rank-bar-fill crypt-rank-bar-fill--xp"
                style={{ width: `${view.xpPct}%` }}
              />
            </div>
            <p className="crypt-rank-bar-meta">{view.lvl.totalXp} total XP earned</p>
          </div>
        ) : (
          <div className="crypt-profile-placeholder">{t("ladder.level.reading")}</div>
        )}
      </section>

      {/* Win / loss record. */}
      <section className="crypt-profile-section" aria-label={t("ladder.record.aria")}>
        <div className="crypt-profile-section-label">{t("ladder.record.label")}</div>
        {view ? (
          <div className="crypt-rank-record">
            <div className="crypt-rank-stat">
              <span className="crypt-rank-stat-val crypt-rank-stat-val--win">
                {profile!.wins}
              </span>
              <span className="crypt-rank-stat-label">{t("ladder.record.wins")}</span>
            </div>
            <div className="crypt-rank-stat">
              <span className="crypt-rank-stat-val crypt-rank-stat-val--loss">
                {profile!.losses}
              </span>
              <span className="crypt-rank-stat-label">{t("ladder.record.losses")}</span>
            </div>
            <div className="crypt-rank-stat">
              <span className="crypt-rank-stat-val">
                {view.winRate != null ? `${view.winRate}%` : "—"}
              </span>
              <span className="crypt-rank-stat-label">{t("ladder.record.winRate")}</span>
            </div>
          </div>
        ) : (
          <div className="crypt-profile-placeholder">{t("ladder.record.empty")}</div>
        )}
        {view && view.games === 0 ? (
          <p className="crypt-profile-secondary">
            {t("ladder.record.climb")}
          </p>
        ) : null}
      </section>

      <p className="crypt-profile-secondary">
        {t("ladder.foot.jumpIn")}
        <Link
          to="/play"
          className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline"
        >
          {t("ladder.foot.playHub")}
        </Link>
        {t("ladder.foot.stack")}
        <Link
          to="/leaderboard"
          className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline"
        >
          {t("ladder.foot.seasonLadder")}
        </Link>
        .
      </p>
    </CryptPageFrame>
  );
}
