"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { MotionValue } from "motion/react";

import { createBezierEasing } from "@/lib/easy-peasy-ease/easing-functions";
import type { Bezier } from "@/lib/easy-peasy-ease/easing-presets";
import { cn } from "@/lib/utils";

import { followValue } from "./motion-value-utils";

/**
 * Port of easy-peasy-ease/components/CubicBezierEditor.tsx (working tree).
 *
 * x is output-time progress, y is source progress, so the slope is playback
 * speed. Changes from the product:
 * - Colours come from the scope's CSS variables (--background, --border,
 *   --muted-foreground, --primary) instead of getComputedStyle(<html>), so the
 *   editor themes correctly inside EpeRoot. The oklch->rgb converter and the
 *   <html> MutationObserver are gone.
 * - 16:9 below 640px / square above is driven by the EpeRoot container, not
 *   the viewport (`aspect` forces one or the other).
 * - Optional `progress` draws a dot riding the curve at (p, ease(p)).
 * - Dev-only drag logging removed.
 */
interface CubicBezierEditorProps {
  value: Bezier;
  /** rAF-coalesced while dragging; immediate for keyboard nudges. */
  onChange: (value: Bezier) => void;
  /** On pointer up and after each keyboard nudge. */
  onCommit?: (value: Bezier) => void;
  disabled?: boolean;
  className?: string;
  /** "responsive" (default): 16:9 when the EpeRoot is narrower than 640px, square above. */
  aspect?: "responsive" | "square" | "wide";
  /** Extra classes for the plot box (e.g. "max-w-none" to drop the 28rem cap). */
  plotClassName?: string;
  /** "Point 1 x, y" readout. Default: shown when the EpeRoot is 640px or wider. */
  readout?: boolean;
  /** Output progress 0–1 (number or motion value); draws a dot at (p, ease(p)). */
  progress?: number | MotionValue<number>;
  /** Faint guides from the progress dot to both axes. */
  progressGuides?: boolean;
}

export const CubicBezierEditor = memo(CubicBezierEditorComponent);

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const DEFAULT_SIZE = 320;
const GRID_LINES = Array.from({ length: 15 }, (_, index) => {
  const division = index + 1;
  return {
    position: (division / 16) * 100,
    major: division % 4 === 0,
  };
});

const HANDLE_CLASS =
  "group absolute flex size-10 -translate-x-1/2 -translate-y-1/2 touch-none cursor-grab items-center justify-center rounded-full active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:cursor-not-allowed";
const HANDLE_DOT_CLASS =
  "pointer-events-none size-4 rounded-full border-2 border-background/80 bg-primary/80 shadow transition-[scale,box-shadow] duration-150 group-active:scale-[0.96]";

const ASPECT_CLASS = {
  responsive: "aspect-[16/9] @min-[640px]/epe:aspect-square",
  square: "aspect-square",
  wide: "aspect-[16/9]",
} as const;

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : 0;

function CubicBezierEditorComponent({
  value,
  onChange,
  onCommit,
  disabled = false,
  className,
  aspect = "responsive",
  plotClassName,
  readout,
  progress,
  progressGuides = false,
}: CubicBezierEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  const draggingHandleRef = useRef<"p1" | "p2" | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<"p1" | "p2" | null>(null);
  const commitFrameRef = useRef<number | null>(null);
  const pendingValueRef = useRef<{ value: Bezier; capturedAt: number } | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const guideXRef = useRef<SVGLineElement | null>(null);
  const guideYRef = useRef<SVGLineElement | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const flushPendingChange = useCallback(() => {
    commitFrameRef.current = null;
    if (!pendingValueRef.current) return;
    const { value: nextValue } = pendingValueRef.current;
    onChange(nextValue);
    pendingValueRef.current = null;
  }, [onChange]);

  const scheduleCommit = useCallback(() => {
    if (commitFrameRef.current !== null) return;
    commitFrameRef.current = window.requestAnimationFrame(flushPendingChange);
  }, [flushPendingChange]);

  useEffect(() => {
    return () => {
      if (commitFrameRef.current !== null) {
        cancelAnimationFrame(commitFrameRef.current);
      }
    };
  }, []);

  const updateHandleFromClient = useCallback(
    (handle: "p1" | "p2", clientX: number, clientY: number) => {
      const container = editorRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const width = rect.width || DEFAULT_SIZE;
      const height = rect.height || DEFAULT_SIZE;
      const normalizedX = clamp((clientX - rect.left) / width);
      const normalizedY = clamp(1 - (clientY - rect.top) / height);
      const current = valueRef.current;
      const nextValue: Bezier =
        handle === "p1"
          ? [normalizedX, normalizedY, current[2], current[3]]
          : [current[0], current[1], normalizedX, normalizedY];
      pendingValueRef.current = { value: nextValue, capturedAt: now() };
      valueRef.current = nextValue;
      scheduleCommit();
    },
    [scheduleCommit],
  );

  const startDragging = useCallback(
    (handle: "p1" | "p2", event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.preventDefault();
      draggingHandleRef.current = handle;
      setDraggingHandle(handle);
      updateHandleFromClient(handle, event.clientX, event.clientY);
    },
    [disabled, updateHandleFromClient],
  );

  const handleControlPointKeyDown = useCallback(
    (handle: "p1" | "p2", event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const step = event.shiftKey ? 0.1 : 0.01;
      const deltas: Record<string, [number, number]> = {
        ArrowDown: [0, -step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
      };
      const delta = deltas[event.key];
      if (!delta) return;

      event.preventDefault();
      const current = valueRef.current;
      const pointOffset = handle === "p1" ? 0 : 2;
      const nextValue = [...current] as Bezier;
      nextValue[pointOffset] = clamp(current[pointOffset] + delta[0]);
      nextValue[pointOffset + 1] = clamp(current[pointOffset + 1] + delta[1]);
      valueRef.current = nextValue;
      onChange(nextValue);
      onCommit?.(nextValue);
    },
    [disabled, onChange, onCommit],
  );

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const handle = draggingHandleRef.current;
      if (!handle || disabled) return;
      event.preventDefault();
      updateHandleFromClient(handle, event.clientX, event.clientY);
    };

    const stopDragging = () => {
      if (!draggingHandleRef.current) return;
      draggingHandleRef.current = null;
      setDraggingHandle(null);
      onCommit?.(valueRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [disabled, onCommit, updateHandleFromClient]);

  // Progress dot: positioned imperatively so a 60fps motion value never
  // re-renders the editor.
  const ease = useMemo(() => createBezierEasing(value[0], value[1], value[2], value[3]), [value]);
  useEffect(() => {
    const dot = dotRef.current;
    if (progress === undefined || !dot) return;
    const place = (p: number) => {
      const x = clamp(p) * 100;
      const y = (1 - ease(clamp(p))) * 100;
      dot.style.left = `${x}%`;
      dot.style.top = `${y}%`;
      const gx = guideXRef.current;
      const gy = guideYRef.current;
      if (gx && gy) {
        gx.setAttribute("x1", `${x}`);
        gx.setAttribute("x2", `${x}`);
        gx.setAttribute("y2", `${y}`);
        gy.setAttribute("y1", `${y}`);
        gy.setAttribute("x2", `${x}`);
        gy.setAttribute("y2", `${y}`);
      }
    };
    return followValue(progress, place);
  }, [ease, progress]);

  const controlStyles = useMemo(
    () => ({
      p1: {
        left: `${(value[0] * 100).toFixed(2)}%`,
        top: `${((1 - value[1]) * 100).toFixed(2)}%`,
      },
      p2: {
        left: `${(value[2] * 100).toFixed(2)}%`,
        top: `${((1 - value[3]) * 100).toFixed(2)}%`,
      },
    }),
    [value],
  );

  const svgPoints = useMemo(
    () => ({
      start: { x: 0, y: 100 },
      end: { x: 100, y: 0 },
      c1: { x: value[0] * 100, y: (1 - value[1]) * 100 },
      c2: { x: value[2] * 100, y: (1 - value[3]) * 100 },
    }),
    [value],
  );

  const curvePath = useMemo(
    () =>
      `M${svgPoints.start.x} ${svgPoints.start.y} C ${svgPoints.c1.x} ${svgPoints.c1.y}, ${svgPoints.c2.x} ${svgPoints.c2.y}, ${svgPoints.end.x} ${svgPoints.end.y}`,
    [svgPoints],
  );

  const hasProgress = progress !== undefined;

  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      <div className="relative w-full rounded-[8px] border border-border bg-muted/50 p-1">
        {/* Wider-than-tall in narrow tiles to save vertical space; the SVG uses
            preserveAspectRatio="none" and the drag maths normalises by the
            rect's own width/height, so a non-square plot stays correct. */}
        <div
          ref={editorRef}
          className={cn("relative mx-auto w-full max-w-md", ASPECT_CLASS[aspect], plotClassName)}
        >
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm"
            style={{ backgroundColor: "var(--background)" }}
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full select-none"
              aria-hidden="true"
            >
              {GRID_LINES.map(({ position, major }) => (
                <g
                  key={position}
                  style={{ stroke: "var(--border)" }}
                  strokeWidth={major ? 0.35 : 0.18}
                  strokeOpacity={major ? 0.55 : 0.28}
                >
                  <line x1={position} y1="0" x2={position} y2="100" />
                  <line x1="0" y1={position} x2="100" y2={position} />
                </g>
              ))}
              <line
                x1="0"
                y1="100"
                x2="100"
                y2="0"
                style={{ stroke: "var(--border)" }}
                strokeWidth="0.6"
                strokeDasharray="4 4"
                strokeOpacity="0.7"
              />
              {hasProgress && progressGuides && (
                <g
                  style={{ stroke: "var(--primary)" }}
                  strokeWidth="0.5"
                  strokeOpacity="0.45"
                  strokeDasharray="1.5 1.5"
                >
                  <line ref={guideXRef} x1="0" y1="100" x2="0" y2="100" />
                  <line ref={guideYRef} x1="0" y1="100" x2="0" y2="100" />
                </g>
              )}
              <g style={{ stroke: "var(--muted-foreground)" }} strokeWidth="0.8">
                <line x1="0" y1="100" x2={svgPoints.c1.x} y2={svgPoints.c1.y} />
                <line x1="100" y1="0" x2={svgPoints.c2.x} y2={svgPoints.c2.y} />
              </g>
              <path
                d={curvePath}
                fill="none"
                style={{ stroke: "var(--primary)" }}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-sm border"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          {hasProgress && (
            <span
              ref={dotRef}
              aria-hidden="true"
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-[0_0_12px_var(--primary)]"
              style={{ left: "0%", top: "100%" }}
            />
          )}
          <button
            type="button"
            aria-label={`Adjust control point 1, ${value[0].toFixed(2)}, ${value[1].toFixed(2)}`}
            className={HANDLE_CLASS}
            style={controlStyles.p1}
            onPointerDown={(event) => startDragging("p1", event)}
            onKeyDown={(event) => handleControlPointKeyDown("p1", event)}
            disabled={disabled}
          >
            <span className={cn(HANDLE_DOT_CLASS, draggingHandle === "p1" && "ring-2 ring-primary/80")} />
          </button>
          <button
            type="button"
            aria-label={`Adjust control point 2, ${value[2].toFixed(2)}, ${value[3].toFixed(2)}`}
            className={HANDLE_CLASS}
            style={controlStyles.p2}
            onPointerDown={(event) => startDragging("p2", event)}
            onKeyDown={(event) => handleControlPointKeyDown("p2", event)}
            disabled={disabled}
          >
            <span className={cn(HANDLE_DOT_CLASS, draggingHandle === "p2" && "ring-2 ring-primary/80")} />
          </button>
        </div>
      </div>
      {readout !== false && (
        // The product's two-column line under the plot. Its readout always has
        // the inspector's full width (328px+); here the editor can be as narrow
        // as a height-capped plot, so the line keeps its max-content width and
        // overhangs the plot evenly instead of wrapping each point.
        <div
          className={cn(
            "justify-center whitespace-nowrap",
            readout ? "flex" : "hidden @min-[640px]/epe:flex",
          )}
        >
          <div className="grid w-max min-w-full shrink-0 grid-cols-2 gap-3 font-mono text-xs tabular-nums text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Point 1</span> {value[0].toFixed(2)},{" "}
              {value[1].toFixed(2)}
            </p>
            <p>
              <span className="font-medium text-foreground">Point 2</span> {value[2].toFixed(2)},{" "}
              {value[3].toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
