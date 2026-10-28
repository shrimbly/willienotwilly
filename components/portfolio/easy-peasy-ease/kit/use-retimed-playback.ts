"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MotionValue } from "motion/react";

import { createRetimeMap, type RetimeMap } from "@/lib/easy-peasy-ease/speed-curve";

import {
  RetimeEngine,
  clipsToSections,
  type RetimeClip,
  type RetimeStats,
  type RetimeStrategy,
} from "./retime-engine";

export type { RetimeClip, RetimeStats, RetimeStrategy } from "./retime-engine";

export interface RetimedPlaybackOptions {
  /** Clips stitched back to back. Memoise this array; a new identity rebuilds the map. */
  clips: RetimeClip[];
  /**
   * Allowed to load and run (e.g. useDemoActive().inView). While false the
   * clock is frozen, videos are paused and nothing loads (posters show).
   */
  enabled: boolean;
  /**
   * Autoplay gate (e.g. useDemoActive().active). Rising edge starts playback
   * unless the visitor paused; falling edge stops an autoplay (a play the
   * visitor started keeps going while `enabled`).
   */
  autoPlay?: boolean;
  /** Starting output time, seconds; also the reduced-motion resting frame. */
  initialTime?: number;
  /** Wrap at the end (default true). */
  loop?: boolean;
  /** Output clock speed, 1 = real time. */
  clockRate?: number;
  /** "seek" (default, frame-exact) or "rate" (playbackRate following the curve). */
  strategy?: RetimeStrategy;
}

export interface RetimedPlayback {
  clips: RetimeClip[];
  /** Pure mapping for these clips: map.sourceAt(t), map.speedAt(i, p), map.starts. */
  map: RetimeMap;
  totalDuration: number;
  /** Output clock, seconds. Subscribe; do not read in render. */
  time: MotionValue<number>;
  clipIndex: MotionValue<number>;
  /** Curve x for the current clip, 0–1. */
  clipProgress: MotionValue<number>;
  /** Curve y for the current clip, 0–1. */
  clipEased: MotionValue<number>;
  sourceTime: MotionValue<number>;
  /** Instantaneous speed vs real time (×N readouts). */
  speed: MotionValue<number>;
  /** React state; changes on play/pause only. */
  isPlaying: boolean;
  /** React state; the clip on screen (changes at cuts, not per frame). */
  activeIndex: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  /** Used by <RetimedVideo>; attach a <video> per clip index. */
  registerVideo: (index: number, video: HTMLVideoElement | null) => void;
  getStats: () => RetimeStats;
  resetStats: () => void;
}

/**
 * Drives one <video> per clip so output time maps through each clip's ease
 * curve (see retime-engine.ts). Per-frame values are motion values; React
 * state only changes on play/pause and at cuts. Render the videos with
 * <RetimedVideo playback={...} />.
 */
export function useRetimedPlayback({
  clips,
  enabled,
  autoPlay = false,
  initialTime = 0,
  loop = true,
  clockRate = 1,
  strategy = "seek",
}: RetimedPlaybackOptions): RetimedPlayback {
  const map = useMemo(() => createRetimeMap(clipsToSections(clips)), [clips]);
  const [engine] = useState(
    () => new RetimeEngine({ clips, map, initialTime, loop, clockRate, strategy }),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => engine.activeIndex);
  const userPausedRef = useRef(false);
  const autoPlayingRef = useRef(false);

  useEffect(() => {
    engine.attach({ onPlayingChange: setIsPlaying, onActiveIndexChange: setActiveIndex });
    return () => engine.detach();
  }, [engine]);

  useEffect(() => {
    engine.setClips(clips, map);
  }, [engine, clips, map]);

  useEffect(() => {
    engine.setLoop(loop);
    engine.setClockRate(clockRate);
    engine.setStrategy(strategy);
  }, [engine, loop, clockRate, strategy]);

  useEffect(() => {
    engine.setEnabled(enabled);
  }, [engine, enabled]);

  useEffect(() => {
    if (autoPlay && enabled && !userPausedRef.current && !engine.isPlaying) {
      autoPlayingRef.current = true;
      engine.play();
    } else if (!autoPlay && autoPlayingRef.current) {
      autoPlayingRef.current = false;
      engine.pause();
    }
  }, [engine, autoPlay, enabled]);

  const play = useCallback(() => {
    userPausedRef.current = false;
    autoPlayingRef.current = false;
    engine.play();
  }, [engine]);

  const pause = useCallback(() => {
    userPausedRef.current = true;
    autoPlayingRef.current = false;
    engine.pause();
  }, [engine]);

  const toggle = useCallback(() => {
    if (engine.isPlaying) pause();
    else play();
  }, [engine, pause, play]);

  const seek = useCallback((time: number) => engine.seek(time), [engine]);
  const registerVideo = useCallback(
    (index: number, video: HTMLVideoElement | null) => engine.registerVideo(index, video),
    [engine],
  );
  const getStats = useCallback(() => engine.getStats(), [engine]);
  const resetStats = useCallback(() => engine.resetStats(), [engine]);

  return {
    clips,
    map,
    totalDuration: map.total,
    time: engine.time,
    clipIndex: engine.clipIndex,
    clipProgress: engine.clipProgress,
    clipEased: engine.clipEased,
    sourceTime: engine.sourceTime,
    speed: engine.speed,
    isPlaying,
    activeIndex,
    play,
    pause,
    toggle,
    seek,
    registerVideo,
    getStats,
    resetStats,
  };
}
