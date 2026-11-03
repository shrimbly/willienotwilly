// Comfy Commerce's motion vocabulary, ported from web/src/lib/motion.ts (one
// soft ease, consistent durations), plus the per-component values the product
// sets inline, collected here so every tile moves the same way.

/** The product's one ease: a soft ease-out. Also --ease-out-soft in the scoped CSS. */
export const easeSoft = [0.22, 1, 0.36, 1] as const;

export const fadeRise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: easeSoft },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4, ease: easeSoft },
};

/** Stagger container for lists and grids. */
export const staggerParent = {
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

export const staggerChild = {
  initial: { opacity: 0, y: 10, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: easeSoft } },
};

/** Segmented's sliding indicator (components/ui/Segmented.tsx). */
export const SEGMENTED_TRANSITION = { duration: 0.35, ease: easeSoft };
/** The sidebar's active pill, layoutId "nav-active" (components/shell/Sidebar.tsx). */
export const NAV_PILL_TRANSITION = { duration: 0.4, ease: easeSoft };
/** The Review badge popping in (Sidebar.tsx): scale 0.6 -> 1. */
export const BADGE_TRANSITION = { duration: 0.3, ease: easeSoft };
/** Review rows and workflow cards entering (ReviewCard.tsx, WorkflowCard.tsx). */
export const ROW_TRANSITION = { duration: 0.35, ease: easeSoft };
/** The review lightbox card: scale 0.97, y 8 -> rest over 0.3s; its backdrop fades over 0.25s. */
export const LIGHTBOX_TRANSITION = { duration: 0.3, ease: easeSoft };
/** HoverWipe's boundary spring (features/workflows/HoverWipe.tsx). */
export const HOVER_WIPE_SPRING = { stiffness: 300, damping: 32 };
/** RunSheet: the sheet slides in from x 80; its steps move ±32px. */
export const SHEET_TRANSITION = { duration: 0.35, ease: easeSoft };
export const SHEET_STEP_TRANSITION = { duration: 0.25, ease: easeSoft };
/** SelectionBar rising from y 64. */
export const SELECTION_BAR_TRANSITION = { duration: 0.4, ease: easeSoft };
