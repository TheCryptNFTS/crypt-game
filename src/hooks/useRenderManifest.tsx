import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RenderManifest, RenderManifestEntry } from "../types/renderManifest";

const MANIFEST_URL = `${import.meta.env.BASE_URL}data/renderManifest.json`;

type MState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: RenderManifest }
  | { status: "err"; message: string };

export type RenderManifestContextValue = {
  loading: boolean;
  ready: boolean;
  error: string | null;
  manifest: RenderManifest | null;
  entryById: Map<string, RenderManifestEntry>;
  commanders: RenderManifestEntry[];
  playable: RenderManifestEntry[];
};

const ManifestContext = createContext<RenderManifestContextValue | null>(null);

/** Survives React StrictMode dev remounts so catalog does not re-enter idle/spinner after load. */
let resolvedManifest: RenderManifest | null = null;
let resolvedError: string | null = null;

function buildValue(st: MState): RenderManifestContextValue {
  const entryById = new Map<string, RenderManifestEntry>();
  if (st.status === "ok") {
    for (const e of st.data.commanders) {
      entryById.set(e.id, e);
    }
    for (const e of st.data.playable) {
      entryById.set(e.id, e);
    }
  }
  return {
    loading: st.status === "idle" || st.status === "loading",
    ready: st.status === "ok",
    error: st.status === "err" ? st.message : null,
    manifest: st.status === "ok" ? st.data : null,
    entryById,
    commanders: st.status === "ok" ? st.data.commanders : [],
    playable: st.status === "ok" ? st.data.playable : [],
  };
}

export function RenderManifestProvider({ children }: { children: ReactNode }) {
  const [manifestState, setManifestState] = useState<MState>(() => {
    if (resolvedManifest) return { status: "ok", data: resolvedManifest };
    if (resolvedError) return { status: "err", message: resolvedError };
    return { status: "idle" };
  });

  useEffect(() => {
    if (resolvedManifest) {
      setManifestState({ status: "ok", data: resolvedManifest });
      return;
    }
    if (resolvedError) {
      setManifestState({ status: "err", message: resolvedError });
      return;
    }

    const ctl = new AbortController();
    const hangMs = 18_000;
    const hangTimer = window.setTimeout(() => ctl.abort(), hangMs);
    let cancelled = false;

    setManifestState({ status: "loading" });

    fetch(MANIFEST_URL, { signal: ctl.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) {
          throw new Error(
            `Vault index ${r.status} at ${MANIFEST_URL} — run \`npm run dev\` from repo root; do not open dist/index.html via file://`
          );
        }
        return r.json() as Promise<RenderManifest>;
      })
      .then((json) => {
        if (cancelled) return;
        if (!json?.commanders || !json?.playable) {
          throw new Error("Vault index file is invalid.");
        }
        resolvedManifest = json;
        resolvedError = null;
        setManifestState({ status: "ok", data: json });
      })
      .catch((e) => {
        if (cancelled) return;
        const message =
          e instanceof DOMException && e.name === "AbortError"
            ? `Catalog timed out (${hangMs / 1000}s). Use the Vite dev URL (e.g. http://localhost:5173), not a raw HTML file.`
            : e instanceof Error
              ? e.message
              : "Could not load vault index.";
        resolvedError = message;
        setManifestState({ status: "err", message });
      })
      .finally(() => {
        window.clearTimeout(hangTimer);
      });

    return () => {
      cancelled = true;
      ctl.abort();
    };
  }, []);

  const value = useMemo(() => buildValue(manifestState), [manifestState]);

  return <ManifestContext.Provider value={value}>{children}</ManifestContext.Provider>;
}

export function useRenderManifest(): RenderManifestContextValue {
  const ctx = useContext(ManifestContext);
  if (ctx == null) {
    throw new Error("useRenderManifest must be used within <RenderManifestProvider> (see main.tsx).");
  }
  return ctx;
}
