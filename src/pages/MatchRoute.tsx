import { useCallback, useEffect, useState } from "react";
import LiveCryptMatchPage from "./LiveCryptMatchPage";
import { fetchOwnedCardTokenIds } from "../nft/fetchOwnedCards";
import { getOwnedNftCardIds } from "../nft/getOwnedNftCardIds";
import { buildPlayerDeck } from "../nft/buildOwnedDeck";
import "../styles/owned-cards-bar.css";

const OPENSEA_COLLECTION = "https://opensea.io/collection/crypttradingcards";

type LoadState = "idle" | "connecting" | "loading" | "ready" | "no-wallet" | "error";

/**
 * /match wrapper — wires the wallet → owned-cards → deck chain that was built
 * but never mounted (every match was always the demo deck). On entry it silently
 * adopts an already-connected wallet; a "PLAY WITH YOUR OWN CARDS" bar connects
 * one on demand. The bar is LOUD about the outcome — owning fewer than a legal 30
 * playable cards no longer silently swaps in the demo deck without saying so.
 *
 * The match page already accepts `ownedCardIds`/`walletAddress` and rebuilds the
 * local match when owned ids arrive mid-session, so this stays a thin shell.
 */
export default function MatchRoute() {
  const [address, setAddress] = useState<string | null>(null);
  const [ownedCardIds, setOwnedCardIds] = useState<string[] | undefined>(undefined);
  const [state, setState] = useState<LoadState>("idle");

  const eth = () =>
    typeof window !== "undefined"
      ? (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<unknown> } }).ethereum ?? null
      : null;

  const loadOwned = useCallback(async (addr: string) => {
    setState("loading");
    const tokenIds = await fetchOwnedCardTokenIds(addr);
    if (!tokenIds) {
      setOwnedCardIds(undefined);
      setState("error"); // city/OpenSea unreachable — NOT a confirmed empty wallet
      return;
    }
    setOwnedCardIds(getOwnedNftCardIds(tokenIds));
    setState("ready");
  }, []);

  // Silently adopt an already-connected wallet (no prompt) so returning holders
  // land straight into their own cards.
  useEffect(() => {
    const e = eth();
    if (!e?.request) return;
    e.request({ method: "eth_accounts" })
      .then((accs) => {
        const a = (accs as string[])?.[0]?.toLowerCase();
        if (a) { setAddress(a); void loadOwned(a); }
      })
      .catch(() => {});
  }, [loadOwned]);

  const connect = useCallback(async () => {
    const e = eth();
    if (!e?.request) { setState("no-wallet"); return; }
    setState("connecting");
    try {
      const accs = (await e.request({ method: "eth_requestAccounts" })) as string[];
      const a = accs?.[0]?.toLowerCase();
      if (a) { setAddress(a); await loadOwned(a); } else setState("idle");
    } catch { setState("idle"); }
  }, [loadOwned]);

  const built = ownedCardIds ? buildPlayerDeck(ownedCardIds) : null;
  const ownedPlayable = built?.ownedPlayable ?? 0;
  const playingOwned = built?.source === "owned";

  return (
    <>
      <OwnedCardsBar
        address={address}
        state={state}
        ownedPlayable={ownedPlayable}
        playingOwned={playingOwned}
        onConnect={connect}
      />
      <LiveCryptMatchPage ownedCardIds={ownedCardIds} walletAddress={address} />
    </>
  );
}

function OwnedCardsBar({
  address, state, ownedPlayable, playingOwned, onConnect,
}: {
  address: string | null;
  state: LoadState;
  ownedPlayable: number;
  playingOwned: boolean;
  onConnect: () => void;
}) {
  // Not connected → the invitation.
  if (!address) {
    if (state === "no-wallet") {
      return (
        <div className="ocb ocb--warn" role="status">
          <span>No wallet in this browser — open the Crypt in your wallet app to play your cards.</span>
        </div>
      );
    }
    return (
      <div className="ocb ocb--invite" role="status">
        <span>Own Crypt cards? Field your real collection.</span>
        <button className="ocb__btn" onClick={onConnect} disabled={state === "connecting"}>
          {state === "connecting" ? "Connecting…" : "Play with your own cards →"}
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return <div className="ocb ocb--load" role="status"><span>Reading your collection…</span></div>;
  }
  if (state === "error") {
    return (
      <div className="ocb ocb--warn" role="status">
        <span>Couldn&apos;t reach the collection service — playing the starter deck.</span>
        <button className="ocb__btn ocb__btn--ghost" onClick={onConnect}>Retry</button>
      </div>
    );
  }
  // Connected + resolved.
  if (playingOwned) {
    return (
      <div className="ocb ocb--owned" role="status">
        <span>✓ Your collection is in play — built from your {ownedPlayable} Crypt cards.</span>
      </div>
    );
  }
  // Connected but can't field a legal 30 — say it OUT LOUD (no silent demo swap).
  return (
    <div className="ocb ocb--short" role="status">
      <span>
        You own <strong>{ownedPlayable}</strong> playable Crypt {ownedPlayable === 1 ? "card" : "cards"} — 30 needed to
        field your own deck. Playing the starter deck for now.
      </span>
      <a className="ocb__btn ocb__btn--ghost" href={OPENSEA_COLLECTION} target="_blank" rel="noreferrer">
        Get cards →
      </a>
    </div>
  );
}
