"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";

import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";

import { Button } from "./kit/button";
import { CcHint } from "./kit/demo-hint";
import { CcRoot } from "./kit/cc-root";
import { IconBox, RotateCcw } from "./kit/icons";
import { useInteractOnRelease } from "./kit/interact";
import { CompactBar, PageHeader, PAGE_TITLES, Sidebar } from "./kit/shell";
import {
  EARLIER_RUNS,
  FINISHED,
  liveRun,
  nextBeat,
  PRODUCT_TITLE,
  SHOTS,
  SOURCE,
  START,
  WORKFLOW_NAME,
  type Script,
} from "./shoot/data";
import { RunRow } from "./shoot/run-row";
import { ShotCard, SourceCard } from "./shoot/shot-card";
import "./shoot/shoot-demo.css";

// "One shirt, three shots": Comfy Commerce's Activity page while a T-Shirt
// Shoot: x3 run works on one flat-lay. The run row is the product's ChainRow
// (web/src/features/activity/ActivityPage.tsx) going queued, running and
// done; its three outputs then stage into review one after another, drawn as
// WorkflowCard tiles with HoverWipe's spring wipe (features/workflows/) that
// compare the flat-lay with each shot. The real run (84ad5946, Spaghetti Tee
// — Black, Comfy Cloud) and its real outputs, with the 59-second generation
// cut to three.

/** The page's own line under its title (ActivityPage.tsx), verbatim. */
const SUBTITLE = "Every workflow run — results stream into the review queue as they finish.";
const HINT = "Slide across a shot to compare";

/**
 * The run's Review button links to the review queue. On this page that is the
 * hero, the review lightbox, so it works like a skip link: scroll there and
 * move focus with it.
 */
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

/** What the live region says at each beat. */
function announce(script: Script) {
  if (script.phase === "queued") return `${WORKFLOW_NAME} is queued for ${PRODUCT_TITLE}.`;
  if (script.phase === "running") return `Generating ${PRODUCT_TITLE}.`;
  if (script.phase === "staging") {
    return `${SHOTS[script.staged - 1].title} staged for review, ${script.staged} of ${SHOTS.length}.`;
  }
  return `Run complete. ${SHOTS.length} results wait for review.`;
}

/**
 * Comfy Commerce: one flat-lay in, three editorial shots out. Plays the run
 * once when the tile first plays (a listing thumbnail would loop it), then
 * waits: slide across a shot to compare it with the flat-lay, or Replay.
 */
export function ComfyCommerceShootDemo() {
  const root = useRef<HTMLDivElement>(null);
  const { active, inView, reducedMotion, pageVisible } = useDemoActive(root);
  const thumbnail = useDemoThumbnail();

  const [script, setScript] = useState<Script>(START);
  /** A person pressed Replay: the beats then run even under reduced motion (without the motion). */
  const [replayed, setReplayed] = useState(false);
  const [touched, setTouched] = useState(false);
  const markTouched = useCallback(() => setTouched(true), []);
  const interact = useInteractOnRelease(markTouched);

  // Reduced motion rests on the finished run until a person asks for it again.
  const shown = reducedMotion && !replayed ? FINISHED : script;
  const run = liveRun(shown);

  // Fetch the shots once the tile is near, so each lands already drawn.
  useEffect(() => {
    if (!inView) return;
    for (const { image } of SHOTS) new Image().src = image.src;
  }, [inView]);

  // The beats run while the tile plays, or after Replay while it is on screen.
  // Paused, the run holds its place and picks up from it.
  const running = active || (replayed && inView && pageVisible);
  useEffect(() => {
    if (!running) return;
    const beat = nextBeat(script, thumbnail);
    if (!beat) return;
    const timer = setTimeout(() => setScript(beat.to), beat.after);
    return () => clearTimeout(timer);
  }, [running, script, thumbnail]);

  const replay = () => {
    markTouched();
    setReplayed(true);
    setScript((s) => ({ ...START, take: s.take + 1 }));
  };

  // Tabbing in from outside sends no key to the tile, but focus lands on its controls, near the hint.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if ((event.target as Element).matches(":focus-visible")) markTouched();
  };

  // The review page's count for a product's group of results, as they arrive.
  const results = `${shown.staged} result${shown.staged === 1 ? "" : "s"}`;

  return (
    <CcRoot
      ref={root}
      role="group"
      aria-label="Comfy Commerce: a T-Shirt Shoot run turning one flat-lay into three shots"
      paused={!active && !reducedMotion}
      {...interact}
      onKeyDownCapture={markTouched}
      onFocusCapture={onFocus}
    >
      <p className="sr-only">
        The Activity page while the T-Shirt Shoot: x3 workflow runs on the {PRODUCT_TITLE} flat-lay. It makes a model
        standing by a window, a close-up of the print and the model seated, and stages each one for review. Move across
        a shot, or focus it and use the arrow keys, to wipe between the flat-lay and the shot. Replay runs it again.
      </p>
      {/* Spoken only for a run the visitor started with Replay; the scripted run stays quiet. (Not on any touch:
          the press that leads to Replay would first announce the old run's "Run complete".) */}
      <p className="sr-only" aria-live="polite">
        {replayed ? announce(shown) : ""}
      </p>

      <div className="flex h-full min-h-0">
        <div className="cc-shoot-sidebar h-full">
          <Sidebar active="activity" pendingCount={shown.staged} reducedMotion={reducedMotion} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="cc-shoot-bar">
            <CompactBar active="activity" reducedMotion={reducedMotion} />
          </div>

          {/* The page, centred in Activity's max width (AppShell's PAGE_WIDTHS: 1024). */}
          <div className="cc-shoot-main mx-auto flex min-h-0 w-full max-w-[1024px] flex-1 flex-col">
            <PageHeader className="cc-shoot-header" title={PAGE_TITLES.activity} subtitle={SUBTITLE} />

            <div className="shrink-0 overflow-hidden rounded-2xl border border-(--line) bg-(--surface) shadow-(--shadow-soft)">
              <RunRow key={run.id} run={run} onReview={openReviewDemo} reducedMotion={reducedMotion} className="border-b-0" />
              {/* Only a window has the height for the history under the live run. */}
              <div className="cc-shoot-history border-t border-(--line)">
                {EARLIER_RUNS.map((earlier) => (
                  <RunRow key={earlier.id} run={earlier} enter={false} />
                ))}
              </div>
            </div>

            <section aria-label={`${PRODUCT_TITLE}, ${results}`} className="mt-6 flex min-h-0 flex-1 flex-col">
              {/* The review page's group header for a run with several outputs for one product (ReviewPage.tsx). */}
              <div className="mb-3 flex items-center gap-4">
                <p className="cc-shoot-heading min-w-0 flex-1 truncate text-base font-medium">
                  {PRODUCT_TITLE}
                  <span className="ml-2 font-normal text-(--ink-faint)">{results}</span>
                </p>
                <CcHint corner={null} hidden={touched || thumbnail} className="hidden shrink-0 @min-[720px]/cc:block">
                  {HINT}
                </CcHint>
                {/* The demo's own control, as the product's ghost Retry button. */}
                <Button variant="ghost" size="sm" onClick={replay} className="shrink-0">
                  <IconBox>
                    <RotateCcw />
                  </IconBox>
                  Replay
                </Button>
              </div>

              <div className="cc-shoot-cards">
                <div className="cc-shoot-grid">
                  <SourceCard productTitle={PRODUCT_TITLE} source={SOURCE} className="cc-shoot-source" />
                  {SHOTS.map((shot, i) => (
                    <ShotCard
                      key={shot.id}
                      title={shot.title}
                      source={SOURCE}
                      shot={shot.image}
                      staged={i < shown.staged}
                      reducedMotion={reducedMotion}
                      onInteract={markTouched}
                    />
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </CcRoot>
  );
}
