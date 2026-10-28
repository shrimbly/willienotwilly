"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Bounds, CanvasView } from "../kit";

/** What a workflow tab knows about the demo around it. */
export interface WorkflowEnv {
  /** Ambient motion may run: on screen, page visible, tab shown, no reduced-motion preference. */
  active: boolean;
  /** The tile has been on screen: the entry may play. */
  entered: boolean;
  reducedMotion: boolean;
  /** The visitor has pressed somewhere in the tile: ambient camera motion stops for good. */
  touched: boolean;
  /** First pan or zoom of the canvas. */
  onInteract: () => void;
}

/** Selection and the timed runs (comets in, spinner on the media) of one workflow. */
export function useWorkflowState() {
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  const run = useCallback((id: string, ms: number, done?: () => void) => {
    if (timers.current.has(id)) return;
    setRunning((r) => [...r, id]);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setRunning((r) => r.filter((x) => x !== id));
        done?.();
      }, ms),
    );
  }, []);

  return { selected, setSelected, running, run };
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The world rectangle that, fitted edge to edge (padding 0), shows `content`
 * at `zoom` with its top-left placed like a padded fit would place it. Lets a
 * fit pick its own zoom and anchoring (centred, or top-aligned) through the
 * kit's plain fit.
 */
export function framedBounds(view: CanvasView, content: Bounds, zoom: number, pad: Insets, align: "center" | "top" = "center"): Bounds {
  const availW = view.width - pad.left - pad.right;
  const availH = view.height - pad.top - pad.bottom;
  const left = pad.left + (availW - content.width * zoom) / 2;
  const top = align === "top" ? pad.top : pad.top + (availH - content.height * zoom) / 2;
  return { x: content.x - left / zoom, y: content.y - top / zoom, width: view.width / zoom, height: view.height / zoom };
}

/** The zoom a padded fit of `content` would pick, capped. */
export function fitZoom(view: CanvasView, content: Bounds, pad: Insets, max = 1): number {
  const availW = Math.max(1, view.width - pad.left - pad.right);
  const availH = Math.max(1, view.height - pad.top - pad.bottom);
  return Math.min(max, availW / content.width, availH / content.height);
}

/** A node's Download button: save the file it shows. */
export function downloadFile(src: string, name: string) {
  const a = document.createElement("a");
  a.href = src;
  a.download = name;
  a.click();
}

/**
 * The site's phone drift (site.js driftTimeline): phases of [target, ms], each
 * eased in and out (cubic) from the previous target, looping.
 */
export function driftTimeline(phases: ReadonlyArray<readonly [number, number]>, start = 0) {
  const total = phases.reduce((sum, [, ms]) => sum + ms, 0);
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  return (ms: number) => {
    let t = ((ms % total) + total) % total;
    let from = start;
    for (const [to, dur] of phases) {
      if (t < dur) return from + (to - from) * ease(t / dur);
      t -= dur;
      from = to;
    }
    return from;
  };
}
