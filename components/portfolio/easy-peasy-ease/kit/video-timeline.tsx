"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import Image from "next/image";
import type { MotionValue } from "motion/react";

import type { Filmstrip } from "@/lib/easy-peasy-ease/car-clips";
import {
  calculateSegmentBoundaries,
  clamp,
  formatTime,
  getTotalDuration,
  pixelsToTime,
  timeToPixels,
} from "@/lib/easy-peasy-ease/timeline-utils";
import { cn } from "@/lib/utils";

import { FilmstripFrame } from "./filmstrip-frame";
import { followValue } from "./motion-value-utils";
import { usePageWheelPassthrough } from "./use-page-wheel-passthrough";

/**
 * Port of easy-peasy-ease/components/VideoTimeline.tsx (+ TimelineZoomSlider).
 *
 * Changes from the product:
 * - Segments carry baked thumbnails (a poster URL or a filmstrip tile)
 *   instead of decoding frames from the video.
 * - `currentTime` may be a motion value: the playhead, the playing tint and
 *   auto-scroll then update imperatively, with no React render per frame.
 * - md: variants follow the EpeRoot container (768px), not the viewport.
 * - The vertical-wheel-to-horizontal-scroll handler is dropped so the page
 *   always scrolls (mostly vertical trackpad swipes are handed to the page,
 *   see usePageWheelPassthrough); the scrub track is touch-action: pan-y.
 * - Segments are <button>s (select + seek to start), so they are keyboard
 *   reachable. Letting go after a scrub doesn't count as a click on the
 *   segment under the press.
 * - Ruler ticks stop at the last whole second inside the timeline, so no tick
 *   or label hangs past the end and widens the scroll area.
 * - The zoom slider is touch-action: pan-y. A touch only sets the zoom once it
 *   moves mostly sideways, so a vertical swipe that starts on it scrolls the
 *   page; a tap still sets it (through the compatibility mouse events).
 * - The same goes for the track: a touch seeks once it moves mostly sideways
 *   (a scrub) or lifts (a tap), so a swipe that scrolls the page leaves the
 *   playhead where it was.
 * - Radii in px (product rounded-lg = 12px, rounded-md = 8px).
 */

export const TIMELINE_MIN_VISIBLE_SECONDS = 3;

/** Horizontal breathing room inside the scroll viewport. All time<->pixel
 *  maths stays anchored to the inner track (x=0 at the gutter's inside edge). */
const TIMELINE_GUTTER_PX = 12;

/** Pointer travel (px) after which a press on the track is a scrub, not a click. */
const SCRUB_CLICK_SLOP_PX = 4;

/** Sideways travel (px) before a touch on the zoom slider or the track drags it (split-track's TOUCH_SLOP). */
const TOUCH_SLOP_PX = 6;

const lerp = (start: number, end: number, value: number) => start + (end - start) * value;

export interface FilmstripThumb {
  strip: Filmstrip;
  /** Tile index (see filmstripTileAt). */
  index: number;
}

export interface TimelineSegment {
  id: string | number;
  name: string;
  /** Output seconds (product default 1.5). */
  duration?: number;
  loopIteration?: number;
  /** Poster URL or a filmstrip tile; shown cover-cropped at 60% like the product. */
  thumbnail?: string | FilmstripThumb;
}

export interface TimelineTrackContext {
  trackWidth: number;
  pixelsPerSecond: number;
  totalDuration: number;
}

interface VideoTimelineProps {
  segments: TimelineSegment[];
  /** Output time in seconds; a motion value avoids re-rendering per frame. */
  currentTime: number | MotionValue<number>;
  selectedSegmentId: string | number | null;
  onSeek: (time: number) => void;
  onSegmentSelect: (id: string | number) => void;
  renderAudioTrack?: (context: TimelineTrackContext) => ReactNode;
  zoomValue: number;
  onZoomChange: (value: number) => void;
  /** Extra classes for the scroll viewport (e.g. to square corners in a connected card). */
  viewportClassName?: string;
  /**
   * Loading for poster-URL thumbnails (default "lazy"). Pass "eager" when the
   * timeline is above the fold, e.g. in a hero, where a poster can be the LCP.
   */
  thumbnailLoading?: "lazy" | "eager";
  className?: string;
}

interface ZoomSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

export function TimelineZoomSlider({ value, onValueChange, disabled }: ZoomSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  /** A touch that may still turn out to be a page scroll. */
  const touchPressRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  const updateValueFromPointer = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const rawValue = (clientX - rect.left) / rect.width;
      onValueChange(clamp(rawValue, 0, 1));
    },
    [onValueChange],
  );

  const startDragging = (clientX: number) => {
    if (disabled) return;
    updateValueFromPointer(clientX);
    setIsDragging(true);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    startDragging(event.clientX);
  };

  // A touch stays pending until it moves mostly sideways; a mostly vertical
  // one is the page's scroll (the browser cancels the pointer).
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.pointerType !== "touch") return;
    touchPressRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const press = touchPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const dx = Math.abs(event.clientX - press.startX);
    if (dx < TOUCH_SLOP_PX || dx < Math.abs(event.clientY - press.startY)) return;
    touchPressRef.current = null;
    startDragging(event.clientX);
  };

  const endTouchPress = () => {
    touchPressRef.current = null;
  };

  useEffect(() => {
    if (!isDragging || disabled) return;

    const handlePointerMove = (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
      if ("touches" in event) {
        const clientX = event.touches[0]?.clientX;
        if (clientX == null) return;
        event.preventDefault();
        updateValueFromPointer(clientX);
        return;
      }
      updateValueFromPointer(event.clientX);
    };

    const stopDragging = () => setIsDragging(false);
    const touchMoveOptions: AddEventListenerOptions = { passive: false };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("touchmove", handlePointerMove, touchMoveOptions);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("touchend", stopDragging);
    window.addEventListener("touchcancel", stopDragging);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove, touchMoveOptions);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("touchend", stopDragging);
      window.removeEventListener("touchcancel", stopDragging);
    };
  }, [isDragging, disabled, updateValueFromPointer]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? 0.1 : 0.05;
    const adjustments: Record<string, number> = {
      ArrowDown: -step,
      ArrowLeft: -step,
      ArrowRight: step,
      ArrowUp: step,
    };

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onValueChange(event.key === "Home" ? 0 : 1);
      return;
    }

    const adjustment = adjustments[event.key];
    if (adjustment === undefined) return;
    event.preventDefault();
    onValueChange(clamp(value + adjustment, 0, 1));
  };

  return (
    <div
      ref={sliderRef}
      className={cn(
        "relative h-8 w-[70px] cursor-pointer touch-pan-y select-none rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-ring/60 @min-[768px]/epe:w-[100px]",
        disabled && "cursor-not-allowed opacity-50",
      )}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Timeline zoom"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)}%`}
      aria-disabled={disabled}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endTouchPress}
      onPointerCancel={endTouchPress}
      onKeyDown={handleKeyDown}
    >
      {/* Track + thumb match the themed range sliders: bright fill left of the
          thumb, dim to the right, primary thumb with a background ring. */}
      <div
        className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
        style={{
          background: `linear-gradient(to right, var(--primary) ${value * 100}%, color-mix(in srgb, var(--primary) 25%, transparent) ${value * 100}%)`,
        }}
      />
      <div
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow transition-transform after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
        style={{ left: `${value * 100}%` }}
      />
    </div>
  );
}

export function VideoTimeline({
  segments,
  currentTime,
  selectedSegmentId,
  onSeek,
  onSegmentSelect,
  renderAudioTrack,
  zoomValue,
  onZoomChange,
  viewportClassName,
  thumbnailLoading = "lazy",
  className,
}: VideoTimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isDraggingRef = useRef(false);
  /** Where the current track press started, and whether it has moved far enough to be a scrub. */
  const pressRef = useRef<{ x: number; scrubbed: boolean } | null>(null);
  /** A touch on the track that may still turn out to be a page scroll. */
  const touchPressRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
  const timeRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  const totalDuration = getTotalDuration(segments);
  const boundaries = useMemo(() => calculateSegmentBoundaries(segments), [segments]);
  const zoomDisabled = totalDuration === 0 || totalDuration <= TIMELINE_MIN_VISIBLE_SECONDS;

  const safeViewportWidth = viewportWidth || 0;
  const contentViewportWidth = Math.max(safeViewportWidth - TIMELINE_GUTTER_PX * 2, 0);
  const normalizedZoom = clamp(zoomValue, 0, 1);

  const targetVisibleSeconds =
    totalDuration === 0
      ? TIMELINE_MIN_VISIBLE_SECONDS
      : zoomDisabled
        ? totalDuration
        : lerp(totalDuration, TIMELINE_MIN_VISIBLE_SECONDS, normalizedZoom);

  const pixelsPerSecond =
    contentViewportWidth > 0 && targetVisibleSeconds > 0
      ? contentViewportWidth / targetVisibleSeconds
      : 0;

  const rawTrackWidth = totalDuration > 0 ? totalDuration * pixelsPerSecond : contentViewportWidth;
  const trackWidth = Math.max(rawTrackWidth, contentViewportWidth);
  // Whole seconds up to the end, never past it (a tick beyond the end widened the scroll area).
  const tickCount = Math.floor(totalDuration + 1e-6) + 1;

  // Keep the zoom slider sensible when the timeline shrinks.
  useEffect(() => {
    if (zoomDisabled && zoomValue !== 0) {
      onZoomChange(0);
    }
  }, [zoomDisabled, zoomValue, onZoomChange]);

  usePageWheelPassthrough(viewportRef);

  // Measure the scroll viewport width (the observer reports once on attach).
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Playhead, playing tint, slider value and auto-scroll follow the clock
  // imperatively so a 60fps motion value never re-renders the timeline.
  useEffect(() => {
    let playingIndex = -2;
    const update = (time: number) => {
      const normalizedTime = totalDuration > 0 ? ((time % totalDuration) + totalDuration) % totalDuration : time;
      timeRef.current = normalizedTime;
      const playheadPosition = timeToPixels(normalizedTime, pixelsPerSecond);
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${playheadPosition}px)`;
      }
      if (knobRef.current) {
        knobRef.current.setAttribute("aria-valuenow", normalizedTime.toFixed(2));
        knobRef.current.setAttribute("aria-valuetext", formatTime(normalizedTime));
      }
      const nextPlaying = boundaries.findIndex(
        (b) => normalizedTime >= b.startTime && normalizedTime < b.endTime,
      );
      if (nextPlaying !== playingIndex) {
        playingIndex = nextPlaying;
        segmentRefs.current.forEach((el, i) => {
          if (el) el.dataset.playing = String(i === nextPlaying);
        });
      }

      // Keep the playhead visible by jumping the scroll position if it leaves the viewport.
      const viewport = viewportRef.current;
      const scrollableWidth = trackWidth + TIMELINE_GUTTER_PX * 2;
      if (
        !viewport ||
        safeViewportWidth === 0 ||
        scrollableWidth <= safeViewportWidth ||
        isDraggingRef.current
      ) {
        return;
      }
      const scrollLeft = viewport.scrollLeft;
      const visibleStart = scrollLeft - TIMELINE_GUTTER_PX;
      const visibleEnd = scrollLeft + safeViewportWidth - TIMELINE_GUTTER_PX;
      if (playheadPosition < visibleStart || playheadPosition > visibleEnd) {
        const maxScroll = Math.max(scrollableWidth - safeViewportWidth, 0);
        viewport.scrollLeft = clamp(
          playheadPosition + TIMELINE_GUTTER_PX - safeViewportWidth / 2,
          0,
          maxScroll,
        );
      }
    };

    return followValue(currentTime, update);
  }, [boundaries, currentTime, pixelsPerSecond, safeViewportWidth, totalDuration, trackWidth]);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return 0;
      const rect = viewport.getBoundingClientRect();
      const x = clientX - rect.left + viewport.scrollLeft - TIMELINE_GUTTER_PX;
      return clamp(pixelsToTime(x, pixelsPerSecond), 0, totalDuration);
    },
    [pixelsPerSecond, totalDuration],
  );

  const beginDrag = () => {
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  // Handle timeline interaction (click or drag).
  const handleTrackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") {
      touchPressRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
      return;
    }
    e.preventDefault();
    pressRef.current = { x: e.clientX, scrubbed: false };
    onSeek(timeFromClientX(e.clientX));
    beginDrag();
    const target = e.target as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
  };

  // A pending touch becomes a scrub once it moves mostly sideways; a mostly
  // vertical one is the page's scroll (the browser cancels the pointer).
  const handleTrackPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const press = touchPressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    const dx = Math.abs(e.clientX - press.startX);
    if (dx < TOUCH_SLOP_PX || dx < Math.abs(e.clientY - press.startY)) return;
    touchPressRef.current = null;
    pressRef.current = { x: press.startX, scrubbed: true };
    onSeek(timeFromClientX(e.clientX));
    beginDrag();
  };

  // A tap seeks where it landed, as a click does (a segment's click then
  // moves to its start).
  const handleTrackPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const press = touchPressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    touchPressRef.current = null;
    pressRef.current = null;
    onSeek(timeFromClientX(press.startX));
  };

  const cancelTrackTouch = () => {
    touchPressRef.current = null;
  };

  // Handle playhead dragging (specific target).
  const handlePlayheadPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    beginDrag();
    const target = e.target as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
  };

  const handlePlayheadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 1 : 0.1;
    const adjustments: Record<string, number> = {
      ArrowDown: -step,
      ArrowLeft: -step,
      ArrowRight: step,
      ArrowUp: step,
    };

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onSeek(event.key === "Home" ? 0 : totalDuration);
      return;
    }

    const adjustment = adjustments[event.key];
    if (adjustment === undefined) return;
    event.preventDefault();
    onSeek(clamp(timeRef.current + adjustment, 0, totalDuration));
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      const press = pressRef.current;
      if (press && Math.abs(e.clientX - press.x) > SCRUB_CLICK_SLOP_PX) press.scrubbed = true;
      onSeek(timeFromClientX(e.clientX));
    };
    const handlePointerUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, onSeek, timeFromClientX]);

  return (
    <div className={cn("w-full min-w-0 max-w-full space-y-2", className)}>
      <div className="w-full min-w-0">
        <div
          ref={viewportRef}
          className={cn(
            "epe-timeline-scrollbar w-full min-w-0 max-w-full overflow-x-auto rounded-[12px] border border-border bg-secondary",
            viewportClassName,
          )}
        >
          {/* w-max keeps the wrapper sized to the track, so the right-hand
              gutter isn't collapsed by the overflow container. */}
          <div className="w-max" style={{ padding: `0 ${TIMELINE_GUTTER_PX}px` }}>
            <div
              className="relative space-y-1 @min-[768px]/epe:space-y-4"
              style={{ width: `${trackWidth}px` }}
            >
              {/* Time ruler */}
              <div className="relative h-5 border-b border-border/60 @min-[768px]/epe:h-8">
                {Array.from({ length: tickCount }, (_, index) => {
                  const tickPosition = timeToPixels(index, pixelsPerSecond);
                  return (
                    <div
                      key={index}
                      className="absolute flex -translate-x-1/2 flex-col items-center font-mono text-[10px] font-medium tabular-nums text-muted-foreground"
                      style={{ left: `${tickPosition}px` }}
                    >
                      <div className="h-1 w-px bg-border @min-[768px]/epe:h-2" />
                      <span>{index}s</span>
                    </div>
                  );
                })}
              </div>

              {/* Timeline track */}
              <div
                className="relative h-14 cursor-pointer touch-pan-y select-none @min-[768px]/epe:h-24"
                onPointerDown={handleTrackPointerDown}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={handleTrackPointerUp}
                onPointerCancel={cancelTrackTouch}
              >
                <div className="flex h-full">
                  {boundaries.map((boundary, index) => {
                    const segment = boundary.segment;
                    const segmentDuration = boundary.endTime - boundary.startTime;
                    const segmentWidth = segmentDuration * pixelsPerSecond;
                    const isSelected = segment.id === selectedSegmentId;
                    const label =
                      segment.loopIteration && segment.loopIteration > 1
                        ? `${segment.name} • Loop ${segment.loopIteration}`
                        : segment.name;

                    return (
                      <button
                        key={segment.id}
                        ref={(el) => {
                          segmentRefs.current[index] = el;
                        }}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${label}, ${segmentDuration.toFixed(2)} seconds`}
                        className={cn(
                          "relative block h-full flex-none border-r border-border/50 text-left transition-[background-color,box-shadow,width] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset data-[playing=true]:bg-primary/10",
                          isSelected && "ring-2 ring-primary ring-inset",
                        )}
                        style={{ width: `${Math.max(segmentWidth, 0)}px` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // The press is captured on this segment, so letting go
                          // after a scrub clicks it too; that click would undo
                          // the scrub. Keyboard clicks (detail 0) always select.
                          const press = pressRef.current;
                          pressRef.current = null;
                          if (e.detail > 0 && press?.scrubbed) return;
                          onSegmentSelect(segment.id);
                          // Also seek to the segment start so playback doesn't reset the selection.
                          onSeek(boundary.startTime);
                        }}
                      >
                        {typeof segment.thumbnail === "string" ? (
                          <Image
                            src={segment.thumbnail}
                            alt=""
                            fill
                            unoptimized
                            loading={thumbnailLoading}
                            sizes="200px"
                            className="pointer-events-none object-cover opacity-60"
                          />
                        ) : segment.thumbnail ? (
                          <FilmstripFrame
                            strip={segment.thumbnail.strip}
                            index={segment.thumbnail.index}
                            className="opacity-60"
                          />
                        ) : null}

                        {/* Overlay gradient for text readability */}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-1 @min-[768px]/epe:p-2">
                          <p className="truncate text-[10px] font-medium text-white @min-[768px]/epe:text-xs">
                            {label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Playhead */}
                <div
                  ref={playheadRef}
                  className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-0.5 bg-primary will-change-transform"
                >
                  <div
                    ref={knobRef}
                    className="pointer-events-auto absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-background bg-primary shadow-lg after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing"
                    role="slider"
                    tabIndex={0}
                    aria-label="Timeline playhead"
                    aria-valuemin={0}
                    aria-valuemax={Number(totalDuration.toFixed(2))}
                    aria-valuenow={0}
                    aria-valuetext={formatTime(0)}
                    onPointerDown={handlePlayheadPointerDown}
                    onKeyDown={handlePlayheadKeyDown}
                  />
                  <div className="absolute inset-0 -left-px -z-10 w-1 bg-primary/30 blur-sm" />
                </div>
              </div>

              {renderAudioTrack && (
                <div className="pb-2 @min-[768px]/epe:pb-4">
                  {renderAudioTrack({ trackWidth, pixelsPerSecond, totalDuration })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
