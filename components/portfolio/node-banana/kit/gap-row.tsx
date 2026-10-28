"use client";

import { useEffect, useState, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

// The gap row's two occupants, ported from src/components/nodes/ui/
// CarouselControls.tsx and ScrubRow.tsx.

const MAX_DOTS = 7;

/** Which dots to draw for `count` items around `index`, at most seven. */
export function dotWindow(index: number, count: number): number[] {
  if (count <= MAX_DOTS) return Array.from({ length: count }, (_, i) => i);
  const half = Math.floor(MAX_DOTS / 2);
  let start = Math.max(0, index - half);
  start = Math.min(start, count - MAX_DOTS);
  return Array.from({ length: MAX_DOTS }, (_, i) => start + i);
}

export interface CarouselControlsProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  index: number;
  count: number;
  onPrev?: () => void;
  onNext?: () => void;
  /** An item is loading (a run in flight): both arrows rest, disabled. */
  loading?: boolean;
  /** Used in the button names: "Previous image". */
  noun?: string;
  /** Tighter, no dots: for sharing the gap row with a scrubber. */
  compact?: boolean;
}

/** ‹ ••●•• 3 / 5 › : the history carousel in the gap row. Other div props (a capture handler) go on its row. */
export function CarouselControls({ index, count, onPrev, onNext, loading = false, noun = "image", compact = false, className, ...rest }: CarouselControlsProps) {
  if (count <= 1) return null;
  const safe = Math.min(Math.max(index, 0), count - 1);
  return (
    <div {...rest} className={cn("nodrag flex h-full items-center justify-center select-none", compact ? "gap-0.5" : "gap-1.5", className)}>
      <NavButton title={`Previous ${noun}`} onClick={onPrev} disabled={loading} dir="prev" />
      {!compact && (
        <div className="flex items-center gap-[3px]" aria-hidden>
          {dotWindow(safe, count).map((i) => (
            <span
              key={i}
              className={cn("block rounded-full transition-colors", i === safe ? "h-[5px] w-[5px] bg-neutral-300" : "h-1 w-1 bg-neutral-600")}
            />
          ))}
        </div>
      )}
      <span className={cn("nb-text-node text-center text-neutral-400 tabular-nums", compact ? "min-w-[28px]" : "min-w-[32px]")}>
        {`${safe + 1} / ${count}`}
      </span>
      <NavButton title={`Next ${noun}`} onClick={onNext} disabled={loading} dir="next" />
    </div>
  );
}

function NavButton({ title, onClick, disabled, dir }: { title: string; onClick?: () => void; disabled: boolean; dir: "prev" | "next" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="nb-squircle flex h-5 w-5 items-center justify-center rounded-[6px] text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
    >
      {dir === "prev" ? <ChevronLeft size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
    </button>
  );
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const scrubButton =
  "nb-squircle flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] transition-colors hover:bg-white/10 hover:text-white";

export interface ScrubRowProps {
  /** The node's own <video>; the row follows and drives it. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Re-binds listeners when the source changes. */
  src?: string;
  /** Duration to show before metadata loads. */
  duration?: number;
  leading?: ReactNode;
  /** Slot at the end (a compact carousel). */
  trailing?: ReactNode;
  /** The sound button (the demo clips have no audio, so it only toggles muted). */
  sound?: boolean;
  className?: string;
}

/** Play/pause, a scrubber, `0:03 / 0:08` and the sound button for a node's video. */
export function ScrubRow({ videoRef, src, duration: fallback = 0, leading, trailing, sound = true, className }: ScrubRowProps) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(fallback);
  const [audible, setAudible] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setTime(video.currentTime);
    const onMeta = () => Number.isFinite(video.duration) && setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("play", onPlay);
    // "play" can come before a source is ready; "playing" confirms it, so the icon never lags.
    video.addEventListener("playing", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);
    if (video.readyState >= 1) onMeta();
    if (!video.paused) onPlay();
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("playing", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
    };
  }, [videoRef, src]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };

  // Scrubbing is looking at frames: hold the video on the chosen one.
  const seek = (t: number) => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) video.pause();
    video.currentTime = t;
    setTime(t);
  };

  return (
    <div className={cn("nodrag @container flex h-full w-full items-center gap-1.5 px-1 select-none", className)}>
      {leading}
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"} className={cn(scrubButton, "text-neutral-400")}>
        {playing ? <Pause size={12} strokeWidth={0} fill="currentColor" /> : <Play size={12} strokeWidth={0} fill="currentColor" />}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(time, duration || 0)}
        onChange={(e) => seek(parseFloat(e.target.value))}
        aria-label="Seek"
        className="h-1 min-w-0 flex-1 cursor-pointer accent-neutral-300"
      />
      <span className="nb-text-node shrink-0 text-neutral-400 tabular-nums @max-[239px]:hidden">
        {formatTime(time)} / {formatTime(duration)}
      </span>
      {sound && (
        <button
          type="button"
          onClick={() => {
            const next = !audible;
            setAudible(next);
            if (videoRef.current) videoRef.current.muted = !next;
          }}
          aria-label={audible ? "Sound on" : "Sound off"}
          title={audible ? "Sound on" : "Sound off"}
          aria-pressed={audible}
          className={cn(scrubButton, audible ? "text-white" : "text-neutral-400")}
        >
          {audible ? <Volume2 size={12} strokeWidth={1.75} /> : <VolumeX size={12} strokeWidth={1.75} />}
        </button>
      )}
      {trailing}
    </div>
  );
}
