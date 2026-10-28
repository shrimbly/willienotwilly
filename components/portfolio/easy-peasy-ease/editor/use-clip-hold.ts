"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent, PointerEvent } from "react";

import type { RetimedPlayback } from "../kit/use-retimed-playback";

type HoldReason = "hover" | "focus" | "press" | "segment";

// Loop back this far before the clip's end so the next clip is never asked for
// (a 25fps frame step still lands inside the window).
const LOOP_GUARD_SECONDS = 0.04;

/**
 * The product auto-selects the clip under the playhead while it plays. The
 * hero plays on a loop, so that would pull the inspector away mid-edit.
 * Instead the inspector holds its clip while the visitor is in it (mouse
 * over, keyboard focus, a press or drag) or after they pick a clip in the
 * timeline, and while held, playback loops that clip so an edit shows up on
 * the next pass rather than three clips later.
 */
export function useClipHold({
  followIndex,
  playback,
}: {
  followIndex: number;
  playback: Pick<RetimedPlayback, "time" | "map" | "seek" | "isPlaying">;
}) {
  const [holdIndex, setHoldIndex] = useState<number | null>(null);
  const holdRef = useRef<number | null>(null);
  const reasonsRef = useRef(new Set<HoldReason>());
  const followRef = useRef(followIndex);
  const endPressRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    followRef.current = followIndex;
  }, [followIndex]);

  const setHold = useCallback((index: number | null) => {
    holdRef.current = index;
    setHoldIndex(index);
  }, []);

  const add = useCallback(
    (reason: HoldReason) => {
      reasonsRef.current.add(reason);
      if (holdRef.current === null) setHold(followRef.current);
    },
    [setHold],
  );

  const remove = useCallback(
    (...reasons: HoldReason[]) => {
      reasons.forEach((reason) => reasonsRef.current.delete(reason));
      if (reasonsRef.current.size === 0 && holdRef.current !== null) setHold(null);
    },
    [setHold],
  );

  useEffect(
    () => () => {
      endPressRef.current?.();
    },
    [],
  );

  const inspectorProps = useMemo(
    () => ({
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse") add("hover");
      },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        // Leaving with the mouse ends a click-focus or a timeline pick too.
        if (event.pointerType === "mouse") remove("hover", "focus", "segment");
      },
      onPointerDown: () => {
        add("press");
        endPressRef.current?.();
        const end = () => {
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", end);
          endPressRef.current = null;
          remove("press");
        };
        endPressRef.current = end;
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
      },
      onFocus: () => add("focus"),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) remove("focus");
      },
    }),
    [add, remove],
  );

  /** A clip picked in the timeline stays selected until the visitor moves on. */
  const holdSegment = useCallback(
    (index: number) => {
      reasonsRef.current.add("segment");
      setHold(index);
    },
    [setHold],
  );

  /** Scrubbing while held selects the clip under the playhead, as the product does. */
  const retarget = useCallback(
    (index: number) => {
      if (holdRef.current !== null && holdRef.current !== index) setHold(index);
    },
    [setHold],
  );

  const releaseSegment = useCallback(() => remove("segment"), [remove]);

  // Solo-loop the held clip. The seek is deferred to a microtask so it runs
  // after the engine's frame, never inside it.
  const { time, map, seek, isPlaying } = playback;
  useEffect(() => {
    if (!isPlaying) return;
    let queued = false;
    return time.on("change", (t) => {
      const index = holdRef.current;
      if (index === null || queued || index >= map.starts.length) return;
      const start = map.starts[index];
      const end = index + 1 < map.starts.length ? map.starts[index + 1] : map.total;
      if (t >= start && t < end - LOOP_GUARD_SECONDS) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        seek(start);
      });
    });
  }, [isPlaying, map, seek, time]);

  return { holdIndex, inspectorProps, holdSegment, retarget, releaseSegment };
}
