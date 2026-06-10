import type { ReactNode } from "react";

type CatalogLoaderProps = {
  loading: boolean;
  error: string | null;
  ready: boolean;
  children: ReactNode;
};

/**
 * Shared gate while `renderManifest.json` is fetched (large file — not bundled in JS).
 * Teardown §7: this is PLAYER-FACING copy — it used to print npm commands and repo
 * paths to whoever hit a slow connection. Dev diagnostics now live in a console
 * line only; players get plain words and a retry.
 */
export function CatalogLoader({ loading, error, ready, children }: CatalogLoaderProps) {
  if (error) {
    if (import.meta.env.DEV) {
      // Dev-only diagnostic (stripped from prod builds): the usual cause is a
      // missing public/data/renderManifest.json — `npm run assets:build-manifest`.
      console.warn("[CatalogLoader]", error, "— check public/data/renderManifest.json (npm run assets:build-manifest)");
    }
    return (
      <div className="flex min-h-[min(480px,calc(100dvh-80px))] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md font-mono text-sm text-red-300/95">
          The card archive didn&apos;t load.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-[color:var(--color-crypt-border)] px-4 py-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[color:var(--color-crypt-accent)]"
        >
          Try again
        </button>
      </div>
    );
  }
  if (loading || !ready) {
    return (
      <div className="flex min-h-[min(480px,calc(100dvh-80px))] flex-col items-center justify-center gap-2 px-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--color-crypt-border)] border-t-[color:var(--color-crypt-accent)]" />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-crypt-muted)]">
          Opening the archive…
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
