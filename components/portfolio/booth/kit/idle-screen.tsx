"use client";

import { cn } from "@/lib/utils";

import { BOOTH_FOCUS_RING } from "./done-screen";
import { BoothIcon } from "./icons";
import { BoothSwap } from "./popover";

// The drop zone, ported from studiovoice/app/Sources/Booth/UI/Screens/IdleScreen.swift and the
// corner IconButton in Controls/Buttons.swift.

/**
 * Ready for a file: "Drop audio or video" in `dim` with "or choose a file" under it. While a file
 * is over the popover the prompt hands over, out of focus and in place, to "Release to start"
 * in `text`, and the link fades out. The signature and the gear are the frame's (BoothFrame).
 */
export function BoothIdleScreen({
  dropHover = false,
  onChoose,
  reducedMotion = false,
}: {
  dropHover?: boolean;
  /** "or choose a file": the demo's stand-in for the file chooser. Without it the link only draws. */
  onChoose?: () => void;
  reducedMotion?: boolean;
}) {
  return (
    <div className="flex flex-col items-start">
      <div className="relative w-full pr-6 text-[15px] leading-5 font-medium">
        <BoothSwap swapKey={dropHover ? "over" : "rest"} reducedMotion={reducedMotion} blur={3}>
          <p
            className={cn(
              "transition-colors duration-200 ease-(--booth-ease-out)",
              dropHover ? "text-(color:--booth-text)" : "text-(color:--booth-dim)",
            )}
          >
            {dropHover ? "Release to start" : "Drop audio or video"}
          </p>
        </BoothSwap>
      </div>
      {/* Where the keyboard lands when the drop zone takes over from another screen (BoothFrame). */}
      <button
        type="button"
        data-booth-autofocus
        onClick={onChoose}
        tabIndex={dropHover ? -1 : undefined}
        aria-hidden={dropHover || undefined}
        className={cn(
          // The hover fill's padding hangs outside the text's column.
          "-ml-1.5 rounded-[6px] px-[5px] py-px text-[12px] leading-[17px] text-(color:--booth-text2) underline decoration-1 underline-offset-2 transition-[background-color,color,opacity] duration-[120ms] ease-(--booth-ease) hover:bg-(color:--booth-fill2) hover:text-(color:--booth-text) active:opacity-55",
          dropHover && "pointer-events-none opacity-0",
          BOOTH_FOCUS_RING,
        )}
      >
        or choose a file
      </button>
    </div>
  );
}

/** The frame's 24 pt corner button (the gear on the drop zone): `text2`, a soft fill on hover and press. */
export function BoothGearButton({ onClick, label = "Settings", decorative = false }: { onClick?: () => void; label?: string; decorative?: boolean }) {
  const className = "grid size-6 place-items-center rounded-[7px] text-(color:--booth-text2)";
  if (decorative) {
    return (
      <span aria-hidden className={className}>
        <BoothIcon name="gear" size={15} />
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(className, "hover:bg-(color:--booth-fill) active:bg-(color:--booth-fill2)", BOOTH_FOCUS_RING)}
    >
      <BoothIcon name="gear" size={15} />
    </button>
  );
}
