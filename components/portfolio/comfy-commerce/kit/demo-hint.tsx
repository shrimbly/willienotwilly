import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CcHintCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// 16px in: clear of the page tile's 32/40px squircle corners.
const CORNERS: Record<CcHintCorner, string> = {
  "top-left": "top-4 left-4 text-left",
  "top-right": "top-4 right-4 text-right",
  "bottom-left": "bottom-4 left-4 text-left",
  "bottom-right": "bottom-4 right-4 text-right",
};

/**
 * The "how to try it" line for a Comfy Commerce tile, in the product's own
 * muted voice: 14px Geist in ink-faint, sentence case, as the product writes
 * its quiet lines ("1 of 4", "Private, local, review-gated."). It has no
 * uppercase eyebrow style, so neither does this.
 *
 * Absolute in a corner by default (16px in, z-[5], under z-10 chrome); pass
 * `corner={null}` to place it in flow yourself. Decorative (aria-hidden, no
 * pointer events): say the same in the demo's sr-only instructions. Fade it
 * with `hidden` once the visitor has tried the demo, and always in a listing
 * thumbnail (useDemoThumbnail()).
 */
export function CcHint({
  children,
  corner = "bottom-left",
  hidden = false,
  className,
  style,
}: {
  children: ReactNode;
  corner?: CcHintCorner | null;
  hidden?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      data-demo-hint={corner ?? "inline"}
      style={style}
      className={cn(
        "pointer-events-none text-sm text-(--ink-faint) select-none",
        "transition-opacity duration-500 ease-out motion-reduce:transition-none",
        corner && "absolute z-[5] max-w-[calc(100%-32px)]",
        corner && CORNERS[corner],
        hidden && "opacity-0",
        className,
      )}
    >
      {children}
    </span>
  );
}
