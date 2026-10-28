"use client";

import { useId, useRef, type CSSProperties, type RefObject } from "react";
import { ArrowLeft, Scissors, Wand2 } from "lucide-react";

import {
  MAX_SECTIONS,
  MIN_SECTION_DURATION,
  sectionCountForLength,
  type Section,
} from "@/lib/easy-peasy-ease/chunking";
import { EASING_PRESETS } from "@/lib/easy-peasy-ease/easing-presets";
import { formatTime } from "@/lib/easy-peasy-ease/timeline-utils";
import { cn } from "@/lib/utils";

import { EasingCurvePicker } from "../kit/easing-curve-picker";
import { EpeButton } from "../kit/epe-button";
import { FieldLabel } from "../kit/field-label";
import { ScrubbableNumberField } from "../kit/scrubbable-number-field";

import { usePopoverRoom } from "./use-popover-room";
import { SOURCE_DURATION, SOURCE_NAME } from "./virtual-source";

export const SECTION_LENGTH_MIN = 0.5;
export const SECTION_LENGTH_MAX = Math.max(SECTION_LENGTH_MIN, Math.floor(SOURCE_DURATION));

const clipsLabel = (n: number) => `${n} clip${n === 1 ? "" : "s"}`;

interface SplitControlsProps {
  mode: "edit" | "sequence";
  sections: Section[];
  splitCount: number;
  sectionLength: number;
  onSectionLengthChange: (value: number) => void;
  outputDuration: number;
  onOutputDurationChange: (value: number) => void;
  preset: string;
  onPresetChange: (preset: string) => void;
  onSplitEvenly: () => void;
  onClearSplits: () => void;
  onBack: () => void;
  onCreate: () => void;
  /** The tile, for fitting the curve popover inside it. */
  boundsRef: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Port of the VideoSplitEditor <aside> (easy-peasy-ease/components/VideoSplitEditor.tsx):
 * clip length, clip duration, "Split evenly", the curve, the summary and
 * Back / Create. Narrower tiles drop the secondary copy, never the controls.
 * In the demo "Back" leaves the eased sequence (there is no upload screen to
 * return to while editing, so it is disabled there).
 */
export function SplitAside({
  mode,
  sections,
  splitCount,
  sectionLength,
  onSectionLengthChange,
  outputDuration,
  onOutputDurationChange,
  preset,
  onPresetChange,
  onSplitEvenly,
  onClearSplits,
  onBack,
  onCreate,
  boundsRef,
  className,
}: SplitControlsProps) {
  const id = useId();
  const curveRef = useRef<HTMLDivElement>(null);
  const room = usePopoverRoom(curveRef, boundsRef, { side: "bottom", align: "start", maxHeight: 280 });

  const effectiveSectionLength = Math.min(sectionLength, SECTION_LENGTH_MAX);
  const previewCount = sectionCountForLength(SOURCE_DURATION, effectiveSectionLength);
  const totalOutput = sections.length * outputDuration;
  const avgSection = sections.length > 0 ? SOURCE_DURATION / sections.length : 0;

  return (
    <div
      role="group"
      aria-label="Split settings"
      className={cn(
        // Short landscape tiles (608×342) tighten the rhythm so the footer stays inside.
        "w-[248px] shrink-0 flex-col gap-2.5 self-start rounded-[12px] border border-border bg-secondary p-3 [@container_epe-split_(max-height:360px)]:gap-2 @min-[720px]/epe:w-[272px] @min-[880px]/epe:w-[320px] @min-[880px]/epe:gap-4 @min-[880px]/epe:p-4 @min-[1100px]/epe:w-[360px]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Scissors className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-base font-semibold text-balance text-foreground @min-[880px]/epe:text-lg">
            Split into clips
          </p>
          <p className="hidden text-xs text-pretty text-(color:--body-muted-foreground) @min-[720px]/epe:block">
            Each clip is eased independently, then played in sequence.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 @min-[880px]/epe:gap-3">
        <div className="min-w-0 space-y-1.5">
          <FieldLabel htmlFor={`${id}-length`}>Clip length</FieldLabel>
          <ScrubbableNumberField
            id={`${id}-length`}
            label="Clip length"
            min={SECTION_LENGTH_MIN}
            max={SECTION_LENGTH_MAX}
            step={0.5}
            scrubStep={0.1}
            precision={1}
            unit="seconds"
            value={effectiveSectionLength}
            onChange={onSectionLengthChange}
            className="w-full grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] @min-[880px]/epe:grid-cols-[2rem_minmax(4rem,1fr)_2rem]"
          />
          <p className="hidden text-[11px] text-muted-foreground @min-[720px]/epe:block">
            ≈ {clipsLabel(previewCount)}
          </p>
        </div>
        <div className="min-w-0 space-y-1.5">
          <FieldLabel htmlFor={`${id}-duration`}>Clip duration</FieldLabel>
          <ScrubbableNumberField
            id={`${id}-duration`}
            label="Eased clip duration"
            min={0.3}
            max={4}
            step={0.05}
            scrubStep={0.01}
            precision={2}
            unit="seconds"
            value={outputDuration}
            onChange={onOutputDurationChange}
            className="w-full grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] @min-[880px]/epe:grid-cols-[2rem_minmax(4rem,1fr)_2rem]"
          />
        </div>
      </div>

      <EpeButton type="button" variant="outline" size="sm" onClick={onSplitEvenly} className="w-full gap-2">
        <Wand2 className="h-4 w-4" />
        Split evenly every {effectiveSectionLength}s
      </EpeButton>

      {/* The kit picker's rows keep motion's filter: blur(0px), which makes each row
          the options' offsetParent in Chrome and breaks its scroll-to-selected;
          dropping the filter lets the open popover land on the current curve. */}
      <div
        ref={curveRef}
        className="space-y-1.5 border-t border-border/60 pt-2.5 [&_[role=listbox]_[role=presentation]]:filter-none! [@container_epe-split_(max-height:360px)]:border-t-0 [@container_epe-split_(max-height:360px)]:pt-0 @min-[880px]/epe:pt-4"
        style={{ "--epe-split-popover-h": `${room.maxHeight}px` } as CSSProperties}
      >
        <FieldLabel htmlFor={`${id}-easing`}>Curve</FieldLabel>
        <EasingCurvePicker
          id={`${id}-easing`}
          value={preset}
          options={EASING_PRESETS}
          onChange={onPresetChange}
          align={room.align}
          side={room.side}
          fullWidth
          popoverClassName="max-h-(--epe-split-popover-h)"
        />
      </div>

      {/* Summary */}
      <div className="rounded-[12px] border border-border/60 bg-background/40 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2 font-mono tabular-nums">
          <span className="text-muted-foreground">
            {clipsLabel(sections.length)} · avg {avgSection.toFixed(1)}s
          </span>
          <span className="font-semibold">{formatTime(totalOutput)} total</span>
        </div>
        {sections.length >= MAX_SECTIONS && (
          <p className="mt-1.5 text-[11px] text-(color:--warning-foreground)">
            At the {MAX_SECTIONS}-clip maximum.
          </p>
        )}
        {sections.some((s) => s.duration < MIN_SECTION_DURATION + 0.05) && (
          <p className="mt-1.5 text-[11px] text-(color:--warning-foreground)">Some clips are very short.</p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-2.5 [@container_epe-split_(max-height:360px)]:border-t-0 [@container_epe-split_(max-height:360px)]:pt-0 @min-[880px]/epe:pt-4">
        <div className="hidden items-center justify-between @min-[720px]/epe:flex">
          <button
            type="button"
            onClick={onClearSplits}
            disabled={splitCount === 0}
            className="relative h-8 rounded-sm px-2 text-xs text-muted-foreground underline-offset-4 after:absolute after:inset-x-0 after:inset-y-[-4px] after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40 disabled:no-underline"
          >
            Clear splits
          </button>
          <span className="max-w-[180px] truncate text-[11px] text-muted-foreground" title={SOURCE_NAME}>
            {SOURCE_NAME}
          </span>
        </div>
        <div className="flex gap-2">
          <EpeButton
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={mode === "edit"}
            className="gap-2"
            aria-label="Back"
            title={mode === "sequence" ? "Back to the split points" : undefined}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden @min-[700px]/epe:inline">Back</span>
          </EpeButton>
          <EpeButton
            type="button"
            onClick={onCreate}
            disabled={sections.length === 0}
            className="flex-1 gap-2"
          >
            <Scissors className="h-4 w-4" />
            Create {clipsLabel(sections.length)}
          </EpeButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Phone tiles have no room for the aside: the curve and Create (or Back,
 * while the sequence plays) sit in one row under the track.
 */
export function SplitPhoneBar({
  mode,
  sectionCount,
  preset,
  onPresetChange,
  onBack,
  onCreate,
  boundsRef,
  className,
}: {
  mode: "edit" | "sequence";
  sectionCount: number;
  preset: string;
  onPresetChange: (preset: string) => void;
  onBack: () => void;
  onCreate: () => void;
  boundsRef: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const id = useId();
  const curveRef = useRef<HTMLDivElement>(null);
  const room = usePopoverRoom(curveRef, boundsRef, { side: "top", align: "start", maxHeight: 280 });

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      {mode === "sequence" && (
        <EpeButton type="button" variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </EpeButton>
      )}
      <div
        ref={curveRef}
        className="min-w-0 flex-1 [&_[role=listbox]_[role=presentation]]:filter-none!"
        style={{ "--epe-split-popover-h": `${room.maxHeight}px` } as CSSProperties}
      >
        <label htmlFor={`${id}-easing`} className="sr-only">
          Curve
        </label>
        <EasingCurvePicker
          id={`${id}-easing`}
          value={preset}
          options={EASING_PRESETS}
          onChange={onPresetChange}
          align={room.align}
          side={room.side}
          fullWidth
          popoverClassName="max-h-(--epe-split-popover-h)"
        />
      </div>
      {mode === "edit" && (
        <EpeButton type="button" onClick={onCreate} disabled={sectionCount === 0} className="gap-2">
          <Scissors className="h-4 w-4" />
          Create {clipsLabel(sectionCount)}
        </EpeButton>
      )}
    </div>
  );
}
