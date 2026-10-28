import { cn } from "@/lib/utils";

// The editor's class constants (src/components/stitch/editorStyles.ts), with the app's @theme names written as the
// kit's --nb-* tokens: bg-edit-field → bg-[var(--nb-edit-field)], text-ink-3 → text-[var(--nb-ink-3)], and so on.

export const INK_3 = "text-[var(--nb-ink-3)]";
export const EDIT_FIELD = "bg-[var(--nb-edit-field)]";
export const EDIT_LINE = "border-[var(--nb-edit-line)]";
export const PANE = "bg-[var(--nb-pane)]";

/** Floating chips (delta, snap): the Tooltip skin. */
export const EDITOR_CHIP =
  "rounded-md nb-squircle border border-white/10 bg-neutral-950 shadow-[0_4px_12px_rgba(0,0,0,0.5)] px-2 py-1 text-[10px] font-medium leading-3";

export const HEADER_TITLE = "nb-font-display text-[15px] font-medium leading-[18px] tracking-[-0.02em] text-neutral-100";

export const HEADER_ICON_BUTTON =
  "h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-100 hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 aria-expanded:bg-[var(--nb-edit-pressed)] aria-expanded:text-neutral-100 disabled:text-neutral-600 disabled:hover:bg-transparent";

export const HEADER_PRIMARY =
  "h-8 shrink-0 inline-flex items-center rounded-lg bg-neutral-100 px-4 text-[13px] font-semibold text-neutral-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nb-pane)] disabled:cursor-not-allowed disabled:opacity-40";

export const HEADER_GHOST =
  "h-8 shrink-0 inline-flex items-center rounded-lg px-3 text-[13px] font-medium text-neutral-300 transition-colors hover:bg-white/6 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:text-neutral-600 disabled:hover:bg-transparent";

export const HEADER_OUTLINE =
  "h-8 shrink-0 inline-flex items-center rounded-lg border border-neutral-800 px-3.5 text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

/** The control row's 32px icon buttons: quiet, white on the pressed fill while on. */
export const CONTROL_BUTTON = cn(
  HEADER_ICON_BUTTON,
  "aria-pressed:bg-[var(--nb-edit-pressed)] aria-pressed:text-neutral-100",
);

export const TIMECODE_WELL =
  "h-8 w-full min-w-0 rounded-md border-0 bg-[var(--nb-edit-field)] px-2.5 text-[13px] tabular-nums text-neutral-200 outline-none transition-colors placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50";

export const TEXT_GHOST =
  "h-6 px-1.5 inline-flex items-center gap-1 rounded-md text-xs text-[var(--nb-ink-3)] transition-colors hover:text-neutral-100 hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40 disabled:text-neutral-600 disabled:hover:bg-transparent";

export const RAIL_ACTION =
  "group/action -mx-2 h-9 w-[calc(100%+16px)] shrink-0 flex items-center gap-2.5 px-2 rounded-md text-left text-[13px] text-neutral-300 transition-colors hover:bg-white/4 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

export const SEGMENTS = "flex gap-0.5 rounded-lg bg-[var(--nb-edit-field)] p-0.5";
export const SEGMENT =
  "h-7 min-w-0 flex-1 whitespace-nowrap rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40";
export const SEGMENT_ON = "bg-neutral-800 font-medium text-neutral-100";
export const SEGMENT_OFF = "text-[var(--nb-ink-3)] hover:text-neutral-200";

/** A selected clip's ring: 2px of neutral-100 inside the box's edge. */
export const SELECTED_RING = "pointer-events-none absolute inset-0 z-1 rounded-[inherit] border-2 border-neutral-100";
/** A box Stacked's body drag carries in time and across rows: on top, ringed and raised. */
export const MOVING_CLIP = "z-10 ring-2 ring-neutral-100 shadow-[0_8px_20px_rgba(0,0,0,0.5)] cursor-grabbing";

export const LENGTH_CHIP =
  "pointer-events-none absolute bottom-1 right-3 z-2 rounded-[4px] bg-black/60 px-1 text-[10px] leading-4 tabular-nums text-neutral-100";
export const SPEED_BADGE =
  "pointer-events-none absolute z-2 inline-flex h-[18px] min-w-[18px] items-center justify-center gap-0.5 rounded-[5px] bg-black/60 px-1 text-[10px] font-medium leading-none tabular-nums text-neutral-200";
export const MUTED_BADGE =
  "pointer-events-none absolute z-2 inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-black/60 text-neutral-300";

/** Pixel sizes from the boards (editorStyles.ts GEOMETRY, stackedLayout.ts). */
export const GEOMETRY = {
  ruler: 28,
  playheadHead: 12,
  origin: 20,
  frameCell: 56,
  handle: 10,
  endMargin: 20,
  laneTrailing: 6 + 44 + 20,
  stackRow: 52,
  stackClipTop: 6,
  stackClipHeight: 40,
  clipRow: 80,
  clipTop: 8,
  clipHeight: 64,
  overlayRow: 52,
  overlayBlockTop: 6,
  overlayBlock: 40,
  audioRow: 52,
  audioBlock: 44,
  audioStrip: 28,
} as const;

/** The header's and the media pane's head. */
export const HEADER_PX = 56;
export const MEDIA_PANE_PX = 264;
export const RAIL_PX = 280;
