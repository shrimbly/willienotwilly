"use client";

import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

import type { RetimeClip } from "./retime-engine";
import type { RetimedPlayback } from "./use-retimed-playback";

interface RetimedVideoProps {
  playback: Pick<RetimedPlayback, "clips" | "registerVideo" | "activeIndex">;
  className?: string;
  /** Classes for every <video> (default: h-full w-full object-contain). */
  videoClassName?: string;
}

/**
 * The stacked <video> elements a useRetimedPlayback drives: one per clip,
 * muted and inline, preload="none" with the clip's poster until the engine
 * is enabled. Only the clip on screen is opaque (data-active, set by the
 * engine). Decorative to assistive tech; give the surrounding demo the label.
 */
export function RetimedVideo({ playback, className, videoClassName }: RetimedVideoProps) {
  // The engine owns data-active after mount; React only sets the first value.
  const [initialIndex] = useState(playback.activeIndex);
  return (
    <div className={cn("relative h-full w-full", className)} aria-hidden="true">
      {playback.clips.map((clip, index) => (
        <RetimedVideoSlot
          key={clip.id}
          clip={clip}
          index={index}
          register={playback.registerVideo}
          initiallyActive={index === initialIndex}
          className={videoClassName}
        />
      ))}
    </div>
  );
}

function RetimedVideoSlot({
  clip,
  index,
  register,
  initiallyActive,
  className,
}: {
  clip: RetimeClip;
  index: number;
  register: RetimedPlayback["registerVideo"];
  initiallyActive: boolean;
  className?: string;
}) {
  const ref = useCallback(
    (video: HTMLVideoElement) => {
      register(index, video);
      return () => {
        register(index, null);
        // Unmounted rather than re-registered under a new index: release the
        // decoder and any download now instead of at garbage collection.
        queueMicrotask(() => {
          if (video.isConnected) return;
          video.removeAttribute("src");
          video.load();
        });
      };
    },
    [index, register],
  );

  return (
    <video
      ref={ref}
      src={clip.src}
      poster={clip.poster}
      muted
      playsInline
      preload="none"
      disablePictureInPicture
      disableRemotePlayback
      tabIndex={-1}
      data-active={initiallyActive}
      className={cn(
        "absolute inset-0 h-full w-full object-contain opacity-0 data-[active=true]:opacity-100",
        className,
      )}
    />
  );
}
