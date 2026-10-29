"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { animate, type AnimationPlaybackControls } from "motion/react";

import { HEADER_OFFSET, SOCKET_REACH, SUMMARY_ROW_H, useCanvasView, type CanvasView, type NodeGraph } from "../kit";

/** Tiles narrower than this, or portrait ones, number the parts on the node and list them below it. */
const NARROW_MAX = 520;
/** Leader length from the node's right edge (socket tips included) to the callout column; clears the output socket's name. */
export const LEAD = 56;

/** The callout column takes spare width first, between these (below the minimum the descriptions run past three lines). */
const LABEL_MIN = 210;
export const LABEL_MAX = 260;
/** Wide tiles shorter than this set the callouts tighter so all five fit the column (matches node-anatomy.css). */
export const COMPACT_MAX_H = 460;
/** Room kept right of the callout column. */
export const LABEL_MARGIN = 20;
/** Room above the node on wide tiles, and below it: the hint's corner (12px in, 14px tall) and some air. */
const WIDE_TOP = 20;
const WIDE_BOTTOM = 34;
/** The tallest settings panel the Gemini models open (five 22px rows). */
const PANEL_BUDGET = 6 + 5 * 22 + 4 * 4 + 8;
/** The camera never zooms out past this (the node's 10px field text stays ~9px): it lets the node's top run off the tile instead. */
const READABLE_ZOOM = 0.9;
/** Legend tiles: room round the node (the legend's height adds to the bottom), and the most the camera zooms in. */
const LEGEND_PAD = { top: 40, bottom: 14, left: 32, right: 26 };
const LEGEND_MAX_ZOOM = 1.35;
/** World px of a docked input card left on the tile: border, padding and socket, never text (a prompt's starts 17px in). */
const DOCK = 16;
/** Screen px of noodle run the inputs need before the node; tiles without room for it keep the inputs off the edge. */
const DOCK_RUN = 80;

/** The legend layout (markers on the node, a list under it) rather than the callout column; matches the container query in node-anatomy.css. */
export function isNarrow(width: number, height: number): boolean {
  return width < NARROW_MAX || height >= width;
}

/** The node's height with its settings closed, in world px: header, media card, gap row and summary row. */
function closedHeight(el: HTMLElement): number {
  const card = el.querySelector<HTMLElement>("[data-media-card]");
  const gap = el.querySelector<HTMLElement>("[data-gap-row]");
  return HEADER_OFFSET + (card?.offsetHeight ?? 0) + (gap?.offsetHeight ?? 8) + SUMMARY_ROW_H + 2;
}

/**
 * Tiles that can show the biggest panel keep room for it, so the settings
 * start open and opening them never moves the camera: wide tiles tall enough
 * to show it at a readable size, and legend tiles (608×760) where it fits
 * without the node shrinking. Phones start with it closed.
 */
function roomForPanel(W: number, H: number, closed: number, nodeW: number, legend: number): boolean {
  const h = closed + PANEL_BUDGET;
  if (!isNarrow(W, H)) return (H - WIDE_TOP - WIDE_BOTTOM) / h >= READABLE_ZOOM;
  const zoom = Math.min(LEGEND_MAX_ZOOM, (W - LEGEND_PAD.left - LEGEND_PAD.right) / nodeW);
  return (H - LEGEND_PAD.top - legend - LEGEND_PAD.bottom) / h >= zoom;
}

/** The phone legend's height (0 where the tile has the callout column). */
function legendHeight(root: HTMLElement): number {
  return isNarrow(root.clientWidth, root.clientHeight) ? (root.querySelector<HTMLElement>("[data-anat-legend]")?.offsetHeight ?? 0) : 0;
}

interface Frame {
  x: number;
  y: number;
  zoom: number;
}

interface FramingOptions {
  rootRef: RefObject<HTMLDivElement | null>;
  graph: NodeGraph;
  nodeId: string;
  /** The settings panel is open (framed as shown unless the tile keeps room for it). */
  expanded: boolean;
  reducedMotion: boolean;
}

/**
 * The camera for the anatomy: the node large, room on its right for the
 * callout column (or under it for the legend on phones), and its inputs'
 * noodles reaching in from the left edge. The canvas fits to it on every tile
 * resize; content changes (the settings opening, a new model's fields, a
 * resize) ease the camera to the new frame.
 */
export function useFraming({ rootRef, graph, nodeId, expanded, reducedMotion }: FramingOptions) {
  const expandedRef = useRef(expanded);
  const reducedRef = useRef(reducedMotion);
  const animations = useRef<AnimationPlaybackControls[]>([]);
  const holdRef = useRef(false);

  const stop = useCallback(() => {
    animations.current.forEach((a) => a.stop());
    animations.current = [];
  }, []);

  const solve = useCallback((): Frame | null => {
    const root = rootRef.current;
    const node = graph.node(nodeId);
    const el = root?.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (!root || !node || !el) return null;
    const W = root.clientWidth;
    const H = root.clientHeight;
    if (W <= 0 || H <= 0) return null;

    const narrow = isNarrow(W, H);
    const closed = closedHeight(el);
    const legend = legendHeight(root);
    const shown = expandedRef.current ? (el.querySelector<HTMLElement>("[data-controls-card] .nb-bg-panel")?.offsetHeight ?? 0) : 0;
    const w = node.width.get() + 2 * SOCKET_REACH;
    const box = {
      x: node.x.get() - SOCKET_REACH,
      y: node.y.get() - HEADER_OFFSET,
      w,
      h: closed + (roomForPanel(W, H, closed, w, legend) ? Math.max(PANEL_BUDGET, shown) : shown),
    };
    // Phones: the legend under the node, and room on the right for the output
    // socket's highlight ring. Wide tiles: the callout column on the right and
    // a gutter on the left that grows with the tile.
    const m = narrow
      ? { ...LEGEND_PAD, bottom: legend + LEGEND_PAD.bottom }
      : { top: WIDE_TOP, bottom: WIDE_BOTTOM, left: Math.min(64, Math.max(24, W * 0.045)), right: LEAD + LABEL_MIN + LABEL_MARGIN };
    const availW = W - m.left - m.right;
    const availH = H - m.top - m.bottom;
    const fitW = availW / box.w;
    const zoom = Math.min(narrow ? LEGEND_MAX_ZOOM : 1.45, fitW, Math.max(availH / box.h, Math.min(fitW, READABLE_ZOOM)));
    // Too tall to show whole at a readable size: keep the bottom (the open settings) in view.
    const slack = availH - box.h * zoom;
    const y = (slack >= 0 ? m.top + slack / 2 : H - m.bottom - box.h * zoom) - box.y * zoom;
    if (narrow) return { zoom, y, x: m.left + (availW - box.w * zoom) / 2 - box.x * zoom };
    // Spare width widens the callouts first (fewer lines each), then most of
    // the rest goes left, where the inputs' noodles come in.
    let spare = Math.max(0, availW - box.w * zoom);
    spare -= Math.min(spare, LABEL_MAX - LABEL_MIN);
    return { zoom, y, x: m.left + spare * 0.72 - box.x * zoom };
  }, [rootRef, graph, nodeId]);

  /** Whether the settings should start open: only where the tile keeps room for them. */
  const startsOpen = useCallback((): boolean => {
    const root = rootRef.current;
    const node = graph.node(nodeId);
    const el = root?.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (!root || !node || !el) return false;
    return roomForPanel(root.clientWidth, root.clientHeight, closedHeight(el), node.width.get() + 2 * SOCKET_REACH, legendHeight(root));
  }, [rootRef, graph, nodeId]);

  // The canvas fits a world rect; hand it the one this frame shows edge to edge
  // (the canvas fills the root, so the root's size is the canvas's).
  const view: CanvasView = useCanvasView({
    fit: () => {
      stop();
      const f = solve();
      const root = rootRef.current;
      if (!f || !root) return null;
      return { x: -f.x / f.zoom, y: -f.y / f.zoom, width: root.clientWidth / f.zoom, height: root.clientHeight / f.zoom };
    },
    padding: 0,
    minZoom: 0.05,
    maxZoom: 4,
    fitMaxZoom: 10,
    fitMinZoom: 0.01,
  });

  const heading = useRef<Frame | null>(null);
  const reframe = useCallback(() => {
    const f = solve();
    if (!f || view.width <= 0) return;
    const near = (a: Frame) => Math.abs(f.x - a.x) < 0.5 && Math.abs(f.y - a.y) < 0.5 && Math.abs(f.zoom - a.zoom) < 0.001;
    // Already there, or already on the way: never restart a move toward the same frame.
    if (near({ x: view.x.get(), y: view.y.get(), zoom: view.zoom.get() })) return;
    if (animations.current.length && heading.current && near(heading.current)) return;
    stop();
    if (reducedRef.current) {
      view.setView(f);
      return;
    }
    const opts = { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const };
    heading.current = f;
    animations.current = [animate(view.x, f.x, opts), animate(view.y, f.y, opts), animate(view.zoom, f.zoom, opts)];
    void Promise.all(animations.current.map((a) => a.finished)).then(() => {
      if (heading.current === f) {
        heading.current = null;
        animations.current = [];
      }
    });
  }, [solve, stop, view]);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  // Opening the settings on a phone: the camera moves with the panel, not after it.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    expandedRef.current = expanded;
    if (mounted.current) reframe();
    mounted.current = true;
  }, [expanded, reframe]);

  // Anything else that changes the node's size (a model with fewer fields, a
  // width resize once the edge is let go) reframes when it settles.
  useEffect(() => {
    const root = rootRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!holdRef.current) reframe();
      }, 160);
    };
    const ro = new ResizeObserver(settle);
    ro.observe(el);
    const panel = el.querySelector("[data-controls-card] .nb-bg-panel");
    if (panel) ro.observe(panel);
    return () => {
      ro.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [rootRef, nodeId, reframe]);

  useEffect(() => stop, [stop]);

  /** Hold reframing while the visitor is resizing or dragging; release reframes. */
  const hold = useCallback(
    (on: boolean) => {
      holdRef.current = on;
      if (!on) reframe();
    },
    [reframe],
  );

  return { view, hold, startsOpen };
}

/**
 * Docks the node's inputs at the tile's left edge whatever the camera does:
 * only a sliver of each card (its right edge and output socket) shows, with
 * the noodles running in from it. Where the tile is too narrow for that run,
 * the cards wait just off the edge and only their noodles come in.
 */
export function useInputDock(view: CanvasView, graph: NodeGraph, nodeId: string, inputs: ReadonlyArray<string>) {
  useEffect(() => {
    const place = () => {
      const node = graph.node(nodeId);
      const z = view.zoom.get();
      const vx = view.x.get();
      if (!node || z <= 0) return;
      // Screen x of the node's input socket tips, less the run the noodles need.
      const tip = vx + (node.x.get() - SOCKET_REACH) * z - DOCK_RUN;
      const right = tip >= (DOCK + SOCKET_REACH) * z ? DOCK * z : Math.min(tip, -4) - SOCKET_REACH * z;
      for (const id of inputs) {
        const input = graph.node(id);
        if (input) graph.moveTo(id, (right - vx) / z - input.width.get(), input.y.get());
      }
    };
    place();
    const offs = [view.x.on("change", place), view.zoom.on("change", place)];
    return () => offs.forEach((off) => off());
  }, [view, graph, nodeId, inputs]);
}
