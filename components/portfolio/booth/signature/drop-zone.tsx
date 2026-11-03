"use client";

import { useLayoutEffect, useRef, useState } from "react";

// The drop zone's frame (studiovoice/app/Sources/Booth/UI/PopoverRootView.swift `FrameBorder`),
// drawn round the tile: the name sits in it as it does in the popover. The kit's
// BoothFrameBorder holds the popover's 10 pt radius; this one takes the tile's.

/** CSS `dotted` at 1.5 pt: dots on a 3 pt pitch, a whole number of them round the frame. */
const DOT_PITCH = 3;

/** A rounded rectangle as a path, from its top edge, clockwise. */
function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

/**
 * The dotted frame, which joins into a solid line and takes the `fill` tint while a file is
 * over it (signature-demo.css `.bsig-zone`). Its dash pattern counts in dots (`pathLength`),
 * so the dots close evenly round the corners at any size. Decorative.
 */
export function DropZone({ over, radius, className }: { over: boolean; radius: number; className?: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const line = 1.5;
  const w = size.width - line;
  const h = size.height - line;
  const r = Math.max(0, radius - line / 2);
  const perimeter = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
  const dots = Math.max(1, Math.round(perimeter / DOT_PITCH));

  return (
    <svg ref={svg} aria-hidden className={className} overflow="visible">
      {w > 0 && h > 0 && (
        <path className="bsig-zone" data-over={over || undefined} d={roundedRect(line / 2, line / 2, w, h, r)} pathLength={dots} />
      )}
    </svg>
  );
}
