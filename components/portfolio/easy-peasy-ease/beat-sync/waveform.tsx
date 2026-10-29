"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import type { MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

import { followValue } from "../kit/motion-value-utils";

/**
 * Ports of Waveform and AudioScrubber from easy-peasy-ease/components/ui/waveform.tsx
 * (the only two pieces of that file the editor uses).
 *
 * Changes from the product:
 * - AudioScrubber is presentational here (aria-hidden, no mouse scrub): in the
 *   editor its parent's pointerdown already prevents the scrubber's mousedown,
 *   and the audio lane carries the accessible control.
 * - `currentTime` may be a motion value; the progress fill and line then move
 *   imperatively instead of re-rendering per frame. `startTime` is subtracted
 *   first (the product passes `currentTime - silenceAtStart`).
 * - The fill scales and the line and handle translate (in cqw of the
 *   scrubber, a size container) instead of the product's width/left, so
 *   playback costs no layout per frame.
 */

export type WaveformProps = HTMLAttributes<HTMLDivElement> & {
  data?: number[];
  barWidth?: number;
  barHeight?: number;
  barGap?: number;
  barRadius?: number;
  barColor?: string;
  fadeEdges?: boolean;
  fadeWidth?: number;
  height?: string | number;
};

export function Waveform({
  data = [],
  barWidth = 4,
  barHeight: baseBarHeight = 4,
  barGap = 2,
  barRadius = 2,
  barColor,
  fadeEdges = true,
  fadeWidth = 24,
  height = 128,
  className,
  ...props
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderWaveform = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const computedBarColor =
        barColor || getComputedStyle(canvas).getPropertyValue("--foreground") || "#000";

      const barCount = Math.floor(rect.width / (barWidth + barGap));
      const centerY = rect.height / 2;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * data.length);
        const value = data[dataIndex] || 0;
        const barHeight = Math.max(baseBarHeight, value * rect.height * 0.8);
        const x = i * (barWidth + barGap);
        const y = centerY - barHeight / 2;

        ctx.fillStyle = computedBarColor;
        ctx.globalAlpha = 0.3 + value * 0.7;

        if (barRadius > 0 && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, barRadius);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }

      if (fadeEdges && fadeWidth > 0 && rect.width > 0) {
        const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
        const fadePercent = Math.min(0.2, fadeWidth / rect.width);

        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
        gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
        gradient.addColorStop(1, "rgba(255,255,255,1)");

        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.globalAlpha = 1;
    };

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        renderWaveform();
      }
    });

    resizeObserver.observe(container);
    renderWaveform();

    return () => resizeObserver.disconnect();
  }, [data, barWidth, baseBarHeight, barGap, barRadius, barColor, fadeEdges, fadeWidth]);

  return (
    <div className={cn("relative", className)} ref={containerRef} style={{ height: heightStyle }} {...props}>
      <canvas className="block h-full w-full" ref={canvasRef} />
    </div>
  );
}

export type AudioScrubberProps = WaveformProps & {
  currentTime?: number | MotionValue<number>;
  /** Subtracted from currentTime before computing progress. */
  startTime?: number;
  duration?: number;
  showHandle?: boolean;
};

export function AudioScrubber({
  data = [],
  currentTime = 0,
  startTime = 0,
  duration = 100,
  showHandle = true,
  barWidth = 3,
  barHeight,
  barGap = 1,
  barRadius = 1,
  barColor,
  fadeEdges = false,
  fadeWidth = 24,
  height = 128,
  className,
  ...props
}: AudioScrubberProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const effectiveDuration = Math.max(0, duration);
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  useEffect(() => {
    let last = Number.NaN;
    const apply = (time: number) => {
      const clamped = Math.max(0, Math.min(effectiveDuration, time - startTime));
      const fraction = effectiveDuration > 0 ? clamped / effectiveDuration : 0;
      if (fraction === last) return;
      last = fraction;
      const offset = `translateX(${(fraction * 100).toFixed(3)}cqw)`;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${fraction.toFixed(5)})`;
      if (lineRef.current) lineRef.current.style.transform = offset;
      if (handleRef.current) handleRef.current.style.transform = offset;
    };
    return followValue(currentTime, apply);
  }, [currentTime, startTime, effectiveDuration]);

  return (
    <div
      aria-hidden="true"
      className={cn("relative select-none [container-type:inline-size]", className)}
      style={{ height: heightStyle }}
      {...props}
    >
      <Waveform
        barColor={barColor}
        barGap={barGap}
        barRadius={barRadius}
        barWidth={barWidth}
        barHeight={barHeight}
        data={data}
        fadeEdges={fadeEdges}
        fadeWidth={fadeWidth}
        height={height}
      />

      <div
        ref={fillRef}
        className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left bg-primary/20 will-change-transform [transform:scaleX(0)]"
      />

      <div
        ref={lineRef}
        className="pointer-events-none absolute top-0 bottom-0 left-0 w-0.5 bg-primary will-change-transform"
      />

      {showHandle && (
        <div
          ref={handleRef}
          className="pointer-events-none absolute top-1/2 left-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-lg"
        />
      )}
    </div>
  );
}
