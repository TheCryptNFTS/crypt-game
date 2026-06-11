import { Children, Fragment, isValidElement } from "react";
import type { ReactNode } from "react";
import {
  factionEdgeStyle,
  factionVarStyle,
  foilClass,
  rarityGemClass,
} from "./cardVisuals";
import LazyImage from "../LazyImage";
import "../../styles/polish-cards.css";

/**
 * If the art node is the raw <img> the card components hand us, transparently
 * route it through LazyImage (lazy/async decode, fade-in, seadn CDN downscale)
 * while preserving every prop so the .crypt-card-art img CSS still applies.
 * Any non-<img> art (placeholder div, overlays fragment) passes through as-is.
 */
function swapImg(node: ReactNode): ReactNode {
  if (isValidElement(node) && node.type === "img") {
    const { src, ...imgProps } = node.props as Record<string, unknown>;
    return <LazyImage src={src as string | undefined} cdnWidth={320} {...imgProps} />;
  }
  return node;
}

function enhanceArt(art: ReactNode): ReactNode {
  // CommanderCard hands us the <img> directly; PlayableCard wraps it in a
  // Fragment alongside stat/cost overlays. Handle both, leaving overlays intact.
  if (isValidElement(art) && art.type === Fragment) {
    const children = Children.map(
      (art.props as { children?: ReactNode }).children,
      swapImg,
    );
    return <>{children}</>;
  }
  return swapImg(art);
}

/**
 * Punch #23 — rarity → frame-escalation class (Snap/Hearthstone rarity ladder).
 * Common returns "" (the current frame IS the common frame). The classes are
 * styled twice: polish-cards.css scopes them to .crypt-card-premium (binder /
 * vault / modal tiles) and crypt-match.css scopes them to .crypt-card (live
 * BoardCard/HandCard), so one mapping drives both surfaces.
 */
export function rarityFrameClass(rarity: string | null | undefined): string {
  const r = (rarity ?? "").trim().toLowerCase();
  if (
    r === "mythic" ||
    r === "god" ||
    r.includes("one of") ||
    r.includes("one_of") ||
    r.includes("one-of")
  ) {
    return "crypt-rframe--mythic";
  }
  if (r === "legendary") return "crypt-rframe--legendary";
  if (r === "epic") return "crypt-rframe--epic";
  if (r === "rare") return "crypt-rframe--rare";
  return "";
}

/** Match VMs (PlayCardVM) only carry rarity inside the raw trait map. */
export function rarityFrameClassFromTraits(
  traits: Record<string, string> | null | undefined,
): string {
  return rarityFrameClass(traits?.["Rarity"] ?? traits?.["rarity"]);
}

export type CardFrameProps = {
  commander?: boolean;
  faction?: string;
  rarity?: string;
  interactive?: boolean;
  /** Renders the cursor-shine overlay consumed by useCardTilt's --mx/--my/--glare vars. */
  shine?: boolean;
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
  shine,
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
        rarityFrameClass(rarity),
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
      {shine && <span className="crypt-card-shine" aria-hidden />}
      <div
        className={[
          "crypt-card-art relative aspect-square w-full shrink-0",
          commander ? "crypt-card-art-commander" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {enhanceArt(art)}
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
