"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { DemoState, Step } from "./script";

/**
 * Plays steps over the demo's state, one timer at a time. It holds while the
 * demo is off screen (the step in hand starts over when it is back) and can
 * finish everything at once (reduced motion, a visitor's instant run).
 */
class Runner {
  private queue: Step[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;

  constructor(
    private readonly setState: Dispatch<SetStateAction<DemoState>>,
    private readonly setIdle: (idle: boolean) => void,
  ) {}

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule() {
    if (this.timer || !this.playing) return;
    const next = this.queue[0];
    if (!next) {
      this.setIdle(true);
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      // Every step due now goes in one update.
      const due: Step[] = [];
      do due.push(this.queue.shift()!);
      while (this.queue.length && this.queue[0].delay === 0);
      this.setState((s) => due.reduce((acc, st) => st.apply(acc), s));
      this.schedule();
    }, next.delay);
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
    if (playing) this.schedule();
    else this.clear();
  }

  /** Replace what is queued with `steps`. */
  start(steps: Step[]) {
    this.clear();
    this.queue = [...steps];
    this.setIdle(steps.length === 0);
    this.schedule();
  }

  /** Add `steps` after what is queued. */
  enqueue(steps: Step[]) {
    this.queue.push(...steps);
    this.setIdle(this.queue.length === 0);
    this.schedule();
  }

  /** Apply everything still queued now. */
  flush() {
    this.clear();
    const steps = this.queue;
    this.queue = [];
    if (steps.length) this.setState((s) => steps.reduce((acc, st) => st.apply(acc), s));
    this.setIdle(true);
  }

  /** Drop what is queued. */
  cancel() {
    this.clear();
    this.queue = [];
    this.setIdle(true);
  }

  dispose() {
    this.clear();
  }
}

export function useRunner(setState: Dispatch<SetStateAction<DemoState>>, playing: boolean) {
  const [idle, setIdle] = useState(true);
  const [runner] = useState(() => new Runner(setState, setIdle));

  useEffect(() => {
    runner.setPlaying(playing);
  }, [runner, playing]);

  useEffect(() => () => runner.dispose(), [runner]);

  return { runner, idle };
}
