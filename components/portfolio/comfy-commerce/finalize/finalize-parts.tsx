"use client";

import type { ReactNode, Ref } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import { Button } from "../kit/button";
import { ArrowLeft, IconBox, Undo2 } from "../kit/icons";
import { easeSoft } from "../kit/motion";
import { Spinner } from "../kit/spinner";

// The Finalize page's chrome around the strip, from web/src/features/review/FinalizePage.tsx
// and components/ui/PageHeader.tsx.

/**
 * PageHeader for /review/finalize: "Finalize & publish" and the page's line,
 * on the bare canvas, with the CTA at the top right where the product's shell
 * pill sits. The kit's PageHeader always shows its subtitle; a 22/9 tile at
 * 768px is too short for it, so this one drops it there and tightens the
 * gap below. Not a heading element, as in the kit (the portfolio page owns
 * the outline).
 */
export function FinalizeHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-2.5 flex shrink-0 items-start justify-between gap-4 @min-[480px]/cc:mb-3 [@container_cc_(height>=340px)]:mb-4 [@container_cc_(height>=440px)]:mb-5">
      <div className="min-w-0">
        <p className="text-lg leading-8 font-semibold @min-[480px]/cc:text-xl @min-[480px]/cc:leading-7">{title}</p>
        {/* Shown where the tile has room: the 22/9 tile at 1024px and up, and the tablet frame. */}
        <p className="mt-0.5 hidden max-w-xl text-sm text-(--ink-soft) [@container_cc_(height>=340px)]:block">{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}

/**
 * The page's "Back to review" link. Drawn but inert, like the kit's static
 * sidebar routes: the tile has no review page to go back to.
 */
export function BackToReview({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("mb-4 inline-flex shrink-0 items-center gap-1.5 self-start text-sm font-medium text-(--ink-soft)", className)}>
      <IconBox>
        <ArrowLeft />
      </IconBox>
      Back to review
    </span>
  );
}

/**
 * What the strip says once its listing is live. The product leaves Finalize
 * for Review's Published tab, where each result carries its own Remove (an
 * add) or Revert (a replacement). Here the strip stays put and says so in the
 * product's one-line confirm row (FinalizePage's "Applied to N listings."
 * with its ghost Undo), with one Revert for the whole publish.
 */
export function PublishedRow({
  count,
  reverting,
  onRevert,
  revertRef,
  reducedMotion,
}: {
  count: number;
  reverting: boolean;
  onRevert: () => void;
  revertRef: Ref<HTMLButtonElement>;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={reducedMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: easeSoft }}
      className="overflow-hidden"
    >
      <div className="mx-(--ccf-px) mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-(--accent-soft) py-2.5 pr-2 pl-4">
        {/* In the product's own shorthand for a saved snapshot (ReviewCard's "… · prior saved"); a phone gets two lines. */}
        <p className="min-w-0 flex-1 text-sm">
          Published {count} new image{count === 1 ? "" : "s"}
          <span className="hidden text-(--ink-soft) @min-[480px]/cc:inline"> · prior gallery saved</span>
          <span className="block text-(--ink-soft) @min-[480px]/cc:hidden">Prior gallery saved</span>
        </p>
        <span className="ml-auto flex h-7 items-center">
          {reverting ? (
            <Spinner label="Reverting" className="mx-3" />
          ) : (
            <Button ref={revertRef} size="sm" variant="ghost" onClick={onRevert}>
              <IconBox>
                <Undo2 />
              </IconBox>
              Revert
            </Button>
          )}
        </span>
      </div>
    </motion.div>
  );
}
