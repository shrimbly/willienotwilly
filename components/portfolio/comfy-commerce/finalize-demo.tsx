"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";

import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";
import { cn } from "@/lib/utils";
import { FINALIZE_INITIAL_ORDER, FINALIZE_LISTING, FINALIZE_SLOTS, FINALIZE_TILES } from "@/lib/comfy-commerce/finalize";

import { BackToReview, FinalizeHeader, PublishedRow } from "./finalize/finalize-parts";
import { GalleryStrip, type StripMoveSource } from "./finalize/gallery-strip";
import { UploadCloudIcon } from "./finalize/upload-cloud-icon";
import { Button } from "./kit/button";
import { CcHint } from "./kit/demo-hint";
import { CcRoot } from "./kit/cc-root";
import { EmptyState } from "./kit/empty-state";
import { IconBox, Sparkles } from "./kit/icons";
import { useInteractOnRelease } from "./kit/interact";
import { CompactBar, PAGE_TITLES, Sidebar } from "./kit/shell";
import { Spinner } from "./kit/spinner";
import { StatusChip, type StagingState } from "./kit/status-chip";
import "./finalize/finalize-demo.css";

// "Arrange the gallery": Comfy Commerce's Finalize step (web/src/features/review/FinalizePage.tsx
// and GalleryStrip.tsx), live. The listing's two live flat-lays and the three
// T-Shirt Shoot results waiting to join them sit in one strip, in the order
// they would publish. Drag the results into place, reject any you don't want,
// then Publish; the listing goes live and one click reverts it, because every
// publish saves the old gallery first (stagingService.publishOne snapshots
// the prior media before it touches the store). Local state stands in for the
// broker, and Publish takes a moment as the store write would.

type Phase = "staged" | "publishing" | "published" | "reverting";

/** How long the store write takes (the spinner on Publish), and a revert. */
const PUBLISH_MS = 1300;
const REVERT_MS = 800;

const HINT = "Drag to reorder";
const SUBTITLE = "Drag each listing's gallery into its final order, then publish everything staged.";

const TILES = new Map(FINALIZE_TILES.map((t) => [t.id, t]));
const labelOf = (id: string) => TILES.get(id)?.label ?? "Image";

/** The listing's state for its chip: the results are approved while staged (Finalize only gathers approved items). */
const CHIP: Record<Phase, StagingState> = {
  staged: "approved",
  publishing: "publishing",
  published: "published",
  reverting: "published",
};

/**
 * Comfy Commerce highlight: the Finalize page for one listing. Its first
 * time on screen it lifts the standing shot to the front, as a person would
 * to make it the featured image, then waits for the visitor.
 */
export function ComfyCommerceFinalizeDemo() {
  const root = useRef<HTMLDivElement>(null);
  const { active, reducedMotion } = useDemoActive(root, 0.5);
  const thumbnail = useDemoThumbnail();
  const instructionsId = useId();

  const [order, setOrder] = useState<string[]>(FINALIZE_INITIAL_ORDER);
  const [phase, setPhase] = useState<Phase>("staged");
  const [publishedCount, setPublishedCount] = useState(0);
  const [lifted, setLifted] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [message, setMessage] = useState("");

  const markTouched = useCallback(() => setTouched(true), []);
  const interact = useInteractOnRelease(markTouched);

  const stagedCount = useMemo(() => order.filter((id) => TILES.get(id)?.staged).length, [order]);
  const empty = phase === "staged" && stagedCount === 0;
  const locked = phase !== "staged";
  const live = phase === "published" || phase === "reverting";

  /* ------------------------------------------------------------ timers */

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

  /* --------------------------------------------- publish, revert, reject */

  const ctaRef = useRef<HTMLButtonElement>(null);
  const revertRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  /** Where focus goes once the buttons swap, when the press's own button had it. */
  const refocus = useRef<"revert" | "publish" | "restart" | null>(null);

  const publish = (event: MouseEvent<HTMLButtonElement>) => {
    if (phase !== "staged" || stagedCount === 0) return;
    markTouched();
    refocus.current = document.activeElement === event.currentTarget ? "revert" : null;
    const count = stagedCount;
    const first = labelOf(order[0]);
    setPhase("publishing");
    setMessage("Publishing…");
    later(PUBLISH_MS, () => {
      setPhase("published");
      setPublishedCount(count);
      setMessage(
        `Published ${count} new image${count === 1 ? "" : "s"} to ${FINALIZE_LISTING.title}, with ${first} as the featured image. The previous gallery was saved first, so Revert puts it back.`,
      );
    });
  };

  const revert = () => {
    if (phase !== "published") return;
    markTouched();
    refocus.current = document.activeElement === revertRef.current ? "publish" : null;
    setPhase("reverting");
    setMessage("Reverting…");
    later(REVERT_MS, () => {
      setPhase("staged");
      setMessage("Reverted. The store shows the previous gallery again, and the new images are staged, ready to publish.");
    });
  };

  const reject = (id: string, source: StripMoveSource) => {
    if (locked || !TILES.get(id)?.staged) return;
    markTouched();
    const next = order.filter((x) => x !== id);
    setOrder(next);
    const left = next.filter((x) => TILES.get(x)?.staged).length;
    if (left === 0 && source === "keyboard") refocus.current = "restart";
    setMessage(
      left === 0
        ? `Rejected ${labelOf(id)}. Nothing is staged for this listing now, so there's nothing to publish.`
        : `Rejected ${labelOf(id)}. It won't be published.`,
    );
  };

  const restart = () => {
    if (document.activeElement === restartRef.current) refocus.current = "publish";
    setOrder(FINALIZE_INITIAL_ORDER);
    setPhase("staged");
    setMessage("The three results are staged again.");
  };

  useLayoutEffect(() => {
    const target = refocus.current;
    if (!target) return;
    const el = target === "revert" ? revertRef.current : target === "publish" ? ctaRef.current : restartRef.current;
    // Publishing and reverting pass through a spinner (and a disabled, hidden CTA) first: wait for the button to come back.
    if (!el || el.disabled) return;
    refocus.current = null;
    el.focus({ preventScroll: true });
  }, [phase, empty]);

  /* --------------------------------------------- the first move, scripted */

  // Once, the first time the tile plays on screen: the standing shot is lifted
  // and carried to the front. A visitor's own press or key stops it where it is.
  const introDone = useRef(false);
  // Read by the script between beats, so each step carries the tile from where it is now.
  const orderNow = useRef(order);
  useLayoutEffect(() => {
    orderNow.current = order;
  });
  useEffect(() => {
    if (introDone.current || touched || !active || phase !== "staged") return;
    let cancelled = false;
    const pending: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => pending.push(setTimeout(resolve, ms)));
    const id = "s:standing";
    (async () => {
      await wait(1100);
      if (cancelled) return;
      introDone.current = true;
      setLifted(id);
      await wait(420);
      while (!cancelled) {
        const current = orderNow.current;
        const i = current.indexOf(id);
        if (i <= 0) break;
        const next = [...current];
        next.splice(i, 1);
        next.splice(i - 1, 0, id);
        setOrder(next);
        await wait(520);
      }
      if (!cancelled) await wait(160);
      setLifted(null);
    })();
    return () => {
      cancelled = true;
      pending.forEach(clearTimeout);
      setLifted(null);
    };
  }, [touched, active, phase]);

  /* ------------------------------------------------------------- input */

  // Tabbing in from outside sends no key to the tile, but focus lands on its controls.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if ((event.target as Element).matches(":focus-visible")) markTouched();
  };

  const onReorder = (next: string[]) => {
    markTouched();
    setOrder(next);
  };

  const listingLabel = `${FINALIZE_LISTING.title} gallery, in publish order`;

  // Once published there is nothing staged, so the product shows no CTA (its shell pill fades out). It keeps
  // its box here, faded out and inert (no focus, pointer or reader), so the header doesn't reflow under the
  // visitor. Not `invisible`: the button's transition-all would carry visibility too, so on the frame Revert
  // brings it back it is still hidden, and the focus handed to it would be dropped.
  const cta = !empty ? (
    <Button
      ref={ctaRef}
      variant="primary"
      onClick={publish}
      disabled={phase !== "staged"}
      inert={live || undefined}
      className={cn(live && "opacity-0 disabled:opacity-0")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {phase === "publishing" ? (
        <Spinner label="Publishing" className="mx-1 border-(--accent-ink)/40 border-t-(--accent-ink)" />
      ) : (
        <IconBox className="hidden @min-[400px]/cc:flex">
          <UploadCloudIcon animate={hovered ? "hover" : "rest"} />
        </IconBox>
      )}
      Publish 1 listing
    </Button>
  ) : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <CcRoot
        ref={root}
        role="group"
        aria-label="Comfy Commerce: the Finalize step, arranging a listing's gallery before it publishes"
        paused={!active && !reducedMotion}
        {...interact}
        onKeyDownCapture={markTouched}
        onFocusCapture={onFocus}
      >
        <p id={instructionsId} className="sr-only">
          The gallery of {FINALIZE_LISTING.title}: two live flat-lays and three new results from the T-Shirt Shoot
          workflow, in the order they will publish. The first image is the featured one. Drag an image to move it, or
          use the arrow keys to move between images, Space to pick one up, the arrow keys to carry it and Space to put
          it down. Press Delete on a new image to reject it. Then press Publish, and Revert to undo the publish.
        </p>
        <p className="sr-only" aria-live="polite">
          {message}
        </p>

        <div className="flex h-full min-h-0 flex-col [@container_cc_(width>=1000px)_and_(height>=440px)]:flex-row">
          {/* The sidebar only where the tile is desktop-sized (the 22/9 tile at 1280px and up). */}
          <Sidebar active="review" reducedMotion={reducedMotion} className="hidden [@container_cc_(width>=1000px)_and_(height>=440px)]:block" />
          <CompactBar
            active="review"
            reducedMotion={reducedMotion}
            className="hidden [@container_cc_(max-width:719.98px)_and_(min-height:400px)]:flex"
          />

          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col p-3 @min-[480px]/cc:px-4 @min-[480px]/cc:pt-4 @min-[720px]/cc:px-6 @min-[720px]/cc:pt-5 [@container_cc_(width>=1000px)_and_(height>=440px)]:px-8 [@container_cc_(width>=1000px)_and_(height>=440px)]:pt-[23px]"
          >
            <FinalizeHeader title={PAGE_TITLES.finalize} subtitle={SUBTITLE} actions={cta} />
            <BackToReview className="hidden [@container_cc_(height>=440px)]:inline-flex" />

            <div className="ccf-area min-h-0 flex-1">
              {empty ? (
                <EmptyState
                  icon={<Sparkles />}
                  title="Nothing staged to finalize"
                  body="Approve results on the review queue and they'll gather here, ready to arrange and publish."
                  action={
                    <Button ref={restartRef} variant="primary" onClick={restart}>
                      Stage them again
                    </Button>
                  }
                  className="h-full bg-(--surface)/60 py-4 [@container_ccf_(height<300px)]:[&>div:first-child]:hidden"
                />
              ) : (
                <div
                  className="ccf-card overflow-hidden rounded-2xl border border-(--line) bg-(--surface) shadow-(--shadow-soft)"
                  style={{ "--ccf-slots": FINALIZE_SLOTS } as CSSProperties}
                >
                  <div className="flex h-(--ccf-bar) items-center gap-2 bg-(--surface-2) px-(--ccf-px)">
                    <p className="min-w-0 truncate text-sm font-medium">{FINALIZE_LISTING.title}</p>
                    <StatusChip state={CHIP[phase]} className="shrink-0" />
                    <CcHint
                      corner={null}
                      hidden={touched || thumbnail || locked}
                      className="ml-auto hidden shrink-0 pl-2 @min-[480px]/cc:inline"
                    >
                      {HINT}
                    </CcHint>
                  </div>

                  <GalleryStrip
                    order={order}
                    tiles={TILES}
                    live={live}
                    locked={locked}
                    lifted={lifted}
                    label={listingLabel}
                    describedBy={instructionsId}
                    onReorder={onReorder}
                    onReject={reject}
                    onAnnounce={setMessage}
                    onDragging={(id) => id && markTouched()}
                  />

                  <AnimatePresence initial={false}>
                    {live && (
                      <PublishedRow
                        key="published"
                        count={publishedCount}
                        reverting={phase === "reverting"}
                        onRevert={revert}
                        revertRef={revertRef}
                        reducedMotion={reducedMotion}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* On a phone the listing bar has no room for the hint, so it sits in the tile's corner below the card. */}
        <CcHint corner="bottom-left" hidden={touched || thumbnail || locked || empty} className="@min-[480px]/cc:hidden">
          {HINT}
        </CcHint>
      </CcRoot>
    </MotionConfig>
  );
}
