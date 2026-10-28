"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { MotionValue } from "motion/react";
import { Plus, X } from "lucide-react";

import { deriveSections, moveSplit, removeSplit, insertSplit } from "@/lib/easy-peasy-ease/chunking";
import { clamp, formatTime } from "@/lib/easy-peasy-ease/timeline-utils";
import { cn } from "@/lib/utils";

import { FilmstripFrame } from "../kit/filmstrip-frame";

import { FILMSTRIP_CELLS } from "./virtual-source";

const NUDGE_SMALL = 0.1;
const NUDGE_LARGE = 1;
/** Horizontal travel (px) before a touch on the track (or a marker) counts as a scrub (or a drag). */
const TOUCH_SLOP = 6;

const pct = (time: number, duration: number) => `${(clamp(time, 0, duration) / duration) * 100}%`;

/**
 * The product's "+ Split at playhead" button (SplitTrack header). The demo
 * renders it in the header on wide tiles and in the playback row on narrow
 * ones, so it lives outside the track. It turns off whenever the playing
 * playhead nears a split (and right after a click adds one), so it is
 * aria-disabled rather than disabled: a disabled button drops keyboard focus
 * to <body>.
 */
export function SplitAtPlayheadButton({
  enabled,
  atSectionCap,
  maxSections,
  onClick,
  className,
}: {
  enabled: boolean;
  atSectionCap: boolean;
  maxSections: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      aria-disabled={!enabled || undefined}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-(color:--control-border) bg-background px-2.5 text-xs font-medium transition-colors after:absolute after:inset-x-0 after:inset-y-[-4px] after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        enabled ? "hover:bg-accent hover:text-accent-foreground" : "cursor-not-allowed opacity-50",
        className,
      )}
      title={atSectionCap ? `Maximum of ${maxSections} clips reached` : "Add a split at the playhead"}
    >
      <Plus className="h-3.5 w-3.5" />
      Split at playhead
    </button>
  );
}

interface SplitTrackProps {
  duration: number;
  /** Source time under the playhead (a motion value; written imperatively). */
  currentTime: MotionValue<number>;
  /** Server-render position of the playhead, seconds. */
  initialTime: number;
  splitTimes: number[];
  onSplitTimesChange: (splitTimes: number[]) => void;
  onSeek: (time: number) => void;
  selectedSplit: number | null;
  onSelectedSplitChange: (index: number | null) => void;
  /** True while the visitor scrubs or drags a marker (the demo pauses playback meanwhile). */
  onScrubbingChange?: (scrubbing: boolean) => void;
  /** Section playing in the eased sequence, outlined like a selected timeline clip. */
  activeSection?: number | null;
  className?: string;
}

/**
 * Port of easy-peasy-ease/components/SplitTrack.tsx (ruler + track; the
 * header row is composed by the demo). Same markup and interactions: drag
 * the empty track to scrub, double-click to split, drag a diamond to move
 * it (the preview follows the cut), click one to select it and show ×,
 * Delete/Backspace removes, arrows nudge 0.1 s (1 s with Shift).
 *
 * Changes: the filmstrip is baked (8 sprite tiles, no frame extraction);
 * positions are percentages and the playhead is moved imperatively from a
 * motion value; the track and the marker handles are touch-pan-y so the
 * page still scrolls, and a touch only scrubs (or drags a marker) once it
 * moves sideways.
 */
export function SplitTrack({
  duration,
  currentTime,
  initialTime,
  splitTimes,
  onSplitTimesChange,
  onSeek,
  selectedSplit: selectedSplitProp,
  onSelectedSplitChange,
  onScrubbingChange,
  activeSection = null,
  className,
}: SplitTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const draggingIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const scrubRef = useRef<{ pointerId: number; startX: number; startY: number; pending: boolean } | null>(
    null,
  );
  const markerPressRef = useRef<{ index: number; pointerId: number; startX: number; startY: number } | null>(
    null,
  );

  const sections = useMemo(() => deriveSections(duration, splitTimes), [duration, splitTimes]);
  const selectedSplit =
    selectedSplitProp !== null && selectedSplitProp < splitTimes.length ? selectedSplitProp : null;

  // The playhead rides a full-width layer, so translateX(%) is a fraction of the track.
  useLayoutEffect(() => {
    const node = playheadRef.current;
    if (!node) return;
    const apply = (time: number) => {
      node.style.transform = `translateX(${(clamp(time, 0, duration) / duration) * 100}%)`;
    };
    apply(currentTime.get());
    return currentTime.on("change", apply);
  }, [currentTime, duration]);

  const timeFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration);
  };

  // ---- Scrubbing (click / drag on the empty track) ----
  const scrubTo = (clientX: number) => {
    onSelectedSplitChange(null);
    onSeek(timeFromClientX(clientX));
  };

  const endScrub = () => {
    const scrub = scrubRef.current;
    if (!scrub) return;
    scrubRef.current = null;
    if (!scrub.pending) onScrubbingChange?.(false);
  };

  const handleTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // A touch may be the start of a page scroll, so it stays pending (no
    // pause, no seek, selection kept) until it moves along the track or lifts.
    const pending = e.pointerType === "touch";
    scrubRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, pending };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (!pending) {
      e.preventDefault();
      onScrubbingChange?.(true);
      scrubTo(e.clientX);
    }
  };

  const handleTrackPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const scrub = scrubRef.current;
    if (!scrub || scrub.pointerId !== e.pointerId) return;
    if (scrub.pending) {
      const dx = Math.abs(e.clientX - scrub.startX);
      const dy = Math.abs(e.clientY - scrub.startY);
      // Mostly vertical: the browser is about to pan the page and cancel this pointer.
      if (dx < TOUCH_SLOP || dx < dy) return;
      scrub.pending = false;
      onScrubbingChange?.(true);
    }
    scrubTo(e.clientX);
  };

  const handleTrackPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    // A touch that never moved is a tap: seek there.
    if (scrubRef.current?.pending && e.type === "pointerup") scrubTo(e.clientX);
    endScrub();
  };

  const handleTrackDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    const t = timeFromClientX(e.clientX);
    // Inserting shifts positional indices; drop the selection so it can't
    // end up pointing at a different split than the one selected.
    onSelectedSplitChange(null);
    onSplitTimesChange(insertSplit(splitTimes, t, duration));
  };

  // ---- Marker dragging ----
  useEffect(() => {
    if (draggingIndex === null) return;
    const handleMove = (e: PointerEvent) => {
      const idx = draggingIndexRef.current;
      if (idx === null) return;
      e.preventDefault();
      const next = moveSplit(splitTimes, idx, timeFromClientX(e.clientX), duration);
      onSplitTimesChange(next);
      // Scrub the preview to the split's actual (clamped) position so the
      // visitor sees the exact frame they're cutting on as they drag.
      const movedTo = next[idx];
      if (typeof movedTo === "number") onSeek(movedTo);
    };
    const stop = () => {
      draggingIndexRef.current = null;
      setDraggingIndex(null);
      onScrubbingChange?.(false);
    };
    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    // timeFromClientX only reads the track's rect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingIndex, splitTimes, duration, onSplitTimesChange, onSeek, onScrubbingChange]);

  const beginMarkerDrag = (index: number) => {
    onSelectedSplitChange(index);
    // Jump the preview to the grabbed split immediately, before any drag.
    onSeek(splitTimes[index]);
    onScrubbingChange?.(true);
    draggingIndexRef.current = index;
    setDraggingIndex(index);
  };

  const handleMarkerPointerDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // As on the track, a touch may be a page scroll: it drags only once it
    // moves sideways, and a tap selects through onClick.
    if (e.pointerType === "touch") {
      markerPressRef.current = { index, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
      return;
    }
    e.preventDefault();
    beginMarkerDrag(index);
  };

  const handleMarkerPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const press = markerPressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    const dx = Math.abs(e.clientX - press.startX);
    if (dx < TOUCH_SLOP || dx < Math.abs(e.clientY - press.startY)) return;
    markerPressRef.current = null;
    beginMarkerDrag(press.index);
  };

  const endMarkerPress = () => {
    markerPressRef.current = null;
  };

  const removeAt = (index: number) => {
    onSplitTimesChange(removeSplit(splitTimes, index, duration));
    onSelectedSplitChange(null);
    // Markers are keyed by position: the next split takes over this button, or
    // after the last one focus moves back a marker instead of falling to <body>.
    const target = Math.min(index, splitTimes.length - 2);
    if (target >= 0) markerRefs.current[target]?.focus();
  };

  const handleMarkerKeyDown = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeAt(index);
      return;
    }
    const step = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const target = splitTimes[index] + (e.key === "ArrowLeft" ? -step : step);
      const next = moveSplit(splitTimes, index, target, duration);
      onSplitTimesChange(next);
      onSelectedSplitChange(index);
      const movedTo = next[index];
      if (typeof movedTo === "number") onSeek(movedTo);
    }
  };

  const stride = duration > 30 ? 5 : duration > 12 ? 2 : 1;

  return (
    <div className={cn("space-y-2 @min-[880px]/epe:space-y-3", className)}>
      {/* Time ruler (decorative — must not intercept taps on nearby controls) */}
      <div className="pointer-events-none relative h-4 select-none" aria-hidden="true">
        {Array.from({ length: Math.floor(duration) + 1 }, (_, s) => {
          // Thin out ruler labels on long clips to avoid crowding.
          if (s % stride !== 0) return null;
          return (
            <div
              key={s}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center font-mono text-[10px] tabular-nums text-muted-foreground"
              style={{ left: pct(s, duration) }}
            >
              <div className="h-1.5 w-px bg-border" />
              <span>{s}s</span>
            </div>
          );
        })}
      </div>

      {/* The track */}
      <div
        ref={trackRef}
        className="relative h-20 w-full touch-pan-y select-none overflow-hidden rounded-[12px] border border-border bg-secondary @min-[880px]/epe:h-24"
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerCancel={handleTrackPointerUp}
        onLostPointerCapture={endScrub}
        onDoubleClick={handleTrackDoubleClick}
        role="group"
        aria-label="Split track"
      >
        {/* Filmstrip */}
        <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
          {FILMSTRIP_CELLS.map((cell, i) => (
            <div key={i} className="relative h-full flex-1 border-r border-black/20 last:border-r-0">
              <FilmstripFrame strip={cell.strip} index={cell.index} className="opacity-40" />
            </div>
          ))}
        </div>

        {/* Section overlays */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {sections.map((section) => {
            const isEven = section.index % 2 === 0;
            return (
              <div
                key={section.index}
                className={cn(
                  "@container absolute top-0 bottom-0 flex flex-col items-center justify-center gap-0.5 border-r border-primary/40 text-center transition-shadow",
                  isEven ? "bg-primary/5" : "bg-primary/15",
                  activeSection === section.index && "ring-2 ring-primary ring-inset",
                )}
                style={{ left: pct(section.start, duration), width: pct(section.duration, duration) }}
              >
                <span className="hidden rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground @min-[45px]:block">
                  {section.index + 1}
                </span>
                <span className="hidden font-mono text-[10px] tabular-nums text-foreground/70 @min-[45px]:block">
                  {section.duration.toFixed(1)}s
                </span>
              </div>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          ref={playheadRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 will-change-transform"
          style={{ transform: `translateX(${(clamp(initialTime, 0, duration) / duration) * 100}%)` }}
        >
          <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-foreground">
            <div className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-foreground" />
          </div>
        </div>

        {/* Split markers */}
        {splitTimes.map((t, index) => {
          const isSelected = selectedSplit === index;
          const isDragging = draggingIndex === index;
          return (
            <div key={index} className="absolute top-0 bottom-0 z-30" style={{ left: pct(t, duration) }}>
              {/* Split line */}
              <div
                className={cn(
                  "pointer-events-none absolute top-0 bottom-0 -translate-x-1/2 transition-colors",
                  isSelected || isDragging ? "w-0.5 bg-primary" : "w-px bg-primary/70",
                )}
              />
              {/* Draggable handle: a finger-sized 32×64 target centred on the line. */}
              <button
                ref={(el) => {
                  markerRefs.current[index] = el;
                }}
                type="button"
                aria-label={`Split point ${index + 1} at ${formatTime(t)}. Drag to move, Delete to remove.`}
                className="absolute left-0 top-1/2 flex h-16 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-pan-y items-center justify-center active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                onPointerDown={handleMarkerPointerDown(index)}
                onPointerMove={handleMarkerPointerMove}
                onPointerUp={endMarkerPress}
                onPointerCancel={endMarkerPress}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectedSplitChange(index);
                  onSeek(splitTimes[index]);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={handleMarkerKeyDown(index)}
              >
                <span
                  className={cn(
                    "pointer-events-none h-4 w-4 rotate-45 rounded-sm border-2 border-background bg-primary shadow-md transition-transform",
                    (isSelected || isDragging) && "scale-125 ring-2 ring-primary/50",
                  )}
                />
              </button>
              {/* Delete affordance for the selected split */}
              {isSelected && !isDragging && (
                <button
                  type="button"
                  aria-label={`Remove split point ${index + 1}`}
                  className="absolute top-0.5 left-0 z-40 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 @min-[880px]/epe:top-1 @min-[880px]/epe:h-8 @min-[880px]/epe:w-8"
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(index);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
