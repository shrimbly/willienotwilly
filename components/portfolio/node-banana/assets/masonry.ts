// Layout for the Assets grid, ported from the app's masonryLayout.ts: day
// sections, each a shortest-column masonry. Pure arithmetic over the
// recorded sizes, never the DOM, so the server and the client agree.

import type { AssetKind } from "@/lib/node-banana/assets";

export interface MasonryItem {
  id: string;
  day: string;
  kind: AssetKind;
  width?: number;
  height?: number;
}

/** Extremes are clamped so one panorama or one strip cannot dominate a column. */
const MIN_ASPECT = 1 / 3;
const MAX_ASPECT = 3;

/** Height ÷ width a tile is drawn at: the picture's own when known, else video 16:9, audio a 2:1 strip. */
export function tileAspect(item: Pick<MasonryItem, "kind" | "width" | "height">): number {
  if (item.kind === "audio") return 0.5;
  if (item.width && item.height) return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, item.height / item.width));
  if (item.kind === "video") return 9 / 16;
  return 1;
}

export interface PlacedTile {
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
}

export interface MasonryResult {
  tiles: PlacedTile[];
  /** Per column, the indices of its tiles top to bottom. */
  columns: number[][];
  height: number;
}

/** Shortest-column masonry: each item goes to the column that ends highest, the leftmost on a tie. */
export function masonry(items: readonly Pick<MasonryItem, "kind" | "width" | "height">[], columnCount: number, columnWidth: number, gap: number): MasonryResult {
  const count = Math.max(1, Math.floor(columnCount));
  const bottoms = new Array<number>(count).fill(0);
  const columns = Array.from({ length: count }, () => [] as number[]);
  const tiles: PlacedTile[] = [];
  items.forEach((item, index) => {
    let column = 0;
    for (let c = 1; c < count; c++) if (bottoms[c] < bottoms[column]) column = c;
    const y = bottoms[column];
    const height = Math.max(1, Math.round(columnWidth * tileAspect(item)));
    tiles.push({ x: column * (columnWidth + gap), y, width: columnWidth, height, column });
    columns[column].push(index);
    bottoms[column] = y + height + gap;
  });
  return { tiles, columns, height: tiles.length ? Math.max(...bottoms) - gap : 0 };
}

/** As many columns as fit near the target width, stretched to fill the row. */
export function fitColumns(containerWidth: number, targetWidth: number, gap: number) {
  const width = Math.max(0, containerWidth);
  const columnCount = Math.max(1, Math.round((width + gap) / (targetWidth + gap)));
  const columnWidth = Math.max(1, (width - gap * (columnCount - 1)) / columnCount);
  return { columnCount, columnWidth };
}

export interface GridLayoutOptions {
  columnCount: number;
  columnWidth: number;
  gap: number;
  headerHeight: number;
  sectionGap: number;
}

export interface GridSection {
  day: string;
  start: number;
  top: number;
  masonry: MasonryResult;
}

export interface GridLayout {
  sections: GridSection[];
  itemCount: number;
  headerHeight: number;
  height: number;
}

/** Splits `items` (in sort order) into runs of one day, each its own masonry block under a header. */
export function layoutGrid(items: readonly MasonryItem[], options: GridLayoutOptions): GridLayout {
  const sections: GridSection[] = [];
  let top = 0;
  let index = 0;
  while (index < items.length) {
    const day = items[index].day;
    let end = index + 1;
    while (end < items.length && items[end].day === day) end++;
    const block = masonry(items.slice(index, end), options.columnCount, options.columnWidth, options.gap);
    sections.push({ day, start: index, top, masonry: block });
    top += options.headerHeight + block.height + options.sectionGap;
    index = end;
  }
  return {
    sections,
    itemCount: items.length,
    headerHeight: options.headerHeight,
    height: sections.length ? top - options.sectionGap : 0,
  };
}

/** The section and local index of a global item index. */
export function locate(layout: GridLayout, index: number): { section: number; local: number } | null {
  for (let s = 0; s < layout.sections.length; s++) {
    const section = layout.sections[s];
    if (index >= section.start && index < section.start + section.masonry.tiles.length) return { section: s, local: index - section.start };
  }
  return null;
}

/** Top and bottom of an item's tile in grid coordinates. */
export function tileBounds(layout: GridLayout, index: number): { top: number; bottom: number } | null {
  const at = locate(layout, index);
  if (!at) return null;
  const section = layout.sections[at.section];
  const tile = section.masonry.tiles[at.local];
  const top = section.top + layout.headerHeight + tile.y;
  return { top, bottom: top + tile.height };
}

export type GridDirection = "left" | "right" | "up" | "down";

/**
 * Keyboard neighbour of an item. Left and right walk the sort order, so
 * every asset is reachable in reading order; up and down stay in the column,
 * crossing into the next section at its nearest column that has tiles.
 */
export function neighbourIndex(layout: GridLayout, index: number, direction: GridDirection): number | null {
  if (direction === "left") return index > 0 ? index - 1 : null;
  if (direction === "right") return index + 1 < layout.itemCount ? index + 1 : null;

  const at = locate(layout, index);
  if (!at) return null;
  const section = layout.sections[at.section];
  const tile = section.masonry.tiles[at.local];
  const column = section.masonry.columns[tile.column];
  const position = column.indexOf(at.local);
  const step = direction === "up" ? -1 : 1;
  const within = column[position + step];
  if (within !== undefined) return section.start + within;

  const next = layout.sections[at.section + step];
  if (!next) return null;
  let best: number | null = null;
  let bestDistance = Infinity;
  next.masonry.columns.forEach((candidate, c) => {
    if (!candidate.length) return;
    const distance = Math.abs(c - tile.column);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = direction === "up" ? candidate[candidate.length - 1] : candidate[0];
    }
  });
  return best === null ? null : next.start + best;
}
