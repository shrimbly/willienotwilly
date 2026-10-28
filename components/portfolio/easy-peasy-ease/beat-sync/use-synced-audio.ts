"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";

interface SyncedAudioOptions {
  src: string;
  /** Output clock, seconds (loops over totalDuration). */
  time: MotionValue<number>;
  /** The output clock is running. */
  playing: boolean;
  /** Sound is wanted: the visitor turned it on, a track is present and the demo is on screen. */
  enabled: boolean;
  /** Product semantics: positive delays the audio (silence first), negative trims its start. */
  offset: number;
  totalDuration: number;
  /** Fade envelope at the start and end of the output, seconds (the product's audio prep). */
  fadeIn: number;
  fadeOut: number;
}

type AudioContextConstructor = typeof AudioContext;

interface AudioSyncStats {
  /** Buffer sources started (plays, loop wraps, seeks, drift corrections). */
  starts: number;
  /** Heard position minus playhead, seconds, per frame. */
  drift: number[];
}

/** Restart the source only when it is audibly off the playhead. */
const DRIFT_TOLERANCE = 0.035;

/**
 * Lays the track under the playhead the way the product's render does:
 * audio time = output time − offset, looped to fill, restarted when the output
 * loops, with the fade envelope as gain.
 *
 * Web Audio rather than an <audio> element: a buffer source starts at an exact
 * position, so a cut and its kick stay together without the repeated seeks
 * (and audible stutter) a media element needs to chase a moving clock.
 * Nothing is fetched or created until `unlock()` runs from the visitor's click.
 */
export function useSyncedAudio({
  src,
  time,
  playing,
  enabled,
  offset,
  totalDuration,
  fadeIn,
  fadeOut,
}: SyncedAudioOptions) {
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const loadingRef = useRef(false);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(
    () => () => {
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  /** Call from the click that turns sound on (creates/resumes the context inside the gesture). */
  const unlock = useCallback(() => {
    // Let Web Audio play with the iPhone ring/silent switch on (Safari 16.4+).
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";

    let context = contextRef.current;
    if (!context) {
      const Constructor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
      if (!Constructor) return;
      context = new Constructor();
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      contextRef.current = context;
      gainRef.current = gain;
    }
    void context.resume();

    if (!loadingRef.current) {
      loadingRef.current = true;
      const decodeWith = context;
      fetch(src)
        .then((response) => {
          if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => decodeWith.decodeAudioData(data))
        .then(setBuffer)
        .catch(() => {
          loadingRef.current = false;
        });
    }
  }, [src]);

  const live = enabled && playing && pageVisible && buffer !== null;

  useEffect(() => {
    const context = contextRef.current;
    const gain = gainRef.current;
    if (!live || !context || !gain || !buffer) return;

    let source: AudioBufferSourceNode | null = null;
    // Track position (unwrapped, seconds) heard at context time `at`; negative = not started yet.
    let anchor = { position: 0, at: 0 };
    let lastTime = Number.NaN;
    // Dev-only accuracy readout for the screenshot harness.
    const stats =
      process.env.NODE_ENV === "production"
        ? null
        : ((window as unknown as { __epeBeatAudio?: AudioSyncStats }).__epeBeatAudio ??= {
            starts: 0,
            drift: [],
          });

    // Context time being heard right now: the output timestamp, interpolated
    // to this instant, is smooth where currentTime jumps a render callback at
    // a time and runs ahead of the speakers by the output latency.
    const heardNow = () => {
      const stamp = context.getOutputTimestamp?.();
      if (stamp?.contextTime !== undefined && stamp.performanceTime !== undefined && stamp.performanceTime > 0) {
        return stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000;
      }
      return context.currentTime - (context.outputLatency || 0);
    };

    const stop = () => {
      if (!source) return;
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
      source = null;
    };

    const start = (position: number) => {
      stop();
      const node = context.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      node.connect(gain);
      const now = context.currentTime;
      if (position >= 0) node.start(now, position % buffer.duration);
      else node.start(now - position, 0);
      source = node;
      anchor = { position, at: now };
      if (stats) stats.starts += 1;
    };

    const sync = (t: number) => {
      const envelope = Math.min(1, fadeIn > 0 ? t / fadeIn : 1, fadeOut > 0 ? (totalDuration - t) / fadeOut : 1);
      gain.gain.setTargetAtTime(Math.max(0, envelope), context.currentTime, 0.01);

      // A loop wrap or a seek: re-align at once.
      const jumped = !Number.isNaN(lastTime) && (t < lastTime - 0.05 || t > lastTime + 0.25);
      lastTime = t;
      if (context.state !== "running") return;

      // What should be heard with this frame, against what is being heard.
      const target = t - offset;
      const heard = heardNow();
      if (source && !jumped) {
        const position = anchor.position + (heard - anchor.at);
        if (stats && stats.drift.push(position - target) > 600) stats.drift.shift();
        if (Math.abs(position - target) < DRIFT_TOLERANCE) return;
      }
      // A source started now is heard one output latency later, so start that far ahead.
      start(target + Math.max(0, context.currentTime - heard));
    };

    sync(time.get());
    const unsubscribe = time.on("change", sync);
    return () => {
      unsubscribe();
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      stop();
    };
  }, [buffer, fadeIn, fadeOut, live, offset, time, totalDuration]);

  return { unlock };
}
