"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import { Loader2, RefreshCw } from "lucide-react";

import { BEAT_SUBDIVISIONS, type BeatSubdivision } from "@/lib/easy-peasy-ease/beat-sync";
import { cn } from "@/lib/utils";

/**
 * Port of easy-peasy-ease/components/BeatSyncControl.tsx (verbatim markup).
 *
 * Added for the portfolio:
 * - The BPM readout is role="img", so its aria-label is announced (a label
 *   on a plain span is ignored).
 * - `pulsePaused` holds the tempo dot while the demo is off screen.
 * - `pulseClock` phase-locks the dot to the playhead while playing, so it
 *   peaks on the beats the cuts land on (the product's dot free-runs).
 * - While updating, the re-render button is aria-disabled rather than
 *   disabled, so it keeps the keyboard focus that pressed it.
 */
interface BeatSyncControlProps {
  bpm: number;
  /** Seconds per beat — drives the pulse dot's animation tempo. */
  period: number;
  /** Active snap subdivision; 0 = off. */
  value: BeatSubdivision | 0;
  onValueChange: (value: BeatSubdivision | 0) => void;
  /** Re-render CTA, shown while a subdivision is active. */
  onApply?: () => void;
  isUpdating?: boolean;
  className?: string;
  pulsePaused?: boolean;
  pulseClock?: {
    /** Output clock, seconds. */
    time: MotionValue<number>;
    /** Video time of a beat (any beat on the grid). */
    beatTime: number;
    locked: boolean;
  };
}

const subdivisionLabel = (subdivision: BeatSubdivision) =>
  subdivision === 1 ? "Every beat" : subdivision === 2 ? "Every 2nd beat" : "Every 4th beat";

const positiveModulo = (value: number, modulus: number) => {
  const result = value % modulus;
  return result < 0 ? result + modulus : result;
};

/** Correct the dot only when it is visibly off the beat. */
const PULSE_TOLERANCE_MS = 25;

/**
 * Compact beat-snap pill: pulsing tempo dot + BPM readout + 1/2/4 toggles.
 * Overlaid on the audio track, so it swallows pointer events (the track
 * underneath starts an offset drag on pointerdown and selects on click).
 */
export function BeatSyncControl({
  bpm,
  period,
  value,
  onValueChange,
  onApply,
  isUpdating = false,
  className,
  pulsePaused = false,
  pulseClock,
}: BeatSyncControlProps) {
  const dotRef = useRef<HTMLSpanElement>(null);
  const clockTime = pulseClock?.time;
  const beatTime = pulseClock?.beatTime ?? 0;
  const locked = Boolean(pulseClock?.locked) && !pulsePaused;

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot || !clockTime || !locked || !(period > 0)) return;
    const periodMs = period * 1000;
    let animation: Animation | null = null;
    const sync = (time: number) => {
      if (!animation || animation.playState === "idle") {
        // Absent under reduced motion (the CSS removes the animation).
        animation = dot.getAnimations()[0] ?? null;
        if (!animation) return;
      }
      const wanted = positiveModulo(time - beatTime, period) * 1000;
      const current = typeof animation.currentTime === "number" ? animation.currentTime : 0;
      const delta = Math.abs(positiveModulo(current, periodMs) - wanted);
      if (Math.min(delta, periodMs - delta) > PULSE_TOLERANCE_MS) {
        animation.currentTime = wanted;
      }
    };
    sync(clockTime.get());
    return clockTime.on("change", sync);
  }, [beatTime, clockTime, locked, period]);

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-[8px] border border-border/70 bg-background/85 px-1.5 py-1 shadow-sm backdrop-blur-sm",
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span
        role="img"
        aria-label={`${Math.round(bpm)} beats per minute`}
        className="flex items-center gap-1.5 pl-1 pr-1.5"
      >
        <span
          ref={dotRef}
          aria-hidden
          className="epe-beat-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
          style={{
            animation: `epe-beat-pulse ${period}s ease-out infinite`,
            animationPlayState: pulsePaused ? "paused" : "running",
          }}
        />
        <span className="font-mono text-[11px] leading-none font-semibold text-foreground tabular-nums">
          {Math.round(bpm)}
        </span>
        <span className="text-[10px] leading-none font-semibold tracking-wide text-muted-foreground uppercase">
          bpm
        </span>
      </span>

      <div className="h-4 w-px bg-border" aria-hidden />

      <div role="group" aria-label="Snap clip lengths to beats" className="flex items-center gap-0.5">
        {BEAT_SUBDIVISIONS.map((subdivision) => {
          const active = value === subdivision;
          return (
            <button
              key={subdivision}
              type="button"
              aria-pressed={active}
              aria-label={subdivisionLabel(subdivision)}
              title={subdivisionLabel(subdivision)}
              onClick={() => onValueChange(active ? 0 : subdivision)}
              className={cn(
                "h-8 min-w-8 rounded-sm px-1 font-mono text-[11px] font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
              )}
            >
              {subdivision}
            </button>
          );
        })}
      </div>

      {value !== 0 && onApply && (
        <>
          <div className="h-4 w-px bg-border" aria-hidden />
          <button
            type="button"
            aria-label="Update video with beat-synced clips"
            title="Update video"
            onClick={isUpdating ? undefined : onApply}
            aria-disabled={isUpdating || undefined}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        </>
      )}
    </div>
  );
}
