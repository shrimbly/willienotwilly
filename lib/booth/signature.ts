// The "Booth" signature's numbers, ported from studiovoice/app/Sources/BoothCore
// (SignatureWave.swift, SignatureMist.swift, SignatureReveal.swift) and the website's `.name`
// CSS (site/index.html), which draws the app's 44 pt name at 56 px. The kit's CSS
// (components/portfolio/booth/kit/booth.css) carries the site's values in em of that 56 px,
// so the name scales with its font size; the maths here drives what CSS cannot.

export const SIGNATURE_LETTERS = ["B", "o", "o", "t", "h"] as const;

/** The app's name size, in points (SignatureView.swift), and the website's, in px. */
export const SIGNATURE_SIZE = { app: 44, site: 56 } as const;

/** The app's resting focus and the Working wave (SignatureWave.swift). */
export const SIGNATURE_WAVE = {
  /** One pass plus a short rest. */
  milliseconds: 4200,
  /** How far the crest reaches either side, in word widths. */
  width: 0.7,
  restingBlur: 1.5,
  restingAlpha: 0.4,
  crestAlphaBoost: 0.24,
} as const;

export interface SignatureLetterStyle {
  /** Blur radius in points at the app's 44 pt. */
  blur: number;
  /** The resting ink's alpha; ignored while `over`. */
  alpha: number;
  /** A file is over the popover: the `sigOver` ink, sharp. */
  over: boolean;
}

/**
 * Per-letter blur and ink at `milliseconds` on a free-running clock. While `working`, a crest
 * of focus runs across the name every 4.2 s and the resting blur eases off with `progress`.
 * (The shipping app shows the name on the drop zone and setup only, so it never draws the
 * crest; the code and the mockup keep it.)
 */
export function signatureWaveStyles(
  milliseconds: number,
  { progress = 0, working = false, over = false, reducedMotion = false } = {},
): SignatureLetterStyle[] {
  const waving = working && !over && !reducedMotion;
  const p = Math.min(1, Math.max(0, progress));
  const rest = over ? 0 : SIGNATURE_WAVE.restingBlur * (working ? 1 - 0.6 * p : 1);
  // The crest eases in and out across 85% of the cycle, then rests before the next pass.
  const phase = (milliseconds % SIGNATURE_WAVE.milliseconds) / SIGNATURE_WAVE.milliseconds;
  const u = Math.min(1, Math.max(0, phase) / 0.85);
  const crest = -SIGNATURE_WAVE.width + (1 + 2 * SIGNATURE_WAVE.width) * (0.5 - 0.5 * Math.cos(Math.PI * u));
  const last = SIGNATURE_LETTERS.length - 1;
  return SIGNATURE_LETTERS.map((_, index) => {
    const distance = waving ? Math.min(1, Math.abs(index / last - crest) / SIGNATURE_WAVE.width) : 1;
    const k = 0.5 + 0.5 * Math.cos(Math.PI * distance);
    return {
      blur: rest * (1 - k),
      alpha: SIGNATURE_WAVE.restingAlpha + SIGNATURE_WAVE.crestAlphaBoost * k,
      over,
    };
  });
}

/**
 * The pointer on the name brings the letters right around it partly into focus: a soft round
 * patch that follows it. The app's reach is 34 pt at 44 pt; the site's 43 px at 56 px.
 */
export const POINTER_FOCUS = {
  reachEm: 43 / 56,
  /** The focus fades in 150 ms after the pointer arrives, over 500 ms; out over 400 ms. */
  inDelay: 0.15,
  inSeconds: 0.5,
  outSeconds: 0.4,
  /** It trails the pointer over 600 ms on the site's ease-out. */
  followSeconds: 0.6,
} as const;

/** How focused the name is `distance / reach` from the pointer: 1 under it, cos(πr) to 0 at the edge. */
export function pointerFocusAmount(fraction: number): number {
  const u = Math.min(1, Math.max(0, fraction));
  return 0.5 + 0.5 * Math.cos(Math.PI * u);
}

/**
 * Soft clouds drifting through the resting name (SignatureMist.swift; the site's
 * `--clouds`): two tiling fields of fractal noise, one rolling sideways and one across it.
 * One loop is four passes of the first and three of the second, moving on 13 times a second.
 */
export const SIGNATURE_MIST = {
  loopSeconds: 288,
  steps: 3840,
  fields: [
    { width: 320, height: 160, baseFrequency: [0.0075, 0.015], octaves: 3, seed: 4, travel: [1280, 0] },
    { width: 260, height: 260, baseFrequency: [0.011, 0.011], octaves: 2, seed: 9, travel: [-780, 780] },
  ],
} as const;

/**
 * The name coming forward through fog as the popover opens (SignatureReveal.swift,
 * BoothReveal.dc.html "Fog bank"), in the app's points. The site plays the same reveal in CSS
 * at 56 px: each letter 30 ms after the last, rising 10 px over 400 ms, growing from 0.889,
 * clearing from blur 29 px over 550 ms and inking in over 290 ms, under a haze that thins over
 * 520 ms; the kit's CSS uses those.
 */
export const SIGNATURE_REVEAL = {
  delay: 0.04,
  duration: 0.55,
  easePower: 3.5,
  depth: 100,
  perspective: 800,
  rise: 8,
  riseDelay: 0.03,
  riseDuration: 0.4,
  riseEasePower: 3,
  startBlur: 23,
  blurFalloff: 1.6,
  fadeSpeed: 1.9,
  stagger: 0.03,
  haze: 0.95,
  hazeSoftness: 23,
  hazeLag: 0.15,
  hazeLength: 0.95,
} as const;

/** When every letter and the haze have settled, in seconds after the popover starts to open. */
export const SIGNATURE_REVEAL_SECONDS = (() => {
  const r = SIGNATURE_REVEAL;
  const lastStart = (SIGNATURE_LETTERS.length - 1) * r.stagger;
  return Math.max(r.delay + lastStart + r.duration, r.riseDelay + lastStart + r.riseDuration, r.delay + (r.hazeLag + r.hazeLength) * r.duration);
})();

export interface RevealLetter {
  /** Drawn size, 1 at rest. */
  scale: number;
  /** Points below its resting place. */
  drop: number;
  /** Blur added to the letter's own. */
  extraBlur: number;
  /** Multiplies the letter's ink. */
  alpha: number;
}

const ease = (x: number, power: number) => 1 - Math.pow(1 - x, power);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Each letter `seconds` after the popover started to open. With reduced motion the letters
 * still clear and fade up in turn, but neither come forward nor rise.
 */
export function revealLetters(seconds: number, reducedMotion = false, count: number = SIGNATURE_LETTERS.length): RevealLetter[] {
  const r = SIGNATURE_REVEAL;
  return Array.from({ length: count }, (_, index) => {
    const lag = index * r.stagger;
    const progress = clamp01((seconds - r.delay - lag) / r.duration);
    const near = ease(progress, r.easePower);
    const lifting = clamp01((seconds - r.riseDelay - lag) / r.riseDuration);
    return {
      scale: reducedMotion ? 1 : r.perspective / (r.perspective + r.depth * (1 - near)),
      drop: reducedMotion ? 0 : r.rise * Math.pow(1 - lifting, r.riseEasePower),
      extraBlur: (r.startBlur - SIGNATURE_WAVE.restingBlur) * Math.pow(1 - near, r.blurFalloff),
      alpha: ease(clamp01(progress * r.fadeSpeed), r.easePower),
    };
  });
}

/** How dense the haze is `seconds` after the popover started to open: 1, then smoothly gone. */
export function revealHazeOpacity(seconds: number): number {
  const r = SIGNATURE_REVEAL;
  const thinning = clamp01((seconds - r.delay - r.hazeLag * r.duration) / (r.hazeLength * r.duration));
  return 1 - thinning * thinning * (3 - 2 * thinning);
}
