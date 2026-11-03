"use client";

import type { Ref } from "react";
import { motion } from "motion/react";

import { Button } from "../kit/button";
import { Check, IconBox, X } from "../kit/icons";
import { SELECTION_BAR_TRANSITION } from "../kit/motion";
import { PlayIcon, useHover } from "./play-icon";

// Ported from web/src/features/browse/SelectionBar.tsx: the floating pill
// that rises once media is selected. The product portals it to the window's
// foot (fixed, bottom-6, centred on the whole window, over a page that
// scrolls). A tile cannot scroll, so the pill rises into a strip the listing
// card keeps clear under its grid (see BrowseView), out from behind the
// pagination bar. On a narrow tile (under 640px) Select all and Clear drop to
// their icons, as round 28px buttons (their accessible names are the
// product's), and on the narrowest cards the pill's gaps and padding tighten
// a step, so it fits a phone-width listing card with its ends whole.

/** A pill button that shows only its icon under 640px: square, so it rounds to a circle. */
const ICON_ONLY_NARROW = "rounded-[40px] @max-[639px]/cc:w-7 @max-[639px]/cc:px-0";

export function SelectionBar({
  count,
  allSelected,
  onSelectAll,
  onClear,
  onRun,
  runPressed,
  runRef,
  reducedMotion,
}: {
  count: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onRun: () => void;
  runPressed: boolean;
  runRef: Ref<HTMLButtonElement>;
  reducedMotion: boolean;
}) {
  const run = useHover(reducedMotion);
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 64 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 64 }}
      transition={SELECTION_BAR_TRANSITION}
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div
        role="group"
        aria-label="Selection"
        className="pointer-events-auto flex items-center gap-1.5 rounded-[40px] border border-(--line) bg-(--surface)/95 p-2 pl-3 shadow-(--shadow-lift) backdrop-blur-md @min-[640px]/cc:gap-3 @min-[640px]/cc:pl-4 @max-[340px]/listing:gap-1 @max-[340px]/listing:p-1.5 @max-[340px]/listing:pl-2.5"
      >
        <span className="text-sm whitespace-nowrap text-(--ink-soft)">
          <span className="font-medium text-(--ink) tabular-nums">{count}</span> selected
        </span>
        <span aria-hidden className="h-5 w-px bg-(--line)" />
        <Button variant="ghost" size="sm" onClick={onSelectAll} disabled={allSelected} aria-label="Select all visible" className={ICON_ONLY_NARROW}>
          <IconBox>
            <Check />
          </IconBox>
          <span className="hidden @min-[640px]/cc:inline">Select all</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection" className={ICON_ONLY_NARROW}>
          <IconBox>
            <X />
          </IconBox>
          <span className="hidden @min-[640px]/cc:inline">Clear</span>
        </Button>
        <Button
          ref={runRef}
          variant="primary"
          size="sm"
          pressed={runPressed}
          onClick={onRun}
          className="rounded-[40px]"
          {...run.props}
        >
          <IconBox>
            <PlayIcon hover={run.hover || runPressed} />
          </IconBox>
          Run workflow
        </Button>
      </div>
    </motion.div>
  );
}
