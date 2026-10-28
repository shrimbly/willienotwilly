import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DemoHintCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface DemoHintProps {
  /** What to try, in a few words ("Drag a node"); drawn uppercase. */
  children: ReactNode;
  /** The tile corner it sits in, 12px in from both edges (default bottom-left). */
  corner?: DemoHintCorner;
  /** Fade it out, e.g. once the visitor has tried it. */
  hidden?: boolean;
  className?: string;
}

const CORNERS: Record<DemoHintCorner, string> = {
  "top-left": "top-3 left-3 text-left",
  "top-right": "top-3 right-3 text-right",
  "bottom-left": "bottom-3 left-3 text-left",
  "bottom-right": "bottom-3 right-3 text-right",
};

/**
 * The one "how to try it" hint every Node Banana tile uses: the product's mono
 * eyebrow (10px JetBrains Mono, uppercase, 0.08em, muted ink) in a corner of
 * the tile. Place it in NbRoot (or a frame overlay) at a corner the demo keeps
 * clear: it is never drawn over content. It stacks under the canvas chrome
 * (z-10: pills, run bars), so chrome that reaches its corner covers it rather
 * than the other way round. It is decorative (aria-hidden, no pointer
 * events): each demo says the same in its own sr-only instructions.
 */
export function DemoHint({ children, corner = "bottom-left", hidden = false, className }: DemoHintProps) {
  return (
    <span
      aria-hidden
      data-demo-hint={corner}
      className={cn(
        "nb-font-mono nb-tracking-eyebrow nb-text-ink-3 pointer-events-none absolute z-[5] max-w-[calc(100%-24px)] text-[10px] leading-[14px] uppercase select-none",
        "transition-opacity duration-500 ease-out motion-reduce:transition-none",
        CORNERS[corner],
        hidden && "opacity-0",
        className,
      )}
    >
      {children}
    </span>
  );
}
