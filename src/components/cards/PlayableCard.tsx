import type { RenderManifestEntry } from "../../types/renderManifest";
import { toUICardDisplay } from "../../presentation/uiCardModel";
import CardFrame from "./CardFrame";

export type PlayableCardMode = "hand" | "board" | "collection" | "modal";

export type PlayableChromeState =
  | "default"
  | "handFocus"
  | "boardAttacker"
  | "targetLegal"
  | "targetIllegal"
  | "combatDead"
  | "equipHint";

export type PlayableCardProps = {
  entry: RenderManifestEntry | null | undefined;
  mode: PlayableCardMode;
  attack?: number;
  health?: number;
  exhausted?: boolean;
  summoningSick?: boolean;
  chromeState?: PlayableChromeState;
  onClick?: () => void;
  className?: string;
};

const CHROME_MAP: Record<PlayableChromeState, string> = {
  default: "",
  handFocus: "crypt-card--hand-focus",
  boardAttacker: "crypt-card--board-attacker",
  targetLegal: "crypt-card--target-legal",
  targetIllegal: "crypt-card--target-illegal",
  combatDead: "crypt-card--combat-dead",
  equipHint: "crypt-card--equip-hint",
};

function UnknownShell({
  compact,
  onClick,
  className,
}: {
  compact: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <div
      className={[
        "crypt-card-chrome flex flex-col items-center justify-center border border-dashed border-white/10 bg-black/40 text-[color:var(--color-crypt-muted)]",
        compact ? "aspect-[3/4] min-h-[88px] text-[9px]" : "aspect-[3/4] text-xs",
        className ?? "",
      ].join(" ")}
    >
      —
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

export default function PlayableCard({
  entry,
  mode,
  attack,
  health,
  exhausted,
  summoningSick,
  chromeState = "default",
  onClick,
  className = "",
}: PlayableCardProps) {
  if (!entry) {
    return (
      <UnknownShell compact={mode === "board"} onClick={onClick} className={className} />
    );
  }

  const ui = toUICardDisplay(entry);

  const titleSize =
    mode === "modal" ? "text-sm" : mode === "collection" ? "text-[11px]" : "text-[10px]";
  const metaSize = mode === "modal" ? "text-[11px]" : "text-[9px]";
  const chromeExtra = CHROME_MAP[chromeState] ?? "";

  const art = (
    <>
      {ui.imageUrl ? (
        <img
          src={ui.imageUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          decoding="async"
          loading={mode === "collection" ? "lazy" : "eager"}
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-[#08080e] text-[9px] text-[color:var(--color-crypt-muted)]">
          ·
        </div>
      )}
      {(attack != null || health != null) && mode !== "collection" && (
        <div className="absolute bottom-1.5 left-1 right-1 z-[3] flex items-end justify-between gap-0.5">
          <div className="crypt-stat-gem flex-1 px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums">
            <span className="crypt-stat-gem-atk">{attack ?? "–"}</span>
            <span className="mx-0.5 text-white/25">|</span>
            <span className="crypt-stat-gem-hp">{health ?? "–"}</span>
          </div>
          {(exhausted || summoningSick) && (
            <div className="max-w-[52%] text-right font-mono text-[7px] font-semibold uppercase leading-tight tracking-wide text-amber-200/90">
              {exhausted ? "Spent" : ""}
              {exhausted && summoningSick ? " · " : ""}
              {summoningSick ? "Sick" : ""}
            </div>
          )}
        </div>
      )}
      {mode === "hand" && ui.cost != null && (
        <div className="crypt-cost-orb absolute left-1 top-1 z-[3] flex h-6 w-6 items-center justify-center font-mono text-[11px] font-bold text-[color:var(--color-crypt-ice)]">
          {ui.cost}
        </div>
      )}
    </>
  );

  const compactFooter = mode === "hand" || mode === "board";

  const footer = compactFooter ? (
    <div className="min-h-[1.6rem] px-1 py-0.5">
      <div
        className={[
          "truncate font-medium leading-tight tracking-tight text-[color:var(--color-crypt-text)]",
          mode === "hand" ? "text-[9px]" : "text-[8px]",
        ].join(" ")}
      >
        {ui.name}
      </div>
    </div>
  ) : (
    <div className="min-h-[2.25rem]">
      <div
        className={[
          "truncate font-semibold leading-tight tracking-tight text-[color:var(--color-crypt-text)]",
          titleSize,
        ].join(" ")}
      >
        {ui.name}
      </div>
      <div
        className={[
          "mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[color:var(--color-crypt-muted)]",
          metaSize,
        ].join(" ")}
      >
        <span className="uppercase tracking-wider">{ui.role}</span>
        {ui.faction !== "—" && <span>{ui.faction}</span>}
      </div>
    </div>
  );

  const widthClasses =
    mode === "modal"
      ? "w-[min(100%,280px)]"
      : mode === "collection"
        ? "w-full"
        : mode === "hand"
          ? "w-[138px] sm:w-[156px]"
          : "w-[104px] sm:w-[112px]";

  const frame = (
    <CardFrame
      commander={false}
      faction={ui.faction !== "—" ? ui.faction : undefined}
      rarity={ui.rarityLabel ?? undefined}
      chromeStateClass={chromeExtra}
      art={art}
      footer={footer}
      className={[
        mode === "modal" ? "!rounded-sm" : "",
        mode === "hand" || mode === "board" ? "crypt-card-tactical" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );

  return (
    <div className={[widthClasses, "transition-transform duration-200", className].join(" ")}>
      {onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-left">
          {frame}
        </button>
      ) : (
        frame
      )}
    </div>
  );
}
