"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { MotionValue } from "motion/react";

import { bezierEasing } from "@/lib/easy-peasy-ease/easing-functions";
import {
  EASING_PRESETS,
  PRESET_BEZIERS,
  type EasingPresetName,
} from "@/lib/easy-peasy-ease/easing-presets";
import { cn } from "@/lib/utils";

import { CurveThumb } from "../kit/easing-curve-picker";
import { followValue } from "../kit/motion-value-utils";
import { usePageWheelPassthrough } from "../kit/use-page-wheel-passthrough";

const EASES = EASING_PRESETS.map((name) => bezierEasing(PRESET_BEZIERS[name]));

const ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
/** Room kept between a stepped-to option and the strip's 2rem edge fades. */
const EDGE_MARGIN = 32;
/**
 * Hover previews wait this long after any scroll: the browser re-runs hover
 * as content slides under a still pointer, which must not swap the curve.
 */
const SCROLL_HOVER_GRACE_MS = 150;

interface CurveGalleryProps {
  /** Committed preset, or null for a hand-drawn curve. */
  selected: EasingPresetName | null;
  /** Shared clock, 0–1: every thumbnail's dot sits at (p, ease(p)). */
  progress: MotionValue<number>;
  /** Initial clock value, so the server markup already shows the dots in place. */
  initialProgress: number;
  /**
   * A mouse moving over an option previews its preset; null when the pointer
   * leaves the grid or anything scrolls.
   */
  onPreview: (preset: EasingPresetName | null) => void;
  onSelect: (preset: EasingPresetName) => void;
  className?: string;
}

function dotPosition(index: number, p: number) {
  const clamped = Math.min(1, Math.max(0, p));
  return { cx: clamped * 100, cy: 100 - EASES[index](clamped) * 100 };
}

/**
 * Scroll a strip, never the page, to an option: "nearest" steps it clear of
 * the edge fades; "reveal" centres it only when it is wholly out of sight, so
 * a click on a half-visible option does not slide the strip under the pointer.
 * Centring snaps to a column edge, keeping the half column that peeks past
 * the right fade.
 */
function scrollToOption(
  strip: HTMLElement,
  option: HTMLElement,
  mode: "nearest" | "reveal",
  behavior: ScrollBehavior = "auto",
) {
  if (strip.scrollWidth <= strip.clientWidth) return;
  const view = strip.scrollLeft;
  const width = strip.clientWidth;
  const left =
    option.getBoundingClientRect().left - strip.getBoundingClientRect().left - strip.clientLeft + view;
  const right = left + option.offsetWidth;
  let target: number | null = null;
  if (mode === "reveal") {
    if (right <= view || left >= view + width) {
      const pitch = option.offsetWidth + (parseFloat(getComputedStyle(strip).columnGap) || 0);
      target = Math.round((left - (width - option.offsetWidth) / 2) / pitch) * pitch;
    }
  } else if (left < view + EDGE_MARGIN) {
    target = left - EDGE_MARGIN;
  } else if (right > view + width - EDGE_MARGIN) {
    target = right - width + EDGE_MARGIN;
  }
  if (target !== null) strip.scrollTo({ left: target, behavior });
}

/**
 * The EasingCurvePicker's option grid, laid open: the same 25 presets, option
 * markup and selected styling as the product's popover, plus a dot on every
 * thumbnail riding its own curve off one shared clock.
 */
export const CurveGallery = memo(function CurveGallery({
  selected,
  progress,
  initialProgress,
  onPreview,
  onSelect,
  className,
}: CurveGalleryProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dotRefs = useRef<Array<SVGCircleElement | null>>([]);
  const selectedIndex = selected ? EASING_PRESETS.indexOf(selected) : -1;
  const [focusIndex, setFocusIndex] = useState(Math.max(0, selectedIndex));
  // A selection made elsewhere (the picker) moves the tab stop with it.
  const [lastSelectedIndex, setLastSelectedIndex] = useState(selectedIndex);
  if (lastSelectedIndex !== selectedIndex) {
    setLastSelectedIndex(selectedIndex);
    if (selectedIndex >= 0) setFocusIndex(selectedIndex);
  }

  useEffect(
    () =>
      followValue(progress, (p) => {
        dotRefs.current.forEach((dot, index) => {
          if (!dot) return;
          const { cx, cy } = dotPosition(index, p);
          dot.setAttribute("cx", cx.toFixed(2));
          dot.setAttribute("cy", cy.toFixed(2));
        });
      }),
    [progress],
  );

  // Mark the edges that have presets scrolled past them, for the CSS fade.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const update = () => {
      const max = grid.scrollWidth - grid.clientWidth;
      grid.dataset.moreBefore = String(max > 1 && grid.scrollLeft > 1);
      grid.dataset.moreAfter = String(max > 1 && grid.scrollLeft < max - 1);
    };
    update();
    grid.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => {
      grid.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  // A trackpad's vertical swipe with some sideways drift goes to the page.
  usePageWheelPassthrough(gridRef);

  // The preset this grid last asked to preview, so a move within an option
  // does not restart the tween and a scroll knows whether to clear it.
  const previewedRef = useRef<EasingPresetName | null>(null);
  const lastScrollRef = useRef(Number.NEGATIVE_INFINITY);
  useEffect(() => {
    // Capture sees the page's scroll and the strip's own.
    const onScroll = (event: Event) => {
      lastScrollRef.current = event.timeStamp;
      if (previewedRef.current === null) return;
      previewedRef.current = null;
      onPreview(null);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [onPreview]);

  // The selection stays in sight, as the product's popover opens on it: on
  // mount, and when a pick in the picker lands on a preset scrolled away here.
  const revealedRef = useRef(false);
  useEffect(() => {
    const strip = gridRef.current;
    const option = optionRefs.current[selectedIndex];
    if (!strip || !option) return;
    const smooth =
      revealedRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    revealedRef.current = true;
    scrollToOption(strip, option, "reveal", smooth ? "smooth" : "auto");
  }, [selectedIndex]);

  const focusOption = (index: number) => {
    const option = optionRefs.current[index];
    const strip = gridRef.current;
    if (!option || !strip) return;
    setFocusIndex(index);
    option.focus({ preventScroll: true });
    scrollToOption(strip, option, "nearest");
  };

  // The grid reflows (one row, a scrolling strip, or five across), so arrows
  // move to the nearest option on screen in that direction.
  const neighbour = (index: number, key: string) => {
    const rects = optionRefs.current.map((el) => el?.getBoundingClientRect());
    const from = rects[index];
    if (!from) return index;
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    const horizontal = key === "ArrowLeft" || key === "ArrowRight";
    const sign = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
    let best = index;
    let bestScore = Number.POSITIVE_INFINITY;
    rects.forEach((rect, i) => {
      if (!rect || i === index) return;
      const dx = rect.left + rect.width / 2 - cx;
      const dy = rect.top + rect.height / 2 - cy;
      const along = (horizontal ? dx : dy) * sign;
      const across = Math.abs(horizontal ? dy : dx);
      if (along < 1) return;
      const score = along + across * 4;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return best;
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    let next: number | null = null;
    if (ARROW_KEYS.has(event.key)) next = neighbour(index, event.key);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = EASING_PRESETS.length - 1;
    if (next === null) return;
    event.preventDefault();
    focusOption(next);
  };

  const preview = (preset: EasingPresetName | null) => {
    if (previewedRef.current === preset) return;
    previewedRef.current = preset;
    onPreview(preset);
  };

  // Only a pointer that really moved previews: the hover events a scroll
  // fires under a resting mouse carry no movement, or land inside the grace.
  const handlePointerMove = (preset: EasingPresetName, event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    if (event.movementX === 0 && event.movementY === 0) return;
    if (event.timeStamp - lastScrollRef.current < SCROLL_HOVER_GRACE_MS) return;
    preview(preset);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") preview(null);
  };

  return (
    <div
      className={cn(
        "rounded-[16px] border border-border bg-popover p-1.5 shadow-xl @min-[640px]/epe:p-2",
        className,
      )}
    >
      <div
        ref={gridRef}
        role="listbox"
        aria-label="Ease curves"
        onPointerLeave={handlePointerLeave}
        className="epe-curves-grid"
      >
        {EASING_PRESETS.map((preset, index) => {
          const isSelected = preset === selected;
          const { cx, cy } = dotPosition(index, initialProgress);
          return (
            <button
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              key={preset}
              type="button"
              role="option"
              aria-selected={isSelected}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => {
                setFocusIndex(index);
                onSelect(preset);
              }}
              onFocus={() => setFocusIndex(index)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPointerMove={(event) => handlePointerMove(preset, event)}
              className={cn(
                "epe-curves-option flex min-w-0 flex-col items-center justify-center gap-1 rounded-sm border p-1.5 transition-colors @min-[640px]/epe:p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
                isSelected ? "border-primary/60 bg-primary/10" : "border-transparent hover:bg-accent",
              )}
            >
              <span className="epe-curves-thumb relative block size-9 shrink-0 @min-[640px]/epe:size-10">
                <CurveThumb bezier={PRESET_BEZIERS[preset]} className="absolute inset-0 size-full" />
                <svg
                  viewBox="-8 -8 116 116"
                  className="absolute inset-0 size-full overflow-visible"
                  aria-hidden="true"
                >
                  <circle
                    ref={(element) => {
                      dotRefs.current[index] = element;
                    }}
                    cx={cx.toFixed(2)}
                    cy={cy.toFixed(2)}
                    r="10"
                    strokeWidth="5"
                    style={{ fill: "var(--primary)", stroke: "var(--popover)" }}
                  />
                </svg>
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-center text-[11px] leading-tight",
                  isSelected ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {preset}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
