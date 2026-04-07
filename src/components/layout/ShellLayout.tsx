import AppShell from "./AppShell";

/**
 * Main chrome (nav + outlet). Splash at `/` is the intentional entry; this layout must not redirect based on
 * session reads — storage quirks + navigation timing made that feel like a “frozen” app that never updates.
 */
export default function ShellLayout() {
  return <AppShell />;
}
