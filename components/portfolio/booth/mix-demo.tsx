"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from "react";

import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";
import { MIX_STANDARD, WAVEFORM, percent, playedBars, sameMix, syntheticBars, waveformLevels, type Mix } from "@/lib/booth/mix";
import {
  DEMO_CLIP_SECONDS,
  DEMO_SAVE_SECONDS,
  MIX_DEMO_FILE,
  MIX_DEMO_OUTPUT,
  MIX_DEMO_PLAYHEAD,
  scriptedMix,
} from "@/lib/booth/mix-demo";

import { BoothFrame, BoothHint, BoothPopover, BoothRoot, useOptionKeyHold, type BoothTheme } from "./kit";
import { AppearanceSwitch } from "./mix/appearance-switch";
import { MixDoneScreen } from "./mix/mix-done-screen";
import { RemixCommand } from "./mix/remix-command";
import "./mix/mix-demo.css";

// "The mix": Booth's Done screen with Mix open, as the app's `doneMix` fixture draws it
// (studiovoice/app/Sources/Booth/UI/Screens/DoneScreen.swift, docs/images/booth-light.png and
// booth-dark.png), live. Speech, Background and Music reshape the 56 bars through Mix.swift's
// curves over the synthetic bars the app's demo mode draws; Revert and Save appear once the mix
// differs from the saved one, and Save takes the demo engine's 1.2 s. Above it, Booth's own
// segmented control switches between Theme.swift's light and dark palettes; under it, the command
// Save runs. Left alone on screen, one slider at a time moves away and back.

/** A voice recording with music under it: all three sliders, over `StemsManifest.Bars.synthetic`. */
const BARS = syntheticBars(true);

/** The stage in the app's points: the switch, the popover with Mix open (231 pt), the command. */
const STAGE = { width: 320, switchHeight: 26, gapAbove: 20, popover: 231, gapBelow: 16, command: 34 } as const;
const STAGE_HEIGHT = STAGE.switchHeight + STAGE.gapAbove + STAGE.popover + STAGE.gapBelow + STAGE.command;
/** The stage is scaled to the tile, no larger than this, with this much room at the sides. */
const MAX_SCALE = 1.6;
const SIDE_ROOM = 16;

export function BoothMixDemo() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const { active, inView, reducedMotion, pageVisible } = useDemoActive(root);
  const thumbnail = useDemoThumbnail();

  const [theme, setTheme] = useState<BoothTheme>("light");
  const [mixOpen, setMixOpen] = useState(true);
  const [mix, setMix] = useState<Mix>(MIX_STANDARD);
  const [saved, setSaved] = useState<Mix>(MIX_STANDARD);
  const [saving, setSaving] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(MIX_DEMO_PLAYHEAD);
  const [touched, setTouched] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [status, setStatus] = useState("");

  const touch = useCallback(() => setTouched(true), []);
  const dirty = !sameMix(mix, saved);

  /* ------------------------------------------------------------------- fitting the tile */

  // Laid out in points and scaled as one piece; written straight to the stage, so the first paint is already the right size.
  useLayoutEffect(() => {
    const el = root.current;
    const box = stage.current;
    if (!el || !box) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const roomY = Math.max(20, Math.min(56, h * 0.07));
      const k = Math.min(MAX_SCALE, (w - 2 * SIDE_ROOM) / STAGE.width, (h - 2 * roomY) / STAGE_HEIGHT);
      box.style.setProperty("--booth-mix-k", String(Math.max(0.5, k)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* --------------------------------------------------------------------- the idle script */

  // On screen and untouched, one slider at a time glides away from the saved mix and back. Its clock
  // only runs while the tile is active, and the first touch stops it for good, leaving the sliders
  // wherever they are for the visitor to take over.
  const scriptClock = useRef(0);
  const scripted = active && !touched;
  useEffect(() => {
    if (!scripted) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      scriptClock.current += Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = scriptedMix(scriptClock.current, MIX_STANDARD);
      setMix((m) => (sameMix(m, next) ? m : next));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [scripted]);

  /* ------------------------------------------------------------------------- the player */

  // `booth --demo` plays nothing: the playhead crosses a 12 s clip and stops back at the start.
  const head = useRef(MIX_DEMO_PLAYHEAD);
  useEffect(() => {
    if (!playing || !inView || !pageVisible) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const next = head.current + Math.min(0.1, (now - last) / 1000) / DEMO_CLIP_SECONDS;
      last = now;
      if (next >= 1) {
        head.current = 0;
        setPlayhead(0);
        setPlaying(false);
        return;
      }
      head.current = next;
      // Drawn again only when a bar changes colour or the percent read out changes.
      setPlayhead((p) =>
        percent(p) === percent(next) && playedBars(p, WAVEFORM.count) === playedBars(next, WAVEFORM.count) ? p : next,
      );
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, inView, pageVisible]);

  const seek = (fraction: number) => {
    head.current = fraction;
    setPlayhead(fraction);
  };
  const togglePlay = () => {
    // FakePreviewPlayer.play: from the end, it starts again from the beginning.
    if (!playing && head.current >= 1) seek(0);
    setPlaying(!playing);
    setStatus(playing ? "Paused" : "Playing without sound: this demo moves the playhead only");
  };

  const compare = useCallback(
    (on: boolean) => {
      touch();
      setComparing(on);
      setStatus(on ? "Showing the original recording's waveform" : "Showing the mix");
    },
    [touch],
  );
  useOptionKeyHold(!thumbnail && (hovered || focusWithin), compare);

  /* ----------------------------------------------------------------------------- the mix */

  const latestMix = useRef(mix);
  useEffect(() => {
    latestMix.current = mix;
  });

  const focusMixChip = () => root.current?.querySelector<HTMLButtonElement>("[data-mix-chip] button")?.focus();
  /** Revert and Save are about to go: a keyboard on them moves to Mix, the control before them. */
  const keepFocus = () => {
    if (root.current?.querySelector("[data-mix-actions]")?.contains(document.activeElement)) focusMixChip();
  };

  const changeMix = (next: Mix) => {
    touch();
    if (!dirty && !sameMix(next, saved)) setStatus("The mix has changed: Revert and Save are beside Mix");
    setMix(next);
  };

  const revert = () => {
    keepFocus();
    setMix(saved);
    setStatus("Back to the saved mix");
  };

  // Save re-renders from the kept stems (`booth remix`); the demo engine answers after 1.2 s.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );
  const save = () => {
    if (saving || !dirty) return;
    const target = mix;
    setSaving(true);
    setStatus("Saving the mix");
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      // AppModel.mixDidSave: the file now has `target`; sliders moved since stay where they are.
      if (sameMix(latestMix.current, target)) keepFocus();
      setSaved(target);
      setSaving(false);
      setStatus(`Saved: ${MIX_DEMO_OUTPUT} has the new mix`);
    }, DEMO_SAVE_SECONDS * 1000);
  };

  const changeTheme = (next: BoothTheme) => {
    touch();
    setTheme(next);
    setStatus(next === "dark" ? "Dark appearance" : "Light appearance");
  };

  const levels = useMemo(() => waveformLevels(BARS, mix, { comparing }), [mix, comparing]);

  /* ----------------------------------------------------------------------------- render */

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    setFocusWithin(true);
    if ((event.target as Element).matches(":focus-visible")) touch();
  };

  return (
    <BoothRoot
      ref={root}
      theme={theme}
      paused={!active && !reducedMotion}
      role="group"
      aria-label="Booth's Done screen with Mix open: three sliders reshape the waveform, in Booth's light or dark appearance"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDownCapture={(event) => {
        // A finger counts when it lifts, so a swipe past the tile to scroll the page never does.
        if (event.pointerType !== "touch") touch();
      }}
      onPointerUpCapture={(event) => {
        if (event.pointerType === "touch") touch();
      }}
      onKeyDownCapture={touch}
      onFocusCapture={onFocus}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      <div
        className="booth-mix-scene absolute inset-0"
        data-appearance={theme}
        data-instant={reducedMotion || undefined}
        style={{ "--booth-mix-stage-h": `${STAGE_HEIGHT}px` } as CSSProperties}
      >
        <p className="sr-only">
          Booth&apos;s Done screen for {MIX_DEMO_FILE}, with Mix open. Drag the Speech, Background and Music sliders, or use the arrow
          keys on them, and the waveform&apos;s 56 bars reshape. Once the mix differs from the saved one, Revert and Save take the place
          of Open and Done. Light and Dark switch Booth&apos;s appearance. Hold ⌥, or press and hold the compare line, to see the
          original&apos;s waveform. Play moves the playhead without sound, as Booth&apos;s demo mode does.
        </p>
        <p className="sr-only" aria-live="polite">
          {status}
        </p>

        <div ref={stage} className="booth-mix-stage">
          <AppearanceSwitch className="mx-auto" value={theme} onChange={changeTheme} />
          <BoothPopover open screen="done" reducedMotion={reducedMotion} className="mt-5" label="Booth">
            <BoothFrame screen="done" reducedMotion={reducedMotion}>
              <MixDoneScreen
                title={MIX_DEMO_FILE}
                comparing={comparing}
                onComparingChange={compare}
                playing={playing}
                onPlayToggle={togglePlay}
                levels={levels}
                played={playedBars(playhead, WAVEFORM.count)}
                playhead={playhead}
                onSeek={seek}
                mixOpen={mixOpen}
                onMixToggle={() => setMixOpen((open) => !open)}
                mix={mix}
                onMixChange={changeMix}
                dirty={dirty}
                saving={saving}
                onRevert={revert}
                onSave={save}
                reducedMotion={reducedMotion}
              />
            </BoothFrame>
          </BoothPopover>
          <RemixCommand className="mt-4" mix={mix} saved={saved} />
        </div>

        <BoothHint hidden={touched || thumbnail}>Drag a slider</BoothHint>
      </div>
    </BoothRoot>
  );
}
