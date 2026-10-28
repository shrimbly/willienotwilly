"use client";

import { Dices, Lock, Minus, Plus, type LucideIcon } from "lucide-react";

import { NumberField, SelectField, SelectWell, type SelectOption } from "../kit";
import { SAMPLER_OPTIONS, UPSCALE_OPTIONS, type ComfyParams } from "./data";

// ComfyAppParameters.tsx: the workflow's exposed widgets as the shared
// fields, dropdowns first, then numbers. The seed carries ComfyUI's "control
// after generate" as a menu beside it (SeedModeMenu).

export type SeedMode = "random" | "fixed" | "increment" | "decrement";

const SEED_MODES: Record<SeedMode, { label: string; icon: LucideIcon; meta?: string }> = {
  random: { label: "Random", icon: Dices },
  fixed: { label: "Fixed", icon: Lock },
  increment: { label: "Increment", icon: Plus, meta: "+1" },
  decrement: { label: "Decrement", icon: Minus, meta: "−1" },
};
const SEED_MODE_OPTIONS: SelectOption[] = (Object.keys(SEED_MODES) as SeedMode[]).map((value) => {
  const { label, icon: Icon, meta } = SEED_MODES[value];
  return { value, label, meta, icon: <Icon size={10} strokeWidth={1.75} />, group: "After each run" };
});
const SEED_MAX = 2 ** 31 - 1;

/** The seed a run leaves behind (lib/comfy/seeds.ts nextSeed). Called from an event, never in render. */
export function nextSeed(value: number, mode: SeedMode): number {
  switch (mode) {
    case "fixed":
      return value;
    case "increment":
      return value + 1 > SEED_MAX ? 0 : value + 1;
    case "decrement":
      return value - 1 < 0 ? SEED_MAX : value - 1;
    default:
      return Math.floor(Math.random() * 2 ** 31);
  }
}

export interface ComfyParametersProps {
  values: ComfyParams;
  onChange: (patch: Partial<ComfyParams>) => void;
  seedMode: SeedMode;
  onSeedModeChange: (mode: SeedMode) => void;
}

export function ComfyParameters({ values, onChange, seedMode, onSeedModeChange }: ComfyParametersProps) {
  return (
    <>
      <SelectField label="Sampler" value={values.sampler} options={SAMPLER_OPTIONS} onChange={(sampler) => onChange({ sampler })} />
      <SelectField label="Upscale" value={values.upscale} options={UPSCALE_OPTIONS} onChange={(upscale) => onChange({ upscale })} />
      <NumberField
        label="Seed"
        value={values.seed}
        min={0}
        max={SEED_MAX}
        step={1}
        onChange={(seed) => onChange({ seed: Math.round(seed) })}
        trailing={<SeedModeMenu mode={seedMode} onChange={onSeedModeChange} />}
      />
      <NumberField label="Steps" value={values.steps} min={1} max={50} step={1} onChange={(steps) => onChange({ steps: Math.round(steps) })} />
      <NumberField label="Denoise" value={values.denoise} min={0} max={1} step={0.05} onChange={(denoise) => onChange({ denoise })} />
    </>
  );
}

/**
 * What the seed does after each run: a 22px icon button showing the mode,
 * and the node-size menu under it, aligned to its right edge.
 */
function SeedModeMenu({ mode, onChange }: { mode: SeedMode; onChange: (mode: SeedMode) => void }) {
  const { label, icon: Icon } = SEED_MODES[mode];
  return (
    <SelectWell
      value={mode}
      options={SEED_MODE_OPTIONS}
      onChange={(value) => onChange(value as SeedMode)}
      aria-label={`After each run: ${label}`}
      title={`After each run: ${label}`}
      listLabel="After each run"
      align="end"
      className="shrink-0"
      trigger={<Icon size={12} strokeWidth={2} />}
      triggerClassName="nb-rounded-well nb-squircle flex h-[22px] w-[22px] items-center justify-center text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200 data-open:bg-white/5 data-open:text-neutral-200"
    />
  );
}
