"use client";

import { useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { BOOTH_FOCUS_RING, type BoothTheme } from "../kit";

// Booth's segmented control, ported from studiovoice/app/Sources/Booth/UI/Controls/
// SegmentedControl.swift (Settings' Engine picker): equal segments on a `fill2` well, radius 8
// with 2 pt round them; the chosen one a raised `seg` chip, radius 6, in semibold. The app
// moves the chip at once, with no animation, and so does this.

const OPTIONS: { value: BoothTheme; title: string }[] = [
  { value: "light", title: "Light" },
  { value: "dark", title: "Dark" },
];

/**
 * Light or dark: Booth draws its popover in either of Theme.swift's palettes, following macOS.
 * A radio group, so the arrow keys move the choice and Tab leaves it.
 */
export function AppearanceSwitch({
  value,
  onChange,
  className,
}: {
  value: BoothTheme;
  onChange: (value: BoothTheme) => void;
  className?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = OPTIONS.findIndex((o) => o.value === value);
    const next = OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length];
    onChange(next.value);
    group.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label="Appearance"
      onKeyDown={onKeyDown}
      className={cn("flex w-[148px] gap-0.5 rounded-[8px] bg-(color:--booth-fill2) p-0.5", className)}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={option.value}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-[22px] min-w-0 flex-1 rounded-[6px] text-[12px] leading-[17px] text-(color:--booth-text) select-none active:opacity-80",
              selected ? "bg-(color:--booth-seg) font-semibold [box-shadow:var(--booth-seg-shadow)]" : "font-normal",
              BOOTH_FOCUS_RING,
            )}
          >
            {option.title}
          </button>
        );
      })}
    </div>
  );
}
