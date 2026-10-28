"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useCanvasView, type CanvasView, type GraphNodeSpec, type NodeGraph } from "../kit";

/** What a workflow tab knows about the demo around it. */
export interface WorkflowEnv {
  /** Ambient motion may run: on screen, page visible, tab shown, no reduced-motion preference. */
  active: boolean;
  /** The tile has been on screen: the entry may play. */
  entered: boolean;
  reducedMotion: boolean;
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

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Wide tiles leave room for the hint and the Agent pill; portrait layouts clear the pill themselves. */
const WIDE_PAD: Insets = { top: 64, right: 28, bottom: 36, left: 28 };
const PHONE_PAD: Insets = { top: 14, right: 8, bottom: 14, left: 8 };

/** Where a layout puts a node: [x, y, width] in world px. */
export type Placement = readonly [number, number, number];

export interface PhoneLayout {
  /** Where the layout puts each node, for portrait and near-square canvases (height > 0.9 × width). */
  place: (id: string) => Placement;
  /** The nodes framed at rest, wide and phone (default: all). */
  frame?: { wide?: string[]; phone?: string[] };
}

/**
 * The camera of one workflow tab. On every resize until the visitor pans or
 * zooms it picks the layout for the canvas's shape (the saved coordinates in
 * `nodes`, or the phone layout), moves the nodes into it, and fits the framed
 * nodes inside its padding, at most at zoom 1 (0.75 in the phone layout).
 */
export function useWorkflowView(graph: NodeGraph, nodes: ReadonlyArray<GraphNodeSpec>, phone: PhoneLayout): CanvasView {
  const current = useRef<"wide" | "phone">("wide");
  const view = useCanvasView({
    fit: () => {
      if (view.width <= 0 || view.height <= 0) return null;
      const compact = view.height > view.width * 0.9;
      const want = compact ? "phone" : "wide";
      if (current.current !== want) {
        current.current = want;
        placeNodes(graph, view, compact ? phone.place : (id) => saved(nodes, id));
      }
      const content = graph.measure(phone.frame?.[want]);
      if (!content) return null;
      const pad = compact ? PHONE_PAD : WIDE_PAD;
      const availW = Math.max(1, view.width - pad.left - pad.right);
      const availH = Math.max(1, view.height - pad.top - pad.bottom);
      const zoom = Math.min(compact ? 0.75 : 1, availW / content.width, availH / content.height);
      // The rectangle that, fitted edge to edge, centres the content at that zoom inside the padding.
      const left = pad.left + (availW - content.width * zoom) / 2;
      const top = pad.top + (availH - content.height * zoom) / 2;
      return { x: content.x - left / zoom, y: content.y - top / zoom, width: view.width / zoom, height: view.height / zoom };
    },
    padding: 0,
    minZoom: 0.1,
    fitMinZoom: 0.05,
    fitMaxZoom: 2,
  });
  return view;
}

/** A node's saved [x, y, width]. */
export function saved(nodes: ReadonlyArray<GraphNodeSpec>, id: string): Placement {
  const n = nodes.find((spec) => spec.id === id);
  return n ? [n.x, n.y, n.width] : [0, 0, 300];
}

/**
 * Move and resize every node into a layout. measure() reads node heights from
 * the DOM and motion writes a new width only on its next frame, so the width
 * also goes straight onto the element for the fit that measures right after.
 */
function placeNodes(graph: NodeGraph, view: CanvasView, place: (id: string) => Placement) {
  for (const id of graph.ids) {
    const [x, y, width] = place(id);
    graph.moveTo(id, x, y);
    graph.setWidth(id, width);
    const el = view.element?.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
    if (el) el.style.width = `${width}px`;
  }
}

/** A node's Download button: save the file it shows. */
export function downloadFile(src: string, name: string) {
  const a = document.createElement("a");
  a.href = src;
  a.download = name;
  a.click();
}
