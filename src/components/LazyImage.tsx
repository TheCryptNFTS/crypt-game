import { useState } from "react";
import type { ImgHTMLAttributes } from "react";

/**
 * Drop-in <img> wrapper tuned for the thousands-of-NFTs grid.
 *
 * - loading="lazy" + decoding="async" keep off-screen art off the main thread.
 * - A cheap placeholder background fills the (already aspect-square) art box
 *   until the bitmap paints, so empty cells read as "loading" not "broken".
 * - On load we fade opacity 0 -> 1 (no layout work, GPU-only).
 * - seadn.io serves arbitrary downscales via a `w=` query param, so for grid
 *   thumbnails we request a smaller variant to cut transferred bytes. The
 *   on-disk CSS (.crypt-card-art img { object-fit: cover }) still governs
 *   layout because we render a plain <img> with no inline sizing overrides.
 *
 * Browser-safe: no Node APIs, no SSR-only globals.
 */

export type LazyImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "loading"> & {
  /** Target CSS-pixel width for a downscaled seadn.io variant (grid thumbs). */
  cdnWidth?: number;
  /** Placeholder fill shown behind the image until it paints. */
  placeholderColor?: string;
};

const SEADN_HOST = "seadn.io";

/** Append/normalize a `w=` width param on a seadn.io URL; pass others through. */
function withSeadnWidth(src: string | undefined, width?: number): string | undefined {
  if (!src || !width) return src;
  try {
    const url = new URL(src, "https://seadn.io");
    if (!url.hostname.endsWith(SEADN_HOST)) return src;
    // Only shrink: never upscale past what the CDN already serves.
    const existing = Number(url.searchParams.get("w"));
    if (!existing || existing > width) {
      url.searchParams.set("w", String(width));
      url.searchParams.set("auto", url.searchParams.get("auto") ?? "format");
    }
    return url.toString();
  } catch {
    return src;
  }
}

export default function LazyImage({
  src,
  cdnWidth,
  placeholderColor = "#08080e",
  style,
  onLoad,
  ...rest
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const resolvedSrc = withSeadnWidth(typeof src === "string" ? src : undefined, cdnWidth);

  return (
    <img
      {...rest}
      src={resolvedSrc}
      loading="lazy"
      decoding="async"
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      style={{
        backgroundColor: placeholderColor,
        opacity: loaded ? 1 : 0,
        transition: "opacity 320ms ease",
        ...style,
      }}
    />
  );
}
