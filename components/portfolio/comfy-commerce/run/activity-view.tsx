"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

import { ENGINE_LABELS } from "@/lib/comfy-commerce/run";
import { cn } from "@/lib/utils";

import { Button } from "../kit/button";
import { EmptyState } from "../kit/empty-state";
import { ArrowRight, Check, ChevronDown, IconBox, Images, ListChecks, OctagonX, RotateCcw } from "../kit/icons";
import { easeSoft, ROW_TRANSITION } from "../kit/motion";
import { dominantEngine, pendingReview, runCounts, type DemoRun, type OutputThumb, type RunState } from "./data";
import { PlayIcon, useHover } from "./play-icon";

// Activity ("Track activity"), from web/src/features/activity/ActivityPage.tsx:
// one ChainRow per run, newest first, with RunThumbs fanning its outputs, the
// " · "-joined meta line, the state chip, Cancel (with its skip-or-stop menu),
// Retry, "Run remaining N" on a finished sample, Review (N), and the 4px
// progress bar. Review links go to the review lightbox, which on this page is
// the hero. A retry here re-runs the failed items in the same row; the product
// starts a new attempt and folds the old one under the row's chevron.

/** Filled colour is kept for failures; everything else is a quiet dot and label (ActivityPage STATE_STYLES). */
const STATE_STYLES: Record<RunState, { label: string; className: string; dot: string }> = {
  queued: { label: "Queued", className: "text-(--ink-soft)", dot: "bg-(--ink-faint)" },
  running: { label: "Running", className: "text-(--success)", dot: "bg-(--success) animate-pulse" },
  completed: { label: "Completed", className: "text-(--success)", dot: "bg-(--success)" },
  failed: { label: "Failed", className: "bg-(--danger-soft) text-(--danger)", dot: "bg-(--danger)" },
  cancelled: { label: "Cancelled", className: "text-(--ink-faint)", dot: "bg-(--ink-faint)" },
};

export interface RunActions {
  onCancel: (id: string) => void;
  onSkip: (id: string) => void;
  onRetry: (id: string) => void;
  onPromote: (id: string) => void;
  onClear: (id: string) => void;
  onReview: () => void;
}

function Thumb({ output, className, style }: { output: OutputThumb; className: string; style?: CSSProperties }) {
  if ("src" in output) {
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size local thumbnail
    return <img src={output.src} alt="" loading="lazy" decoding="async" draggable={false} className={className} style={style} />;
  }
  return <span className={cn("block", className)} style={{ ...output.style, ...style }} />;
}

/** RunThumbs: one output plain, several as a small fan; nothing back yet, the images glyph. */
function RunThumbs({ run, reducedMotion }: { run: DemoRun; reducedMotion: boolean }) {
  const outputs = run.items.flatMap((i) => (i.state === "done" && i.output ? [i.output] : [])).slice(0, 3);
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
    return <Thumb output={outputs[0]} className="size-12 shrink-0 rounded-lg border border-(--line) object-cover" />;
  }
  // The fan opens as each output lands (the product redraws it in place).
  return (
    <span className="relative flex h-12 w-14 shrink-0 items-center justify-center">
      {outputs.map((output, i) => {
        const spread = i - (outputs.length - 1) / 2;
        return (
          <motion.span
            key={i}
            className="absolute size-10"
            style={{ zIndex: i }}
            initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={{ x: spread * 10, rotate: spread * 9, scale: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : ROW_TRANSITION}
          >
            <Thumb output={output} className="size-10 rounded-lg border-2 border-(--surface) object-cover shadow-(--shadow-soft)" />
          </motion.span>
        );
      })}
    </span>
  );
}

/**
 * CancelControl: a one-image run cancels at once; a batch asks whether to
 * skip the stuck image or stop the whole run. The menu goes in the tile's
 * root, as the product portals it to the body, so the card never clips it.
 */
function CancelControl({ run, remaining, actions }: { run: DemoRun; remaining: number; actions: RunActions }) {
  const button = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ host: HTMLElement; top: number; left: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    firstItem.current?.focus({ preventScroll: true });
    const close = () => setMenu(null);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
      button.current?.focus({ preventScroll: true });
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [menu]);

  if (remaining <= 1) {
    return (
      <Button variant="ghost" size="sm" onClick={() => actions.onCancel(run.id)}>
        <IconBox>
          <OctagonX />
        </IconBox>
        Cancel
      </Button>
    );
  }

  const toggle = () => {
    if (menu) return setMenu(null);
    const el = button.current;
    const host = el?.closest<HTMLElement>(".cc");
    if (!el || !host) return;
    const r = el.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    const width = Math.min(288, h.width - 16);
    setMenu({ host, top: r.bottom - h.top + 8, left: Math.max(8, Math.min(r.right - h.left - width, h.width - width - 8)) });
  };
  const pick = (fn: (id: string) => void) => {
    fn(run.id);
    setMenu(null);
  };

  return (
    <>
      <Button ref={button} variant="ghost" size="sm" onClick={toggle} aria-expanded={Boolean(menu)} aria-haspopup="menu">
        <IconBox>
          <OctagonX />
        </IconBox>
        Cancel
        <IconBox className={cn("transition-transform duration-200 motion-reduce:transition-none", menu && "rotate-180")}>
          <ChevronDown />
        </IconBox>
      </Button>
      {menu &&
        createPortal(
          <>
            <div aria-hidden className="absolute inset-0 z-[60]" onClick={() => setMenu(null)} />
            <motion.div
              role="menu"
              aria-label="Cancel"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: easeSoft }}
              className="absolute z-[61] w-72 max-w-[calc(100%-16px)] rounded-xl border border-(--line) bg-(--surface) p-1 shadow-(--shadow-lift)"
              style={{ top: menu.top, left: menu.left }}
            >
              <button
                ref={firstItem}
                type="button"
                role="menuitem"
                onClick={() => pick(actions.onSkip)}
                className="flex w-full cursor-pointer flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-(--surface-2) motion-reduce:transition-none"
              >
                <span className="text-sm font-medium">Skip current image</span>
                <span className="text-sm text-(--ink-faint)">The rest of the batch keeps going</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => pick(actions.onCancel)}
                className="flex w-full cursor-pointer flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-(--danger-soft) motion-reduce:transition-none"
              >
                <span className="text-sm font-medium text-(--danger)">Cancel entire run</span>
                <span className="text-sm text-(--ink-faint)">
                  {remaining} image{remaining === 1 ? "" : "s"} left
                </span>
              </button>
            </motion.div>
          </>,
          menu.host,
        )}
    </>
  );
}

function ChainRow({
  run,
  showEngine,
  actions,
  reducedMotion,
}: {
  run: DemoRun;
  showEngine: boolean;
  actions: RunActions;
  reducedMotion: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const runRemaining = useHover(reducedMotion);
  const counts = runCounts(run);
  const pending = pendingReview(run);
  const editing = run.items.filter((i) => i.state === "editing");
  const retryable = run.items.filter((i) => i.state !== "done").length;
  // In-flight items count half: the bar moves honestly even on a one-image run.
  const progress = counts.total === 0 ? 0 : (counts.done + counts.failed + editing.length * 0.5) / counts.total;
  const active = run.state === "queued" || run.state === "running";
  const failures = run.items.filter((i) => i.state === "failed");
  const stateStyle = STATE_STYLES[run.state];

  // The meta line: "1 of 1 done" and the usual engine add nothing, so they are dropped.
  const meta: ReactNode[] = [];
  if (counts.total > 1 || counts.failed > 0) meta.push(`${counts.done} of ${counts.total} done`);
  if (active && editing.length > 0) meta.push(<span className="text-(--ink-soft)">generating {editing[0].productTitle}…</span>);
  if (counts.failed > 0) meta.push(<span className="text-(--danger)">{counts.failed} failed</span>);
  if (showEngine) meta.push(ENGINE_LABELS[run.engineId]);
  meta.push(run.ago);
  if (!active) {
    meta.push(
      <button
        type="button"
        onClick={() => actions.onClear(run.id)}
        className="cursor-pointer underline underline-offset-2 transition-colors hover:text-(--danger) motion-reduce:transition-none"
      >
        Clear
      </button>,
    );
  }

  return (
    <motion.article
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.2 } }}
      transition={reducedMotion ? { duration: 0 } : ROW_TRANSITION}
      aria-label={`${run.workflowName}, ${run.ago}`}
      tabIndex={-1}
      className="border-b border-(--line) bg-(--surface) last:border-b-0 focus-visible:outline-offset-[-2px]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 @max-[519px]/runs:px-4">
        {counts.done > 0 ? (
          <button
            type="button"
            onClick={actions.onReview}
            aria-label="Review this run"
            className="shrink-0 cursor-pointer rounded-lg transition-opacity hover:opacity-80 motion-reduce:transition-none"
          >
            <RunThumbs run={run} reducedMotion={reducedMotion} />
          </button>
        ) : (
          <RunThumbs run={run} reducedMotion={reducedMotion} />
        )}
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-medium">{run.workflowName}</p>
            {failures.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-label="Show details"
                aria-expanded={expanded}
                className="flex h-6 shrink-0 cursor-pointer items-center gap-0.5 rounded-lg px-1 text-(--ink-faint) transition-colors hover:bg-(--surface-2) hover:text-(--ink) motion-reduce:transition-none"
              >
                <IconBox className={cn("transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}>
                  <ChevronDown />
                </IconBox>
              </button>
            )}
            {run.targetKind === "catalog" && (
              <span className="flex h-6 shrink-0 items-center rounded-lg border border-(--line) bg-(--surface-2) px-2 text-sm text-(--ink-soft)">
                Catalog
              </span>
            )}
            {run.sample && (
              <span className="flex h-6 shrink-0 items-center rounded-lg bg-(--accent-soft) px-2 text-sm whitespace-nowrap text-(--ink)">
                Sample of {run.sampleOfTotal}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-(--ink-faint)">
            {meta.map((seg, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                {seg}
              </Fragment>
            ))}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {run.state !== "completed" && (
            <span className={cn("flex h-6 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-sm font-medium", stateStyle.className)}>
              <span aria-hidden className={cn("size-2.5 rounded-full", stateStyle.dot)} />
              {stateStyle.label}
            </span>
          )}
          {active && <CancelControl run={run} remaining={counts.total - counts.done - counts.failed} actions={actions} />}
          {!active && retryable > 0 && (
            <Button variant="ghost" size="sm" onClick={() => actions.onRetry(run.id)}>
              <IconBox>
                <RotateCcw />
              </IconBox>
              {counts.done > 0 ? `Retry failed (${retryable})` : "Retry"}
            </Button>
          )}
          {run.sample && run.state === "completed" && !run.promoted && (
            <Button variant="primary" size="sm" onClick={() => actions.onPromote(run.id)} {...runRemaining.props}>
              <IconBox>
                <PlayIcon hover={runRemaining.hover} />
              </IconBox>
              Run remaining {run.remaining?.length ?? 0}
            </Button>
          )}
          {counts.done > 0 && pending > 0 && (
            <Button variant="secondary" size="sm" onClick={actions.onReview}>
              Review ({pending})
              <IconBox>
                <ArrowRight />
              </IconBox>
            </Button>
          )}
          {counts.done > 0 && pending === 0 && (
            <button
              type="button"
              onClick={actions.onReview}
              className="flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm text-(--ink-faint) transition-colors hover:bg-(--surface-2) hover:text-(--ink) motion-reduce:transition-none"
            >
              <IconBox>
                <Check />
              </IconBox>
              Reviewed
            </button>
          )}
        </div>
      </div>

      <motion.div
        aria-hidden
        className="overflow-hidden bg-(--surface-2)"
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

      <AnimatePresence initial={false}>
        {expanded && failures.length > 0 && (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: easeSoft }}
            className="overflow-hidden border-t border-(--line) bg-(--surface-2)/40"
          >
            {failures.map((item) => (
              <p
                key={item.tileId}
                className="flex items-baseline justify-between gap-4 border-b border-(--line) px-5 py-3 text-sm last:border-b-0"
              >
                <span className="truncate font-medium">{item.productTitle}</span>
                <span className="shrink-0 text-(--danger)">{item.error}</span>
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function ActivityView({
  runs,
  actions,
  onBrowse,
  reducedMotion,
}: {
  runs: DemoRun[];
  actions: RunActions;
  onBrowse: () => void;
  reducedMotion: boolean;
}) {
  const dominant = dominantEngine(runs);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-start justify-between gap-4 @max-[639px]/cc:[@container_cc_(height<600px)]:hidden [@container_cc_(height>=600px)]:mb-5">
        <div className="min-w-0">
          <p className="text-xl leading-7 font-semibold">Track activity</p>
          <p className="mt-0.5 hidden max-w-xl text-sm text-(--ink-soft) [@container_cc_(height>=600px)]:block">
            Every workflow run — results stream into the review queue as they finish.
          </p>
        </div>
      </div>
      {runs.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No runs yet"
          body="Select media in Browse (or run the whole catalog) and launch a workflow. Progress shows up here live."
          action={
            <Button variant="primary" onClick={onBrowse}>
              Browse products
            </Button>
          }
          className="min-h-0 flex-1 bg-(--surface)/60"
        />
      ) : (
        <div className="@container/runs min-h-0 overflow-y-auto rounded-2xl border border-(--line) bg-(--surface) shadow-(--shadow-soft)">
          <AnimatePresence mode="popLayout" initial={false}>
            {runs.map((run) => (
              <ChainRow
                key={run.id}
                run={run}
                showEngine={run.engineId !== dominant}
                actions={actions}
                reducedMotion={reducedMotion}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
