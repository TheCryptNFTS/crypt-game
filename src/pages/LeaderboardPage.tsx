import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import {
  fetchCurrentSeason,
  fetchSeasonLeaderboard,
  fetchSeasonRewards,
  claimSeasonReward,
  fetchMyRanking,
  rankLabelForRating,
  type SeasonInfo,
  type SeasonLeaderEntry,
  type SeasonRewardTier,
  type MyRanking,
} from "../services/ladderApi";

/** Truncate a wallet address to `0x12…ab` form; passes through short/odd ids. */
function shortWallet(id: string): string {
  if (!id) return "—";
  if (id.startsWith("0x") && id.length >= 8) {
    return `${id.slice(0, 4)}…${id.slice(-2)}`;
  }
  if (id.length > 10) return `${id.slice(0, 5)}…${id.slice(-2)}`;
  return id;
}

/** Days left until season end, floored at 0. */
function daysUntil(endsAt: number, now: number): number {
  const ms = endsAt - now;
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

function rankClass(position: number): string {
  return position <= 3 ? "crypt-ladder-pos crypt-ladder-pos--gold" : "crypt-ladder-pos";
}

/**
 * Tier 2 · The Season — public ladder. Season banner + ranked list (own row
 * pinned) + a compact reward track. Every fetch returns null when offline/guest;
 * each surface degrades to a clean "join the season" empty state, never an error.
 */
export default function LeaderboardPage() {
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [board, setBoard] = useState<SeasonLeaderEntry[] | null>(null);
  const [rewards, setRewards] = useState<SeasonRewardTier[] | null>(null);
  const [mine, setMine] = useState<MyRanking | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetchCurrentSeason(),
      fetchSeasonLeaderboard(25),
      fetchSeasonRewards(),
      fetchMyRanking(),
    ]).then(([s, b, r, m]) => {
      if (!live) return;
      setSeason(s);
      setBoard(b);
      setRewards(r);
      setMine(m);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const reloadRewards = async () => {
    const r = await fetchSeasonRewards();
    setRewards(r);
  };

  const onClaim = async (tier: string) => {
    setClaiming(tier);
    try {
      const res = await claimSeasonReward(tier);
      if (res?.claimed) await reloadRewards();
    } finally {
      setClaiming(null);
    }
  };

  const daysLeft = season ? daysUntil(season.endsAt, Date.now()) : null;
  const hasBoard = !!board && board.length > 0;
  const myId = mine?.accountId;

  return (
    <CryptPageFrame
      eyebrow="Tier 2 · The Season"
      title="Season ladder"
      lead={
        season ? (
          <>
            <strong>{season.label}</strong>
            {daysLeft !== null ? (
              <span className="text-[color:var(--color-crypt-muted)]">
                {" "}
                · {daysLeft === 0 ? "ends today" : `ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-[color:var(--color-crypt-muted)]">
            Climb the ranked ladder and earn the season's rewards.
          </span>
        )
      }
    >
      {/* Your standing — pinned summary when ranked. */}
      {mine ? (
        <section className="crypt-profile-section" aria-label="Your season standing">
          <div className="crypt-profile-section-label">You · this season</div>
          <div className="crypt-ladder-you">
            <span className="crypt-ladder-you-pos">You: #{mine.position}</span>
            <span className="crypt-ladder-you-tier">{rankLabelForRating(mine.rating)}</span>
            <span className="crypt-ladder-you-meta">
              {mine.rating} MMR · {mine.wins}W–{mine.losses}L
              {mine.bestStreak > 1 ? ` · ⬡ STREAK ${mine.bestStreak}` : ""}
            </span>
          </div>
        </section>
      ) : null}

      {/* The ranked list. */}
      <section className="crypt-profile-section" aria-label="Season leaderboard">
        <div className="crypt-profile-section-label">Standings · top 25</div>
        {hasBoard ? (
          <ol className="crypt-ladder-list">
            {board!.map((e) => {
              const isMe = !!myId && e.accountId === myId;
              return (
                <li
                  key={e.accountId}
                  className={["crypt-ladder-row", isMe ? "crypt-ladder-row--me" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className={rankClass(e.position)}>#{e.position}</span>
                  <span className="crypt-ladder-name">
                    {shortWallet(e.accountId)}
                    {isMe ? <span className="crypt-ladder-you-tag"> · you</span> : null}
                  </span>
                  <span className="crypt-ladder-rating">{e.rating}</span>
                  <span className="crypt-ladder-wl">
                    {e.wins}W–{e.losses}L
                  </span>
                  <span className="crypt-ladder-streak">
                    {e.bestStreak > 1 ? `⬡ ${e.bestStreak}` : "—"}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="crypt-profile-placeholder">
            {loaded
              ? "Sign in and play ranked to join the season ladder"
              : "Reading the ladder…"}
          </div>
        )}
      </section>

      {/* Reward track — compact row per tier. */}
      <section className="crypt-profile-section" aria-label="Season reward track">
        <div className="crypt-profile-section-label">Reward track</div>
        {rewards && rewards.length > 0 ? (
          <ul className="crypt-ladder-rewards">
            {rewards.map((t) => {
              const claimable = t.reached && !t.claimed;
              return (
                <li key={t.tier} className="crypt-ladder-reward-row">
                  <span className="crypt-ladder-reward-tier">{t.tier}</span>
                  <span className="crypt-ladder-reward-req">{t.minRating}+ MMR</span>
                  <span className="crypt-ladder-reward-prize">
                    +{t.rewardCrypt} $CRYPT
                    {t.cosmeticId ? <span className="crypt-ladder-reward-cos"> · ⬡ frame</span> : null}
                  </span>
                  {t.claimed ? (
                    <span className="crypt-ladder-reward-state crypt-ladder-reward-state--done">Claimed</span>
                  ) : claimable ? (
                    <button
                      type="button"
                      className="crypt-ladder-reward-claim"
                      disabled={claiming === t.tier}
                      onClick={() => onClaim(t.tier)}
                    >
                      {claiming === t.tier ? "Claiming…" : "Claim"}
                    </button>
                  ) : (
                    <span className="crypt-ladder-reward-state">Locked</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="crypt-profile-placeholder">
            {loaded ? "Rewards unlock once the season ladder opens" : "Reading rewards…"}
          </div>
        )}
      </section>

      <p className="crypt-profile-secondary">
        Climb from the{" "}
        <Link to="/play" className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline">
          Play hub
        </Link>
        —ranked duels move your season rating.
      </p>
    </CryptPageFrame>
  );
}
