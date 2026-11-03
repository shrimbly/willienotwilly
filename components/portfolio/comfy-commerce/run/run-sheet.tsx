"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";

import { BUILTIN_WORKFLOWS } from "@/lib/comfy-commerce/media";
import {
  ENGINES,
  SAMPLE_NUDGE_THRESHOLD,
  SAMPLE_SIZE,
  STAGE_ACTIONS,
  STAGE_LABELS,
  WORKFLOW_PARAMS,
  type EngineId,
  type StageAction,
  type WorkflowParam,
} from "@/lib/comfy-commerce/run";
import { cn } from "@/lib/utils";

import { Button } from "../kit/button";
import { gradientFor } from "../kit/gradient";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  Cloud,
  ICON,
  IconBox,
  Maximize2,
  Monitor,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  X,
  type IconProps,
} from "../kit/icons";
import { easeSoft, SHEET_STEP_TRANSITION, SHEET_TRANSITION } from "../kit/motion";
import { Segmented } from "../kit/segmented";
import { Spinner } from "../kit/spinner";
import { estimateOf, PICKER_THUMBS, targetLabel, workflowById, type RunTarget } from "./data";
import { PlayIcon, useHover } from "./play-icon";

// The RunSheet, from web/src/features/activity/RunSheet.tsx: the side sheet
// that launches a run in three steps, Workflow → Details → Engine, with the
// sample-first nudge for big targets and the review-gate note. Its state lives
// in the demo (so the scripted pass can drive it); the sheet draws it.
// Left out: the picker's "Upload new" (UploadWorkflowDialog), and PromptField's
// saved-prompt library and large editor, whose buttons are drawn but inert.

export type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Workflow" },
  { id: 2, label: "Details" },
  { id: 3, label: "Engine" },
];

export interface SheetState {
  target: RunTarget;
  step: Step;
  /** The way the steps slide: 1 forward, -1 back. */
  direction: 1 | -1;
  workflowId: string | null;
  params: Record<string, string>;
  engineId: EngineId | null;
  stageAction: StageAction;
  sampleFirst: boolean;
  /** createRun pending: the launch button's spinner. */
  launching: boolean;
}

export function openSheet(target: RunTarget): SheetState {
  return {
    target,
    step: 1,
    direction: 1,
    workflowId: null,
    params: {},
    // The product picks the first engine that is available and compatible.
    engineId: ENGINES.find((e) => e.available)?.id ?? null,
    stageAction: "add-new",
    sampleFirst: estimateOf(target).images > SAMPLE_NUDGE_THRESHOLD,
    launching: false,
  };
}

/** What the scripted pass is pressing in the sheet, drawn as a press. */
export type SheetPress = { kind: "workflow" | "engine"; id: string } | { kind: "continue" | "launch" } | null;

const ENGINE_ICONS: Record<EngineId, ComponentType<IconProps>> = {
  "comfy-local": MonitorSmartphone,
  "comfy-remote": Monitor,
  "comfy-cloud": Cloud,
};

/* --------------------------------------------------------------- stepper */

function Stepper({ step, reachable, onGo }: { step: Step; reachable: Step; onGo: (s: Step) => void }) {
  return (
    <nav aria-label="Run setup steps" className="flex shrink-0 items-center gap-2 border-b border-(--line) px-5 py-3 @max-[439px]/sheet:px-4">
      {STEPS.map((s, i) => {
        const done = step > s.id;
        const current = step === s.id;
        const enabled = s.id <= reachable;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="h-px w-4 bg-(--line-strong) @max-[439px]/sheet:w-2" />}
            <button
              type="button"
              onClick={() => enabled && onGo(s.id)}
              disabled={!enabled}
              aria-current={current ? "step" : undefined}
              aria-label={`Step ${s.id}: ${s.label}`}
              className={cn(
                "flex h-7 items-center gap-2 rounded-[40px] pr-3 pl-1 text-sm font-medium transition-colors motion-reduce:transition-none",
                enabled && !current && "cursor-pointer hover:bg-(--surface-2)",
                current ? "text-(--ink)" : done ? "text-(--ink-soft)" : "text-(--ink-faint)",
                !current && "@max-[439px]/sheet:pr-1",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-sm transition-colors motion-reduce:transition-none",
                  done && "border-(--ink) bg-(--ink) text-(--surface)",
                  current && "border-(--ink) text-(--ink)",
                  !done && !current && "border-(--line-strong) text-(--ink-faint)",
                )}
              >
                {s.id}
              </span>
              <span className={cn(!current && "@max-[439px]/sheet:hidden")}>{s.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

/* --------------------------------------------------------- workflow pick */

function WorkflowThumb({ id, className }: { id: string; className: string }) {
  const src = PICKER_THUMBS[id];
  return (
    <span aria-hidden className={cn("shrink-0 overflow-hidden rounded-lg border border-(--line) bg-(--surface-2)", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- fixed-size local thumbnail
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <span className="block h-full w-full" style={gradientFor(id)} />
      )}
    </span>
  );
}

function WorkflowPicker({
  selectedId,
  pressedId,
  onPick,
}: {
  selectedId: string | null;
  pressedId: string | null;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const builtins = BUILTIN_WORKFLOWS.filter((w) => !q || w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q));
  return (
    <>
      <div className="mb-2 flex h-7 items-center justify-between">
        <p className="text-sm font-medium text-(--ink-soft)">Choose a workflow</p>
      </div>
      <label
        className={cn(
          "mb-3 flex items-center gap-2 rounded-lg border border-(--line-strong) bg-(--surface) px-2.5",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--ink)",
        )}
      >
        <IconBox className="text-(--ink-faint)">
          <Search />
        </IconBox>
        <span className="sr-only">Search workflows</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workflows"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-(--ink-faint) focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
      {builtins.length === 0 ? (
        <p className="py-8 text-center text-sm text-(--ink-faint)">No workflows match your search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {builtins.map((w) => {
            const selected = w.id === selectedId;
            return (
              <button
                key={w.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onPick(w.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2 pr-3 text-left transition-all duration-200 motion-reduce:transition-none",
                  selected ? "border-(--ink) bg-(--surface-2)" : "border-(--line) hover:bg-(--surface-2)",
                  pressedId === w.id && "scale-[0.99] bg-(--surface-2)",
                )}
              >
                <WorkflowThumb id={w.id} className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{w.name}</span>
                  <span className="block truncate text-sm text-(--ink-soft)">{w.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- details */

/**
 * Where the scripted pass has the sheet open, a touch screen doesn't scroll its body or prompts, so a vertical
 * swipe across the tile still moves the page. A mouse or trackpad scrolls them,
 * and once the visitor takes over they scroll for touch too.
 */
const SCRIPTED_TOUCH_LOCK = "not-pointer-fine:overflow-y-hidden";

/** PromptField's auto-growing textarea: grows with the text, then scrolls past ~7 lines (176px). */
function PromptField({
  label,
  value,
  onChange,
  scripted,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  scripted: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  }, [value]);
  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-(--ink-soft)">{label}</p>
        {/* Save prompt, Saved prompts, Open large editor: the library and the editor are not part of this tile. */}
        <div aria-hidden className="flex items-center gap-1 text-(--ink-faint)">
          <span className="flex size-6 items-center justify-center rounded-lg">
            <IconBox>
              <BookmarkPlus {...ICON} />
            </IconBox>
          </span>
          <span className="flex size-6 items-center justify-center rounded-lg">
            <IconBox>
              <Bookmark />
            </IconBox>
          </span>
          <span className="flex size-6 items-center justify-center rounded-lg">
            <IconBox>
              <Maximize2 />
            </IconBox>
          </span>
        </div>
      </div>
      <textarea
        ref={ref}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={cn(
          "block min-h-[72px] w-full resize-none rounded-lg border border-(--line-strong) bg-(--surface) px-3 py-2 text-sm outline-none transition-colors placeholder:text-(--ink-faint) focus:border-(--ink) motion-reduce:transition-none",
          scripted && SCRIPTED_TOUCH_LOCK,
        )}
      />
    </div>
  );
}

function ParamField({
  param,
  value,
  onChange,
  scripted,
}: {
  param: WorkflowParam;
  value: string;
  onChange: (v: string) => void;
  scripted: boolean;
}) {
  if (param.type === "select") {
    return (
      <div role="group" aria-label={param.label}>
        <p aria-hidden className="mb-2 text-sm font-medium text-(--ink-soft)">
          {param.label}
        </p>
        <div className="flex flex-wrap gap-2">
          {param.options.map((option) => {
            const active = value === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option)}
                className={cn(
                  "h-7 cursor-pointer rounded-[40px] border px-3 text-sm font-medium transition-all duration-200 motion-reduce:transition-none",
                  active ? "border-(--ink) bg-(--ink) text-(--surface)" : "border-(--line) text-(--ink-soft) hover:bg-(--surface-2) hover:text-(--ink)",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (param.type === "number") {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-(--ink-soft)">{param.label}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          inputMode="decimal"
          className="h-9 w-40 rounded-lg border border-(--line-strong) bg-(--surface) px-3 text-sm outline-none transition-colors placeholder:text-(--ink-faint) focus:border-(--ink) motion-reduce:transition-none"
        />
      </label>
    );
  }
  return <PromptField label={param.label} value={value} onChange={onChange} scripted={scripted} />;
}

/* ---------------------------------------------------------------- sheet */

/** Flag the sides of a sideways-scrolling strip that have more past them (data-fade-l, data-fade-r). */
function markStripEdges(strip: HTMLElement) {
  strip.toggleAttribute("data-fade-l", strip.scrollLeft > 1);
  strip.toggleAttribute("data-fade-r", strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1);
}

export function RunSheet({
  state,
  onClose,
  onGo,
  onPick,
  onParam,
  onStageAction,
  onEngine,
  onSampleFirst,
  onLaunch,
  pressed,
  focusOnOpen,
  scripted,
  reducedMotion,
}: {
  state: SheetState;
  onClose: () => void;
  onGo: (step: Step) => void;
  onPick: (workflowId: string) => void;
  onParam: (id: string, value: string) => void;
  onStageAction: (action: StageAction) => void;
  onEngine: (id: EngineId) => void;
  onSampleFirst: (on: boolean) => void;
  onLaunch: () => void;
  pressed: SheetPress;
  /** Opened by the visitor (not the scripted pass): take focus. */
  focusOnOpen: boolean;
  /** The scripted pass is driving: on a touch screen the sheet leaves vertical swipes to the page. */
  scripted: boolean;
  reducedMotion: boolean;
}) {
  const { target, step, direction, workflowId, params, engineId, stageAction, sampleFirst, launching } = state;
  const workflow = workflowById(workflowId);
  const estimate = estimateOf(target);
  const images = estimate.images;
  const bigTarget = images > SAMPLE_NUDGE_THRESHOLD;
  const engineReady = engineId != null && ENGINES.some((e) => e.id === engineId && e.available);
  const launch = useHover(reducedMotion);
  const asideRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  /** Whether the visitor's focus is in the sheet. A removed button fires no blur, so this outlives it. */
  const focusInside = useRef(false);

  // Each step starts at the top of the sheet's body. A step change that took the focused control with it (a
  // workflow row, Back on the first step) hands focus to the footer's primary button, as a keyboard user goes on.
  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    const from = document.activeElement;
    if (!focusInside.current || !(from === document.body || bodyRef.current?.contains(from))) return;
    asideRef.current?.querySelector<HTMLElement>("footer [data-primary]")?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (focusOnOpen) asideRef.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  // On a narrow sheet the When published choices scroll sideways in their own strip. Its edges fade where more
  // choices wait past them, and the chosen one is kept in full view, whether it was tapped half-hidden or
  // reached with the arrow keys.
  const stageStrip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const strip = stageStrip.current;
    const chosen = strip?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!strip || !chosen) return;
    markStripEdges(strip);
    const ro = new ResizeObserver(() => markStripEdges(strip));
    ro.observe(strip);
    const box = strip.getBoundingClientRect();
    const own = chosen.getBoundingClientRect();
    // 8px past the option takes in the track's own padding, so an end option scrolls the strip to its end.
    const by = own.left < box.left ? own.left - box.left - 8 : own.right > box.right ? own.right - box.right + 8 : 0;
    if (by) strip.scrollBy({ left: by, behavior: reducedMotion ? "auto" : "smooth" });
    return () => ro.disconnect();
  }, [stageAction, step, reducedMotion]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  const transition = reducedMotion ? { duration: 0 } : SHEET_TRANSITION;
  const stepTransition = reducedMotion ? { duration: 0 } : SHEET_STEP_TRANSITION;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  return (
    <motion.div
      className="absolute inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: easeSoft }}
    >
      <div aria-hidden className="absolute inset-0 bg-(--ink)/20 backdrop-blur-[3px]" onClick={onClose} />
      <motion.aside
        ref={asideRef}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onFocusCapture={() => (focusInside.current = true)}
        onBlurCapture={(e) => {
          if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) focusInside.current = false;
        }}
        initial={reducedMotion ? { opacity: 0 } : { x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { x: 80, opacity: 0 }}
        transition={transition}
        className="@container/sheet absolute inset-y-3 right-3 flex w-[calc(100%-24px)] max-w-xl flex-col overflow-hidden rounded-2xl border border-(--line) bg-(--surface) shadow-(--shadow-lift) outline-none"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3 @max-[439px]/sheet:px-4">
          <div className="min-w-0">
            <p id={titleId} className="text-lg font-medium">
              Run workflow
            </p>
            <p className="mt-1 text-sm text-(--ink-soft)">
              {targetLabel(target)}
              <span className="text-(--ink-faint)">
                {" "}
                · {plural(estimate.images, "image")} across {plural(estimate.products, "product")}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-(--ink-faint) transition-colors hover:bg-(--surface-2) hover:text-(--ink) motion-reduce:transition-none"
          >
            <IconBox>
              <X />
            </IconBox>
          </button>
        </header>

        <Stepper step={step} reachable={workflowId ? 3 : 1} onGo={onGo} />

        <div ref={bodyRef} className={cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto", scripted && SCRIPTED_TOUCH_LOCK)}>
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: reducedMotion ? 0 : direction * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : direction * -32 }}
              transition={stepTransition}
              className="px-5 py-4 @max-[439px]/sheet:px-4"
            >
              {step === 1 && (
                <WorkflowPicker selectedId={workflowId} pressedId={pressed?.kind === "workflow" ? pressed.id : null} onPick={onPick} />
              )}

              {step === 2 && workflow && (
                // One shrinkable track, so on a narrow sheet the Segmented scrolls sideways in its own strip and the
                // prompts and chips fit the sheet, instead of the nowrap Segmented widening the whole step.
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-(--ink-soft)">When published</p>
                    <div
                      ref={stageStrip}
                      onScroll={(e) => markStripEdges(e.currentTarget)}
                      className="max-w-full overflow-x-auto [--fade-l:0px] [--fade-r:0px] [mask-image:linear-gradient(to_right,transparent,#000_var(--fade-l),#000_calc(100%_-_var(--fade-r)),transparent)] data-fade-l:[--fade-l:24px] data-fade-r:[--fade-r:40px]"
                    >
                      <Segmented
                        aria-label="When published"
                        value={stageAction}
                        onChange={onStageAction}
                        options={STAGE_ACTIONS.map((a) => ({ value: a.value, label: a.label }))}
                        reducedMotion={reducedMotion}
                      />
                    </div>
                  </div>
                  {(WORKFLOW_PARAMS[workflow.id] ?? []).length === 0 && (
                    <p className="text-sm text-(--ink-faint)">{workflow.name} has no settings — continue to pick an engine.</p>
                  )}
                  {(WORKFLOW_PARAMS[workflow.id] ?? []).map((param) => (
                    <ParamField
                      key={param.id}
                      param={param}
                      value={params[param.id] ?? param.defaultValue ?? ""}
                      onChange={(v) => onParam(param.id, v)}
                      scripted={scripted}
                    />
                  ))}
                </div>
              )}

              {step === 3 && workflow && (
                <>
                  {/* What's about to run: the last check before launch. */}
                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-(--line) bg-(--surface-2) p-3">
                    <WorkflowThumb id={workflow.id} className="size-9" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{workflow.name}</p>
                      <p className="text-sm text-(--ink-faint)">
                        {plural(images, "image")} · {STAGE_LABELS[stageAction]}
                      </p>
                    </div>
                  </div>

                  <p className="mb-2 text-sm font-medium text-(--ink-soft)">Engine — local or cloud</p>
                  <div className="grid grid-cols-1 gap-2">
                    {ENGINES.map((engine) => {
                      const Icon = ENGINE_ICONS[engine.id];
                      const active = engine.id === engineId;
                      return (
                        <button
                          key={engine.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => engine.available && onEngine(engine.id)}
                          disabled={!engine.available}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 motion-reduce:transition-none",
                            engine.available ? "cursor-pointer" : "opacity-50",
                            active ? "border-(--ink) bg-(--surface-2)" : "border-(--line) hover:bg-(--surface-2)",
                            pressed?.kind === "engine" && pressed.id === engine.id && "scale-[0.99] bg-(--surface-2)",
                          )}
                        >
                          <IconBox className={active ? "text-(--ink)" : "text-(--ink-faint)"}>
                            <Icon />
                          </IconBox>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{engine.name}</span>
                            <span className="block truncate text-sm text-(--ink-soft)">{engine.detail ?? engine.description}</span>
                          </span>
                          <span
                            aria-hidden
                            className={cn("size-2.5 shrink-0 rounded-full", engine.available ? "bg-(--success)" : "bg-(--ink-faint)")}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {!engineReady && <p className="mt-3 text-sm text-(--ink-faint)">Select an engine to run.</p>}

                  {bigTarget && (
                    <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-(--line) p-4 transition-colors hover:bg-(--surface-2) motion-reduce:transition-none">
                      <input
                        type="checkbox"
                        checked={sampleFirst}
                        onChange={(e) => onSampleFirst(e.target.checked)}
                        className="mt-1 size-4 shrink-0 accent-(--ink)"
                      />
                      <span>
                        <span className="text-sm font-medium">Test on {SAMPLE_SIZE} images first (recommended)</span>
                        <span className="mt-1 block text-sm text-(--ink-soft)">
                          A small spread across products lands in the review queue. One click promotes to the remaining{" "}
                          {Math.max(0, images - SAMPLE_SIZE)} images.
                        </span>
                      </span>
                    </label>
                  )}

                  <p className="mt-4 flex items-center gap-2 rounded-xl border border-(--line) bg-(--surface-2) p-3 text-sm text-(--ink-soft)">
                    <IconBox className="text-(--success)">
                      <ShieldCheck />
                    </IconBox>
                    Results stage for review as they finish — nothing publishes automatically.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-(--line) px-5 py-4 @max-[439px]/sheet:px-4 @max-[439px]/sheet:py-3">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => onGo((step - 1) as Step)}>
                <IconBox>
                  <ArrowLeft />
                </IconBox>
                Back
              </Button>
            )}
          </div>
          {step < 3 ? (
            <Button variant="primary" data-primary onClick={() => onGo((step + 1) as Step)} disabled={!workflowId} pressed={pressed?.kind === "continue"}>
              Continue
              <IconBox>
                <ArrowRight />
              </IconBox>
            </Button>
          ) : (
            <Button
              variant="primary"
              data-primary
              onClick={onLaunch}
              disabled={!workflowId || images === 0 || !engineReady || launching}
              pressed={pressed?.kind === "launch"}
              {...launch.props}
            >
              {launching ? (
                <Spinner label="Starting the run" className="border-(--accent-ink)/40 border-t-(--accent-ink)" />
              ) : (
                <IconBox>
                  <PlayIcon hover={launch.hover || pressed?.kind === "launch"} />
                </IconBox>
              )}
              {sampleFirst && bigTarget ? `Run test (${Math.min(SAMPLE_SIZE, images)})` : `Run on ${plural(images, "image")}`}
            </Button>
          )}
        </footer>
      </motion.aside>
    </motion.div>
  );
}
