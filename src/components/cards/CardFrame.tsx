import type { ReactNode } from "react";
import {
  factionEdgeStyle,
  factionVarStyle,
  foilClass,
  rarityGemClass,
} from "./cardVisuals";
import "../../styles/polish-cards.css";

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
  const foil = foilClass(rarity, commander);
  return (
    <div
      className={[
        "crypt-card-chrome crypt-card-premium relative flex flex-col overflow-hidden",
        commander ? "crypt-card-chrome-commander" : "",
        interactive ? "crypt-card-interactive cursor-pointer" : "",
        chromeStateClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={factionVarStyle(faction)}
    >
      {commander && <div className="crypt-commander-crest" aria-hidden />}
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-[2px]"
        style={factionEdgeStyle(faction)}
        aria-hidden
      />
      {foil && <div className={foil} aria-hidden />}
      <div
        className={[
          "crypt-card-art relative aspect-square w-full shrink-0",
          commander ? "crypt-card-art-commander" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {art}
      </div>
      <div
        className={[
          "crypt-footer-sill relative z-20 shrink-0 border-t border-white/[0.06]",
          commander ? "crypt-commander-footer-sill" : "bg-[#0a0a12]",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={rarityGemClass(rarity, commander)} aria-hidden />
        <div className={commander ? "px-2 py-1.5" : "px-1.5 py-1"}>{footer}</div>
      </div>
    </div>
  );
}
