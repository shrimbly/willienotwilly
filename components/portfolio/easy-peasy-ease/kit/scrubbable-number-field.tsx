"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Port of easy-peasy-ease/components/ui/scrubbable-number-field.tsx: a
 * Figma-style [−] value [+] field. Drag the value to scrub, click to type,
 * arrows / PageUp / PageDown / Home / End to step. Radii in px (rounded-md = 8px)
 * and border-control-border as border-(color:--control-border).
 */
interface ScrubbableNumberFieldProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  scrubStep?: number;
  precision?: number;
  disabled?: boolean;
  className?: string;
  label: string;
  unit?: string;
}

interface ScrubOrigin {
  pointerId: number;
  clientX: number;
  value: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function ScrubbableNumberField({
  id,
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  scrubStep = step,
  precision = 0,
  disabled = false,
  className,
  label,
  unit,
}: ScrubbableNumberFieldProps) {
  const scrubOriginRef = useRef<ScrubOrigin | null>(null);
  const didScrubRef = useRef(false);
  const skipBlurCommitRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");

  const updateValue = useCallback(
    (nextValue: number) => {
      onChange(round(clamp(nextValue, min, max), precision));
    },
    [max, min, onChange, precision],
  );

  const stopScrubbing = useCallback(() => {
    scrubOriginRef.current = null;
    setIsScrubbing(false);
  }, []);

  const commitDraftValue = useCallback(() => {
    const parsedValue = Number.parseFloat(draftValue);
    if (Number.isFinite(parsedValue)) updateValue(parsedValue);
    setIsEditing(false);
  }, [draftValue, updateValue]);

  const adjustValue = (adjustment: number) => {
    const parsedDraft = Number.parseFloat(draftValue);
    const adjustmentOrigin = isEditing && Number.isFinite(parsedDraft) ? parsedDraft : value;
    updateValue(adjustmentOrigin + adjustment);
    setIsEditing(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    didScrubRef.current = false;
    scrubOriginRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      value,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = scrubOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    const distance = event.clientX - origin.clientX;
    if (!isScrubbing && Math.abs(distance) < 2) return;

    event.preventDefault();
    didScrubRef.current = true;
    if (!isScrubbing) setIsScrubbing(true);
    updateValue(origin.value + distance * scrubStep);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopScrubbing();
  };

  const handleReadoutClick = () => {
    if (didScrubRef.current) {
      didScrubRef.current = false;
      return;
    }
    skipBlurCommitRef.current = false;
    setDraftValue(value.toFixed(precision));
    setIsEditing(true);
  };

  const handleInputBlur = () => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    commitDraftValue();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
      setIsEditing(false);
    }
  };

  const handleValueKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const multiplier = event.shiftKey ? 10 : 1;
    const keyAdjustments: Record<string, number> = {
      ArrowDown: -step,
      ArrowLeft: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -step * 10,
      PageUp: step * 10,
    };
    const adjustment = keyAdjustments[event.key];

    if (adjustment !== undefined) {
      event.preventDefault();
      updateValue(value + adjustment * multiplier);
      return;
    }
    if (event.key === "Home" && Number.isFinite(min)) {
      event.preventDefault();
      updateValue(min);
    }
    if (event.key === "End" && Number.isFinite(max)) {
      event.preventDefault();
      updateValue(max);
    }
  };

  const controlClassName =
    "relative flex h-9 items-center justify-center text-muted-foreground transition-[color,background-color,scale] duration-150 after:absolute after:inset-x-0 after:inset-y-[-2px] after:content-[''] hover:bg-accent hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      className={cn(
        "inline-grid h-9 grid-cols-[2rem_minmax(4rem,1fr)_2rem] rounded-[8px] border border-(color:--control-border) bg-background shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        className={cn(controlClassName, "rounded-l-[8px]")}
        onClick={() => adjustValue(-step)}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      {isEditing ? (
        <input
          id={id}
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          autoFocus
          className="h-9 min-w-0 border-x border-border/70 bg-accent/50 px-2 text-center font-mono text-sm font-medium tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40"
        />
      ) : (
        <button
          id={id}
          type="button"
          role="slider"
          aria-label={label}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuenow={value}
          aria-valuetext={`${value.toFixed(precision)}${unit ? ` ${unit}` : ""}`}
          title="Click to edit or drag horizontally to adjust"
          className={cn(
            "relative h-9 min-w-0 touch-none select-none border-x border-border/70 px-2 font-mono text-sm font-medium tabular-nums text-foreground outline-none transition-[background-color,color] duration-150 after:absolute after:inset-x-0 after:inset-y-[-2px] after:content-[''] hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40",
            isScrubbing ? "cursor-ew-resize bg-accent/80 text-primary" : "cursor-ew-resize",
          )}
          onClick={handleReadoutClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={stopScrubbing}
          onKeyDown={handleValueKeyDown}
          disabled={disabled}
        >
          {value.toFixed(precision)}
        </button>
      )}
      <button
        type="button"
        className={cn(controlClassName, "rounded-r-[8px]")}
        onClick={() => adjustValue(step)}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
