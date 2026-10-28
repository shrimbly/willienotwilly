import { motionValue, type MotionValue } from "motion/react";

import type { EasingFunction } from "@/lib/easy-peasy-ease/easing-functions";
import type { Bezier } from "@/lib/easy-peasy-ease/easing-presets";
import {
  createRetimeMap,
  sourceFrameIndex,
  type RetimeMap,
  type RetimeSection,
} from "@/lib/easy-peasy-ease/speed-curve";

/**
 * Live retimer: plays one or more clips back to back so output time t shows
 * source time `sourceStart + ease(p) * span` of the clip under t, which is
 * what Easy Peasy Ease bakes into its render, evaluated per display frame.
 *
 * Every clip gets its own <video> (stacked, only one visible). Inactive clips
 * sit paused on their first frame, so a cut swaps to a frame that is already
 * decoded instead of flashing black.
 *
 * Strategies:
 * - "seek" (default): videos stay paused; each display frame requests the
 *   source frame the curve calls for (quantised to whole source frames, at
 *   most one seek in flight per video, the newest target wins when a seek
 *   lands). Exact frames, like the product's renderer. With a keyframe every
 *   6 frames each seek decodes at most 6 frames.
 * - "rate": the active video plays with playbackRate = the curve's local
 *   speed, corrected toward the target, and falls back to seeks below 1/16x
 *   or when it drifts more than 0.2 s.
 */

export interface RetimeClip {
  /** Stable key. */
  id: string | number;
  src: string;
  poster?: string;
  /** Full source length, seconds. */
  sourceDuration: number;
  /** Source in-point, seconds (default 0). */
  sourceStart?: number;
  /** Source out-point, seconds (default sourceDuration). */
  sourceEnd?: number;
  /** Output duration the span is eased into, seconds. */
  duration: number;
  /** Output progress -> source progress: bezier tuple, preset name or function. */
  easing: Bezier | string | EasingFunction;
  /** Source frame rate (default 24). */
  fps?: number;
  /** Source frame count (default round(sourceDuration * fps)). */
  frameCount?: number;
}

export type RetimeStrategy = "seek" | "rate";

/**
 * On-screen accuracy while playing, measured with requestVideoFrameCallback:
 * each presented frame is compared with the frame the curve wants at that
 * frame's expectedDisplayTime.
 */
export interface RetimeStats {
  /** Output seconds sampled. */
  seconds: number;
  /** Display frames (rAF ticks). */
  ticks: number;
  /** Times the wanted source frame changed (distinct frames the curve called for). */
  wantedFrames: number;
  /** New frames composited for the clip on screen. */
  presentedFrames: number;
  /** Presented frames that were exactly the frame due at their display time. */
  exactFrames: number;
  /** Mean |presented - due| in source frames. */
  meanErrorFrames: number;
  maxErrorFrames: number;
  /** Mean |presented - due| expressed as output time, ms (error / local speed). */
  meanLagMs: number;
  /** Ticks where the previous clip was still on screen (cut not landed). */
  wrongClipTicks: number;
  seeks: number;
  /** Smoothed seek-to-display latency, ms (the seek lookahead). */
  seekLatencyMs: number;
}

interface Slot {
  video: HTMLVideoElement | null;
  requestedFrame: number;
  /** performance.now() when the in-flight seek was issued (0 = none). */
  seekIssuedAt: number;
  presentedTime: number;
  /** Has played at least once (see prime). */
  primed: boolean;
  /** A priming play() is pending; seeks wait for it to settle. */
  priming: boolean;
  frameCallback: number;
  cleanup: (() => void) | null;
}

const DEFAULT_FPS = 24;
const HAVE_CURRENT_DATA = 2;
const MIN_RATE = 0.0625;
const MAX_RATE = 16;
const RATE_DRIFT_LIMIT = 0.2;
const RATE_GAIN = 4;
const PRIME_TIMEOUT_MS = 3000;

type FrameMetadata = { mediaTime: number; expectedDisplayTime: number };
type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, metadata: FrameMetadata) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function clipsToSections(clips: RetimeClip[]): RetimeSection[] {
  return clips.map((clip) => ({
    sourceStart: clip.sourceStart ?? 0,
    sourceEnd: clip.sourceEnd ?? clip.sourceDuration,
    duration: clip.duration,
    easing: clip.easing,
  }));
}

export class RetimeEngine {
  /** Output clock, seconds (wrapped into [0, total) when looping). */
  readonly time: MotionValue<number>;
  /** Index of the clip under the clock. */
  readonly clipIndex: MotionValue<number>;
  /** Linear progress through that clip, 0–1 (the curve's x). */
  readonly clipProgress: MotionValue<number>;
  /** Eased progress, 0–1 (the curve's y). */
  readonly clipEased: MotionValue<number>;
  /** Source time being shown, seconds. */
  readonly sourceTime: MotionValue<number>;
  /** Instantaneous playback speed vs real time (1 = normal). */
  readonly speed: MotionValue<number>;

  onPlayingChange: ((playing: boolean) => void) | null = null;
  onActiveIndexChange: ((index: number) => void) | null = null;

  private clips: RetimeClip[];
  private map: RetimeMap;
  private slots: Slot[] = [];
  private t: number;
  private playing = false;
  private enabled = false;
  private loop: boolean;
  private clockRate: number;
  private strategy: RetimeStrategy;
  private visibleIndex: number;
  private raf = 0;
  private lastNow: number | null = null;
  private detached = false;
  private stats = emptyStats();
  /** Smoothed time from currentTime= to the frame reaching the screen, ms. */
  private seekLatency = 16;
  private errorSum = 0;
  private lagSum = 0;
  private lastWantedClip = -1;
  private lastWantedFrame = -1;
  private displayTimeUnreliable = false;

  constructor(options: {
    clips: RetimeClip[];
    map?: RetimeMap;
    initialTime?: number;
    loop?: boolean;
    clockRate?: number;
    strategy?: RetimeStrategy;
  }) {
    this.clips = options.clips;
    this.map = options.map ?? createRetimeMap(clipsToSections(options.clips));
    this.loop = options.loop ?? true;
    this.clockRate = options.clockRate ?? 1;
    this.strategy = options.strategy ?? "seek";
    const sample = this.map.sourceAt(options.initialTime ?? 0, { loop: this.loop });
    this.t = sample.time;
    this.visibleIndex = sample.index;
    this.time = motionValue(sample.time);
    this.clipIndex = motionValue(sample.index);
    this.clipProgress = motionValue(sample.progress);
    this.clipEased = motionValue(sample.eased);
    this.sourceTime = motionValue(sample.sourceTime);
    this.speed = motionValue(this.map.speedAt(sample.index, sample.progress));
  }

  get totalDuration() {
    return this.map.total;
  }

  get isPlaying() {
    return this.playing;
  }

  /** Index of the clip currently on screen (initial index before any video registers). */
  get activeIndex() {
    return this.visibleIndex;
  }

  setClips(clips: RetimeClip[], map?: RetimeMap) {
    const previous = this.clips;
    this.clips = clips;
    this.map = map ?? createRetimeMap(clipsToSections(clips));
    for (let i = 0; i < clips.length; i++) {
      const before = previous[i];
      const slot = this.slots[i];
      if (!slot) continue;
      // A changed source or range invalidates the parked frame.
      if (
        !before ||
        before.src !== clips[i].src ||
        before.sourceStart !== clips[i].sourceStart
      ) {
        slot.requestedFrame = -1;
      }
    }
    if (this.loop && this.map.total > 0) {
      this.t = ((this.t % this.map.total) + this.map.total) % this.map.total;
    } else {
      this.t = Math.min(this.t, this.map.total);
    }
    this.parkInactive();
    this.present();
  }

  /**
   * Gate every piece of video work. While disabled the clock can still be
   * moved (seek, setClips) and the motion values follow it, but no video
   * loads, plays, seeks or reports frames; enabling catches the videos up.
   */
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (this.live) {
      this.slots.forEach((slot, i) => {
        this.prime(i, slot);
        this.watchFrames(i, slot);
      });
      this.parkInactive();
      this.present();
      this.startLoop();
    } else {
      this.quiesce();
    }
  }

  setLoop(loop: boolean) {
    this.loop = loop;
  }

  setClockRate(rate: number) {
    this.clockRate = rate;
  }

  setStrategy(strategy: RetimeStrategy) {
    if (this.strategy === strategy) return;
    this.strategy = strategy;
    this.slots.forEach((slot) => {
      slot.video?.pause();
      slot.requestedFrame = -1;
    });
    this.present();
  }

  play() {
    if (this.playing) return;
    if (!this.loop && this.t >= this.map.total) this.t = 0;
    this.playing = true;
    this.onPlayingChange?.(true);
    this.startLoop();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.onPlayingChange?.(false);
    this.stopLoop();
    // A priming play() pauses itself when it settles.
    for (const slot of this.slots) {
      if (slot && !slot.priming) slot.video?.pause();
    }
    // Settle on the exact frame for the paused time.
    this.slots.forEach((slot) => (slot.requestedFrame = -1));
    this.present();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Jump the output clock (works while paused or disabled). */
  seek(time: number) {
    const total = this.map.total;
    this.t = this.loop && total > 0 ? ((time % total) + total) % total : Math.min(Math.max(time, 0), total);
    this.lastNow = null;
    this.present();
  }

  /** Attach (or detach with null) the <video> for clip `index`. */
  registerVideo(index: number, video: HTMLVideoElement | null) {
    const slot = (this.slots[index] ??= {
      video: null,
      requestedFrame: -1,
      seekIssuedAt: 0,
      presentedTime: -1,
      primed: false,
      priming: false,
      frameCallback: 0,
      cleanup: null,
    });
    if (slot.video === video) return;
    slot.cleanup?.();
    slot.cleanup = null;
    slot.video?.pause();
    slot.video = video;
    slot.requestedFrame = -1;
    slot.seekIssuedAt = 0;
    slot.presentedTime = -1;
    slot.primed = false;
    slot.priming = false;
    if (!video) return;

    // An element that already played (re-registered under a new index) needs no priming.
    slot.primed = video.played.length > 0;
    video.muted = true;
    video.playsInline = true;
    const onSettled = () => {
      if (!this.live) return;
      if (!video.seeking) slot.presentedTime = video.currentTime;
      // Without requestVideoFrameCallback, `seeked` is the best latency signal.
      if (slot.seekIssuedAt > 0 && !(video as FrameCallbackVideo).requestVideoFrameCallback) {
        this.recordSeekLatency(performance.now() - slot.seekIssuedAt);
        slot.seekIssuedAt = 0;
      }
      // A landed seek frees the slot for the newest target.
      if (index === this.wantedIndex() || index === this.visibleIndex) this.present();
      else this.park(index);
    };
    const onMetadata = () => {
      if (!this.live) return;
      if (index !== this.wantedIndex()) this.park(index);
      else this.present();
    };
    video.addEventListener("seeked", onSettled);
    video.addEventListener("loadeddata", onSettled);
    video.addEventListener("loadedmetadata", onMetadata);
    slot.cleanup = () => {
      video.removeEventListener("seeked", onSettled);
      video.removeEventListener("loadeddata", onSettled);
      video.removeEventListener("loadedmetadata", onMetadata);
      this.unwatchFrames(slot);
    };
    video.dataset.active = String(index === this.visibleIndex);
    if (this.live) {
      this.prime(index, slot);
      this.watchFrames(index, slot);
      this.present();
    }
  }

  getStats(): RetimeStats {
    const n = Math.max(1, this.stats.presentedFrames);
    return {
      ...this.stats,
      meanErrorFrames: Math.round((this.errorSum / n) * 1000) / 1000,
      meanLagMs: Math.round((this.lagSum / n) * 10) / 10,
      seekLatencyMs: Math.round(this.seekLatency * 10) / 10,
    };
  }

  resetStats() {
    this.stats = emptyStats();
    this.errorSum = 0;
    this.lagSum = 0;
  }

  /** Resume after detach() (StrictMode re-runs effects, so this must be reversible). */
  attach(listeners: {
    onPlayingChange?: (playing: boolean) => void;
    onActiveIndexChange?: (index: number) => void;
  } = {}) {
    this.detached = false;
    this.onPlayingChange = listeners.onPlayingChange ?? null;
    this.onActiveIndexChange = listeners.onActiveIndexChange ?? null;
  }

  /**
   * Stop the clock, every video and every frame callback (unmount). Registered
   * videos stay registered; the owner's next setEnabled/play resumes.
   */
  detach() {
    this.detached = true;
    this.enabled = false;
    if (this.playing) {
      this.playing = false;
      this.onPlayingChange?.(false);
    }
    this.quiesce();
    this.onPlayingChange = null;
    this.onActiveIndexChange = null;
  }

  // ---------------------------------------------------------------------------

  /** Allowed to touch the videos. */
  private get live() {
    return this.enabled && !this.detached;
  }

  private get running() {
    return this.playing && this.live;
  }

  /** No rAF, no frame callbacks, every video paused; in-flight seeks just land. */
  private quiesce() {
    this.stopLoop();
    for (const slot of this.slots) {
      if (!slot) continue;
      this.unwatchFrames(slot);
      slot.video?.pause();
      slot.seekIssuedAt = 0;
    }
  }

  private wantedIndex() {
    return this.map.sourceAt(this.t, { loop: this.loop }).index;
  }

  private startLoop() {
    if (!this.running || this.raf) return;
    this.lastNow = null;
    this.raf = requestAnimationFrame(this.tick);
  }

  private stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastNow = null;
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (!this.running) return;
    // Cap the step so a backgrounded tab resumes where it left off.
    const dt = this.lastNow === null ? 0 : Math.min(0.1, (now - this.lastNow) / 1000);
    this.lastNow = now;
    const total = this.map.total;
    let t = this.t + dt * this.clockRate;
    if (total > 0) {
      if (this.loop) t %= total;
      else if (t >= total) {
        t = total;
        this.t = t;
        this.present();
        this.pause();
        return;
      }
    }
    this.t = t;
    this.present(dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Show the frame for the current clock: drive the wanted video, swap when it is ready. */
  private present(dt = 0) {
    if (this.clips.length === 0) return;
    const sample = this.map.sourceAt(this.t, { loop: this.loop });
    const index = sample.index;
    const speed = this.map.speedAt(index, sample.progress);
    this.time.set(sample.time);
    this.clipIndex.set(index);
    this.clipProgress.set(sample.progress);
    this.clipEased.set(sample.eased);
    this.sourceTime.set(sample.sourceTime);
    this.speed.set(speed);

    const slot = this.slots[index];
    const video = slot?.video;
    if (slot && video) {
      // While disabled only the clock moves; setEnabled(true) catches the videos up.
      if (this.live) this.drive(index, slot, video, sample.sourceTime, speed);
    } else if (index !== this.visibleIndex && !this.slots.some((s) => s?.video)) {
      // No videos attached (clock-only use): keep the index in step.
      this.visibleIndex = index;
      this.onActiveIndexChange?.(index);
    }

    if (dt > 0) this.sample(index, sample.sourceTime, dt);
  }

  /** Point the wanted clip's video at the curve's frame and cut to it once it is ready. */
  private drive(index: number, slot: Slot, video: HTMLVideoElement, sourceTime: number, speed: number) {
    if (this.strategy === "rate" && this.running) {
      this.driveRate(index, slot, video, sourceTime, speed * this.clockRate);
    } else {
      // Ask for the frame that will be due when the seek lands, so the
      // picture doesn't trail the curve by one seek. Cuts are already parked.
      let target = sourceTime;
      if (this.running) {
        const ahead = this.map.sourceAt(this.t + (this.seekLatency / 1000) * this.clockRate, {
          loop: this.loop,
        });
        if (ahead.index === index) target = ahead.sourceTime;
      }
      this.seekTo(index, target);
    }
    if (index !== this.visibleIndex && video.readyState >= HAVE_CURRENT_DATA && !video.seeking) {
      this.show(index);
    }
  }

  private show(index: number) {
    if (!this.live) return;
    const previous = this.visibleIndex;
    this.visibleIndex = index;
    this.slots.forEach((slot, i) => {
      if (slot?.video) slot.video.dataset.active = String(i === index);
    });
    if (previous !== index && previous >= 0 && previous < this.slots.length) {
      this.slots[previous]?.video?.pause();
      this.park(previous);
    }
    this.onActiveIndexChange?.(index);
  }

  /** Paused on the clip's first frame, ready for its cut. */
  private park(index: number) {
    if (!this.live || index === this.wantedIndex() || index === this.visibleIndex) return;
    const clip = this.clips[index];
    if (!clip) return;
    this.seekTo(index, clip.sourceStart ?? 0);
  }

  private parkInactive() {
    for (let i = 0; i < this.slots.length; i++) this.park(i);
  }

  private seekTo(index: number, sourceTime: number) {
    const slot = this.slots[index];
    const video = slot?.video;
    const clip = this.clips[index];
    if (!slot || !video || !clip || !this.live) return;
    const fps = clip.fps ?? DEFAULT_FPS;
    const frameCount = clip.frameCount ?? Math.round(clip.sourceDuration * fps);
    const frame = sourceFrameIndex(sourceTime, fps, frameCount);
    if (frame === slot.requestedFrame) return;
    // One seek in flight per video; `seeked` re-presents with the newest target.
    // A priming play() is never interrupted (that would undo the priming);
    // its settle re-presents or parks.
    if (video.seeking || slot.priming) return;
    if (!video.paused) video.pause();
    slot.requestedFrame = frame;
    slot.seekIssuedAt = performance.now();
    video.currentTime = (frame + 0.5) / fps;
    this.stats.seeks++;
  }

  private driveRate(
    index: number,
    slot: Slot,
    video: HTMLVideoElement,
    sourceTime: number,
    speed: number,
  ) {
    if (video.seeking || slot.priming) return;
    if (speed < MIN_RATE) {
      this.seekTo(index, sourceTime);
      return;
    }
    const drift = video.currentTime - sourceTime;
    if (Math.abs(drift) > RATE_DRIFT_LIMIT || video.readyState < HAVE_CURRENT_DATA) {
      slot.requestedFrame = -1;
      video.currentTime = sourceTime;
      this.stats.seeks++;
      return;
    }
    const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, speed - drift * RATE_GAIN));
    if (Math.abs(rate - video.playbackRate) / video.playbackRate > 0.03) {
      video.playbackRate = rate;
    }
    slot.requestedFrame = -1;
    if (video.paused) video.play().catch(() => {});
  }

  /**
   * iOS only paints seeked frames once a video has played; muted inline play
   * is allowed. Playback starts from the frame this clip will show first (the
   * default start position, since nothing has loaded yet), so the brief play
   * is not a visible jump.
   */
  private prime(index: number, slot: Slot) {
    const video = slot.video;
    const clip = this.clips[index];
    if (!video || slot.primed || slot.priming) return;
    slot.priming = true;
    video.preload = "auto";
    if (clip && video.readyState === 0) {
      const sample = this.map.sourceAt(this.t, { loop: this.loop });
      video.currentTime = sample.index === index ? sample.sourceTime : (clip.sourceStart ?? 0);
    }
    let settled = false;
    let fallback = 0;
    const settle = (error?: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      if (slot.video !== video) {
        video.pause();
        return;
      }
      slot.priming = false;
      // Not played yet (disabled mid-prime, timed out, blocked): the next enable tries again.
      slot.primed = video.played.length > 0;
      if (!this.live) {
        video.pause();
        return;
      }
      // Paused by a disable that was undone before the rejection arrived.
      if (!slot.primed && error instanceof DOMException && error.name === "AbortError") {
        this.prime(index, slot);
        return;
      }
      if (this.strategy === "seek" || !this.running || index !== this.wantedIndex()) video.pause();
      slot.requestedFrame = -1;
      if (index === this.wantedIndex()) this.present();
      else this.park(index);
    };
    // play() can stay pending on a stalled load; never let it hold seeks for long.
    fallback = window.setTimeout(settle, PRIME_TIMEOUT_MS);
    const attempt = video.play();
    if (attempt && typeof attempt.then === "function") attempt.then(() => settle(), settle);
    else settle();
  }

  private recordSeekLatency(ms: number) {
    if (!(ms > 0) || ms > 250) return;
    this.seekLatency = this.seekLatency * 0.8 + Math.min(ms, 100) * 0.2;
  }

  /** Frame callbacks (seek latency and stats) run only while live. */
  private watchFrames(index: number, slot: Slot) {
    const video = slot.video;
    const fcv = video as FrameCallbackVideo | null;
    if (!fcv?.requestVideoFrameCallback || slot.frameCallback) return;
    const onFrame = (now: number, metadata: FrameMetadata) => {
      slot.frameCallback = 0;
      if (slot.video !== video || !this.live) return;
      slot.presentedTime = metadata.mediaTime;
      const clip = this.clips[index];
      const fps = clip?.fps ?? DEFAULT_FPS;
      const shown = sourceFrameIndex(metadata.mediaTime, fps);
      const landed = slot.seekIssuedAt > 0 && shown === slot.requestedFrame;
      // WebKit reports expectedDisplayTime on another clock (it precedes the
      // seek that produced the frame); use the callback's frame time there.
      if (landed && metadata.expectedDisplayTime < slot.seekIssuedAt) {
        this.displayTimeUnreliable = true;
      }
      const shownAt = this.displayTimeUnreliable ? now : metadata.expectedDisplayTime;
      if (landed) {
        this.recordSeekLatency(shownAt - slot.seekIssuedAt);
        slot.seekIssuedAt = 0;
      }
      if (this.running && index === this.visibleIndex && this.lastNow !== null && clip) {
        const due = this.map.sourceAt(
          this.t + ((shownAt - this.lastNow) / 1000) * this.clockRate,
          { loop: this.loop },
        );
        if (due.index === index) {
          const error = Math.abs(shown - sourceFrameIndex(due.sourceTime, fps));
          const speed = Math.max(0.05, this.map.speedAt(index, due.progress) * this.clockRate);
          const stats = this.stats;
          stats.presentedFrames++;
          if (error === 0) stats.exactFrames++;
          stats.maxErrorFrames = Math.max(stats.maxErrorFrames, error);
          this.errorSum += error;
          this.lagSum += (error / fps / speed) * 1000;
        }
      }
      slot.frameCallback = fcv.requestVideoFrameCallback!(onFrame);
    };
    slot.frameCallback = fcv.requestVideoFrameCallback(onFrame);
  }

  private unwatchFrames(slot: Slot) {
    const fcv = slot.video as FrameCallbackVideo | null;
    if (slot.frameCallback && fcv?.cancelVideoFrameCallback) {
      fcv.cancelVideoFrameCallback(slot.frameCallback);
    }
    slot.frameCallback = 0;
  }

  private sample(index: number, sourceTime: number, dt: number) {
    const stats = this.stats;
    stats.ticks++;
    stats.seconds += dt;
    if (this.visibleIndex !== index) stats.wrongClipTicks++;
    const clip = this.clips[index];
    const frame = sourceFrameIndex(sourceTime, clip?.fps ?? DEFAULT_FPS);
    if (index !== this.lastWantedClip || frame !== this.lastWantedFrame) {
      this.lastWantedClip = index;
      this.lastWantedFrame = frame;
      stats.wantedFrames++;
    }
  }
}

function emptyStats(): RetimeStats {
  return {
    seconds: 0,
    ticks: 0,
    wantedFrames: 0,
    presentedFrames: 0,
    exactFrames: 0,
    meanErrorFrames: 0,
    maxErrorFrames: 0,
    meanLagMs: 0,
    wrongClipTicks: 0,
    seeks: 0,
    seekLatencyMs: 0,
  };
}
