"use client";

import { useState } from "react";
import type { Config } from "./color-picker-fab-v8";

type SliderSpec = {
  key: keyof Config;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
};

const GROUPS: { title: string; sliders: SliderSpec[] }[] = [
  {
    title: "Geometry",
    sliders: [
      { key: "fabSize", label: "FAB size", min: 28, max: 96, step: 1, format: (v) => `${v}px` },
      { key: "fabInset", label: "FAB inset", min: 0, max: 80, step: 1, format: (v) => `${v}px` },
      { key: "swatchSize", label: "Swatch size", min: 12, max: 60, step: 1, format: (v) => `${v}px` },
      { key: "arcRadius", label: "Swatch radius", min: 40, max: 200, step: 1, format: (v) => `${v}px` },
      { key: "swatchSpanDeg", label: "Swatch fan", min: 20, max: 240, step: 1, format: (v) => `${v}°` },
      { key: "ribbonInner", label: "Ribbon inner", min: 60, max: 260, step: 1, format: (v) => `${v}px` },
      { key: "ribbonOuter", label: "Ribbon outer", min: 90, max: 320, step: 1, format: (v) => `${v}px` },
      { key: "toneInner", label: "Tone inner", min: 140, max: 360, step: 1, format: (v) => `${v}px` },
      { key: "toneOuter", label: "Tone outer", min: 200, max: 480, step: 1, format: (v) => `${v}px` },
      { key: "toneSpanDeg", label: "Tone fan", min: 40, max: 240, step: 1, format: (v) => `${v}°` },
      { key: "indicatorSize", label: "Indicator", min: 10, max: 60, step: 1, format: (v) => `${v}px` },
      { key: "arcSpanDeg", label: "Ribbon arc span", min: 10, max: 320, step: 1, format: (v) => `${v}°` },
      { key: "arcRotationDeg", label: "Picker rotation", min: -180, max: 180, step: 1, format: (v) => `${v > 0 ? "+" : ""}${v}°` },
      { key: "expandPad", label: "Expand padding", min: 0, max: 50, step: 1, format: (v) => `${v}px` },
    ],
  },
  {
    title: "Timing",
    sliders: [
      { key: "holdMs", label: "Hold delay", min: 0, max: 400, step: 10, format: (v) => `${v}ms` },
      { key: "openDurationMs", label: "Open duration", min: 120, max: 700, step: 10, format: (v) => `${v}ms` },
      { key: "ribbonScaleFromPct", label: "Ribbon scale from", min: 50, max: 100, step: 1, format: (v) => `${v}%` },
    ],
  },
  {
    title: "Tonality",
    sliders: [
      { key: "ribbonL", label: "Lightness", min: 0.4, max: 0.9, step: 0.01, format: (v) => v.toFixed(2) },
      { key: "ribbonC", label: "Chroma", min: 0.05, max: 0.3, step: 0.005, format: (v) => v.toFixed(3) },
    ],
  },
];

type Props = {
  config: Config;
  onChange: (next: Config, changedKey: keyof Config) => void;
  onCommit?: (changedKey: keyof Config) => void;
  onReset: () => void;
};

export function TuningPanelV8({ config, onChange, onCommit, onReset }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="fixed left-4 top-4 z-50 w-72 max-w-[calc(100vw-2rem)] select-none rounded-xl border border-foreground/10 bg-background/80 text-foreground shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
        >
          <span
            aria-hidden
            className="inline-block transition-transform"
            style={{
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            }}
          >
            ▾
          </span>
          Tuning
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
        >
          Reset
        </button>
      </div>

      {!collapsed && (
        <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-5">
            {GROUPS.map((group) => (
              <section key={group.title}>
                <h3 className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {group.title}
                </h3>
                <div className="flex flex-col gap-3">
                  {group.sliders.map((s) => {
                    const v = config[s.key] as number;
                    return (
                      <label
                        key={s.key as string}
                        className="flex flex-col gap-1.5 text-xs"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-foreground/80">{s.label}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {s.format ? s.format(v) : v}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={s.min}
                          max={s.max}
                          step={s.step}
                          value={v}
                          onChange={(e) =>
                            onChange(
                              {
                                ...config,
                                [s.key]: parseFloat(e.target.value),
                              },
                              s.key,
                            )
                          }
                          onPointerUp={() => onCommit?.(s.key)}
                          onKeyUp={() => onCommit?.(s.key)}
                          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-foreground/10 accent-foreground"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
