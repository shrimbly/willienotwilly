"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { useMotionValueEvent, type MotionValue } from "motion/react";

import { FIX_NAMES, type BoothReel } from "@/lib/booth/walkthrough";

import { LANE, LANE_INK, MARK } from "./data";

// The site's two lanes under its reel (studiovoice/site/index.html: `.callout-row`, `.lanes`,
// `.marks`, `drawLane`, `render`, `placeCallout`), ported as they are: the original's waveform
// over Booth's, a band on each thing Booth took out, the playhead across both, and a label over
// whichever band is passing. As on the site they are drawn imperatively from the audio clock
// (canvas bars, the bands' `on` and the callout), so playing never re-renders React.

export type CompareVersion = "before" | "after";

/** The lane's canvas, sized to the device pixels it covers (the stage may be scaled by `scale`). */
function sizeCanvas(canvas: HTMLCanvasElement, scale: number) {
  const ratio = (window.devicePixelRatio || 1) * scale;
  const width = Math.max(1, Math.round(canvas.offsetWidth * ratio));
  const height = Math.max(1, Math.round(canvas.offsetHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, ratio };
}

/**
 * One rounded bar per 3 pt, each the loudest peak it covers; what has played is dark, the rest
 * pale, and the lane not being heard paler still (site `drawLane`).
 */
function drawLane(canvas: HTMLCanvasElement, peaks: readonly number[], live: boolean, played: number, scale: number) {
  const { width, height, ratio } = sizeCanvas(canvas, scale);
  const g = canvas.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, width, height);
  if (!peaks.length) return;
  const step = LANE.step * ratio;
  const bar = LANE.bar * ratio;
  const count = Math.floor(width / step);
  const ink = live ? LANE_INK.live : LANE_INK.other;
  const playedX = played * width;
  for (let i = 0; i < count; i++) {
    const a = Math.floor((i / count) * peaks.length);
    const b = Math.max(a + 1, Math.floor(((i + 1) / count) * peaks.length));
    let peak = 0;
    for (let j = a; j < b; j++) peak = Math.max(peak, peaks[j]);
    const h = Math.max(ratio, peak * (height - 2 * ratio));
    const x = i * step;
    g.fillStyle = x + bar <= playedX ? ink.played : ink.unplayed;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, (height - h) / 2, bar, h, bar / 2);
    else g.rect(x, (height - h) / 2, bar, h);
    g.fill();
  }
}

/** What the callout says: the kind while the original plays, "… removed" while Booth's does. */
function calloutText(kind: keyof typeof FIX_NAMES, heard: CompareVersion) {
  return heard === "before" ? FIX_NAMES[kind] : `${FIX_NAMES[kind]} removed`;
}

export interface CompareLanesProps {
  reel: BoothReel;
  /** Where playback is, 0…1 (the audio clock, every frame while playing). */
  playhead: MotionValue<number>;
  /** The version being heard: its lane and name are drawn dark. */
  heard: CompareVersion;
  /** The stage's scale, so the canvases are drawn at the pixels they cover. */
  scale: number;
  /** A click on the lanes seeks there (0…1). */
  onSeek: (fraction: number) => void;
}

/**
 * The callout row and the two lanes, Original over Booth. Decorative to assistive tech (the
 * site hides them too): the Done screen's waveform is the slider, and the demo's own text says
 * what the marks are. A click (or tap) on the lanes seeks, as on the site.
 */
export function CompareLanes({ reel, playhead, heard, scale, onSeek }: CompareLanesProps) {
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const block = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const marks = useRef<HTMLDivElement>(null);
  const callout = useRef<HTMLSpanElement>(null);
  const bands = useRef<(HTMLSpanElement | null)[]>([]);
  /** The mark the callout is on (-1 for none), when it took it, and in which version's words. */
  const label = useRef<{ mark: number; shownAt: number; version: CompareVersion | null }>({ mark: -1, shownAt: 0, version: null });

  // Over the middle of its mark, but never past the block's edges: the row starts where the
  // waveforms do, so the label may reach back over the lanes' names (site `placeCallout`).
  const placeCallout = useCallback(
    (mark: number) => {
      const r = row.current;
      const c = callout.current;
      const event = reel.events[mark];
      if (!r || !c || !event) return;
      const width = r.offsetWidth;
      const half = c.offsetWidth / 2;
      const reach = r.offsetLeft;
      const centre = ((event.start + event.end) / 2 / reel.duration) * width;
      c.style.left = `${Math.max(half - reach, Math.min(width - half, centre))}px`;
    },
    [reel],
  );

  const render = useCallback(() => {
    const played = playhead.get();
    const at = played * reel.duration;
    if (before.current) drawLane(before.current, reel.peaks.before, heard === "before", played, scale);
    if (after.current) drawLane(after.current, reel.peaks.after, heard === "after", played, scale);
    marks.current?.style.setProperty("--at", played.toFixed(5));

    // A band lights from just before its mark until a moment after; the latest to start is passing.
    let passing = -1;
    reel.events.forEach((event, i) => {
      const on = at >= event.start - MARK.lead && at <= event.end + MARK.linger;
      bands.current[i]?.toggleAttribute("data-on", on);
      if (on) passing = i;
    });
    // A click right before a breath still gets its moment.
    const s = label.current;
    const currentOn = s.mark >= 0 && bands.current[s.mark]?.hasAttribute("data-on");
    if (currentOn && at - s.shownAt >= 0 && at - s.shownAt < MARK.hold) passing = s.mark;
    if (passing !== s.mark) s.shownAt = at;
    const c = callout.current;
    if (c && (passing !== s.mark || (passing >= 0 && s.version !== heard))) {
      s.mark = passing;
      c.toggleAttribute("data-shown", passing >= 0);
      if (passing >= 0) {
        s.version = heard;
        c.textContent = calloutText(reel.events[passing].kind, heard);
      }
    }
    if (s.mark >= 0) placeCallout(s.mark);
  }, [heard, placeCallout, playhead, reel, scale]);

  useMotionValueEvent(playhead, "change", render);

  // Drawn at once, again whenever the heard lane or the scale changes, and on any resize.
  useLayoutEffect(() => {
    render();
    const el = block.current;
    if (!el) return;
    const observer = new ResizeObserver(() => render());
    observer.observe(el);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div ref={block} className="booth-cmp-reel" data-hearing={heard} aria-hidden>
      <div ref={row} className="booth-cmp-callout-row">
        <span ref={callout} className="booth-cmp-callout" />
      </div>
      <div
        className="booth-cmp-lanes"
        onClick={(event) => {
          const box = marks.current?.getBoundingClientRect();
          if (!box || box.width <= 0) return;
          const fraction = (event.clientX - box.left) / box.width;
          if (fraction >= 0 && fraction <= 1) onSeek(fraction);
        }}
      >
        <div className="booth-cmp-lane" data-version="before">
          <span className="booth-cmp-lane-name">Original</span>
          <canvas ref={before} />
        </div>
        <div className="booth-cmp-lane" data-version="after">
          <span className="booth-cmp-lane-name">Booth</span>
          <canvas ref={after} />
        </div>
        <div ref={marks} className="booth-cmp-marks">
          {reel.events.map((event, i) => (
            <span
              key={`${event.kind}-${event.start}`}
              ref={(el) => {
                bands.current[i] = el;
              }}
              className="booth-cmp-band"
              style={{
                left: `${(100 * event.start) / reel.duration}%`,
                width: `${(100 * (event.end - event.start)) / reel.duration}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
