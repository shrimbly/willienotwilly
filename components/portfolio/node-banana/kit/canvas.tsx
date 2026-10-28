"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { motion, motionValue, type MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

import type { Bounds, Point } from "./geometry";

export type Padding = number | { top: number; right: number; bottom: number; left: number };

export interface CanvasViewOptions {
  /** Starting view before any fit: world point at the canvas origin and the zoom. */
  initial?: { x: number; y: number; zoom: number };
  /** Bounds to fit on mount and on every resize until the visitor pans or zooms. */
  fit?: Bounds | (() => Bounds | null);
  padding?: Padding;
  minZoom?: number;
  maxZoom?: number;
  /** Highest zoom a fit may pick (default 1). */
  fitMaxZoom?: number;
  /** Lowest zoom a fit may pick (default minZoom). Below it the fit centres instead. */
  fitMinZoom?: number;
}

function pad(p: Padding | undefined) {
  if (p === undefined) return { top: 40, right: 40, bottom: 40, left: 40 };
  return typeof p === "number" ? { top: p, right: p, bottom: p, left: p } : p;
}

/**
 * The canvas camera: screen = pan + zoom × world. Pan and zoom are motion
 * values, so gestures write the transform without re-rendering.
 */
export class CanvasView {
  readonly x: MotionValue<number>;
  readonly y: MotionValue<number>;
  readonly zoom: MotionValue<number>;
  element: HTMLElement | null = null;
  width = 0;
  height = 0;
  /** Set once the visitor pans or zooms; fits on resize stop then. */
  interacted = false;
  options: CanvasViewOptions;

  constructor(options: CanvasViewOptions = {}) {
    this.options = options;
    const initial = options.initial ?? { x: 0, y: 0, zoom: 1 };
    this.x = motionValue(initial.x);
    this.y = motionValue(initial.y);
    this.zoom = motionValue(initial.zoom);
  }

  /** Canvas wires its element and size in here. */
  attach(element: HTMLElement | null) {
    this.element = element;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /** Marks the view as the visitor's; returns true the first time. */
  markInteracted(): boolean {
    if (this.interacted) return false;
    this.interacted = true;
    return true;
  }

  get minZoom() {
    return this.options.minZoom ?? 0.2;
  }

  get maxZoom() {
    return this.options.maxZoom ?? 2;
  }

  setView({ x, y, zoom }: { x: number; y: number; zoom: number }) {
    this.x.set(x);
    this.y.set(y);
    this.zoom.set(zoom);
  }

  panBy(dx: number, dy: number) {
    this.x.set(this.x.get() + dx);
    this.y.set(this.y.get() + dy);
  }

  /** Zoom by `factor`, keeping the canvas-local point (px, py) still. */
  zoomAround(factor: number, px: number, py: number) {
    const z0 = this.zoom.get();
    const z = Math.min(this.maxZoom, Math.max(this.minZoom, z0 * factor));
    if (z === z0) return;
    this.x.set(px - (px - this.x.get()) * (z / z0));
    this.y.set(py - (py - this.y.get()) * (z / z0));
    this.zoom.set(z);
  }

  /** Zoom by `factor` about a point in client (viewport) px. */
  zoomAt(factor: number, clientX: number, clientY: number) {
    const rect = this.element?.getBoundingClientRect();
    if (!rect) return;
    this.zoomAround(factor, clientX - rect.left, clientY - rect.top);
  }

  /** Zoom about the canvas centre (for +/− buttons). */
  zoomBy(factor: number) {
    this.zoomAround(factor, this.width / 2, this.height / 2);
  }

  toWorld(clientX: number, clientY: number): Point {
    const rect = this.element?.getBoundingClientRect();
    const z = this.zoom.get();
    return {
      x: (clientX - (rect?.left ?? 0) - this.x.get()) / z,
      y: (clientY - (rect?.top ?? 0) - this.y.get()) / z,
    };
  }

  /** Fit `bounds` (default: the fit option) into the canvas. Returns false before the canvas is measured. */
  fit(bounds?: Bounds | null, overrides: Partial<Pick<CanvasViewOptions, "padding" | "fitMaxZoom" | "fitMinZoom">> = {}): boolean {
    const target = bounds ?? resolveFit(this.options.fit);
    if (!target || this.width <= 0 || this.height <= 0 || target.width <= 0 || target.height <= 0) return false;
    const p = pad(overrides.padding ?? this.options.padding);
    const availW = Math.max(1, this.width - p.left - p.right);
    const availH = Math.max(1, this.height - p.top - p.bottom);
    const maxZ = overrides.fitMaxZoom ?? this.options.fitMaxZoom ?? 1;
    const minZ = overrides.fitMinZoom ?? this.options.fitMinZoom ?? this.minZoom;
    const z = Math.min(maxZ, Math.max(minZ, Math.min(availW / target.width, availH / target.height)));
    this.setView({
      zoom: z,
      x: p.left + (availW - target.width * z) / 2 - target.x * z,
      y: p.top + (availH - target.height * z) / 2 - target.y * z,
    });
    return true;
  }

  configure(options: CanvasViewOptions) {
    this.options = options;
  }

  /** Forget the visitor's pan and zoom and fit again. */
  reset() {
    this.interacted = false;
    this.fit();
  }
}

function resolveFit(fit: CanvasViewOptions["fit"]): Bounds | null {
  if (!fit) return null;
  return typeof fit === "function" ? fit() : fit;
}

/** One camera for the component's lifetime; options are read live. */
export function useCanvasView(options: CanvasViewOptions = {}): CanvasView {
  const [view] = useState(() => new CanvasView(options));
  useEffect(() => {
    view.configure(options);
  });
  return view;
}

const CanvasContext = createContext<CanvasView | null>(null);

/** The camera of the canvas this component renders in, if any. */
export function useCanvas(): CanvasView | null {
  return useContext(CanvasContext);
}

/** Pointer-downs on these never start a pan. */
const NO_PAN = "[data-nb-node],[data-nb-nopan],button,input,textarea,select,a,label,[contenteditable],[role='slider']";
const TAP_SLOP = 3;

export interface CanvasProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  view: CanvasView;
  /** World-space content: noodles and nodes. */
  children?: ReactNode;
  /** Screen-space content drawn over the world (chrome, pills, minimap). */
  overlay?: ReactNode;
  /** Drag on empty canvas pans (default true). */
  pannable?: boolean;
  /** ⌘/ctrl + wheel, trackpad pinch and two-finger pinch zoom (default true). Plain wheel always scrolls the page. */
  zoomable?: boolean;
  /** Dotted ground that pans with the view (default true). */
  grid?: boolean;
  /** The dots also scale with the zoom, as React Flow's Background does (default true). False keeps the 20px grid at any zoom, as the landing site draws it. */
  gridZoom?: boolean;
  /** A press-and-release on empty canvas (deselect). */
  onPaneClick?: () => void;
  /** Called on the first pan or zoom by the visitor. */
  onInteract?: () => void;
}

interface Gesture {
  kind: "pan" | "pinch" | "tap";
  x: number;
  y: number;
  dist: number;
  moved: boolean;
}

/**
 * The dotted canvas: #171717 with #404040 dots on a 20px grid, and a world
 * layer under a pan/zoom transform. Drag empty space to pan; pinch or
 * ⌘/ctrl + wheel to zoom. A plain wheel is left to the page.
 */
export function Canvas({
  view,
  children,
  overlay,
  pannable = true,
  zoomable = true,
  grid = true,
  gridZoom = true,
  onPaneClick,
  onInteract,
  className,
  style,
  ...rest
}: CanvasProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const [panning, setPanning] = useState(false);
  const [fitted, setFitted] = useState(!view.options.fit);
  const callbacks = useRef({ onPaneClick, onInteract });
  useEffect(() => {
    callbacks.current = { onPaneClick, onInteract };
  });

  // The dots pan and scale with the view, as React Flow's Background does.
  useEffect(() => {
    const el = ref.current;
    if (!el || !grid) return;
    const paint = () => {
      const z = gridZoom ? view.zoom.get() : 1;
      el.style.setProperty("--nb-grid-gap", `${20 * z}px`);
      el.style.setProperty("--nb-grid-x", `${view.x.get() - 10 * z}px`);
      el.style.setProperty("--nb-grid-y", `${view.y.get() - 10 * z}px`);
      el.style.setProperty("--nb-grid-dot", `${Math.max(0.3, 0.6 * Math.min(z, 1.4))}px`);
    };
    paint();
    const offs = [view.x.on("change", paint), view.y.on("change", paint), view.zoom.on("change", paint)];
    return () => offs.forEach((off) => off());
  }, [view, grid, gridZoom]);

  // Measure, and fit until the visitor takes over.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    view.attach(el);
    const ro = new ResizeObserver(([entry]) => {
      view.resize(entry.contentRect.width, entry.contentRect.height);
      if (view.options.fit && !view.interacted) {
        if (view.fit()) setFitted(true);
        else requestAnimationFrame(() => view.fit() && setFitted(true));
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (view.element === el) view.attach(null);
    };
  }, [view]);

  // ⌘/ctrl + wheel (and trackpad pinch, which arrives as ctrl + wheel) zooms; a
  // plain wheel is never captured. Safari's trackpad pinch comes as gesture events.
  useEffect(() => {
    const el = ref.current;
    if (!el || !zoomable) return;
    const touched = () => {
      if (view.markInteracted()) callbacks.current.onInteract?.();
    };
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 20 : event.deltaY;
      const rate = event.ctrlKey && Math.abs(delta) < 50 ? 0.01 : 0.002;
      view.zoomAt(2 ** Math.max(-0.5, Math.min(0.5, -delta * rate)), event.clientX, event.clientY);
      touched();
    };
    let lastScale = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (event: Event) => {
      const e = event as Event & { scale: number; clientX: number; clientY: number };
      event.preventDefault();
      view.zoomAt(e.scale / lastScale, e.clientX, e.clientY);
      lastScale = e.scale;
      touched();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
  }, [view, zoomable]);

  const touched = () => {
    if (view.markInteracted()) onInteract?.();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    rest.onPointerDown?.(event);
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const onPane = !(event.target as Element).closest(NO_PAN);
    if (!onPane && pointers.current.size === 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && zoomable) {
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { kind: "pinch", x: 0, y: 0, dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), moved: true };
      setPanning(false);
      return;
    }
    if (pts.length > 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind: pannable ? "pan" : "tap", x: event.clientX, y: event.clientY, dist: 0, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    rest.onPointerMove?.(event);
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (g.dist > 0) view.zoomAt(dist / g.dist, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      g.dist = dist;
      touched();
      return;
    }
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    if (!g.moved) {
      g.moved = true;
      if (g.kind === "pan") setPanning(true);
    }
    if (g.kind !== "pan") return;
    view.panBy(dx, dy);
    g.x = event.clientX;
    g.y = event.clientY;
    touched();
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    const left = [...pointers.current.values()];
    if (g?.kind === "pinch" && left.length === 1) {
      // One finger lifted mid-pinch: the other carries on as a pan.
      gesture.current = { kind: pannable ? "pan" : "tap", x: left[0].x, y: left[0].y, dist: 0, moved: true };
      if (pannable) setPanning(true);
      return;
    }
    if (left.length > 0) return;
    if (g && !g.moved && !cancelled && g.kind !== "pinch") onPaneClick?.();
    gesture.current = null;
    setPanning(false);
  };

  return (
    <div
      ref={ref}
      {...rest}
      className={cn("nb-canvas", grid && "nb-dot-grid", className)}
      data-pannable={pannable ? "" : undefined}
      data-panning={panning ? "" : undefined}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        rest.onPointerUp?.(event);
        release(event, false);
      }}
      onPointerCancel={(event) => {
        rest.onPointerCancel?.(event);
        release(event, true);
      }}
    >
      <CanvasContext.Provider value={view}>
        <motion.div
          className="nb-world"
          style={{ x: view.x, y: view.y, scale: view.zoom, visibility: fitted ? undefined : "hidden" }}
        >
          {children}
        </motion.div>
        {overlay}
      </CanvasContext.Provider>
    </div>
  );
}
