import { CAR_CLIPS, type CarClip } from "@/lib/easy-peasy-ease/car-clips";
import { getPresetBezier, type Bezier } from "@/lib/easy-peasy-ease/easing-presets";
import { DEFAULT_OUTPUT_DURATION } from "@/lib/easy-peasy-ease/speed-curve-config";

/** One timeline segment of the final editor: a source clip eased into `duration` seconds. */
export interface EditorClip {
  id: string;
  source: CarClip;
  loopIteration: number;
  duration: number;
  preset: string;
  bezier: Bezier;
}

export const LOOP_OPTIONS = [1, 2, 3] as const;

/** Clip duration bounds of the hero's "Seconds" field. */
export const MIN_CLIP_SECONDS = 0.3;
export const MAX_CLIP_SECONDS = 4;

// car-1 → car-2 → car-3 is one continuous camera move (push in, rise over the
// roof, swing round to the rear), so in-out curves make the cuts seamless.
const STITCH: { source: CarClip; preset: string }[] = [
  { source: CAR_CLIPS[0], preset: "In Out Quad" },
  { source: CAR_CLIPS[1], preset: "In Out Cubic" },
  { source: CAR_CLIPS[2], preset: "In Out Quart" },
];

export const INITIAL_CLIPS: EditorClip[] = STITCH.map(({ source, preset }) => ({
  id: source.id,
  source,
  loopIteration: 1,
  duration: DEFAULT_OUTPUT_DURATION,
  preset,
  bezier: getPresetBezier(preset),
}));

/**
 * Port of the product's syncSegmentsToLoopCount (app/page.tsx): raising the
 * loop count clones the previous loop's clips, settings included; lowering it
 * drops the extra loops.
 */
export function syncClipsToLoopCount(clips: EditorClip[], target: number): EditorClip[] {
  const currentMax = clips.reduce((max, clip) => Math.max(max, clip.loopIteration), 1);
  if (target <= currentMax) return clips.filter((clip) => clip.loopIteration <= target);

  let next = [...clips];
  for (let loop = currentMax; loop < target; loop++) {
    const previous = next.filter((clip) => clip.loopIteration === loop);
    next = [
      ...next,
      ...previous.map((clip) => ({
        ...clip,
        id: `${clip.source.id}-loop-${loop + 1}`,
        loopIteration: loop + 1,
        bezier: [...clip.bezier] as Bezier,
      })),
    ];
  }
  return next;
}

// The product shows the rendered file's size. Nothing is rendered here, so the
// readout scales the product's own preview render (1.47MB for 4.5s) with length.
const PREVIEW_BYTES_PER_SECOND = (1.47 * 1024 * 1024) / 4.5;

export function estimateRenderBytes(totalSeconds: number) {
  return totalSeconds * PREVIEW_BYTES_PER_SECOND;
}
