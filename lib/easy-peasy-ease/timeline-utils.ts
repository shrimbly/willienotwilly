/**
 * Timeline helpers, ported from easy-peasy-ease/lib/timeline-utils.ts.
 * Generic over any segment with an optional `duration` (product default 1.5 s)
 * instead of the product's TransitionVideo; thumbnail extraction is replaced
 * by baked posters / filmstrips (see components/portfolio/easy-peasy-ease/kit).
 */

import { DEFAULT_OUTPUT_DURATION } from "./speed-curve-config";

export interface TimedSegment {
  duration?: number;
}

export interface SegmentBoundary<T extends TimedSegment = TimedSegment> {
  segment: T;
  startTime: number;
  endTime: number;
  index: number;
}

/** Cumulative start and end times for each segment. */
export function calculateSegmentBoundaries<T extends TimedSegment>(
  segments: T[],
): SegmentBoundary<T>[] {
  let currentTime = 0;
  const boundaries: SegmentBoundary<T>[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const duration = segment.duration ?? DEFAULT_OUTPUT_DURATION;
    boundaries.push({ segment, startTime: currentTime, endTime: currentTime + duration, index: i });
    currentTime += duration;
  }

  return boundaries;
}

/** Total duration of all segments combined. */
export function getTotalDuration(segments: TimedSegment[]): number {
  return segments.reduce((total, segment) => total + (segment.duration ?? DEFAULT_OUTPUT_DURATION), 0);
}

/** Which segment is playing at `currentTime` (wrapping into the loop). */
export function getCurrentSegmentIndex(currentTime: number, segments: TimedSegment[]): number {
  const totalDuration = getTotalDuration(segments);
  const normalizedTime =
    totalDuration > 0
      ? ((currentTime % totalDuration) + totalDuration) % totalDuration
      : currentTime;
  const boundaries = calculateSegmentBoundaries(segments);

  for (const boundary of boundaries) {
    if (normalizedTime >= boundary.startTime && normalizedTime < boundary.endTime) {
      return boundary.index;
    }
  }
  return boundaries.length > 0 ? boundaries.length - 1 : -1;
}

/** Time (s) to pixel position on the zoomed timeline. */
export function timeToPixels(time: number, pixelsPerSecond: number): number {
  if (pixelsPerSecond === 0) return 0;
  return time * pixelsPerSecond;
}

/** Pixel position to time (s). */
export function pixelsToTime(pixels: number, pixelsPerSecond: number): number {
  if (pixelsPerSecond === 0) return 0;
  return pixels / pixelsPerSecond;
}

/** Seconds to MM:SS. */
export function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
