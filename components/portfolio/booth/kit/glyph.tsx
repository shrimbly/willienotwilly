import type { ComponentPropsWithRef, CSSProperties } from "react";

import { GLYPH, type GlyphMode } from "@/lib/booth/popover-logic";
import { cn } from "@/lib/utils";

// Booth's menu bar glyph, ported from studiovoice/app/Sources/Booth/Shell/GlyphRenderer.swift
// (Glyph.dc.html, brand "booth"): a rounded booth frame with a lamp, in an 18-unit box, y down,
// painted in the renderer's order (halo, frame fill, frame, lamp, attention dot). The status
// item's button is StatusItemController.swift's, drawn as GlyphStates.dc.html draws it.

const { frame, lamp, ring, attentionDot } = GLYPH;

export interface BoothGlyphProps {
  mode: GlyphMode;
  /**
   * Grows it about its centre: 1.14 under a dragged file, 1.25 for the 150 ms drop pulse
   * (ICON in lib/booth/motion.ts). Eases there over 240 ms on the icon's spring.
   */
  scale?: number;
  /** Drawn size in px (18 in the menu bar). */
  size?: number;
  /** The menu bar's text colour; the working lamp is always #0A84FF. */
  ink?: string;
  className?: string;
}

/**
 * The glyph in one of its five modes: idle (a ring lamp), target (a file is over it: tinted,
 * a heavier frame, a filled lamp), working (the blue lamp breathing every 1.4 s, CSS-driven, so
 * BoothRoot's `paused` holds it), done (a filled lamp) and attention (a dot, the frame dimmed).
 */
export function BoothGlyph({ mode, scale = 1, size = GLYPH.size, ink = "var(--booth-menubar-ink)", className }: BoothGlyphProps) {
  const dim = mode === "attention" ? 0.45 : 1;
  const frameRect = {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    rx: frame.radius,
  };
  return (
    <svg
      aria-hidden
      data-mode={mode}
      width={size}
      height={size}
      viewBox={`0 0 ${GLYPH.size} ${GLYPH.size}`}
      overflow="visible"
      className={cn("booth-glyph block", className)}
      style={{ scale: String(scale) } as CSSProperties}
    >
      {mode === "working" && <circle className="booth-glyph-halo" cx={lamp.cx} cy={lamp.cy} r={3.4} fill={GLYPH.work} />}
      {mode === "target" && <rect {...frameRect} fill={ink} fillOpacity={0.16} />}
      <rect
        {...frameRect}
        fill="none"
        stroke={ink}
        strokeWidth={mode === "target" ? GLYPH.targetStroke : GLYPH.stroke}
        strokeOpacity={dim}
      />
      {mode === "working" ? (
        <circle className="booth-glyph-lamp-working" cx={lamp.cx} cy={lamp.cy} r={lamp.r} fill={GLYPH.work} />
      ) : mode === "done" || mode === "target" ? (
        <circle cx={lamp.cx} cy={lamp.cy} r={lamp.r} fill={ink} />
      ) : (
        <circle cx={lamp.cx} cy={lamp.cy} r={ring.r} fill="none" stroke={ink} strokeWidth={ring.stroke} strokeOpacity={dim} />
      )}
      {mode === "attention" && <circle cx={attentionDot.cx} cy={attentionDot.cy} r={attentionDot.r} fill={ink} />}
    </svg>
  );
}

export interface BoothMenuBarItemProps extends Omit<ComponentPropsWithRef<"button">, "children"> {
  mode: GlyphMode;
  scale?: number;
  /** The button's highlight: on while the popover is open or a file is over it. */
  highlighted?: boolean;
}

/**
 * Booth's status item: the glyph on a 30 × 24 button that shows the menu bar's pressed
 * highlight (32 × 22, radius 6) while its popover is open or a file is over it; the highlight
 * grows with the glyph under a file. A real button: give it `aria-label` ("Booth"),
 * `aria-expanded` and `onClick`. Its hit area reaches 8 px past it for fingers.
 */
export function BoothMenuBarItem({ mode, scale = 1, highlighted = false, className, ...rest }: BoothMenuBarItemProps) {
  const button = GLYPH.button;
  return (
    <button
      type="button"
      className={cn(
        "relative grid h-6 w-[30px] cursor-default place-items-center rounded-[6px] outline-none before:absolute before:-inset-2 before:content-['']",
        "focus-visible:ring-2 focus-visible:ring-(color:--booth-work) focus-visible:ring-offset-0",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 bg-(color:--booth-menubar-press) [transition:opacity_120ms_var(--booth-ease),scale_240ms_var(--booth-icon-spring)] motion-reduce:[transition:none]"
        style={{
          width: button.width,
          height: button.height,
          borderRadius: button.radius,
          opacity: highlighted ? 1 : 0,
          scale: String(mode === "target" ? scale : 1),
        }}
      />
      <BoothGlyph mode={mode} scale={scale} className="relative" />
    </button>
  );
}
