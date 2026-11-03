import type { PointerEvent as ReactPointerEvent } from "react";

/** Below this a finger's movement is still jitter; past it, mostly sideways means it's ours. */
const TOUCH_SLOP = 8;

export interface HorizontalDragHandlers {
  /** The pointer's clientX as the drag moves (and once at its start, or on a tap). */
  onMove: (clientX: number) => void;
  /** A press began on this element (mouse and pen at once; a finger once it's clearly sideways). */
  onStart?: (clientX: number) => void;
  onEnd?: () => void;
}

/**
 * A horizontal drag on a control that sits on a scrolling page (a slider, the waveform): give
 * the element `touch-action: pan-y` and call this from its onPointerDown. A mouse or a pen
 * takes the control at once. A finger takes it only when it moves mostly sideways, so a
 * vertical swipe that starts on it still scrolls the page; a finger tap acts on release. The
 * element captures the pointer for the length of the drag.
 */
export function startHorizontalDrag(event: ReactPointerEvent<Element>, handlers: HorizontalDragHandlers) {
  if (event.button !== 0) return;
  const el = event.currentTarget;
  const id = event.pointerId;
  const touch = event.pointerType === "touch";
  const x0 = event.clientX;
  const y0 = event.clientY;
  let claimed = !touch;
  let moved = false;

  const claim = (x: number) => {
    claimed = true;
    try {
      el.setPointerCapture(id);
    } catch {
      // The pointer may already be gone.
    }
    handlers.onStart?.(x);
    handlers.onMove(x);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    if (claimed) {
      handlers.onMove(e.clientX);
      return;
    }
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (Math.hypot(dx, dy) < TOUCH_SLOP) return;
    moved = true;
    if (Math.abs(dx) > Math.abs(dy)) claim(e.clientX);
    else finish(false);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    // A finger that never moved: a tap, which acts where it lifted.
    if (!claimed && !moved) claim(e.clientX);
    finish(true);
  };
  const cancel = (e: PointerEvent) => {
    if (e.pointerId === id) finish(true);
  };
  const finish = (ended: boolean) => {
    el.removeEventListener("pointermove", move as EventListener);
    el.removeEventListener("pointerup", up as EventListener);
    el.removeEventListener("pointercancel", cancel as EventListener);
    if (ended && claimed) handlers.onEnd?.();
  };
  el.addEventListener("pointermove", move as EventListener);
  el.addEventListener("pointerup", up as EventListener);
  el.addEventListener("pointercancel", cancel as EventListener);
  if (claimed) claim(event.clientX);
}
