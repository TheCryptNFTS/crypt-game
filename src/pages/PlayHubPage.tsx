import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import CommanderCard from "../components/cards/CommanderCard";
import PlayableCard from "../components/cards/PlayableCard";
import { validateDeck } from "../engine/deckRules";
import { getCommanderById } from "../engine/commanders";
import {
  loadStoredCommanderId,
  loadStoredMainDeckCardIds,
} from "../lib/deckBuilderStorage";
import { useRenderManifest } from "../hooks/useRenderManifest";
import RemoteCryptMatchPage from "./RemoteCryptMatchPage";
import { getAuthHeader, isSignedIn } from "../nft/gameSession";
import type { MatchView } from "../game-ui/useRemoteCryptMatch";
import { ChallengePanel } from "../components/live-match/ChallengePanel";
import { t } from "../i18n";

/**
 * Mode launcher — /match stays the table; this is the product surface for picking
 * how to play. The "Find Match" button drives the server-authoritative
 * matchmaking QUEUE: enqueue (with the local loadout) -> poll -> on pairing,
 * route into the shared RemoteCryptMatchPage with the assigned matchId + seat.
 */

type PlayerId = "P1" | "P2";

type EnteredMatch = {
  matchId: string;
  version: number;
  view: MatchView;
  mySeat: PlayerId;
};

/** Matchmaking lifecycle for the Find Match button. */
type QueuePhase = "idle" | "searching" | "error";

function CITY_BASE(): string {
  return (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_CITY_API_BASE || "https://freeloncity.com"
  );
}

export default function PlayHubPage() {
  const location = useLocation();
  const { entryById, loading, error, ready } = useRenderManifest();

  // --- Matchmaking state ------------------------------------------------------
  const [phase, setPhase] = useState<QueuePhase>("idle");
  const [queueMsg, setQueueMsg] = useState<string>("");
  const [match, setMatch] = useState<EnteredMatch | null>(null);
  // Polling lifecycle guards so a leave/unmount stops the queue cleanly.
  const searchingRef = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      searchingRef.current = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const { mainDeck, commander, commanderEntry, validation } = useMemo(() => {
    const cid = loadStoredCommanderId();
    const deck = loadStoredMainDeckCardIds();
    let cmd: ReturnType<typeof getCommanderById> = null;
    try {
      cmd = getCommanderById(cid);
    } catch {
      cmd = null;
    }
    const val = cmd
      ? validateDeck(deck, cid, {
          deckSize: cmd.deckRules.deckSize,
          maxCopies: 2,
          allowGodCards: cmd.deckRules.maxGodCards > 0,
        })
      : undefined;
    return {
      mainDeck: deck,
      commander: cmd,
      commanderEntry: entryById.get(cid),
      validation: val,
    };
  }, [location.pathname, entryById]);

  const previewSample = useMemo(() => mainDeck.slice(0, 6), [mainDeck]);

  // A friend "Challenge" pre-fills Join — either via in-app navigation state
  // (Friends page) OR a shared deep-link `/play?challenge=<code>` (challenge
  // links). Hand whichever is present to the ChallengePanel.
  const challengeCode = useMemo(() => {
    const state = location.state as { challengeCode?: unknown } | null;
    if (typeof state?.challengeCode === "string") return state.challengeCode;
    const fromUrl = new URLSearchParams(location.search).get("challenge");
    return fromUrl ? fromUrl.trim() : undefined;
  }, [location.state, location.search]);

  /** The deck bootstrap we enqueue with: the locally-stored loadout. */
  const myDeckBootstrap = useMemo(
    () => ({ commanderId: loadStoredCommanderId(), deck: loadStoredMainDeckCardIds() }),
    [location.pathname],
  );

  const enterMatch = useCallback((m: EnteredMatch) => {
    searchingRef.current = false;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setPhase("idle");
    setMatch(m);
  }, []);

  /**
   * FIND MATCH: enqueue the local loadout, then poll the queue until paired.
   * The server pairs the two longest-waiting players and returns the assigned
   * matchId + seat; we route straight into RemoteCryptMatchPage.
   */
  const findMatch = useCallback(async () => {
    if (!isSignedIn()) {
      setPhase("error");
      setQueueMsg(t("play.queue.signIn"));
      return;
    }
    searchingRef.current = true;
    setPhase("searching");
    setQueueMsg(t("play.queue.searching"));

    const headers = {
      "content-type": "application/json",
      accept: "application/json",
      ...getAuthHeader(),
    };

    const adopt = (data: any): boolean => {
      // Accept either the city-proxy shape ({matchId,version,view,mySeat}) or the
      // raw server shape ({state:"matched",matchId,seat}). For the latter we then
      // claim the pairing to fetch the initial view.
      if (data?.matchId && data?.view && (data?.mySeat || data?.seat)) {
        enterMatch({
          matchId: data.matchId,
          version: data.version ?? 0,
          view: data.view,
          mySeat: (data.mySeat ?? data.seat) as PlayerId,
        });
        return true;
      }
      return false;
    };

    /** When the queue says "matched" without a view, claim the pairing. */
    const claim = async (): Promise<boolean> => {
      try {
        const res = await fetch(`${CITY_BASE()}/api/match/queue/claim`, {
          method: "POST",
          headers,
        });
        if (res.status === 200) {
          const data = await res.json().catch(() => null);
          return data ? adopt(data) : false;
        }
      } catch {
        /* fall through to keep polling */
      }
      return false;
    };

    // Initial enqueue.
    try {
      const res = await fetch(`${CITY_BASE()}/api/match/queue`, {
        method: "POST",
        headers,
        body: JSON.stringify({ deck: myDeckBootstrap }),
      });
      const data = await res.json().catch(() => null);
      if (!searchingRef.current) return;
      if (res.status === 200 && (data?.status === "matched" || data?.state === "matched")) {
        if (adopt(data)) return;
        if (await claim()) return;
      }
    } catch {
      if (!searchingRef.current) return;
      setPhase("error");
      setQueueMsg(t("play.queue.unreachable"));
      searchingRef.current = false;
      return;
    }

    // Poll for a pairing.
    const poll = async () => {
      if (!searchingRef.current) return;
      try {
        const res = await fetch(`${CITY_BASE()}/api/match/queue`, {
          method: "GET",
          headers,
        });
        const data = await res.json().catch(() => null);
        if (!searchingRef.current) return;
        if (res.status === 200 && (data?.status === "matched" || data?.state === "matched")) {
          if (adopt(data)) return;
          if (await claim()) return;
        }
        if (res.status === 200 || res.status === 202) {
          const pos = data?.position;
          setQueueMsg(
            pos ? `In queue — position ${pos}. Holding for an opponent…` : t("play.queue.waiting"),
          );
          pollTimer.current = setTimeout(poll, 2000);
          return;
        }
        setPhase("error");
        setQueueMsg(t("play.queue.failed"));
        searchingRef.current = false;
      } catch {
        if (!searchingRef.current) return;
        // Transient network blip — keep trying.
        pollTimer.current = setTimeout(poll, 2500);
      }
    };
    pollTimer.current = setTimeout(poll, 2000);
  }, [enterMatch, myDeckBootstrap]);

  /** CANCEL the search: dequeue server-side and stop polling. */
  const cancelSearch = useCallback(async () => {
    searchingRef.current = false;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setPhase("idle");
    setQueueMsg(t("play.queue.left"));
    try {
      await fetch(`${CITY_BASE()}/api/match/queue`, {
        method: "DELETE",
        headers: { accept: "application/json", ...getAuthHeader() },
      });
    } catch {
      /* best-effort cancel — the server reaper drops stale tickets anyway */
    }
  }, []);

  // --- In a match: render the server-authoritative board ----------------------
  if (match) {
    return (
      <div className="crypt-shell">
        <div className="crypt-shell__bg" />
        <RemoteCryptMatchPage
          matchId={match.matchId}
          initialView={match.view}
          initialVersion={match.version}
          mySeat={match.mySeat}
          onLeave={() => setMatch(null)}
        />
      </div>
    );
  }

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <CryptPageFrame
        eyebrow={t("play.eyebrow")}
        title={t("play.title")}
        lead={t("play.lead")}
      >
        <div className="crypt-play-sections">
          <section className="crypt-play-loadout" aria-label={t("play.loadout.aria")}>
            <div className="crypt-play-loadout-header">
              <h2 className="crypt-play-section-label">{t("play.loadout.yourDeck")}</h2>
              <Link to="/deck" className="crypt-play-edit-deck">
                {t("play.loadout.editDeck")}
              </Link>
            </div>
            <div className="crypt-play-loadout-grid">
              <div className="crypt-play-commander-panel">
                {commanderEntry ? (
                  <div className="crypt-play-commander-stage">
                    <CommanderCard entry={commanderEntry} scale="dominant" variant="catalog" />
                  </div>
                ) : (
                  <div className="crypt-play-commander-fallback" aria-hidden>
                    {t("play.loadout.commanderFallback")}
                  </div>
                )}
                {commander && (
                  <p className="crypt-play-commander-meta">
                    {commander.name}
                    <span className="crypt-play-commander-meta-sub">
                      {" "}
                      · {commander.deckRules.deckSize}-card main deck
                    </span>
                  </p>
                )}
              </div>
              <div className="crypt-play-deck-panel">
                <div className="crypt-play-deck-strip">
                  {previewSample.length === 0 ? (
                    <p className="crypt-play-deck-empty">{t("play.loadout.deckEmpty")}</p>
                  ) : (
                    previewSample.map((id) => {
                      const entry = entryById.get(id);
                      return entry ? (
                        <div key={id} className="crypt-play-deck-thumb">
                          <PlayableCard entry={entry} mode="collection" />
                        </div>
                      ) : (
                        <div key={id} className="crypt-play-deck-thumb-fallback" title={id}>
                          ···
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="crypt-play-deck-count">
                  Main deck: {mainDeck.length}
                  {commander ? ` / ${commander.deckRules.deckSize}` : ""} cards
                </p>
                {validation && !validation.valid && (
                  <p className="crypt-play-deck-warning">
                    {t("play.loadout.deckNotLegal")}
                  </p>
                )}
                {validation?.valid && <p className="crypt-play-deck-ok">{t("play.loadout.deckOk")}</p>}
              </div>
            </div>
          </section>

          <section className="crypt-play-modes" aria-label={t("play.modes.aria")}>
            <h2 className="crypt-play-section-label crypt-play-section-label--spaced">{t("play.modes.label")}</h2>

            {/* FIND MATCH — server-authoritative matchmaking queue. */}
            <div className="crypt-play-mode-featured">
              <div className="crypt-play-mode-featured-inner">
                <span className="crypt-play-featured-kicker">{t("play.find.kicker")}</span>
                <h3 className="crypt-play-featured-title">{t("play.find.title")}</h3>
                <p className="crypt-play-featured-copy">
                  {t("play.find.copy")}
                </p>
                {phase === "searching" ? (
                  <div className="crypt-play-queue-live">
                    <p className="crypt-play-queue-status" aria-live="polite">
                      ⬡ {queueMsg}
                    </p>
                    <button type="button" className="crypt-play-featured-cta" onClick={cancelSearch}>
                      {t("play.find.cancel")}
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" className="crypt-play-featured-cta" onClick={findMatch}>
                      {t("play.find.cta")}
                    </button>
                    {phase === "error" && queueMsg ? (
                      <p className="crypt-play-soon" aria-live="polite">
                        {queueMsg}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {/* CHALLENGE A FRIEND — private code-based duel, enters the same
                server-authoritative PvP match as Find Match. */}
            <ChallengePanel onEnterMatch={enterMatch} initialJoinCode={challengeCode} />

            <Link to="/match" className="crypt-play-mode-quick">
              <span className="crypt-play-mode-quick-kicker">{t("play.solo.kicker")}</span>
              <span className="crypt-play-mode-quick-title">{t("play.solo.title")}</span>
              <span className="crypt-play-mode-quick-meta">{t("play.solo.meta")}</span>
            </Link>

            <Link to="/ladder" className="crypt-play-mode-quick">
              <span className="crypt-play-mode-quick-kicker">{t("play.ranked.kicker")}</span>
              <span className="crypt-play-mode-quick-title">{t("play.ranked.title")}</span>
              <span className="crypt-play-mode-quick-meta">{t("play.ranked.meta")}</span>
            </Link>

            <Link to="/puzzles" className="crypt-play-mode-quick">
              <span className="crypt-play-mode-quick-kicker">{t("play.puzzles.kicker")}</span>
              <span className="crypt-play-mode-quick-title">{t("play.puzzles.title")}</span>
              <span className="crypt-play-mode-quick-meta">{t("play.puzzles.meta")}</span>
            </Link>

            <Link to="/leaderboard" className="crypt-play-mode-quick">
              <span className="crypt-play-mode-quick-kicker">{t("play.season.kicker")}</span>
              <span className="crypt-play-mode-quick-title">{t("play.season.title")}</span>
              <span className="crypt-play-mode-quick-meta">{t("play.season.meta")}</span>
            </Link>

            <Link to="/draft" className="crypt-play-mode-quick">
              <span className="crypt-play-mode-quick-kicker">{t("play.draft.kicker")}</span>
              <span className="crypt-play-mode-quick-title">{t("play.draft.title")}</span>
              <span className="crypt-play-mode-quick-meta">{t("play.draft.meta")}</span>
            </Link>

            <Link to="/spectate" className="crypt-play-mode-quick">
              <span className="crypt-play-mode-quick-kicker">{t("play.spectate.kicker")}</span>
              <span className="crypt-play-mode-quick-title">{t("play.spectate.title")}</span>
              <span className="crypt-play-mode-quick-meta">{t("play.spectate.meta")}</span>
            </Link>
          </section>
        </div>
      </CryptPageFrame>
    </CatalogLoader>
  );
}
