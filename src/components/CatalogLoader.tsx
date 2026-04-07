import type { ReactNode } from "react";

type CatalogLoaderProps = {
  loading: boolean;
  error: string | null;
  ready: boolean;
  children: ReactNode;
};

/**
 * Shared gate while `renderManifest.json` is fetched (large file — not bundled in JS).
 */
export function CatalogLoader({ loading, error, ready, children }: CatalogLoaderProps) {
  if (error) {
    return (
      <div className="flex min-h-[min(480px,calc(100dvh-80px))] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md font-mono text-sm text-red-300/95">{error}</p>
        <p className="max-w-md font-mono text-[11px] leading-relaxed text-[color:var(--color-crypt-muted)]">
          Ensure <code className="text-[color:var(--color-crypt-ice)]">public/data/renderManifest.json</code> exists.
          Run <code className="text-[color:var(--color-crypt-ice)]">npm run assets:build-manifest</code> if needed.
        </p>
      </div>
    );
  }
  if (loading || !ready) {
    return (
      <div className="flex min-h-[min(480px,calc(100dvh-80px))] flex-col items-center justify-center gap-2 px-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--color-crypt-border)] border-t-[color:var(--color-crypt-accent)]" />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-crypt-muted)]">
          Opening vault index…
        </p>
        <p className="max-w-md font-mono text-[10px] leading-relaxed text-[color:var(--color-crypt-muted)]">
          If this never finishes: run <code className="text-[color:var(--color-crypt-ice)]">npm run dev</code> from the
          repo root (not a raw HTML file), and ensure{" "}
          <code className="text-[color:var(--color-crypt-ice)]">public/data/renderManifest.json</code> exists.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
