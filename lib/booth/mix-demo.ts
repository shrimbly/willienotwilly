// "The mix" highlight's constants and its idle script, from studiovoice/app/Sources/Booth/Model/
// AppModel.swift (the `doneMix` fixture and saveMix), Model/Fakes.swift (`booth --demo`: the
// FakeRemixer and FakePreviewPlayer) and Engine/EngineRemixer.swift (the command Save runs).

import { MIX_STANDARD, type Mix, type MixStem } from "./mix";
import { CURVES, bezierEase } from "./motion";

/** The file the Done screen shows: an interview with music under it, so all three sliders show. */
export const MIX_DEMO_FILE = "interview-take3.m4a";
/** Where Save writes: OutputNaming.swift's `<stem>-enhanced`, and audio comes out as `.wav`. */
export const MIX_DEMO_OUTPUT = "interview-take3-enhanced.wav";

/** The app's snapshots rest the playhead here (AppModel.fixture `showDone`). */
export const MIX_DEMO_PLAYHEAD = 0.32;

/**
 * `booth --demo` plays nothing: FakePreviewPlayer moves the playhead across a 12 s clip at 30
 * ticks a second, then stops back at the start. The real stems aren't published, so this demo
 * plays the same way.
 */
export const DEMO_CLIP_SECONDS = 12;

/** FakeRemixer's delay under `--demo`: Save reads "Saving…" this long. */
export const DEMO_SAVE_SECONDS = 1.2;

/**
 * The command Save runs on the stems the first pass kept (EngineRemixer.swift: `remix <stems>
 * -s -b -m --events`), as the README writes it for a folder called `stems`.
 */
export function remixArguments(mix: Mix): { flag: string; stem: MixStem; value: number }[] {
  return [
    { flag: "-s", stem: "speech", value: mix.speech },
    { flag: "-b", stem: "background", value: mix.background },
    { flag: "-m", stem: "music", value: mix.music },
  ];
}

/* ---------------------------------------------------------------------------- the idle script */

/** One excursion: a slider glides from the saved mix to `to`, holds, and glides back. */
interface Excursion {
  stem: MixStem;
  to: number;
  /** Seconds into the loop it starts to move. */
  at: number;
}

/** Each glide takes this long on the app's even in-and-out curve; the far end holds this long. */
const GLIDE = { out: 1.6, hold: 1.5, back: 1.4 } as const;

/**
 * Background first (the pauses fill in with room tone), then Music (a bed rises under the words):
 * the two moves that reshape the synthetic bars the most. Never two at once.
 */
const EXCURSIONS: readonly Excursion[] = [
  { stem: "background", to: 64, at: 1.4 },
  { stem: "music", to: 70, at: 8.6 },
];

/** One pass of the script, rests included. */
export const MIX_SCRIPT_LOOP = 15.6;

const inOut = bezierEase(CURVES.inOut);

/**
 * The mix `t` seconds into the idle script, which moves one slider at a time away from `saved`
 * and back, so the bars reshape and Revert and Save come and go without a hand on the demo.
 */
export function scriptedMix(t: number, saved: Mix = MIX_STANDARD): Mix {
  const at = ((t % MIX_SCRIPT_LOOP) + MIX_SCRIPT_LOOP) % MIX_SCRIPT_LOOP;
  const mix = { ...saved };
  for (const move of EXCURSIONS) {
    const from = saved[move.stem];
    const local = at - move.at;
    if (local <= 0) continue;
    let k = 0;
    if (local < GLIDE.out) k = inOut(local / GLIDE.out);
    else if (local < GLIDE.out + GLIDE.hold) k = 1;
    else if (local < GLIDE.out + GLIDE.hold + GLIDE.back) k = 1 - inOut((local - GLIDE.out - GLIDE.hold) / GLIDE.back);
    mix[move.stem] = Math.round(from + (move.to - from) * k);
  }
  return mix;
}
