"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";
import { SAMPLE_NUDGE_THRESHOLD, type EngineId, type StageAction } from "@/lib/comfy-commerce/run";

import { CcHint } from "./kit/demo-hint";
import { CcRoot } from "./kit/cc-root";
import { useInteractOnRelease } from "./kit/interact";
import { easeSoft } from "./kit/motion";
import type { NavKey } from "./kit/shell";
import { ActivityView, type RunActions } from "./run/activity-view";
import { BrowseView } from "./run/browse-view";
import {
  advanceRun,
  cancelRun,
  filterProducts,
  historyRuns,
  makeRun,
  pendingReview,
  pickSample,
  PICKER_THUMBS,
  retryRun,
  runCounts,
  SCRIPT_ENGINE,
  SCRIPT_PICKS,
  SCRIPT_WORKFLOW,
  skipCurrent,
  targetTiles,
  TILE_BY_ID,
  workflowById,
  type DemoRun,
  type RunTarget,
  type Tile,
} from "./run/data";
import { openSheet, RunSheet, type SheetPress, type SheetState, type Step } from "./run/run-sheet";
import { SelectionBar } from "./run/selection-bar";
import { RunCompactBar, RunSidebar, type RunNav } from "./run/shell";

// "Run a workflow across the catalog": Comfy Commerce's Browse products page
// (web/src/features/browse/BrowsePage.tsx) in the app shell, live. Pick tiles
// (shift-click for a range) or take the whole catalog, then the RunSheet
// (features/activity/RunSheet.tsx) walks Workflow → Details → Engine, and a
// launch lands on Activity (features/activity/ActivityPage.tsx), where the run
// works through its images and stages each result for review. Local state and
// timers stand in for the broker, its executor and the engines.

type View = "browse" | "activity";

/** What the scripted pass is pressing: a page button, or something in the sheet. */
type Press = { kind: "selection-run" } | SheetPress;

/** How long one image takes to come back: a few beats for a small batch, quicker for a big one. */
const itemMs = (run: DemoRun) => (run.items.length > 6 ? 650 : 1400);
/** createRun's round trip: the launch button's spinner, before the sheet closes. */
const LAUNCH_MS = 450;
/** One page out and the next in (the shell's crossfade), in ms. */
const VIEW_SWAP_MS = 650;

const STEP_LABELS: Record<Step, string> = { 1: "Workflow", 2: "Details", 3: "Engine" };

const HINT = "Pick a few tees, or run the whole catalog";

/** Bring the review lightbox (this page's hero) into view and focus it: where the product's Review links go. */
function openReviewDemo() {
  const target = document.querySelector<HTMLElement>('[data-demo="comfy-commerce-review"]');
  if (!target) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
}

/**
 * Comfy Commerce highlight: choose media and run a workflow over it. On first
 * view a scripted pass picks three tees, runs T-Shirt Shoot: x3 on Comfy
 * Cloud and comes back to the grid; the first press, key or tap stops it.
 */
export function ComfyCommerceRunDemo() {
  const root = useRef<HTMLDivElement>(null);
  const { active, inView, reducedMotion } = useDemoActive(root);
  const thumbnail = useDemoThumbnail();

  const [view, setView] = useState<View>("browse");
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetFocus, setSheetFocus] = useState(false);
  const [runs, setRuns] = useState<DemoRun[]>(historyRuns);
  const [pressed, setPressed] = useState<Press>(null);
  const [touched, setTouched] = useState(false);
  const [entered, setEntered] = useState(false);
  const [rested, setRested] = useState(false);
  const [scriptDone, setScriptDone] = useState(false);

  const markTouched = useCallback(() => setTouched(true), []);
  const interact = useInteractOnRelease(markTouched);

  // The grid staggers in the first time the tile is seen.
  if (inView && !entered) setEntered(true);
  // Under reduced motion there is no pass: the tile rests on three tees picked, the selection bar up.
  if (reducedMotion && !rested && !touched) {
    setRested(true);
    setSelected(SCRIPT_PICKS);
  }

  /* -------------------------------------------------------------- browse */

  const products = useMemo(() => filterProducts(query, tag), [query, tag]);
  const visible = useMemo(
    () => products.flatMap((product) => product.media.map((_, i) => `${product.slug}#${i + 1}`)),
    [products],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allVisibleSelected = visible.length > 0 && visible.every((id) => selectedSet.has(id));

  const toggle = useCallback((id: string) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])), []);

  /** A plain click toggles and sets the anchor; shift-click adds everything from the anchor to here (BrowsePage selectRange). */
  const onSelect = (tile: Tile, shiftKey: boolean) => {
    if (shiftKey) {
      const to = visible.indexOf(tile.id);
      const from = anchor ? visible.indexOf(anchor) : -1;
      if (from === -1) {
        toggle(tile.id);
        setAnchor(tile.id);
        return;
      }
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      const range = visible.slice(lo, hi + 1);
      setSelected((list) => [...list, ...range.filter((id) => !list.includes(id))]);
      return;
    }
    toggle(tile.id);
    setAnchor(tile.id);
  };

  const selectAll = () => setSelected((list) => [...list, ...visible.filter((id) => !list.includes(id))]);
  const clearSelection = () => setSelected([]);

  /* --------------------------------------------------------------- sheet */

  const returnFocus = useRef<HTMLElement | null>(null);
  /** The visitor's focus went into the sheet (it stays set when the focused button goes away with the sheet). */
  const sheetFocused = useRef(false);
  const selectionRunRef = useRef<HTMLButtonElement>(null);
  const runCatalogRef = useRef<HTMLButtonElement>(null);
  const launchTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = launchTimers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const openRun = useCallback((target: RunTarget, byPerson: boolean) => {
    returnFocus.current = byPerson && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheetFocused.current = false;
    setSheetFocus(byPerson);
    setSheet(openSheet(target));
  }, []);

  // Hand focus back to what opened the sheet once it has closed and the page behind it is no longer inert,
  // if focus was in it (a scripted close never moves focus).
  const restoreFocus = useRef(false);
  useLayoutEffect(() => {
    if (sheet || !restoreFocus.current) return;
    restoreFocus.current = false;
    const to = returnFocus.current?.isConnected ? returnFocus.current : (selectionRunRef.current ?? runCatalogRef.current);
    to?.focus({ preventScroll: true });
  }, [sheet]);

  const closeSheet = () => {
    if (sheet?.launching) return;
    restoreFocus.current = sheetFocused.current;
    sheetFocused.current = false;
    setSheet(null);
  };

  const editSheet = useCallback((fn: (s: SheetState) => SheetState) => setSheet((s) => (s ? fn(s) : s)), []);
  const goStep = useCallback(
    (step: Step) => editSheet((s) => (s.workflowId || step === 1 ? { ...s, step, direction: step >= s.step ? 1 : -1 } : s)),
    [editSheet],
  );
  const pickWorkflow = useCallback(
    (id: string) => editSheet((s) => ({ ...s, workflowId: id, params: id === s.workflowId ? s.params : {}, step: 2, direction: 1 })),
    [editSheet],
  );
  const chooseEngine = useCallback((id: EngineId) => editSheet((s) => ({ ...s, engineId: id })), [editSheet]);

  const launch = useCallback(() => {
    const current = sheet;
    const workflow = workflowById(current?.workflowId ?? null);
    if (!current || !workflow || !current.engineId || current.launching) return;
    editSheet((s) => ({ ...s, launching: true }));
    const timer = setTimeout(
      () => {
        launchTimers.current.delete(timer);
        const tiles = targetTiles(current.target);
        const sampling = current.sampleFirst && tiles.length > SAMPLE_NUDGE_THRESHOLD;
        const items = sampling ? pickSample(tiles) : tiles;
        const sampledIds = new Set(items.map((t) => t.id));
        const run = makeRun(
          {
            workflowId: workflow.id,
            workflowName: workflow.name,
            engineId: current.engineId!,
            targetKind: current.target.kind,
            stageAction: current.stageAction,
            sample: sampling,
            sampleOfTotal: sampling ? tiles.length : undefined,
            remaining: sampling ? tiles.filter((t) => !sampledIds.has(t.id)).map((t) => t.id) : undefined,
          },
          items,
          { finished: reducedMotion },
        );
        setRuns((list) => [run, ...list]);
        // The product closes the sheet and navigates to Activity; Browse's selection goes with the page.
        setSheet(null);
        setSelected([]);
        setView("activity");
        // The launch button went with the sheet: a visitor's focus moves to the new run's row once Activity is in.
        if (!sheetFocused.current) return;
        sheetFocused.current = false;
        const focusRow = setTimeout(
          () => {
            launchTimers.current.delete(focusRow);
            root.current?.querySelector<HTMLElement>('[data-run-view="activity"] article')?.focus({ preventScroll: true });
          },
          reducedMotion ? 30 : VIEW_SWAP_MS,
        );
        launchTimers.current.add(focusRow);
      },
      reducedMotion ? 0 : LAUNCH_MS,
    );
    launchTimers.current.add(timer);
  }, [sheet, editSheet, reducedMotion]);

  /* ---------------------------------------------------------------- runs */

  // Each running run works through its images one at a time; a timer per in-flight image, held while the tile is off screen.
  const inFlight = runs
    .filter((r) => r.state === "running")
    .map((r) => `${r.id}:${r.items.findIndex((i) => i.state === "editing")}:${itemMs(r)}`)
    .join("|");
  useEffect(() => {
    if (!inFlight || (!active && !reducedMotion)) return;
    const timers = inFlight.split("|").map((key) => {
      const [id, index, ms] = key.split(":");
      return setTimeout(
        () => setRuns((list) => list.map((r) => (r.id === id ? advanceRun(r, Number(index)) : r))),
        reducedMotion ? 0 : Number(ms),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [inFlight, active, reducedMotion]);

  const pendingCount = runs.reduce((n, r) => n + pendingReview(r), 0);

  const runActions: RunActions = {
    onCancel: (id) => setRuns((list) => list.map((r) => (r.id === id ? cancelRun(r) : r))),
    onSkip: (id) => setRuns((list) => list.map((r) => (r.id === id ? skipCurrent(r) : r))),
    onRetry: (id) => setRuns((list) => list.map((r) => (r.id === id ? retryRun(r) : r))),
    onClear: (id) => setRuns((list) => list.filter((r) => r.id !== id)),
    onPromote: (id) => {
      const source = runs.find((r) => r.id === id);
      const tiles = (source?.remaining ?? []).map((t) => TILE_BY_ID.get(t)).filter((t): t is Tile => Boolean(t));
      if (!source || tiles.length === 0) return;
      const next = makeRun(
        {
          workflowId: source.workflowId,
          workflowName: source.workflowName,
          engineId: source.engineId,
          targetKind: source.targetKind,
          stageAction: source.stageAction,
          sample: false,
        },
        tiles,
        { finished: reducedMotion },
      );
      setRuns((list) => [next, ...list.map((r) => (r.id === id ? { ...r, promoted: true } : r))]);
    },
    onReview: openReviewDemo,
  };

  /* ---------------------------------------------------------- navigation */

  const routes: RunNav = {
    browse: () => setView("browse"),
    activity: () => setView("activity"),
    review: openReviewDemo,
  };
  const navKey: NavKey = view === "browse" ? "browse" : "activity";

  /* ------------------------------------------------------ scripted pass */

  // Read between beats, so the pass always acts on what is on screen.
  const live = useRef({ runs, sheet, selected });
  const api = useRef({ openRun, pickWorkflow, goStep, chooseEngine, launch, toggle });
  useLayoutEffect(() => {
    live.current = { runs, sheet, selected };
    api.current = { openRun, pickWorkflow, goStep, chooseEngine, launch, toggle };
  });
  const beat = useRef(0);

  // The pass plays once, the first time the tile is on screen: three tees, Run workflow, T-Shirt Shoot: x3,
  // a look at its prompts, Comfy Cloud, the run on Activity, then back to the grid. Off screen it holds its
  // place; any press, key or tap ends it where it stands.
  useEffect(() => {
    if (!active || touched || scriptDone) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // A cleared timer never resolves, so a pass stopped mid-beat simply goes no further.
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms)));
    const press = async (which: Press, act: () => void) => {
      setPressed(which);
      await wait(240);
      setPressed(null);
      act();
    };
    const pick = (id: string) => {
      if (!live.current.selected.includes(id)) api.current.toggle(id);
    };
    const newestRunDone = () => {
      const run = live.current.runs[0];
      return Boolean(run && !run.reviewed && run.state !== "running");
    };
    const beats: (() => Promise<void>)[] = [
      async () => {
        await wait(1100);
        pick(SCRIPT_PICKS[0]);
      },
      async () => {
        await wait(520);
        pick(SCRIPT_PICKS[1]);
      },
      async () => {
        await wait(520);
        pick(SCRIPT_PICKS[2]);
      },
      async () => {
        await wait(950);
        await press({ kind: "selection-run" }, () => api.current.openRun({ kind: "selection", inputs: live.current.selected }, false));
      },
      async () => {
        await wait(1150);
        await press({ kind: "workflow", id: SCRIPT_WORKFLOW }, () => api.current.pickWorkflow(SCRIPT_WORKFLOW));
      },
      async () => {
        await wait(1900);
        await press({ kind: "continue" }, () => api.current.goStep(3));
      },
      async () => {
        await wait(1000);
        await press({ kind: "engine", id: SCRIPT_ENGINE }, () => api.current.chooseEngine(SCRIPT_ENGINE));
      },
      async () => {
        await wait(1000);
        await press({ kind: "launch" }, () => api.current.launch());
      },
      async () => {
        while (!newestRunDone()) await wait(250);
        await wait(2800);
        setView("browse");
      },
    ];
    let stopped = false;
    (async () => {
      while (!stopped && beat.current < beats.length) {
        await beats[beat.current]();
        if (stopped) return;
        beat.current += 1;
      }
      if (!stopped) setScriptDone(true);
    })();
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      setPressed(null);
    };
  }, [active, touched, scriptDone]);

  // Fetch the sheet's workflow thumbnails once the tile is near, so the picker opens already drawn.
  useEffect(() => {
    if (!inView) return;
    for (const src of Object.values(PICKER_THUMBS)) if (src) new Image().src = src;
  }, [inView]);

  /* ---------------------------------------------------------------- input */

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.key !== "Escape" || sheet) return;
    if (selected.length > 0) {
      event.preventDefault();
      clearSelection();
    }
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    sheetFocused.current = Boolean(target.closest('[role="dialog"]'));
    if (target.matches(":focus-visible")) markTouched();
  };

  /* ------------------------------------------------------------- status */

  // Spoken once the visitor drives it; the scripted pass stays quiet.
  const newest = runs[0] && !runs[0].reviewed ? runs[0] : null;
  let status = "";
  if (sheet) status = `Run workflow, step ${sheet.step} of 3: ${STEP_LABELS[sheet.step]}.`;
  else if (view === "activity" && newest) {
    const c = runCounts(newest);
    status =
      newest.state === "running"
        ? `${newest.workflowName} running: ${c.done} of ${c.total} done.`
        : `${newest.workflowName} finished: ${c.done} of ${c.total} done. ${pendingCount} results waiting for review.`;
  } else if (view === "browse") status = `${selected.length} image${selected.length === 1 ? "" : "s"} selected.`;

  const pressedSheet: SheetPress = pressed && (pressed.kind === "workflow" || pressed.kind === "engine" || pressed.kind === "continue" || pressed.kind === "launch") ? pressed : null;
  const showBar = selected.length > 0;
  const viewTransition = reducedMotion ? { duration: 0 } : { duration: 0.3, ease: easeSoft };

  return (
    <CcRoot
      ref={root}
      role="group"
      aria-label="Comfy Commerce: pick product images from the catalog and run a workflow over them"
      paused={!active && !reducedMotion}
      {...interact}
      onKeyDownCapture={markTouched}
      onFocusCapture={onFocus}
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">
        Select images in the Browse grid: click or press Enter on a tile, shift-click to add a range, or use Run catalog for
        every image. Run workflow opens a sheet: choose a workflow, check its details, pick an engine and start the run. The
        run then shows on Activity, staging each result for review.
      </p>
      <p className="sr-only" aria-live="polite">
        {touched ? status : ""}
      </p>

      <div inert={sheet ? true : undefined} className="flex h-full min-h-0 flex-col @min-[720px]/cc:flex-row">
        <RunSidebar
          active={navKey}
          pendingCount={pendingCount}
          routes={routes}
          reducedMotion={reducedMotion}
          className="hidden @min-[720px]/cc:block"
        />
        <RunCompactBar
          active={navKey}
          pendingCount={pendingCount}
          routes={routes}
          reducedMotion={reducedMotion}
          className="@min-[720px]/cc:hidden"
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 [@container_cc_(height>=600px)]:px-8 [@container_cc_(height>=600px)]:pt-[23px] @max-[719px]/cc:[@container_cc_(height>=600px)]:px-4 @max-[719px]/cc:[@container_cc_(height>=600px)]:pt-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              data-run-view={view}
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, filter: reducedMotion ? "none" : "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: reducedMotion ? "none" : "blur(6px)" }}
              transition={viewTransition}
            >
              {view === "browse" ? (
                <BrowseView
                  products={products}
                  filtering={query.trim() !== "" || tag !== "all"}
                  query={query}
                  onQuery={(q) => {
                    setQuery(q);
                    setPage(0);
                  }}
                  tag={tag}
                  onTag={(t) => {
                    setTag(t);
                    setPage(0);
                  }}
                  page={page}
                  onPage={setPage}
                  selected={selectedSet}
                  onSelect={onSelect}
                  onRunCatalog={() => openRun({ kind: "catalog" }, true)}
                  runCatalogRef={runCatalogRef}
                  hint={
                    <CcHint corner={null} hidden={touched || thumbnail || showBar} className="block min-w-0 truncate text-center">
                      {HINT}
                    </CcHint>
                  }
                  selectionBar={
                    <AnimatePresence>
                      {showBar && (
                        <SelectionBar
                          key="selection"
                          count={selected.length}
                          allSelected={allVisibleSelected}
                          onSelectAll={selectAll}
                          onClear={clearSelection}
                          onRun={() => openRun({ kind: "selection", inputs: selected }, true)}
                          runPressed={pressed?.kind === "selection-run"}
                          runRef={selectionRunRef}
                          reducedMotion={reducedMotion}
                        />
                      )}
                    </AnimatePresence>
                  }
                  entered={entered}
                  reducedMotion={reducedMotion}
                />
              ) : (
                <ActivityView runs={runs} actions={runActions} onBrowse={() => setView("browse")} reducedMotion={reducedMotion} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {sheet && (
          <RunSheet
            key="sheet"
            state={sheet}
            onClose={closeSheet}
            onGo={goStep}
            onPick={pickWorkflow}
            onParam={(id, value) => editSheet((s) => ({ ...s, params: { ...s.params, [id]: value } }))}
            onStageAction={(action: StageAction) => editSheet((s) => ({ ...s, stageAction: action }))}
            onEngine={chooseEngine}
            onSampleFirst={(on) => editSheet((s) => ({ ...s, sampleFirst: on }))}
            onLaunch={launch}
            pressed={pressedSheet}
            focusOnOpen={sheetFocus}
            scripted={!touched}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>
    </CcRoot>
  );
}
