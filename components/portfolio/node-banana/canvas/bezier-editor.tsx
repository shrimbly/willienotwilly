"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "@/lib/utils";

// Node Banana's CubicBezierEditor (src/components/CubicBezierEditor.tsx), the
// "node" tone: lime curve on a dark square, two grab handles, arrow keys.

export type Bezier = [number, number, number, number];
type Handle = "p1" | "p2";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const ARROWS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export function BezierEditor({ value, onChange, className }: { value: Bezier; onChange: (value: Bezier) => void; className?: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const current = useRef(value);
  const grab = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<Handle | null>(null);
  const change = useRef(onChange);

  useEffect(() => {
    current.current = value;
    change.current = onChange;
  });

  const pointerAt = (clientX: number, clientY: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return { x: (clientX - rect.left) / rect.width, y: 1 - (clientY - rect.top) / rect.height };
  };

  // Window listeners, as the app has them, so a drag can leave the square.
  useEffect(() => {
    if (!dragging) return;
    let frame: number | null = null;
    let pending: Bezier | null = null;
    const flush = () => {
      frame = null;
      if (pending) change.current(pending);
      pending = null;
    };
    const onMove = (event: globalThis.PointerEvent) => {
      const rect = box.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const x = clamp((event.clientX - rect.left) / rect.width - grab.current.x);
      const y = clamp(1 - (event.clientY - rect.top) / rect.height - grab.current.y);
      const v = current.current;
      pending = dragging === "p1" ? [x, y, v[2], v[3]] : [v[0], v[1], x, y];
      current.current = pending;
      if (frame === null) frame = requestAnimationFrame(flush);
    };
    const onUp = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      flush();
      setDragging(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  const start = (handle: Handle, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const p = pointerAt(event.clientX, event.clientY);
    const v = current.current;
    const [hx, hy] = handle === "p1" ? [v[0], v[1]] : [v[2], v[3]];
    // Where the pointer held the handle: a press never makes it jump.
    grab.current = p ? { x: p.x - hx, y: p.y - hy } : { x: 0, y: 0 };
    setDragging(handle);
  };

  const onKey = (handle: Handle, event: KeyboardEvent<HTMLButtonElement>) => {
    if (!ARROWS.has(event.key) || event.metaKey || event.ctrlKey || event.altKey) return;
    // The node would move with them otherwise.
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 0.1 : 0.01;
    const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const dy = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
    const v = current.current;
    const i = handle === "p1" ? 0 : 2;
    const x = round3(clamp(v[i] + dx));
    const y = round3(clamp(v[i + 1] + dy));
    if (x === v[i] && y === v[i + 1]) return;
    onChange(handle === "p1" ? [x, y, v[2], v[3]] : [v[0], v[1], x, y]);
  };

  const [x1, y1, x2, y2] = value;
  const c1 = { x: x1 * 100, y: (1 - y1) * 100 };
  const c2 = { x: x2 * 100, y: (1 - y2) * 100 };

  const handle = (id: Handle, label: string, x: number, y: number) => (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "nodrag absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border border-neutral-900/80 bg-lime-300/80 shadow transition active:scale-95 active:cursor-grabbing",
        "focus-visible:ring-2 focus-visible:ring-lime-300/80 focus-visible:outline-none",
        dragging === id && "ring-2 ring-lime-300/80",
      )}
      style={{ left: `${(x * 100).toFixed(2)}%`, top: `${((1 - y) * 100).toFixed(2)}%` }}
      onPointerDown={(e) => start(id, e)}
      onKeyDown={(e) => onKey(id, e)}
    />
  );

  return (
    <div className={cn("rounded-lg border border-neutral-700 bg-neutral-900/50 p-2", className)}>
      <div ref={box} className="relative aspect-square w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full select-none" aria-hidden>
          <rect x="0" y="0" width="100" height="100" className="fill-neutral-950 stroke-white/12" strokeWidth="0.8" rx="2" />
          <g className="stroke-white/12" strokeWidth="0.4" strokeOpacity="0.6">
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="50" y1="0" x2="50" y2="100" />
          </g>
          <line x1="0" y1="100" x2="100" y2="0" className="stroke-white/12" strokeWidth="0.6" strokeDasharray="4 4" strokeOpacity="0.7" />
          <g className="stroke-white/35" strokeWidth="0.8">
            <line x1="0" y1="100" x2={c1.x} y2={c1.y} />
            <line x1="100" y1="0" x2={c2.x} y2={c2.y} />
          </g>
          <path
            d={`M0 100 C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, 100 0`}
            fill="none"
            stroke="var(--nb-handle-easeCurve)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {handle("p1", "Adjust control point 1", x1, y1)}
        {handle("p2", "Adjust control point 2", x2, y2)}
      </div>
    </div>
  );
}
