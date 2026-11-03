"use client";

import { useId } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import { BlurDivider } from "../kit/blur-divider";
import { BrandMark } from "../kit/brand-mark";
import { ChevronDown, IconBox, Moon, ShieldCheck } from "../kit/icons";
import { NAV_PILL_TRANSITION } from "../kit/motion";
import { NAV, ReviewBadge, STORE_NAME, type NavKey } from "../kit/shell";
import { StoreAvatar } from "../kit/store-avatar";

// The kit's Sidebar and CompactBar (components/shell/Sidebar.tsx), with the
// routes this tile has made live. The kit's Sidebar makes every route a
// button or none; this tile has two pages of its own (Browse products and
// Activity) and one on the same portfolio page (Review & publish, the hero),
// so only those three are buttons and the rest stay drawn but inert.

export type RunNav = Partial<Record<NavKey, () => void>>;

const ITEM =
  "relative flex h-9 w-full items-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none";

/** The sidebar card, as the kit draws it, with `routes` naming the live entries. */
export function RunSidebar({
  active,
  pendingCount,
  routes,
  reducedMotion,
  className,
}: {
  active: NavKey;
  pendingCount: number;
  routes: RunNav;
  reducedMotion: boolean;
  className?: string;
}) {
  const pillId = `cc-run-nav-${useId()}`;
  return (
    <aside className={cn("h-full w-64 shrink-0 p-3 pr-0", className)}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-(--line) bg-(--surface) shadow-(--shadow-soft)">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <BrandMark className="size-9" />
            <div className="min-w-0">
              <span className="block text-sm leading-5 font-medium">Comfy Commerce</span>
              <span className="block text-sm leading-5 text-(--ink-faint)">Product media studio</span>
            </div>
          </div>
        </div>

        <BlurDivider className="mx-4 mb-2" />

        <nav aria-label="Comfy Commerce">
          <ul className="flex flex-col gap-1 px-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              const go = routes[item.key];
              const body = (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={pillId}
                      className="absolute inset-0 rounded-xl border border-(--line) bg-(--surface-2)"
                      transition={reducedMotion ? { duration: 0 } : NAV_PILL_TRANSITION}
                    />
                  )}
                  <IconBox className="relative">
                    <Icon />
                  </IconBox>
                  <span className="relative truncate">{item.label}</span>
                  {item.key === "review" && <ReviewBadge count={pendingCount} reducedMotion={reducedMotion} />}
                </>
              );
              const tone = isActive ? "text-(--ink)" : "text-(--ink-soft)";
              return (
                <li key={item.key}>
                  {go ? (
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      onClick={go}
                      className={cn(ITEM, tone, "text-left", !isActive && "cursor-pointer hover:bg-(--surface-2) hover:text-(--ink)")}
                    >
                      {body}
                    </button>
                  ) : (
                    <span aria-current={isActive ? "page" : undefined} className={cn(ITEM, tone)}>
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto px-2 pb-3">
          <div className="flex items-center gap-1">
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--line) bg-(--surface) px-2 text-sm">
              <StoreAvatar className="size-5" />
              <span className="truncate text-(--ink-soft)">{STORE_NAME}</span>
              <IconBox className="ml-auto text-(--ink-faint)">
                <ChevronDown />
              </IconBox>
            </div>
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-(--line) bg-(--surface) text-(--ink-soft)"
            >
              <IconBox>
                <Moon />
              </IconBox>
            </span>
          </div>
          <div className="[@container_cc_(height<470px)]:hidden">
            <BlurDivider className="mx-2 my-3" />
            <p className="flex items-center gap-2 px-2 text-sm text-(--ink-faint)">
              <IconBox className="text-(--success)">
                <ShieldCheck />
              </IconBox>
              Private, local, review-gated.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The routes the narrow bar offers, in the sidebar's order. */
const COMPACT_ROUTES: NavKey[] = ["browse", "activity", "review"];

/**
 * The kit's CompactBar (a one-line header, standing in
 * for a sidebar the product never narrows) with this tile's live routes as
 * icon buttons on the right, the current one in the nav pill and named once
 * the bar has room.
 */
export function RunCompactBar({
  active,
  pendingCount,
  routes,
  reducedMotion,
  className,
}: {
  active: NavKey;
  pendingCount: number;
  routes: RunNav;
  reducedMotion: boolean;
  className?: string;
}) {
  const pillId = `cc-run-compact-${useId()}`;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-b border-(--line) bg-(--surface) px-4 py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <BrandMark className="size-7" />
        <span className="truncate text-base font-medium">Comfy Commerce</span>
      </div>
      <nav aria-label="Comfy Commerce">
        <ul className="flex items-center gap-1">
          {COMPACT_ROUTES.map((key) => {
            const item = NAV.find((n) => n.key === key)!;
            const Icon = item.icon;
            const isActive = key === active;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  onClick={routes[key]}
                  className={cn(
                    ITEM,
                    "w-auto",
                    isActive ? "text-(--ink)" : "cursor-pointer text-(--ink-soft) hover:bg-(--surface-2) hover:text-(--ink)",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId={pillId}
                      className="absolute inset-0 rounded-xl border border-(--line) bg-(--surface-2)"
                      transition={reducedMotion ? { duration: 0 } : NAV_PILL_TRANSITION}
                    />
                  )}
                  <IconBox className="relative">
                    <Icon />
                  </IconBox>
                  {isActive && (
                    <span aria-hidden className="relative hidden @min-[440px]/cc:inline">
                      {item.label}
                    </span>
                  )}
                  {key === "review" && <ReviewBadge count={pendingCount} reducedMotion={reducedMotion} />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
