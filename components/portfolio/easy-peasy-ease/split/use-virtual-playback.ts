"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motionValue, type MotionValue } from "motion/react";

import { RetimeEngine } from "../kit/retime-engine";
import type { RetimedPlayback } from "../kit/use-retimed-playback";

import { SOURCE_CLIPS, type VirtualMap } from "./virtual-source";

interface VirtualPlaybackOptions {
  /** Current map (edit or sequence). Memoise it; a new identity is pushed to the engine. */
  map: VirtualMap;
  /** Allowed to load and run (useDemoActive().inView). */
  enabled: boolean;
  /** Autoplay gate (useDemoActive().active); a visitor's pause wins. */
  autoPlay: boolean;
  initialTime: number;
}

export interface VirtualPlayback extends Pick<RetimedPlayback, "clips" | "registerVideo" | "activeIndex"> {
  /** Output clock, seconds. */
  time: MotionValue<number>;
  /** Virtual source time on screen, seconds (drives the SplitTrack playhead). */
  sourceTime: MotionValue<number>;
  /** Section under the clock, and the curve's x through it. */
  section: MotionValue<number>;
  sectionProgress: MotionValue<number>;
  totalDuration: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Seek the output clock. */
  seek: (time: number) => void;
  /** Seek to whatever output time shows virtual source time `v` under the current map. */
  seekSource: (v: number) => void;
  /** Swap the map now (event handlers that seek right after a split change). */
  setMap: (map: VirtualMap) => void;
}

/**
 * useRetimedPlayback for the virtual source: the kit's RetimeEngine driving
 * one <video> per file, with a map that can be swapped between straight
 * playback and the eased sequence without remounting anything.
 */
export function useVirtualPlayback({
  map,
  enabled,
  autoPlay,
  initialTime,
}: VirtualPlaybackOptions): VirtualPlayback {
  const [engine] = useState(
    () => new RetimeEngine({ clips: SOURCE_CLIPS, map, initialTime, loop: true }),
  );
  const [values] = useState(() => {
    const sample = map.sectionAt(initialTime);
    return {
      sourceTime: motionValue(sample.sourceTime),
      section: motionValue(sample.index),
      sectionProgress: motionValue(sample.progress),
    };
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => engine.activeIndex);
  const mapRef = useRef(map);
  const userPausedRef = useRef(false);
  const autoPlayingRef = useRef(false);

  const sync = useCallback(
    (time: number) => {
      const sample = mapRef.current.sectionAt(time);
      values.sourceTime.set(sample.sourceTime);
      values.section.set(sample.index);
      values.sectionProgress.set(sample.progress);
    },
    [values],
  );

  const setMap = useCallback(
    (next: VirtualMap) => {
      if (mapRef.current === next) return;
      mapRef.current = next;
      engine.setClips(SOURCE_CLIPS, next);
      sync(engine.time.get());
    },
    [engine, sync],
  );

  useEffect(() => {
    engine.attach({ onPlayingChange: setIsPlaying, onActiveIndexChange: setActiveIndex });
    return () => engine.detach();
  }, [engine]);

  useEffect(() => engine.time.on("change", sync), [engine, sync]);

  useEffect(() => {
    setMap(map);
  }, [map, setMap]);

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

  const seek = useCallback(
    (time: number) => {
      engine.seek(time);
      sync(engine.time.get());
    },
    [engine, sync],
  );

  const seekSource = useCallback(
    (v: number) => seek(mapRef.current.outputFor(v)),
    [seek],
  );

  const registerVideo = useCallback(
    (index: number, video: HTMLVideoElement | null) => engine.registerVideo(index, video),
    [engine],
  );

  return {
    clips: SOURCE_CLIPS,
    registerVideo,
    activeIndex,
    time: engine.time,
    sourceTime: values.sourceTime,
    section: values.section,
    sectionProgress: values.sectionProgress,
    totalDuration: map.total,
    isPlaying,
    play,
    pause,
    toggle,
    seek,
    seekSource,
    setMap,
  };
}
