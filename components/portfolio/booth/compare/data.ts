import { WAVEFORM, resampleMean } from "@/lib/booth/mix";
import { WALKTHROUGH, type BoothReel } from "@/lib/booth/walkthrough";

// The compare demo's data: the website's walkthrough reel (studiovoice/site/media/walkthrough.js,
// in lib/booth/walkthrough.ts) as the Done screen and the site's two lanes draw it, and the
// sizes the site's player CSS gives its lanes (site/index.html `.lane`, `.marks`, `.callout`).

/** The reel the demo plays: 49.05 s from a noisy room, with the 12 things Booth took out. */
export const COMPARE_REEL: BoothReel = WALKTHROUGH;

/** The Done screen's title: the job's file, named as the site names the recording. */
export const COMPARE_FILE = "walkthrough.m4a";

/**
 * Where the playhead rests until the visitor plays it: inside the breath at 17.15 s, about a
 * third of the way in as the app's snapshots rest it (AppModel.fixture `showDone`, 0.32), so the
 * still shows a lit mark and its callout, and playing starts between two phrases.
 */
export const REST_SECONDS = 17.2;

/**
 * The Done screen's 56 bars for each version. The walkthrough's peaks are already loudness on
 * a dB scale, 40 a second (site/tools/make-demo-reel.py `peaks`), so the loudest of each bar's
 * 35 is nearly always speech and every bar comes out full: the mean shows the pauses, as the
 * site's own mini player squeezes them (`squeeze`). While comparing, the app draws the
 * original's bins (BoothCore WaveformBars `comparing`), so the noisy room fills the gaps.
 */
export const DONE_LEVELS = {
  before: resampleMean(COMPARE_REEL.peaks.before, WAVEFORM.count),
  after: resampleMean(COMPARE_REEL.peaks.after, WAVEFORM.count),
} as const;

/** The site's lanes: one 2 px rounded bar per 3 px, 30 px tall, under a 52 px name. */
export const LANE = { step: 3, bar: 2, nameWidth: 52, gap: 6 } as const;

/** The site's ink for the lanes: the one being heard dark where played, the other paler still. */
export const LANE_INK = {
  live: { played: "rgba(29, 29, 31, 0.9)", unplayed: "rgba(29, 29, 31, 0.28)" },
  other: { played: "rgba(29, 29, 31, 0.32)", unplayed: "rgba(29, 29, 31, 0.12)" },
} as const;

/** A mark lights this long before its start and lingers this long after its end (site `render`). */
export const MARK = { lead: 0.12, linger: 0.9, hold: 0.8 } as const;

export type CompareLayout = "wide" | "narrow";

/**
 * The stage is laid out in points at one of two widths and scaled to the tile, the popover over
 * the lanes, with room kept round it for the frame's corners and the hint. Wide, the lanes take
 * the site's width and it grows to at most 1.4× (a little over the hero's 1.2×, so the 12 pt type
 * reads at a glance in the big tile). Narrow, everything is the popover's width, a column that
 * fills a phone at about 1× and a portrait tablet tile at up to 1.5×.
 */
export const LAYOUTS: Record<CompareLayout, { width: number; maxScale: number; padX: number; padY: number }> = {
  wide: { width: 600, maxScale: 1.4, padX: 40, padY: 44 },
  narrow: { width: 320, maxScale: 1.5, padX: 16, padY: 40 },
};

/** Landscape tiles at least this wide (px) give the lanes the site's own width. */
const WIDE_MIN = 560;

export function layoutFor(tileWidth: number, tileHeight: number): CompareLayout {
  return tileWidth >= WIDE_MIN && tileWidth >= tileHeight ? "wide" : "narrow";
}
