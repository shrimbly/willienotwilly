"use client";

import type { FocusEvent, ReactNode } from "react";

import { Canvas, type CanvasView } from "../kit";
import type { WorkflowEnv } from "./use-workflow";
import "./canvas-demo.css";

/** Room left between the chrome and a focused control moved out from under it. */
const CHROME_GAP = 8;
/** A focus ring reaches this far outside its control. */
const FOCUS_RING = 4;

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
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const chrome = env.chrome?.current;
    if (!chrome || target.closest("[data-nb-overlay]") || !target.matches(":focus-visible")) return;
    const c = chrome.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    // A node's header floats above its box.
    const header = target.matches("[data-nb-node]") ? target.querySelector("[data-node-header]") : null;
    const top = header ? Math.min(r.top, header.getBoundingClientRect().top) : r.top;
    const covered = r.right + FOCUS_RING > c.left && r.left - FOCUS_RING < c.right && top - FOCUS_RING < c.bottom && r.bottom + FOCUS_RING > c.top;
    if (covered) view.panBy(0, c.bottom + CHROME_GAP - top);
  };

  return (
    <div className="absolute inset-0" data-nb-intro={env.entered ? undefined : "hold"} onFocus={onFocus}>
      <Canvas view={view} gridZoom={false} onPaneClick={onPaneClick} onInteract={env.onInteract} className="nb-hero-canvas">
        {children}
      </Canvas>
    </div>
  );
}
