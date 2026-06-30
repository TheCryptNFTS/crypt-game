import { useCallback, useEffect, useState } from "react";
import { fetchOwnedCardTokenIds } from "./fetchOwnedCards";
import { getOwnedNftCardIds } from "./getOwnedNftCardIds";

export type OwnedState =
  | "idle"
  | "connecting"
  | "loading"
  | "ready"
  | "no-wallet"
  | "error";

/**
 * Wallet → owned Crypt card ids, for any BROWSE surface (Collection, Deck Forge)
 * that wants to filter the catalogue down to "the cards you actually own."
 *
 * This is the read-only twin of MatchRoute's chain: it silently adopts an
 * already-connected wallet (no prompt) so a returning holder lands on their own
 * cards, and exposes `connect()` for an explicit prompt. It returns the owned
 * card ids as a Set keyed `tcg_<tokenId>` — the same keys the render manifest
 * uses — so a caller filters with a single `ownedIds.has(entry.id)`.
 *
 * Fail-safe discipline (carried from fetchOwnedCards): a network/indexer outage
 * yields `state: "error"` and a null set — callers must treat that as "unknown",
 * NEVER as a confirmed empty collection, so an outage can't hide a real holder's
 * cards behind an empty "Owned only" view.
 */
export function useOwnedCardIds() {
  const [address, setAddress] = useState<string | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null);
  const [state, setState] = useState<OwnedState>("idle");

  const eth = () =>
    typeof window !== "undefined"
      ? (window as unknown as {
          ethereum?: { request: (a: { method: string }) => Promise<unknown> };
        }).ethereum ?? null
      : null;

  const loadOwned = useCallback(async (addr: string) => {
    setState("loading");
    const tokenIds = await fetchOwnedCardTokenIds(addr);
    if (!tokenIds) {
      // city/OpenSea unreachable — NOT a confirmed empty wallet.
      setOwnedIds(null);
      setState("error");
      return;
    }
    setOwnedIds(new Set(getOwnedNftCardIds(tokenIds)));
    setState("ready");
  }, []);

  // Silently adopt an already-connected wallet (no prompt). The eth_accounts
  // probe + loadOwned resolve asynchronously; if this component unmounts first,
  // skip the state updates to avoid a post-unmount setState (leak/warning).
  // Mirrors the `alive` cleanup pattern the board's owned-card fetch uses.
  useEffect(() => {
    let cancelled = false;
    const e = eth();
    if (!e?.request) return;
    e.request({ method: "eth_accounts" })
      .then((accs) => {
        if (cancelled) return;
        const a = (accs as string[])?.[0]?.toLowerCase();
        if (a) {
          setAddress(a);
          void loadOwned(a);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadOwned]);

  const connect = useCallback(async () => {
    const e = eth();
    if (!e?.request) {
      setState("no-wallet");
      return;
    }
    setState("connecting");
    try {
      const accs = (await e.request({ method: "eth_requestAccounts" })) as string[];
      const a = accs?.[0]?.toLowerCase();
      if (a) {
        setAddress(a);
        await loadOwned(a);
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }, [loadOwned]);

  return { address, ownedIds, state, connect };
}
