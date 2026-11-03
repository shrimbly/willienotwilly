// The Done screen's mix and waveform, ported from studiovoice/app/Sources/BoothCore/Mix.swift
// (Mix, MixCurve, WaveformBars, StemsManifest.Bars.synthetic) and UI/Screens/Waveform.swift.

/** Slider positions on the Done screen, each 0…100 (the CLI's `-s/-b/-m`). */
export interface Mix {
  speech: number;
  background: number;
  music: number;
}

/** The pipeline's default mix (`-s 54 -b 10 -m 10`). */
export const MIX_STANDARD: Mix = { speech: 54, background: 10, music: 10 };

export type MixStem = keyof Mix;

const unit = (x: number) => Math.min(1, Math.max(0, x));

export function clampMix(mix: Mix): Mix {
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
  return { speech: clamp(mix.speech), background: clamp(mix.background), music: clamp(mix.music) };
}

export function sameMix(a: Mix, b: Mix): boolean {
  return a.speech === b.speech && a.background === b.background && a.music === b.music;
}

/**
 * Response curves from slider fraction (0…1) to stem coefficient: `s_eff = 1 − (1 − s)^6`,
 * `b_eff = b²`, `m_eff = m²`. `--linear` jobs use identity.
 */
export const MIX_CURVE = {
  speech: (s: number, linear = false) => (linear ? unit(s) : 1 - Math.pow(1 - unit(s), 6)),
  background: (b: number, linear = false) => (linear ? unit(b) : unit(b) * unit(b)),
  music: (m: number, linear = false) => (linear ? unit(m) : unit(m) * unit(m)),
};

/** Linear gain per preview stem: `s_eff·clean + (1−s_eff)·vocals + b_eff·background + m_eff·music`. */
export interface StemGains {
  clean: number;
  vocals: number;
  background: number;
  music: number;
}

export function mixGains(mix: Mix, { linear = false, includeMusic = true } = {}): StemGains {
  const speech = MIX_CURVE.speech(mix.speech / 100, linear);
  return {
    clean: speech,
    vocals: 1 - speech,
    background: MIX_CURVE.background(mix.background / 100, linear),
    music: includeMusic ? MIX_CURVE.music(mix.music / 100, linear) : 0,
  };
}

/** RMS of each preview stem in equal time bins, all on one linear scale (StemsManifest.Bars). */
export interface StemBars {
  clean: number[];
  vocals: number[];
  background: number[];
  /** Present only when music was detected. */
  music?: number[];
  original: number[];
}

/** The Done screen's 56-bar waveform. */
export const WAVEFORM = {
  count: 56,
  /** Bar heights in points: `2 + min(1, h)·20`, a compact waveform 22 pt tall at most. */
  minHeight: 2,
  maxExtra: 20,
  /** Bars sit 2 pt apart with a 1 pt radius (Waveform.swift). */
  gap: 2,
  radius: 1,
  /** The perceptual mapping, for real manifests (see `waveformLevels`). */
  rangeDB: 40,
  exponent: 1.5,
  referencePercentile: 0.95,
  referenceFloor: Math.pow(10, -50 / 20),
  silenceFloor: Math.pow(10, -60 / 20),
} as const;

/** Fits `values` into `count` bins, taking each bin's loudest source value. Missing data → 0. */
export function resampleMax(values: readonly number[], count: number): number[] {
  if (count <= 0) return [];
  if (values.length === 0) return Array(count).fill(0);
  if (values.length === count) return [...values];
  return Array.from({ length: count }, (_, i) => {
    const lower = Math.floor((i * values.length) / count);
    const upper = Math.max(lower + 1, Math.floor(((i + 1) * values.length) / count));
    let peak = 0;
    for (let j = lower; j < Math.min(upper, values.length); j++) peak = Math.max(peak, values[j]);
    return peak;
  });
}

/**
 * Fewer, wider bars than the data has: the mean of each run. The website's mini player
 * squeezes the walkthrough's peaks this way (site/index.html `squeeze`).
 */
export function resampleMean(values: readonly number[], count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    if (!values.length) return 0.06;
    const k = values.length / count;
    let sum = 0;
    const a = Math.floor(i * k);
    const b = Math.floor((i + 1) * k);
    for (let j = a; j < b; j++) sum += values[j];
    return sum / Math.max(1, b - a);
  });
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.round((sorted.length - 1) * unit(fraction))];
}

/** One bin's perceptual level against `reference`. */
export function perceptualLevel(h: number, reference: number): number {
  if (!(h > 0) || h < WAVEFORM.silenceFloor || reference <= 0) return 0;
  const db = 20 * Math.log10(h / reference);
  return Math.pow(unit((db + WAVEFORM.rangeDB) / WAVEFORM.rangeDB), WAVEFORM.exponent);
}

/**
 * Normalised level per bar for `mix`: `h = √(voice² + (b_eff·bg)² + (m_eff·music)²)` with
 * `voice = s_eff·clean + (1−s_eff)·vocals`, so the sliders reshape the bars. While comparing,
 * the original's bins are shown on the same scale. Linear (the synthetic demo bars) divides
 * by the default mix's peak; `perceptual` (real manifests) maps dB against its 95th percentile.
 */
export function waveformLevels(
  bars: StemBars,
  mix: Mix,
  {
    linear = false,
    includeMusic = bars.music !== undefined,
    comparing = false,
    count = WAVEFORM.count,
    perceptual = false,
  }: { linear?: boolean; includeMusic?: boolean; comparing?: boolean; count?: number; perceptual?: boolean } = {},
): number[] {
  const clean = resampleMax(bars.clean, count);
  const vocals = resampleMax(bars.vocals, count);
  const background = resampleMax(bars.background, count);
  const music = includeMusic ? resampleMax(bars.music ?? [], count) : Array<number>(count).fill(0);
  const mixed = (gains: StemGains) =>
    Array.from({ length: count }, (_, i) => {
      const voice = gains.clean * clean[i] + gains.vocals * vocals[i];
      const bg = gains.background * background[i];
      const mu = gains.music * music[i];
      return Math.sqrt(voice * voice + bg * bg + mu * mu);
    });
  const standard = mixed(mixGains(MIX_STANDARD, { linear, includeMusic }));
  const raw = comparing ? resampleMax(bars.original, count) : mixed(mixGains(mix, { linear, includeMusic }));
  if (perceptual) {
    const reference = Math.max(WAVEFORM.referenceFloor, percentile(standard, WAVEFORM.referencePercentile));
    return raw.map((h) => perceptualLevel(h, reference));
  }
  const peak = Math.max(0, ...standard);
  if (!(peak > 0)) return Array(count).fill(0);
  return raw.map((h) => h / peak);
}

/** Bar height in points for a normalised level, in whole points like the mockup's Math.round. */
export function barHeight(level: number): number {
  return Math.round(WAVEFORM.minHeight + unit(level) * WAVEFORM.maxExtra);
}

/** The bars left of `playhead` (0…1): those with `index / count < playhead`. */
export function playedBars(playhead: number, count: number): number {
  let played = 0;
  while (played < count && played / count < playhead) played += 1;
  return played;
}

/**
 * A plausible speech shape for jobs without a manifest (the app's demo mode and its
 * snapshots), ported from the prototype's `envAt` / `noiseAt` / `musicAt`, so the bars react
 * to the sliders the way the app's do.
 */
export function syntheticBars(music: boolean, count: number = WAVEFORM.count): StemBars {
  const envelope = (i: number) => {
    const x = i / count;
    const words = Math.abs(Math.sin(x * 23) * Math.sin(x * 7.3 + 1.1));
    const pause = Math.sin(x * 4.1 + 0.6) > -0.55 ? 1 : 0.06;
    return Math.min(1, words * 1.25 * pause);
  };
  const noise = (i: number) => {
    const v = Math.sin(i * 12.9898) * 43758.5453;
    return 0.12 + (v - Math.floor(v)) * 0.16;
  };
  const accompaniment = (i: number) => 0.16 + 0.1 * Math.sin(i * 0.9);
  const indices = Array.from({ length: count }, (_, i) => i);
  return {
    clean: indices.map(envelope),
    vocals: indices.map((i) => 0.78 * envelope(i) + 1.4 * noise(i)),
    background: indices.map((i) => 3.2 * noise(i)),
    music: music ? indices.map((i) => 2.6 * accompaniment(i)) : undefined,
    original: indices.map((i) => 0.72 * envelope(i) + 1.4 * noise(i) + (music ? 0.9 * accompaniment(i) : 0)),
  };
}

/** Whole percent, as VoiceOver reads the playhead (BoothCore `Formatting.percent`). */
export function percent(fraction: number): number {
  return Math.round(unit(fraction) * 100);
}
