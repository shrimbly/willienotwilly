"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { BOOTH_FOCUS_RING } from "@/components/portfolio/booth/kit";
import { geistSerif } from "@/components/portfolio/booth/kit/fonts";
import { SIGNATURE_LETTERS } from "@/lib/booth/signature";
import { letterLabel } from "@/lib/booth/signature-demo";
import { cn } from "@/lib/utils";

// The "Booth" signature, large: the website's `.name` (studiovoice/site/index.html) and its
// pointer script. The site aims the focus with a mouse only; here a finger dragged across the
// name and the arrow keys aim it too. The CSS is signature-demo.css.

/** How long the reveal waits for Geist Serif before playing in the fallback face (the site's 800 ms). */
const FONT_WAIT_MS = 800;
/** A finger's tap leaves the focus where it landed for a moment before it fades. */
const TAP_LINGER_MS = 900;
/** Where the keyboard holds the focus on a letter, as a fraction of the line's height. */
const LETTER_Y = 0.56;

const FONT_QUERY = `56px ${geistSerif.style.fontFamily}`;

function subscribeFonts(onChange: () => void) {
  document.fonts?.addEventListener("loadingdone", onChange);
  return () => document.fonts?.removeEventListener("loadingdone", onChange);
}

type Aim = "pointer" | "touch" | "key";

export interface FocusNameProps {
  /** A file is over the popover: the whole name sharpens in the `sigOver` ink. */
  over: boolean;
  /** Plays the reveal each time it changes; 0 shows the name at rest. */
  reveal: number;
  /** Holds the name back, unseen, until its first reveal. */
  hidden: boolean;
  /** The pointer has come onto the name: hovering is how this demo is tried, so it counts. */
  onAim?: () => void;
  className?: string;
}

/**
 * The misty Geist Serif "Booth" as the site draws it, at the size of its tile, inside a patch
 * that aims the focus: the pointer (it appears where the pointer arrives, then glides after
 * it), a finger dragged sideways across it (a vertical swipe still scrolls the page), or the
 * arrow keys, letter by letter, as a slider over the five letters.
 */
export function FocusName({ over, reveal, hidden, onAim, className }: FocusNameProps) {
  const name = useRef<HTMLParagraphElement>(null);
  const rest = useRef<HTMLSpanElement>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const [arriving, setArriving] = useState(false);
  const [letter, setLetter] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const linger = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchId = useRef<number | null>(null);

  const fontReady = useSyncExternalStore(
    subscribeFonts,
    () => document.fonts?.check(FONT_QUERY) ?? true,
    () => false,
  );
  const waiting = hidden || (reveal > 0 && !fontReady && !timedOut);

  // Nothing shows until the name's face has loaded, so the letters don't change shape halfway;
  // after 800 ms it plays in whatever face there is.
  useEffect(() => {
    if (!reveal || fontReady) return;
    const timer = setTimeout(() => setTimedOut(true), FONT_WAIT_MS);
    void document.fonts?.load(FONT_QUERY).catch(() => setTimedOut(true));
    return () => clearTimeout(timer);
  }, [reveal, fontReady]);

  useEffect(
    () => () => {
      if (linger.current) clearTimeout(linger.current);
    },
    [],
  );

  /* ------------------------------------------------------------------ aiming */

  // The masks measure from the resting drawing's box, which reaches 0.25 em past the letters.
  const place = (x: number, y: number) => {
    name.current?.style.setProperty("--bsig-x", `${x}px`);
    name.current?.style.setProperty("--bsig-y", `${y}px`);
  };
  const aimAt = (clientX: number, clientY: number) => {
    const box = rest.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    // The name may be scaled by a parent: measure in its own px.
    const scale = rect.width / (box.offsetWidth || rect.width);
    place((clientX - rect.left) / scale, (clientY - rect.top) / scale);
  };
  const aimLetter = (index: number) => {
    const box = rest.current;
    const span = box?.children[index] as HTMLElement | undefined;
    if (!box || !span) return;
    // Layout offsets, so a letter still rising in the reveal is aimed where it will rest.
    place(span.offsetLeft - box.offsetLeft + span.offsetWidth / 2, span.offsetTop - box.offsetTop + span.offsetHeight * LETTER_Y);
  };
  // The focus appears in place, then glides from there.
  const arrive = (next: Aim) => {
    if (linger.current) clearTimeout(linger.current);
    linger.current = null;
    setArriving(aim === null);
    setAim(next);
    requestAnimationFrame(() => requestAnimationFrame(() => setArriving(false)));
  };
  const leave = () => {
    setAim(null);
    setArriving(false);
  };

  const onPointerEnter = (event: ReactPointerEvent) => {
    if (event.pointerType === "touch" || aim === "touch") return;
    aimAt(event.clientX, event.clientY);
    arrive("pointer");
    onAim?.();
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (event.pointerType === "touch" ? event.pointerId === touchId.current : aim === "pointer") aimAt(event.clientX, event.clientY);
  };
  const onPointerLeave = (event: ReactPointerEvent) => {
    if (event.pointerType !== "touch" && aim === "pointer") leave();
  };
  // A finger brings the focus where it lands and drags it sideways; once the page takes a
  // vertical swipe the browser cancels the pointer and the focus fades.
  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    touchId.current = event.pointerId;
    aimAt(event.clientX, event.clientY);
    arrive("touch");
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    if (event.pointerId !== touchId.current) return;
    touchId.current = null;
    linger.current = setTimeout(() => {
      linger.current = null;
      leave();
    }, TAP_LINGER_MS);
  };
  const onPointerCancel = (event: ReactPointerEvent) => {
    if (event.pointerId !== touchId.current) return;
    touchId.current = null;
    leave();
  };

  // Only a keyboard's focus aims at a letter: a click or a tap is already aiming.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.matches(":focus-visible")) return;
    aimLetter(letter);
    arrive("key");
  };
  const onBlur = () => {
    if (aim === "key") leave();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const last = SIGNATURE_LETTERS.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? letter + 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? letter - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const clamped = Math.min(last, Math.max(0, next));
    setLetter(clamped);
    aimLetter(clamped);
    if (aim !== "key") arrive("key");
  };

  const letters = SIGNATURE_LETTERS.map((glyph, i) => (
    <span key={`${reveal}-${i}`} style={{ "--i": i } as CSSProperties}>
      {glyph}
    </span>
  ));

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Focus on the letters of Booth"
      aria-valuemin={1}
      aria-valuemax={SIGNATURE_LETTERS.length}
      aria-valuenow={letter + 1}
      aria-valuetext={letterLabel(letter)}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={cn("bsig-hit bsig-size", BOOTH_FOCUS_RING, className)}
    >
      <p
        ref={name}
        aria-hidden
        className="bsig-name"
        data-pointing={aim !== null || undefined}
        data-arriving={arriving || undefined}
        data-over={over || undefined}
        data-reveal={(reveal > 0 && !waiting) || undefined}
        data-waiting={waiting || undefined}
      >
        {/* The letters are keyed on the reveal, so replaying it restarts their animations while
            the drawings, and the clouds drifting through them, carry on. */}
        <span ref={rest} className="bsig-rest">
          {letters}
        </span>
        <span className="bsig-mist">{letters}</span>
        <span className="bsig-focus">{letters}</span>
        <span key={`haze-${reveal}`} className="bsig-haze" />
      </p>
    </div>
  );
}
