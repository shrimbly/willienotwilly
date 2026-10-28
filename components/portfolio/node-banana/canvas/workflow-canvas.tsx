"use client";

import { useRef, type ReactNode } from "react";

import { Canvas, type CanvasView, type NodeGraph } from "../kit";
import type { WorkflowEnv } from "./use-workflow";
import "./canvas-demo.css";

interface Snapshot {
  x: number;
  y: number;
  zoom: number;
  interacted: boolean;
  nodes: Array<[string, number, number]>;
}

/**
 * One workflow's canvas. The site's entry (nodes rise in, then the noodles
 * draw on from 520ms) waits until the tile has been on screen; hiding the tab
 * with display:none and showing it again replays it, as the site's stages do.
 */
export function WorkflowCanvas({
  view,
  graph,
  env,
  onPaneClick,
  children,
}: {
  view: CanvasView;
  graph?: NodeGraph;
  env: WorkflowEnv;
  onPaneClick?: () => void;
  children?: ReactNode;
}) {
  // A vertical swipe belongs to the page (touch-action: pan-y), but the canvas
  // and the nodes get a few pointermoves before the browser claims it with a
  // pointercancel, and pan or drag by up to ~30px. Put back what they moved,
  // so scrolling past the hero on a phone never disturbs its layout.
  const before = useRef<Snapshot | null>(null);
  const snapshot = (pointerType: string, primary: boolean) => {
    if (pointerType !== "touch" || !primary) return;
    before.current = {
      x: view.x.get(),
      y: view.y.get(),
      zoom: view.zoom.get(),
      interacted: view.interacted,
      nodes: (graph?.ids ?? []).map((id) => {
        const p = graph?.position(id);
        return [id, p?.x ?? 0, p?.y ?? 0];
      }),
    };
  };
  const restore = (pointerType: string) => {
    const s = before.current;
    before.current = null;
    if (pointerType !== "touch" || !s) return;
    // reset() clears the visitor flag the nudge set, so resizes keep refitting.
    if (!s.interacted) view.reset();
    view.setView({ x: s.x, y: s.y, zoom: s.zoom });
    for (const [id, x, y] of s.nodes) graph?.moveTo(id, x, y);
  };

  return (
    <div
      className="absolute inset-0"
      data-nb-intro={env.entered ? undefined : "hold"}
      onPointerDownCapture={(e) => snapshot(e.pointerType, e.isPrimary)}
      onPointerCancelCapture={(e) => restore(e.pointerType)}
      onPointerUpCapture={() => (before.current = null)}
    >
      <Canvas view={view} gridZoom={false} onPaneClick={onPaneClick} onInteract={env.onInteract} className="nb-hero-canvas">
        {children}
      </Canvas>
    </div>
  );
}
