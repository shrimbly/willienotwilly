// How the Working bar moves in Booth's demo mode, ported from studiovoice/app/Sources/Booth/Model/
// Fakes.swift (`FakeJobRunner.simulate`: a hello, a 0.6 s pause, then progress in 0.1 s ticks
// over 6–11 s, stable per file name), BoothCore/ProgressGlide.swift (each change glides linearly
// over 0.25 s, and overlapping glides add up), BoothCore/EngineProtocol.swift (`EngineStage.studio`)
// and BoothCore/Formatting.swift (`statusLine`, which VoiceOver reads as the bar's value).

import { POPOVER_MOTION } from "./motion";

/** The demo engine's pacing (Fakes.swift). */
export const DEMO_ENGINE = {
  /** The engine says hello, then waits this long before its first progress. */
  helloSeconds: 0.6,
  /** Progress arrives this often. */
  tickSeconds: 0.1,
  /** An audio file is taken to be 48 s long; a video 192 s. */
  audioDuration: 48,
  videoDuration: 192,
  /** The real run Booth estimates: about 0.57 of the file's length. */
  realTimeFactor: 0.57,
} as const;

/**
 * Wall-clock seconds the demo spends on a file: 6–11, stable per name (Fakes.swift
 * `demoSeconds`, a djb2 hash over the name's UTF-8 in wrapping 32-bit arithmetic).
 */
export function demoSeconds(name: string): number {
  let hash = 5381;
  for (const byte of new TextEncoder().encode(name)) hash = (Math.imul(hash, 33) + byte) >>> 0;
  return 6 + (hash % 6);
}

/** The run the engine estimates for a file, in seconds: what the ETA counts down from. */
export function demoRealTotal(video: boolean): number {
  return Math.round((video ? DEMO_ENGINE.videoDuration : DEMO_ENGINE.audioDuration) * DEMO_ENGINE.realTimeFactor);
}

/** Sidon with music separation, each stage's share of the run (EngineStage.studio). */
export const STUDIO_STAGES = [
  { id: "decode", label: "Reading audio", weight: 0.03 },
  { id: "separate", label: "Separating music", weight: 0.4 },
  { id: "restore", label: "Restoring the voice", weight: 0.4 },
  { id: "cleanup", label: "Removing clicks", weight: 0.1 },
  { id: "write", label: "Writing the file", weight: 0.07 },
] as const;

/** The stage running at overall `progress`: the last one whose share has begun. */
export function stageAt(progress: number): (typeof STUDIO_STAGES)[number] {
  let start = 0;
  let current: (typeof STUDIO_STAGES)[number] = STUDIO_STAGES[0];
  for (const stage of STUDIO_STAGES) {
    if (progress >= start) current = stage;
    start += stage.weight;
  }
  return current;
}

/** Whole percent, rounded half up like the prototype's `Math.round`. */
export function percent(fraction: number): number {
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
}

/** `"about 3 min left"` (≥ 90 s), `"about 1 min left"` (≥ 40 s), else `"under a minute left"`. */
export function etaPhrase(seconds: number): string {
  if (seconds >= 90) return `about ${Math.round(seconds / 60)} min left`;
  if (seconds >= 40) return "about 1 min left";
  return "under a minute left";
}

/** The Working screen's status line, `"52% · Restoring the voice · about 1 min left"`. */
export function statusLine(progress: number, video = false): string {
  const eta = demoRealTotal(video) * (1 - Math.min(1, Math.max(0, progress)));
  return [`${percent(progress)}%`, stageAt(progress).label, etaPhrase(eta)].join(" · ");
}

/**
 * The Working bar's glide between the engine's progress updates (ProgressGlide.swift). Each
 * change plays out linearly over `seconds`, and changes that overlap add up, the way SwiftUI
 * runs a new linear animation alongside the one it interrupts. Times are seconds on any clock.
 */
export class ProgressGlide {
  private steps: { start: number; change: number }[] = [];

  constructor(readonly seconds: number = POPOVER_MOTION.progressGlide) {}

  /** Progress moved by `change` at `time`. */
  add(change: number, time: number) {
    this.steps = this.steps.filter((step) => time - step.start < this.seconds);
    if (change !== 0) this.steps.push({ start: time, change });
  }

  /** Forget every glide in flight: the bar is where it is told to be. */
  clear() {
    this.steps = [];
  }

  /** Where the bar is at `time` on its way to `target`. */
  value(target: number, time: number): number {
    return this.steps.reduce((value, step) => {
      const done = Math.min(1, Math.max(0, (time - step.start) / this.seconds));
      return value - step.change * (1 - done);
    }, target);
  }

  /** Whether a glide is still playing out at `time`. */
  moving(time: number): boolean {
    return this.steps.some((step) => time - step.start < this.seconds);
  }
}
