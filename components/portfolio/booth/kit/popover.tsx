"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
  type HTMLMotionProps,
  type MotionValue,
  type Transition,
} from "motion/react";

import { CURVES, PANEL, POPOVER_MOTION, bezierEase, springEase } from "@/lib/booth/motion";
import { POPOVER, frameStyle, type BoothScreen, type FrameStyle } from "@/lib/booth/popover-logic";
import { cn } from "@/lib/utils";

// The popover, ported from studiovoice/app/Sources/Booth/UI/PopoverRootView.swift (the glass
// panel round the frame that holds the signature, the corner button and the current screen),
// Shell/PopoverPanel.swift (how the panel opens and closes) and UI/PopoverMotion.swift (how
// screens trade places and the frame follows their height).

const inOut = bezierEase(CURVES.inOut);
const cssEase = bezierEase(CURVES.cssEase);
const easeOut = bezierEase(CURVES.easeOut);

/** SwiftUI's `.spring(duration: 0.45, bounce: 0)` for the frame's height, played out exactly. */
const HEIGHT_SECONDS = 0.7;
const heightEase = springEase(POPOVER_MOTION.heightSpring, 0, HEIGHT_SECONDS);

/* ------------------------------------------------------------------------------- the panel */

export interface BoothPopoverProps {
  open: boolean;
  /**
   * Where across the glass (pt from its left, or any CSS length) the icon sits: the panel
   * grows out of this point on its top edge. Defaults to the middle.
   */
  pivotX?: number | string;
  /** The screen shown: while a file is in the booth the bar sits 4 pt from the glass, not 6. */
  screen: BoothScreen;
  /** Snaps instead of springing and fades only, as the app does under Reduce Motion. */
  reducedMotion?: boolean;
  /** "glass" (the live panel: tint, blur, the site card's shadow) or "flat" (the app's snapshots). */
  chrome?: "glass" | "flat";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Names the panel for assistive tech (it is a dialog hanging from the icon). */
  label?: string;
  id?: string;
}

/**
 * The 320 pt glass panel, radius 14 with a 0.5 pt hairline, round a BoothFrame. Opening, it
 * fades in over 150 ms while it drops 6 pt and grows from 95% on the panel's spring (0.32 s,
 * bounce 0.12) about `pivotX` on its top edge; closing, it lifts 3 pt and shrinks to 98% in
 * 160 ms under a 140 ms fade, both ease-out; reopening part way starts from where it is.
 * Closed, it is hidden and inert. Position it yourself (absolute, under the menu bar icon).
 */
export function BoothPopover({
  open,
  pivotX = POPOVER.width / 2,
  screen,
  reducedMotion = false,
  chrome = "glass",
  className,
  style,
  children,
  label = "Booth",
  id,
}: BoothPopoverProps) {
  const opacity = useMotionValue(open ? 1 : 0);
  const scale = useMotionValue(1);
  const y = useMotionValue(0);
  const inset = useMotionValue<number>(screen === "working" ? POPOVER.workingPanelInset : POPOVER.panelInset);
  const visibility = useTransform(opacity, (o) => (o <= 0 ? "hidden" : "visible"));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controls: AnimationPlaybackControls[] = [];
    if (reducedMotion) {
      scale.set(1);
      y.set(0);
      controls.push(animate(opacity, open ? 1 : 0, { duration: open ? PANEL.openFade : PANEL.closeFade, ease: cssEase }));
    } else if (open) {
      // From fully closed, or (reopened mid-close) from what is on screen.
      if (opacity.get() <= 0) {
        scale.set(PANEL.openScale);
        y.set(-PANEL.lift);
      }
      const spring = { duration: PANEL.springSeconds, ease: springEase(PANEL.spring.perceptualDuration, PANEL.spring.bounce, PANEL.springSeconds) };
      controls.push(
        animate(opacity, 1, { duration: PANEL.openFade, ease: cssEase }),
        animate(scale, 1, spring),
        animate(y, 0, spring),
      );
    } else {
      controls.push(
        animate(opacity, 0, { duration: PANEL.closeFade, ease: easeOut }),
        animate(scale, PANEL.closeScale, { duration: PANEL.closePop, ease: easeOut }),
        animate(y, -PANEL.closeLift, { duration: PANEL.closePop, ease: easeOut }),
      );
    }
    return () => controls.forEach((c) => c.stop());
  }, [open, reducedMotion, opacity, scale, y]);

  // The glass comes 2 pt closer to the bar while a file is in the booth, with the screen change.
  useEffect(() => {
    const target = screen === "working" ? POPOVER.workingPanelInset : POPOVER.panelInset;
    if (reducedMotion || inset.get() === target) {
      inset.set(target);
      return;
    }
    const c = animate(inset, target, { duration: HEIGHT_SECONDS, ease: heightEase, delay: POPOVER_MOTION.screenChangeDelay });
    return () => c.stop();
  }, [screen, reducedMotion, inset]);

  // The border sits outside the padding in the mockup's border-box: 6.5 pt is 6 + 0.5.
  const padding = useTransform(inset, (v) => v - POPOVER.borderWidth);

  return (
    <motion.div
      id={id}
      role="dialog"
      aria-label={label}
      aria-hidden={!open || undefined}
      inert={!open}
      data-chrome={chrome === "flat" ? "flat" : undefined}
      className={cn("booth-glass w-80", className)}
      style={{
        ...style,
        opacity,
        scale,
        y,
        padding,
        visibility,
        transformOrigin: `${typeof pivotX === "number" ? `${pivotX}px` : pivotX} 0px`,
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------------------- the frame */

/** What the keyboard can land on in a screen. */
const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), [tabindex="0"]';

/** Each screen's room inside the frame, border included (PopoverRootView.swift `contentInsets`). */
function screenPadding(screen: BoothScreen): string {
  if (screen === "working") return "0px";
  const b = POPOVER.frameBorder;
  const { top, side, bottom } = POPOVER.contentInsets;
  return `${top + b}px ${side + b}px ${bottom[screen] + b}px`;
}

const swapTransition = (reducedMotion: boolean, delay: number): { animate: Transition; exit: Transition } =>
  reducedMotion
    ? {
        animate: { duration: POPOVER_MOTION.reducedCrossfade, ease: cssEase },
        exit: { duration: POPOVER_MOTION.reducedCrossfade, ease: cssEase },
      }
    : {
        animate: {
          opacity: { duration: POPOVER_MOTION.swapInFade, delay, ease: inOut },
          filter: { duration: POPOVER_MOTION.swapInFocus, delay, ease: inOut },
          scale: { duration: POPOVER_MOTION.swapInFocus, delay, ease: inOut },
        },
        exit: {
          filter: { duration: POPOVER_MOTION.swapOutSoften, ease: inOut },
          opacity: { duration: POPOVER_MOTION.swapOutFade, delay: POPOVER_MOTION.swapOutFadeDelay, ease: inOut },
        },
      };

export interface BoothSwapProps {
  /** Changing it trades the content for the new children. */
  swapKey: string;
  children: ReactNode;
  reducedMotion?: boolean;
  /** How soft content goes as it leaves (4 for screens, 3 for the idle prompt, 2 for the corner button). */
  blur?: number;
  /** Arriving content settles from this scale, about its top (0.98 for screens). */
  scale?: number;
  /** When arriving content starts: 0.07 s in place of content, 0 where nothing leaves, 0.26 s from the bottom edge. */
  delay?: number;
  /**
   * The edges leaving content keeps to as it is laid over: those its parent is anchored by. A
   * parent placed by its bottom or right edge shrinks towards that edge as the content leaves,
   * so the leaving content must hold on to it too, or it drops out of place.
   */
  anchorX?: "left" | "right";
  anchorY?: "top" | "bottom";
  className?: string;
  style?: CSSProperties;
}

/**
 * One content dissolving into another (PopoverMotion.swift `AnyTransition.swap`), never two
 * sharp states on top of each other: what leaves softens at once and fades from 50 ms; what
 * arrives fades in over 280 ms and focuses over 320 ms from 1.5× the blur. The leaving
 * content stops taking up room at once (it is laid over, at its `anchorX` and `anchorY`
 * edges), so a frame round it heads straight for the new height. It takes no more presses
 * and is marked `data-booth-leaving` (BoothFrame moves the keyboard on from it). Under
 * reduced motion it is a 150 ms cross-fade.
 */
export function BoothSwap({
  swapKey,
  children,
  reducedMotion = false,
  blur = 4,
  scale = 1,
  delay = POPOVER_MOTION.swapInDelay,
  anchorX = "left",
  anchorY = "top",
  className,
  style,
}: BoothSwapProps) {
  return (
    <AnimatePresence mode="popLayout" initial={false} anchorX={anchorX} anchorY={anchorY}>
      <SwapItem key={swapKey} className={className} style={{ transformOrigin: "50% 0%", ...style }} {...swapMotion({ reducedMotion, blur, scale, delay })}>
        {children}
      </SwapItem>
    </AnimatePresence>
  );
}

/** One side of a swap: once it is leaving it is marked, and lets presses through to what arrives. */
function SwapItem({ ref, className, ...props }: HTMLMotionProps<"div"> & { ref?: Ref<HTMLDivElement> }) {
  const present = useIsPresent();
  return (
    <motion.div
      ref={ref}
      data-booth-leaving={present ? undefined : ""}
      className={cn(className, !present && "pointer-events-none")}
      {...props}
    />
  );
}

/**
 * The swap's `initial`, `animate` and `exit` for a motion element of your own, for content
 * that comes and goes rather than trading places (a section opening: `delay: 0`, `scale:
 * 0.98`). Put it in an `<AnimatePresence mode="popLayout" initial={false}>` inside a
 * positioned parent, so leaving content stops taking up room at once.
 */
export function swapMotion({
  reducedMotion = false,
  blur = 4,
  scale = 1,
  delay = POPOVER_MOTION.swapInDelay,
}: { reducedMotion?: boolean; blur?: number; scale?: number; delay?: number } = {}) {
  const t = swapTransition(reducedMotion, delay);
  return {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, filter: `blur(${blur * POPOVER_MOTION.swapInBlurScale}px)`, scale },
    animate: { opacity: 1, filter: "blur(0px)", scale: 1, transition: t.animate },
    exit: reducedMotion ? { opacity: 0, transition: t.exit } : { opacity: 0, filter: `blur(${blur}px)`, transition: t.exit },
  };
}

export interface BoothFrameProps {
  screen: BoothScreen;
  /** A file is over the popover: the solid outline on a faint fill. */
  dropHover?: boolean;
  /** The current screen's content (it is swapped when `screen` changes). */
  children: ReactNode;
  /** Drawn at the frame's bottom left (16 pt in, 2 pt up) on the drop zone: a BoothSignature. */
  signature?: ReactNode;
  /** The 24 pt button in the top right corner, 4 pt in (the gear on the drop zone). */
  corner?: ReactNode;
  reducedMotion?: boolean;
  className?: string;
}

/**
 * The rounded frame inside the panel: radius 10 with a 1.5 pt border that is the drop zone's
 * dots, a solid line under a file (the dots stretch and join over 280 ms) or nothing. Its height
 * follows the screen on a 0.45 s spring, 90 ms late on a screen change, at once for a section
 * opening; the screens trade places through BoothSwap. On Working the bar fills it edge to edge.
 */
export function BoothFrame({ screen, dropHover = false, children, signature, corner, reducedMotion = false, className }: BoothFrameProps) {
  const style = frameStyle(screen, dropHover);
  const content = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  const lastScreen = useRef(screen);

  // A control that leaves with its screen (Cancel as the job finishes, Done going back to the
  // drop zone, "or choose a file" as a job starts) hands the keyboard to the screen taking its
  // place, rather than dropping it to the page: to the control that screen marks
  // `data-booth-autofocus`, else its first.
  useLayoutEffect(() => {
    const el = content.current;
    const focused = document.activeElement;
    if (!el || !(focused instanceof HTMLElement) || !el.contains(focused) || !focused.closest("[data-booth-leaving]")) return;
    const arriving = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => !node.closest("[data-booth-leaving]"));
    (arriving.find((node) => node.hasAttribute("data-booth-autofocus")) ?? arriving[0])?.focus({ preventScroll: true });
  }, [screen]);

  // The frame's height follows its content: measured, then sprung to.
  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    let controls: AnimationPlaybackControls | null = null;
    let target = -1;
    const observer = new ResizeObserver(() => {
      const next = el.offsetHeight;
      const now = height.get();
      if (now === "auto" || reducedMotion) {
        controls?.stop();
        height.set(next);
        target = next;
        lastScreen.current = el.dataset.screen as BoothScreen;
        return;
      }
      // Only a new height restarts the spring; the width moving (the glass's inset) must not.
      if (next === target) return;
      target = next;
      const changed = el.dataset.screen !== lastScreen.current;
      lastScreen.current = el.dataset.screen as BoothScreen;
      controls?.stop();
      controls = animate(height as MotionValue<number>, next, {
        duration: HEIGHT_SECONDS,
        ease: heightEase,
        // A screen change, or a section closing, waits for leaving content to go soft; a section opening grows at once.
        delay: changed || next < (now as number) ? POPOVER_MOTION.screenChangeDelay : 0,
        onComplete: () => {
          controls = null;
        },
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [height, reducedMotion]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] transition-[background-color] duration-200 ease-(--booth-ease-out) motion-reduce:transition-none",
        style === "dropTarget" ? "bg-(color:--booth-fill)" : "bg-transparent",
        className,
      )}
    >
      <motion.div style={{ height }}>
        <div ref={content} data-screen={screen} className="relative">
          <BoothSwap swapKey={screen} reducedMotion={reducedMotion} scale={0.98}>
            <div
              style={{ padding: screenPadding(screen), minHeight: screen === "idle" ? POPOVER.idleMinHeight : undefined }}
            >
              {children}
            </div>
          </BoothSwap>
        </div>
      </motion.div>
      <div
        className="pointer-events-none absolute"
        style={{ left: POPOVER.signature.left + POPOVER.frameBorder, bottom: POPOVER.signature.bottom + POPOVER.frameBorder }}
      >
        <BoothSwap swapKey={signature ? "signature" : "none"} reducedMotion={reducedMotion} delay={POPOVER_MOTION.swapLastDelay} anchorY="bottom">
          <div className="pointer-events-auto">{signature}</div>
        </BoothSwap>
      </div>
      <div className="absolute" style={{ top: 4 + POPOVER.frameBorder, right: 4 + POPOVER.frameBorder }}>
        <BoothSwap swapKey={corner ? `corner-${screen}` : "none"} reducedMotion={reducedMotion} blur={2} anchorX="right">
          <div>{corner}</div>
        </BoothSwap>
      </div>
      <BoothFrameBorder style={style} reducedMotion={reducedMotion} />
    </div>
  );
}

/**
 * The frame's 1.5 pt border: CSS `dotted` (round dots on a 3 pt pitch, adjusted so they close
 * evenly round the corners), a solid line under a dragged file, or nothing. Between dots and
 * line the dots stretch into dashes and close up, so the outline visibly joins as a file
 * arrives and comes apart as it leaves (FrameBorder in PopoverRootView.swift).
 */
export function BoothFrameBorder({ style, reducedMotion = false }: { style: FrameStyle; reducedMotion?: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const target = style === "dropTarget" ? 1 : 0;
  const [solidness, setSolidness] = useState(target);
  const current = useRef(target);

  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize((s) => (s.width === box.width && s.height === box.height ? s : { width: box.width, height: box.height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || current.current === target) {
      current.current = target;
      return;
    }
    const controls = animate(current.current, target, {
      duration: POPOVER_MOTION.outlineJoin,
      ease: cssEase,
      onUpdate: (v) => {
        current.current = v;
        setSolidness(v);
      },
    });
    return () => controls.stop();
  }, [target, reducedMotion]);

  // Under reduced motion the outline snaps; otherwise it joins on the animated value.
  const shown = reducedMotion ? target : solidness;
  const line = POPOVER.frameBorder;
  const w = Math.max(0, size.width - line);
  const h = Math.max(0, size.height - line);
  const r = POPOVER.frameRadius - line / 2;
  const perimeter = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
  let dash: string | undefined;
  if (shown < 0.999 && perimeter > 0) {
    const pitch = perimeter / Math.max(1, Math.round(perimeter / POPOVER.dotPitch));
    // Zero-length dashes with round caps draw dots one line-width across; the gaps close once
    // the dashes are a line-width short of the pitch.
    const d = (pitch - line) * Math.max(0, shown);
    dash = `${d} ${pitch - d}`;
  }
  return (
    <svg
      ref={svg}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full overflow-visible transition-[opacity,stroke] duration-[280ms] ease-(--booth-ease) motion-reduce:transition-none"
      style={{ opacity: style === "none" ? 0 : 1, stroke: style === "dropTarget" ? "var(--booth-text)" : "var(--booth-dash)" }}
    >
      {w > 0 && h > 0 && (
        <rect
          x={line / 2}
          y={line / 2}
          width={w}
          height={h}
          rx={r}
          fill="none"
          strokeWidth={line}
          strokeLinecap="round"
          strokeDasharray={dash}
        />
      )}
    </svg>
  );
}
