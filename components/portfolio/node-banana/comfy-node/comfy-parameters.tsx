"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Dices, Lock, Minus, Plus, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { NumberField, SelectField } from "../kit";
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
const SEED_MODE_ORDER: SeedMode[] = ["random", "fixed", "increment", "decrement"];
const SEED_MAX = 2 ** 31 - 1;
/** The open list's height in node px (eyebrow + four 22px rows + padding). */
const LIST_HEIGHT = 120;
/** Keep the list clear of the tile's floating run bar. */
const LIST_CLEARANCE = 72;

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
 * and the node-size menu under it, aligned to its right edge. The list is
 * mounted on the node so the controls card's clip never cuts it.
 */
function SeedModeMenu({ mode, onChange }: { mode: SeedMode; onChange: (mode: SeedMode) => void }) {
  const listId = `nb-seed-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { label, icon: Icon } = SEED_MODES[mode];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<{ host: HTMLElement; style: CSSProperties } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPlace(null);
  }, []);

  const openList = () => {
    const button = trigger.current;
    const host = (button?.closest("[data-nb-node]") ?? button?.closest("[data-nb-root]")) as HTMLElement | null;
    if (!button || !host) return;
    const h = host.getBoundingClientRect();
    const t = button.getBoundingClientRect();
    const scale = host.offsetWidth > 0 ? h.width / host.offsetWidth : 1;
    const width = 160;
    // Open upward when the tile (less its run bar) has no room below, as the app's Dropdown flips.
    const tile = button.closest("[data-nb-root]")?.getBoundingClientRect();
    const below = tile ? tile.bottom - LIST_CLEARANCE - t.bottom : Infinity;
    const up = tile !== undefined && below < LIST_HEIGHT * scale && t.top - tile.top > below;
    setPlace({
      host,
      style: {
        position: "absolute",
        zIndex: 60,
        left: (t.right - h.left) / scale - width,
        // Anchored by its bottom edge when it opens upward: the drop-in keyframes own `transform`.
        ...(up ? { bottom: host.offsetHeight - (t.top - h.top) / scale + 4 } : { top: (t.bottom - h.top) / scale + 4 }),
        width,
      },
    });
    setActive(SEED_MODE_ORDER.indexOf(mode));
    setOpen(true);
  };

  const pick = (next: SeedMode) => {
    onChange(next);
    close();
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (list.current?.contains(target) || trigger.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + SEED_MODE_ORDER.length) % SEED_MODE_ORDER.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (active >= 0) pick(SEED_MODE_ORDER[active]);
    } else if (event.key === "Tab") {
      close();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={`After each run: ${label}`}
        title={`After each run: ${label}`}
        onClick={(event) => {
          // Inside the field's <label>: keep the click from focusing the seed well.
          event.preventDefault();
          if (open) close();
          else openList();
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "nodrag nb-rounded-well nb-squircle flex h-[22px] w-[22px] shrink-0 items-center justify-center text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200",
          open && "bg-white/5 text-neutral-200",
        )}
      >
        <Icon size={12} strokeWidth={2} />
      </button>
      {open &&
        place &&
        createPortal(
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label="After each run"
            className="nodrag nb-menu-surface nb-drop-in nb-font-ui overflow-hidden"
            style={place.style}
            onKeyDown={onKeyDown}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div className="py-1">
              <div className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 px-2 pt-1.5 pb-0.5 text-[9px] leading-3 uppercase">After each run</div>
              {SEED_MODE_ORDER.map((value, i) => {
                const { label: optionLabel, icon: OptionIcon, meta } = SEED_MODES[value];
                return (
                  <div
                    key={value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={value === mode}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(value)}
                    className={cn(
                      "nb-text-node flex h-[22px] cursor-pointer items-center gap-1.5 px-2 whitespace-nowrap",
                      i === active ? "bg-neutral-700 text-neutral-100" : "text-neutral-300",
                    )}
                  >
                    <span aria-hidden className="flex w-[11px] shrink-0 justify-center">
                      <OptionIcon size={11} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis">{optionLabel}</span>
                    {meta && <span className="nb-font-mono nb-text-ink-3 text-[9px]">{meta}</span>}
                    <span className="flex w-[10px] shrink-0 justify-center">
                      {value === mode && <Check size={10} strokeWidth={2.5} className="text-neutral-200" />}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>,
          place.host,
        )}
    </>
  );
}
