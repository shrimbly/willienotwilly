"use client";

import { useMemo } from "react";

/**
 * Pointer handlers for "the visitor has used the demo" (fade a hint, stop an
 * autoplay). A mouse or a pen counts on press. A finger counts only when it
 * lifts: a finger that lands on a tile to scroll the page ends in a
 * pointercancel once the browser takes the swipe, which never reaches
 * pointerup, so a scroll past the tile never counts. A press a kit TouchClaim
 * claims (a sideways node drag, pan or resize) ends in a pointerup and counts
 * then. Capture-phase, so a child that stops propagation cannot hide a press.
 * The parameters are structural: the same functions work as React props and
 * as native `addEventListener(…, true)` listeners.
 */
export interface InteractHandlers {
  onPointerDownCapture: (event: { pointerType: string }) => void;
  onPointerUpCapture: (event: { pointerType: string }) => void;
}

/** The handlers around `onInteract`; spread them on the demo's root (or an area of it). */
export function interactHandlers(onInteract: () => void): InteractHandlers {
  return {
    onPointerDownCapture: (event) => {
      if (event.pointerType !== "touch") onInteract();
    },
    onPointerUpCapture: (event) => {
      if (event.pointerType === "touch") onInteract();
    },
  };
}

/** `interactHandlers`, memoised on `onInteract` (pass a stable callback where the handlers feed an effect). */
export function useInteractOnRelease(onInteract: () => void): InteractHandlers {
  return useMemo(() => interactHandlers(onInteract), [onInteract]);
}
