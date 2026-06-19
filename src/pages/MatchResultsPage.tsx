import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import CommanderCard from "../components/cards/CommanderCard";
import type { MatchRewardBreakdown } from "../lib/localProgress";
import { applyMatchRewards } from "../lib/localProgress";
import { lorePresenceForManifestEntry } from "../content/cryptMediumCodex";
import { useRenderManifest } from "../hooks/useRenderManifest";

export type MatchResultLocationState = {
  nonce: string;
  winner: string;
  turn: number;
  p1CommanderId?: string;
  p2CommanderId?: string;
};

function cacheKey(nonce: string) {
  return `crypt.resultApplied.${nonce}`;
}

/** Stores the full router state so a refresh (which wipes location.state) can rehydrate the screen. */
const LAST_RESULT_KEY = "crypt.lastResultState";

function readLastResultState(): MatchResultLocationState | null {
  try {
    const raw = sessionStorage.getItem(LAST_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MatchResultLocationState;
    if (!parsed || typeof parsed.nonce !== "string" || !parsed.nonce) return null;
    if (parsed.winner == null || parsed.turn == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function momentLine(data: MatchRewardBreakdown): string {
  const n = data.turn;
  const tw = n === 1 ? "turn" : "turns";
  if (data.draw) {
    return `Two legends held the line—${n} ${tw}. The vault remembers.`;
  }
  if (data.won) {
    return `Commander and Crypt Digital Trading Cards held—${n} ${tw} toward the next relic in your legend.`;
  }
  return `Forgotten powers rise again—${n} ${tw} in the Crypt. Reforge and return.`;
}

/**
 * Post-battle payoff — emotional closure, stub rewards, clear exit paths. No new APIs.
 */
export default function MatchResultsPage() {
  const location = useLocation();
  const navState = location.state as MatchResultLocationState | null;
  // On a hard refresh router state is gone. Fall back to the sessionStorage
  // snapshot persisted on the first (state-bearing) mount so the result screen
  // survives F5 instead of dead-ending to /play.
  const state = useMemo<MatchResultLocationState | null>(() => {
    if (
      navState != null &&
      typeof navState.nonce === "string" &&
      navState.nonce &&
      navState.winner != null &&
      navState.turn != null
    ) {
      return navState;
    }
    return readLastResultState();
  }, [navState]);
  const { entryById, loading, error, ready } = useRenderManifest();
  const [data, setData] = useState<MatchRewardBreakdown | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.nonce || state.winner == null || state.turn == null) return;
    // Persist the raw state so a refresh can rehydrate (BUG 2).
    try {
      sessionStorage.setItem(LAST_RESULT_KEY, JSON.stringify(state));
    } catch {
      /* ignore — refresh-survival is best-effort */
    }
    const key = cacheKey(state.nonce);
    try {
      // Idempotency guard: rewards are applied at most once per match nonce.
      // On refresh the cached breakdown is replayed instead of re-crediting.
      const cached = sessionStorage.getItem(key);
      if (cached) {
        setData(JSON.parse(cached) as MatchRewardBreakdown);
        return;
      }
      const breakdown = applyMatchRewards({ winner: String(state.winner), turn: Number(state.turn) });
      sessionStorage.setItem(key, JSON.stringify(breakdown));
      setData(breakdown);
    } catch {
      setData(applyMatchRewards({ winner: String(state.winner), turn: Number(state.turn) }));
    }
  }, [state?.nonce, state?.winner, state?.turn]);

  const headline = useMemo(() => {
    if (!data) return "—";
    if (data.draw) return "Draw";
    if (data.won) return "Victory";
    return "Defeat";
  }, [data]);

  const p1CommanderId = state?.p1CommanderId?.trim() || undefined;
  const commanderEntry = p1CommanderId ? entryById.get(p1CommanderId) : undefined;
  const commanderPresence = commanderEntry ? lorePresenceForManifestEntry(commanderEntry) : null;

  if (
    state == null ||
    typeof state.nonce !== "string" ||
    !state.nonce ||
    state.winner == null ||
    state.turn == null
  ) {
    return <Navigate to="/play" replace />;
  }

  const buildShareText = () => {
    if (!data) return "";
    const cn = commanderEntry?.name ?? "Commander";
    return [
      `CRYPT · Crypt Legends · closed alpha`,
      `${headline} · ${cn}`,
      `${data.turn} ${data.turn === 1 ? "turn" : "turns"} · +${data.cryptDelta} ◈ Sigil · +${data.passXpDelta} pass XP`,
    ].join("\n");
  };

  const onShare = async () => {
    const text = buildShareText();
    if (!text) return;
    try {
      if (navigator.share) {
        await navigator.share({ text, title: "Crypt Legends verdict" });
        setShareHint("Shared via device.");
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareHint("Copied summary to clipboard.");
    } catch {
      setShareHint("Could not share this summary.");
    }
  };

  const headVariant = data
    ? !data.draw
      ? data.won
        ? "crypt-result-headline--win"
        : "crypt-result-headline--loss"
      : "crypt-result-headline--draw"
    : "";

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <div className="crypt-result-shell">
        <div className="crypt-result-accent" aria-hidden />
        <div className="crypt-result-inner">
          <header className="crypt-result-hero">
            <div className="crypt-result-commander-col">
              {commanderEntry ? (
                <div className="crypt-result-commander-stage">
                  <CommanderCard entry={commanderEntry} scale="dominant" variant="catalog" />
                </div>
              ) : (
                <div className="crypt-result-commander-fallback" aria-hidden>
                  Commander
                </div>
              )}
              {commanderEntry && (
                <>
                  <p className="crypt-result-commander-credit">{commanderEntry.name}</p>
                  {commanderPresence && (
                    <p className="crypt-result-commander-whisper">{commanderPresence}</p>
                  )}
                </>
              )}
            </div>

            <div className="crypt-result-copy-col">
              <p className="crypt-result-eyebrow">Verdict recorded</p>
              <h1 className={`crypt-result-headline ${headVariant}`}>{data ? headline : "…"}</h1>
              {data && <p className="crypt-result-moment">{momentLine(data)}</p>}
              <p className="crypt-result-stub-note">
                Free closed alpha — progress stays on your device. No ownership or ledger commitments at this stage.
              </p>
            </div>
          </header>

          {data && (
            <>
              <section className="crypt-result-payoff" aria-label="Match rewards">
                <div className="crypt-result-payoff-grid">
                  <div className="crypt-result-payoff-pillar">
                    <span className="crypt-result-payoff-kicker">◈ Sigil earned</span>
                    <span className="crypt-result-payoff-value crypt-result-payoff-value--gold">
                      +{data.cryptDelta}
                    </span>
                    <span className="crypt-result-payoff-placeholder">Closed-alpha ledger</span>
                  </div>
                  <div className="crypt-result-payoff-rule" aria-hidden />
                  <div className="crypt-result-payoff-pillar">
                    <span className="crypt-result-payoff-kicker">Pass progress</span>
                    <span className="crypt-result-payoff-value crypt-result-payoff-value--ice">
                      +{data.passXpDelta} XP
                    </span>
                    <span className="crypt-result-payoff-placeholder">Season archive (device)</span>
                  </div>
                </div>
                <p className="crypt-result-payoff-foot">
                  Running totals · {data.cryptBalanceAfter.toLocaleString()} ◈ Sigil ·{" "}
                  {data.passXpAfter.toLocaleString()} XP
                </p>
              </section>

              <div className="crypt-result-actions">
                <Link to="/match" className="crypt-result-cta-primary crypt-result-cta-primary--wide">
                  Duel again
                </Link>
                <div className="crypt-result-actions-row">
                  <Link to="/home" className="crypt-result-cta-secondary crypt-result-cta-secondary--flex">
                    Command hub
                  </Link>
                  <button type="button" className="crypt-result-cta-tertiary" onClick={onShare}>
                    Share
                  </button>
                </div>
                {shareHint && <p className="crypt-result-share-hint">{shareHint}</p>}
              </div>
            </>
          )}

          <footer className="crypt-result-foot">
            <Link to="/play" className="crypt-context-nav-link">
              ← Field
            </Link>
          </footer>
        </div>
      </div>
    </CatalogLoader>
  );
}
