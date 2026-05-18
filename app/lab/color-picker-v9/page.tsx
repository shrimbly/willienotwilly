"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  ColorPickerFabV9,
  DEFAULT_CONFIG,
  type Config,
  type PickerControl,
} from "@/components/lab/color-picker-fab-v9";
import { TuningPanelV9 as TuningPanel } from "@/components/lab/tuning-panel-v9";

// --- Galaxy S24 mock device ----------------------------------------------
// Galaxy S24's CSS viewport is roughly 360 × 780 (1080 × 2340 native at
// 3× DPR). Drawing the mock at those CSS dimensions makes the picker's
// FAB size (56), inset (41) etc. read as realistic mobile measurements.
const DEVICE_SCREEN_W = 360;
const DEVICE_SCREEN_H = 720;
const DEVICE_BEZEL = 6; // thin Galaxy-style bezel
const DEVICE_FRAME_W = DEVICE_SCREEN_W + DEVICE_BEZEL * 2;
const DEVICE_FRAME_H = DEVICE_SCREEN_H + DEVICE_BEZEL * 2;
// Padding between the page viewport edges and the device frame. The
// picker's fabInset is shifted by this amount so the FAB still lands
// FAB_INSET_FROM_SCREEN px from the device-screen edge inside the bezel.
const DEVICE_PADDING = 24;
const FAB_INSET_FROM_SCREEN = 41;
const DEVICE_FRAME_BOTTOM = DEVICE_PADDING;
const DEVICE_FRAME_RIGHT = DEVICE_PADDING;
const DEVICE_SCREEN_BOTTOM = DEVICE_FRAME_BOTTOM + DEVICE_BEZEL;
const DEVICE_SCREEN_RIGHT = DEVICE_FRAME_RIGHT + DEVICE_BEZEL;
const FAB_VIEWPORT_INSET = DEVICE_SCREEN_BOTTOM + FAB_INSET_FROM_SCREEN;

// --- Thumb cursor --------------------------------------------------------
const THUMB_ASPECT = 354 / 360;
const THUMB_FAB_MULTIPLE = 4.5;
const THUMB_TIP_OFFSET_X = -0.22;
const THUMB_TIP_OFFSET_Y = -0.19;
const PICKER_CENTER_DEG = 225;
const PICKER_HALF_SPAN_DEG = 53;
const THUMB_MAX_ROTATION_DEG = 30;

function ThumbCursor({
  fabSize,
  fabInset,
}: {
  fabSize: number;
  fabInset: number;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    const clear = () => setPos(null);
    window.addEventListener("pointermove", handler);
    window.addEventListener("pointerleave", clear);
    return () => {
      window.removeEventListener("pointermove", handler);
      window.removeEventListener("pointerleave", clear);
    };
  }, []);
  if (!pos) return null;
  const width = fabSize * THUMB_FAB_MULTIPLE;
  const height = width * THUMB_ASPECT;
  let rotation = 0;
  if (typeof window !== "undefined") {
    const fabCornerX = window.innerWidth - fabInset;
    const fabCornerY = window.innerHeight - fabInset;
    const angleRad = Math.atan2(pos.y - fabCornerY, pos.x - fabCornerX);
    const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;
    let offset = ((angleDeg - PICKER_CENTER_DEG + 540) % 360) - 180;
    offset = Math.max(
      -PICKER_HALF_SPAN_DEG,
      Math.min(PICKER_HALF_SPAN_DEG, offset),
    );
    rotation = (offset / PICKER_HALF_SPAN_DEG) * THUMB_MAX_ROTATION_DEG;
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

// Origin point (in device-screen coords) the colour-wash wave should
// expand from — anchored to the FAB's bottom-right corner so the wave
// feels like it's emanating from where the user just released their
// finger. Recomputed if the screen-relative FAB inset changes.
const WAVE_ORIGIN_X = DEVICE_SCREEN_W - FAB_INSET_FROM_SCREEN;
const WAVE_ORIGIN_Y = DEVICE_SCREEN_H - FAB_INSET_FROM_SCREEN;
// Wave radius — at least the screen's diagonal so the colour fully
// covers the device-screen by the end of the animation.
const WAVE_RADIUS = Math.ceil(
  Math.hypot(DEVICE_SCREEN_W, DEVICE_SCREEN_H) * 1.05,
);

// --- Device frame: chrome + screen surface ------------------------------
// Screen surface sits at z-0 so the picker's backdrop blur affects it
// like the rest of the page; bezel ring sits at z-31 (above the picker's
// z-30 backdrop) so the phone's chrome stays sharp during the wash.
//
// The screen starts solid white with the word "Willie" rendered in white
// — invisible by design. Each committed colour pick washes a coloured
// circle out from the FAB-corner, painting Willie against the new colour.
function DeviceFrame({
  pickHistory,
  onWaveComplete,
}: {
  pickHistory: PickEvent[];
  onWaveComplete: (id: number) => void;
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed z-0 select-none overflow-hidden"
        style={{
          bottom: DEVICE_SCREEN_BOTTOM,
          right: DEVICE_SCREEN_RIGHT,
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
          className="pointer-events-none absolute inset-0 flex items-start justify-center"
          style={{ paddingTop: 180 }}
        >
          <h2
            className="select-none font-semibold tracking-tight text-white"
            style={{ fontSize: 76, lineHeight: 1 }}
          >
            Oh, nice.
          </h2>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed z-[31] select-none"
        style={{
          bottom: DEVICE_FRAME_BOTTOM,
          right: DEVICE_FRAME_RIGHT,
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

export default function ColorPickerV9LabPage() {
  // Override fabInset so the FAB lands FAB_INSET_FROM_SCREEN px from the
  // device-screen edge (inside the bezel + page padding).
  const [config, setConfig] = useState<Config>(() => ({
    ...DEFAULT_CONFIG,
    fabInset: FAB_VIEWPORT_INSET,
  }));
  const [control, setControl] = useState<PickerControl | null>(null);
  const [thumbEnabled, setThumbEnabled] = useState(true);
  const [pressed, setPressed] = useState(false);
  const [pickHistory, setPickHistory] = useState<PickEvent[]>([]);
  const settleTimer = useRef<number | null>(null);
  const replayTimers = useRef<number[]>([]);

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

  const handlePick = (color: string) => {
    setPickHistory((h) => [...h, { color, id: Date.now() + Math.random() }]);
  };

  // Once a wave completes, every pick before it is fully painted over and
  // can be dropped from the stack. Leaves just the latest completed wave
  // plus anything still mid-animation.
  const handleWaveComplete = (id: number) => {
    setPickHistory((h) => {
      const idx = h.findIndex((p) => p.id === id);
      if (idx === -1) return h;
      return h.slice(idx);
    });
  };

  const showThumb = thumbEnabled && pressed;

  return (
    <div
      className={`relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950 ${
        showThumb ? "[&_*]:cursor-none" : ""
      }`}
    >
      <div className="mx-auto max-w-md px-6 pb-32 pt-28">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Lab · v9
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Radial color picker
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          v8 with a Galaxy S24-sized mock, a life-size thumb cursor that
          appears while the FAB is held, and a wave-reveal of the picked
          colour on the word &ldquo;Willie&rdquo; on the device screen.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Press and hold the FAB. Mouse position drives the thumb.
        </p>
      </div>

      <TuningPanel
        config={config}
        onChange={handleChange}
        onReset={() => {
          setConfig({ ...DEFAULT_CONFIG, fabInset: FAB_VIEWPORT_INSET });
          setControl(null);
          setPickHistory([]);
          clearAll();
        }}
      />

      <DeviceFrame
        pickHistory={pickHistory}
        onWaveComplete={handleWaveComplete}
      />

      <ColorPickerFabV9
        config={config}
        control={control}
        onPressedChange={setPressed}
        onPick={handlePick}
        screenEdgeInset={FAB_INSET_FROM_SCREEN}
      />

      {showThumb && (
        <ThumbCursor fabSize={config.fabSize} fabInset={config.fabInset} />
      )}

      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-background/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground backdrop-blur">
        Press <kbd className="rounded bg-foreground/10 px-1.5 py-0.5 text-foreground">t</kbd> to toggle thumb
      </div>
    </div>
  );
}
