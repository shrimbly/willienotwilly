"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { ComfyWordmark, ellipsisClass, touchClaim, useCanvas, type TouchClaim } from "../kit";

// ComfyAppNode's controls card (src/components/nodes/ui/ControlsCard.tsx with
// the site's comfy variant): the Comfy wordmark in a 44px icon column, the
// summary row as the toggle, the settings panel under it, and a WidthGrip on
// each edge (WidthGrip.tsx) that resizes the card symmetrically.

/** Controls resize bounds (src/components/nodes/ui/tokens.ts). */
const CONTROLS_MIN_W = 160;
const CONTROLS_RESIZE_MAX_W = 720;

export interface ComfyControlsCardProps {
  title: string;
  values: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** Explicit width in world px; undefined follows the node (node − 24, at most 360). */
  width?: number;
  onWidthChange: (width: number | undefined) => void;
  panelId: string;
  /** A click anywhere on the card (its panel never drags the node, so the node's own select never hears it). */
  onPress?: () => void;
  children: ReactNode;
}

export function ComfyControlsCard({ title, values, expanded, onToggle, width, onWidthChange, panelId, onPress, children }: ComfyControlsCardProps) {
  const card = useRef<HTMLDivElement | null>(null);
  // The width the card lays out at (layout px, so the canvas zoom never enters
  // it): where a grip drag starts, and the grips' value while it follows the node.
  const [laidOut, setLaidOut] = useState(0);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setLaidOut(Math.round(entry.borderBoxSize[0]?.inlineSize ?? el.offsetWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const current = width ?? (laidOut || CONTROLS_MIN_W);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      ref={card}
      data-controls-card
      onClickCapture={onPress}
      className="nb-controls-card overflow-visible"
      style={width !== undefined ? { width, maxWidth: "none" } : undefined}
    >
      {/* The whole row toggles; a drag that starts on it moves the node instead (and swallows the click). */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? "Hide settings" : "Show settings"}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        className="grid h-[28px] min-w-0 cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-[9px] px-2 focus-visible:-outline-offset-2"
      >
        <span className="flex h-4 w-[44px] items-center text-neutral-500">
          <ComfyWordmark className="h-3 w-auto" label="ComfyUI" />
        </span>
        <span className={cn("nb-text-node min-w-0 text-neutral-200", ellipsisClass)}>{title}</span>
        <span className="flex min-w-0 items-center">{values}</span>
        <span aria-hidden className="flex h-4 w-4 items-center justify-center text-neutral-500">
          <ChevronDown
            size={12}
            strokeWidth={2}
            className="transition-transform duration-200 motion-reduce:transition-none"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </span>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        {/* The card no longer clips (the grips reach outside it), so the panel rounds its own corners. */}
        <div className="min-h-0 overflow-hidden rounded-b-[9px]">
          <div id={panelId} className="nodrag nb-bg-panel flex flex-col gap-1 px-2 pt-1.5 pb-2">
            {children}
          </div>
        </div>
      </div>

      <WidthGrip side="left" width={current} explicit={width !== undefined} onChange={onWidthChange} />
      <WidthGrip side="right" width={current} explicit={width !== undefined} onChange={onWidthChange} />
    </div>
  );
}

/**
 * A grab strip along one edge of the controls card. The bar sits at the
 * card's edge and the hit zone reaches 12px past it (the site's hit area);
 * the card is centred, so moving one edge by dx changes the width by 2·dx.
 * Double-click hands the width back to the node. A finger only resizes once
 * it moves sideways: a vertical swipe that starts on the strip scrolls the page.
 */
function WidthGrip({
  side,
  width,
  explicit,
  onChange,
}: {
  side: "left" | "right";
  /** The card's current width in world px. */
  width: number;
  /** The width is the visitor's (not following the node). */
  explicit: boolean;
  onChange: (width: number | undefined) => void;
}) {
  const view = useCanvas();
  const drag = useRef<{ x0: number; w0: number; explicit: boolean; zoom: number; touch: TouchClaim | null; moved: boolean } | null>(null);
  const sign = side === "right" ? 1 : -1;
  const clamp = (w: number) => Math.round(Math.max(CONTROLS_MIN_W, Math.min(CONTROLS_RESIZE_MAX_W, w)));

  const onPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x0: event.clientX, w0: width, explicit, zoom: view?.zoom.get() ?? 1, touch: touchClaim(event), moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d || (d.touch && !d.touch.move(event.clientX, event.clientY))) return;
    d.moved = true;
    const dx = ((event.clientX - d.x0) / d.zoom) * sign;
    const next = clamp(d.w0 + dx * 2);
    if (next !== width || !explicit) onChange(next);
  };
  const end = () => (drag.current = null);
  // The browser took the gesture for the page after all: put the width back.
  const cancel = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) onChange(d.explicit ? d.w0 : undefined);
  };

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize settings (${side} edge)`}
      aria-valuenow={width}
      aria-valuemin={CONTROLS_MIN_W}
      aria-valuemax={CONTROLS_RESIZE_MAX_W}
      title="Drag to resize · double-click to reset"
      tabIndex={0}
      data-nodrag=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={cancel}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange(undefined);
      }}
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        event.stopPropagation();
        onChange(clamp(width + step * sign * (event.shiftKey ? 80 : 20)));
      }}
      className={cn(
        "group/wgrip absolute top-0 bottom-0 z-[2] flex w-[18px] cursor-ew-resize touch-pan-y items-center",
        side === "left" ? "-left-3 justify-end" : "-right-3 justify-start",
      )}
    >
      <i
        aria-hidden
        className="mx-1 block h-6 w-[2px] rounded-full bg-neutral-500/0 transition-colors group-hover/wgrip:bg-neutral-400/80 group-focus-visible/wgrip:bg-neutral-400/80 group-active/wgrip:bg-neutral-300"
      />
    </span>
  );
}
