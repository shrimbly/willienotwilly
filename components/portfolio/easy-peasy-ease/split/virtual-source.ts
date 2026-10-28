import { CAR_CLIPS, filmstripTileAt, type Filmstrip } from "@/lib/easy-peasy-ease/car-clips";
import { deriveSections } from "@/lib/easy-peasy-ease/chunking";
import { getPresetBezier } from "@/lib/easy-peasy-ease/easing-presets";
import {
  createRetimeMap,
  type RetimeMap,
  type RetimeSample,
  type RetimeSection,
} from "@/lib/easy-peasy-ease/speed-curve";

import type { RetimeClip } from "../kit/retime-engine";

/**
 * The split demo's "one long video": car-4, car-5 and car-6 played back to
 * back (rear three-quarter, along the flank to the front wheel, then the
 * grille and headlamp; 15.25 s). The hero already plays car-1 to car-3.
 * Nothing is re-encoded; the retime engine gets one clip per file and a map
 * whose `index` is the file, so a section that straddles two files simply
 * cuts between their <video> elements.
 */
const FILES = CAR_CLIPS.slice(3, 6);

export const FILE_DURATION = FILES[0].duration;
export const SOURCE_DURATION = FILE_DURATION * FILES.length;
export const SOURCE_NAME = "mgb-gt-v8.mp4";
export const SOURCE_RESOLUTION = `${FILES[0].width}×${FILES[0].height}`;
export const SOURCE_ASPECT = FILES[0].width / FILES[0].height;

export const SOURCE_CLIPS: RetimeClip[] = FILES.map((file) => ({
  id: file.id,
  src: file.src,
  poster: file.poster,
  sourceDuration: file.duration,
  duration: file.duration,
  easing: "Linear",
  fps: file.fps,
  frameCount: file.frameCount,
}));

/** Which file shows virtual source time `v`, and where in it. */
export function locateSource(v: number) {
  const file = Math.min(FILES.length - 1, Math.max(0, Math.floor(v / FILE_DURATION)));
  return { file, local: Math.max(0, v - file * FILE_DURATION) };
}

/** The 8 frames SplitTrack shows, sampled at the middle of each eighth (as the product does). */
export const FILMSTRIP_CELLS: Array<{ strip: Filmstrip; index: number }> = Array.from(
  { length: 8 },
  (_, i) => {
    const { file, local } = locateSource((SOURCE_DURATION * (i + 0.5)) / 8);
    const strip = FILES[file].filmstrip;
    return { strip, index: filmstripTileAt(strip, local, FILE_DURATION) };
  },
);

export interface VirtualMap extends RetimeMap {
  /** The section sample at output time t, with `sourceTime` in virtual source seconds. */
  sectionAt(t: number): RetimeSample;
  /** Output time at which virtual source time `v` is on screen (inverse of the curves). */
  outputFor(v: number): number;
}

/**
 * Wraps createRetimeMap (sections over the virtual source) so the engine sees
 * file indices and file-local times. speedAt is only ever called for the
 * sample sourceAt just returned, so it reuses that sample's section.
 */
function createVirtualMap(sections: RetimeSection[]): VirtualMap {
  const inner = createRetimeMap(sections);
  let lastSection = 0;

  const sourceAt: RetimeMap["sourceAt"] = (t, options) => {
    const sample = inner.sourceAt(t, options);
    lastSection = sample.index;
    const { file, local } = locateSource(sample.sourceTime);
    return { ...sample, index: file, sourceTime: local };
  };

  const outputFor = (v: number) => {
    if (sections.length === 0) return 0;
    let index = 0;
    while (index < sections.length - 1 && v >= sections[index + 1].sourceStart) index++;
    const section = sections[index];
    const span = section.sourceEnd - section.sourceStart;
    const target = span > 0 ? Math.min(1, Math.max(0, (v - section.sourceStart) / span)) : 0;
    // Presets are monotonic, so bisect for the first progress that reaches the target.
    const ease = inner.easings[index];
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (ease(mid) < target) lo = mid;
      else hi = mid;
    }
    return inner.starts[index] + hi * Math.max(0, section.duration);
  };

  return {
    total: inner.total,
    starts: inner.starts,
    easings: inner.easings,
    sourceAt,
    speedAt: (_file, progress) => inner.speedAt(lastSection, progress),
    sectionAt: (t) => inner.sourceAt(t),
    outputFor,
  };
}

/** Editing: the source plays straight through at 1x. */
export const EDIT_MAP = createVirtualMap([
  { sourceStart: 0, sourceEnd: SOURCE_DURATION, duration: SOURCE_DURATION, easing: (p) => p },
]);

let lastSequence: { splitTimes: number[]; outputDuration: number; preset: string; map: VirtualMap } | null =
  null;

/**
 * "Create N clips": every section eased into `outputDuration`, back to back.
 * The same arguments return the same map, so a handler that swaps the map
 * straight away and the render that follows hand the engine one identity.
 */
export function createSequenceMap(splitTimes: number[], outputDuration: number, preset: string) {
  if (
    lastSequence?.splitTimes === splitTimes &&
    lastSequence.outputDuration === outputDuration &&
    lastSequence.preset === preset
  ) {
    return lastSequence.map;
  }
  const bezier = getPresetBezier(preset);
  const map = createVirtualMap(
    deriveSections(SOURCE_DURATION, splitTimes).map((section) => ({
      sourceStart: section.start,
      sourceEnd: section.end,
      duration: outputDuration,
      easing: bezier,
    })),
  );
  lastSequence = { splitTimes, outputDuration, preset, map };
  return map;
}
