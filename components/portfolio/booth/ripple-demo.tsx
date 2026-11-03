"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cancelFrame, frame, motionValue, type FrameData, type MotionValue } from "motion/react";

import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";
import { POPOVER_MOTION } from "@/lib/booth/motion";
import { POPOVER } from "@/lib/booth/popover-logic";
import { RIPPLE } from "@/lib/booth/ripple-bar";
import { DEMO_ENGINE, ProgressGlide, demoSeconds, percent, stageAt, statusLine } from "@/lib/booth/ripple-loop";

import { BoothHint, BoothRoot, BoothSwap, BoothWorkingBar, startHorizontalDrag } from "./kit";

// "The ripple bar": Booth's Working screen, close up. Ported from studiovoice/app/Sources/Booth/
// UI/Screens/WorkingScreen.swift and BoothCore/RippleBar.swift: while a file is in the booth the
// whole popover is the progress bar. The fill spreads from just off its left edge like sound
// from a speaker, faint rings leave the source in bursts and travel out through it, a lead ring
// leaves the front every 1.8 s, and the file name stays out of focus until the fill has passed
// under it. The bar runs as the app's demo mode runs it (Model/Fakes.swift): a 0.6 s hello,
// then progress every 0.1 s, each step gliding over 0.25 s, 0 to 100% in the 9 s the demo gives
// this file's name. Full, it holds, and the next file starts on a fresh bar through the app's
// screen swap. Visitors can drag across the bar, or use the arrow keys, to move the front. The
// bar is the kit's BoothWorkingBar, the hero's own: this demo moves its progress in Motion's
// update step, and the bar draws it, with the rings, once in the same frame.

const FILE = "interview-take3.m4a";
/** The app's Working snapshot: 48% (AppModel.fixture), the rings held at 12 s. The resting frame. */
const REST_PROGRESS = 0.48;
/** 0 to 100% for this name in demo mode (Fakes.swift `demoSeconds`): 9 s. */
const RUN_SECONDS = demoSeconds(FILE);
/**
 * Full, the bar holds this long past its last glide before the next file comes in. The app moves
 * on to Done after 0.2 s (AppModel.finishHold); the demo lingers so the name reads in focus.
 */
const FULL_HOLD_SECONDS = 1.2;
/** Arrow keys move the front a whole percent; Page Up and Page Down ten. */
const KEY_STEPS: Record<string, number> = {
  ArrowRight: 0.01,
  ArrowUp: 0.01,
  ArrowLeft: -0.01,
  ArrowDown: -0.01,
  PageUp: 0.1,
  PageDown: -0.1,
  Home: -1,
  End: 1,
};

/** The popover while a file is in the booth: 320 pt wide, the 56 pt bar 4.5 pt inside the glass. */
const CARD = { width: POPOVER.width, height: RIPPLE.height + 2 * POPOVER.workingPanelInset };
/** As large as it reads well: up to 2.5×, never under 0.8×. */
const MAX_SCALE = 2.5;
const MIN_SCALE = 0.8;

/**
 * The popover's scale in a `width` × `height` tile: 16 px of paper each side on a phone, more as
 * the tile widens, and room above and below for the hint.
 */
function fitScale(width: number, height: number): number {
  const gutter = 16 + 0.16 * Math.max(0, width - 400);
  const across = (width - 2 * gutter) / CARD.width;
  const down = (height - 2 * 56) / CARD.height;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, across, down));
}

type Phase = "hello" | "run" | "full";

export function BoothRippleDemo() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLDivElement>(null);
  const { active, reducedMotion } = useDemoActive(root);
  const thumbnail = useDemoThumbnail();
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState("");
  const [glide] = useState(() => new ProgressGlide());
  /** How far the popover is scaled to fit the tile; the bar draws its canvases at that many pixels. */
  const [scale, setScale] = useState(1);

  /**
   * The file in the booth, on its own bar with its own progress. A fresh file gets a fresh one,
   * so the full bar keeps its 100% while it dissolves.
   */
  const [bar, setBar] = useState<{ job: number; progress: MotionValue<number> }>(() => ({ job: 0, progress: motionValue(REST_PROGRESS) }));
  const progress = useRef(bar.progress);
  /** The engine's side: where progress is (the bar glides after it), and what it is doing. */
  const loop = useRef<{ clock: number; target: number; phase: Phase; phaseAt: number; nextTick: number; job: number }>({
    clock: 0,
    target: REST_PROGRESS,
    phase: "run",
    phaseAt: 0,
    nextTick: DEMO_ENGINE.tickSeconds,
    job: 0,
  });
  /** The visitor's hold on the bar: a drag, or keyboard focus. Either stops the engine's progress. */
  const hold = useRef({ drag: false, key: false });
  const running = useRef(false);
  const shownPercent = useRef(-1);

  /** Writes the slider's value for assistive tech, as VoiceOver reads the app's bar. */
  const syncValue = useCallback(() => {
    const el = slider.current;
    const value = progress.current.get();
    const pct = percent(value);
    if (!el || pct === shownPercent.current) return;
    shownPercent.current = pct;
    el.setAttribute("aria-valuenow", String(pct));
    el.setAttribute("aria-valuetext", statusLine(value));
  }, []);

  // The popover's scale follows the tile, written straight to the stage so the first paint is
  // already the right size; the bar redraws at the new pixel size.
  useLayoutEffect(() => {
    const el = root.current;
    const s = stage.current;
    if (!el || !s) return;
    const fit = () => {
      const k = fitScale(el.clientWidth, el.clientHeight);
      s.style.setProperty("--booth-ripple-scale", String(k));
      setScale(k);
    };
    fit();
    syncValue();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncValue]);

  /** The engine moves on by `dt`, unless the visitor is holding the bar. */
  const advance = useCallback(() => {
    const l = loop.current;
    if (l.phase === "hello" && l.clock - l.phaseAt >= DEMO_ENGINE.helloSeconds) {
      l.phase = "run";
      l.nextTick = l.phaseAt + DEMO_ENGINE.helloSeconds + DEMO_ENGINE.tickSeconds;
    }
    if (l.phase === "run") {
      while (l.clock >= l.nextTick && l.target < 1) {
        const next = Math.min(1, l.target + DEMO_ENGINE.tickSeconds / RUN_SECONDS);
        glide.add(next - l.target, l.nextTick);
        l.target = next;
        l.nextTick += DEMO_ENGINE.tickSeconds;
      }
      if (l.target >= 1) {
        l.phase = "full";
        l.phaseAt = l.clock;
      }
    }
    if (l.phase === "full" && l.clock - l.phaseAt >= POPOVER_MOTION.progressGlide + FULL_HOLD_SECONDS) {
      // The next file, on a fresh bar: the full one stays as it is while it dissolves.
      l.target = 0;
      l.phase = "hello";
      l.phaseAt = l.clock;
      glide.clear();
      const next = { job: l.job + 1, progress: motionValue(0) };
      l.job = next.job;
      progress.current = next.progress;
      setBar(next);
    }
  }, [glide]);

  // One frame loop, only while the tile is active: the engine and the glide, in Motion's update
  // step, so the bar (whose rings run on their own clock while `active`) draws in the same frame.
  useEffect(() => {
    running.current = active;
    if (!active) return;
    const step = ({ delta }: FrameData) => {
      const l = loop.current;
      l.clock += Math.min(0.1, delta / 1000);
      if (!hold.current.drag && !hold.current.key) advance();
      progress.current.set(glide.value(l.target, l.clock));
      syncValue();
    };
    frame.update(step, true);
    return () => {
      running.current = false;
      cancelFrame(step);
    };
  }, [active, advance, glide, syncValue]);

  /** The visitor puts the front at `value`: no glide when held still, the app's when it runs. */
  const moveTo = useCallback(
    (value: number, smooth: boolean) => {
      const l = loop.current;
      const next = Math.min(1, Math.max(0, value));
      if (smooth && running.current) glide.add(next - l.target, l.clock);
      else glide.clear();
      l.target = next;
      if (!running.current) {
        // Nothing is running frames: the bar draws this value itself, the rings where they are.
        progress.current.set(next);
        syncValue();
      }
    },
    [glide, syncValue],
  );

  /** Let go: the engine carries on from wherever the visitor left the front. */
  const resume = useCallback(() => {
    const l = loop.current;
    if (l.target >= 1) {
      l.phase = "full";
      l.phaseAt = l.clock;
    } else {
      l.phase = "run";
      l.nextTick = l.clock + DEMO_ENGINE.tickSeconds;
    }
  }, []);

  const markTouched = useCallback(() => setTouched(true), []);

  const onBarDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = event.currentTarget.firstElementChild;
    if (!track) return;
    const at = (clientX: number) => {
      const box = track.getBoundingClientRect();
      return box.width > 0 ? (clientX - box.left) / box.width : 0;
    };
    startHorizontalDrag(event, {
      onStart: () => {
        // The pointer takes over from the keyboard: letting go runs the bar on, even with focus.
        hold.current.drag = true;
        hold.current.key = false;
        setStatus("");
      },
      onMove: (clientX) => moveTo(at(clientX), false),
      onEnd: () => {
        hold.current.drag = false;
        resume();
        const value = loop.current.target;
        setStatus(`Let go at ${percent(value)}%: ${stageAt(value).label}`);
      },
    });
  };

  const onBarKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    hold.current.key = true;
    const from = loop.current.target;
    // Arrow keys land on whole percents; Home and End on the ends.
    const to = Math.abs(step) === 1 ? (step > 0 ? 1 : 0) : Math.round((from + step) * 100) / 100;
    moveTo(to, !reducedMotion);
  };

  // Keyboard focus holds the bar, so the arrow keys move a still value; leaving lets it run on.
  const onBarFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.matches(":focus-visible")) hold.current.key = true;
  };
  const onBarBlur = () => {
    if (!hold.current.key) return;
    hold.current.key = false;
    resume();
  };

  const onFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
    if ((event.target as Element).matches(":focus-visible")) markTouched();
  };

  return (
    <BoothRoot
      ref={root}
      paused={!active && !reducedMotion}
      role="group"
      aria-label="Booth's Working screen: the whole popover is the progress bar while a file is enhanced"
      className="select-none"
      // A finger counts when it lifts, so a swipe past the tile to scroll the page never does.
      onPointerDownCapture={(event) => {
        if (event.pointerType !== "touch") markTouched();
      }}
      onPointerUpCapture={(event) => {
        if (event.pointerType === "touch") markTouched();
      }}
      onKeyDownCapture={markTouched}
      onFocusCapture={onFocusCapture}
    >
      <p className="sr-only">
        Booth&apos;s popover while it enhances {FILE}. The bar runs from 0 to 100% and starts again with the next file. Drag across
        the bar to move its progress and let go to let it run on. With the keyboard, the bar holds while it has focus: the arrow keys
        move it by 1%, Page Up and Page Down by 10%.
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      <div
        ref={stage}
        className="absolute top-1/2 left-1/2"
        style={{ width: CARD.width, transform: "translate(-50%, -50%) scale(var(--booth-ripple-scale, 1))" }}
      >
        <div
          ref={slider}
          role="slider"
          tabIndex={0}
          aria-label={`Progress of ${FILE}`}
          aria-valuemin={0}
          aria-valuemax={100}
          // Kept current by the frame loop (syncValue), not by React.
          aria-valuenow={percent(REST_PROGRESS)}
          aria-valuetext={statusLine(REST_PROGRESS)}
          aria-orientation="horizontal"
          // The glass comes 4 pt from the bar while a file is in the booth (4.5 with its hairline).
          className="booth-glass cursor-ew-resize touch-pan-y outline-none focus-visible:outline-solid focus-visible:outline-[rgb(10_132_255/0.5)] focus-visible:[outline-width:calc(3px/var(--booth-ripple-scale,1))]"
          style={{ padding: POPOVER.workingPanelInset - POPOVER.borderWidth }}
          onPointerDown={onBarDown}
          onKeyDown={onBarKey}
          onFocus={onBarFocus}
          onBlur={onBarBlur}
        >
          {/* The frame inside the glass: radius 10, its border hidden on Working, the bar edge to edge. */}
          <div className="relative h-14 overflow-hidden rounded-[10px]">
            <BoothSwap swapKey={`job-${bar.job}`} reducedMotion={reducedMotion} scale={0.98} className="absolute inset-0">
              {/* Decorative: the slider round it carries the value and the status line. */}
              <BoothWorkingBar progress={bar.progress} name={FILE} running={active} reducedMotion={reducedMotion} scale={scale} decorative />
            </BoothSwap>
          </div>
        </div>
      </div>

      <BoothHint hidden={touched || thumbnail}>Drag across the bar</BoothHint>
    </BoothRoot>
  );
}
