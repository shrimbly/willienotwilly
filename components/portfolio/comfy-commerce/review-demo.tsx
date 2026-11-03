"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { animate, useMotionValue } from "motion/react";

import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";
import { cn } from "@/lib/utils";

import { Button } from "./kit/button";
import { CcHint } from "./kit/demo-hint";
import { CcRoot } from "./kit/cc-root";
import { EmptyState } from "./kit/empty-state";
import { Sparkles } from "./kit/icons";
import { useInteractOnRelease } from "./kit/interact";
import { easeSoft } from "./kit/motion";
import { CompactBar, PageHeader, PAGE_TITLES, Sidebar } from "./kit/shell";
import type { StagingPress } from "./kit/staging-actions";
import { STATUS_STYLES, type StagingState } from "./kit/status-chip";
import { initialQueue, SCRIPTED_REJECT, type QueueItem } from "./review/data";
import { ReviewLightbox, type CompareMode } from "./review/review-lightbox";

// The hero: Comfy Commerce's Review & publish page, live. The real shell
// (components/shell/Sidebar.tsx, "Review & publish" active with its pending
// badge) around the ReviewLightbox from features/review/CompareMedia.tsx in
// Wipe mode, over four real T-Shirt Shoot results. Drag the wipe, flip to side
// by side, walk the queue, and approve, publish, revert or reject: the gate's
// state machine (packages/shared/src/staging.ts) with local state in place of
// the broker.

/** Where the divider rests: mid-wipe, the frame reduced motion keeps. */
const REST = 50;
/** How long the store write takes (the spinner and "Publishing…"), and a revert. */
const PUBLISH_MS = 900;
const REVERT_MS = 700;
/** A rejected result shows its chip this long before it leaves the queue, as it leaves the product's All view. */
const REJECT_BEAT_MS = 650;

const HINT = "Drag the divider, then approve or reject";

/**
 * Comfy Commerce hero: the review lightbox inside the app shell. On the page
 * it is the product's review loop; as a listing thumbnail it plays it: the
 * wipe sweeps, Approve, Publish, the next pair slides in.
 */
export function ComfyCommerceReviewDemo() {
  const root = useRef<HTMLDivElement>(null);
  const { active, inView, reducedMotion } = useDemoActive(root);
  const thumbnail = useDemoThumbnail();

  const [items, setItems] = useState<QueueItem[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [mode, setMode] = useState<CompareMode>("wipe");
  const [pressed, setPressed] = useState<StagingPress>(null);
  const [touched, setTouched] = useState(false);
  const pos = useMotionValue(REST);

  const markTouched = useCallback(() => setTouched(true), []);
  const interact = useInteractOnRelease(markTouched);

  const item = items[Math.min(index, items.length - 1)] as QueueItem | undefined;
  const pendingCount = items.filter((i) => i.state === "pending").length;

  // Fetch the whole queue's images once the tile is near, so each next pair slides in already drawn.
  useEffect(() => {
    if (!inView) return;
    for (const { pair } of initialQueue()) {
      for (const { src } of [pair.source, pair.result]) new Image().src = src;
    }
  }, [inView]);

  /* ------------------------------------------------------------ the gate */

  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const setState = useCallback(
    (id: string, from: StagingState[], to: StagingState) =>
      setItems((list) => list.map((i) => (i.id === id && from.includes(i.state) ? { ...i, state: to } : i))),
    [],
  );

  /** A tap that swaps the buttons under a keyboard user hands focus to the new primary one. */
  const refocus = useRef(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  const approve = useCallback((id: string) => setState(id, ["pending"], "approved"), [setState]);
  const publish = useCallback(
    (id: string) => {
      // Publish only ever claims an approved item (stagingService.publishOne's atomic UPDATE … WHERE state IN ('approved','failed')).
      setState(id, ["approved", "failed"], "publishing");
      later(PUBLISH_MS, () => setState(id, ["publishing"], "published"));
    },
    [later, setState],
  );
  const revert = useCallback(
    (id: string) => {
      // A revert restores the snapshot and puts the item back to approved, publishable again.
      setState(id, ["published"], "publishing");
      later(REVERT_MS, () => setState(id, ["publishing"], "approved"));
    },
    [later, setState],
  );
  const reject = useCallback(
    (id: string) => {
      setState(id, ["pending", "approved", "failed"], "rejected");
      later(REJECT_BEAT_MS, () => {
        setDirection(1);
        setItems((list) => list.filter((i) => i.id !== id || i.state !== "rejected"));
      });
    },
    [later, setState],
  );

  const go = useCallback(
    (step: 1 | -1) => {
      const next = Math.max(0, Math.min(items.length - 1, index + step));
      if (next === index) return;
      // ←/→ while focus is on the item's buttons: the next item's may be different ones (Publish gives way to
      // Approve), so focus follows to its primary button rather than dropping to the page.
      if (actionsRef.current?.contains(document.activeElement)) refocus.current = true;
      setDirection(step);
      setIndex(next);
    },
    [index, items.length],
  );

  const restart = () => {
    // "Stage them again" goes with the empty state: focus moves to the first item's Approve.
    refocus.current = true;
    setDirection(1);
    setItems(initialQueue());
    setIndex(0);
    pos.set(REST);
  };

  // Keep the index on the queue as it shrinks (the next item slides into the gap).
  if (items.length > 0 && index > items.length - 1) setIndex(items.length - 1);

  /* ------------------------------------------- focus after the buttons swap */

  useLayoutEffect(() => {
    if (!refocus.current) return;
    const actions = actionsRef.current;
    const focused = document.activeElement;
    // Only where the press's own button went away; never pull focus back from elsewhere.
    if (focused && focused !== document.body && focused !== actions) {
      refocus.current = false;
      return;
    }
    const target = actions?.querySelector<HTMLElement>("[data-primary]") ?? actions?.querySelector<HTMLElement>("button");
    if (target) {
      refocus.current = false;
      target.focus({ preventScroll: true });
    } else if (actions) {
      // The spinner or a rejected item has no buttons yet: hold focus on the row until they come back.
      actions.focus({ preventScroll: true });
    } else {
      refocus.current = false;
      (nextRef.current ?? restartRef.current)?.focus({ preventScroll: true });
    }
  }, [items, index]);

  const byPerson = (fn: (id: string) => void) => {
    if (!item) return;
    markTouched();
    refocus.current = true;
    fn(item.id);
  };

  /* ------------------------------------------------- the scripted loop */

  // Read by the loop between beats, so it always acts on what is on screen.
  const live = useRef({ items, index });
  useLayoutEffect(() => {
    live.current = { items, index };
  });

  // A listing thumbnail plays the review loop while its card plays: the wipe
  // sweeps across, Approve, Publish, and the next pair slides in. Paused, it
  // holds its place; it picks up from the current item's state.
  useEffect(() => {
    if (!thumbnail || !active) return;
    let cancelled = false;
    const pending: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => pending.push(setTimeout(resolve, ms)));
    const sweep = async (to: number, duration: number) => {
      if (!cancelled) await animate(pos, to, { duration, ease: easeSoft });
    };
    const press = async (which: StagingPress, act: () => void) => {
      setPressed(which);
      await wait(220);
      setPressed(null);
      if (!cancelled) act();
    };

    (async () => {
      await wait(300);
      while (!cancelled) {
        const { items: list, index: i } = live.current;
        const current = list[i];
        if (!current) {
          setDirection(1);
          setItems(initialQueue());
          setIndex(0);
          await wait(700);
        } else if (current.state === "pending") {
          await sweep(18, 0.8);
          await sweep(82, 1.1);
          await sweep(REST, 0.7);
          await wait(250);
          if (cancelled) break;
          if (current.id === SCRIPTED_REJECT) {
            await press("reject", () => reject(current.id));
            await wait(REJECT_BEAT_MS + 900);
          } else {
            await press("approve", () => approve(current.id));
            await wait(850);
          }
        } else if (current.state === "approved") {
          await press("publish", () => publish(current.id));
          await wait(PUBLISH_MS + 1300);
        } else if (current.state === "publishing") {
          await wait(300);
        } else if (i < list.length - 1) {
          setDirection(1);
          setIndex(i + 1);
          await wait(800);
        } else {
          // Through the queue: stage it all again and start over.
          setDirection(1);
          setItems(initialQueue());
          setIndex(0);
          await wait(800);
        }
      }
    })();

    return () => {
      cancelled = true;
      pending.forEach(clearTimeout);
      pos.stop();
      setPressed(null);
    };
  }, [thumbnail, active, pos, approve, publish, reject]);

  // On the page, the wipe shows itself once when the tile first plays, then waits for the visitor.
  const introDone = useRef(false);
  useEffect(() => {
    if (thumbnail || introDone.current || touched || !active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      introDone.current = true;
      for (const [to, duration] of [
        [26, 0.9],
        [72, 1.1],
        [REST, 0.8],
      ] as const) {
        if (cancelled) return;
        await animate(pos, to, { duration, ease: easeSoft });
      }
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      pos.stop();
    };
  }, [thumbnail, touched, active, pos]);

  /* ------------------------------------------------------------- input */

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
    // The lightbox's ← / → walk the queue (the wipe's slider and the switch keep their own arrows).
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      go(event.key === "ArrowLeft" ? -1 : 1);
    }
  };
  // Tabbing in from outside sends no key to the tile, but focus lands on its controls, near the hint.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if ((event.target as Element).matches(":focus-visible")) markTouched();
  };

  const status = item ? STATUS_STYLES[item.state].label.replace(/…$/, "") : "";
  const title = PAGE_TITLES.review;

  return (
    <CcRoot
      ref={root}
      role="group"
      aria-label="Comfy Commerce: the review lightbox, comparing each workflow result with the product photo it replaces"
      paused={!active && !reducedMotion}
      {...interact}
      onKeyDownCapture={markTouched}
      onFocusCapture={onFocus}
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">
        Drag the divider or use the slider to wipe between the live product photo and the workflow&apos;s result. Switch
        to side by side, step through the queue with the chevrons or the left and right arrow keys, then approve and
        publish each result, or reject it.
      </p>
      <p className="sr-only" aria-live="polite">
        {item
          ? `${item.pair.productTitle}, ${index + 1} of ${items.length}: ${status}. ${pendingCount} pending review.`
          : "The queue is clear."}
      </p>

      <div className="flex h-full min-h-0 flex-col @min-[720px]/cc:flex-row">
        <Sidebar
          active="review"
          pendingCount={pendingCount}
          reducedMotion={reducedMotion}
          className="hidden @min-[720px]/cc:block"
        />
        <CompactBar
          active="review"
          pendingCount={pendingCount}
          reducedMotion={reducedMotion}
          className="@min-[720px]/cc:hidden"
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 [@container_cc_(height>=600px)]:px-8 [@container_cc_(height>=600px)]:pt-[23px] @max-[719px]/cc:[@container_cc_(height>=600px)]:px-4 @max-[719px]/cc:[@container_cc_(height>=600px)]:pt-4">
          <PageHeader
            title={title}
            subtitle="Compare before and after, then approve or publish."
            className="hidden [@container_cc_(height>=600px)]:flex"
            actions={
              <CcHint corner={null} hidden={touched || thumbnail} className="hidden pt-1 text-right @min-[880px]/cc:block">
                {HINT}
              </CcHint>
            }
          />

          {item ? (
            <ReviewLightbox
              item={item}
              index={Math.min(index, items.length - 1)}
              count={items.length}
              direction={direction}
              mode={mode}
              onModeChange={(next) => {
                markTouched();
                setDirection(0);
                setMode(next);
              }}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
              pos={pos}
              pressed={pressed}
              onApprove={() => byPerson(approve)}
              onReject={() => byPerson(reject)}
              onPublish={() => byPerson(publish)}
              onRevert={() => byPerson(revert)}
              onWipeInteract={markTouched}
              reducedMotion={reducedMotion}
              actionsRef={actionsRef}
              nextRef={nextRef}
              className="flex-1"
            />
          ) : (
            <EmptyState
              icon={<Sparkles />}
              title="The queue is clear"
              body="Every result here was rejected, so nothing reached the store."
              action={
                <Button ref={restartRef} variant="primary" onClick={restart}>
                  Stage them again
                </Button>
              }
              className={cn("flex-1 bg-(--surface)/60")}
            />
          )}
        </div>
      </div>
    </CcRoot>
  );
}
