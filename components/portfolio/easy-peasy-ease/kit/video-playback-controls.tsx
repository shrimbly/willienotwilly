"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { MotionValue } from "motion/react";
import { Pause, Play } from "lucide-react";

import { formatTime } from "@/lib/easy-peasy-ease/timeline-utils";

import { EpeButton } from "./epe-button";
import { followValue, isNumberMotionValue } from "./motion-value-utils";

/**
 * Port of easy-peasy-ease/components/VideoPlaybackControls.tsx. `currentTime`
 * may be a motion value; the MM:SS readout then updates in place. md:/sm:
 * variants follow the EpeRoot container.
 */
interface VideoPlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number | MotionValue<number>;
  duration: number;
  onPlayPause: () => void;
  /** Bytes; shows "Size: x.xxMB" from 640px. */
  videoSize?: number;
  actions?: ReactNode;
}

export function VideoPlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  videoSize,
  actions,
}: VideoPlaybackControlsProps) {
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = timeRef.current;
    if (!node) return;
    let last = "";
    const update = (time: number) => {
      const next = formatTime(time);
      if (next !== last) {
        last = next;
        // Edit React's own text node so later renders stay in sync.
        if (node.firstChild) node.firstChild.nodeValue = next;
        else node.textContent = next;
      }
    };
    return followValue(currentTime, update);
  }, [currentTime]);

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 @min-[768px]/epe:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 @min-[768px]/epe:gap-4">
        <EpeButton
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={onPlayPause}
          className="shrink-0"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="size-6" /> : <Play className="ml-0.5 size-7" />}
        </EpeButton>

        <div className="flex min-w-0 flex-1 items-center gap-3 @min-[768px]/epe:gap-6">
          <div className="whitespace-nowrap font-mono text-xs font-medium tabular-nums text-muted-foreground @min-[768px]/epe:text-sm">
            <span ref={timeRef}>{formatTime(isNumberMotionValue(currentTime) ? 0 : currentTime)}</span> /{" "}
            {formatTime(duration)}
          </div>

          {actions && (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 @min-[768px]/epe:gap-3">
              {actions}
            </div>
          )}
        </div>
      </div>

      {videoSize !== undefined && (
        <div className="hidden shrink-0 items-center gap-4 font-mono text-xs text-muted-foreground @min-[640px]/epe:flex">
          <span>Size: {(videoSize / 1024 / 1024).toFixed(2)}MB</span>
        </div>
      )}
    </div>
  );
}
