import type { ReactNode } from "react";
import React from "react";

type S = { error: Error | null };

/** Surfaces runtime failures instead of a blank root. */
export class RootBoundary extends React.Component<{ children: ReactNode }, S> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): S {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: 24,
            background: "#0a0808",
            color: "#f5f2ee",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          <p style={{ color: "#f87171", marginTop: 0 }}>CRYPT crashed during render</p>
          <p>{this.state.error.message}</p>
          <p style={{ opacity: 0.6 }}>Open DevTools → Console for the stack. Then hard-refresh (⌘⇧R).</p>
        </div>
      );
    }
    return this.props.children;
  }
}
