"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import { Button } from "../kit/button";
import { ArrowRight, Box, Check, ICON, IconBox, Images } from "../kit/icons";
import { easeSoft } from "../kit/motion";
import type { DemoRun, DemoRunItem, RunState } from "./data";

// The Activity page's run row, ported from web/src/features/activity/
// ActivityPage.tsx (ChainRow, RunThumbs, OutputThumb, STATE_STYLES): the same
// derivations from the run (counts, the half-weighted progress, the " · "
// metadata) and the same classes. Left out: the retry-chain expander, Cancel
// (the scripted run is over in seconds; the tile's Replay restarts it), Retry
// and Run remaining (this run never fails or samples), and the engine label
// (shown only on odd-one-out rows). Clear and Reviewed are drawn but inert.

/**
 * Filled colour is reserved for failures; everything else is a quiet dot and
 * label (completed runs show no chip at all). Verbatim from STATE_STYLES.
 */
const STATE_STYLES: Record<RunState, { label: string; className: string; dot: string }> = {
  queued: { label: "Queued", className: "text-(--ink-soft)", dot: "bg-(--ink-faint)" },
  running: { label: "Running", className: "text-(--success)", dot: "bg-(--success) animate-pulse" },
  completed: { label: "Completed", className: "text-(--success)", dot: "bg-(--success)" },
  failed: { label: "Failed", className: "bg-(--danger-soft) text-(--danger)", dot: "bg-(--danger)" },
  cancelled: { label: "Cancelled", className: "text-(--ink-faint)", dot: "bg-(--ink-faint)" },
};

/**
 * One output as a thumbnail: a 3D model shows a boxed glyph (its .glb can't
 * paint in an <img>), anything else is an image. (The product also plays a
 * muted frame of a video; no run here makes one.)
 */
function OutputThumb({
  src,
  mediaType = "image",
  className,
  style,
}: {
  src: string;
  mediaType?: DemoRunItem["mediaType"];
  className: string;
  style?: CSSProperties;
}) {
  if (mediaType === "model3d") {
    return (
      <span className={cn("flex items-center justify-center bg-(--surface-2) text-(--ink-faint)", className)} style={style}>
        <IconBox>
          <Box {...ICON} />
        </IconBox>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- a 48px local thumbnail, already cut to size
  return <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className={className} style={style} />;
}

/** Generated outputs as a thumbnail: none yet is the Images glyph, one is plain, several a small fan. */
export function RunThumbs({ run }: { run: DemoRun }) {
  const outputs = run.items
    .filter((i): i is DemoRunItem & { output: string } => Boolean(i.output))
    .map((i) => ({ src: i.output, mediaType: i.mediaType }))
    .slice(0, 3);

  if (outputs.length === 0) {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-(--line) bg-(--surface-2) text-(--ink-faint)">
        <IconBox>
          <Images />
        </IconBox>
      </span>
    );
  }
  if (outputs.length === 1) {
    return <OutputThumb {...outputs[0]} className="size-12 shrink-0 rounded-lg border border-(--line) object-cover" />;
  }
  return (
    <span className="relative flex h-12 w-14 shrink-0 items-center justify-center">
      {outputs.map((output, i) => {
        const spread = i - (outputs.length - 1) / 2;
        return (
          <OutputThumb
            key={output.src}
            {...output}
            className="absolute size-10 rounded-lg border-2 border-(--surface) object-cover shadow-(--shadow-soft)"
            style={{ transform: `translateX(${spread * 10}px) rotate(${spread * 9}deg)`, zIndex: i }}
          />
        );
      })}
    </span>
  );
}

/**
 * One run on the Activity page. `onReview` stands in for the product's link
 * to the review queue filtered to this run.
 */
export function RunRow({
  run,
  onReview,
  reducedMotion = false,
  enter = true,
  className,
}: {
  run: DemoRun;
  onReview?: () => void;
  reducedMotion?: boolean;
  /** Fade up as a new run does (opacity 0, y 8); off for rows already listed. */
  enter?: boolean;
  className?: string;
}) {
  const total = run.items.length;
  const done = run.items.filter((i) => i.state === "done").length;
  const failed = run.items.filter((i) => i.state === "failed").length;
  const editing = run.items.filter((i) => i.state === "editing").length;
  // In-flight items count half: the bar moves honestly even on one-item runs.
  const progress = total === 0 ? 0 : (done + failed + editing * 0.5) / total;
  const active = run.state === "queued" || run.state === "running";
  const stateStyle = STATE_STYLES[run.state];

  // Metadata segments, joined by " · ". "1 of 1 done" is dropped: it reads the
  // same on nearly every row and only adds noise.
  const meta: ReactNode[] = [];
  if (total > 1 || failed > 0) meta.push(`${done} of ${total} done`);
  if (active && editing > 0) {
    meta.push(<span className="text-(--ink-soft)">generating {run.items.find((i) => i.state === "editing")?.productTitle}…</span>);
  }
  if (failed > 0) meta.push(<span className="text-(--danger)">{failed} failed</span>);
  meta.push(run.when);
  // Clears the run from the history in the product; drawn, not wired, here.
  if (!active) meta.push(<span className="underline underline-offset-2">Clear</span>);

  return (
    <motion.article
      initial={enter && !reducedMotion ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeSoft }}
      className={cn("border-b border-(--line) last:border-b-0", className)}
    >
      <div className="cc-shoot-row flex items-center gap-4 px-5 py-3">
        <RunThumbs run={run} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* The product's h3; a <p> here, so the tile stays out of the page's outline. */}
            <p className="truncate text-base font-medium">{run.workflowName}</p>
          </div>
          <p className="mt-1 truncate text-sm text-(--ink-faint)">
            {meta.map((seg, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                {seg}
              </Fragment>
            ))}
          </p>
        </div>

        <div className="cc-shoot-row-actions flex shrink-0 items-center gap-2">
          {/* Status shows only off the happy path: a completed run says so through Review / Reviewed. */}
          {run.state !== "completed" && (
            <span className={cn("flex h-6 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-sm font-medium", stateStyle.className)}>
              <span aria-hidden className={cn("size-2.5 rounded-full", stateStyle.dot)} />
              {stateStyle.label}
            </span>
          )}
          {done > 0 && run.pendingReview > 0 && (
            <Button variant="secondary" size="sm" onClick={onReview}>
              Review ({run.pendingReview})
              <IconBox className="cc-shoot-review-arrow">
                <ArrowRight />
              </IconBox>
            </Button>
          )}
          {done > 0 && run.pendingReview === 0 && (
            <span className="flex h-7 items-center gap-1 rounded-lg px-2 text-sm text-(--ink-faint)">
              <IconBox>
                <Check />
              </IconBox>
              Reviewed
            </span>
          )}
        </div>
      </div>

      {/* The 4px progress bar: open while the run is active, its fill moving linearly to each new count. */}
      <motion.div
        className="bg-(--surface-2)"
        initial={false}
        animate={{ height: active ? 4 : 0, opacity: active ? 1 : 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: easeSoft }}
      >
        <motion.div
          className={cn("h-full", run.state === "failed" ? "bg-(--danger)" : "bg-(--ink)")}
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: "linear" }}
        />
      </motion.div>
    </motion.article>
  );
}
