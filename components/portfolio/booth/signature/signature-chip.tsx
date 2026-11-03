"use client";

import type { ReactNode } from "react";

import { BOOTH_FOCUS_RING } from "@/components/portfolio/booth/kit";
import { cn } from "@/lib/utils";

// The demo's controls in Booth's chip style: the kit's BoothToggleChip and BoothChipButton
// (from studiovoice/app/Sources/Booth/UI/Controls/ToggleChip.swift and Buttons.swift), with an
// icon slot for the menu bar glyph, which the kit's chips don't take.

/** The kit's chip (done-screen.tsx `CHIP_CLASS`): 24 pt tall, 9 pt padding, 12/16 type, a capsule. */
const CHIP_CLASS =
  "relative inline-flex h-6 shrink-0 items-center gap-[5px] rounded-full px-[9px] text-[12px] leading-4 whitespace-nowrap select-none transition-[background-color,color] duration-100 active:opacity-70";
/** A finger's target reaches past the 24 pt capsule, top and bottom, without crowding its neighbours. */
const TOUCH_REACH = "before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-['']";
const OFF = "text-(color:--booth-text2) shadow-[inset_0_0_0_1px_var(--booth-sep)] hover:bg-(color:--booth-fill)";

export interface SignatureChipProps {
  icon: ReactNode;
  children: ReactNode;
  /** A toggle's state (sets aria-pressed); leave it out for an action. */
  on?: boolean;
  /** What pressing it does, where the visible title isn't enough. */
  label?: string;
  onClick: () => void;
}

/**
 * A capsule in Booth's chip style: outlined in `sep` while off (a `fill` under the pointer),
 * filled with `fill2` while on.
 */
export function SignatureChip({ icon, children, on, label, onClick }: SignatureChipProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        CHIP_CLASS,
        TOUCH_REACH,
        on ? "bg-(color:--booth-fill2) text-(color:--booth-text)" : OFF,
        BOOTH_FOCUS_RING,
      )}
    >
      <span className="relative grid size-[13px] place-items-center">{icon}</span>
      <span className="relative">{children}</span>
    </button>
  );
}
