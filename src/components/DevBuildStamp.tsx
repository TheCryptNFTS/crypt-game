import { useRenderManifest } from "../hooks/useRenderManifest";

/** Visible only in Vite dev — proves new JS is running and whether the card catalog hook is live. */
function DevBuildStampInner() {
  const { ready, error, loading } = useRenderManifest();
  const catalog =
    error != null
      ? `catalog: ${error.length > 48 ? `${error.slice(0, 48)}…` : error}`
      : ready
        ? "catalog: ok"
        : loading
          ? "catalog: loading"
          : "catalog: idle";

  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 99999,
        padding: "6px 10px",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
        lineHeight: 1.35,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "rgba(233, 201, 132, 0.95)",
        background: "rgba(8, 7, 8, 0.92)",
        border: "1px solid rgba(233, 201, 132, 0.35)",
        borderRadius: 2,
        pointerEvents: "none",
        maxWidth: "min(92vw, 360px)",
        textAlign: "right" as const,
      }}
    >
      <div>crypt · vite dev · {import.meta.env.MODE}</div>
      <div style={{ opacity: 0.88 }}>{catalog}</div>
    </div>
  );
}

export default function DevBuildStamp() {
  // Dev-only AND opt-in (?stamp in the URL). It never ships to prod, and it no
  // longer clutters every dev view / screenshot — add ?stamp to summon it when
  // you actually need to confirm new JS + catalog state.
  if (!import.meta.env.DEV) return null;
  if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("stamp")) {
    return null;
  }
  return <DevBuildStampInner />;
}
