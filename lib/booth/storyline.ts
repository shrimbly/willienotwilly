// The website's demo storyline, ported from studiovoice/app/Sources/Booth/Debug/DemoRenderer.swift
// (`Beat` and the scene's curves): a file is carried up to Booth's menu bar icon, held there
// until the popover springs open, carried down into the drop zone and let go; Booth works on
// it, shows it done, and the popover closes. Seconds from the start of the 11.9 s loop.

export const BEATS = {
  /** The file is picked up, reaches the icon, leaves it for the popover and is in the drop zone. */
  dragStart: 0.5,
  atIcon: 1.9,
  leaveIcon: 2.4,
  inZone: 2.9,
  /** The icon grows under the file; the popover springs open; the drop zone lights up. */
  hover: 1.75,
  open: 2.15,
  zoneHover: 2.7,
  drop: 3.05,
  working: 3.2,
  done: 7,
  close: 10,
  closed: 10.3,
  /** DemoRenderer's camera zooms back out here; the pointer heads back to the file over it. */
  zoomOut: 10.45,
  loop: 11.9,
} as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** How far `t` is through the span from `start` lasting `length`, 0…1. */
export function progressBetween(t: number, start: number, length: number): number {
  return clamp01((t - start) / length);
}

/** DemoRenderer's cubic ease-out. */
export function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/** DemoRenderer's cubic ease-in-out. */
export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * The job runs a couple of minutes for real; here it takes under four seconds, eased in and
 * out from just before Working shows to just before Done (DemoRenderer `workProgress`).
 */
export function storyWorkProgress(t: number): number {
  return easeInOutCubic(progressBetween(t, BEATS.working - 0.15, BEATS.done - BEATS.working - 0.1));
}

/** How long the bar takes from 0 to 100% after a drop: the same span as `storyWorkProgress`. */
export const STORY_WORK_SECONDS = BEATS.done - BEATS.working - 0.1;

export interface Point {
  x: number;
  y: number;
}

/**
 * Where the dragged copy is at `t` (the middle of its top edge): up from the desktop to the
 * icon in an arc, held there while the popover springs open, then down into the drop zone.
 * `arc` is how far the path bows up (60 pt on DemoRenderer's 1440 × 900 screen).
 */
export function storyDragPoint(t: number, from: Point, icon: Point, drop: Point, arc = 60): Point {
  if (t < BEATS.leaveIcon) {
    const move = easeInOutCubic(progressBetween(t, BEATS.dragStart, BEATS.atIcon - BEATS.dragStart));
    return {
      x: from.x + (icon.x - from.x) * move,
      y: from.y + (icon.y - from.y) * move - Math.sin(move * Math.PI) * arc,
    };
  }
  const move = easeInOutCubic(progressBetween(t, BEATS.leaveIcon, BEATS.inZone - BEATS.leaveIcon));
  return { x: icon.x + (drop.x - icon.x) * move, y: icon.y + (drop.y - icon.y) * move };
}

/** The copy fades as it's let go (DemoRenderer `dragging`): 0 before it's picked up. */
export function storyGhostOpacity(t: number): number {
  if (t < BEATS.dragStart) return 0;
  return 1 - progressBetween(t, BEATS.drop, 0.15);
}
