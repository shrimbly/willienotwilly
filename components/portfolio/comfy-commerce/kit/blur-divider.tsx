import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

const MASK_CENTRE = "linear-gradient(to right, transparent, #000 30%, #000 70%, transparent)";
const MASK_ENDS = "linear-gradient(to right, #000, transparent 34%, transparent 66%, #000)";

/**
 * Ported from web/src/components/ui/BlurDivider.tsx: a hairline that is crisp
 * in the centre and softly blurred toward the ends (a blurred copy shows only
 * where the crisp one fades).
 */
export function BlurDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-px", className)}>
      <div className="absolute inset-0 bg-(--line) [mask-image:var(--mask)]" style={{ "--mask": MASK_CENTRE } as CSSProperties} />
      <div
        className="absolute inset-0 bg-(--line) blur-[0.8px] [mask-image:var(--mask)]"
        style={{ "--mask": MASK_ENDS } as CSSProperties}
      />
    </div>
  );
}
