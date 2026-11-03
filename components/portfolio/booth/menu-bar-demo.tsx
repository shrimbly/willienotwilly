"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { animate, motion, useMotionValue, useMotionValueEvent } from "motion/react";

import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";
import { WAVEFORM, playedBars, syntheticBars, waveformLevels } from "@/lib/booth/mix";
import { ICON } from "@/lib/booth/motion";
import {
  BEATS,
  STORY_WORK_SECONDS,
  easeInOutCubic,
  progressBetween,
  storyDragPoint,
  storyGhostOpacity,
  type Point,
} from "@/lib/booth/storyline";
import { WALKTHROUGH, WALKTHROUGH_AUDIO } from "@/lib/booth/walkthrough";

import {
  BoothDoneScreen,
  BoothFrame,
  BoothGearButton,
  BoothHint,
  BoothIdleScreen,
  BoothMenuBarItem,
  BoothPopover,
  BoothRoot,
  BoothSignature,
  BoothWorkingBar,
  useCompareAudio,
  useOptionKeyHold,
} from "./kit";
import { DemoCursor, DesktopFile } from "./menu-bar/desktop-file";
import { REST_SCENE, sceneGlyph, sceneReducer } from "./menu-bar/scene-state";
import "./menu-bar/menu-bar-demo.css";

// The hero: Booth from the menu bar, live. The storyline is the website's demo video's
// (studiovoice/app/Sources/Booth/Debug/DemoRenderer.swift, `Beat`): a recording is carried from
// the desktop up to Booth's icon, which grows under it; held there, the popover springs open and
// the name comes forward through fog; carried down into the drop zone, the dots join into a line
// and the prompt reads "Release to start"; let go, the ripple bar runs to 100% and the Done
// screen shows the waveform; then the popover closes and it all starts again. The desktop is
// Booth's own paper, laid out like its link-preview card, not a wallpaper. Visitors can drag
// the file themselves, click the icon, and play the result.

const FILE = "interview-take3.m4a";
/** OutputNaming.swift: `<stem>-enhanced`, and audio comes out as `.wav`. */
const ENHANCED = "interview-take3-enhanced.wav";
/** The app's snapshots rest the playhead here (AppModel.fixture `showDone`). */
const REST_PLAYHEAD = 0.32;
/** A voice recording without music: the app's demo-mode bars (`StemsManifest.Bars.synthetic`). */
const BARS = syntheticBars(false);
/** Where the storyline picks up as it starts: on the Done screen, a moment before it closes. */
const ENTRY = { page: 8.6, thumbnail: 9.6 } as const;
/** The job finishes this long after the drop: the bar's run plus Working's hold (finishHold). */
const JOB_SECONDS = BEATS.done - BEATS.drop;
/** The storyline's pointer shows from just before the pick-up until just after the drop. */
const CURSOR = { in: 0.15, out: BEATS.drop + 0.25, fade: 0.25 } as const;
/** Where the big name's focus rests: the card's mask is centred at 34% across, 58% down. */
const NAME_FOCUS = { x: 0.34, y: 0.58 };
/**
 * Where the storyline's pointer holds the file: by the top right of its icon, so the copy hangs
 * below and left of the pointer and the icon it is carried to stays in view.
 */
const GRIP = { x: 28, y: -30 };
/** A press that moves this far (px) is a drag; less is a click. */
const DRAG_SLOP = 4;
/** The icon's drop target reaches this far (px) past the button, as a menu bar item's does. */
const ICON_REACH = 6;

type Mode = "auto" | "carry" | "hand";

/** Story beats that change state, in order. */
const STORY_BEATS = [BEATS.hover, BEATS.open, BEATS.leaveIcon, BEATS.zoneHover, BEATS.drop, BEATS.close] as const;

export function BoothMenuBarDemo() {
  const root = useRef<HTMLDivElement>(null);
  const desk = useRef<HTMLDivElement>(null);
  const glyphButton = useRef<HTMLButtonElement>(null);
  const popWrap = useRef<HTMLDivElement>(null);
  const fileIcon = useRef<HTMLButtonElement>(null);
  const { active, inView, reducedMotion, pageVisible } = useDemoActive(root);
  const thumbnail = useDemoThumbnail();
  // A fixed id: useId came out differently on the server and the client under next/dynamic.
  const popId = thumbnail ? undefined : "booth-menu-bar-popover";

  const [scene, dispatch] = useReducer(sceneReducer, REST_SCENE);
  const [mode, setMode] = useState<Mode>("auto");
  const [touched, setTouched] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  /** The desk's scale in the tile, so the Working bar draws its canvases at the screen's pixels. */
  const [deskScale, setDeskScale] = useState(1);

  const ghostX = useMotionValue(0);
  const ghostY = useMotionValue(0);
  const ghostOpacity = useMotionValue(0);
  const ghostScale = useMotionValue(1);
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const cursorOpacity = useMotionValue(0);
  const progress = useMotionValue(0);

  const audio = useCompareAudio({ ...WALKTHROUGH_AUDIO, duration: WALKTHROUGH.duration, initial: REST_PLAYHEAD });
  const { pause: pauseAudio, setComparing } = audio;
  const [played, setPlayed] = useState(() => playedBars(REST_PLAYHEAD, WAVEFORM.count));
  useMotionValueEvent(audio.playhead, "change", (v) => setPlayed(playedBars(v, WAVEFORM.count)));

  // The scene as the frame loop and the handlers last saw it.
  const latest = useRef(scene);
  useEffect(() => {
    latest.current = scene;
  });

  /* ------------------------------------------------------------- the desk's coordinates */

  /** The desk's scale and box: it is laid out in points and scaled to fit the tile. */
  const deskBox = useCallback(() => {
    const el = desk.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { box, k: el.offsetWidth > 0 ? box.width / el.offsetWidth : 1, width: el.offsetWidth };
  }, []);
  const toDesk = useCallback(
    (clientX: number, clientY: number): Point => {
      const d = deskBox();
      if (!d) return { x: 0, y: 0 };
      return { x: (clientX - d.box.left) / d.k, y: (clientY - d.box.top) / d.k };
    },
    [deskBox],
  );
  const centreOf = useCallback(
    (el: Element | null | undefined): Point => {
      const b = el?.getBoundingClientRect();
      return b ? toDesk(b.left + b.width / 2, b.top + b.height / 2) : { x: 0, y: 0 };
    },
    [toDesk],
  );
  /** The storyline's three places: the file on the desk, the icon, and the drop zone under it. */
  const storyPoints = useCallback(() => {
    const file = centreOf(fileIcon.current?.querySelector("[data-icon]"));
    const from = { x: file.x + GRIP.x, y: file.y + GRIP.y };
    const icon = centreOf(glyphButton.current);
    const top = popWrap.current ? toDesk(0, popWrap.current.getBoundingClientRect().top).y : 30;
    // DemoRenderer lets go 20 pt left of the icon, 82 pt into the popover, and bows the path 60 pt on a 1440 pt screen.
    return { from, icon, drop: { x: icon.x - 20, y: top + 82 }, arc: (60 * (deskBox()?.width ?? 960)) / 1440 };
  }, [centreOf, deskBox, toDesk]);

  // Script measures the desk's scale too, for browsers without the CSS maths.
  useLayoutEffect(() => {
    const el = root.current;
    const d = desk.current;
    if (!el || !d) return;
    const fit = () => {
      const k = el.clientWidth / d.offsetWidth;
      d.style.setProperty("--booth-k", String(k));
      setDeskScale(k);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------------------------------------------ the clock and the story */

  const clock = useRef<{ e: number; t: number; jobStart: number; pulseUntil: number; finished: boolean }>({
    e: 0,
    t: thumbnail ? ENTRY.thumbnail : ENTRY.page,
    jobStart: -Infinity,
    pulseUntil: 0,
    finished: true,
  });
  const points = useRef<ReturnType<typeof storyPoints> | null>(null);

  const startJob = useCallback(() => {
    const c = clock.current;
    c.jobStart = c.e;
    c.finished = false;
    c.pulseUntil = c.e + ICON.pulseSeconds;
    progress.set(0);
    dispatch({ type: "drop" });
  }, [progress]);

  const hideStoryHand = useCallback(() => {
    cursorOpacity.set(0);
    ghostOpacity.set(0);
  }, [cursorOpacity, ghostOpacity]);

  const directing = (mode === "auto" && active) || mode === "carry";
  // In the storyline the job is part of the story and stops with it; dropped by hand, it runs on.
  const running = directing || (mode !== "auto" && (scene.job === "working" || scene.pulse) && pageVisible);
  const modeRef = useRef(mode);
  const directingRef = useRef(directing);
  useEffect(() => {
    modeRef.current = mode;
    directingRef.current = directing;
  });

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();

    /** The storyline's state changes as `t` passes each beat. */
    const beat = (at: number) => {
      const s = latest.current;
      if (at === BEATS.hover) dispatch({ type: "iconTarget", on: true });
      else if (at === BEATS.open) dispatch({ type: "open" });
      else if (at === BEATS.leaveIcon) dispatch({ type: "iconTarget", on: false });
      else if (at === BEATS.zoneHover) dispatch({ type: "dropHover", on: true });
      else if (at === BEATS.drop) startJob();
      else if (at === BEATS.close && modeRef.current === "auto" && s.open) dispatch({ type: "close" });
    };

    /** The story's continuous parts at `t`: the pointer carrying the file, and the file's copy. */
    const pose = (t: number) => {
      const p = (points.current ??= storyPoints());
      const at = storyDragPoint(Math.min(t, BEATS.drop), p.from, p.icon, p.drop, p.arc);
      cursorX.set(at.x);
      cursorY.set(at.y);
      const fadeIn = progressBetween(t, CURSOR.in, CURSOR.fade);
      const fadeOut = 1 - progressBetween(t, CURSOR.out, CURSOR.fade);
      cursorOpacity.set(Math.min(fadeIn, fadeOut));
      ghostX.set(at.x - GRIP.x);
      ghostY.set(at.y - GRIP.y);
      ghostOpacity.set(t > BEATS.drop + 0.2 ? 0 : 0.7 * storyGhostOpacity(t));
      ghostScale.set(1 - 0.15 * progressBetween(t, BEATS.drop, 0.15));
    };

    const story = (dt: number) => {
      const c = clock.current;
      let from = c.t;
      let to = c.t + dt;
      if (modeRef.current === "auto" && to >= BEATS.loop) {
        for (const b of STORY_BEATS) if (b > from) beat(b);
        dispatch({ type: "loop" });
        points.current = null;
        from = 0;
        to -= BEATS.loop;
      }
      for (const b of STORY_BEATS) if (b > from && b <= to) beat(b);
      c.t = to;
      pose(to);
      // Carried by the keyboard: the visitor's own from the moment the file is let go.
      if (modeRef.current === "carry" && to >= CURSOR.out + CURSOR.fade) {
        hideStoryHand();
        setMode("hand");
      }
    };

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const c = clock.current;
      c.e += dt;
      if (directingRef.current) story(dt);
      const s = latest.current;
      if (s.job === "working") {
        progress.set(easeInOutCubic(progressBetween(c.e - c.jobStart, 0, STORY_WORK_SECONDS)));
        if (!c.finished && c.e - c.jobStart >= JOB_SECONDS) {
          c.finished = true;
          dispatch({ type: "finish" });
        }
      }
      if (s.pulse && c.e >= c.pulseUntil) dispatch({ type: "pulseEnd" });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, startJob, storyPoints, hideStoryHand, cursorX, cursorY, cursorOpacity, ghostX, ghostY, ghostOpacity, ghostScale, progress]);

  // The places move with the tile's size.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      points.current = null;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------------------------------------------- the visitor's hand */

  /** The visitor takes over: the storyline stops where it is and its pointer and copy go. */
  const takeOver = useCallback(() => {
    setTouched(true);
    if (modeRef.current === "hand") return;
    setMode("hand");
    hideStoryHand();
    dispatch({ type: "iconTarget", on: false });
    dispatch({ type: "dropHover", on: false });
  }, [hideStoryHand]);

  const open = useCallback(() => dispatch({ type: "open" }), []);
  const close = useCallback(() => {
    pauseAudio();
    // A keyboard inside the popover (on Open, say) goes back to the icon that opens it, as
    // Escape does, rather than dropping to the page as the closed popover turns inert.
    if (popWrap.current?.contains(document.activeElement)) glyphButton.current?.focus({ preventScroll: true });
    dispatch({ type: "close" });
  }, [pauseAudio]);

  const springLoad = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ id: number; x0: number; y0: number; dx: number; dy: number; moving: boolean } | null>(null);

  useEffect(
    () => () => {
      if (springLoad.current) clearTimeout(springLoad.current);
    },
    [],
  );

  const setIconTarget = (on: boolean) => {
    if (latest.current.iconTarget === on) return;
    dispatch({ type: "iconTarget", on });
    if (springLoad.current) clearTimeout(springLoad.current);
    springLoad.current = null;
    // A file held over the icon for 0.7 s springs the popover open (StatusItemController.swift).
    if (on && !latest.current.open) springLoad.current = setTimeout(open, ICON.springLoadSeconds * 1000);
  };

  const hitTest = (clientX: number, clientY: number) => {
    const within = (el: Element | null, reach = 0) => {
      const b = el?.getBoundingClientRect();
      return !!b && clientX >= b.left - reach && clientX <= b.right + reach && clientY >= b.top - reach && clientY <= b.bottom + reach;
    };
    const overIcon = within(glyphButton.current, ICON_REACH);
    const overPopover = !overIcon && latest.current.open && within(popWrap.current?.firstElementChild ?? null);
    return { overIcon, overPopover };
  };

  const onFileDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    takeOver();
    dispatch({ type: "select", file: "original" });
    const icon = centreOf(event.currentTarget.querySelector("[data-icon]"));
    const at = toDesk(event.clientX, event.clientY);
    drag.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, dx: at.x - icon.x, dy: at.y - icon.y, moving: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onFileMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    if (!d.moving && Math.hypot(event.clientX - d.x0, event.clientY - d.y0) < DRAG_SLOP) return;
    d.moving = true;
    const at = toDesk(event.clientX, event.clientY);
    ghostX.set(at.x - d.dx);
    ghostY.set(at.y - d.dy);
    ghostScale.set(1);
    ghostOpacity.set(0.7);
    const { overIcon, overPopover } = hitTest(event.clientX, event.clientY);
    setIconTarget(overIcon);
    if (latest.current.dropHover !== overPopover) dispatch({ type: "dropHover", on: overPopover });
  };
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (!d.moving) return;
    const { overIcon, overPopover } = hitTest(event.clientX, event.clientY);
    setIconTarget(false);
    dispatch({ type: "dropHover", on: false });
    if (!cancelled && (overIcon || overPopover)) {
      // Let go on Booth: the copy sinks in, and the file is in the booth.
      startJob();
      const fade = { duration: reducedMotion ? 0 : 0.15, ease: "easeOut" as const };
      animate(ghostOpacity, 0, fade);
      animate(ghostScale, 0.85, fade);
      return;
    }
    // Let go anywhere else: the copy slides back to the file, as Finder's does.
    const home = centreOf(fileIcon.current?.querySelector("[data-icon]"));
    const back = { duration: reducedMotion ? 0 : 0.3, ease: [0.23, 1, 0.32, 1] as const };
    animate(ghostX, home.x, back);
    animate(ghostY, home.y, back);
    animate(ghostOpacity, 0, { ...back, delay: reducedMotion ? 0 : 0.2, duration: reducedMotion ? 0 : 0.12 });
  };

  /** The keyboard's way: the file is carried to Booth along the storyline's path and let go. */
  const carry = () => {
    takeOver();
    dispatch({ type: "select", file: "original" });
    if (reducedMotion) {
      open();
      startJob();
      return;
    }
    points.current = null;
    clock.current.t = CURSOR.in;
    setMode("carry");
  };

  const choose = () => {
    takeOver();
    startJob();
  };

  // Leaving the Done screen, or the popover, stops the playback.
  const showingDone = scene.open && scene.screen === "done";
  useEffect(() => {
    if (!showingDone || !inView) pauseAudio();
  }, [showingDone, inView, pauseAudio]);

  useOptionKeyHold(!thumbnail && showingDone && (hovered || focusWithin), setComparing);

  const levels = useMemo(() => waveformLevels(BARS, scene.mix, { comparing: audio.comparing }), [scene.mix, audio.comparing]);
  const dirty = scene.mix.speech !== scene.savedMix.speech || scene.mix.background !== scene.savedMix.background;

  const save = () => {
    dispatch({ type: "saving" });
    // A remix from the saved stems takes a second or two; the voice models don't run again.
    setTimeout(() => dispatch({ type: "saved" }), 900);
  };

  /* ------------------------------------------------------------------------------ render */

  const glyph = sceneGlyph(scene);
  const iconScale = scene.iconTarget ? ICON.targetScale : scene.pulse && !reducedMotion ? ICON.pulseScale : 1;

  const status = !touched
    ? ""
    : scene.job === "working"
      ? `Enhancing ${FILE}`
      : scene.open && scene.screen === "done"
        ? audio.comparing
          ? "Playing the original"
          : `Done: ${ENHANCED} is beside the original`
        : scene.open && scene.screen === "idle"
          ? scene.dropHover
            ? "Release to start"
            : "Booth is open: drop audio or video"
          : scene.unseen
            ? `${FILE} is done. Booth's menu bar icon opens it`
            : "";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && latest.current.open) {
      event.preventDefault();
      close();
      glyphButton.current?.focus();
    }
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    setFocusWithin(true);
    if ((event.target as Element).matches(":focus-visible")) takeOver();
  };

  return (
    <BoothRoot
      ref={root}
      paused={!active && !reducedMotion}
      role="group"
      aria-label="Booth on a Mac desktop: drag a recording to its menu bar icon and it comes back with the voice cleaned up"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDownCapture={(event) => {
        // A finger counts when it lifts, so a swipe past the tile to scroll the page never does.
        if (event.pointerType !== "touch") takeOver();
      }}
      onPointerUpCapture={(event) => {
        if (event.pointerType === "touch") takeOver();
      }}
      onFocusCapture={onFocus}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">
        A desktop with Booth in the menu bar. Drag {FILE} onto Booth&apos;s menu bar icon, or select the file and press Enter, to enhance
        it; holding it over the icon opens the popover. The icon opens and closes the popover. When the file is done, play it and press
        and hold Hold ⌥ to compare to hear the original; Mix reshapes the waveform.
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      {/* Nothing on the desk selects as text: a drag across it is a file's. */}
      <div ref={desk} className="booth-desk select-none">
        {/* The desktop itself: a click on it closes the popover and clears the selection. */}
        <div
          aria-hidden
          className="absolute inset-0"
          onPointerDown={() => {
            if (latest.current.open) close();
            dispatch({ type: "select", file: null });
          }}
        />

        <div className="booth-desk-menubar">
          <BoothMenuBarItem
            ref={glyphButton}
            mode={glyph}
            scale={iconScale}
            highlighted={scene.open || scene.iconTarget}
            aria-label="Booth"
            aria-expanded={scene.open}
            aria-controls={popId}
            onClick={() => (latest.current.open ? close() : open())}
          />
          <span className="booth-desk-clock">{"Sun 1 Nov  9:41"}</span>
        </div>

        <div ref={popWrap} className="booth-desk-popover">
          <BoothPopover
            id={popId}
            open={scene.open}
            screen={scene.screen}
            pivotX="var(--booth-desk-pivot)"
            reducedMotion={reducedMotion}
          >
            <BoothFrame
              screen={scene.screen}
              dropHover={scene.dropHover}
              reducedMotion={reducedMotion}
              signature={
                scene.screen === "idle" ? (
                  <BoothSignature leading={1} over={scene.dropHover} reveal={scene.revealKey || false} revealAt={30} />
                ) : undefined
              }
              corner={scene.screen === "idle" ? <BoothGearButton decorative /> : undefined}
            >
              {scene.screen === "idle" && <BoothIdleScreen dropHover={scene.dropHover} onChoose={choose} reducedMotion={reducedMotion} />}
              {scene.screen === "working" && (
                <BoothWorkingBar
                  progress={progress}
                  name={FILE}
                  running={active}
                  reducedMotion={reducedMotion}
                  // On a listing card the stage is scaled down again, outside the demo: there the
                  // bar measures itself, a little under the screen's pixels at worst.
                  scale={thumbnail ? undefined : deskScale}
                  onCancel={() => dispatch({ type: "cancel" })}
                />
              )}
              {scene.screen === "done" && (
                <BoothDoneScreen
                  title={FILE}
                  comparing={audio.comparing}
                  onComparingChange={audio.setComparing}
                  playing={audio.playing}
                  onPlayToggle={audio.toggle}
                  levels={levels}
                  played={played}
                  onSeek={audio.seek}
                  mixOpen={scene.mixOpen}
                  onMixToggle={() => dispatch({ type: "mixToggle" })}
                  mix={scene.mix}
                  onMixChange={(mix) => dispatch({ type: "mix", mix })}
                  dirty={dirty}
                  saving={scene.saving}
                  onRevert={() => dispatch({ type: "revert" })}
                  onSave={save}
                  onOpen={() => {
                    // Show in Finder: the enhanced copy is selected on the desktop and Finder comes forward.
                    dispatch({ type: "select", file: "enhanced" });
                    close();
                  }}
                  onDone={() => {
                    audio.pause();
                    dispatch({ type: "closeDone" });
                  }}
                  reducedMotion={reducedMotion}
                />
              )}
            </BoothFrame>
          </BoothPopover>
        </div>

        <div className="booth-desk-words">
          {/* As the link-preview card draws it: the focus resting a little left of centre. */}
          <BoothSignature size={124} restingFocus={NAME_FOCUS} style={{ fontSize: "var(--booth-desk-name)" }} label="Booth" />
          <p className="booth-desk-line">Studio-quality voice for your recordings, enhanced on your Mac.</p>
        </div>

        <div className="booth-desk-files">
          <button
            ref={fileIcon}
            type="button"
            aria-label={`${FILE}, a recording on the desktop. Press Enter to drop it on Booth`}
            className="block touch-none rounded-[8px] outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-[rgb(10_132_255/0.5)]"
            onPointerDown={onFileDown}
            onPointerMove={onFileMove}
            onPointerUp={(event) => endDrag(event, false)}
            onPointerCancel={(event) => endDrag(event, true)}
            onClick={(event) => {
              // A click from the keyboard (Enter or Space) carries the file to Booth.
              if (event.detail === 0) carry();
            }}
          >
            <DesktopFile name={FILE} selected={scene.selected === "original"} />
          </button>
          <motion.span
            aria-hidden
            initial={false}
            animate={{ opacity: scene.enhanced ? 1 : 0, scale: scene.enhanced ? 1 : 0.9 }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.23, 1, 0.32, 1] }}
            onPointerDown={() => dispatch({ type: "select", file: "enhanced" })}
          >
            <DesktopFile name={ENHANCED} selected={scene.selected === "enhanced"} />
          </motion.span>
        </div>

        {/* The file's see-through copy, carried by the storyline's pointer or the visitor's. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 z-[4] -mt-[30px] -ml-[66px]"
          style={{ x: ghostX, y: ghostY, opacity: ghostOpacity, scale: ghostScale, transformOrigin: "66px 30px" }}
        >
          <DesktopFile name={FILE} ghost />
        </motion.div>
        <motion.div aria-hidden className="pointer-events-none absolute top-0 left-0 z-[5] -mt-px -ml-px" style={{ x: cursorX, y: cursorY, opacity: cursorOpacity }}>
          <DemoCursor />
        </motion.div>
      </div>

      <BoothHint hidden={touched || thumbnail} className="booth-desk-hint">
        <span className="booth-desk-hint-long">Drag the file to the menu bar</span>
        {/* A phone's menu bar is too short for the whole line: this one hugs the icon. */}
        <span className="booth-desk-hint-short">Drag the file here →</span>
      </BoothHint>
    </BoothRoot>
  );
}
