"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue } from "motion/react";

// Before and after, played together: lifted from the website's player (studiovoice/site/
// index.html, `prepare`, `startSources`, `applyVersion`). Both tracks are decoded through Web
// Audio and started on the same clock, each through its own gain, one of them silent, so
// holding ⌥ swaps them with no gap: the gains cross in 60 ms (the app's own mixer glides over
// about 30 ms, Audio/PreviewMixer.swift).

/** How long the gains take to cross (the site's FADE_S). */
const FADE_SECONDS = 0.06;

type Version = "before" | "after";

interface Engine {
  ctx: AudioContext;
  gains: Record<Version, GainNode>;
}

export interface CompareAudio {
  /** Playing now (the play button's state). */
  playing: boolean;
  /** The tracks are being fetched and decoded for the first play. */
  loading: boolean;
  /** The original is the one heard. */
  comparing: boolean;
  /** Where playback is, 0…1, every frame while playing (a motion value: no re-render). */
  playhead: ReturnType<typeof useMotionValue<number>>;
  /**
   * Starts fetching the two files ahead of play, on a clear sign it is coming (a mouse over the
   * play button, the keyboard on it, a press in the demo). Play then decodes those same bytes.
   */
  preload: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Hear the original (true) or Booth's (false); takes effect at once, playing or not. */
  setComparing: (comparing: boolean) => void;
  /** Jump to `fraction` (0…1) of the way through. */
  seek: (fraction: number) => void;
}

/**
 * Plays a before/after pair (e.g. WALKTHROUGH_AUDIO from lib/booth/walkthrough.ts) as one
 * player. The audio context is made in the first play's click, as Safari insists, and the files
 * are fetched then, unless `preload` has already started on them: nothing is fetched before.
 * `duration` (seconds) is the pair's length; `initial` (0…1) is where the playhead rests before
 * anything plays.
 */
export function useCompareAudio({
  before,
  after,
  duration,
  initial = 0,
}: {
  before: string;
  after: string;
  duration: number;
  initial?: number;
}): CompareAudio {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparingState] = useState(false);
  const playhead = useMotionValue(initial);
  const engine = useRef<Engine | null>(null);
  const bytes = useRef<Promise<Record<Version, ArrayBuffer>> | null>(null);
  const buffers = useRef<Promise<Record<Version, AudioBuffer>> | null>(null);
  const sources = useRef<AudioBufferSourceNode[]>([]);
  const startedAt = useRef(0);
  const offset = useRef(initial * duration);
  const isPlaying = useRef(false);
  const held = useRef(false);
  const frame = useRef(0);
  const wanted = useRef(false);

  const position = useCallback(() => {
    const e = engine.current;
    return Math.min(duration, isPlaying.current && e ? e.ctx.currentTime - startedAt.current : offset.current);
  }, [duration]);

  const stopSources = useCallback(() => {
    for (const source of sources.current) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Never started.
      }
      source.disconnect();
    }
    sources.current = [];
  }, []);

  // The playhead follows the audio clock every frame while playing.
  const follow = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const loop = () => {
      playhead.set(position() / duration);
      if (isPlaying.current) frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }, [duration, playhead, position]);

  const finish = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stopSources();
    isPlaying.current = false;
    wanted.current = false;
    offset.current = 0;
    playhead.set(0);
    setPlaying(false);
  }, [playhead, stopSources]);

  const startSources = useCallback(
    (decoded: Record<Version, AudioBuffer>, at: number) => {
      const e = engine.current;
      if (!e) return;
      stopSources();
      const when = e.ctx.currentTime + 0.04;
      sources.current = (["before", "after"] as const).map((version) => {
        const source = e.ctx.createBufferSource();
        source.buffer = decoded[version];
        source.connect(e.gains[version]);
        source.start(when, Math.min(at, decoded[version].duration - 0.01));
        return source;
      });
      sources.current[1].onended = () => {
        if (isPlaying.current) finish();
      };
      startedAt.current = when - at;
    },
    [finish, stopSources],
  );

  /** The two files' bytes, fetched once (again only after a failure). */
  const load = useCallback(() => {
    if (!bytes.current) {
      const pending = Promise.all([before, after].map((url) => fetch(url).then((response) => response.arrayBuffer()))).then(
        ([b, a]) => ({ before: b, after: a }),
      );
      bytes.current = pending;
      pending.catch(() => {
        if (bytes.current === pending) bytes.current = null;
      });
    }
    return bytes.current;
  }, [after, before]);

  const preload = useCallback(() => {
    if (!buffers.current) void load();
  }, [load]);

  // Made and resumed in the click itself; the tracks follow.
  const prepare = useCallback(() => {
    if (!engine.current) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Context();
      const gains = { before: ctx.createGain(), after: ctx.createGain() };
      for (const [version, gain] of Object.entries(gains) as [Version, GainNode][]) {
        gain.gain.value = (version === "before") === held.current ? 1 : 0;
        gain.connect(ctx.destination);
      }
      engine.current = { ctx, gains };
    }
    void engine.current.ctx.resume();
    if (!buffers.current) {
      const ctx = engine.current.ctx;
      const files = load();
      // Decoding takes the bytes over, so a failure fetches them afresh.
      bytes.current = null;
      buffers.current = files
        .then((data) => Promise.all([ctx.decodeAudioData(data.before), ctx.decodeAudioData(data.after)]))
        .then(([b, a]) => ({ before: b, after: a }));
      buffers.current.catch(() => {
        buffers.current = null;
      });
    }
    return buffers.current;
  }, [load]);

  const play = useCallback(() => {
    if (isPlaying.current || wanted.current) return;
    wanted.current = true;
    setLoading(true);
    setPlaying(true);
    prepare()
      .then((decoded) => {
        if (!wanted.current) return;
        startSources(decoded, offset.current >= duration - 0.05 ? 0 : offset.current);
        isPlaying.current = true;
        follow();
      })
      .catch(() => {
        wanted.current = false;
        setPlaying(false);
      })
      .finally(() => setLoading(false));
  }, [duration, follow, prepare, startSources]);

  const pause = useCallback(() => {
    wanted.current = false;
    if (isPlaying.current) offset.current = position();
    isPlaying.current = false;
    cancelAnimationFrame(frame.current);
    stopSources();
    setPlaying(false);
  }, [position, stopSources]);

  const toggle = useCallback(() => (wanted.current || isPlaying.current ? pause() : play()), [pause, play]);

  const setComparing = useCallback((next: boolean) => {
    held.current = next;
    setComparingState(next);
    const e = engine.current;
    if (!e) return;
    const now = e.ctx.currentTime;
    for (const [version, gain] of Object.entries(e.gains) as [Version, GainNode][]) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime((version === "before") === next ? 1 : 0, now + FADE_SECONDS);
    }
  }, []);

  const seek = useCallback(
    (fraction: number) => {
      const at = Math.min(1, Math.max(0, fraction)) * duration;
      offset.current = at;
      playhead.set(at / duration);
      if (isPlaying.current) void buffers.current?.then((decoded) => startSources(decoded, at));
    },
    [duration, playhead, startSources],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      stopSources();
      void engine.current?.ctx.close();
      engine.current = null;
    },
    [stopSources],
  );

  return { playing, loading, comparing, playhead, preload, play, pause, toggle, setComparing, seek };
}

/**
 * Holding the ⌥ key while `enabled` (the demo is hovered or has focus) calls `onChange(true)`,
 * letting go `onChange(false)`, as AppModel watches the key while the Done screen shows.
 * Window-wide, so it is the demo's job to scope `enabled` to itself.
 */
export function useOptionKeyHold(enabled: boolean, onChange: (held: boolean) => void) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });
  useEffect(() => {
    if (!enabled) return;
    let down = false;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Alt" || down) return;
      down = true;
      callback.current(true);
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.key !== "Alt" || !down) return;
      down = false;
      // Windows browsers otherwise take a lone Alt to the menu bar.
      event.preventDefault();
      callback.current(false);
    };
    const blur = () => {
      if (!down) return;
      down = false;
      callback.current(false);
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      if (down) callback.current(false);
    };
  }, [enabled]);
}
