import type { CSSProperties } from "react";

import type { Filmstrip } from "@/lib/easy-peasy-ease/car-clips";
import { cn } from "@/lib/utils";

/**
 * One tile of a one-row filmstrip sprite, cover-cropped into its box (the
 * baked stand-in for the product's extractVideoThumbnail). The box must have
 * a definite size; it becomes a size container so the crop is pure CSS.
 */
export function FilmstripFrame({
  strip,
  index,
  className,
}: {
  strip: Filmstrip;
  index: number;
  className?: string;
}) {
  const tile = `max(100cqw, calc(100cqh * ${strip.aspect}))`;
  const style = {
    "--epe-tile-w": tile,
    position: "absolute",
    width: `calc(var(--epe-tile-w) * ${strip.frames})`,
    height: `calc(var(--epe-tile-w) / ${strip.aspect})`,
    left: `calc((100cqw - var(--epe-tile-w)) / 2 - var(--epe-tile-w) * ${index})`,
    top: `calc((100cqh - var(--epe-tile-w) / ${strip.aspect}) / 2)`,
    backgroundImage: `url(${strip.src})`,
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ containerType: "size" }}
    >
      <div style={style} />
    </div>
  );
}
