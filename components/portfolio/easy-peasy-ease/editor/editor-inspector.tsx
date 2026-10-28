"use client";

import { useId, useRef } from "react";
import type { ComponentProps, KeyboardEvent } from "react";
import type { MotionValue } from "motion/react";

import { EASING_PRESETS, type Bezier } from "@/lib/easy-peasy-ease/easing-presets";
import { cn } from "@/lib/utils";

import { CubicBezierEditor } from "../kit/cubic-bezier-editor";
import { EasingCurvePicker } from "../kit/easing-curve-picker";
import { EpeButton } from "../kit/epe-button";
import { FieldLabel, fieldLabelClassName } from "../kit/field-label";
import { ScrubbableNumberField } from "../kit/scrubbable-number-field";
import {
  SegmentedControlIndicator,
  inspectorTabClassName,
  inspectorTabsListClassName,
} from "../kit/segmented-control";
import { MAX_CLIP_SECONDS, MIN_CLIP_SECONDS, type EditorClip } from "./editor-clips";

const TABS = ["Video", "Audio"] as const;

interface EditorInspectorProps extends Omit<ComponentProps<"aside">, "children"> {
  clip: EditorClip;
  clipIndex: number;
  tab: 0 | 1;
  onTabChange: (tab: 0 | 1) => void;
  onSecondsChange: (duration: number) => void;
  onPresetChange: (preset: string) => void;
  onBezierChange: (bezier: Bezier) => void;
  onUpdateClip: () => void;
  onUpdateAll: () => void;
  /** Curve x of the clip on screen, when it is this clip (draws the riding dot). */
  progress?: MotionValue<number>;
  /** Phones open the curve popover upwards (it sits at the bottom of the tile). */
  pickerSide: "top" | "bottom";
  showHint: boolean;
}

/**
 * The FinalVideoEditor inspector (Video / Audio tabs, clip header, Seconds,
 * Curve, CubicBezierEditor, Update buttons) with the product's classes. Its
 * layout per tile shape lives in editor-demo.css.
 */
export function EditorInspector({
  clip,
  clipIndex,
  tab,
  onTabChange,
  onSecondsChange,
  onPresetChange,
  onBezierChange,
  onUpdateClip,
  onUpdateAll,
  progress,
  pickerSide,
  showHint,
  className,
  ...props
}: EditorInspectorProps) {
  const uid = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === 0 ? 1 : 0;
    onTabChange(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <aside
      className={cn(
        "epe-editor-inspector flex h-full min-h-0 flex-col rounded-[12px] border border-border bg-secondary p-3",
        className,
      )}
      {...props}
    >
      <div className="epe-editor-tabs">
        <div role="tablist" aria-label="Inspector" className={inspectorTabsListClassName}>
          <SegmentedControlIndicator activeIndex={tab} className="bg-accent" />
          {TABS.map((name, i) => (
            <button
              key={name}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${i}`}
              aria-selected={tab === i}
              aria-controls={`${uid}-panel-${i}`}
              tabIndex={tab === i ? 0 : -1}
              data-state={tab === i ? "active" : "inactive"}
              onClick={() => onTabChange(i as 0 | 1)}
              onKeyDown={handleTabKeyDown}
              className={inspectorTabClassName}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div
          role="tabpanel"
          id={`${uid}-panel-0`}
          aria-labelledby={`${uid}-tab-0`}
          hidden={tab !== 0}
          className="h-full"
        >
          <div className="epe-editor-panel">
            <div className="epe-editor-header flex min-w-0 items-center gap-3">
              <div className="flex shrink-0 items-center gap-3">
                <h4 className="text-lg font-semibold text-foreground">Clip {clipIndex + 1}</h4>
                {clip.loopIteration > 1 && (
                  <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Loop {clip.loopIteration}
                  </span>
                )}
              </div>
              <p
                className="ml-auto min-w-0 truncate text-right text-xs text-muted-foreground"
                title={clip.source.name}
              >
                {clip.source.name}
              </p>
            </div>

            <div className="epe-editor-body">
              <div className="epe-editor-fields">
                <div className="shrink-0 space-y-1.5">
                  <FieldLabel htmlFor={`${uid}-duration`}>Seconds</FieldLabel>
                  <ScrubbableNumberField
                    key={clip.id}
                    id={`${uid}-duration`}
                    label="Clip duration"
                    min={MIN_CLIP_SECONDS}
                    max={MAX_CLIP_SECONDS}
                    step={0.01}
                    scrubStep={0.01}
                    precision={2}
                    unit="seconds"
                    value={clip.duration}
                    onChange={onSecondsChange}
                    className="w-32"
                  />
                </div>
                <div className="epe-editor-curve-field min-w-0 space-y-1.5">
                  <FieldLabel htmlFor={`${uid}-curve`}>Curve</FieldLabel>
                  <EasingCurvePicker
                    id={`${uid}-curve`}
                    value={clip.preset}
                    options={EASING_PRESETS}
                    onChange={onPresetChange}
                    side={pickerSide}
                    popoverClassName={
                      pickerSide === "top"
                        ? "max-h-[calc(100cqh_-_5rem)] w-[min(18rem,calc(100cqw_-_1.5rem))]"
                        : "max-h-[min(420px,calc(100cqh_-_13rem))]"
                    }
                    fullWidth
                  />
                </div>
              </div>

              <div className="epe-editor-curve">
                <div className="epe-editor-curve-box relative">
                  <CubicBezierEditor
                    value={clip.bezier}
                    onChange={onBezierChange}
                    progress={progress}
                    aspect="square"
                    plotClassName="max-w-none"
                    className="min-w-0"
                  />
                  {/* Upper left, under the top edge: clear of the in-out curves and their handles. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      fieldLabelClassName,
                      "epe-editor-hint pointer-events-none absolute left-3 top-[16%] leading-[1.4] transition-opacity duration-300 motion-reduce:transition-none",
                      !showHint && "opacity-0",
                    )}
                  >
                    Drag a
                    <br />
                    handle
                  </span>
                </div>

                <div className="epe-editor-actions gap-2">
                  <EpeButton size="sm" variant="outline" onClick={onUpdateClip} className="flex-1 gap-2">
                    Update Clip
                  </EpeButton>
                  <EpeButton
                    size="sm"
                    onClick={onUpdateAll}
                    className="flex-1 gap-2 bg-(color:--brand-strong) hover:bg-(color:--brand-strong)/90"
                  >
                    Update All Clips
                  </EpeButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${uid}-panel-1`}
          aria-labelledby={`${uid}-tab-1`}
          hidden={tab !== 1}
          className="h-full"
        >
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-(color:--body-muted-foreground)">
            <p>Upload an audio track in the timeline to configure audio settings.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
