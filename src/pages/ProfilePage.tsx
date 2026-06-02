import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "../i18n";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import CommanderCard from "../components/cards/CommanderCard";
import { useRenderManifest } from "../hooks/useRenderManifest";
import { clearSessionStub, getSessionStub } from "../lib/appSession";
import { loadStoredCommanderId } from "../lib/deckBuilderStorage";
import { getProgressSnapshot } from "../lib/localProgress";
import {
  fetchCosmetics,
  fetchMatchHistory,
  fetchMyRanking,
  rankLabelForRating,
  type CosmeticUnlock,
  type MatchHistoryEntry,
  type MyRanking,
} from "../services/ladderApi";

/** Presentation labels for the known tier-frame cosmetic ids. */
const COSMETIC_LABELS: Record<string, string> = {
  frame_awakened: "Awakened frame",
  frame_ascendant: "Ascendant frame",
  frame_mythic: "Mythic frame",
  frame_sovereign: "Sovereign frame",
};

function cosmeticLabel(id: string): string {
  return COSMETIC_LABELS[id] ?? id.replace(/^frame_/, "").replace(/_/g, " ");
}

/** Compact relative time like "just now" / "2h ago" / "3d ago". */
function relativeTime(then: number, now: number): string {
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * Pilot dossier — closed alpha: identity, local ledger; no wallet verification in this build.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { entryById, loading, error, ready } = useRenderManifest();
  const commanderId = loadStoredCommanderId();
  const commanderEntry = entryById.get(commanderId);
  const session = getSessionStub();
  const [tick, setTick] = useState(0);
  const [ranking, setRanking] = useState<MyRanking | null>(null);
  const [cosmetics, setCosmetics] = useState<CosmeticUnlock[] | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[] | null>(null);

  useEffect(() => {
    let live = true;
    fetchMyRanking().then((r) => {
      if (live) setRanking(r);
    });
    fetchCosmetics().then((c) => {
      if (live) setCosmetics(c);
    });
    fetchMatchHistory(10).then((h) => {
      if (live) setHistory(h);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 4000);
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const snap = useMemo(() => getProgressSnapshot(Date.now()), [tick]);
  const level = Math.floor(snap.passXp / 100) + 1;

  const onSignOut = () => {
    clearSessionStub();
    navigate("/", { replace: true });
  };

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <CryptPageFrame
        eyebrow={t("profile.eyebrow")}
        title={session === "guest" ? t("profile.title.guest") : t("profile.title.default")}
        lead={
          <>
            {t("profile.lead.rankPrefix")}
            <strong>{level}</strong>
            {t("profile.lead.rankSuffix")}
            <span className="text-[color:var(--color-crypt-muted)]">{t("profile.lead.sealed")}</span>
          </>
        }
      >
        <div className="crypt-profile-after-head mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--color-crypt-border)] pb-6">
          <div className="crypt-profile-hero-badge-slot" aria-label={t("profile.status.aria")}>
            <span className="crypt-profile-badge crypt-profile-badge--guest">{t("profile.badge.guest")}</span>
            <p className="crypt-profile-badge-note">
              {t("profile.badge.note")}
            </p>
          </div>
        </div>

        <p className="crypt-lore-whisper">
          {t("profile.whisper")}
        </p>

        <section className="crypt-profile-section" aria-label={t("profile.recentDuels.aria")}>
          <div className="crypt-profile-section-label">{t("profile.recentDuels.label")}</div>
          {history && history.length > 0 ? (
            <ul className="crypt-duel-list">
              {history.map((h) => {
                const win = h.result.toLowerCase() === "win";
                const up = h.ratingDelta >= 0;
                return (
                  <li key={h.matchId} className="crypt-duel-row">
                    <span
                      className={["crypt-duel-result", win ? "crypt-duel-result--win" : "crypt-duel-result--loss"]
                        .join(" ")}
                    >
                      {win ? t("profile.recentDuels.win") : t("profile.recentDuels.loss")}
                    </span>
                    <span
                      className={["crypt-duel-delta", up ? "crypt-duel-delta--up" : "crypt-duel-delta--down"]
                        .join(" ")}
                    >
                      {up ? "+" : "−"}
                      {Math.abs(h.ratingDelta)}
                    </span>
                    <span className="crypt-duel-time">{relativeTime(h.createdAt, Date.now())}</span>
                  </li>
                );
              })}
            </ul>
          ) : snap.lastMatchSummary ? (
            <p className="crypt-profile-recent-match">{snap.lastMatchSummary}</p>
          ) : (
            <p className="crypt-profile-secondary">{t("profile.recentDuels.empty")}</p>
          )}
          <p className="crypt-profile-secondary">
            {t("profile.ledger.prefix")}{snap.cryptBalance}{t("profile.ledger.mid")}{snap.passXp}
            {t("profile.ledger.suffix")}
          </p>
        </section>

        <section className="crypt-profile-section" aria-label={t("profile.commander.aria")}>
          <div className="crypt-profile-section-label">{t("profile.commander.label")}</div>
          <div className="crypt-profile-commander-row">
            {commanderEntry ? (
              <div className="flex justify-center sm:justify-start">
                <CommanderCard entry={commanderEntry} scale="table" />
              </div>
            ) : (
              <div className="crypt-profile-placeholder">{t("profile.commander.loading")}</div>
            )}
            <div>
              <p className="mt-0 text-sm font-medium text-[color:var(--color-crypt-text)]">
                {commanderEntry?.name ?? commanderId}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-crypt-muted)]">
                {t("profile.commander.mirroredFrom")}
                <Link to="/deck" className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline">
                  {t("profile.commander.forge")}
                </Link>
                {t("profile.commander.mirroredSuffix")}
              </p>
            </div>
          </div>
        </section>

        <section className="crypt-profile-section" aria-label={t("profile.cosmeticsRoadmap.aria")}>
          <div className="crypt-profile-section-label">{t("profile.cosmeticsRoadmap.label")}</div>
          <p className="crypt-profile-secondary">
            {t("profile.cosmeticsRoadmap.copyPrefix")}
            <span className="whitespace-nowrap">{t("profile.cosmeticsRoadmap.policyFile")}</span>
            {t("profile.cosmeticsRoadmap.copySuffix")}
          </p>
          <div className="crypt-holder-prestige-preview">
            {commanderEntry ? (
              <CommanderCard entry={commanderEntry} scale="table" variant="catalog" />
            ) : (
              <div className="crypt-profile-placeholder" style={{ minHeight: 120 }}>
                {t("profile.cosmeticsRoadmap.art")}
              </div>
            )}
            <span className="crypt-holder-prestige-label">{t("profile.cosmeticsRoadmap.conceptLabel")}</span>
          </div>
        </section>

        <section className="crypt-profile-section" aria-label={t("profile.vault.aria")}>
          <div className="crypt-profile-section-label">{t("profile.vault.label")}</div>
          <div className="crypt-profile-locked-row">
            <div className="crypt-profile-locked-copy">
              <p className="crypt-profile-locked-title">{t("profile.vault.title")}</p>
              <p className="crypt-profile-secondary">
                {t("profile.vault.copy")}
              </p>
            </div>
            <button type="button" className="crypt-profile-wallet-placeholder" disabled>
              {t("profile.vault.unavailable")}
            </button>
          </div>
        </section>

        <section className="crypt-profile-section" aria-label={t("profile.rank.aria")}>
          <div className="crypt-profile-section-label">{t("profile.rank.label")}</div>
          {ranking ? (
            <div className="crypt-profile-rank-row">
              <div className="crypt-profile-rank-main">
                <span className="crypt-profile-rank-tier">{rankLabelForRating(ranking.rating)}</span>
                <span className="crypt-profile-rank-rating">{ranking.rating}{t("profile.rank.mmrSuffix")}</span>
              </div>
              <p className="crypt-profile-secondary">
                #{ranking.position} on the ladder · {ranking.wins}W–{ranking.losses}L
                {ranking.currentStreak > 1 ? ` · ⬡ STREAK ${ranking.currentStreak}` : ""}
              </p>
            </div>
          ) : (
            <div className="crypt-profile-placeholder">
              {t("profile.rank.empty")}
            </div>
          )}
          <p className="crypt-profile-secondary">
            <Link
              to="/ladder"
              className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline"
            >
              {t("profile.rank.viewLadder")}
            </Link>
            {"  ·  "}
            <Link
              to="/leaderboard"
              className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline"
            >
              {t("profile.rank.seasonStandings")}
            </Link>
          </p>
        </section>

        <section className="crypt-profile-section" aria-label={t("profile.cosmetics.aria")}>
          <div className="crypt-profile-section-label">{t("profile.cosmetics.label")}</div>
          {cosmetics && cosmetics.length > 0 ? (
            <div className="crypt-profile-cosmetic-strip">
              {cosmetics.map((c) => (
                <span key={c.cosmeticId} className="crypt-profile-cosmetic-chip">
                  ⬡ {cosmeticLabel(c.cosmeticId)}
                </span>
              ))}
            </div>
          ) : (
            <div className="crypt-profile-placeholder">{t("profile.cosmetics.empty")}</div>
          )}
        </section>

        <div className="crypt-profile-signout">
          <button type="button" className="crypt-profile-signout-btn" onClick={onSignOut}>
            {t("profile.signout.btn")}
          </button>
          <p className="mt-3 text-xs text-[color:var(--color-crypt-muted)]">
            {t("profile.signout.note")}
          </p>
        </div>
      </CryptPageFrame>
    </CatalogLoader>
  );
}
