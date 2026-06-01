import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/card-readability.css";
import App from "./App";
import { RootBoundary } from "./components/RootBoundary";
import DevBuildStamp from "./components/DevBuildStamp";
import { RenderManifestProvider } from "./hooks/useRenderManifest";

const el = document.getElementById("root");
if (!el) {
  throw new Error("#root missing — index.html must contain <div id=\"root\"></div>");
}

if (import.meta.env.DEV) {
  document.title = "CRYPT · Crypt Legends · dev";
}

ReactDOM.createRoot(el).render(
  <React.StrictMode>
    <RootBoundary>
      <RenderManifestProvider>
        <App />
        <DevBuildStamp />
      </RenderManifestProvider>
    </RootBoundary>
  </React.StrictMode>
);
