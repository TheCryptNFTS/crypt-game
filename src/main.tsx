import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/card-readability.css";
import "./styles/a11y.css";
import App from "./App";
import { RootBoundary } from "./components/RootBoundary";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import DevBuildStamp from "./components/DevBuildStamp";
import { RenderManifestProvider } from "./hooks/useRenderManifest";
import { initPalette } from "./a11y/palette";
import { router } from "./router";
import { trackRouterPageviews } from "./lib/analytics";
import { trackReturnVisit } from "./lib/funnel";

// Apply the persisted colorblind-safe palette preference before first paint (A6 a11y).
initPalette();

// Privacy-safe route analytics: subscribe the data router to deduped pageviews
// (path only — query + hash are stripped in analytics). No router edits needed.
trackRouterPageviews(router);

// FTUE funnel (teardown P2): fire d1_return once if this device first visited
// on an earlier calendar day. PII-free; deduped in localStorage.
trackReturnVisit();

const el = document.getElementById("root");
if (!el) {
  throw new Error("#root missing — index.html must contain <div id=\"root\"></div>");
}

if (import.meta.env.DEV) {
  document.title = "CRYPT · dev";
}

ReactDOM.createRoot(el).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <RootBoundary>
        <RenderManifestProvider>
          <App />
          <DevBuildStamp />
        </RenderManifestProvider>
      </RootBoundary>
    </RootErrorBoundary>
  </React.StrictMode>
);
