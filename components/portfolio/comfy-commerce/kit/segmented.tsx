"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import { SEGMENTED_TRANSITION } from "./motion";

// Ported from web/src/components/ui/Segmented.tsx: a surface-2 track with a
// morphing white indicator (a shared layoutId), class for class.

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Drawn in place of the label text; `label` becomes the accessible name. */
  icon?: ReactNode;
}

/**
 * Segmented control with a morphing active indicator. A radio group: the
 * product makes every segment a tab stop; here only the checked one is, and
 * the arrow keys move the choice (they stop there, so a demo's own arrow keys
 * don't also fire).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
  reducedMotion = false,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
  /** Snap the indicator instead of sliding it. */
  reducedMotion?: boolean;
}) {
  // Only feeds layoutId (never the DOM), so a server/client difference is harmless.
  const groupId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    const current = options.findIndex((o) => o.value === value);
    const next = (current + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("inline-flex items-center gap-1 rounded-xl border border-(--line) bg-(--surface-2) p-1", className)}
    >
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            aria-label={option.icon ? option.label : undefined}
            title={option.icon ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-7 cursor-pointer rounded-lg text-sm font-medium whitespace-nowrap",
              "transition-colors duration-200 motion-reduce:transition-none",
              option.icon ? "px-2.5" : "px-3",
              active ? "text-(--ink)" : "text-(--ink-soft) hover:text-(--ink)",
            )}
          >
            {active && (
              <motion.span
                layoutId={`cc-segmented-${groupId}`}
                className="absolute inset-0 rounded-lg border border-(--line) bg-(--surface) shadow-(--shadow-soft)"
                transition={reducedMotion ? { duration: 0 } : SEGMENTED_TRANSITION}
              />
            )}
            <span className="relative flex items-center">{option.icon ?? option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
