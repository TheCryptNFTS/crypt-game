import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import CommanderCard from "../components/cards/CommanderCard";
import PlayableCard from "../components/cards/PlayableCard";
import { useRenderManifest } from "../hooks/useRenderManifest";
import { decodeDeck, type ShareableDeck } from "../share/deckCodec";
import { copyToClipboard } from "../lib/share";
import {
  LS_DECK_BUILDER_COMMANDER,
  LS_DECK_BUILDER_MAIN_DECK,
} from "../lib/deckBuilderStorage";

type DecodeResult =
  | { ok: true; deck: ShareableDeck; reason?: undefined }
  | { ok: false; deck?: undefined; reason: "missing" | "bad" };

function decodeFromParam(code: string | null): DecodeResult {
  if (!code) return { ok: false, reason: "missing" };
  try {
    return { ok: true, deck: decodeDeck(code) };
  } catch {
    return { ok: false, reason: "bad" };
  }
}

export default function DeckViewPage() {
  const [params] = useSearchParams();
  const code = params.get("code");
  const { entryById, loading, error, ready } = useRenderManifest();

  const decoded = useMemo(() => decodeFromParam(code), [code]);

  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [loadNote, setLoadNote] = useState<string | null>(null);

  const copyCode = useCallback(async () => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    setCopyNote(ok ? "Deck code copied." : "Could not copy — select it manually.");
  }, [code]);

  const loadIntoBuilder = useCallback(() => {
    if (!decoded.ok) return;
    try {
      localStorage.setItem(LS_DECK_BUILDER_COMMANDER, decoded.deck.commanderId);
      localStorage.setItem(LS_DECK_BUILDER_MAIN_DECK, JSON.stringify(decoded.deck.cards));
      setLoadNote("Loaded — opening the forge…");
    } catch {
      setLoadNote("Could not save to this device — open the forge and rebuild.");
    }
  }, [decoded]);

  if (!decoded.ok) {
    const reason = decoded.reason;
    return (
      <CryptPageFrame
        eyebrow="Shared loadout"
        title={reason === "missing" ? "No deck code" : "Unreadable deck code"}
        lead={
          reason === "missing"
            ? "This link is missing its deck code. Ask for a fresh share link."
            : "This share link could not be decoded — it may be truncated or from a newer format."
        }
      >
        <div className="crypt-deck-page space-y-6">
          <div className="crypt-deck-panel">
            <p className="crypt-deck-muted">
              Build your own legend in the forge, then share it with a single link.
            </p>
            <div className="mt-4">
              <Link className="live-btn live-btn--primary" to="/deck">
                Open the forge &#x2B22;
              </Link>
            </div>
          </div>
        </div>
      </CryptPageFrame>
    );
  }

  const deck = decoded.deck;
  const commanderEntry = entryById.get(deck.commanderId);

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <CryptPageFrame
        eyebrow="Shared loadout"
        title="A pilot's deck"
        lead="A read-only loadout shared by another pilot — commander and the Crypt Digital Trading Cards in their main deck."
      >
        <div className="crypt-deck-page space-y-6">
          <div className="crypt-deck-panel">
            <label className="crypt-deck-label">Commander</label>
            {commanderEntry ? (
              <div className="mt-3 flex justify-center sm:justify-start">
                <div className="max-w-[168px]">
                  <CommanderCard entry={commanderEntry} scale="table" />
                </div>
              </div>
            ) : (
              <p className="crypt-deck-muted">
                Unknown commander · <span className="font-mono">{deck.commanderId}</span>
              </p>
            )}
          </div>

          <div className="crypt-deck-panel">
            <h2 className="crypt-deck-h2">Main deck ({deck.cards.length})</h2>
            {deck.cards.length === 0 ? (
              <p className="crypt-deck-muted">This shared deck has no cards.</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {deck.cards.map((id, index) => (
                  <PlayableCard key={`${id}-${index}`} entry={entryById.get(id)} mode="collection" />
                ))}
              </div>
            )}
          </div>

          <div className="crypt-deck-panel">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="live-btn live-btn--ghost" onClick={copyCode}>
                Copy deck code
              </button>
              <Link className="live-btn live-btn--primary" to="/deck" onClick={loadIntoBuilder}>
                Load this deck &#x2B22;
              </Link>
            </div>
            {(copyNote || loadNote) && (
              <p className="crypt-deck-hint mt-3">{loadNote ?? copyNote}</p>
            )}
            {code && (
              <p className="crypt-deck-hint mt-3 break-all font-mono opacity-70">{code}</p>
            )}
          </div>
        </div>
      </CryptPageFrame>
    </CatalogLoader>
  );
}
