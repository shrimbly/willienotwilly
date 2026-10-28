/**
 * Beat-grid maths for snapping section durations and audio offset so section
 * boundaries land on beats. Ported verbatim from easy-peasy-ease/lib/beat-sync.ts.
 *
 * Durations are quantized so each CUMULATIVE boundary sits on the output frame
 * closest to its beat, at the coarsest render rate (PREVIEW_FPS = 30), so the
 * error never accumulates across sections.
 */

import beats128 from "./beats-128.json";
import { PREVIEW_FPS } from "./speed-curve-config";

/** Sections can end on every beat, every 2nd beat, or every 4th beat. */
export type BeatSubdivision = 1 | 2 | 4;
export const BEAT_SUBDIVISIONS: readonly BeatSubdivision[] = [1, 2, 4];

export interface BeatGrid {
  /** Seconds per beat. */
  period: number;
  /** Seconds from the start of the audio to the first beat. */
  firstBeatOffset: number;
}

export interface BeatAnalysis extends BeatGrid {
  bpm: number;
  confidence: number;
}

/** Shape of the product's `waveformData` (useAudioVisualization). */
export interface WaveformData {
  sampleRate: number;
  duration: number;
  /** 256 normalised peaks, 0–1. */
  peaks: number[];
  beats: BeatAnalysis | null;
}

/**
 * Baked output of the product's analyzeBeats + 256-peak waveform for
 * /audio/portfolio/demos/beats-128.mp3 (synthetic kick, 30 s, 128.05 BPM).
 */
export const BEATS_128: WaveformData = beats128;
export const BEATS_128_SRC = "/audio/portfolio/demos/beats-128.mp3";

const positiveModulo = (value: number, modulus: number): number => {
  const result = value % modulus;
  return result < 0 ? result + modulus : result;
};

/**
 * Snap each duration to the nearest whole number of `beatsPerSection` beats
 * (at least one), then re-quantize so every cumulative boundary lands on the
 * output frame nearest its beat time.
 */
export function snapDurationsToBeatGrid(
  durations: number[],
  bpm: number,
  beatsPerSection: BeatSubdivision,
  fps: number = PREVIEW_FPS,
): number[] {
  if (!(bpm > 0) || !(fps > 0)) {
    return [...durations];
  }
  const interval = (60 / bpm) * beatsPerSection;
  const snapped: number[] = [];
  let intervalCount = 0;
  let previousBoundaryFrames = 0;
  for (const duration of durations) {
    intervalCount += Math.max(1, Math.round(duration / interval));
    const boundaryFrames = Math.round(intervalCount * interval * fps);
    snapped.push((boundaryFrames - previousBoundaryFrames) / fps);
    previousBoundaryFrames = boundaryFrames;
  }
  return snapped;
}

/**
 * Shift the audio offset left by less than one beat so that a beat lands
 * exactly at video time 0. Always shifts left — nudging audio earlier trims a
 * sliver of intro, whereas shifting right would insert dead air.
 */
export function alignOffsetToBeatGrid(offset: number, grid: BeatGrid): number {
  if (!(grid.period > 0)) {
    return offset;
  }
  const phase = positiveModulo(offset + grid.firstBeatOffset, grid.period);
  // An already-aligned offset can carry float error that leaves its phase at
  // period - epsilon; subtracting that would trim a whole extra beat.
  if (grid.period - phase < 1e-9) {
    return offset;
  }
  return offset - phase;
}

/**
 * Move `offset` to the NEAREST beat-aligned position (at most half a beat
 * either way), so a waveform drag feels magnetic while snapping is active.
 */
export function quantizeOffsetToNearestBeat(offset: number, grid: BeatGrid): number {
  if (!(grid.period > 0)) {
    return offset;
  }
  const aligned = alignOffsetToBeatGrid(offset, grid);
  return offset - aligned > grid.period / 2 ? aligned + grid.period : aligned;
}

/** Beats fall on the video timeline at firstBeatVideoTime + k * period. */
export function firstBeatVideoTime(grid: BeatGrid, offset: number): number {
  return offset + grid.firstBeatOffset;
}

/** Anchor for emphasized ticks: the beat nearest video time 0. */
export function emphasisAnchorVideoTime(grid: BeatGrid, offset: number): number {
  if (!(grid.period > 0)) {
    return 0;
  }
  const first = firstBeatVideoTime(grid, offset);
  return first + Math.round(-first / grid.period) * grid.period;
}
