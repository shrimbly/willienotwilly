"use client";

import { useEffect, useRef } from "react";

import { TOUCH_HOLD_DELAY_MS } from "../kit";

// "Hold for the original": the site's way into the comparison for a finger, a mouse or the keys
// (studiovoice/site/index.html `.hold` and its handlers). A light pill with a dark ⌥ key cap; held
// down it reads "Playing the original" and the cap sinks. It captures the pointer, so a pointer
// that drifts off it while held still holds, and it never becomes a text selection. A vertical
// swipe that starts on it still scrolls the page: the browser cancels the press as it takes the
// swipe, and a finger only holds once it has stayed put for a moment, so the swipe never flashes
// the original.

/** Press and hold to hear the original; let go (or lose the pointer) to hear Booth's again. */
export function CompareHoldButton({ held, onHeldChange }: { held: boolean; onHeldChange: (held: boolean) => void }) {
  const holding = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = () => {
    pending.current = null;
    holding.current = true;
    onHeldChange(true);
  };
  /** Lets go of this button's own hold only: a ⌥ key still held keeps the original playing. */
  const release = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    if (!holding.current) return;
    holding.current = false;
    onHeldChange(false);
  };
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className="booth-cmp-hold"
      aria-pressed={held}
      aria-label="Hold to hear the original"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // The pointer may already be gone.
        }
        if (event.pointerType === "touch") pending.current = setTimeout(hold, TOUCH_HOLD_DELAY_MS);
        else hold();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        if (!event.repeat) hold();
      }}
      onKeyUp={(event) => {
        // Only the key that held it: a Tab landing here must not let go of a held ⌥.
        if (event.key === " " || event.key === "Enter") release();
      }}
      onBlur={release}
    >
      <kbd aria-hidden>⌥</kbd>
      <span aria-hidden>{held ? "Playing the original" : "Hold for the original"}</span>
    </button>
  );
}
