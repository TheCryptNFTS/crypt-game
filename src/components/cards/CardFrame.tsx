import type { ReactNode } from "react";
import { factionEdgeStyle, rarityStripClass } from "./cardVisuals";

export type CardFrameProps = {
  commander?: boolean;
  faction?: string;
  rarity?: string;
  interactive?: boolean;
  /** Extra state classes on chrome root (combat, hand focus, etc.) */
  chromeStateClass?: string;
  className?: string;
  art: ReactNode;
  footer: ReactNode;
};

export default function CardFrame({
  commander,
  faction,
  rarity,
  interactive,
  chromeStateClass = "",
  className = "",
  art,
  footer,
}: CardFrameProps) {
  return (
    <div
      className={[
        "crypt-card-chrome relative flex flex-col overflow-hidden",
        commander ? "crypt-card-chrome-commander" : "",
        interactive ? "crypt-card-interactive cursor-pointer" : "",
        chromeStateClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {commander && <div className="crypt-commander-crest" aria-hidden />}
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-[2px]"
        style={factionEdgeStyle(faction)}
        aria-hidden
      />
      <div
        className={[
          "crypt-card-art relative w-full shrink-0",
          commander ? "crypt-card-art-commander crypt-card-art-commander-aspect" : "aspect-[3/4]",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {art}
      </div>
      <div
        className={[
          "relative z-20 shrink-0 border-t border-white/[0.06]",
          commander ? "crypt-commander-footer-sill" : "bg-[#0a0a12]",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={["h-[3px] w-full", rarityStripClass(rarity)].join(" ")} aria-hidden />
        <div className={commander ? "px-2 py-1.5" : "px-1.5 py-1"}>{footer}</div>
      </div>
    </div>
  );
}
