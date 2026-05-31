/**
 * Real wallet ownership — Slice 1 of the FREELON CITY ↔ Crypt TCG link.
 *
 * The TCG is a pure client-side app with no backend and no API key, so we
 * prove ownership through the PLAYER'S OWN injected wallet (EIP-1193):
 *   1. `eth_requestAccounts` → the real connected address.
 *   2. `eth_call balanceOf(player)` on the Combat Archives contract → the
 *      on-chain count of crypttradingcards the wallet holds.
 *
 * This needs no third party: no OpenSea key (which must never ship in a
 * client bundle), no RPC of our own, no backend. The player's wallet is the
 * source of truth.
 *
 * What this CANNOT do: list WHICH token IDs are held. The Combat Archives
 * contract (verified on-chain) is a plain ERC-721 — it does NOT implement
 * ERC721Enumerable, so `tokenOfOwnerByIndex` is unavailable. Enumerating the
 * exact ids needs an indexer (that is Slice 2, via the city backend). Here we
 * can only prove the COUNT.
 *
 * Fail-safe discipline carried from the city site: never lie with a false
 * zero. A failed/blocked/wrong-chain lookup returns `null` ("unknown"), never
 * `0` — an outage must not strip a real holder's status.
 */

/** Combat Archives — the crypttradingcards collection, Ethereum mainnet. */
export const COMBAT_ARCHIVES_CONTRACT =
  "0x48fd513c9f8ca591ffada7223a261ffc6e797394";

/** ERC-20/721 `balanceOf(address)` selector. */
const BALANCE_OF_SELECTOR = "0x70a08231";

/** Ethereum mainnet chain id. */
const MAINNET_CHAIN_ID = "0x1";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth && typeof eth.request === "function" ? eth : null;
}

/** True when an injected wallet (MetaMask, Rabby, etc.) is available. */
export function hasInjectedWallet(): boolean {
  return getProvider() !== null;
}

/**
 * Prompt the user to connect their wallet and return the lowercased address.
 * Returns null when there is no provider or the user rejects the request.
 */
export async function connectWallet(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[] | undefined;
    const addr = accounts?.[0];
    return addr ? addr.toLowerCase() : null;
  } catch {
    // User rejected the connection, or the provider errored.
    return null;
  }
}

function pad32(addrNo0x: string): string {
  return addrNo0x.toLowerCase().padStart(64, "0");
}

/**
 * Read the wallet's on-chain Combat Archives balance through the player's own
 * provider. Returns the count, or null when the value is unknown (no wallet,
 * not on mainnet, or the call failed) — never a false zero.
 */
export async function getCombatArchivesBalance(
  address: string,
): Promise<number | null> {
  const provider = getProvider();
  if (!provider) return null;

  const clean = address.startsWith("0x") ? address.slice(2) : address;
  if (clean.length !== 40) return null;

  // Querying balanceOf only makes sense on the chain the contract lives on.
  // If the wallet is on another network, the read is meaningless — report
  // unknown rather than a misleading zero.
  try {
    const chainId = (await provider.request({ method: "eth_chainId" })) as string;
    if (chainId?.toLowerCase() !== MAINNET_CHAIN_ID) return null;
  } catch {
    return null;
  }

  try {
    const data = BALANCE_OF_SELECTOR + pad32(clean);
    const result = (await provider.request({
      method: "eth_call",
      params: [{ to: COMBAT_ARCHIVES_CONTRACT, data }, "latest"],
    })) as string | undefined;
    if (!result || result === "0x") return null;
    return Number(BigInt(result));
  } catch {
    return null;
  }
}

export type WalletConnection = {
  address: string;
  /** On-chain Combat Archives count, or null when unverified/unknown. */
  combatArchives: number | null;
};

/**
 * Connect + verify in one step: returns the real address plus the on-chain
 * Combat Archives count (null when it could not be verified). Returns null
 * only when no wallet is available or the user rejects the connection.
 */
export async function connectAndVerify(): Promise<WalletConnection | null> {
  const address = await connectWallet();
  if (!address) return null;
  const combatArchives = await getCombatArchivesBalance(address);
  return { address, combatArchives };
}
