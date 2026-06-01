import React, { useEffect, useRef, useState } from "react";
import { signIn, isSignedIn, getSessionAddress, signOut, getAuthHeader } from "../../nft/gameSession";
import { connectWallet } from "../../nft/walletOwnership";
import type { MatchView } from "../../game-ui/useRemoteCryptMatch";

type PlayerId = "P1" | "P2";

export type EnteredMatch = {
  matchId: string;
  version: number;
  view: MatchView;
  mySeat: PlayerId;
};

type Props = {
  /** The connected wallet address (lowercased) if known from app state. */
  walletAddress?: string | null;
  /** Called once the player is in a match — the page swaps to the board. */
  onEnterMatch: (m: EnteredMatch) => void;
  /** Return to single-player mode. */
  onCancel: () => void;
};

function CITY_BASE(): string {
  return (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_CITY_API_BASE || "https://freeloncity.com"
  );
}

async function authedPost<T>(path: string, body?: unknown): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(`${CITY_BASE()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...getAuthHeader() },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

async function authedGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(`${CITY_BASE()}${path}`, {
      headers: { accept: "application/json", ...getAuthHeader() },
    });
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

/** localStorage key under which the active match id is remembered so a dropped
 *  player can RECONNECT to it after a refresh. Cleared when the match ends. */
const ACTIVE_MATCH_KEY = "crypt:activeMatchId";

/** Remember / forget the active match id for reconnect-after-refresh. Guarded so
 *  it is a no-op where localStorage is unavailable (SSR / privacy mode). */
export function rememberActiveMatch(matchId: string | null): void {
  try {
    if (matchId) window.localStorage.setItem(ACTIVE_MATCH_KEY, matchId);
    else window.localStorage.removeItem(ACTIVE_MATCH_KEY);
  } catch {
    /* ignore: storage may be disabled */
  }
}

function readActiveMatch(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_MATCH_KEY);
  } catch {
    return null;
  }
}

/**
 * Minimal PvP entry: sign in with the wallet, then Find Match (queue) or
 * Create / Join by code. On-theme (purple/gold) and built from existing
 * `.live-*` classes — plumbing, not a redesign.
 */
export function PvpLobby({ walletAddress, onEnterMatch, onCancel }: Props) {
  const [signedIn, setSignedIn] = useState(isSignedIn());
  const [address, setAddress] = useState<string | null>(getSessionAddress() ?? walletAddress ?? null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  // A previously-active match id (from localStorage) the player can rejoin.
  const [resumableMatchId, setResumableMatchId] = useState<string | null>(null);

  // Queue polling lifecycle guard.
  const queueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuing = useRef(false);

  useEffect(() => {
    return () => {
      queuing.current = false;
      if (queueTimer.current) clearTimeout(queueTimer.current);
    };
  }, []);

  // On mount (once signed in), surface any remembered match so the player can
  // RECONNECT after a refresh / dropped connection.
  useEffect(() => {
    if (!signedIn) return;
    setResumableMatchId(readActiveMatch());
  }, [signedIn]);

  const handleSignIn = async () => {
    setBusy(true);
    setStatus("Connecting wallet...");
    try {
      const addr = address ?? (await connectWallet());
      if (!addr) {
        setStatus("No wallet connected.");
        return;
      }
      setAddress(addr);
      setStatus("Sign the message in your wallet to authenticate...");
      const token = await signIn(addr);
      if (!token) {
        setStatus("Sign-in failed or was rejected.");
        return;
      }
      setSignedIn(true);
      setStatus("Signed in. Ready to find a match.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    setSignedIn(false);
    setStatus("Signed out.");
  };

  const enter = (m: EnteredMatch) => {
    queuing.current = false;
    if (queueTimer.current) clearTimeout(queueTimer.current);
    // Remember the match so a refresh/drop can reconnect to it by id.
    rememberActiveMatch(m.matchId);
    onEnterMatch(m);
  };

  /**
   * RECONNECT to an in-progress match by id. Fetches the replay-verified
   * authoritative payload ({ matchId, seat, version, view }) and re-mounts the
   * board exactly like a fresh claim. A 404 means the match ended/vanished — we
   * forget it so the prompt clears.
   */
  const handleReconnect = async (matchId: string) => {
    setBusy(true);
    setStatus("Reconnecting to your match...");
    const { status: code, data } = await authedGet<any>(
      `/api/match/${encodeURIComponent(matchId)}/resume`,
    );
    setBusy(false);
    if (code === 200 && data?.matchId && data?.view) {
      enter({ matchId: data.matchId, version: data.version, view: data.view, mySeat: data.seat ?? data.mySeat });
      return;
    }
    // Gone or unauthorized — forget it and clear the prompt.
    rememberActiveMatch(null);
    setResumableMatchId(null);
    setStatus(code === 404 ? "That match has ended." : "Could not reconnect.");
  };

  const handleFindMatch = async () => {
    if (!signedIn) return;
    setBusy(true);
    queuing.current = true;
    setStatus("Searching for an opponent...");

    const poll = async () => {
      if (!queuing.current) return;
      const { status: code, data } = await authedPost<any>("/api/match/queue");
      if (!queuing.current) return;

      if (code === 200 && data?.status === "matched") {
        enter({ matchId: data.matchId, version: data.version, view: data.view, mySeat: data.mySeat });
        setBusy(false);
        return;
      }
      // 200 {waiting} or 202 {retry} -> keep polling.
      if (code === 200 || code === 202) {
        setStatus("In queue — waiting for an opponent...");
        queueTimer.current = setTimeout(poll, 2000);
        return;
      }
      setStatus("Matchmaking failed. Try again.");
      queuing.current = false;
      setBusy(false);
    };

    void poll();
  };

  const handleCancelQueue = () => {
    queuing.current = false;
    if (queueTimer.current) clearTimeout(queueTimer.current);
    setBusy(false);
    setStatus("Left the queue.");
  };

  const handleCreate = async () => {
    if (!signedIn) return;
    setBusy(true);
    setStatus("Creating match...");
    const { status: code, data } = await authedPost<any>("/api/match/create");
    setBusy(false);
    if (code === 200 && data?.matchId) {
      if (data.view?.joinCode || data.joinCode) {
        setCreatedCode(data.view?.joinCode ?? data.joinCode);
      }
      enter({ matchId: data.matchId, version: data.version, view: data.view, mySeat: data.mySeat });
      return;
    }
    setStatus("Could not create match.");
  };

  const handleJoin = async () => {
    if (!signedIn || !joinCode.trim()) return;
    setBusy(true);
    setStatus("Joining match...");
    // The contract joins by code via /api/match/[id]/join; the code is also the
    // path id for code-based joins.
    const code = joinCode.trim();
    const { status: http, data } = await authedPost<any>(`/api/match/${encodeURIComponent(code)}/join`, {
      joinCode: code,
    });
    setBusy(false);
    if (http === 200 && data?.matchId) {
      enter({ matchId: data.matchId, version: data.version, view: data.view, mySeat: data.mySeat });
      return;
    }
    if (http === 403) setStatus("Join code rejected.");
    else if (http === 409) setStatus("That match is full or already started.");
    else setStatus("Could not join match.");
  };

  return (
    <div className="live-match-shell">
      <section className="live-side-panel" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h3>Crypt PvP</h3>

        {!signedIn ? (
          <>
            <p className="live-deckhint">
              Sign in with your wallet to play ranked PvP. This proves your
              identity only — it never moves funds or hex.
            </p>
            <div className="live-quick-buttons">
              <button className="live-btn live-btn--primary" disabled={busy} onClick={handleSignIn}>
                Sign In
              </button>
              <button className="live-btn live-btn--ghost" onClick={onCancel}>
                Back to Solo
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="live-deckhint">
              Signed in as <strong>{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "wallet"}</strong>.
            </p>

            {resumableMatchId ? (
              <div className="live-quick-buttons" style={{ marginBottom: 16 }}>
                <button
                  className="live-btn live-btn--primary"
                  disabled={busy}
                  onClick={() => void handleReconnect(resumableMatchId)}
                >
                  Reconnect to Match
                </button>
                <button
                  className="live-btn live-btn--ghost"
                  onClick={() => {
                    rememberActiveMatch(null);
                    setResumableMatchId(null);
                  }}
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            <div className="live-quick-buttons">
              <button className="live-btn live-btn--primary" disabled={busy} onClick={handleFindMatch}>
                Find Match
              </button>
              {busy ? (
                <button className="live-btn live-btn--danger-soft" onClick={handleCancelQueue}>
                  Cancel Queue
                </button>
              ) : null}
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="live-btn live-btn--secondary" disabled={busy} onClick={handleCreate}>
                Create Private Match
              </button>
              {createdCode ? (
                <p className="live-deckhint">
                  Share this code: <strong>{createdCode}</strong>
                </p>
              ) : null}
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <input
                className="live-input"
                placeholder="Join code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="live-btn live-btn--secondary" disabled={busy || !joinCode.trim()} onClick={handleJoin}>
                Join
              </button>
            </div>

            <div className="live-quick-buttons" style={{ marginTop: 16 }}>
              <button className="live-btn live-btn--ghost" onClick={handleSignOut}>
                Sign Out
              </button>
              <button className="live-btn live-btn--ghost" onClick={onCancel}>
                Back to Solo
              </button>
            </div>
          </>
        )}

        {status ? <p className="live-deckhint" style={{ marginTop: 12 }}>{status}</p> : null}
      </section>
    </div>
  );
}
