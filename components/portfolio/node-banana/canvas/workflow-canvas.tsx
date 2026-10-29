"use client";

import { useEffect, useRef, type FocusEvent, type ReactNode } from "react";

import { Canvas, type CanvasView } from "../kit";
import type { WorkflowEnv } from "./use-workflow";
import "./canvas-demo.css";

/** Room left between the chrome and a focused control moved out from under it. */
const CHROME_GAP = 8;
/** A focus ring reaches this far outside its control. */
const FOCUS_RING = 4;
/** The kit's own margin for a focused control at the canvas edge. */
const EDGE_PAD = 16;

/**
 * One workflow's canvas. The site's entry (nodes rise in, then the noodles
 * draw on from 520ms) waits until the tile has been on screen; hiding the tab
 * with display:none and showing it again replays it, as the site's stages do.
 */
export function WorkflowCanvas({
  view,
  env,
  onPaneClick,
  children,
}: {
  view: CanvasView;
  env: WorkflowEnv;
  onPaneClick?: () => void;
  children?: ReactNode;
}) {
  // The kit's focus reveal (its listener on the canvas runs before this one) only
  // keeps a keyboard-focused control inside the canvas edge, which on a phone
  // tile can leave it under the Agent pill: move the camera down to clear it.
  // Like the kit, it leaves pointer focus alone, which Chrome also marks
  // :focus-visible on a clicked text or number field.
  const pointerFocus = useRef(false);
  useEffect(() => {
    const note = (event: Event) => {
      pointerFocus.current = event.type === "pointerdown";
    };
    document.addEventListener("pointerdown", note, true);
    document.addEventListener("keydown", note, true);
    return () => {
      document.removeEventListener("pointerdown", note, true);
      document.removeEventListener("keydown", note, true);
    };
  }, []);
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const chrome = env.chrome?.current;
    if (!chrome || pointerFocus.current || target.closest("[data-nb-overlay]") || !target.matches(":focus-visible")) return;
    const c = chrome.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    // A node's header floats above its box.
    const header = target.matches("[data-nb-node]") ? target.querySelector("[data-node-header]") : null;
    const top = header ? Math.min(r.top, header.getBoundingClientRect().top) : r.top;
    const covered = r.right + FOCUS_RING > c.left && r.left - FOCUS_RING < c.right && top - FOCUS_RING < c.bottom && r.bottom + FOCUS_RING > c.top;
    if (!covered) return;
    // Below the chrome if it still fits there, else beside it. Something taller
    // than the canvas shows its start below the chrome, as the kit shows its
    // start; anything else goes as far down as its bottom allows.
    const box = event.currentTarget.getBoundingClientRect();
    const down = c.bottom + CHROME_GAP - top;
    const roomDown = box.bottom - EDGE_PAD - FOCUS_RING - r.bottom;
    const left = c.left - CHROME_GAP - FOCUS_RING - r.right;
    const roomLeft = box.left + EDGE_PAD + FOCUS_RING - r.left;
    if (down <= roomDown) view.panBy(0, down);
    else if (left >= roomLeft) view.panBy(left, 0);
    else if (r.bottom - top > box.height - 2 * EDGE_PAD) view.panBy(0, down);
    else if (roomDown > 0) view.panBy(0, roomDown);
  };

  return (
    <div className="absolute inset-0" data-nb-intro={env.entered ? undefined : "hold"} onFocus={onFocus}>
      <Canvas view={view} gridZoom={false} onPaneClick={onPaneClick} onInteract={env.onInteract} className="nb-hero-canvas">
        {children}
      </Canvas>
    </div>
  );
}
