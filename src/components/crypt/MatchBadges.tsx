import React from "react";
import { CryptFaction, SyncLevel } from "../../ui/cryptTypes";
import { factionTheme, syncTheme } from "../../ui/cryptTheme";

type FactionBadgeProps = {
  faction: CryptFaction;
};

export function FactionBadge({ faction }: FactionBadgeProps) {
  const theme = factionTheme[faction];

  return (
    <span
      className="crypt-badge crypt-badge--faction"
      style={{
        borderColor: theme.edge,
        background: theme.chip,
        color: theme.edge
      }}
    >
      {theme.label}
    </span>
  );
}

type SyncBadgeProps = {
  level: SyncLevel;
  label?: string;
};

export function SyncBadge({ level, label }: SyncBadgeProps) {
  const theme = syncTheme[level];

  return (
    <span
      className="crypt-badge crypt-badge--sync"
      style={{
        borderColor: theme.border,
        background: theme.bg,
        color: theme.tone
      }}
    >
      {label ?? theme.label}
    </span>
  );
}

type RarityBadgeProps = {
  label: string;
};

export function RarityBadge({ label }: RarityBadgeProps) {
  return <span className="crypt-badge crypt-badge--rarity">{label}</span>;
}
