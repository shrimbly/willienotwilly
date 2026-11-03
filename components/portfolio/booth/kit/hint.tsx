import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BoothHintCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// 16px: clear of the page tile's 32px squircle corners, as the other products' hints sit.
const CORNERS: Record<BoothHintCorner, string> = {
  "top-left": "top-4 left-4 text-left",
  "top-right": "top-4 right-4 text-right",
  "bottom-left": "bottom-4 left-4 text-left",
  "bottom-right": "bottom-4 right-4 text-right",
};

export interface BoothHintProps {
  /** What to try, in a few words of sentence case ("Drag the file to the menu bar"). */
  children: ReactNode;
  corner?: BoothHintCorner;
  /** Fade it out once the visitor has tried it, and on a listing thumbnail. */
  hidden?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * The "how to try it" line in Booth's own voice: the website's hint under its player ("Hold ⌥
 * for the original"), 12/16 SF in the site's muted grey, sentence case. Decorative
 * (aria-hidden, no pointer events): each demo says the same in its sr-only instructions.
 */
export function BoothHint({ children, corner = "bottom-left", hidden = false, className, style }: BoothHintProps) {
  return (
    <span
      aria-hidden
      data-demo-hint={corner}
      style={style}
      className={cn(
        "pointer-events-none absolute z-[5] max-w-[calc(100%-32px)] font-(family-name:--booth-sans) text-[12px] leading-4 font-normal tracking-normal text-(color:--booth-muted) select-none",
        "transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
        CORNERS[corner],
        hidden && "translate-y-[3px] opacity-0",
        className,
      )}
    >
      {children}
    </span>
  );
}
