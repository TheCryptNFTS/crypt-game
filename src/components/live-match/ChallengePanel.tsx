import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChallenge,
  pollChallenge,
  joinChallenge,
  cancelChallenge,
} from "../../services/socialApi";
import { getAuthHeader, isSignedIn } from "../../nft/gameSession";
import type { MatchView } from "../../game-ui/useRemoteCryptMatch";

/**
 * "Challenge a friend" — the PRIVATE alternative to Find Match. One compact
 * panel with two modes:
 *   CREATE: mint a code -> show it (copyable) -> poll until a friend joins ->
 *           enter the shared PvP match.
 *   JOIN:   paste a friend's code -> enter the shared PvP match.
 *
 * Both paths converge on `enterMatch(matchId)`, which fetches the initial
 * server view (the same GET the remote hook polls) to assemble the EnteredMatch
 * the PlayHub needs to mount RemoteCryptMatchPage.
 *
 * Guest/offline: `createChallenge()` returns null -> we show a quiet sign-in
 * note and never error. The same graceful-null contract holds for every call.
 */

type PlayerId = "P1" | "P2";

export type EnteredMatch = {
  matchId: string;
  version: number;
  view: MatchView;
  mySeat: PlayerId;
};

type Props = {
  /** Enter the live PvP match — identical handoff to Find Match's path. */
  onEnterMatch: (m: EnteredMatch) => void;
};

type Mode = "create" | "join";

function CITY_BASE(): string {
  return (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_CITY_API_BASE || "https://freeloncity.com"
  );
}

/**
 * Resolve a matchId into the EnteredMatch the hub mounts with. The challenge
 * APIs only hand back a matchId, so we GET the authoritative initial view
 * (`{version, view}` where `view.mySeat` is our seat) — the same endpoint the
 * remote match hook polls.
 */
async function resolveMatch(matchId: string): Promise<EnteredMatch | null> {
  try {
    const res = await fetch(`${CITY_BASE()}/api/match/${matchId}`, {
      headers: { accept: "application/json", ...getAuthHeader() },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: number; view?: MatchView };
    if (!data?.view || !data.view.mySeat) return null;
    return {
      matchId,
      version: data.version ?? 0,
      view: data.view,
      mySeat: data.view.mySeat,
    };
  } catch {
    return null;
  }
}

const POLL_MS = 2000;

export function ChallengePanel({ onEnterMatch }: Props) {
  const [mode, setMode] = useState<Mode>("create");

  // CREATE state.
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createMsg, setCreateMsg] = useState<string>("");

  // JOIN state.
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<string>("");

  const pollTimer = useRef<number | null>(null);
  const pollingRef = useRef(false);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // ---- CREATE -------------------------------------------------------------
  const startCreate = useCallback(async () => {
    if (!isSignedIn()) {
      setCreateMsg("Sign in to challenge a friend.");
      return;
    }
    setCreating(true);
    setCreateMsg("");
    setCopied(false);
    const lobby = await createChallenge();
    if (!mountedRef.current) return;
    setCreating(false);
    if (!lobby) {
      // Guest/offline or server unavailable — quiet note, no error.
      setCreateMsg("Sign in to challenge a friend.");
      return;
    }
    setCode(lobby.code);
    setExpiresAt(lobby.expiresAt);

    // Poll until the friend joins and the match is assigned.
    pollingRef.current = true;
    const tick = async () => {
      if (!pollingRef.current) return;
      const status = await pollChallenge(lobby.code);
      if (!pollingRef.current || !mountedRef.current) return;
      if (status?.joined && status.matchId) {
        stopPolling();
        const entered = await resolveMatch(status.matchId);
        if (!mountedRef.current) return;
        if (entered) {
          onEnterMatch(entered);
        } else {
          setCreateMsg("Match started but couldn't load. Try again.");
        }
        return;
      }
      pollTimer.current = window.setTimeout(tick, POLL_MS);
    };
    pollTimer.current = window.setTimeout(tick, POLL_MS);
  }, [onEnterMatch, stopPolling]);

  const cancelCreate = useCallback(async () => {
    const c = code;
    stopPolling();
    setCode(null);
    setExpiresAt(0);
    setCreateMsg("");
    if (c) {
      try {
        await cancelChallenge(c);
      } catch {
        /* best-effort — server expires stale codes anyway */
      }
    }
  }, [code, stopPolling]);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => {
        if (mountedRef.current) setCopied(false);
      }, 1500);
    } catch {
      /* clipboard blocked — the code is shown on-screen regardless */
    }
  }, [code]);

  // ---- JOIN ---------------------------------------------------------------
  const submitJoin = useCallback(async () => {
    const trimmed = joinCode.trim();
    if (!trimmed || joining) return;
    if (!isSignedIn()) {
      setJoinMsg("Sign in to join a challenge.");
      return;
    }
    setJoining(true);
    setJoinMsg("");
    const result = await joinChallenge(trimmed);
    if (!mountedRef.current) return;
    setJoining(false);
    if (!result) {
      setJoinMsg("Couldn't reach the server. Try again.");
      return;
    }
    if ("error" in result) {
      setJoinMsg(result.error || "That code didn't work.");
      return;
    }
    const entered = await resolveMatch(result.matchId);
    if (!mountedRef.current) return;
    if (entered) {
      onEnterMatch(entered);
    } else {
      setJoinMsg("Match started but couldn't load. Try again.");
    }
  }, [joinCode, joining, onEnterMatch]);

  const minutesLeft =
    expiresAt > 0 ? Math.max(0, Math.round((expiresAt - Date.now()) / 60000)) : 0;

  return (
    <div className="crypt-challenge">
      <div className="crypt-challenge__head">
        <span className="crypt-challenge__kicker">Private · vs. a friend</span>
        <h3 className="crypt-challenge__title">⬡ Challenge a friend</h3>
      </div>

      {/* Mode toggle: Create / Join. */}
      <div className="crypt-challenge__tabs" role="tablist" aria-label="Challenge mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          className={`crypt-challenge__tab ${mode === "create" ? "is-active" : ""}`}
          onClick={() => setMode("create")}
        >
          Create
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "join"}
          className={`crypt-challenge__tab ${mode === "join" ? "is-active" : ""}`}
          onClick={() => setMode("join")}
        >
          Join
        </button>
      </div>

      {mode === "create" ? (
        <div className="crypt-challenge__body">
          {code ? (
            <>
              <p className="crypt-challenge__hint">
                Share this code. Waiting for your friend to join…
              </p>
              <div className="crypt-challenge__code-row">
                <code className="crypt-challenge__code">{code}</code>
                <button
                  type="button"
                  className="crypt-challenge__copy"
                  onClick={() => void copyCode()}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {minutesLeft > 0 ? (
                <p className="crypt-challenge__meta">Expires in ~{minutesLeft} min</p>
              ) : null}
              <button
                type="button"
                className="crypt-challenge__cancel"
                onClick={() => void cancelCreate()}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <p className="crypt-challenge__hint">
                Get a private code, send it to a friend, and duel head-to-head.
              </p>
              <button
                type="button"
                className="crypt-challenge__cta"
                disabled={creating}
                onClick={() => void startCreate()}
              >
                {creating ? "Creating…" : "Create code"}
              </button>
            </>
          )}
          {createMsg ? (
            <p className="crypt-challenge__note" aria-live="polite">
              {createMsg}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="crypt-challenge__body">
          <p className="crypt-challenge__hint">Paste a friend's code to join their duel.</p>
          <form
            className="crypt-challenge__join-row"
            onSubmit={(e) => {
              e.preventDefault();
              void submitJoin();
            }}
          >
            <input
              className="crypt-challenge__input"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="Enter code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              aria-label="Friend's challenge code"
            />
            <button
              type="submit"
              className="crypt-challenge__cta"
              disabled={joining || !joinCode.trim()}
            >
              {joining ? "Joining…" : "Join"}
            </button>
          </form>
          {joinMsg ? (
            <p className="crypt-challenge__note" aria-live="polite">
              {joinMsg}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
