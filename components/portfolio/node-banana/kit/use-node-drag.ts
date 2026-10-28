"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion, type MotionValue } from "motion/react";

import { useCanvas } from "./canvas";
import type { NodeGraph } from "./graph";
import { TRAIL_EASE, TRAIL_MAX } from "./tokens";

/** Pointer-downs on these never start a node drag (React Flow's `nodrag`). */
export const NO_DRAG = "button,input,textarea,select,a,label,[contenteditable],[role='slider'],[data-nodrag],.nodrag";
const DRAG_SLOP = 3;
/** React Flow moves a selected node 5px per arrow press, 20px with shift. */
const KEY_STEP = 5;

/** A drag ends with a click on the node or whatever was under the pointer; swallow it so a drag never toggles a card. */
function suppressNextClick() {
  const stop = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
}

export interface NodeDragOptions {
  disabled?: boolean;
  /** Pointer went down on the node (React Flow selects on press). */
  onSelect?: () => void;
  onDragStart?: () => void;
  /** After a drag; `moved` is false for a plain click. */
  onDragEnd?: (moved: boolean) => void;
  /** Rewrite a proposed position (snapping, bounds). */
  constrain?: (x: number, y: number) => { x: number; y: number };
}

interface Press {
  pointerId: number;
  px: number;
  py: number;
  x: number;
  y: number;
  zoom: number;
  moved: boolean;
  /** The node: it takes the pointer capture once the press becomes a drag. */
  el: HTMLElement;
  /** Drops the window listeners that end a press released off the node. */
  detach: () => void;
}

/**
 * Drag a graph node by pointer, in world px (pointer delta ÷ zoom), with the
 * arrow keys as React Flow has them. Writes the node's motion values, so
 * noodles and the trailing controls follow without React renders.
 */
export function useNodeDrag(graph: NodeGraph | null | undefined, id: string | undefined, options: NodeDragOptions = {}) {
  const view = useCanvas();
  const [dragging, setDragging] = useState(false);
  const state = useRef<Press | null>(null);
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });
  useEffect(() => () => state.current?.detach(), []);

  const finish = useCallback((pointerId: number) => {
    const s = state.current;
    if (!s || s.pointerId !== pointerId) return;
    state.current = null;
    s.detach();
    setDragging(false);
    if (s.moved) suppressNextClick();
    opts.current.onDragEnd?.(s.moved);
  }, []);

  const move = useCallback(
    (x: number, y: number) => {
      if (!graph || !id) return;
      const next = opts.current.constrain ? opts.current.constrain(x, y) : { x, y };
      graph.moveTo(id, Math.round(next.x), Math.round(next.y));
    },
    [graph, id],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (opts.current.disabled || !graph || !id) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if ((event.target as Element).closest(NO_DRAG)) return;
      const node = graph.node(id);
      if (!node) return;
      opts.current.onSelect?.();
      state.current?.detach();
      // The pointer is only captured once the press turns into a drag: capturing
      // on press would retarget the click to the node, so a summary row or any
      // other clickable content inside it would never hear it.
      const { pointerId } = event;
      const release = (up: PointerEvent) => finish(up.pointerId);
      window.addEventListener("pointerup", release, true);
      window.addEventListener("pointercancel", release, true);
      state.current = {
        pointerId,
        px: event.clientX,
        py: event.clientY,
        x: node.x.get(),
        y: node.y.get(),
        zoom: view?.zoom.get() ?? 1,
        moved: false,
        el: event.currentTarget,
        detach: () => {
          window.removeEventListener("pointerup", release, true);
          window.removeEventListener("pointercancel", release, true);
        },
      };
    },
    [graph, id, view, finish],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const s = state.current;
      if (!s || event.pointerId !== s.pointerId) return;
      // A mouse released outside the window never sends its pointerup.
      if (event.pointerType === "mouse" && event.buttons === 0) {
        finish(s.pointerId);
        return;
      }
      const dx = event.clientX - s.px;
      const dy = event.clientY - s.py;
      if (!s.moved) {
        if (Math.hypot(dx, dy) < DRAG_SLOP) return;
        s.moved = true;
        try {
          s.el.setPointerCapture(s.pointerId);
        } catch {
          // The pointer already lifted; its pointerup ends the press.
        }
        setDragging(true);
        opts.current.onDragStart?.();
      }
      move(s.x + dx / s.zoom, s.y + dy / s.zoom);
    },
    [move, finish],
  );

  const end = useCallback((event: ReactPointerEvent<HTMLElement>) => finish(event.pointerId), [finish]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (opts.current.disabled || !graph || !id || event.target !== event.currentTarget) return;
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (dir) {
        event.preventDefault();
        const p = graph.position(id);
        const step = KEY_STEP * (event.shiftKey ? 4 : 1);
        if (p) move(p.x + dir[0] * step, p.y + dir[1] * step);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        opts.current.onSelect?.();
      }
    },
    [graph, id, move],
  );

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onKeyDown,
    },
  };
}

/**
 * The controls card trails the media card while the node moves, as if towed
 * (NodeShell's useTrailingOffset): a smoothed copy of the position eases
 * toward it each frame (0.4 per 16.7ms, never more than 18px behind), and the
 * difference is written straight to the element's transform.
 */
export function useTrailingOffset(x: MotionValue<number> | undefined, y: MotionValue<number> | undefined, enabled = true) {
  const el = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (!x || !y || !enabled || reducedMotion) return;
    let target = { x: x.get(), y: y.get() };
    const smoothed = { ...target };
    let frame: number | null = null;
    let last = 0;
    let written: HTMLElement | null = null;

    const step = (now: number) => {
      frame = null;
      const dt = Math.min(64, now - last);
      last = now;
      const k = 1 - Math.pow(1 - TRAIL_EASE, dt / 16.7);
      smoothed.x += (target.x - smoothed.x) * k;
      smoothed.y += (target.y - smoothed.y) * k;
      let dx = smoothed.x - target.x;
      let dy = smoothed.y - target.y;
      const dist = Math.hypot(dx, dy);
      if (dist > TRAIL_MAX) {
        dx *= TRAIL_MAX / dist;
        dy *= TRAIL_MAX / dist;
        smoothed.x = target.x + dx;
        smoothed.y = target.y + dy;
      }
      const node = el.current;
      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
        smoothed.x = target.x;
        smoothed.y = target.y;
        if (node) {
          node.style.transform = "";
          node.style.willChange = "";
        }
        return;
      }
      if (node) {
        node.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
        node.style.willChange = "transform";
        written = node;
      }
      frame = requestAnimationFrame(step);
    };

    const update = () => {
      const next = { x: x.get(), y: y.get() };
      if (next.x === target.x && next.y === target.y) return;
      target = next;
      if (frame === null) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };
    const offX = x.on("change", update);
    const offY = y.on("change", update);
    return () => {
      offX();
      offY();
      if (frame !== null) cancelAnimationFrame(frame);
      if (written) {
        written.style.transform = "";
        written.style.willChange = "";
      }
    };
  }, [x, y, enabled, reducedMotion]);

  return el;
}
