/**
 * Output-driven retiming maths.
 *
 * `buildEasedSourceTimestamps` and `mapDesiredToSourceIndices` are verbatim
 * from easy-peasy-ease/lib/speed-curve.ts (the renderer's core). The product
 * renders offline; `createRetimeMap` is the same mapping evaluated live, for
 * any output time, across sections stitched back to back.
 */

import { resolveEasing, type EasingFunction } from "./easing-functions";
import type { Bezier } from "./easing-presets";

export interface EasedSampleParams {
  /** Absolute track time (s) where this section begins. */
  spanStart: number;
  /** Absolute track time (s) where this section ends. */
  spanEnd: number;
  /** Absolute end timestamp (s) of the whole track — a hard upper clamp. */
  trackEnd: number;
  /** Easing function mapping output progress -> source progress, both [0, 1]. */
  easing: EasingFunction;
  /** Number of output frame slots to emit. */
  outputFrameCount: number;
  /** Output frame interval (s), used to size the end-of-section safety clamp. */
  minFrameInterval: number;
}

/**
 * For each output frame slot, the source timestamp the easing curve calls for
 * within [spanStart, spanEnd]: output progress p samples the source at
 * `spanStart + easing(p) * (spanEnd - spanStart)`. The first and last slots
 * land exactly on the span's ends, which is why loops close cleanly.
 */
export function buildEasedSourceTimestamps(params: EasedSampleParams): number[] {
  const { spanStart, spanEnd, trackEnd, easing: easingFunc, outputFrameCount, minFrameInterval } =
    params;
  const frames = Math.max(1, Math.floor(outputFrameCount));
  const span = Math.max(0, spanEnd - spanStart);
  const epsilon = Math.min(0.001, minFrameInterval / 2);
  const endClamp = Math.max(spanStart, Math.min(spanEnd, trackEnd) - epsilon);

  const timestamps: number[] = [];
  for (let slot = 0; slot < frames; slot++) {
    const outputProgress = frames > 1 ? slot / (frames - 1) : 0;
    const sourceProgress = easingFunc(outputProgress);
    const sourceTime = spanStart + sourceProgress * span;
    timestamps.push(Math.min(Math.max(sourceTime, spanStart), endClamp));
  }
  return timestamps;
}

/** Small tolerance for floating-point timestamp comparisons (seconds). */
const TIMESTAMP_EPSILON = 1e-9;

/**
 * For each desired time, the index of the source frame to display: the last
 * frame whose start timestamp is <= the desired time (clamped to frame 0).
 * Returns -1 for every slot when there are no source frames.
 */
export function mapDesiredToSourceIndices(sourceTimestamps: number[], desired: number[]): number[] {
  const result: number[] = [];
  if (sourceTimestamps.length === 0) {
    return desired.map(() => -1);
  }
  let i = 0;
  for (const d of desired) {
    while (i + 1 < sourceTimestamps.length && sourceTimestamps[i + 1] <= d + TIMESTAMP_EPSILON) {
      i++;
    }
    result.push(i);
  }
  return result;
}

/** Same end clamp the renderer applies (`min(0.001, frameInterval / 2)`). */
export const SOURCE_END_EPSILON = 0.001;

export interface RetimeSection {
  /** Source in-point, seconds. */
  sourceStart: number;
  /** Source out-point, seconds. */
  sourceEnd: number;
  /** Output duration the span is eased into, seconds. */
  duration: number;
  /** Output progress -> source progress: a bezier tuple, preset name or function. */
  easing: Bezier | string | EasingFunction;
}

export interface RetimeSample {
  /** Output time, wrapped into [0, total) when looping. */
  time: number;
  /** Index of the section playing at `time`. */
  index: number;
  /** Output time at which that section starts. */
  sectionStart: number;
  /** Linear progress through the section's output duration, 0–1 (the curve's x). */
  progress: number;
  /** Eased source progress, 0–1 (the curve's y). */
  eased: number;
  /** Source time to show, seconds. */
  sourceTime: number;
}

export interface RetimeMap {
  /** Total output duration, seconds. */
  total: number;
  /** Output start time of each section. */
  starts: number[];
  easings: EasingFunction[];
  /** Which source frame to show at output time `t`. */
  sourceAt(t: number, options?: { loop?: boolean }): RetimeSample;
  /** Instantaneous playback speed vs real time (1 = normal) at `progress` in section `index`. */
  speedAt(index: number, progress: number): number;
}

/**
 * Live form of the renderer's mapping for sections stitched back to back:
 * output time -> (section, progress p, source time `start + ease(p) * span`).
 */
export function createRetimeMap(sections: RetimeSection[]): RetimeMap {
  const easings = sections.map((s) => resolveEasing(s.easing));
  const durations = sections.map((s) => Math.max(0, s.duration));
  const starts: number[] = [];
  let total = 0;
  for (const d of durations) {
    starts.push(total);
    total += d;
  }

  const sourceAt = (t: number, { loop = true }: { loop?: boolean } = {}): RetimeSample => {
    if (sections.length === 0 || total <= 0) {
      return { time: 0, index: 0, sectionStart: 0, progress: 0, eased: 0, sourceTime: 0 };
    }
    const time = loop
      ? ((t % total) + total) % total
      : Math.min(Math.max(t, 0), total);
    let index = 0;
    while (index < sections.length - 1 && time >= starts[index] + durations[index]) {
      index++;
    }
    const section = sections[index];
    const local = time - starts[index];
    const progress = durations[index] > 0 ? Math.min(1, Math.max(0, local / durations[index])) : 1;
    const eased = easings[index](progress);
    const span = Math.max(0, section.sourceEnd - section.sourceStart);
    const endClamp = Math.max(section.sourceStart, section.sourceEnd - SOURCE_END_EPSILON);
    const sourceTime = Math.min(
      Math.max(section.sourceStart + eased * span, section.sourceStart),
      endClamp,
    );
    return { time, index, sectionStart: starts[index], progress, eased, sourceTime };
  };

  const speedAt = (index: number, progress: number, h = 1e-3) => {
    const section = sections[index];
    const ease = easings[index];
    if (!section || !ease || !(durations[index] > 0)) return 0;
    const lo = Math.max(0, progress - h);
    const hi = Math.min(1, progress + h);
    if (hi <= lo) return 0;
    const slope = (ease(hi) - ease(lo)) / (hi - lo);
    return slope * ((section.sourceEnd - section.sourceStart) / durations[index]);
  };

  return { total, starts, easings, sourceAt, speedAt };
}

/** Index of the source frame showing at `sourceTime` for a constant-rate clip. */
export function sourceFrameIndex(sourceTime: number, fps: number, frameCount?: number): number {
  const index = Math.floor(sourceTime * fps + 1e-6);
  const max = frameCount !== undefined ? frameCount - 1 : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(index, 0), max);
}
