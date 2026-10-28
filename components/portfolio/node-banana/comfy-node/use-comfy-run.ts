"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RUN_TIMING, type ComfyRun } from "./data";

export interface ActiveRun extends ComfyRun {
  status: "queued" | "running" | "output";
  /** Latent preview frame (one per sampler step), -1 before the first. */
  frame: number;
  frames: number;
}

/**
 * A run's clock: queued → running (a latent frame per sampler step) →
 * handing on to the Output node → done. Time only advances while `active`,
 * so a run started on screen holds when the tile scrolls away. State changes
 * once per beat or frame, never per animation frame.
 */
export function useComfyRun({
  active,
  onRendered,
  onDone,
}: {
  active: boolean;
  /** The sampler finished: the result lands in the node's history. */
  onRendered: (run: ComfyRun) => void;
  /** The Output node has it too; the workflow is idle again. */
  onDone: (run: ComfyRun) => void;
}) {
  const [run, setRun] = useState<ActiveRun | null>(null);
  const live = useRef<ActiveRun | null>(null);
  const elapsed = useRef(0);
  const callbacks = useRef({ onRendered, onDone });
  useEffect(() => {
    callbacks.current = { onRendered, onDone };
  });

  const start = useCallback((job: ComfyRun, steps: number) => {
    elapsed.current = 0;
    const next: ActiveRun = { ...job, status: "queued", frame: -1, frames: Math.max(2, Math.min(24, Math.round(steps))) };
    live.current = next;
    setRun(next);
  }, []);

  const stop = useCallback(() => {
    live.current = null;
    setRun(null);
  }, []);

  const running = run !== null;
  useEffect(() => {
    if (!running || !active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const r = live.current;
      if (!r) return;
      elapsed.current += Math.min(64, now - last);
      last = now;
      const t = elapsed.current;
      if (t >= RUN_TIMING.done) {
        live.current = null;
        setRun(null);
        callbacks.current.onDone(r);
        return;
      }
      const status: ActiveRun["status"] = t < RUN_TIMING.queued ? "queued" : t < RUN_TIMING.rendered ? "running" : "output";
      const span = (RUN_TIMING.rendered - RUN_TIMING.preview) / r.frames;
      const frame = t < RUN_TIMING.preview ? -1 : Math.min(r.frames - 1, Math.floor((t - RUN_TIMING.preview) / span));
      if (status === "output" && r.status !== "output") callbacks.current.onRendered(r);
      if (status !== r.status || frame !== r.frame) {
        const next = { ...r, status, frame };
        live.current = next;
        setRun(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, active]);

  return { run, start, stop };
}
