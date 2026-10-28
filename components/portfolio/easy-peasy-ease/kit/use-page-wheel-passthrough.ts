"use client";

import { useEffect, type RefObject } from "react";

/** Pixels per wheel "line" (deltaMode 1), as Chromium and Firefox use. */
const WHEEL_LINE_PX = 16;

/**
 * Hand mostly vertical wheel gestures over a horizontal scroller to the page.
 *
 * Chromium latches a trackpad gesture onto the first scroller that can move
 * along any of its axes, so a vertical swipe with a little sideways drift
 * sticks to the strip and the page stops scrolling. This listener takes those
 * wheels (|deltaY| > |deltaX|) and scrolls the window by deltaY instead.
 * Sideways wheels still scroll the element, pure vertical ones pass through
 * untouched, and pinch-zoom (ctrlKey) is left to the browser.
 * Returns the cleanup.
 */
export function passPageWheel(element: HTMLElement): () => void {
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.deltaX === 0) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (element.scrollWidth <= element.clientWidth) return;
    event.preventDefault();
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? WHEEL_LINE_PX
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
    window.scrollBy({ top: event.deltaY * unit, behavior: "instant" });
  };
  element.addEventListener("wheel", onWheel, { passive: false });
  return () => element.removeEventListener("wheel", onWheel);
}

/** passPageWheel for a ref'd horizontal scroller (see above). */
export function usePageWheelPassthrough(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    return passPageWheel(element);
  }, [enabled, ref]);
}
