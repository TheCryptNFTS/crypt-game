import { useCallback, useState } from "react";
import {
  connectAndVerify,
  hasInjectedWallet,
  type WalletConnection,
} from "../nft/walletOwnership";

/**
 * Read-only wallet connect for the marketplace. Wraps the existing, audited
 * `connectAndVerify` (which only does `eth_requestAccounts` + a `balanceOf`
 * READ). It NEVER signs, writes, or transfers — connecting is purely to learn
 * the viewer's address so the UI can show which cards they hold vs. can borrow.
 */
export type WalletState = {
  connection: WalletConnection | null;
  connecting: boolean;
  /** True only when no injected wallet exists at all. */
  unavailable: boolean;
  connect: () => Promise<void>;
  /** Local disconnect — forgets the address in this tab; no chain effect. */
  disconnect: () => void;
};

export function useWalletConnection(): WalletState {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const next = await connectAndVerify();
      setConnection(next);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setConnection(null), []);

  return {
    connection,
    connecting,
    unavailable: !hasInjectedWallet(),
    connect,
    disconnect,
  };
}
