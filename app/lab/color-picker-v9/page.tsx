"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorPickerFabV9,
  DEFAULT_CONFIG,
  type Config,
  type PickerControl,
} from "@/components/lab/color-picker-fab-v9";
import { TuningPanelV9 as TuningPanel } from "@/components/lab/tuning-panel-v9";

// Thumb image is 360 × 354 (W × H). The aspect ratio is used to derive
// the rendered height from the configured width.
const THUMB_ASPECT = 354 / 360;
// Width as a multiple of the FAB diameter — sized large so the thumb
// reads at roughly life-size on screen.
const THUMB_FAB_MULTIPLE = 4.5;
// Fine-tune where the thumb tip lives within the PNG (as fractions of the
// rendered width/height). Negative shifts the image up/left so the actual
// fingertip — not the corner of the artwork — sits at the cursor.
const THUMB_TIP_OFFSET_X = -0.16;
const THUMB_TIP_OFFSET_Y = -0.13;
// Picker center for rotation (math angle, default picker fans up-left
// from the FAB) and the angular range the rotation maps across.
const PICKER_CENTER_DEG = 225;
const PICKER_HALF_SPAN_DEG = 53; // matches DEFAULT_CONFIG.arcSpanDeg / 2
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
  // Compute rotation: angle of the cursor from the FAB's bottom-right
  // corner. Pointer near the picker's lower end (math ~172°) rotates
  // CCW; near the upper end (math ~278°) rotates CW. Clamped to
  // ±THUMB_MAX_ROTATION_DEG so the wrist twist stays believable.
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
        // Thumb tip lives near the top-left of the artwork; nudge with the
        // tip-offset constants so the actual fingertip sits at the cursor.
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
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [control, setControl] = useState<PickerControl | null>(null);
  const [thumbEnabled, setThumbEnabled] = useState(true);
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
      // Ignore the toggle while typing in an input/textarea.
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

  return (
    <div
      className={`relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950 ${
        thumbEnabled ? "[&_*]:cursor-none" : ""
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
          Same touch-visibility behaviour as v8, but with a life-size thumb
          rendered in place of the cursor so the demo reads correctly on
          desktop — useful for evaluating how much of the picker stays
          unobstructed by a real finger.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Move the mouse to drag the thumb. Press and hold on the FAB as
          usual.
        </p>
      </div>

      <TuningPanel
        config={config}
        onChange={handleChange}
        onReset={() => {
          setConfig(DEFAULT_CONFIG);
          setControl(null);
          clearAll();
        }}
      />

      <ColorPickerFabV9 config={config} control={control} />

      {thumbEnabled && (
        <ThumbCursor fabSize={config.fabSize} fabInset={config.fabInset} />
      )}

      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-background/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground backdrop-blur">
        Press <kbd className="rounded bg-foreground/10 px-1.5 py-0.5 text-foreground">t</kbd> to toggle thumb
      </div>
    </div>
  );
}
