import { useCallback, useEffect, useMemo, useState } from "react";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { validateDeck } from "../engine/deckRules";
import { getCommanderById } from "../engine/commanders";
import { useRenderManifest } from "../hooks/useRenderManifest";
import CardFrame from "../components/cards/CardFrame";

const LS_COMMANDER = "crypt-deck-builder-commander";
const LS_DECK = "crypt-deck-builder-main-deck";

const commanderIds = Object.keys(COMMANDER_SPECS).sort();

function loadStoredCommander(): string {
  try {
    const raw = localStorage.getItem(LS_COMMANDER);
    if (raw && COMMANDER_SPECS[raw]) return raw;
  } catch {
    /* ignore */
  }
  return commanderIds[0] ?? "cmd_stone_warden";
}

function loadStoredDeck(): string[] {
  try {
    const raw = localStorage.getItem(LS_DECK);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export default function DeckBuilderPage() {
  const { playable, entryById } = useRenderManifest();
  const [commanderId, setCommanderId] = useState(loadStoredCommander);
  const [mainDeck, setMainDeck] = useState<string[]>(loadStoredDeck);

  useEffect(() => {
    try {
      localStorage.setItem(LS_COMMANDER, commanderId);
    } catch {
      /* ignore */
    }
  }, [commanderId]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DECK, JSON.stringify(mainDeck));
    } catch {
      /* ignore */
    }
  }, [mainDeck]);

  const commander = useMemo(() => {
    try {
      return getCommanderById(commanderId);
    } catch {
      return null;
    }
  }, [commanderId]);

  const validation = useMemo(() => {
    if (!commander) {
      return {
        valid: false,
        errors: ["Invalid commander"],
        warnings: [] as string[],
        stats: null as ReturnType<typeof validateDeck>["stats"] | null,
      };
    }
    return validateDeck(mainDeck, commanderId, {
      deckSize: commander.deckRules.deckSize,
      maxCopies: 2,
      allowGodCards: commander.deckRules.maxGodCards > 0,
    });
  }, [commander, commanderId, mainDeck]);

  const playablePool = useMemo(
    () => playable.filter((e) => e.role === "unit" || e.role === "equipment" || e.role === "artifact"),
    [playable]
  );

  const addCard = useCallback(
    (id: string) => {
      if (!commander) return;
      if (mainDeck.length >= commander.deckRules.deckSize) return;
      setMainDeck((d) => [...d, id]);
    },
    [commander, mainDeck.length]
  );

  const removeAt = useCallback((index: number) => {
    setMainDeck((d) => d.filter((_, i) => i !== index));
  }, []);

  const clearDeck = useCallback(() => setMainDeck([]), []);

  const commanderEntry = entryById.get(commanderId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Deck builder</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Commander is separate from the main deck. Main deck: units, equipment, and artifacts only.
        </p>
      </div>

      <div className="rounded-xl border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)] p-4">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Commander
        </label>
        <select
          className="mt-2 w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          value={commanderId}
          onChange={(e) => setCommanderId(e.target.value)}
        >
          {commanderIds.map((id) => (
            <option key={id} value={id}>
              {COMMANDER_SPECS[id]?.name ?? id}
            </option>
          ))}
        </select>
        {commanderEntry && (
          <div className="mt-4 max-w-xs">
            <CardFrame entry={commanderEntry} />
          </div>
        )}
        {commander && (
          <p className="mt-3 text-xs text-zinc-500">
            Target deck size: {commander.deckRules.deckSize} · Max god cards:{" "}
            {commander.deckRules.maxGodCards}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-300">
            Main deck ({mainDeck.length}
            {commander ? ` / ${commander.deckRules.deckSize}` : ""})
          </h2>
          <button
            type="button"
            className="text-xs text-zinc-400 underline"
            onClick={clearDeck}
          >
            Clear
          </button>
        </div>

        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
          {mainDeck.length === 0 && (
            <p className="text-sm text-zinc-600">No cards — add from the catalog below.</p>
          )}
          <ul className="space-y-1 text-sm text-zinc-300">
            {mainDeck.map((id, index) => (
              <li
                key={`${id}-${index}`}
                className="flex items-center justify-between gap-2 rounded border border-zinc-800/80 bg-zinc-900/60 px-2 py-1"
              >
                <span className="truncate">
                  {entryById.get(id)?.name ?? id}
                  <span className="text-zinc-600"> · {id}</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-rose-300 hover:underline"
                  onClick={() => removeAt(index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 space-y-2">
          <div
            className={`text-sm ${validation.valid ? "text-emerald-400" : "text-rose-300"}`}
          >
            {validation.valid ? "Deck passes validation." : "Deck has blocking errors."}
          </div>
          {validation.errors.length > 0 && (
            <ul className="list-inside list-disc text-sm text-rose-200/90">
              {validation.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="list-inside list-disc text-sm text-amber-200/90">
              {validation.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Playable catalog (tap to add)
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {playablePool.map((entry) => (
            <CardFrame
              key={entry.id}
              entry={entry}
              compact
              onClick={() => addCard(entry.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
