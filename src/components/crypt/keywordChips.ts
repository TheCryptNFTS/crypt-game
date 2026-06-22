/**
 * Shared keyword-chip model for the on-card chips shown on BOTH the board
 * (BoardCard) and now the HAND (HandCard). Holder feedback (NikoDaTroof, 2026-06-17):
 * "my cards still only display #'s, I need to know if I'm playing a GUARD, FLY etc.
 * before I play the card." The hand card showed stats but no keywords — fixed by
 * reusing this exact model so a player can read GUARD/FLYING/etc. before committing.
 *
 * Combat keywords that change how you TARGET or TRADE — the ones a player must read to
 * play correctly. Ordered by decision impact (GUARD first). `label` is the short
 * on-card token; `full` is the tooltip/aria sentence so the rule is learnable.
 */
export const KW_DISPLAY: Record<string, { label: string; full: string; pri: number; guard?: boolean }> = {
  GUARD: { label: "GUARD", full: "Guard — enemies must attack this first", pri: 0, guard: true },
  TAUNT: { label: "GUARD", full: "Guard — enemies must attack this first", pri: 0, guard: true },
  STEALTH: { label: "STEALTH", full: "Stealth — can't be attacked or targeted", pri: 1 },
  FLYING: { label: "FLYING", full: "Flying — only Flying or Ranged units can hit it", pri: 1 },
  DIVINE_SHIELD: { label: "SHIELD", full: "Divine Shield — blocks the first hit", pri: 2 },
  WARD: { label: "WARD", full: "Ward — blocks the first hit", pri: 2 },
  SHIELD: { label: "SHIELD", full: "Shield — blocks the first hit", pri: 2 },
  LIFESTEAL: { label: "LIFE", full: "Lifesteal — heals your Nexus when it deals damage", pri: 3 },
  DEATHRATTLE: { label: "RATTLE", full: "Deathrattle — triggers an effect when it dies", pri: 3 },
  EXECUTE: { label: "EXECUTE", full: "Execute — destroys any unit it damages", pri: 3 },
  CRUSH: { label: "CRUSH", full: "Crush — excess damage carries to the Nexus", pri: 4 },
  REGROW: { label: "REGROW", full: "Regrow — heals back up each turn", pri: 4 },
  RUSH: { label: "RUSH", full: "Rush — can attack the turn it's played", pri: 4 },
};

export const KW_MAX = 3;

export type VisibleKeyword = { raw: string; d: (typeof KW_DISPLAY)[string] };

export function visibleKeywords(keywords: string[]): { shown: VisibleKeyword[]; overflow: number } {
  const seen = new Set<string>();
  const mapped = keywords
    .map((k) => ({ raw: k, d: KW_DISPLAY[k] }))
    .filter((x): x is VisibleKeyword => !!x.d)
    .filter((x) => (seen.has(x.d.label) ? false : (seen.add(x.d.label), true)))
    .sort((a, b) => a.d.pri - b.d.pri);
  return { shown: mapped.slice(0, KW_MAX), overflow: Math.max(0, mapped.length - KW_MAX) };
}
