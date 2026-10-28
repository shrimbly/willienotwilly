"use client";

import type { ReactNode } from "react";

import { Canvas, type CanvasView } from "../kit";
import type { WorkflowEnv } from "./use-workflow";
import "./canvas-demo.css";

/**
 * One workflow's canvas. The site's entry (nodes rise in, then the noodles
 * draw on from 520ms) waits until the tile has been on screen; hiding the tab
 * with display:none and showing it again replays it, as the site's stages do.
 */
export function WorkflowCanvas({ view, env, onPaneClick, children }: { view: CanvasView; env: WorkflowEnv; onPaneClick?: () => void; children?: ReactNode }) {
  return (
    <div className="absolute inset-0" data-nb-intro={env.entered ? undefined : "hold"}>
      <Canvas view={view} gridZoom={false} onPaneClick={onPaneClick} onInteract={env.onInteract} className="nb-hero-canvas">
        {children}
      </Canvas>
    </div>
  );
}
