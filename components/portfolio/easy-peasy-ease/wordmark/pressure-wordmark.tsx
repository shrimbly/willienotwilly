"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/utils";

import { EPE_WORDMARK_FONT } from "../kit/fonts";

/**
 * The landing's TextPressure (easy-peasy-ease/components/text/text-pressure.tsx)
 * with the landing call baked in: weight axis only, no wrapping. Each letter
 * sits at wght 900 and thins toward 400 within 150px of the pointer; after
 * `initialAnimationDelay` a simulated cursor sweeps across the word over 2s
 * (easeInOutSine), then the real mouse takes over.
 *
 * Forked from kit/text-pressure.tsx for what the tile needs and the kit
 * component does not expose:
 * - A finger dragged along the word drives it too (the product only listens
 *   to mousemove, so touch devices get the intro sweep alone).
 * - Under reduced motion there is no sweep and no weight transition, but the
 *   pointer still drives the weight (the product renders it static).
 * - The sweep (`sweep`) and the pointer listener (`follow`) are gated
 *   separately, and scrolling under a resting mouse re-measures the letters.
 * - The 150px radius (and the sweep's 100px run-up) are the product's at its
 *   72px desktop size; they scale down with the type, so a 32px phone
 *   wordmark thins a few letters at a time instead of the whole word.
 */
const MAX_DISTANCE = 150;
const SWEEP_RUN_UP = 100;
// Line box of the product's text-7xl title (72px at line-height 1.2).
const PRODUCT_LINE_HEIGHT = 86.4;
const SWEEP_DURATION = 2000;
const FAR_AWAY = { x: -1e6, y: -1e6 };

interface PressureWordmarkProps {
  text: string;
  /** Run the intro sweep (once) while true; pass useDemoActive().active. */
  sweep: boolean;
  /** Follow the mouse while true; pass useDemoActive().inView. */
  follow: boolean;
  reducedMotion: boolean;
  initialAnimationDelay?: number;
  className?: string;
}

export function PressureWordmark({
  text,
  sweep,
  follow,
  reducedMotion,
  initialAnimationDelay = 0,
  className,
}: PressureWordmarkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);
  const pointerRef = useRef(FAR_AWAY);
  const frameRef = useRef(0);
  const touchIdRef = useRef<number | null>(null);
  const [sweepPending, setSweepPending] = useState(true);
  const introDone = reducedMotion || !sweepPending;

  const updateCharacters = useCallback(() => {
    const { x, y } = pointerRef.current;
    charsRef.current.forEach((char) => {
      if (!char) return;
      const rect = char.getBoundingClientRect();
      if (rect.height === 0) return;
      const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      const radius = Math.min(MAX_DISTANCE, (rect.height / PRODUCT_LINE_HEIGHT) * MAX_DISTANCE);
      const influence = Math.max(0, 1 - distance / radius);
      // Reverse: start at 900 (super bold), thin to 400 on hover.
      char.style.fontVariationSettings = `"wght" ${900 - influence * 500}`;
    });
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      updateCharacters();
    });
  }, [updateCharacters]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    },
    [],
  );

  // Intro: a simulated cursor drags left to right across the word. The box is
  // re-measured every frame so a page scroll mid-sweep does not derail it.
  useEffect(() => {
    if (introDone || !sweep) return;

    let animationFrame = 0;
    let finished = false;
    const delayTimer = window.setTimeout(() => {
      let startTime: number | null = null;
      const animateMouseDrag = (now: number) => {
        const box = containerRef.current?.getBoundingClientRect();
        if (!box) return;
        startTime ??= now;
        const progress = Math.min((now - startTime) / SWEEP_DURATION, 1);
        const easedProgress = -(Math.cos(Math.PI * progress) - 1) / 2;
        const runUp = Math.min(SWEEP_RUN_UP, (box.height / PRODUCT_LINE_HEIGHT) * SWEEP_RUN_UP);
        const startX = box.left - runUp;
        const endX = box.right + runUp;
        pointerRef.current = { x: startX + (endX - startX) * easedProgress, y: box.top + box.height / 2 };
        updateCharacters();
        if (progress < 1) {
          animationFrame = requestAnimationFrame(animateMouseDrag);
        } else {
          finished = true;
          setSweepPending(false);
        }
      };
      animationFrame = requestAnimationFrame(animateMouseDrag);
    }, initialAnimationDelay);

    return () => {
      window.clearTimeout(delayTimer);
      cancelAnimationFrame(animationFrame);
      // Interrupted (scrolled away): settle back to rest; the sweep restarts next time.
      if (!finished && touchIdRef.current === null) {
        pointerRef.current = FAR_AWAY;
        scheduleUpdate();
      }
    };
  }, [initialAnimationDelay, introDone, scheduleUpdate, sweep, updateCharacters]);

  // Then the real cursor takes over. Mouse-type pointermove rather than the
  // product's mousemove: a tap elsewhere in the tile (the mode toggle) would
  // otherwise leave the letters under it thinned on touch screens.
  useEffect(() => {
    if (!introDone || !follow) return;
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || touchIdRef.current !== null) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", scheduleUpdate, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", scheduleUpdate, { capture: true });
    };
  }, [follow, introDone, scheduleUpdate]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    touchIdRef.current = event.pointerId;
    // A finger takes over from the intro sweep.
    setSweepPending(false);
    pointerRef.current = { x: event.clientX, y: event.clientY };
    scheduleUpdate();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== touchIdRef.current) return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    scheduleUpdate();
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== touchIdRef.current) return;
    touchIdRef.current = null;
    pointerRef.current = FAR_AWAY;
    scheduleUpdate();
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={cn(
        "inline-flex w-full touch-pan-y select-none flex-nowrap items-center justify-center",
        className,
      )}
      style={{
        fontFamily: EPE_WORDMARK_FONT,
        color: "currentColor",
        lineHeight: "1.2",
        letterSpacing: "-0.02em",
      }}
    >
      <span className="sr-only">{text}</span>
      {text.split("").map((char, index) => (
        <span
          key={index}
          aria-hidden="true"
          ref={(el) => {
            if (el) charsRef.current[index] = el;
          }}
          className="epe-wm-char relative inline-block"
          style={{
            fontVariationSettings: '"wght" 900',
            whiteSpace: char === " " ? "pre" : undefined,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
