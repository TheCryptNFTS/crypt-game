import React from "react";

/**
 * In-app confirmation modal — the on-brand, non-blocking replacement for
 * `window.confirm()`. The native dialog froze the render thread, looked alien
 * on mobile, and ignored the game's theme. This mirrors the OnboardingGate
 * interstitial: fixed overlay, role=dialog, Escape to cancel, focus on confirm.
 *
 * Destructive actions (Reset Match, Concede) pass tone="danger" for a red
 * confirm button; everything else gets the gold brand button.
 */
type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const danger = tone === "danger";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(4,4,6,0.82)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 420,
          width: "calc(100% - 40px)",
          padding: "26px 22px",
          borderRadius: 16,
          background: "rgba(11, 11, 13, 0.98)",
          border: `1px solid ${danger ? "#C8643D" : "#C8A75D"}`,
          boxShadow: `0 0 36px ${danger ? "rgba(200,100,61,0.4)" : "rgba(200,167,93,0.4)"}`,
          color: "#F5F2E8",
          textAlign: "center",
        }}
      >
        <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>{title}</h2>
        <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "#d6d0c2" }}>
          {body}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            style={{
              appearance: "none",
              cursor: "pointer",
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: danger
                ? "linear-gradient(180deg, #C8643D, #E08A5A)"
                : "linear-gradient(180deg, #C8A75D, #E9C984)",
              color: "#060507",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              appearance: "none",
              cursor: "pointer",
              padding: "11px 16px",
              borderRadius: 12,
              border: "1px solid rgba(200,167,93,0.4)",
              background: "transparent",
              color: "#E9C984",
              fontSize: 14,
              letterSpacing: "0.04em",
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
