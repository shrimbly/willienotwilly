"use client";

import { useMemo, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

const DRAG_THRESHOLD_PX = 4;

/**
 * The timeline track captures the pointer on the segment it was pressed on
 * (as the product does), so letting go after a scrub also clicks that
 * segment, which selects it and seeks back to its start. Spread these on an
 * ancestor of the timeline to swallow that one click. Plain clicks and
 * keyboard clicks (detail 0) still select the segment.
 */
export function useScrubClickGuard() {
  const startXRef = useRef<number | null>(null);
  const draggedRef = useRef(false);

  return useMemo(
    () => ({
      onPointerDownCapture: (event: PointerEvent) => {
        startXRef.current = event.clientX;
        draggedRef.current = false;
      },
      onPointerMoveCapture: (event: PointerEvent) => {
        const startX = startXRef.current;
        if (startX !== null && Math.abs(event.clientX - startX) > DRAG_THRESHOLD_PX) {
          draggedRef.current = true;
        }
      },
      onPointerUpCapture: () => {
        startXRef.current = null;
      },
      onClickCapture: (event: MouseEvent) => {
        if (event.detail > 0 && draggedRef.current) event.stopPropagation();
        draggedRef.current = false;
      },
    }),
    [],
  );
}
