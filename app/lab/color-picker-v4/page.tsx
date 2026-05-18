"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorPickerFabV4,
  DEFAULT_CONFIG,
  type Config,
  type PickerControl,
} from "@/components/lab/color-picker-fab-v4";
import { TuningPanel } from "@/components/lab/tuning-panel";

const ANIMATION_KEYS: ReadonlyArray<keyof Config> = [
  "holdMs",
  "openDurationMs",
  "ribbonScaleFromPct",
];

function midRibbon(c: Config) {
  return {
    angleDeg: 225 + c.arcRotationDeg,
    distance: (c.ribbonInner + c.ribbonOuter) / 2 + 4,
  };
}

const SETTLE_MS = 220;
const POST_REPLAY_HOLD_MS = 1100;

export default function ColorPickerV4LabPage() {
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
    // 1. Close the current preview cleanly so AnimatePresence finishes its exit
    //    before we ask it to enter again.
    clearReplayTimers();
    setControl(null);

    const closeWait = c.openDurationMs + 80;
    const holdWait = key === "holdMs" ? c.holdMs : 0;
    const reopenAt = closeWait + holdWait;
    const closeAt = reopenAt + c.openDurationMs + POST_REPLAY_HOLD_MS;

    const t1 = window.setTimeout(
      () => setControl({ open: true, forcePointerAt: midRibbon(c) }),
      reopenAt,
    );
    const t2 = window.setTimeout(() => setControl(null), closeAt);
    replayTimers.current = [t1, t2];
  };

  const handleChange = (next: Config, key: keyof Config) => {
    setConfig(next);
    // Live preview: pin the picker expanded so non-animation tweaks (geometry,
    // tonality, arc rotation) are visible immediately.
    clearReplayTimers();
    setControl({ open: true, forcePointerAt: midRibbon(next) });

    // Settle: after SETTLE_MS of no further changes, either replay (for
    // animation keys) or hold the preview a bit longer then close.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      if (ANIMATION_KEYS.includes(key)) {
        runReplay(next, key);
      } else {
        // Hold the expanded view briefly, then dismiss.
        settleTimer.current = window.setTimeout(
          () => setControl(null),
          900,
        );
      }
    }, SETTLE_MS);
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-md px-6 pb-32 pt-28">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Lab · v4
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Radial color picker
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          OKLCH ribbon, live colour preview on the thumb, and a tuning panel
          for everything else. Geometry tweaks show live; animation tweaks
          replay the open animation when you settle.
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

      <ColorPickerFabV4 config={config} control={control} />
    </div>
  );
}
