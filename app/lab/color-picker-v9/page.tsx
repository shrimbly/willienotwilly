"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Copy, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorPickerFabV9,
  DEFAULT_CONFIG,
  type Config,
  type PickerControl,
} from "@/components/lab/color-picker-fab-v9";
import { TuningPanelV9 as TuningPanel } from "@/components/lab/tuning-panel-v9";
import { Button } from "@/components/ui/button";

// --- Galaxy S24 mock device (desktop only) ------------------------------
// Galaxy S24's CSS viewport is roughly 360 × 780 (1080 × 2340 native at
// 3× DPR); we render the mock slightly shorter (720) so it floats with
// room to breathe inside the page.
const DEVICE_SCREEN_W = 360;
const DEVICE_SCREEN_H = 720;
const DEVICE_BEZEL = 6;
const DEVICE_FRAME_W = DEVICE_SCREEN_W + DEVICE_BEZEL * 2;
const DEVICE_FRAME_H = DEVICE_SCREEN_H + DEVICE_BEZEL * 2;
const DEVICE_PADDING = 24;
const FAB_INSET_FROM_SCREEN = 41;
// Per-instance positioning happens at render time now since the
// device's horizontal inset depends on viewport width (centred
// max-w-5xl layout). See `desktopRightInset` in the component.

// --- Thumb cursor (desktop only) -----------------------------------------
const THUMB_ASPECT = 354 / 360;
const THUMB_FAB_MULTIPLE = 5.2;
const THUMB_TIP_OFFSET_X = -0.19;
const THUMB_TIP_OFFSET_Y = -0.16;
const PICKER_CENTER_DEG = 225;
const PICKER_HALF_SPAN_DEG = 53;
const THUMB_MAX_ROTATION_DEG = 30;

function ThumbCursor({
  visible,
  fabSize,
  fabBottom,
  fabRight,
  clipRect,
}: {
  visible: boolean;
  fabSize: number;
  fabBottom: number;
  fabRight: number;
  // When provided, the thumb image is clipped to this viewport-anchored
  // rectangle so it doesn't extend past the device-screen on desktop.
  clipRect?: {
    bottom: number;
    right: number;
    width: number;
    height: number;
    borderRadius: number;
  };
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    // Track pointer position globally so the thumb has a ready position
    // the moment `visible` flips on — otherwise we'd have to wait for
    // the next pointer event, which makes the thumb appear to lag the
    // FAB press.
    window.addEventListener("pointermove", handler);
    window.addEventListener("pointerdown", handler);
    return () => {
      window.removeEventListener("pointermove", handler);
      window.removeEventListener("pointerdown", handler);
    };
  }, []);
  if (!visible || !pos) return null;
  const width = fabSize * THUMB_FAB_MULTIPLE;
  const height = width * THUMB_ASPECT;
  let rotation = 0;
  if (typeof window !== "undefined") {
    const fabCornerX = window.innerWidth - fabRight;
    const fabCornerY = window.innerHeight - fabBottom;
    const angleRad = Math.atan2(pos.y - fabCornerY, pos.x - fabCornerX);
    const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;
    let offset = ((angleDeg - PICKER_CENTER_DEG + 540) % 360) - 180;
    offset = Math.max(
      -PICKER_HALF_SPAN_DEG,
      Math.min(PICKER_HALF_SPAN_DEG, offset),
    );
    rotation = (offset / PICKER_HALF_SPAN_DEG) * THUMB_MAX_ROTATION_DEG;
  }
  // If a clip rect is provided, render the thumb inside a fixed
  // overflow-hidden container at that rect and position the image with
  // absolute coords relative to the container, so anything beyond the
  // device-screen edges gets cleanly cropped.
  if (clipRect) {
    const clipLeft =
      typeof window !== "undefined"
        ? window.innerWidth - clipRect.right - clipRect.width
        : 0;
    const clipTop =
      typeof window !== "undefined"
        ? window.innerHeight - clipRect.bottom - clipRect.height
        : 0;
    const localX = pos.x - clipLeft + width * THUMB_TIP_OFFSET_X;
    const localY = pos.y - clipTop + height * THUMB_TIP_OFFSET_Y;
    return (
      <div
        className="pointer-events-none fixed z-[100] select-none overflow-hidden"
        style={{
          bottom: clipRect.bottom,
          right: clipRect.right,
          width: clipRect.width,
          height: clipRect.height,
          borderRadius: clipRect.borderRadius,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/lab/thumb.png"
          alt=""
          width={width}
          height={height}
          draggable={false}
          className="absolute"
          style={{
            left: localX,
            top: localY,
            transform: `rotate(${rotation.toFixed(2)}deg)`,
            transformOrigin: `${-width * THUMB_TIP_OFFSET_X}px ${-height * THUMB_TIP_OFFSET_Y}px`,
            transition: "transform 120ms ease-out",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
          }}
        />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/lab/thumb.png"
      alt=""
      width={width}
      height={height}
      draggable={false}
      className="pointer-events-none fixed z-[100] select-none"
      style={{
        left: pos.x + width * THUMB_TIP_OFFSET_X,
        top: pos.y + height * THUMB_TIP_OFFSET_Y,
        transform: `rotate(${rotation.toFixed(2)}deg)`,
        transformOrigin: `${-width * THUMB_TIP_OFFSET_X}px ${-height * THUMB_TIP_OFFSET_Y}px`,
        transition: "transform 120ms ease-out",
        filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
      }}
    />
  );
}

type PickEvent = { color: string; id: number };

const WAVE_ORIGIN_X = DEVICE_SCREEN_W - FAB_INSET_FROM_SCREEN;
const WAVE_ORIGIN_Y = DEVICE_SCREEN_H - FAB_INSET_FROM_SCREEN;
const WAVE_RADIUS = Math.ceil(
  Math.hypot(DEVICE_SCREEN_W, DEVICE_SCREEN_H) * 1.05,
);

function DeviceFrame({
  pickHistory,
  onWaveComplete,
  rightInset,
  message,
  latestColor,
}: {
  pickHistory: PickEvent[];
  onWaveComplete: (id: number) => void;
  rightInset: number;
  message: string;
  latestColor: string | null;
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed z-0 select-none overflow-hidden"
        style={{
          bottom: DEVICE_PADDING + DEVICE_BEZEL,
          right: rightInset + DEVICE_BEZEL,
          width: DEVICE_SCREEN_W,
          height: DEVICE_SCREEN_H,
          borderRadius: 38,
          background: "#ffffff",
        }}
      >
        {pickHistory.map((p) => (
          <motion.div
            key={p.id}
            className="absolute inset-0"
            style={{ background: p.color }}
            initial={{
              clipPath: `circle(0px at ${WAVE_ORIGIN_X}px ${WAVE_ORIGIN_Y}px)`,
            }}
            animate={{
              clipPath: `circle(${WAVE_RADIUS}px at ${WAVE_ORIGIN_X}px ${WAVE_ORIGIN_Y}px)`,
            }}
            transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => onWaveComplete(p.id)}
          />
        ))}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 ring-1 ring-zinc-700"
          style={{ top: 12, width: 11, height: 11 }}
        />
        <div className="absolute left-6 top-2.5 text-[10px] font-medium tracking-wide text-zinc-500 mix-blend-difference">
          9:41
        </div>
        <div className="absolute right-6 top-2.5 flex items-center gap-1 text-[10px] font-medium tracking-wide text-zinc-500 mix-blend-difference">
          <span>5G</span>
          <span>•</span>
          <span>100%</span>
        </div>
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-zinc-500/60"
          style={{ bottom: 8, width: 96, height: 4 }}
        />
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center"
          style={{ paddingTop: 180 }}
        >
          <h2
            className="select-none whitespace-nowrap text-center font-sans font-semibold tracking-tight text-white"
            style={{ fontSize: 56, lineHeight: 1 }}
          >
            {message}
          </h2>
          {latestColor && (
            <div className="mt-4">
              <ColorChip color={latestColor} />
            </div>
          )}
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed z-[31] select-none"
        style={{
          bottom: DEVICE_PADDING,
          right: rightInset,
          width: DEVICE_FRAME_W,
          height: DEVICE_FRAME_H,
          border: `${DEVICE_BEZEL}px solid #0a0a0a`,
          borderRadius: 44,
          boxSizing: "border-box",
          boxShadow:
            "0 1px 0 1px rgba(255,255,255,0.04) inset, 0 24px 64px rgba(0,0,0,0.45)",
        }}
      />
    </>
  );
}

const ANIMATION_KEYS: ReadonlyArray<keyof Config> = [
  "holdMs",
  "openDurationMs",
  "ribbonScaleFromPct",
];

const TONE_KEYS: ReadonlyArray<keyof Config> = [
  "toneInner",
  "toneOuter",
  "toneSpanDeg",
];

function midRibbon(c: Config) {
  return {
    angleDeg: 225 + c.arcRotationDeg,
    distance: (c.ribbonInner + c.ribbonOuter) / 2 + 4,
  };
}

function midTone(c: Config) {
  return {
    angleDeg: 225 + c.arcRotationDeg,
    distance: (c.toneInner + c.toneOuter) / 2,
  };
}

function previewAnchor(c: Config, key: keyof Config) {
  return TONE_KEYS.includes(key) ? midTone(c) : midRibbon(c);
}

const SETTLE_MS = 220;
const POST_REPLAY_HOLD_MS = 1100;
const DESC_TEXT =
  "Polished interactions, refined spacing and animations. On desktop the picker lives inside a Galaxy S24-sized mock with a life-size cursor (yes, that's a photo of my actual thumb) so you can see exactly what gets covered by a real finger.";

const PICK_MESSAGES = [
  "Oh, nice.",
  "Mmm, yes.",
  "I like.",
  "Uh, ok!",
];

function useColorFormats(color: string | null) {
  return useMemo(() => {
    if (!color || typeof window === "undefined") {
      return { oklch: color ?? "", hex: "", rgb: "" };
    }
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.color = color;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const m = computed.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return { oklch: color, hex: "", rgb: computed };
    const r = +m[1];
    const g = +m[2];
    const b = +m[3];
    const hex =
      "#" +
      [r, g, b]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    return { oklch: color, hex, rgb: `rgb(${r}, ${g}, ${b})` };
  }, [color]);
}

function ColorChip({ color }: { color: string }) {
  const formats = useColorFormats(color);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"hex" | "rgb" | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDocClick);
    return () => window.removeEventListener("pointerdown", onDocClick);
  }, [open]);

  const handleCopy = async (kind: "hex" | "rgb") => {
    const text = kind === "hex" ? formats.hex : formats.rgb;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      // clipboard rejected — silently ignore
    }
  };

  return (
    <div ref={ref} className="pointer-events-auto relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-mono text-[11px] tracking-tight text-white backdrop-blur-sm ring-1 ring-white/20 transition-colors hover:bg-white/25"
      >
        <span>{formats.oklch}</span>
        <ChevronDown
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="copy-menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 top-full z-10 mt-2 flex w-max -translate-x-1/2 flex-col gap-1 rounded-md bg-black/40 p-1 text-[11px] text-white shadow-xl ring-1 ring-white/15 backdrop-blur-md"
          >
            <button
              type="button"
              onClick={() => handleCopy("hex")}
              className="inline-flex items-center gap-2 rounded px-2.5 py-1.5 font-mono hover:bg-white/15"
            >
              {copied === "hex" ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              <span>{copied === "hex" ? "Copied" : `Copy hex · ${formats.hex}`}</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy("rgb")}
              className="inline-flex items-center gap-2 rounded px-2.5 py-1.5 font-mono hover:bg-white/15"
            >
              {copied === "rgb" ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              <span>{copied === "rgb" ? "Copied" : `Copy RGB · ${formats.rgb}`}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ColorPickerV9LabPage() {
  // Base config: default FAB inset (41 px from viewport corner). On
  // desktop we render the device mock and shift the FAB further inside
  // the viewport via renderedConfig below.
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [control, setControl] = useState<PickerControl | null>(null);
  const [thumbEnabled, setThumbEnabled] = useState(true);
  const [pressed, setPressed] = useState(false);
  const [pickHistory, setPickHistory] = useState<PickEvent[]>([]);
  const [latestPick, setLatestPick] = useState<PickEvent | null>(null);
  const [pickCount, setPickCount] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [showQr, setShowQr] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const settleTimer = useRef<number | null>(null);
  const replayTimers = useRef<number[]>([]);

  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    const onResize = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // On desktop, position the device + FAB so the device's right edge
  // aligns with the right edge of a centred max-w-5xl content column.
  // The text content sits in that column's left side and the device
  // floats on its right side, giving a balanced two-column composition.
  // On narrower (sub-5xl) viewports, the device falls back to the
  // default 24 px padding from the viewport edge.
  const CONTAINER_MAX_W = 1024;
  const CONTAINER_INNER_W = CONTAINER_MAX_W - 24 * 2;
  const desktopRightInset = isMobile
    ? DEVICE_PADDING
    : Math.max(DEVICE_PADDING, (vp.w - CONTAINER_INNER_W) / 2);
  // Desktop FAB lives at the device-screen's bottom-right corner.
  // The device frame's vertical inset is DEVICE_PADDING (24); the
  // device-screen edge sits DEVICE_BEZEL (6) inside that; the FAB sits
  // FAB_INSET_FROM_SCREEN (41) further in. The right inset varies with
  // viewport width to track the centred layout, so we need separate
  // bottom and right values.
  const fabBottomDesktop =
    DEVICE_PADDING + DEVICE_BEZEL + FAB_INSET_FROM_SCREEN;
  const fabRightDesktop =
    desktopRightInset + DEVICE_BEZEL + FAB_INSET_FROM_SCREEN;
  const renderedConfig: Config = config;
  // Effective FAB insets (used for positioning hints + thumb clip).
  const actualFabBottom = isMobile ? config.fabInset : fabBottomDesktop;
  const actualFabRight = isMobile ? config.fabInset : fabRightDesktop;

  const clearReplayTimers = () => {
    replayTimers.current.forEach((id) => clearTimeout(id));
    replayTimers.current = [];
  };

  const clearAll = () => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    clearReplayTimers();
  };

  useEffect(() => clearAll, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "t" || e.key === "T") {
        setThumbEnabled((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runReplay = (c: Config, key: keyof Config) => {
    clearReplayTimers();
    setControl(null);

    const closeWait = c.openDurationMs + 80;
    const holdWait = key === "holdMs" ? c.holdMs : 0;
    const reopenAt = closeWait + holdWait;
    const closeAt = reopenAt + c.openDurationMs + POST_REPLAY_HOLD_MS;

    const t1 = window.setTimeout(
      () => setControl({ open: true, forcePointerAt: previewAnchor(c, key) }),
      reopenAt,
    );
    const t2 = window.setTimeout(() => setControl(null), closeAt);
    replayTimers.current = [t1, t2];
  };

  const handleChange = (next: Config, key: keyof Config) => {
    setConfig(next);
    clearReplayTimers();
    setControl({ open: true, forcePointerAt: previewAnchor(next, key) });

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      if (ANIMATION_KEYS.includes(key)) {
        runReplay(next, key);
      } else {
        settleTimer.current = window.setTimeout(
          () => setControl(null),
          900,
        );
      }
    }, SETTLE_MS);
  };

  const handlePressedChange = (p: boolean) => {
    setPressed(p);
    if (p) setHasInteracted(true);
  };

  const handlePick = (color: string) => {
    const ev = { color, id: Date.now() + Math.random() };
    setLatestPick(ev);
    setPickHistory((h) => [...h, ev]);
    setPickCount((n) => n + 1);
  };

  const pickMessage =
    pickCount > 0
      ? PICK_MESSAGES[(pickCount - 1) % PICK_MESSAGES.length]
      : PICK_MESSAGES[0];

  const handleWaveComplete = (id: number) => {
    setPickHistory((h) => {
      const idx = h.findIndex((p) => p.id === id);
      if (idx === -1) return h;
      return h.slice(idx);
    });
  };

  const showThumb = !isMobile && thumbEnabled && pressed;

  // Once the user has picked at least one colour on mobile, we hide
  // every text element on the page and replace the gradient background
  // with a wave-revealed coloured surface plus a white "Oh, nice." sat
  // dead-centre on top of it.
  const mobilePickActive = isMobile && latestPick !== null;
  const mobileWaveRadius =
    vp.w > 0 ? Math.ceil(Math.hypot(vp.w, vp.h) * 1.1) : 1500;
  const mobileWaveOriginX = vp.w - renderedConfig.fabInset;
  const mobileWaveOriginY = vp.h - renderedConfig.fabInset;

  return (
    <div
      className={`relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950 ${
        showThumb ? "[&_*]:cursor-none" : ""
      }`}
    >
      {mobilePickActive && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden"
          style={{ background: "#ffffff" }}
        >
          {pickHistory.map((p) => (
            <motion.div
              key={p.id}
              className="absolute inset-0"
              style={{ background: p.color, willChange: "clip-path" }}
              initial={{
                clipPath: `circle(0px at ${mobileWaveOriginX}px ${mobileWaveOriginY}px)`,
              }}
              animate={{
                clipPath: `circle(${mobileWaveRadius}px at ${mobileWaveOriginX}px ${mobileWaveOriginY}px)`,
              }}
              transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => handleWaveComplete(p.id)}
            />
          ))}
        </div>
      )}

      {!mobilePickActive && (
        <div className="mx-auto max-w-5xl px-6 pb-32 pt-28 lg:flex lg:items-stretch lg:gap-12 lg:pt-28 lg:min-h-[100dvh]" style={{ paddingBottom: undefined }}>
          <div className="lg:flex lg:flex-col lg:flex-1 lg:max-w-md lg:self-stretch">
            <AnimatePresence mode="wait">
              {!pressed && (
                <motion.div
                  key="header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Lab · v9
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                    Radial color picker
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {DESC_TEXT}
                  </p>
                  {!isMobile && (
                    <div className="mt-6 hidden lg:block">
                      <motion.button
                        type="button"
                        onClick={() => setShowQr((v) => !v)}
                        aria-expanded={showQr}
                        layout
                        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                        className="flex w-fit flex-col items-stretch overflow-hidden rounded-md bg-secondary text-left text-secondary-foreground shadow-xs outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <motion.span
                          layout="position"
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium"
                        >
                          <QrCode className="size-4" />
                          Try it on mobile
                        </motion.span>
                        <AnimatePresence initial={false} mode="popLayout">
                          {showQr && pageUrl && (
                            <motion.div
                              key="qr-inner"
                              initial={{ opacity: 0 }}
                              animate={{
                                opacity: 1,
                                transition: {
                                  duration: 0.2,
                                  delay: 0.32,
                                  ease: [0.22, 1, 0.36, 1],
                                },
                              }}
                              exit={{
                                opacity: 0,
                                transition: {
                                  duration: 0.28,
                                  ease: [0.22, 1, 0.36, 1],
                                },
                              }}
                              className="flex flex-col items-center gap-2 px-3 pb-3"
                            >
                              <div className="rounded-md bg-white p-3">
                                <QRCodeSVG
                                  value={pageUrl}
                                  size={160}
                                  level="M"
                                />
                              </div>
                              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                Scan to open on your phone
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {!isMobile && (
              <div className="hidden lg:mt-auto lg:flex lg:pb-2">
                <span className="pointer-events-none select-none rounded-full bg-background/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground backdrop-blur">
                  Press <kbd className="rounded bg-foreground/10 px-1.5 py-0.5 text-foreground">t</kbd> to toggle thumb
                </span>
              </div>
            )}
          </div>
          <div
            aria-hidden
            className="hidden shrink-0 lg:block lg:self-end"
            style={{
              width: DEVICE_FRAME_W,
              height: DEVICE_FRAME_H,
              marginBottom: DEVICE_PADDING,
            }}
          />
        </div>
      )}

      {mobilePickActive && (
        <div
          className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center px-6"
          style={{ paddingTop: 180 }}
        >
          <h2
            className="select-none whitespace-nowrap text-center font-sans font-semibold tracking-tight text-white"
            style={{
              fontSize: "clamp(48px, 14vw, 88px)",
              lineHeight: 1,
            }}
          >
            {pickMessage}
          </h2>
          {latestPick && (
            <div className="mt-5">
              <ColorChip color={latestPick.color} />
            </div>
          )}
        </div>
      )}

      <TuningPanel
        config={config}
        onChange={handleChange}
        onReset={() => {
          setConfig(DEFAULT_CONFIG);
          setControl(null);
          setPickHistory([]);
          setLatestPick(null);
          setPickCount(0);
          setHasInteracted(false);
          clearAll();
        }}
      />

      {!isMobile && (
        <DeviceFrame
          pickHistory={pickHistory}
          onWaveComplete={handleWaveComplete}
          rightInset={desktopRightInset}
          message={pickMessage}
          latestColor={latestPick?.color ?? null}
        />
      )}

      <ColorPickerFabV9
        config={renderedConfig}
        control={control}
        onPressedChange={handlePressedChange}
        onPick={handlePick}
        screenEdgeInset={isMobile ? undefined : FAB_INSET_FROM_SCREEN}
        fabBottomInset={isMobile ? undefined : fabBottomDesktop}
        fabRightInset={isMobile ? undefined : fabRightDesktop}
      />

      {!isMobile && (
        <ThumbCursor
          visible={thumbEnabled && pressed}
          fabSize={renderedConfig.fabSize}
          fabBottom={actualFabBottom}
          fabRight={actualFabRight}
          clipRect={{
            bottom: DEVICE_PADDING + DEVICE_BEZEL,
            right: desktopRightInset + DEVICE_BEZEL,
            width: DEVICE_SCREEN_W,
            height: DEVICE_SCREEN_H,
            borderRadius: 38,
          }}
        />
      )}

      {/* "Press & hold" hint sits just above the FAB and only shows
          until the user has touched it once. */}
      <AnimatePresence>
        {!hasInteracted && (
          <motion.div
            key="press-hint"
            className="pointer-events-none fixed z-[60] select-none rounded-full bg-background/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground backdrop-blur"
            style={{
              bottom: actualFabBottom + renderedConfig.fabSize + 14,
              right: actualFabRight,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            Press &amp; hold
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
