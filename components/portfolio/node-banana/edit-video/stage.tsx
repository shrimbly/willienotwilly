"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent, type ReactNode } from "react";
import { Blend, Magnet, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PlayheadClock } from "./clock";
import { AUDIO_SRC, SOURCE_BY_ID } from "./data";
import {
  audioLength,
  buildEnvelope,
  clamp,
  clipLength,
  domOpacities,
  envelopeAt,
  formatTimecode,
  overlayOpacityAt,
  placedClips,
  rateAt,
  sequenceEnd,
  sourceTimeAt,
  type EvEdit,
} from "./model";
import { Tooltip } from "./parts";
import { CONTROL_BUTTON, INK_3 } from "./styles";

/** Under this many seconds of drift a playing clip is left alone; past it, it is put back on the playhead. */
const DRIFT_SEC = 0.2;
/** A clip that starts this soon is cued to its first frame, so it comes in on it. */
const PREROLL_SEC = 0.6;

/** A click must not take focus from the editor, or Space would press the button instead of playing. */
const keepFocus = (event: MouseEvent<HTMLElement>) => {
  event.preventDefault();
  event.currentTarget.closest<HTMLElement>("[data-ev-editor]")?.focus({ preventScroll: true });
};

/** One of the control row's icon buttons, with its hover label above it (into the stage). */
function ControlButton({
  label,
  tip = label,
  shortcut,
  pressed,
  className,
  onClick,
  children,
}: {
  label: string;
  tip?: string;
  shortcut?: string;
  pressed?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className={cn("group relative flex", className)}>
      <button type="button" aria-label={label} aria-pressed={pressed} className={CONTROL_BUTTON} onMouseDown={keepFocus} onClick={onClick}>
        {children}
      </button>
      <Tooltip label={tip} shortcut={shortcut} placement="top" />
    </div>
  );
}

/** Diagrams of the two layouts (LayoutToggle.tsx): three bars end to end, or one bar per row, each starting before the one above ends. */
function LayoutGlyph({ mode }: { mode: "track" | "stacked" }) {
  const d = mode === "track" ? "M1.75 4.75h1.5M5.75 4.75h1.5M9.75 4.75h1.5" : "M1.75 1.75h2.5M4.75 4.75h2.5M7.75 7.75h2.5";
  return (
    <svg width={12} height={10} viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The playhead's time, written as the live playhead moves, never through a render. */
function PlayheadTime({ clock, total }: { clock: PlayheadClock; total: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const show = (t: number) => {
      const text = formatTimecode(Math.min(t, total));
      if (ref.current && ref.current.textContent !== text) ref.current.textContent = text;
    };
    show(clock.get());
    return clock.subscribe(show);
  }, [clock, total]);
  return <span ref={ref} className="text-neutral-100" />;
}

export interface StageProps {
  edit: EvEdit;
  clock: PlayheadClock;
  /** The preview is playing (and on screen). */
  running: boolean;
  /** Load the media: the tile is near the viewport. */
  load: boolean;
  frame: { width: number; height: number };
  /** The control row's width under the frame. */
  rowWidth: number;
  /** Space above the frame. */
  padTop: number;
  soundOn: boolean;
  snap: boolean;
  onTogglePlay: () => void;
  onGoTo: (where: "start" | "end") => void;
  onSoundOn: (on: boolean) => void;
  onSnap: (on: boolean) => void;
  onCrossfade: (on: boolean) => void;
  onMode: (mode: "track" | "stacked") => void;
}

/**
 * The stage (EditorStage.tsx, EditorTransport.tsx): the preview frame, which composites the stack at the playhead
 * (each live clip at its share of the picture, top row in front, the text layers' washes and words over them), and
 * the control row under it.
 */
export function Stage({
  edit,
  clock,
  running,
  load,
  frame,
  rowWidth,
  padTop,
  soundOn,
  snap,
  onTogglePlay,
  onGoTo,
  onSoundOn,
  onSnap,
  onCrossfade,
  onMode,
}: StageProps) {
  const placed = useMemo(() => placedClips(edit), [edit]);
  const stacked = edit.mode === "stacked";
  const env = useMemo(
    () => buildEnvelope(placed.map((c, row) => ({ start: c.start, length: clipLength(c), row })), edit.crossfade && stacked),
    [placed, edit.crossfade, stacked],
  );
  const total = sequenceEnd(placed);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const washes = useRef(new Map<string, HTMLDivElement>());
  const words = useRef(new Map<string, HTMLDivElement>());
  const audioRef = useRef<HTMLAudioElement>(null);
  const runningRef = useRef(running);
  const soundRef = useRef(soundOn);
  const composeRef = useRef<((t: number) => void) | null>(null);

  // Each frame: every live clip at its opacity and on its frame, every other one hidden and cued
  useLayoutEffect(() => {
    const compose = (t: number) => {
      const playing = runningRef.current;
      const layers = envelopeAt(env, t);
      const opacities = domOpacities(layers.map((l) => l.weight));
      const live = new Map<number, number>();
      layers.forEach((layer, i) => live.set(env.units[layer.unit].row, opacities[i]));
      placed.forEach((clip, row) => {
        const video = videos.current.get(clip.id);
        if (!video) return;
        const opacity = live.get(row);
        if (opacity === undefined) {
          video.style.opacity = "0";
          if (!video.paused) video.pause();
          const until = clip.start - t;
          if (until > 0 && until < PREROLL_SEC && video.readyState > 0 && Math.abs(video.currentTime - clip.inSec) > 0.05) {
            video.currentTime = sourceTimeAt(clip, clip.start);
          }
          return;
        }
        video.style.opacity = String(opacity);
        const expected = sourceTimeAt(clip, t);
        const rate = clamp(rateAt(clip, t), 0.0625, 16);
        if (Math.abs(video.playbackRate - rate) > 0.01) video.playbackRate = rate;
        if (playing) {
          if (video.paused) {
            video.currentTime = expected;
            video.play().catch(() => {});
          } else if (Math.abs(video.currentTime - expected) > DRIFT_SEC) {
            video.currentTime = expected;
          }
        } else {
          if (!video.paused) video.pause();
          if (Math.abs(video.currentTime - expected) > 1 / 48) video.currentTime = expected;
        }
      });
      edit.texts.forEach((text) => {
        const o = overlayOpacityAt(text, t);
        const wash = washes.current.get(text.id);
        const word = words.current.get(text.id);
        if (wash) wash.style.opacity = String(text.wash * o);
        if (word) word.style.opacity = String(o);
      });
      const audio = audioRef.current;
      if (audio) {
        const a = edit.audio;
        const inside = t >= a.startSec && t < a.startSec + audioLength(a);
        if (playing && soundRef.current && inside && !a.muted) {
          const expected = a.inSec + (t - a.startSec);
          audio.volume = clamp(a.volume, 0, 1);
          if (audio.paused) {
            audio.currentTime = expected;
            audio.play().catch(() => {});
          } else if (Math.abs(audio.currentTime - expected) > DRIFT_SEC) {
            audio.currentTime = expected;
          }
        } else if (!audio.paused) {
          audio.pause();
        }
      }
    };
    composeRef.current = compose;
    compose(clock.get());
    return clock.subscribe(compose);
  }, [clock, env, placed, edit.texts, edit.audio]);

  // Playing or not, sound or not: compose once more so the media follow at once
  useEffect(() => {
    runningRef.current = running;
    soundRef.current = soundOn;
    const map = videos.current;
    if (!running) {
      map.forEach((video) => {
        if (!video.paused) video.pause();
      });
      audioRef.current?.pause();
    }
    composeRef.current?.(clock.get());
  }, [running, soundOn, clock]);

  const fontSize = frame.height * 0.08;

  return (
    <div className="flex flex-col items-center" style={{ paddingTop: padTop }}>
      <div
        className="relative shrink-0 overflow-hidden rounded-lg bg-black"
        style={{ width: frame.width, height: frame.height }}
        aria-label="Preview"
        role="img"
      >
        {placed.map((clip, row) => {
          const source = SOURCE_BY_ID.get(clip.source);
          if (!source) return null;
          return (
            <video
              key={clip.id}
              ref={(el) => {
                if (el) videos.current.set(clip.id, el);
                else videos.current.delete(clip.id);
              }}
              src={source.src}
              poster={source.poster}
              muted
              playsInline
              disablePictureInPicture
              preload={load ? "auto" : "none"}
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ zIndex: 10 + placed.length - row, opacity: 0 }}
            />
          );
        })}
        {edit.texts.map((text) => (
          <div key={text.id} aria-hidden="true">
            <div
              ref={(el) => {
                if (el) washes.current.set(text.id, el);
                else washes.current.delete(text.id);
              }}
              className="pointer-events-none absolute inset-0 z-40 bg-black"
              style={{ opacity: 0 }}
            />
            <div
              ref={(el) => {
                if (el) words.current.set(text.id, el);
                else words.current.delete(text.id);
              }}
              className="nb-font-display pointer-events-none absolute inset-0 z-50 flex items-center justify-center text-center break-words whitespace-pre-wrap text-white"
              style={{
                opacity: 0,
                fontSize,
                fontWeight: text.weight,
                lineHeight: 1.2,
                padding: `${frame.height * 0.05}px ${frame.width * 0.05}px`,
              }}
            >
              {text.text}
            </div>
          </div>
        ))}
        <audio ref={audioRef} src={AUDIO_SRC} preload={load && soundOn ? "auto" : "none"} className="hidden" />
      </div>

      <div className="@container mt-2 w-full" style={{ width: rowWidth }}>
        <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-x-3">
          <div className="min-w-0 truncate text-[13px] whitespace-nowrap tabular-nums">
            <PlayheadTime clock={clock} total={total} />
            <span className={cn(INK_3, "@max-[500px]:hidden")}>{` / ${formatTimecode(total)}`}</span>
          </div>

          <div className="flex items-center gap-2">
            <ControlButton label="Go to start" className="@max-[420px]:hidden" onClick={() => onGoTo("start")}>
              <SkipBack size={16} strokeWidth={1.5} />
            </ControlButton>
            <div className="group relative flex">
              <button
                type="button"
                aria-label={running ? "Pause" : "Play"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-950 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nb-pane)] focus-visible:outline-none"
                onMouseDown={keepFocus}
                onClick={onTogglePlay}
              >
                {running ? (
                  <Pause size={16} strokeWidth={1.5} fill="currentColor" />
                ) : (
                  <Play size={16} strokeWidth={1.5} fill="currentColor" className="translate-x-px" />
                )}
              </button>
              <Tooltip label={running ? "Pause" : "Play"} shortcut="Space" placement="top" />
            </div>
            <ControlButton label="Go to end" className="@max-[420px]:hidden" onClick={() => onGoTo("end")}>
              <SkipForward size={16} strokeWidth={1.5} />
            </ControlButton>
          </div>

          <div className="flex items-center justify-end gap-0.5">
            <ControlButton label="Mute all" pressed={!soundOn} onClick={() => onSoundOn(!soundOn)}>
              {soundOn ? <Volume2 size={16} strokeWidth={1.5} /> : <VolumeX size={16} strokeWidth={1.5} />}
            </ControlButton>
            {stacked && (
              <ControlButton label="Crossfade" pressed={edit.crossfade} onClick={() => onCrossfade(!edit.crossfade)}>
                <Blend size={16} strokeWidth={1.5} />
              </ControlButton>
            )}
            <div role="group" aria-label="Timeline layout" className="mx-1 flex shrink-0 items-center gap-0.5">
              <ControlButton label="Track" tip="Track: clips end to end on one row" pressed={!stacked} onClick={() => onMode("track")}>
                <LayoutGlyph mode="track" />
              </ControlButton>
              <ControlButton
                label="Stacked"
                tip="Stacked: one row per clip, placed anywhere in time"
                pressed={stacked}
                onClick={() => onMode("stacked")}
              >
                <LayoutGlyph mode="stacked" />
              </ControlButton>
            </div>
            <ControlButton label="Snap" tip="Snap · drag freely with" shortcut="⇧" pressed={snap} onClick={() => onSnap(!snap)}>
              <Magnet size={16} strokeWidth={1.5} />
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}
