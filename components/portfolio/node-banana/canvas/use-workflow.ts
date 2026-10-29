"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { useCanvasView, type Bounds, type CanvasView, type GraphNodeSpec, type NodeGraph } from "../kit";

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

/**
 * The canvas shapes a workflow lays itself out for: wide tiles show the whole
 * workflow at its saved coordinates, mid-size ones a few nodes closer up, and
 * portrait or near-square ones (height > 0.9 × width) the phone layout, or
 * the narrow one on phone-width canvases where the phone layout's two 300px
 * columns would shrink below a readable zoom.
 */
type Shape = "wide" | "mid" | "phone" | "narrow";

/** Wide canvases narrower than this (a ~1100px tile) frame a few nodes rather than the whole workflow. */
const WIDE_MIN_W = 1088;
/** Portrait canvases narrower than this take the narrow layout, where a workflow has one. */
const NARROW_MAX_W = 512;

interface Framing {
  /** Room kept round the framed nodes. The top band holds the hint (left) and the Agent pill (right). */
  pad: { top: number; right: number; bottom: number; left: number };
  maxZoom: number;
  /** The zoom a frame must reach to be picked over the next, smaller one (10px node text renders at 7px from 0.7). */
  readable: number;
  /** Below `readable`, zoom in to it anyway: the frame keeps its left edge and the nodes beyond it run off to the right. */
  crop: boolean;
  /** Sit the frame at the top of the padding, the rest of a stacked layout running off the bottom (default: centred). */
  alignTop?: boolean;
}

const FRAMING: Record<Shape, Framing> = {
  wide: { pad: { top: 64, right: 28, bottom: 24, left: 28 }, maxZoom: 1, readable: 0.72, crop: true },
  mid: { pad: { top: 64, right: 28, bottom: 24, left: 28 }, maxZoom: 0.8, readable: 0.45, crop: false },
  // The right column of a portrait layout starts low enough to clear the pill.
  phone: { pad: { top: 36, right: 8, bottom: 14, left: 8 }, maxZoom: 0.75, readable: 0.7, crop: false },
  // Only the top of the narrow layout fits: the rest of its columns shows below it.
  narrow: { pad: { top: 36, right: 8, bottom: 14, left: 8 }, maxZoom: 0.75, readable: 0.7, crop: false, alignTop: true },
};

/** Where a layout puts a node: [x, y, width] in world px. */
export type Placement = readonly [number, number, number];

export interface WorkflowLayout {
  /** Where the phone layout puts each node. */
  phone: (id: string) => Placement;
  /** Where phone-width canvases put each node (default: the phone layout). */
  narrow?: (id: string) => Placement;
  /** Where mid-size canvases put each node (default: the saved coordinates). */
  mid?: (id: string) => Placement;
  /**
   * The nodes each shape frames at rest, best first (default: all of them).
   * The first that fits at a readable zoom wins; failing that, the last.
   */
  frames?: Partial<Record<Shape, ReadonlyArray<ReadonlyArray<string>>>>;
}

/**
 * The camera of one workflow tab. On every resize until the visitor pans or
 * zooms it picks the layout for the canvas's shape, moves the nodes into it,
 * and frames the nodes that shape shows inside its padding.
 */
export function useWorkflowView(graph: NodeGraph, nodes: ReadonlyArray<GraphNodeSpec>, layout: WorkflowLayout): CanvasView {
  const current = useRef<Shape>("wide");
  const view = useCanvasView({
    fit: () => {
      if (view.width <= 0 || view.height <= 0) return null;
      const portrait = view.height > view.width * 0.9;
      const shape: Shape = portrait ? (layout.narrow && view.width < NARROW_MAX_W ? "narrow" : "phone") : view.width < WIDE_MIN_W ? "mid" : "wide";
      if (current.current !== shape) {
        current.current = shape;
        const savedAt = (id: string) => saved(nodes, id);
        const place = { wide: savedAt, mid: layout.mid ?? savedAt, phone: layout.phone, narrow: layout.narrow ?? layout.phone }[shape];
        placeNodes(graph, view, place);
      }
      const { pad, maxZoom, readable, crop, alignTop } = FRAMING[shape];
      const availW = Math.max(1, view.width - pad.left - pad.right);
      const availH = Math.max(1, view.height - pad.top - pad.bottom);
      let content: Bounds | null = null;
      let zoom = 0;
      for (const ids of layout.frames?.[shape] ?? [graph.ids]) {
        content = graph.measure(ids);
        if (!content) return null;
        zoom = Math.min(maxZoom, availW / content.width, availH / content.height);
        if (zoom >= readable) break;
      }
      if (!content) return null;
      if (crop) zoom = Math.max(zoom, Math.min(readable, availH / content.height));
      // The rectangle that, fitted edge to edge, places the content at that zoom inside the padding:
      // centred, or from the left edge (where the workflow starts) when it is cropped.
      const left = pad.left + Math.max(0, (availW - content.width * zoom) / 2);
      const top = pad.top + (alignTop ? 0 : (availH - content.height * zoom) / 2);
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

/**
 * Whether an element is on screen: in the viewport and inside the tile's clip.
 * Gates a node's video, which on a tall phone tile can sit below the fold (or
 * be panned out of the canvas) while the tile itself is in view.
 */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

/** A node's Download button: save the file it shows. */
export function downloadFile(src: string, name: string) {
  const a = document.createElement("a");
  a.href = src;
  a.download = name;
  a.click();
}
