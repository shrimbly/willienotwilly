"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { SIGNATURE_LETTERS, SIGNATURE_SIZE, signatureWaveStyles } from "@/lib/booth/signature";
import { cn } from "@/lib/utils";

import { geistSerif } from "./fonts";

// The "Booth" signature: the website's `.name` (studiovoice/site/index.html), which ports the
// app's SignatureView.swift to CSS, lifted with its JS. Three drawings of the five letters (at
// rest, misty, in focus) are masked by two drifting fields of cloud and a soft patch on the
// pointer; the CSS is in booth.css, in em of the site's 56 px, so `size` scales all of it.

/** How long the reveal waits for Geist Serif before playing in the fallback face (the site's 800 ms). */
const FONT_WAIT_MS = 800;

function fontQuery(size: number) {
  return `${size}px ${geistSerif.style.fontFamily}`;
}

function subscribeFonts(onChange: () => void) {
  document.fonts?.addEventListener("loadingdone", onChange);
  return () => document.fonts?.removeEventListener("loadingdone", onChange);
}

export interface BoothSignatureProps {
  /** The font size in px: the app's 44 pt by default; the site draws it at 56. */
  size?: number;
  /** Line height in em: the site's 0.8 by default; the app lays each letter on a 1 em line. */
  leading?: number;
  /** A file is over the popover: the whole name sharpens in the `sigOver` ink (200 ms ink, 260 ms focus). */
  over?: boolean;
  /**
   * Plays the reveal (the name coming forward through fog) when it first shows, and again
   * each time this changes: pass a counter or the time the popover opened. Falsy: no reveal.
   */
  reveal?: number | boolean;
  /** When the first letter starts to rise, in ms (default 130, the site's; the popover uses 30). */
  revealAt?: number;
  /** The pointer brings the letters under it into focus (default true). */
  pointerFocus?: boolean;
  /**
   * Where the focus rests while no pointer is on the name, as fractions of the letters' box
   * (the link-preview card holds it at about { x: 0.34, y: 0.58 }, "as when the pointer rests
   * on it"). The pointer takes it from there and it glides back when the pointer leaves.
   */
  restingFocus?: { x: number; y: number } | null;
  /**
   * The Working crest: a wave of focus across the letters every 4.2 s, the resting blur easing
   * off with `progress` (0…1). Script-driven; runs while `running`.
   */
  wave?: { progress: number } | null;
  /** Lets the crest move (pass `active`). The clouds and the reveal are CSS, held by BoothRoot's `paused`. */
  running?: boolean;
  /** Spoken name (default "Booth"). */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The misty Geist Serif "Booth", drawn as the app and the site draw it. At rest it sits
 * slightly out of focus with soft clouds of mist drifting through it (clouds off under reduced
 * motion); the pointer brings the letters under it into focus; `over` sharpens it all; `reveal`
 * brings it forward through fog, letter by letter, under a haze of the colour behind it
 * (`--booth-haze`, set by the popover's glass). Renders a <p> whose box is the letters'.
 */
export function BoothSignature({
  size = SIGNATURE_SIZE.app,
  leading = 0.8,
  over = false,
  reveal = false,
  revealAt,
  pointerFocus = true,
  restingFocus = null,
  wave = null,
  running = true,
  label = "Booth",
  className,
  style,
}: BoothSignatureProps) {
  const root = useRef<HTMLParagraphElement>(null);
  const drawing = useRef<HTMLSpanElement>(null);
  const [pointing, setPointing] = useState(false);
  // A resting focus is placed without gliding there from the corner.
  const [arriving, setArriving] = useState(Boolean(restingFocus));
  const [timedOut, setTimedOut] = useState(false);
  const fontReady = useSyncExternalStore(
    subscribeFonts,
    () => document.fonts?.check(fontQuery(size)) ?? true,
    () => false,
  );
  const waiting = Boolean(reveal) && !fontReady && !timedOut;

  // Nothing shows until the name's face has loaded, so the letters don't change shape halfway;
  // after 800 ms it plays in whatever face there is.
  useEffect(() => {
    if (!reveal || fontReady) return;
    const timer = setTimeout(() => setTimedOut(true), FONT_WAIT_MS);
    void document.fonts?.load(fontQuery(size)).catch(() => setTimedOut(true));
    return () => clearTimeout(timer);
  }, [reveal, fontReady, size]);

  // The crest's per-letter blur and ink, written straight to the letters (no re-render per frame).
  const progress = wave?.progress ?? 0;
  const waving = wave !== null;
  useEffect(() => {
    const letters = drawing.current?.children;
    if (!waving || !letters) return;
    const paint = (ms: number) => {
      signatureWaveStyles(ms, { progress, working: true, over }).forEach((letter, i) => {
        const el = letters[i] as HTMLElement | undefined;
        el?.style.setProperty("--booth-letter-blur", `${(letter.blur / SIGNATURE_SIZE.app).toFixed(4)}em`);
        el?.style.setProperty("--booth-letter-alpha", letter.alpha.toFixed(3));
      });
    };
    if (!running) {
      paint(1300); // SignatureView.snapshotMilliseconds: the crest held where the app's snapshots hold it.
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      paint(now - start);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [waving, running, progress, over]);

  // A resting focus: placed in the letters' own px, so it holds however the name is scaled.
  const restX = restingFocus?.x;
  const restY = restingFocus?.y;
  useLayoutEffect(() => {
    const el = root.current;
    const box = drawing.current;
    if (!el || !box || restX === undefined || restY === undefined || pointing) return;
    // The drawing reaches 0.25 em past the letters on every side for its blur.
    const pad = parseFloat(getComputedStyle(box).paddingLeft) || 0;
    el.style.setProperty("--booth-x", `${pad + restX * (box.offsetWidth - 2 * pad)}px`);
    el.style.setProperty("--booth-y", `${pad + restY * (box.offsetHeight - 2 * pad)}px`);
    const frame = requestAnimationFrame(() => setArriving(false));
    return () => cancelAnimationFrame(frame);
  }, [restX, restY, pointing]);

  // The site's pointer handling: the focus appears where the pointer arrives, then glides after it.
  const aim = (event: ReactPointerEvent) => {
    const box = drawing.current?.getBoundingClientRect();
    const el = root.current;
    if (!box || !el) return;
    // The drawings may be scaled by a parent: measure in the name's own px.
    const scale = box.width / (drawing.current?.offsetWidth || box.width);
    el.style.setProperty("--booth-x", `${(event.clientX - box.left) / scale}px`);
    el.style.setProperty("--booth-y", `${(event.clientY - box.top) / scale}px`);
  };
  const onPointerEnter = (event: ReactPointerEvent) => {
    if (!pointerFocus || event.pointerType === "touch") return;
    aim(event);
    // From a resting focus the patch glides to the pointer; from none it appears there.
    setArriving(!restingFocus);
    setPointing(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setArriving(false)));
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (pointerFocus && event.pointerType !== "touch") aim(event);
  };
  const onPointerLeave = () => {
    setPointing(false);
    setArriving(false);
  };

  const revealKey = typeof reveal === "number" ? reveal : reveal ? 1 : 0;
  const letters = (
    <>
      {SIGNATURE_LETTERS.map((letter, i) => (
        <span key={i} style={{ "--i": i } as CSSProperties}>
          {letter}
        </span>
      ))}
    </>
  );

  return (
    <p
      ref={root}
      className={cn("booth-name", className)}
      data-pointing={pointing || restingFocus ? true : undefined}
      data-arriving={arriving || undefined}
      data-over={over || undefined}
      data-wave={waving || undefined}
      data-reveal={(Boolean(reveal) && !waiting) || undefined}
      data-waiting={waiting || undefined}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={
        {
          fontSize: size,
          "--booth-name-leading": leading,
          ...(revealAt !== undefined && { "--booth-reveal-at": `${revealAt}ms` }),
          ...style,
        } as CSSProperties
      }
    >
      <span className="sr-only">{label}</span>
      {/* Keyed on the reveal, so a new opening replays the letters' CSS animations. */}
      <span key={`rest-${revealKey}`} ref={drawing} className="booth-name-rest" aria-hidden>
        {letters}
      </span>
      <span key={`mist-${revealKey}`} className="booth-name-mist" aria-hidden>
        {letters}
      </span>
      <span key={`focus-${revealKey}`} className="booth-name-focus" aria-hidden>
        {letters}
      </span>
      <span key={`haze-${revealKey}`} className="booth-name-haze" aria-hidden />
    </p>
  );
}
