"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { MotionValue } from "motion/react";
import { Trash2 } from "lucide-react";

import {
  emphasisAnchorVideoTime,
  firstBeatVideoTime,
  type BeatSubdivision,
  type WaveformData,
} from "@/lib/easy-peasy-ease/beat-sync";
import { cn } from "@/lib/utils";

import { EpeButton } from "../kit/epe-button";
import { BeatSyncControl } from "./beat-sync-control";
import { AudioScrubber } from "./waveform";

/**
 * Port of easy-peasy-ease/components/AudioWaveformVisualization.tsx: the
 * audio lane under the timeline (waveform, offset drag, beat grid, beat pill).
 *
 * Changes from the product:
 * - The drag/keyboard surface is a layer inside the lane, and the pill and
 *   the remove button are siblings of the lane instead of its children, so
 *   they stay real buttons to assistive tech. The surface is a slider:
 *   arrows nudge the offset by 0.01 s (Shift 0.1 s), or by one beat while
 *   snapping; Enter/Space selects.
 * - Below 640px (container) the pill and the remove button sit in a row
 *   above the lane, which is h-14 like the clip track, instead of covering
 *   most of a phone-width waveform. From 640px they overlay it as shipped.
 * - The drag surface is touch-action: pan-y so a vertical swipe still
 *   scrolls the page on phones.
 * - `currentTime` may be a motion value (progress line without re-renders).
 * - Pulse gating/phase-lock props pass through to BeatSyncControl.
 */

interface AudioWaveformVisualizationProps {
  waveformData: WaveformData | null;
  fileName?: string;
  isLoading?: boolean;
  onRemove?: () => void;
  currentTime?: number | MotionValue<number>;
  timelineDuration: number;
  onSelect?: () => void;
  isSelected?: boolean;
  trackWidth: number;
  pixelsPerSecond: number;
  offset?: number;
  onOffsetChange?: (offset: number) => void;
  onOffsetCommit?: () => void;
  /** Active beat-snap subdivision; 0 = off. */
  beatSubdivision?: BeatSubdivision | 0;
  onBeatSubdivisionChange?: (value: BeatSubdivision | 0) => void;
  /** Re-render CTA inside the beat pill (shown while snapping is active). */
  onBeatApply?: () => void;
  isBeatUpdating?: boolean;
  /** Portfolio: playback is running (phase-locks the tempo dot). */
  isPlaying?: boolean;
  /** Portfolio: the demo is on screen (runs the tempo dot). */
  pulseActive?: boolean;
}

/** easy-peasy-ease/lib/beat-detection MIN_ANALYSIS_SECONDS. */
const MIN_ANALYSIS_SECONDS = 8;

const positiveModulo = (value: number, modulus: number): number => {
  const result = value % modulus;
  return result < 0 ? result + modulus : result;
};

export function AudioWaveformVisualization({
  waveformData,
  fileName = "Audio Track",
  isLoading = false,
  onRemove,
  currentTime = 0,
  timelineDuration,
  onSelect,
  isSelected = false,
  trackWidth,
  pixelsPerSecond,
  offset = 0,
  onOffsetChange,
  onOffsetCommit,
  beatSubdivision = 0,
  onBeatSubdivisionChange,
  onBeatApply,
  isBeatUpdating = false,
  isPlaying = false,
  pulseActive = true,
}: AudioWaveformVisualizationProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localOffset, setLocalOffset] = useState<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const onOffsetChangeRef = useRef(onOffsetChange);
  const onOffsetCommitRef = useRef(onOffsetCommit);
  const localOffsetRef = useRef<number | null>(null);

  // Use local offset during drag, otherwise use prop
  const effectiveOffset = localOffset ?? offset;

  // Keep refs updated
  useEffect(() => {
    pixelsPerSecondRef.current = pixelsPerSecond;
  }, [pixelsPerSecond]);

  useEffect(() => {
    onOffsetChangeRef.current = onOffsetChange;
  }, [onOffsetChange]);

  useEffect(() => {
    onOffsetCommitRef.current = onOffsetCommit;
  }, [onOffsetCommit]);

  useEffect(() => {
    localOffsetRef.current = localOffset;
  }, [localOffset]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!onOffsetChangeRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      // Capture pointer for reliable drag tracking
      e.currentTarget.setPointerCapture(e.pointerId);

      setIsDragging(true);
      dragStartXRef.current = e.clientX;
      dragStartOffsetRef.current = offset;
      pixelsPerSecondRef.current = pixelsPerSecond;
      setLocalOffset(offset); // Initialize local offset
    },
    [offset, pixelsPerSecond],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const deltaX = e.clientX - dragStartXRef.current;
      const pps = pixelsPerSecondRef.current;
      if (pps <= 0) return;
      const deltaSeconds = deltaX / pps;
      const rawOffset = dragStartOffsetRef.current + deltaSeconds;
      // Snap to 0.01 second increments for fine control
      const newOffset = Math.round(rawOffset * 100) / 100;
      setLocalOffset(newOffset); // Update local state only during drag
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      const finalOffset = localOffsetRef.current;
      if (finalOffset !== null && finalOffset !== dragStartOffsetRef.current) {
        onOffsetChangeRef.current?.(finalOffset); // Commit final value to parent
        onOffsetCommitRef.current?.();
      }
      setLocalOffset(null); // Clear local state
    };

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
    };
  }, [isDragging]);

  const audioDurationSeconds = waveformData?.duration ?? 0;
  const peaks = waveformData?.peaks;
  const totalPeaks = peaks?.length ?? 0;

  // Calculate which portion of the audio maps to the visible timeline
  // effectiveOffset > 0: audio is delayed (silence at start, audio starts later)
  // effectiveOffset < 0: audio is trimmed (skip beginning of audio)
  const audioStartTime = -effectiveOffset;
  const audioEndTime = audioStartTime + timelineDuration;
  const peaksPerSecond = audioDurationSeconds > 0 ? totalPeaks / audioDurationSeconds : 0;
  const startPeakIndex = Math.max(0, Math.floor(audioStartTime * peaksPerSecond));
  const endPeakIndex = Math.min(totalPeaks, Math.ceil(audioEndTime * peaksPerSecond));

  // Sliced only when the visible range moves, so the canvas redraws only then.
  const visiblePeaks = useMemo(
    () => (peaks ? peaks.slice(startPeakIndex, endPeakIndex) : []),
    [peaks, startPeakIndex, endPeakIndex],
  );

  if (!waveformData) {
    return null;
  }

  const handleSelect = () => {
    if (isDragging) return;
    onSelect?.();
  };

  const beats = waveformData.beats;
  const snapping = beatSubdivision !== 0 && beats !== null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      if (!onSelect) return;
      event.preventDefault();
      onSelect();
      return;
    }
    if (!onOffsetChange) return;
    const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    // While snapping the parent quantizes to the nearest beat, so step a whole beat.
    const step = snapping ? beats.period : event.shiftKey ? 0.1 : 0.01;
    onOffsetChange(Math.round((offset + direction * step) * 1000) / 1000);
    onOffsetCommit?.();
  };

  // Calculate padding at the start if offset > 0 (delay - silence at beginning)
  const silenceAtStart = Math.max(0, effectiveOffset);
  const silenceWidthPixels = silenceAtStart * pixelsPerSecond;
  const waveformWidthPixels = Math.max(0, trackWidth - silenceWidthPixels);

  // Beat ticks: faint lines on every beat (anchored to the audio, so they
  // follow the waveform live while dragging), plus brighter lines marking the
  // active every-Nth-beat grid section boundaries snap to. Rendered as
  // repeating gradients — two layers regardless of beat count. The layer is
  // clipped to the source audio's span: past its end the track loop-fills
  // from an arbitrary point, so the extrapolated grid would be a lie there.
  const beatTicks = (() => {
    if (!beats || pixelsPerSecond <= 0) {
      return null;
    }
    const periodPx = beats.period * pixelsPerSecond;
    if (periodPx < 4) {
      return null; // zoomed out too far for ticks to read
    }
    const layerStartTime = Math.max(0, effectiveOffset); // where audio begins
    const layerEndTime = Math.min(timelineDuration, effectiveOffset + audioDurationSeconds);
    const leftPx = layerStartTime * pixelsPerSecond;
    const widthPx = Math.min(trackWidth, layerEndTime * pixelsPerSecond) - leftPx;
    if (widthPx <= 0) {
      return null;
    }
    const firstBeat = firstBeatVideoTime(beats, effectiveOffset);
    const faintPhasePx = positiveModulo(firstBeat - layerStartTime, beats.period) * pixelsPerSecond;
    let emphasis: { spacingPx: number; phasePx: number } | null = null;
    if (beatSubdivision !== 0) {
      const groupPeriod = beats.period * beatSubdivision;
      const anchor = emphasisAnchorVideoTime(beats, effectiveOffset);
      emphasis = {
        spacingPx: groupPeriod * pixelsPerSecond,
        phasePx: positiveModulo(anchor - layerStartTime, groupPeriod) * pixelsPerSecond,
      };
    }
    return { leftPx, widthPx, periodPx, faintPhasePx, emphasis };
  })();

  const offsetText = `${effectiveOffset >= 0 ? "+" : "−"}${Math.abs(effectiveOffset).toFixed(2)} s`;
  const offsetMin = 0 - Math.round(audioDurationSeconds);

  return (
    <div className="relative" style={{ width: `${trackWidth}px` }}>
      {/* A row of its own on phones; display: contents from 640px, where both
          overlay the lane (positioned against this wrapper, 1px border in). */}
      <div className="mb-1.5 flex items-center gap-2 @min-[640px]/epe:contents">
        {beats && onBeatSubdivisionChange && (
          <BeatSyncControl
            bpm={beats.bpm}
            period={beats.period}
            value={beatSubdivision}
            onValueChange={onBeatSubdivisionChange}
            onApply={onBeatApply}
            isUpdating={isBeatUpdating}
            pulsePaused={!pulseActive}
            pulseClock={
              typeof currentTime === "number"
                ? undefined
                : { time: currentTime, beatTime: firstBeatVideoTime(beats, effectiveOffset), locked: isPlaying }
            }
            // Capped so it wraps instead of reaching under the remove button.
            className="z-10 flex-wrap @min-[640px]/epe:absolute @min-[640px]/epe:top-[9px] @min-[640px]/epe:left-[9px] @min-[640px]/epe:max-w-[calc(100%-3.5rem)]"
          />
        )}
        {/* Analysis ran on a full-length track but found no steady grid. */}
        {!beats && onBeatSubdivisionChange && audioDurationSeconds >= MIN_ANALYSIS_SECONDS && (
          <span className="pointer-events-none z-10 rounded-[8px] border border-border/70 bg-background/85 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm @min-[640px]/epe:absolute @min-[640px]/epe:top-[9px] @min-[640px]/epe:left-[9px]">
            No steady beat
          </span>
        )}
        {onRemove && (
          <EpeButton
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${fileName} audio track`}
            className="z-10 ml-auto text-muted-foreground hover:bg-secondary/80 hover:text-foreground @min-[640px]/epe:absolute @min-[640px]/epe:top-[9px] @min-[640px]/epe:right-[9px]"
            onClick={onRemove}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4" />
          </EpeButton>
        )}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[8px] border border-border bg-secondary/20 transition",
          isSelected && "border-primary shadow-lg ring-2 ring-primary",
        )}
      >
        {/* Drag + keyboard surface (the product puts these on the track itself). */}
        <div
          role="slider"
          tabIndex={0}
          aria-label={`${fileName} offset`}
          aria-orientation="horizontal"
          aria-valuemin={offsetMin}
          aria-valuemax={Math.round(timelineDuration)}
          aria-valuenow={Math.round(effectiveOffset * 100) / 100}
          aria-valuetext={offsetText}
          onClick={handleSelect}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          className={cn(
            "absolute inset-0 z-[1] touch-pan-y rounded-[7px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-inset",
            onSelect && !onOffsetChange && "cursor-pointer",
            onOffsetChange && !isDragging && "cursor-grab",
            isDragging && "cursor-grabbing",
          )}
        />
        <div className="flex h-14 @min-[640px]/epe:h-[72px]">
          {/* Silence/gap at the start when offset > 0 */}
          {silenceWidthPixels > 0 && (
            <div className="shrink-0 bg-secondary/30" style={{ width: `${silenceWidthPixels}px` }} />
          )}
          {/* The actual waveform */}
          {waveformWidthPixels > 0 && visiblePeaks.length > 0 && (
            <div style={{ width: `${waveformWidthPixels}px` }} className="h-full shrink-0">
              <AudioScrubber
                data={visiblePeaks}
                currentTime={currentTime}
                startTime={silenceAtStart}
                duration={Math.max(0, timelineDuration - silenceAtStart)}
                height="100%"
                barWidth={3}
                barGap={1}
                barRadius={2}
                showHandle={false}
                fadeEdges={false}
                className="bg-secondary/50 [--foreground:var(--primary)]"
              />
            </div>
          )}
        </div>

        {/* Beat grid */}
        {beatTicks && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{ left: `${beatTicks.leftPx}px`, width: `${beatTicks.widthPx}px` }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, color-mix(in srgb, var(--primary) 30%, transparent) 0 1px, transparent 1px ${beatTicks.periodPx}px)`,
                backgroundPositionX: `${beatTicks.faintPhasePx}px`,
              }}
            />
            {beatTicks.emphasis && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(90deg, color-mix(in srgb, var(--primary) 80%, transparent) 0 2px, transparent 2px ${beatTicks.emphasis.spacingPx}px)`,
                  backgroundPositionX: `${beatTicks.emphasis.phasePx}px`,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
