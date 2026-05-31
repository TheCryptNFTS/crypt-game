import React from "react";

type Props = {
  log: { id: string; text: string }[];
};

export function CombatLogPanel({ log }: Props) {
  return (
    <section className="live-side-panel">
      <h3>Combat Log</h3>
      <div className="live-log">
        {log.map((entry) => (
          <div key={entry.id} className="live-log__entry">
            {entry.text}
          </div>
        ))}
      </div>
    </section>
  );
}
