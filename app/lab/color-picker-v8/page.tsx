"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorPickerFabV8,
  DEFAULT_CONFIG,
  type Config,
  type PickerControl,
} from "@/components/lab/color-picker-fab-v8";
import { TuningPanelV8 as TuningPanel } from "@/components/lab/tuning-panel-v8";

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

export default function ColorPickerV8LabPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [control, setControl] = useState<PickerControl | null>(null);
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
    <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-md px-6 pb-32 pt-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Lab · v8
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Radial color picker
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Improves touch-interaction visibility: swatches drift outward as
          the thumb approaches, and the ribbon both thickens and lifts
          while it&rsquo;s under the thumb — so the layer you&rsquo;re aiming
          at never hides under your finger.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Best on mobile. Works with a mouse too.
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

      <ColorPickerFabV8 config={config} control={control} />
    </div>
  );
}
