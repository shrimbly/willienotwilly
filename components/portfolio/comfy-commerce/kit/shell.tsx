"use client";

import { useId, type ComponentType, type ReactNode } from "react";
import { motion } from "motion/react";

import { STORE } from "@/lib/comfy-commerce/media";
import { cn } from "@/lib/utils";

import { BlurDivider } from "./blur-divider";
import { BrandMark } from "./brand-mark";
import { Activity, ChevronDown, IconBox, Images, Link2, Moon, NotebookPen, ShieldCheck, Workflow, type IconProps } from "./icons";
import { BADGE_TRANSITION, NAV_PILL_TRANSITION } from "./motion";
import { StoreAvatar } from "./store-avatar";

// The app shell, ported from web/src/components/shell/Sidebar.tsx and
// AppShell.tsx, and the page title from components/ui/PageHeader.tsx. Routing,
// the store switcher's menu and the theme toggle have nowhere to go in a
// tile, so the nav is static unless a demo passes onNavigate, and the store
// pill and theme button are drawn but inert.

export type NavKey = "connectors" | "workflows" | "browse" | "prompts" | "activity" | "review";

/** The sidebar's routes, in the product's order, with its labels and icons. */
export const NAV: { key: NavKey; label: string; icon: ComponentType<IconProps> }[] = [
  { key: "connectors", label: "Connections", icon: Link2 },
  { key: "workflows", label: "Workflows", icon: Workflow },
  { key: "browse", label: "Browse products", icon: Images },
  { key: "prompts", label: "Prompts", icon: NotebookPen },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "review", label: "Review & publish", icon: ShieldCheck },
];

/** The page titles the product's PageHeader derives from the route ("Reframed page titles"). */
export const PAGE_TITLES: Record<NavKey | "finalize", string> = {
  connectors: "Connect a store",
  workflows: "Manage workflows",
  prompts: "Manage prompts",
  browse: "Browse products",
  activity: "Track activity",
  review: "Review & publish",
  finalize: "Finalize & publish",
};

/** The connected store the demos show (lib/comfy-commerce/media.ts STORE). */
export const STORE_NAME = STORE.shopName;

/** The Review row's count: the info-blue badge, popping in when the count comes back from zero. */
export function ReviewBadge({ count, reducedMotion = false }: { count: number; reducedMotion?: boolean }) {
  if (count <= 0) return null;
  return (
    <motion.span
      initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={BADGE_TRANSITION}
      className="relative ml-auto flex h-5 min-w-5 items-center justify-center rounded-lg bg-(--info) px-1 text-sm font-medium text-(--surface) tabular-nums"
    >
      {count}
    </motion.span>
  );
}

function NavItem({
  item,
  active,
  pendingCount,
  pillId,
  onNavigate,
  reducedMotion,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  pendingCount: number;
  pillId: string;
  onNavigate?: (key: NavKey) => void;
  reducedMotion: boolean;
}) {
  const Icon = item.icon;
  const body = (
    <>
      {active && (
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
  const className = cn(
    "relative flex h-9 w-full items-center gap-2 rounded-xl px-2 text-sm font-medium",
    "transition-colors duration-200 motion-reduce:transition-none",
    active ? "text-(--ink)" : "text-(--ink-soft)",
    !active && onNavigate && "cursor-pointer hover:bg-(--surface-2) hover:text-(--ink)",
  );
  return (
    <li>
      {onNavigate ? (
        <button
          type="button"
          aria-current={active ? "page" : undefined}
          onClick={() => onNavigate(item.key)}
          className={cn(className, "text-left")}
        >
          {body}
        </button>
      ) : (
        <span aria-current={active ? "page" : undefined} className={className}>
          {body}
        </span>
      )}
    </li>
  );
}

/**
 * The sidebar card: BrandMark and "Comfy Commerce / Product media studio", the
 * six routes with the sliding active pill and the Review badge, then the
 * store pill, the theme button and "Private, local, review-gated." at its
 * foot. w-64 with p-3 pr-0, as the product draws it: 12px in from the window's
 * corner, so its 1.8rem squircle sits concentric with a 40px tile corner.
 */
export function Sidebar({
  active,
  pendingCount = 0,
  onNavigate,
  storeName = STORE_NAME,
  reducedMotion = false,
  className,
}: {
  active: NavKey;
  /** The Review badge (pending results); hidden at zero, as in the product. */
  pendingCount?: number;
  /** Make the routes buttons (moving the active pill); omitted, they are static. */
  onNavigate?: (key: NavKey) => void;
  storeName?: string;
  reducedMotion?: boolean;
  className?: string;
}) {
  // The product's layoutId is the global "nav-active"; scoped here so two tiles never share a pill.
  const pillId = `cc-nav-active-${useId()}`;
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
            {NAV.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                active={item.key === active}
                pendingCount={pendingCount}
                pillId={pillId}
                onNavigate={onNavigate}
                reducedMotion={reducedMotion}
              />
            ))}
          </ul>
        </nav>

        <div className="mt-auto px-2 pb-3">
          <div className="flex items-center gap-1">
            {/* The store switcher (it opens upward in the product). */}
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--line) bg-(--surface) px-2 text-sm">
              <StoreAvatar className="size-5" />
              <span className="truncate text-(--ink-soft)">{storeName}</span>
              <IconBox className="ml-auto text-(--ink-faint)">
                <ChevronDown />
              </IconBox>
            </div>
            {/* The light/dark toggle; the portfolio keeps the product's light theme. */}
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-(--line) bg-(--surface) text-(--ink-soft)"
            >
              <IconBox>
                <Moon />
              </IconBox>
            </span>
          </div>
          {/* Left out on tiles under 470px tall, where the card would otherwise clip it. */}
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

/**
 * The page's title and one-line description on the bare canvas, above the
 * page's own card. `actions` sits top right, where the product's shell keeps
 * its single CTA pill. Not a heading element: inside a portfolio page it
 * would join the page's outline.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="text-xl leading-7 font-semibold">{title}</p>
        {subtitle && <p className="mt-0.5 max-w-xl text-sm text-(--ink-soft)">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/**
 * The shell for a narrow tile. The product is a desktop window with a fixed
 * w-64 sidebar and no narrow layout of its own, so this port heads narrow
 * tiles with a one-line bar on the surface colour (12px 16px, a line under
 * it): the studio's mark, and the current route with its badge on the right.
 */
export function CompactBar({
  active,
  pendingCount = 0,
  reducedMotion = false,
  className,
}: {
  active: NavKey;
  pendingCount?: number;
  reducedMotion?: boolean;
  className?: string;
}) {
  const item = NAV.find((n) => n.key === active) ?? NAV[0];
  const Icon = item.icon;
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
      <span
        aria-current="page"
        className="relative flex h-9 shrink-0 items-center gap-2 rounded-xl border border-(--line) bg-(--surface-2) px-2 text-sm font-medium"
      >
        <IconBox>
          <Icon />
        </IconBox>
        <span className="sr-only @min-[400px]/cc:not-sr-only">{item.label}</span>
        {active === "review" && <ReviewBadge count={pendingCount} reducedMotion={reducedMotion} />}
      </span>
    </div>
  );
}
