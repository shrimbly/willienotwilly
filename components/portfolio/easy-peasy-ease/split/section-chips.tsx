"use client";

import { useLayoutEffect, useRef } from "react";
import type { MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * The created clips in output order: one equal-width chip per section (every
 * section is eased into the same clip duration), styled like the product's
 * timeline segments ("Section N", playing = bg-primary/10). The playing chip
 * fills along the bottom as its curve runs. Clicking a chip plays from it.
 */
export function SectionChips({
  count,
  active,
  progress,
  onSelect,
  className,
}: {
  count: number;
  active: number;
  progress: MotionValue<number>;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const fillRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = fillRef.current;
    if (!node) return;
    const apply = (p: number) => {
      node.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
    };
    apply(progress.get());
    return progress.on("change", apply);
  }, [progress, active]);

  return (
    <div
      role="group"
      aria-label="Created clips"
      className={cn("flex min-w-0", count > 12 ? "gap-px" : "gap-1", className)}
    >
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === active;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={isActive}
            aria-label={`Play section ${i + 1} of ${count}`}
            onClick={() => onSelect(i)}
            className={cn(
              "@container relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-sm border text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
              isActive
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="relative hidden whitespace-nowrap @min-[18px]:block">
              <span className="hidden @min-[76px]:inline">Section </span>
              {i + 1}
            </span>
            {isActive && (
              <span
                ref={fillRef}
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
                style={{ transform: "scaleX(0)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
