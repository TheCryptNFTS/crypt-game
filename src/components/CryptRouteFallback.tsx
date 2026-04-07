/** Shown while lazy route chunks load. */
export default function CryptRouteFallback() {
  return (
    <div className="crypt-route-fallback" aria-busy="true" aria-live="polite">
      <div className="crypt-route-fallback-spin" aria-hidden />
      <p className="crypt-route-fallback-label">Entering the Crypt…</p>
    </div>
  );
}
