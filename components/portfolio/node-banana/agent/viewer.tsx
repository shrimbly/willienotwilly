"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Check, ChevronLeft, ChevronRight, LocateFixed, MessageSquarePlus, X } from "lucide-react";

import { AGENT_NODES, BASE_PROMPT, LOCATION_LINES } from "@/lib/node-banana/agent-script";
import { cn } from "@/lib/utils";

import { CHROME_SURFACE, MODEL_DISPLAY_NAMES } from "../kit";

// MediaViewer.tsx as a run's results open it: the stage, the strip of every
// output under it, and the rail with the prompt, its actions and details.

export interface ViewerItem {
  key: string;
  nodeId: string;
  batch: number;
}

const STRIP_ACTIVE = 72;
const STRIP_NEAR = 52;
const STRIP_FAR = 40;
const STRIP_GAP = 4;
const EASE = "cubic-bezier(0.2,0,0,1)";
const LIGHTBOX_BUTTON =
  "bg-neutral-900/80 backdrop-blur-md border border-white/10 text-neutral-100 shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:bg-neutral-800 hover:text-white transition-colors";
const RAIL_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md bg-white/4 text-neutral-200 transition-colors enabled:cursor-pointer hover:bg-white/8 disabled:opacity-30 disabled:hover:bg-white/4";

function stripTileSize(index: number, active: number): number {
  if (index === active) return STRIP_ACTIVE;
  return Math.abs(index - active) === 1 ? STRIP_NEAR : STRIP_FAR;
}

function stripShift(count: number, active: number): number {
  let x = 0;
  let centre = 0;
  for (let i = 0; i < count; i++) {
    const size = stripTileSize(i, active);
    if (i === active) centre = x + size / 2;
    x += size + STRIP_GAP;
  }
  return Math.round(Math.max(0, x - STRIP_GAP) / 2 - centre);
}

const NODE_BY_ID = new Map(AGENT_NODES.map((node) => [node.id, node]));

function promptOf(nodeId: string): string {
  const concept = ["ag-c0", "ag-c1", "ag-c2", "ag-c3"].indexOf(nodeId);
  return concept >= 0 ? LOCATION_LINES[concept] : BASE_PROMPT;
}

export function MediaViewer({
  items,
  index,
  runs,
  onIndex,
  onClose,
  attached,
  onToggleAttach,
  onShowOnCanvas,
}: {
  items: ViewerItem[];
  index: number;
  runs: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  attached: (item: ViewerItem) => boolean;
  onToggleAttach: (item: ViewerItem) => void;
  onShowOnCanvas: (item: ViewerItem) => void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    return () => {
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);

  const current = items[index];
  if (!current) return null;
  const node = NODE_BY_ID.get(current.nodeId)!;
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  const added = attached(current);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowLeft" && hasPrev) {
      event.preventDefault();
      onIndex(index - 1);
    } else if (event.key === "ArrowRight" && hasNext) {
      event.preventDefault();
      onIndex(index + 1);
    }
  };

  const details: Array<[string, string]> = [
    ["Node", node.title],
    ["Model", node.model ? MODEL_DISPLAY_NAMES[node.model] : ""],
    ...(runs > 1 ? ([["Run", `${current.batch + 1} of ${runs}`]] as Array<[string, string]>) : []),
  ];

  const arrow = (side: "prev" | "next") => (
    <button
      type="button"
      aria-label={side === "prev" ? "Previous" : "Next"}
      disabled={side === "prev" ? !hasPrev : !hasNext}
      onClick={() => onIndex(side === "prev" ? index - 1 : index + 1)}
      className={cn(
        "absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full enabled:cursor-pointer disabled:opacity-0",
        LIGHTBOX_BUTTON,
        side === "prev" ? "left-3" : "right-3",
      )}
    >
      {side === "prev" ? <ChevronLeft size={20} strokeWidth={2} /> : <ChevronRight size={20} strokeWidth={2} />}
    </button>
  );

  return (
    <div
      className="nb-agent-backdrop absolute inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 @3xl:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${node.title}'s image`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="nb-agent-viewer flex h-full w-full items-stretch gap-6 focus:outline-none"
      >
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
          <div className="flex w-full shrink-0 items-center justify-between @3xl:hidden">
            <span className="nb-font-mono text-[11px] text-neutral-400 tabular-nums">
              {index + 1} of {items.length}
            </span>
            <button type="button" aria-label="Close" onClick={onClose} className={RAIL_BUTTON}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="relative min-h-0 w-full flex-1 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- the 640px output itself */}
            <img
              key={current.key}
              src={node.output!.src}
              alt={promptOf(node.id)}
              draggable={false}
              className="nb-agent-fade-in absolute inset-0 m-auto max-h-full max-w-full rounded-md object-contain"
            />
            {arrow("prev")}
            {arrow("next")}
          </div>
          <div className="flex h-[84px] w-full shrink-0 items-center justify-center overflow-hidden">
            <div
              className="flex items-center gap-1 transition-transform duration-[240ms] motion-reduce:transition-none"
              style={{ transform: `translateX(${stripShift(items.length, index)}px)`, transitionTimingFunction: EASE }}
            >
              {items.map((item, i) => {
                const size = stripTileSize(i, index);
                const active = i === index;
                const near = Math.abs(i - index) === 1;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-label={NODE_BY_ID.get(item.nodeId)?.title}
                    aria-current={active ? "true" : undefined}
                    onClick={() => onIndex(i)}
                    style={{ width: size, height: size, transitionTimingFunction: EASE }}
                    className={cn(
                      "nb-bg-well relative shrink-0 cursor-pointer overflow-hidden transition-[width,height,opacity,border-radius,box-shadow] duration-[240ms] motion-reduce:transition-none",
                      active
                        ? "rounded-[10px] opacity-100 shadow-[inset_0_0_0_2px_#3b82f6]"
                        : cn("rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:opacity-100", near ? "opacity-85" : "opacity-60"),
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- strip thumbnail */}
                    <img src={NODE_BY_ID.get(item.nodeId)!.output!.src} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className={cn(CHROME_SURFACE, "hidden w-80 shrink-0 flex-col gap-4 rounded-xl p-4 @3xl:flex")}>
          <div className="flex shrink-0 items-center justify-between">
            <span className="nb-font-mono text-[11px] text-neutral-400 tabular-nums">
              {index + 1} of {items.length}
            </span>
            <div className="flex gap-1">
              <button type="button" aria-label="Previous" disabled={!hasPrev} onClick={() => onIndex(index - 1)} className={RAIL_BUTTON}>
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              <button type="button" aria-label="Next" disabled={!hasNext} onClick={() => onIndex(index + 1)} className={RAIL_BUTTON}>
                <ChevronRight size={16} strokeWidth={2} />
              </button>
              <button type="button" aria-label="Close" onClick={onClose} className={cn(RAIL_BUTTON, "ml-1")}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
          <p className="m-0 line-clamp-4 w-full text-sm leading-5 font-medium tracking-[-0.01em] text-neutral-100 select-text">{promptOf(node.id)}</p>
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              type="button"
              aria-pressed={added}
              onClick={() => onToggleAttach(current)}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors duration-[160ms]",
                added ? "border-[#3b82f6] bg-white/[0.03] text-white" : "border-white/12 bg-white/[0.03] text-neutral-200 hover:border-neutral-500 hover:bg-white/7",
              )}
            >
              {added ? <Check size={15} strokeWidth={2} /> : <MessageSquarePlus size={15} strokeWidth={2} />}
              {added ? "Added to chat" : "Add to chat"}
            </button>
            <button
              type="button"
              onClick={() => onShowOnCanvas(current)}
              className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-3 text-xs font-medium text-neutral-200 transition-colors duration-[160ms] hover:border-neutral-500 hover:bg-white/7"
            >
              <LocateFixed size={15} strokeWidth={2} />
              Show on canvas
            </button>
          </div>
          <div className="flex shrink-0 flex-col gap-4">
            <div className="h-px bg-white/8" />
            <dl className="m-0 flex flex-col gap-2">
              <span className="text-[10px] tracking-[0.06em] text-neutral-500 uppercase">Details</span>
              {details.map(([name, value]) => (
                <div key={name} className="flex justify-between gap-3 text-[11px] leading-[14px]">
                  <dt className="text-neutral-500">{name}</dt>
                  <dd className="m-0 text-right text-neutral-300 select-text">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
