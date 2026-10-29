"use client";

import { useLayoutEffect, useMemo, useRef } from "react";

import type { DemoId } from "@/lib/portfolio";

import { DemoSlot } from "./demo-slot";
import { DemoThumbnailContext } from "./use-demo-active";

/** The hero tile's size on a desktop project page, where its layout was designed. */
const STAGE_WIDTH = 1152;
const STAGE_HEIGHT = 648;
/** The window's share of the card's width, as on the poster videos beside it. */
const FILL = 0.84;

/**
 * A listing card's thumbnail: a project's hero demo, laid out at the size it
 * has on its page and scaled down into a window floating over `backdropClass`.
 * It is inert, so the card stays one link, and runs only while `playing`.
 */
export function DemoThumbnail({
  id,
  playing,
  backdropClass,
  frameClass,
}: {
  id: DemoId;
  playing: boolean;
  backdropClass: string;
  frameClass: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const context = useMemo(() => ({ playing }), [playing]);

  // Written straight to the style, so the window is never drawn at full size.
  useLayoutEffect(() => {
    const el = box.current;
    const s = stage.current;
    if (!el || !s) return;
    const fit = () => s.style.setProperty("--thumb-scale", String((el.clientWidth * FILL) / STAGE_WIDTH));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} inert className={`absolute inset-0 overflow-hidden ${backdropClass}`}>
      <div
        ref={stage}
        className={`squircle absolute top-1/2 left-1/2 overflow-hidden rounded-[32px] border border-white/10 shadow-[0_48px_96px_-32px_rgba(0,0,0,0.55)] [transform:translate(-50%,-50%)_scale(var(--thumb-scale,0))] sm:rounded-[40px] ${frameClass}`}
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      >
        <DemoThumbnailContext value={context}>
          <DemoSlot id={id} />
        </DemoThumbnailContext>
      </div>
    </div>
  );
}
