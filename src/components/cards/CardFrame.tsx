import type { RenderManifestEntry } from "../../types/renderManifest";

type CardFrameProps = {
  entry: RenderManifestEntry | null | undefined;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
};

export default function CardFrame({
  entry,
  onClick,
  className = "",
  compact = false,
}: CardFrameProps) {
  if (!entry) {
    return (
      <div
        className={`rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 text-zinc-500 ${className}`}
      >
        <div className={compact ? "p-2 text-xs" : "p-4 text-sm"}>Unknown card</div>
      </div>
    );
  }

  const isCommander = entry.role === "commander";
  const padding = compact ? "p-2" : "p-3";
  const titleSize = compact ? "text-xs" : "text-sm";

  const shellClass = [
    "w-full rounded-lg border text-left transition-colors",
    "border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)]",
    onClick
      ? "hover:border-[color:var(--color-crypt-accent)]/50 hover:shadow-[0_0_0_1px_rgba(212,175,55,0.12)] cursor-pointer"
      : "cursor-default",
    className,
  ].join(" ");

  const inner = (
    <div
      className={`flex gap-2 ${padding} ${compact ? "flex-col" : "flex-col sm:flex-row sm:items-start"}`}
    >
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
            alt=""
            className={
              compact
                ? "mx-auto h-16 w-full max-w-[4.5rem] rounded object-cover"
                : "mx-auto h-24 w-full max-w-28 rounded-md object-cover sm:mx-0"
            }
          />
        ) : (
          <div
            className={
              compact
                ? "mx-auto flex h-16 w-full max-w-[4.5rem] items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500"
                : "mx-auto flex h-24 w-full max-w-28 items-center justify-center rounded-md bg-zinc-800 text-xs text-zinc-500 sm:mx-0"
            }
          >
            No art
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className={`font-semibold leading-snug text-zinc-100 ${titleSize}`}>
              {entry.name}
            </span>
            <span
              className={[
                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                isCommander
                  ? "bg-amber-950/80 text-[color:var(--color-crypt-accent)]"
                  : "bg-sky-950/60 text-[color:var(--color-crypt-ice)]",
              ].join(" ")}
            >
              {entry.role}
            </span>
          </div>
          {!compact && (
            <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-500">
              <span>{entry.faction}</span>
              {entry.cost != null && <span>Cost {entry.cost}</span>}
              {entry.rarity && <span>{entry.rarity}</span>}
            </div>
          )}
        </div>
      </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shellClass}>
        {inner}
      </button>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}
