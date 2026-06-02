/**
 * ROOT ERROR BOUNDARY — the last line of defence against a render crash.
 *
 * Catches any error thrown during render in the subtree, reports it through the
 * privacy-safe analytics pipeline (message + name + a "boundary" tag, NO PII),
 * and shows an on-brand "Signal lost" fallback with a reload button instead of
 * a blank screen. This complements the dev-oriented RootBoundary; this one is
 * production-facing and wired to analytics.
 */

import type { ErrorInfo, ReactNode } from "react";
import React from "react";
import { reportError } from "../lib/analytics";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class RootErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Report through analytics. We pass only the component-stack length as a
    // coarse signal — never the stack text itself, which can carry paths.
    try {
      reportError(error, {
        boundary: "root",
        componentStackDepth: (info.componentStack ?? "").split("\n").length,
      });
    } catch {
      /* analytics must never turn a render crash into a second crash */
    }
  }

  private handleReload = (): void => {
    try {
      if (typeof window !== "undefined") window.location.reload();
    } catch {
      /* ignore — button is best-effort */
    }
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 32,
          textAlign: "center",
          background: "radial-gradient(120% 120% at 50% 0%, #14101c 0%, #0a0810 60%, #060409 100%)",
          color: "#f5f2ee",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: 44,
            letterSpacing: 6,
            color: "#a78bfa",
            textShadow: "0 0 18px rgba(167,139,250,0.55)",
          }}
        >
          ⬡
        </div>
        <h1 style={{ margin: 0, fontSize: 22, color: "#f5f2ee", letterSpacing: 1 }}>
          Signal lost — something broke
        </h1>
        <p style={{ margin: 0, maxWidth: 420, opacity: 0.7, fontSize: 13, lineHeight: 1.6 }}>
          The interface hit an unexpected fault and stopped rendering. Reloading
          re-establishes the connection. If it keeps happening, try again shortly.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: 6,
            padding: "10px 22px",
            fontFamily: "inherit",
            fontSize: 13,
            letterSpacing: 1,
            color: "#0a0810",
            background: "linear-gradient(180deg, #d4b24c 0%, #b8902e 100%)",
            border: "1px solid #e6c75e",
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(184,144,46,0.35)",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

export default RootErrorBoundary;
