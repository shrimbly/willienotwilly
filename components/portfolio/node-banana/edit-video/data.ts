import type { EvEdit, SourceMedia } from "./model";

// The edit the demo opens: four MGB GT V8 shots generated in Node Banana, stacked one row per clip with a second's
// overlap each (Line up), a title over the first, and a 128 BPM kick under the lot.

const CAR = (n: number, name: string): SourceMedia => ({
  id: `car-${n}`,
  name,
  src: `/videos/portfolio/demos/cars/car-${n}.mp4`,
  poster: `/images/portfolio/demos/cars/car-${n}.jpg`,
  strip: `/images/portfolio/demos/cars/car-${n}-strip.jpg`,
  duration: 5.083,
});

export const SOURCES: SourceMedia[] = [
  CAR(1, "mgb_gt_v8_reveal_7c41e2"),
  CAR(2, "mgb_gt_v8_crane_0b9fd3"),
  CAR(3, "mgb_gt_v8_overhead_52aa18"),
  CAR(4, "mgb_gt_v8_door_e60c7b"),
  CAR(5, "mgb_gt_v8_wheel_3d18f0"),
  CAR(6, "mgb_gt_v8_grille_a4c95e"),
];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export const AUDIO_SRC = "/audio/portfolio/demos/beats-128.mp3";
export const STRIP_FRAMES = 8;
export const FRAME_ASPECT = 960 / 642;
export const EDIT_NAME = "MGB GT V8";

export const INITIAL_EDIT: EvEdit = {
  clips: [
    { id: "c1", source: "car-1", inSec: 0.2, outSec: 4.2, start: 0, speed: 1, ramp: null, muted: false, volume: 1 },
    { id: "c2", source: "car-2", inSec: 0.4, outSec: 4.4, start: 3, speed: 1, ramp: null, muted: false, volume: 1 },
    { id: "c3", source: "car-3", inSec: 0.6, outSec: 4.6, start: 6, speed: 1, ramp: null, muted: false, volume: 1 },
    { id: "c4", source: "car-6", inSec: 0, outSec: 5, start: 9, speed: 1, ramp: null, muted: false, volume: 1 },
  ],
  texts: [
    {
      id: "t1",
      text: "MGB GT V8",
      startSec: 0.8,
      endSec: 4.4,
      fadeInSec: 0.5,
      fadeOutSec: 0.5,
      weight: 600,
      wash: 0.5,
    },
  ],
  audio: {
    id: "a1",
    name: "beats_128.mp3",
    startSec: 0,
    // The first kick lands on 0:00
    inSec: 0.162,
    outSec: 14.162,
    duration: 30,
    muted: false,
    volume: 1,
    fade: { in: false, out: false },
  },
  crossfade: true,
  mode: "stacked",
};

/** Where the still tile rests (reduced motion, and before it plays): mid-dissolve from Clip 1 to Clip 2, under the title. */
export const RESTING_PLAYHEAD = 3.42;

/** The kick's peaks, 256 bins over its 30 s (scratchpad/beats-128.waveform.json, rounded). */
export const BEAT_PEAKS: readonly number[] = [
  0.001, 0.85, 0.065, 0.002, 0.001, 0.833, 0.065, 0.002, 0.001, 0.789, 0.066, 0.002, 0.001, 0.793, 0.066, 0.002, 0.001, 0.797, 0.066, 0.002, 0.001, 0.802, 0.067, 0.002,
  0.001, 0.806, 0.067, 0.002, 0.001, 0.81, 0.068, 0.002, 0.001, 0.815, 0.068, 0.002, 0.001, 0.819, 0.068, 0.002, 0.001, 0.823, 0.069, 0.002, 0.001, 0.828, 0.069, 0.002,
  0.001, 0.832, 0.069, 0.002, 0.001, 0.837, 0.07, 0.002, 0.001, 0.841, 0.07, 0.002, 0.001, 0.846, 0.07, 0.002, 0.001, 0.85, 0.07, 0.002, 0.001, 0.833, 0.07, 0.002,
  0.001, 0.789, 0.068, 0.002, 0.001, 0.793, 0.066, 0.002, 0.001, 0.797, 0.066, 0.002, 0.001, 0.802, 0.067, 0.002, 0.001, 0.806, 0.067, 0.002, 0.001, 0.81, 0.068, 0.002,
  0.001, 0.815, 0.068, 0.002, 0.001, 0.819, 0.068, 0.002, 0.001, 0.823, 0.069, 0.002, 0.001, 0.828, 0.069, 0.002, 0.001, 0.832, 0.069, 0.002, 0.001, 0.837, 0.07, 0.002,
  0.001, 0.841, 0.07, 0.002, 0.001, 0.846, 0.07, 0.002, 0.001, 0.85, 0.071, 0.002, 0.001, 0.833, 0.071, 0.002, 0.001, 0.789, 0.072, 0.002, 0.001, 0.793, 0.072, 0.002,
  0.001, 0.797, 0.072, 0.002, 0.001, 0.802, 0.073, 0.002, 0.001, 0.806, 0.073, 0.002, 0.001, 0.81, 0.073, 0.002, 0.001, 0.815, 0.074, 0.002, 0.001, 0.819, 0.074, 0.002,
  0.001, 0.823, 0.075, 0.002, 0.001, 0.828, 0.075, 0.002, 0.001, 0.832, 0.075, 0.002, 0.001, 0.837, 0.076, 0.002, 0.001, 0.841, 0.076, 0.002, 0.001, 0.846, 0.077, 0.002,
  0.001, 0.85, 0.076, 0.002, 0.001, 0.833, 0.075, 0.002, 0.001, 0.789, 0.073, 0.002, 0.001, 0.793, 0.072, 0.002, 0.001, 0.797, 0.072, 0.002, 0.001, 0.802, 0.073, 0.002,
  0.001, 0.806, 0.073, 0.002, 0.001, 0.81, 0.073, 0.002, 0.001, 0.815, 0.074, 0.002, 0.001, 0.819, 0.074, 0.002, 0.001, 0.823, 0.075, 0.002, 0.001, 0.828, 0.075, 0.002,
  0.001, 0.832, 0.075, 0.002, 0.001, 0.837, 0.076, 0.002, 0.001, 0.841, 0.076, 0.002, 0.001, 0.846, 0.077, 0.002,
];
export const BEAT_DURATION = 30;
