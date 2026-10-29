import { HIGH_NOTE_PHONK, HIGH_NOTE_PHONK_SRC } from "@/lib/easy-peasy-ease/beat-sync";

import type { EvEdit, SourceMedia } from "./model";

// The edit the demo opens: the first three shots of "Plate and Mail", an edit made in Node Banana (its own In and Out
// points), stacked one row per clip with a second's overlap each (Line up), a title over the first, and High Note
// Phonk, the Easy Peasy Ease beat sync demo's track, under the lot.

const SHOT = (n: number, name: string): SourceMedia => ({
  id: `shot-${n}`,
  name,
  src: `/videos/portfolio/demos/plate-and-mail/clip-${n}.mp4`,
  poster: `/images/portfolio/demos/plate-and-mail/clip-${n}.jpg`,
  strip: `/images/portfolio/demos/plate-and-mail/clip-${n}-strip.jpg`,
  // 145 frames each: the third, an 18 s generation, is cut to its first 145, which hold the part the edit uses
  duration: 6.042,
});

export const SOURCES: SourceMedia[] = [
  SHOT(1, "ntsc_rs_08ff50e842c9e9e4d982002aa87a6add.mp4"),
  SHOT(2, "ntsc_rs_3acde6b779a1ca2292c3e55a7da99193.mp4"),
  SHOT(3, "ntsc_rs_0c09efbc2c1574846b524bd17530b57b.mp4"),
];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export const AUDIO_SRC = HIGH_NOTE_PHONK_SRC;
export const STRIP_FRAMES = 8;
/** One frame of a strip, in the image's px. */
export const STRIP_TILE = { width: 160, height: 90 } as const;
export const FRAME_ASPECT = 960 / 536;
export const EDIT_NAME = "Plate and Mail";

export const INITIAL_EDIT: EvEdit = {
  clips: [
    { id: "c1", source: "shot-1", inSec: 1.976, outSec: 5.566, start: 0, speed: 1, ramp: null, muted: false, volume: 1 },
    { id: "c2", source: "shot-2", inSec: 0.768, outSec: 4.308, start: 2.59, speed: 1, ramp: null, muted: false, volume: 1 },
    { id: "c3", source: "shot-3", inSec: 1.907, outSec: 5.077, start: 5.13, speed: 1, ramp: null, muted: false, volume: 1 },
  ],
  texts: [
    {
      id: "t1",
      text: "Plate & Mail",
      startSec: 0.6,
      endSec: 3.9,
      fadeInSec: 0.5,
      fadeOutSec: 0.5,
      weight: 600,
      wash: 0.5,
    },
  ],
  audio: {
    id: "a1",
    name: "high-note-phonk.mp3",
    startSec: 0,
    // The first beat lands on 0:00, where the beat sync demo's snap starts the track too
    inSec: 0.3145,
    outSec: 8.6145,
    duration: HIGH_NOTE_PHONK.duration,
    muted: false,
    volume: 1,
    fade: { in: false, out: false },
  },
  crossfade: true,
  mode: "stacked",
};

/** Where the still tile rests (reduced motion, and before it plays): mid-dissolve from Clip 1 to Clip 2, under the title. */
export const RESTING_PLAYHEAD = 3;

/** The track's peaks, 256 bins over its 30 s (the beat sync demo's waveform). */
export const AUDIO_PEAKS: readonly number[] = HIGH_NOTE_PHONK.peaks;
export const AUDIO_DURATION = HIGH_NOTE_PHONK.duration;
