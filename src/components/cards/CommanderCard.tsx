import type { RenderManifestEntry } from "../../types/renderManifest";
import { toUICardDisplay } from "../../presentation/uiCardModel";
import CardFrame from "./CardFrame";

export type CommanderScale = "dominant" | "table";

export type CommanderCardProps = {
  entry: RenderManifestEntry | null | undefined;
  scale?: CommanderScale;
  /** Match-only relic framing; omit in deck/collection */
  variant?: "match" | "catalog";
  onClick?: () => void;
  className?: string;
};

export default function CommanderCard({
  entry,
  scale = "table",
  variant = "catalog",
  onClick,
  className = "",
}: CommanderCardProps) {
  if (!entry) {
    const shell = (
      <div
        className={[
          "crypt-card-chrome-commander flex items-center justify-center border border-dashed border-[color:var(--color-crypt-border)] bg-black/30 text-[color:var(--color-crypt-muted)]",
          scale === "dominant" ? "aspect-[4/5] max-w-[248px] text-xs" : "aspect-[3/4] max-w-[140px] text-[10px]",
          className,
        ].join(" ")}
      >
        —
      </div>
    );
    return onClick ? (
      <button type="button" className="block text-left" onClick={onClick}>
        {shell}
      </button>
    ) : (
      shell
    );
  }

  const ui = toUICardDisplay(entry);

  const art = ui.imageUrl ? (
    <img
      src={ui.imageUrl}
      alt=""
      draggable={false}
      referrerPolicy="no-referrer"
      decoding="async"
      loading={variant === "match" && scale === "dominant" ? "eager" : "lazy"}
    />
  ) : (
    <div className="flex h-full items-center justify-center bg-[#050508] text-[color:var(--color-crypt-muted)]">
      ·
    </div>
  );

  const footer =
    variant === "match" && scale === "dominant" ? (
      <div className="px-2 py-1">
        <div className="truncate text-[12px] sm:text-[13px] font-semibold leading-snug tracking-tight text-[color:var(--color-crypt-text)]">
          {ui.name}
        </div>
      </div>
    ) : (
      <div className={scale === "dominant" ? "py-0.5" : ""}>
        <div
          className={[
            "font-semibold uppercase tracking-[0.14em] text-[color:var(--color-crypt-accent)]",
            scale === "dominant" ? "text-[10px] sm:text-[11px]" : "text-[9px] sm:text-[10px]",
          ].join(" ")}
        >
          Commander
        </div>
        <div
          className={[
            "mt-0.5 truncate font-semibold leading-tight tracking-tight text-[color:var(--color-crypt-text)]",
            scale === "dominant" ? "text-[13px] sm:text-[15px]" : "text-[10px] sm:text-[11px]",
          ].join(" ")}
        >
          {ui.name}
        </div>
        {ui.faction !== "—" && (
          <div className="mt-0.5 font-mono text-[9px] tracking-wide text-[color:var(--color-crypt-muted)]">
            {ui.faction}
          </div>
        )}
      </div>
    );

  const matchRelic = variant === "match" && scale === "dominant";

  const frame = (
    <CardFrame
      commander
      faction={ui.faction !== "—" ? ui.faction : undefined}
      rarity={ui.rarityLabel ?? "commander"}
      art={art}
      footer={footer}
      className={[
        scale === "dominant"
          ? "shadow-[var(--shadow-commander)] max-w-[248px] sm:max-w-[264px]"
          : "max-w-[140px] sm:max-w-[150px]",
        matchRelic ? "crypt-commander-relic-soul" : "",
        className,
      ].join(" ")}
    />
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block text-left">
        {frame}
      </button>
    );
  }

  return frame;
}
