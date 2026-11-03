"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useMotionValueEvent } from "motion/react";

import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";
import { WAVEFORM, percent, playedBars } from "@/lib/booth/mix";
import { WALKTHROUGH_AUDIO } from "@/lib/booth/walkthrough";

import { COMPARE_FILE, COMPARE_REEL, DONE_LEVELS, LAYOUTS, REST_SECONDS, layoutFor, type CompareLayout } from "./compare/data";
import { CompareDonePanel } from "./compare/done-panel";
import { CompareHoldButton } from "./compare/hold-button";
import { CompareLanes } from "./compare/lanes";
import { BoothHint, BoothRoot, useCompareAudio, useOptionKeyHold } from "./kit";
import "./compare/compare-demo.css";

// "Hold ⌥ to compare": Booth's Done screen for the website's walkthrough, a recording made in a
// noisy room, over the site's two lanes (studiovoice/app/Sources/Booth/UI/Screens/DoneScreen.swift
// and site/index.html's reel). Both versions play together through Web Audio, one of them silent,
// and holding ⌥, the compare line or the Hold pill crosses their gains in 60 ms, so the switch has
// no gap. The lanes light each breath and stretch of noise Booth took out as the playhead passes.
// It never plays on its own: sound starts only from the visitor's own press.

const REST = REST_SECONDS / COMPARE_REEL.duration;

export function BoothCompareDemo() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const { active, inView, reducedMotion, pageVisible } = useDemoActive(root);
  const thumbnail = useDemoThumbnail();

  const [touched, setTouched] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [fit, setFit] = useState<{ layout: CompareLayout; scale: number; measured: boolean }>({
    layout: "wide",
    scale: 1,
    measured: false,
  });

  const audio = useCompareAudio({ ...WALKTHROUGH_AUDIO, duration: COMPARE_REEL.duration, initial: REST });
  const { preload, pause, toggle, setComparing, seek } = audio;
  const [played, setPlayed] = useState(() => playedBars(REST, WAVEFORM.count));
  const [at, setAt] = useState(() => percent(REST) / 100);
  useMotionValueEvent(audio.playhead, "change", (v) => {
    setPlayed(playedBars(v, WAVEFORM.count));
    // Whole percent, as the app reads the playhead out: no re-render between.
    setAt(percent(v) / 100);
  });

  /* ------------------------------------------------------------------------- fitting the stage */

  // The stage keeps its points and is scaled to the tile; the lanes take the site's width when a
  // landscape tile has room, the popover's in a phone's or a portrait tile.
  useLayoutEffect(() => {
    const el = root.current;
    const s = stage.current;
    if (!el || !s) return;
    const measure = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      const layout = layoutFor(width, height);
      const spec = LAYOUTS[layout];
      // The stage may still be in the other layout: its height is only right once it has reflowed.
      const reflowed = s.dataset.layout === layout;
      const scale = Math.max(
        0.1,
        Math.min(spec.maxScale, (width - 2 * spec.padX) / spec.width, reflowed ? (height - 2 * spec.padY) / s.offsetHeight : Infinity),
      );
      setFit((f) => (f.layout === layout && f.scale === scale && f.measured === reflowed ? f : { layout, scale, measured: reflowed }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(s);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------------------------------------------------------ the player */

  // Out of view, or in a hidden tab, it stops.
  useEffect(() => {
    if (!inView || !pageVisible) pause();
  }, [inView, pageVisible, pause]);

  // ⌥ is listened for only while the pointer is over the demo or focus is in it, never page-wide.
  useOptionKeyHold(!thumbnail && (hovered || focusWithin), setComparing);

  // The site starts fetching the moment someone looks like they'll press play; so does this, and
  // play then decodes the same bytes. Only a clear sign counts: a mouse or pen over Play, the
  // keyboard on it, or a press in the demo. The tile passing under a resting pointer as the page
  // scrolls, or a finger setting off a scroll from it, fetches nothing (the tracks are 1.4 MB).
  const warm = useCallback(() => {
    if (!thumbnail) preload();
  }, [thumbnail, preload]);

  const markTouched = useCallback(() => setTouched(true), []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Space plays and pauses, unless a focused control answers it itself (site: the reel's Space).
    if (event.key !== " " || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select")) return;
    event.preventDefault();
    toggle();
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    setFocusWithin(true);
    if ((event.target as Element).matches(":focus-visible")) markTouched();
  };

  const heard = audio.comparing ? "before" : "after";
  const status = !touched
    ? ""
    : audio.loading
      ? "Loading the recording"
      : `${audio.playing ? "Playing" : "Paused"}: ${audio.comparing ? "the original" : "Booth's version"}`;

  return (
    <BoothRoot
      ref={root}
      paused={!active && !reducedMotion}
      role="group"
      aria-label="Booth's Done screen for a recording made in a noisy room: play it, then hold ⌥ to hear the original"
      // Focusable, so a click anywhere in the tile lets Space play and pause (Safari focuses no buttons on click).
      tabIndex={-1}
      className="outline-none"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDownCapture={(event) => {
        // A finger counts when it lifts, so a swipe past the tile to scroll the page never does.
        if (event.pointerType === "touch") return;
        markTouched();
        warm();
      }}
      onPointerUpCapture={(event) => {
        if (event.pointerType !== "touch") return;
        markTouched();
        warm();
      }}
      onKeyDownCapture={markTouched}
      onFocusCapture={onFocus}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">
        Booth has finished {COMPARE_FILE}, a walkthrough recorded in a noisy room. Play it, then press and hold the ⌥ key, the compare
        line or Hold for the original to hear the original recording in place of Booth&apos;s version; both play together, so the
        switch has no gap. Space plays and pauses, and the waveform is a slider: the arrow keys move the playhead. Under the screen,
        the original&apos;s waveform and Booth&apos;s mark each breath and stretch of background noise Booth took out.
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      <div
        ref={stage}
        className="booth-cmp-stage"
        data-layout={fit.layout}
        data-measuring={fit.measured ? undefined : ""}
        style={{ "--booth-cmp-width": `${LAYOUTS[fit.layout].width}px`, "--booth-cmp-k": fit.scale } as CSSProperties}
      >
        <CompareDonePanel
          title={COMPARE_FILE}
          comparing={audio.comparing}
          onComparingChange={setComparing}
          playing={audio.playing}
          loading={audio.loading}
          onPlayToggle={toggle}
          onPlayIntent={warm}
          levels={audio.comparing ? DONE_LEVELS.before : DONE_LEVELS.after}
          played={played}
          playhead={at}
          onSeek={seek}
          reducedMotion={reducedMotion}
        />
        <CompareLanes reel={COMPARE_REEL} playhead={audio.playhead} heard={heard} scale={fit.scale} onSeek={seek} />
        <CompareHoldButton held={audio.comparing} onHeldChange={setComparing} />
      </div>

      <BoothHint hidden={touched || thumbnail}>Press play, then hold ⌥</BoothHint>
    </BoothRoot>
  );
}
