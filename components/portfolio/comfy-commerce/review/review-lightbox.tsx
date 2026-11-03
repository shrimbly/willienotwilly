"use client";

import { useLayoutEffect, useRef, type CSSProperties, type Ref } from "react";
import { AnimatePresence, motion, type MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

import { ChevronLeft, ChevronRight, IconBox } from "../kit/icons";
import { easeSoft } from "../kit/motion";
import { Segmented } from "../kit/segmented";
import { StagingActions, type StagingPress } from "../kit/staging-actions";
import { StatusChip } from "../kit/status-chip";
import { CAPTION, Wipe } from "../kit/wipe";
import { captionsFor, type QueueItem } from "./data";

// ReviewLightbox from web/src/features/review/CompareMedia.tsx (:186): the
// product title and the Side by side / Wipe switch, the comparison, then
// "1 of N" with the chevrons, the StatusChip and the review buttons. The
// product opens it full-screen over the Review page (bg-ink/80, blurred);
// here it sits in the page's content column as a card (a hairline border on
// the canvas, the lightbox's shadow-lift), so the shell around it stays in view.

export type CompareMode = "side" | "wipe";

const NAV_BUTTON =
  "flex size-8 cursor-pointer items-center justify-center rounded-lg text-(--ink-faint) transition-colors hover:bg-(--surface-2) hover:text-(--ink) disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none";

/** The next item slides in from the side it comes from (the product swaps in place). */
const SLIDE = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 48 }),
  rest: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -48 }),
};

function ratio(width: number, height: number) {
  return { "--cc-ratio": width / height } as CSSProperties;
}

/** Side by side: each image keeps its own ratio, contained in half the stage (stacked when the stage is portrait). */
function SideBySide({ item }: { item: QueueItem }) {
  const labels = captionsFor(item.action).side;
  const sides = [item.pair.source, item.pair.result] as const;
  return (
    <div className="cc-fit-pairs">
      {sides.map((image, i) => (
        <figure key={image.src} className="cc-fit-pair overflow-hidden rounded-xl bg-(--surface-2)" style={ratio(image.width, image.height)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media, sized by its box */}
          <img src={image.src} alt={image.alt} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <figcaption aria-hidden className={cn(CAPTION, "absolute top-3 left-3")}>
            {labels[i]}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ReviewLightbox({
  item,
  index,
  count,
  direction,
  mode,
  onModeChange,
  onPrev,
  onNext,
  pos,
  pressed,
  onApprove,
  onReject,
  onPublish,
  onRevert,
  onWipeInteract,
  reducedMotion,
  actionsRef,
  nextRef,
  className,
}: {
  item: QueueItem;
  index: number;
  count: number;
  /** +1 when the queue moved forward, -1 back: which way the next pair slides. */
  direction: number;
  mode: CompareMode;
  onModeChange: (mode: CompareMode) => void;
  onPrev: () => void;
  onNext: () => void;
  pos: MotionValue<number>;
  pressed: StagingPress;
  onApprove: () => void;
  onReject: () => void;
  onPublish: () => void;
  onRevert: () => void;
  onWipeInteract: () => void;
  reducedMotion: boolean;
  actionsRef: Ref<HTMLDivElement>;
  nextRef: Ref<HTMLButtonElement>;
  className?: string;
}) {
  const { pair } = item;
  const captions = captionsFor(item.action);

  // A chevron that reaches the end of the queue disables itself under the focus (as the product's does). Hand
  // focus to the other chevron, so the keyboard stays in the tile and ← / → still walk the queue.
  const navRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const focused = document.activeElement;
    const nav = navRef.current;
    if (!nav || !(focused instanceof HTMLButtonElement) || !focused.disabled || !nav.contains(focused)) return;
    nav.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [index, count]);

  return (
    <div
      className={cn(
        "@container/lb flex h-full min-h-0 flex-col rounded-2xl border border-(--line) bg-(--surface) p-3 shadow-(--shadow-lift) @min-[520px]/lb:p-4",
        className,
      )}
    >
      {/* On a narrow card the title takes its own line, above the switch. */}
      <div className="mb-3 flex flex-col items-start gap-2 px-1 @min-[400px]/lb:flex-row @min-[400px]/lb:items-center @min-[400px]/lb:justify-between @min-[400px]/lb:gap-4 @min-[520px]/lb:mb-4">
        <p className="w-full min-w-0 truncate text-base font-medium @min-[400px]/lb:w-auto">{pair.productTitle}</p>
        <Segmented<CompareMode>
          aria-label="Compare"
          value={mode}
          onChange={onModeChange}
          reducedMotion={reducedMotion}
          className="shrink-0"
          options={[
            { value: "side", label: "Side by side" },
            { value: "wipe", label: "Wipe" },
          ]}
        />
      </div>

      <div className="relative grid min-h-0 flex-1 [&>*]:[grid-area:1/1]">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={`${item.id}-${mode}`}
            custom={direction}
            variants={SLIDE}
            initial={reducedMotion ? false : "enter"}
            animate="rest"
            exit={reducedMotion ? undefined : "exit"}
            transition={{ duration: 0.35, ease: easeSoft }}
            className="cc-fit h-full w-full"
          >
            {mode === "wipe" ? (
              <div className="cc-fit-box" style={ratio(pair.source.width, pair.source.height)}>
                <Wipe
                  before={pair.source}
                  after={pair.result}
                  labels={captions.wipe}
                  pos={pos}
                  onInteract={onWipeInteract}
                  sliderLabel={`Wipe between before and after for ${pair.productTitle}`}
                />
              </div>
            ) : (
              <SideBySide item={item} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 @min-[520px]/lb:mt-4 @min-[520px]/lb:flex-nowrap">
        <div ref={navRef} className="flex items-center gap-1">
          <button type="button" onClick={onPrev} disabled={index <= 0} aria-label="Previous item" className={NAV_BUTTON}>
            <IconBox>
              <ChevronLeft />
            </IconBox>
          </button>
          <span className="px-1 text-sm whitespace-nowrap text-(--ink-faint) tabular-nums">
            {index + 1} of {count}
          </span>
          <button ref={nextRef} type="button" onClick={onNext} disabled={index >= count - 1} aria-label="Next item" className={NAV_BUTTON}>
            <IconBox>
              <ChevronRight />
            </IconBox>
          </button>
        </div>
        <StatusChip state={item.state} className="@min-[520px]/lb:hidden" />
        <div
          ref={actionsRef}
          tabIndex={-1}
          className="flex w-full shrink-0 items-center justify-end gap-2 outline-none @min-[520px]/lb:w-auto"
        >
          <StatusChip state={item.state} className="hidden @min-[520px]/lb:inline-flex" />
          <StagingActions
            state={item.state}
            action={item.action}
            pressed={pressed}
            onApprove={onApprove}
            onReject={onReject}
            onPublish={onPublish}
            onRevert={onRevert}
          />
        </div>
      </div>
    </div>
  );
}
