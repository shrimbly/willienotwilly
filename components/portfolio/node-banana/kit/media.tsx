"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";
import { CircleAlert, Download, LoaderCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { useCanvas } from "./canvas";
import { touchClaim, type TouchClaim } from "./touch";

// What fills a node's media clip: src/components/nodes/ui/EmptyState.tsx,
// Spinner.tsx, ErrorOverlay.tsx, HeightGrip.tsx, RunBatchChip.tsx, and the
// prompt surface of PromptNode.tsx.

export interface EmptyStateProps {
  /** "Run to generate", "Drop image". */
  message: ReactNode;
  /** Dimmer second line ("Connect inputs and run"). */
  hint?: ReactNode;
  /** Dimmer still: a cost estimate ("~$0.04"). */
  meta?: ReactNode;
  icon?: ReactNode;
  frame?: boolean;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ message, hint, meta, icon, frame = true, className, children }: EmptyStateProps) {
  return (
    <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-900/40 px-3 text-center text-neutral-500", className)}>
      {frame && <div className="nb-squircle pointer-events-none absolute inset-2 rounded-[6px] border border-dashed border-neutral-700/70" />}
      {icon && <div className="mb-0.5 text-neutral-600">{icon}</div>}
      <span className="nb-text-node text-neutral-500">{message}</span>
      {hint && <span className="nb-text-node text-neutral-600">{hint}</span>}
      {meta && <span className="nb-text-node text-neutral-600 tabular-nums">{meta}</span>}
      {children}
    </div>
  );
}

/** The run spinner over the media. */
export function LoadingOverlay({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center bg-neutral-900/70", className)}>
      <LoaderCircle size={24} strokeWidth={3} className="animate-spin text-white" aria-label="Generating" />
    </div>
  );
}

export function ErrorOverlay({ title = "Generation failed", detail, className }: { title?: string; detail?: ReactNode; className?: string }) {
  return (
    <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1 bg-red-900/40 px-3 text-center", className)}>
      <CircleAlert size={24} strokeWidth={2} className="text-white" />
      <span className="text-xs font-medium text-white">{title}</span>
      {detail && <span className="text-[10px] text-white/70">{detail}</span>}
    </div>
  );
}

/** "RUN 7 OF 10 · 14:02", bottom-left over the media; shows while the media is hovered unless `always`. */
export function RunBatchChip({ children, always = false, className }: { children: ReactNode; always?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "nb-font-mono nb-tracking-eyebrow pointer-events-none absolute bottom-1.5 left-1.5 rounded-[5px] border border-white/10 bg-neutral-900/80 px-1.5 py-0.5 text-[10px] leading-3 whitespace-nowrap text-neutral-200 uppercase",
        !always && "opacity-0 transition-opacity group-hover/media:opacity-100",
        className,
      )}
    >
      {children}
    </span>
  );
}

const mediaToolClass =
  "nodrag flex h-5 w-5 items-center justify-center rounded bg-neutral-900/80 text-neutral-400 transition-colors hover:text-white";

/** Download and Clear, top-right over a generated image; shown while the media is hovered or focused. */
export function MediaTools({ onDownload, onClear, noun = "image", className }: { onDownload?: () => void; onClear?: () => void; noun?: string; className?: string }) {
  return (
    <div
      className={cn(
        "absolute top-1 right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/media:opacity-100 focus-within:opacity-100",
        className,
      )}
    >
      <button type="button" onClick={onDownload} title={`Download ${noun}`} aria-label={`Download ${noun}`} className={cn(mediaToolClass, "hover:bg-neutral-700")}>
        <Download size={12} strokeWidth={2} />
      </button>
      <button type="button" onClick={onClear} title={`Clear ${noun}`} aria-label={`Clear ${noun}`} className={cn(mediaToolClass, "hover:bg-red-600/80")}>
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

/** Small status chips over the media: "Fallback used" (emerald), "Model replaced" (amber). */
export function MediaChip({ tone = "emerald", children, className }: { tone?: "emerald" | "amber"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
        tone === "emerald" ? "bg-emerald-900/70 text-emerald-300" : "bg-amber-900/70 text-amber-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface NodeVideoProps extends Omit<ComponentPropsWithoutRef<"video">, "ref"> {
  /** Plays while true (gate it on the demo being active); pauses otherwise. */
  playing?: boolean;
  ref?: Ref<HTMLVideoElement>;
}

/** A node's video: muted, inline, looping, played only while `playing`. */
export function NodeVideo({ playing = false, className, ref, preload = "metadata", ...rest }: NodeVideoProps) {
  const local = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = local.current;
    if (!video) return;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  }, [playing]);
  return (
    <video
      ref={(el) => {
        local.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      muted
      playsInline
      loop
      preload={preload}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
      {...rest}
    />
  );
}

export interface PromptSurfaceProps {
  value: string;
  /** Editable when given; otherwise the prompt is shown as text. */
  onChange?: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  children?: ReactNode;
}

/** The Prompt node's text surface (fill the clip of a `{ height: 160 }` media). */
export function PromptSurface({ value, onChange, placeholder = "Describe what to generate...", className, children, ...rest }: PromptSurfaceProps) {
  const base = "absolute inset-0 h-full w-full bg-neutral-900/40 p-3 pb-4 text-xs leading-relaxed text-neutral-100";
  if (onChange) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={rest["aria-label"] ?? "Prompt"}
        spellCheck={false}
        className={cn(base, "nodrag resize-none placeholder:text-neutral-500 focus:outline-none", className)}
      />
    );
  }
  return (
    <div className={cn(base, "overflow-hidden whitespace-pre-wrap", className)}>
      {value}
      {children}
    </div>
  );
}

/**
 * The text nodes' bottom-edge grip; drags the media height when `onChange` is
 * given. A finger's vertical swipe on it scrolls the page (touch-action:
 * pan-y), so on a touch screen it resizes only where the page passes on the
 * drag; the arrow keys always work.
 */
export function HeightGrip({
  height,
  onChange,
  min = 60,
  max = 800,
  className,
}: {
  height?: number;
  onChange?: (height: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const view = useCanvas();
  const start = useRef<{ y: number; h: number; z: number; touch: TouchClaim | null; resizing: boolean } | null>(null);
  const interactive = Boolean(onChange && height !== undefined);
  return (
    <div
      role={interactive ? "slider" : undefined}
      aria-label={interactive ? "Resize text area" : undefined}
      aria-orientation={interactive ? "vertical" : undefined}
      aria-valuenow={interactive ? height : undefined}
      aria-valuemin={interactive ? min : undefined}
      aria-valuemax={interactive ? max : undefined}
      aria-hidden={interactive ? undefined : true}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        "nodrag group/grip absolute inset-x-0 bottom-0 flex h-4 items-end justify-center",
        interactive && "cursor-ns-resize touch-pan-y",
        className,
      )}
      onPointerDown={(e) => {
        if (!interactive || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const touch = touchClaim(e);
        start.current = { y: e.clientY, h: height ?? 0, z: view?.zoom.get() ?? 1, touch, resizing: !touch };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s || !onChange) return;
        // A finger may still be the start of a page scroll.
        if (s.touch && !s.touch.move(e.clientX, e.clientY)) return;
        s.resizing = true;
        onChange(Math.round(Math.min(max, Math.max(min, s.h + (e.clientY - s.y) / s.z))));
      }}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => {
        const s = start.current;
        start.current = null;
        // The page took the swipe after the grip had started to follow: put the height back.
        if (s?.touch && s.resizing) onChange?.(s.h);
      }}
      onKeyDown={(e) => {
        if (!onChange || height === undefined) return;
        const d = e.key === "ArrowDown" ? 10 : e.key === "ArrowUp" ? -10 : 0;
        if (!d) return;
        e.preventDefault();
        onChange(Math.min(max, Math.max(min, height + d)));
      }}
    >
      <span className="mb-[3px] h-[3px] w-8 rounded-full bg-neutral-500/70 transition-colors group-hover/grip:bg-neutral-300" />
    </div>
  );
}
