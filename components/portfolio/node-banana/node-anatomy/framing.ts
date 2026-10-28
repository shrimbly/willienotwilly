"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { animate, type AnimationPlaybackControls } from "motion/react";

import { HEADER_OFFSET, SOCKET_REACH, SUMMARY_ROW_H, useCanvasView, type CanvasView, type NodeGraph } from "../kit";

/** Tiles narrower than this number the parts on the node and list them below it. */
export const NARROW_MAX = 520;
/** Leader length from the node's right edge (socket tips included) to the callout column; clears the output socket's name. */
export const LEAD = 56;

/** The callout column takes spare width first, between these. */
export const LABEL_MIN = 176;
export const LABEL_MAX = 260;
/** Room kept right of the callout column. */
export const LABEL_MARGIN = 20;
/** The tallest settings panel the Gemini models open (five 22px rows): wide tiles always leave room for it. */
const PANEL_BUDGET = 6 + 5 * 22 + 4 * 4 + 8;

export interface Frame {
  x: number;
  y: number;
  zoom: number;
}

interface FramingOptions {
  rootRef: RefObject<HTMLDivElement | null>;
  graph: NodeGraph;
  nodeId: string;
  /** The settings panel is open (narrow tiles frame what is shown, wide tiles always leave room for it). */
  expanded: boolean;
  reducedMotion: boolean;
}

/**
 * The camera for the anatomy: the node large, room on its right for the
 * callout column (or under it for the legend on phones), and its inputs'
 * noodles reaching in from the left edge. The canvas fits to it on every tile
 * resize; content changes (settings opening on a phone, a new model's fields,
 * a resize) ease the camera to the new frame.
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
    const card = el?.querySelector<HTMLElement>("[data-media-card]");
    if (!root || !node || !el || !card) return null;
    const W = root.clientWidth;
    const H = root.clientHeight;
    if (W <= 0 || H <= 0) return null;

    const narrow = W < NARROW_MAX;
    const gap = el.querySelector<HTMLElement>("[data-gap-row]");
    const panel = el.querySelector<HTMLElement>("[data-controls-card] .nb-bg-panel");
    // Wide tiles keep room for the biggest panel, so opening it or changing the
    // model never moves the camera; phones frame what is shown.
    const panelH = narrow ? (expandedRef.current ? (panel?.offsetHeight ?? 0) : 0) : Math.max(PANEL_BUDGET, panel?.offsetHeight ?? 0);
    const box = {
      x: node.x.get() - SOCKET_REACH,
      y: node.y.get() - HEADER_OFFSET,
      w: node.width.get() + 2 * SOCKET_REACH,
      h: HEADER_OFFSET + card.offsetHeight + (gap?.offsetHeight ?? 8) + SUMMARY_ROW_H + 2 + panelH,
    };

    if (narrow) {
      const legend = root.querySelector<HTMLElement>("[data-anat-legend]");
      const top = 40;
      const bottom = (legend?.offsetHeight ?? 0) + 14;
      const left = 32;
      // The output socket's highlight ring reaches past the swell.
      const right = 26;
      const zoom = Math.min(1.1, (W - left - right) / box.w, (H - top - bottom) / box.h);
      return {
        zoom,
        x: left + (W - left - right - box.w * zoom) / 2 - box.x * zoom,
        y: top + (H - top - bottom - box.h * zoom) / 2 - box.y * zoom,
      };
    }

    const top = 40;
    const bottom = 32;
    const gutter = 64;
    const fixed = LEAD + LABEL_MIN + LABEL_MARGIN + gutter;
    const zoom = Math.min(1.45, (H - top - bottom) / box.h, (W - fixed) / box.w);
    // Spare width widens the callouts first (fewer lines each), then most of
    // the rest goes left, where the inputs' noodles come in.
    let spare = Math.max(0, W - fixed - box.w * zoom);
    spare -= Math.min(spare, LABEL_MAX - LABEL_MIN);
    const left = gutter + spare * 0.72;
    return {
      zoom,
      x: left - box.x * zoom,
      y: top + (H - top - bottom - box.h * zoom) / 2 - box.y * zoom,
    };
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

  return { view, reframe, hold };
}
