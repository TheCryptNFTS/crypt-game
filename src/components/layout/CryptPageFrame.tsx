import type { ReactNode } from "react";

export type CryptPageFrameProps = {
  eyebrow: string;
  title: string;
  /** Short truth line under title; keep honest about alpha / device scope */
  lead?: ReactNode;
  children: ReactNode;
};

/** Shared page hierarchy — matches Home / Match Results rhythm (not generic dashboard headers). */
export function CryptPageFrame({ eyebrow, title, lead, children }: CryptPageFrameProps) {
  return (
    <div className="crypt-shell-page">
      <div className="crypt-shell-accent" aria-hidden />
      <div className="crypt-shell-inner">
        <header className="crypt-shell-head">
          <p className="crypt-shell-kicker">{eyebrow}</p>
          <h1 className="crypt-shell-title">{title}</h1>
          {lead && <p className="crypt-shell-lead">{lead}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}
