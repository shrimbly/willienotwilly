import {
  CARD_EDGE,
  CONTROLS_GAP,
  CONTROLS_INSET,
  CONTROLS_MAX_W,
  GAP_ROW_H,
  HEADER_OFFSET,
  NOODLE_CURVATURE,
  SUMMARY_ROW_H,
  SOCKET_PITCH,
  SOCKET_REACH,
  SOCKET_TOP,
  type SocketType,
} from "./tokens";

export interface SocketSpec {
  /** Handle id; edges reference it. */
  id: string;
  type: SocketType;
  /** Shown beside the socket when the node is selected ("Image", "Prompt"). */
  label?: string;
  /** Filled hole: something is plugged in. */
  connected?: boolean;
  /** Dimmed to 30%: an optional slot with nothing to connect yet. */
  placeholder?: boolean;
  /** Exists for edges to resolve but is not drawn; takes no row of its own. */
  hidden?: boolean;
  /** Explicit row (0-based); defaults to the socket's order among visible ones. */
  row?: number;
  title?: string;
}

export type SocketSide = "in" | "out";

export interface Point {
  x: number;
  y: number;
}

/** Row index for each socket: visible ones count up, hidden ones borrow the previous row. */
export function assignSocketRows(sockets: ReadonlyArray<SocketSpec>): number[] {
  let next = 0;
  return sockets.map((spec) => {
    if (spec.row !== undefined) {
      if (!spec.hidden) next = Math.max(next, spec.row + 1);
      return spec.row;
    }
    if (spec.hidden) return Math.max(next - 1, 0);
    return next++;
  });
}

/** How many rows a column occupies. */
export function socketRowCount(sockets: ReadonlyArray<SocketSpec>): number {
  const rows = assignSocketRows(sockets);
  let max = -1;
  sockets.forEach((spec, i) => {
    if (!spec.hidden) max = Math.max(max, rows[i]);
  });
  return max + 1;
}

/** Minimum media-card height that fits `count` sockets on one side. */
export function socketMinHeight(count: number): number {
  if (count <= 0) return 0;
  return SOCKET_TOP + SOCKET_PITCH * (count - 1) + SOCKET_TOP;
}

/** Centre-line of socket `row`, from the media card's padding edge (1px inside the border). */
export function socketCenter(row: number): number {
  return SOCKET_TOP + SOCKET_PITCH * row;
}

/**
 * Where a noodle meets a socket, in the same space as the node's position
 * (the media card's outer top-left). Noodles end on the socket box's outer
 * edge, 14px outside the card, as React Flow ends them on the Handle box.
 */
export function socketPoint(node: { x: number; y: number; width: number }, side: SocketSide, row: number): Point {
  return {
    x: side === "in" ? node.x - SOCKET_REACH : node.x + node.width + SOCKET_REACH,
    y: node.y + 1 + socketCenter(row),
  };
}

/** The row of handle `id` in a column, or -1. */
export function socketRowOf(sockets: ReadonlyArray<SocketSpec>, id: string): number {
  const index = sockets.findIndex((s) => s.id === id);
  if (index < 0) return -1;
  return assignSocketRows(sockets)[index];
}

/** The controls card's automatic width: node width − 24, capped at 360. */
export function autoControlsWidth(nodeWidth: number): number {
  return Math.min(CONTROLS_MAX_W, Math.max(0, nodeWidth - CONTROLS_INSET));
}

export interface NodeLayoutInput {
  width: number;
  /** Media aspect (w/h) or a fixed media height, as NodeCard's `media`. */
  media: { aspect: number } | { height: number };
  /** Socket rows on the busier side (sets the card's minimum height). */
  rows?: number;
  /** A gap row is shown (carousel or scrub row): 28px, else an 8px spacer. */
  gap?: boolean;
  /** Collapsed controls card present (28px summary row + 1px borders). */
  controls?: boolean;
}

export interface NodeLayout {
  /** All offsets in px from the media card's outer top-left (the node position). */
  header: Bounds;
  card: Bounds;
  clip: Bounds;
  gapRow: Bounds;
  /** The collapsed controls card; it grows downward when expanded. */
  controls: Bounds | null;
  /** The summary row's centre line, for pointing at the values. */
  summaryY: number;
  /** Bottom of the collapsed node. */
  height: number;
}

/**
 * Where every part of a node sits, computed rather than measured, so overlays
 * (annotations, callouts) can be laid out on the server and never wait for the
 * DOM. Matches NodeCard: 1px border + 4px padding around the clip, the header
 * floating 26px above, the gap row, and the controls card inset 12px a side.
 */
export function nodeLayout({ width, media, rows = 1, gap = false, controls = true }: NodeLayoutInput): NodeLayout {
  const inner = width - 2 * CARD_EDGE;
  const clipH = "aspect" in media ? inner / (media.aspect > 0 ? media.aspect : 1) : media.height;
  const cardH = Math.max(clipH + 2 * CARD_EDGE, socketMinHeight(rows));
  const gapH = gap ? GAP_ROW_H : CONTROLS_GAP;
  const cw = autoControlsWidth(width);
  const controlsBox = controls ? { x: (width - cw) / 2, y: cardH + gapH, width: cw, height: SUMMARY_ROW_H + 2 } : null;
  return {
    header: { x: 0, y: -HEADER_OFFSET, width, height: HEADER_OFFSET },
    card: { x: 0, y: 0, width, height: cardH },
    clip: { x: CARD_EDGE, y: CARD_EDGE, width: inner, height: clipH },
    gapRow: { x: 0, y: cardH, width, height: gapH },
    controls: controlsBox,
    summaryY: controlsBox ? controlsBox.y + controlsBox.height / 2 : cardH,
    height: controlsBox ? controlsBox.y + controlsBox.height : cardH + (gap ? gapH : 0),
  };
}

function controlOffset(distance: number, curvature: number): number {
  return distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance);
}

export interface NoodleRoute {
  d: string;
  /** Bezier midpoint (t = 0.5), where React Flow puts a label. */
  label: Point;
  c1: Point;
  c2: Point;
}

/**
 * The curved noodle: React Flow's getBezierPath (curvature 0.25), source on
 * the right, target on the left. A perfectly level noodle has a zero-height
 * box, and an objectBoundingBox gradient paints nothing on it, so the target
 * is nudged half a pixel (as the site generator does).
 */
export function noodleRoute(source: Point, target: Point, curvature = NOODLE_CURVATURE): NoodleRoute {
  const sx = source.x;
  const sy = source.y;
  const tx = target.x;
  const ty = Math.abs(target.y - source.y) < 0.5 ? source.y + 0.5 : target.y;
  const c1 = { x: sx + controlOffset(tx - sx, curvature), y: sy };
  const c2 = { x: tx - controlOffset(tx - sx, curvature), y: ty };
  const label = {
    x: 0.125 * sx + 0.375 * c1.x + 0.375 * c2.x + 0.125 * tx,
    y: 0.125 * sy + 0.375 * c1.y + 0.375 * c2.y + 0.125 * ty,
  };
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    d: `M${r(sx)},${r(sy)} C${r(c1.x)},${r(c1.y)} ${r(c2.x)},${r(c2.y)} ${r(tx)},${r(ty)}`,
    label,
    c1,
    c2,
  };
}

export function noodlePath(source: Point, target: Point, curvature = NOODLE_CURVATURE): string {
  return noodleRoute(source, target, curvature).d;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * World bounds of a set of nodes, headers included. Node heights are not
 * known without measuring, so callers pass them (or an estimate).
 */
export function graphBounds(
  nodes: ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
  { header = 26, sockets = SOCKET_REACH } = {},
): Bounds {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const n of nodes) {
    left = Math.min(left, n.x - sockets);
    top = Math.min(top, n.y - header);
    right = Math.max(right, n.x + n.width + sockets);
    bottom = Math.max(bottom, n.y + n.height);
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: left, y: top, width: right - left, height: bottom - top };
}
