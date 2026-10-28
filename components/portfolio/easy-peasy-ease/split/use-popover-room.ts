"use client";

import { useEffect, useState, type RefObject } from "react";

const POPOVER_MAX = 420;
const POPOVER_WIDTH = 288;
/** The popover's mt-2 / mb-2 plus breathing room from the tile edge. */
const EDGE = 16;

export interface PopoverRoom {
  side: "bottom" | "top";
  align: "start" | "end";
  /** Pixels the popover may grow to inside the tile. */
  maxHeight: number;
}

/**
 * The curve picker's popover is not portaled (as in the product) and the
 * tile clips, so pick the side with more room, hang it from the edge that
 * keeps its 18rem inside the tile, and cap its height to what is left.
 */
export function usePopoverRoom(
  anchorRef: RefObject<HTMLElement | null>,
  boundsRef: RefObject<HTMLElement | null>,
  fallback: PopoverRoom,
): PopoverRoom {
  const [room, setRoom] = useState(fallback);

  useEffect(() => {
    const anchor = anchorRef.current;
    const bounds = boundsRef.current;
    if (!anchor || !bounds || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const a = anchor.getBoundingClientRect();
      const b = bounds.getBoundingClientRect();
      if (a.width === 0 || b.height === 0) return;
      const below = b.bottom - a.bottom - EDGE;
      const above = a.top - b.top - EDGE;
      const side = below >= Math.min(POPOVER_MAX, 240) || below >= above ? "bottom" : "top";
      const align = a.left + POPOVER_WIDTH <= b.right - EDGE / 2 ? "start" : "end";
      const maxHeight = Math.max(120, Math.round(Math.min(POPOVER_MAX, side === "bottom" ? below : above)));
      setRoom((prev) =>
        prev.side === side && prev.align === align && prev.maxHeight === maxHeight
          ? prev
          : { side, align, maxHeight },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bounds);
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorRef, boundsRef]);

  return room;
}
