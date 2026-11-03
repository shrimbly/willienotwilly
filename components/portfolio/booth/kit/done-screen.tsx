"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, motion } from "motion/react";

import { WAVEFORM, barHeight, percent, type Mix, type MixStem } from "@/lib/booth/mix";
import { cn } from "@/lib/utils";

import { startHorizontalDrag } from "./drag";
import { BoothIcon, type BoothIconName } from "./icons";
import { swapMotion } from "./popover";

// The Done screen and its controls, ported from studiovoice/app/Sources/Booth/UI/Screens/
// DoneScreen.swift, Waveform.swift, ScreenParts.swift, Controls/ToggleChip.swift,
// Controls/MixSlider.swift and Controls/Buttons.swift, with Typography.swift's sizes: title
// 15/20 w500, secondary 12/16, body 13/17. Colours are the scope's `--booth-*` tokens.

/** The keyboard ring for Booth's controls: macOS's focus indicator, the work blue at half strength. */
export const BOOTH_FOCUS_RING =
  "outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-0 focus-visible:outline-[rgb(10_132_255/0.5)]";

/** A screen's title: 15/20 weight 500 on one line (file names truncate; the app keeps the extension). */
export function BoothTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("truncate text-[15px] leading-5 font-medium text-(color:--booth-text)", className)}>{children}</h3>;
}

/** One line of secondary text: 12/16 `text2` with tabular figures. */
export function BoothSecondary({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("truncate text-[12px] leading-4 text-(color:--booth-text2) tabular-nums", className)}>{children}</p>;
}

/**
 * A finger's press holds only once it has stayed put this long, so a swipe that starts on a
 * hold control and becomes a page scroll (the browser then cancels the press) never flashes
 * the original.
 */
export const TOUCH_HOLD_DELAY_MS = 120;

/**
 * "Hold ⌥ to compare": press and hold (pointer, or Space/Return when focused) to hear the
 * original; it reads "Playing the original" in semibold while held. Holding the ⌥ key itself
 * is the demo's to wire (useOptionKeyHold), as AppModel watches it in the app. A vertical
 * swipe that starts on it still scrolls the page.
 */
export function BoothCompareLine({
  comparing,
  onComparingChange,
  className,
}: {
  comparing: boolean;
  onComparingChange: (comparing: boolean) => void;
  className?: string;
}) {
  const held = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = () => {
    pending.current = null;
    held.current = true;
    onComparingChange(true);
  };
  /** Lets go of this control's own hold only: a ⌥ key still held keeps comparing. */
  const release = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    if (!held.current) return;
    held.current = false;
    onComparingChange(false);
  };
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );
  const onKey = (event: KeyboardEvent, down: boolean) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!down) release();
    else if (!event.repeat) hold();
  };
  return (
    <button
      type="button"
      aria-pressed={comparing}
      aria-label={comparing ? "Playing the original" : "Compare with the original"}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (event.pointerType === "touch") pending.current = setTimeout(hold, TOUCH_HOLD_DELAY_MS);
        else hold();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={(event) => onKey(event, true)}
      onKeyUp={(event) => onKey(event, false)}
      onBlur={release}
      onContextMenu={(event) => event.preventDefault()}
      // As wide as its words, so the row beside it scrolls under a finger; a held press must not
      // become a text selection or a callout.
      className={cn(
        "block w-fit max-w-full touch-pan-y truncate rounded-[3px] text-left text-[12px] leading-4 select-none [-webkit-touch-callout:none]",
        comparing ? "font-semibold text-(color:--booth-text)" : "text-(color:--booth-text2)",
        BOOTH_FOCUS_RING,
        className,
      )}
    >
      {comparing ? "Playing the original" : "Hold ⌥ to compare"}
    </button>
  );
}

/** Play and pause: a 26 pt `text` disc with a 12 pt glyph in `inverse` (light over a picture). */
export function BoothPlayButton({
  playing,
  onPicture = false,
  className,
  ...props
}: {
  playing: boolean;
  onPicture?: boolean;
} & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      aria-label={playing ? "Pause" : "Play"}
      {...props}
      className={cn(
        "grid size-[26px] shrink-0 place-items-center rounded-full active:opacity-80",
        onPicture ? "bg-white/92 text-[#1d1d1f]" : "bg-(color:--booth-text) text-(color:--booth-inverse)",
        BOOTH_FOCUS_RING,
        className,
      )}
    >
      <BoothIcon name={playing ? "pause" : "play"} size={12} />
    </button>
  );
}

/**
 * The Done screen's 56-bar waveform (`levels` from `waveformLevels`). Bars left of the playhead
 * (`played`, from `playedBars`) are `text` (`text2` while comparing), the rest `wave`; over a
 * picture, white and dimmed white. Click or drag to seek (`onSeek`, 0…1); as a slider it takes
 * the arrow keys in 5% steps, as VoiceOver's adjustments do. Without `onSeek` it is a picture.
 */
export function BoothWaveform({
  levels,
  played,
  comparing = false,
  onPicture = false,
  playhead,
  onSeek,
  className,
}: {
  levels: readonly number[];
  played: number;
  comparing?: boolean;
  onPicture?: boolean;
  /** The playhead, 0…1, for the slider's value; defaults to the played share. */
  playhead?: number;
  onSeek?: (fraction: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const at = playhead ?? played / Math.max(1, levels.length);
  const colour = (index: number) => {
    const isPlayed = index < played;
    if (onPicture) return !isPlayed ? "rgb(255 255 255 / 0.4)" : comparing ? "rgb(255 255 255 / 0.7)" : "#fff";
    if (!isPlayed) return "var(--booth-wave)";
    return comparing ? "var(--booth-text2)" : "var(--booth-text)";
  };
  const seekTo = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || !onSeek) return;
    onSeek(Math.min(1, Math.max(0, (clientX - box.left) / box.width)));
  };
  const bars = levels.map((level, i) => (
    <span
      key={i}
      className="min-w-0 flex-1"
      style={{ height: barHeight(level), borderRadius: WAVEFORM.radius, background: colour(i) }}
    />
  ));
  if (!onSeek) {
    return (
      <div aria-hidden className={cn("flex h-[22px] min-w-0 flex-1 items-center", className)} style={{ gap: WAVEFORM.gap }}>
        {bars}
      </div>
    );
  }
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent(at)}
      aria-valuetext={`${percent(at)}%`}
      onPointerDown={(event) => startHorizontalDrag(event, { onMove: seekTo })}
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 0.05 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -0.05 : 0;
        if (!step) return;
        event.preventDefault();
        onSeek(Math.min(1, Math.max(0, at + step)));
      }}
      className={cn("flex h-[22px] min-w-0 flex-1 touch-pan-y items-center rounded-[3px] select-none", BOOTH_FOCUS_RING, className)}
      style={{ gap: WAVEFORM.gap }}
    >
      {bars}
    </div>
  );
}

const CHIP_CLASS =
  "inline-flex h-6 shrink-0 items-center gap-[5px] rounded-full px-[9px] text-[12px] leading-4 whitespace-nowrap select-none transition-[background-color] duration-100";

/**
 * A small on/off capsule with an icon, such as "Video" and "Mix": outlined in `sep` while
 * off (a `fill` under the pointer), filled with `fill2` while on.
 */
export function BoothToggleChip({
  icon,
  title,
  on,
  label,
  onClick,
  className,
  ref,
}: {
  icon: BoothIconName;
  title: string;
  on: boolean;
  /** What pressing it does ("Show mix"). */
  label?: string;
  onClick?: () => void;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        CHIP_CLASS,
        "active:opacity-70",
        on
          ? "bg-(color:--booth-fill2) text-(color:--booth-text)"
          : "text-(color:--booth-text2) shadow-[inset_0_0_0_1px_var(--booth-sep)] hover:bg-(color:--booth-fill)",
        BOOTH_FOCUS_RING,
        className,
      )}
    >
      <BoothIcon name={icon} size={13} />
      {title}
    </button>
  );
}

/**
 * An action drawn like an off chip, such as "Open", "Done", "Revert" and "Save". Disabled, it
 * dims and ignores presses but keeps its place in the tab order (`aria-disabled`), so a keyboard
 * on Save stays there while it saves rather than dropping to the page.
 */
export function BoothChipButton({
  icon,
  title,
  label,
  onClick,
  disabled,
  className,
}: {
  icon?: BoothIconName;
  title: string;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        CHIP_CLASS,
        "text-(color:--booth-text2) shadow-[inset_0_0_0_1px_var(--booth-sep)]",
        disabled ? "cursor-default opacity-50" : "hover:bg-(color:--booth-fill) active:opacity-70",
        BOOTH_FOCUS_RING,
        className,
      )}
    >
      {icon && <BoothIcon name={icon} size={13} />}
      {title}
    </button>
  );
}

const KNOB = 12;
/** A press this close to the knob's centre takes the knob rather than jumping. */
const GRAB_RADIUS = 8;

/**
 * One mixer row: a 76 pt label, then a 2 pt track with a 12 pt knob, no value label. Drag the
 * knob from wherever it was taken, or press the bare track to jump there; the arrow keys step
 * by 1. A press on the knob that does not move changes nothing.
 */
export function BoothMixSlider({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  /** 0…100 */
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const grab = useRef(0);
  const [pointerFocused, setPointerFocused] = useState(false);
  const set = (next: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(next)));
    if (clamped !== value) onChange(clamped);
  };
  const knobLeft = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return null;
    // The row may be drawn scaled: measure in its own points.
    const scale = box.width / (track.current?.offsetWidth || box.width);
    return { x: (clientX - box.left) / scale, travel: Math.max(0, box.width / scale - KNOB) };
  };
  const step = (delta: number) => {
    setPointerFocused(false);
    set(value + delta);
  };
  return (
    <div className={cn("flex h-6 items-center gap-2.5", className)}>
      <span className="w-[76px] shrink-0 truncate text-[12px] leading-4 text-(color:--booth-text)">{label}</span>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onBlur={() => setPointerFocused(false)}
        onKeyDown={(event) => {
          const keys: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
          if (event.key === "Home") step(-value);
          else if (event.key === "End") step(100 - value);
          else if (keys[event.key]) step(keys[event.key]);
          else return;
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          startHorizontalDrag(event, {
            onStart: (clientX) => {
              setPointerFocused(true);
              const at = knobLeft(clientX);
              if (!at) return;
              const centre = (at.travel * value) / 100 + KNOB / 2;
              // Took the knob: it keeps where it was taken. Pressed the bare track: it jumps there.
              grab.current = Math.abs(at.x - centre) <= GRAB_RADIUS ? at.x - centre : 0;
            },
            onMove: (clientX) => {
              const at = knobLeft(clientX);
              if (!at || at.travel <= 0) return;
              set(((at.x - grab.current - KNOB / 2) / at.travel) * 100);
            },
          });
        }}
        className="group relative h-6 min-w-0 flex-1 touch-pan-y outline-none select-none"
      >
        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-(color:--booth-track)" />
        <span
          className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full bg-(color:--booth-text)"
          style={{ width: `calc((100% - ${KNOB}px) * ${value / 100} + ${KNOB / 2}px)` }}
        />
        <span
          className={cn(
            "absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-(color:--booth-knob) [box-shadow:var(--booth-knob-shadow)]",
            !pointerFocused && "group-focus-visible:outline-3 group-focus-visible:outline-solid group-focus-visible:outline-offset-[0.5px] group-focus-visible:outline-[rgb(10_132_255/0.5)]",
          )}
          style={{ left: `calc((100% - ${KNOB}px) * ${value / 100})` }}
        />
      </div>
    </div>
  );
}

/** The stems a Done screen's Mix shows: Music only when the job found some. */
export const MIX_ROWS: { stem: MixStem; label: string }[] = [
  { stem: "speech", label: "Speech" },
  { stem: "background", label: "Background" },
  { stem: "music", label: "Music" },
];

export interface BoothDoneScreenProps {
  /** The finished file's name, e.g. "interview-take3.m4a". */
  title: string;
  comparing: boolean;
  onComparingChange: (comparing: boolean) => void;
  playing: boolean;
  onPlayToggle?: () => void;
  /** Normalised bar levels, `WAVEFORM.count` of them. */
  levels: readonly number[];
  /** Bars left of the playhead. */
  played: number;
  playhead?: number;
  onSeek?: (fraction: number) => void;
  /** The Video chip, for a video file (the picture itself is the demo's to draw). */
  video?: { on: boolean; onToggle: () => void };
  mixOpen: boolean;
  onMixToggle?: () => void;
  mix: Mix;
  onMixChange?: (mix: Mix) => void;
  /** Music was found, so its slider shows. */
  music?: boolean;
  /** The mix differs from the saved one: Revert and Save replace Open and Done. */
  dirty?: boolean;
  saving?: boolean;
  onRevert?: () => void;
  onSave?: () => void;
  onOpen?: () => void;
  onDone?: () => void;
  /** Mix opens and closes as a cross-fade only. */
  reducedMotion?: boolean;
  className?: string;
}

/**
 * The Done screen's content (inside a BoothPopover frame): title, "Hold ⌥ to compare", play
 * and the waveform, then the Video and Mix chips beside Open and Done (Revert and Save while
 * the mix is unsaved), then the sliders when Mix is open. 274 pt wide in the app; it fills its
 * parent. Every callback is optional; a control without one still draws.
 */
export function BoothDoneScreen({
  title,
  comparing,
  onComparingChange,
  playing,
  onPlayToggle,
  levels,
  played,
  playhead,
  onSeek,
  video,
  mixOpen,
  onMixToggle,
  mix,
  onMixChange,
  music = false,
  dirty = false,
  saving = false,
  onRevert,
  onSave,
  onOpen,
  onDone,
  reducedMotion = false,
  className,
}: BoothDoneScreenProps) {
  const mixChip = useRef<HTMLButtonElement>(null);
  const unsaved = useRef<HTMLSpanElement>(null);
  // Revert and Save give way to Open and Done once the mix is reverted or saved: a keyboard on
  // them moves to Mix, the control before them, rather than dropping to the page.
  const handBack = useRef(false);
  useLayoutEffect(() => {
    if (dirty || !handBack.current) return;
    handBack.current = false;
    const focused = document.activeElement;
    if (!focused || focused === document.body) mixChip.current?.focus({ preventScroll: true });
  }, [dirty]);
  const leaving = (action?: () => void) => () => {
    handBack.current = !!unsaved.current?.contains(document.activeElement);
    action?.();
  };

  return (
    <div className={cn("relative flex flex-col", className)}>
      <BoothTitle>{title}</BoothTitle>
      <BoothCompareLine comparing={comparing} onComparingChange={onComparingChange} className="mt-0.5" />
      <div className="mt-3 flex items-center gap-2">
        {/* Where the keyboard lands when this screen takes over from another (BoothFrame). */}
        <BoothPlayButton playing={playing} onClick={onPlayToggle} data-booth-autofocus />
        <BoothWaveform levels={levels} played={played} comparing={comparing} playhead={playhead} onSeek={onSeek} />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        {video && (
          <BoothToggleChip icon="film" title="Video" on={video.on} label={video.on ? "Hide video" : "Show video"} onClick={video.onToggle} />
        )}
        <BoothToggleChip
          ref={mixChip}
          icon="sliders"
          title="Mix"
          on={mixOpen}
          label={mixOpen ? "Hide mix" : "Show mix"}
          onClick={onMixToggle}
        />
        <span className="min-w-0 flex-1" />
        {dirty ? (
          <span ref={unsaved} className="contents">
            <BoothChipButton title="Revert" onClick={leaving(onRevert)} disabled={saving} />
            <BoothChipButton title={saving ? "Saving…" : "Save"} onClick={leaving(onSave)} disabled={saving} />
          </span>
        ) : (
          <>
            <BoothChipButton icon="finder" title="Open" label="Open in Finder" onClick={onOpen} />
            <BoothChipButton title="Done" onClick={onDone} />
          </>
        )}
      </div>
      {/* The sliders open like a section: at once, settling from 98%; closing, they go soft first. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {mixOpen && (
          <motion.div key="mix" className="mt-1.5 origin-top" {...swapMotion({ reducedMotion, scale: 0.98, delay: 0 })}>
            {MIX_ROWS.filter((row) => music || row.stem !== "music").map((row) => (
              <BoothMixSlider
                key={row.stem}
                label={row.label}
                value={mix[row.stem]}
                onChange={(value) => onMixChange?.({ ...mix, [row.stem]: value })}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
