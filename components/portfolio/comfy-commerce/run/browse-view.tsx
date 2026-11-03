"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { motion } from "motion/react";

import { BROWSE_PAGE_SIZE } from "@/lib/comfy-commerce/run";
import type { CcProduct } from "@/lib/comfy-commerce/media";
import { cn } from "@/lib/utils";

import { Button } from "../kit/button";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ICON, IconBox, LayoutGrid, List, RefreshCw, Rows3, Search } from "../kit/icons";
import { easeSoft, staggerChild, staggerParent } from "../kit/motion";
import { STORE_TAGS, type Tile } from "./data";
import { PlayIcon, useHover } from "./play-icon";

// Browse products, from web/src/features/browse/BrowsePage.tsx: the page
// title with Run catalog, then the listing card (the filter bar, the Grid
// view's media tiles, the pagination bar). Grid view only: the Grouped and
// List switch is drawn, not live. The search, the tag filter, paging,
// click and shift-click selection and the refresh are the product's.
//
// The product's page scrolls; a tile cannot, so the grid fits its card: the
// product's column count for the tile's width (its sm/lg/xl steps), one or two
// more where that fits a whole page, and pages of up to its twelve products,
// fewer where fewer rows fit. Under the grid a strip is kept clear for the
// selection pill (the product floats it over the page), so it never covers a
// tile or the pager; until something is selected it holds the how-to line.

/* ---------------------------------------------------------------- layout */

export interface GridLayout {
  cols: number;
  gap: number;
  pad: number;
  /** Products per page. */
  pageSize: number;
  paginated: boolean;
  /** Below the product's sm step (640px): tighter padding and gaps. */
  narrow: boolean;
}

const PAGE_BAR = { wide: 53, narrow: 45 };
/** The strip the selection pill rises into: its 46px plus 4px above and below. */
const PILL_STRIP = 54;

const imagesOf = (products: CcProduct[]) => products.reduce((n, p) => n + p.media.length, 0);

function pages(products: CcProduct[], size: number) {
  const out: CcProduct[][] = [];
  for (let i = 0; i < products.length; i += size) out.push(products.slice(i, i + size));
  return out;
}

/** Fit the grid in its card body (`width` × `height`), for a tile `tileWidth` wide. */
export function fitGrid(tileWidth: number, width: number, height: number, products: CcProduct[]): GridLayout {
  const narrow = tileWidth < 640;
  const gap = narrow ? 8 : 12;
  const pad = narrow ? 12 : 20;
  // BrowsePage's grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7, read off the tile as the window.
  const base = tileWidth < 640 ? 3 : tileWidth < 1024 ? 4 : tileWidth < 1280 ? 6 : 7;
  // 60px lets a 360px phone take a fourth column (63px tiles), so a page holds two rows of tees, not one tee.
  const minTile = narrow ? 60 : 72;
  const gridW = width - pad * 2;
  const room = height - PILL_STRIP;
  const options: { cols: number; size: number }[] = [];
  for (let cols = base; cols <= base + 2; cols++) {
    const size = (gridW - (cols - 1) * gap) / cols;
    if (cols > base && size < minTile) break;
    options.push({ cols, size });
  }
  const capacities = (gridH: number) =>
    options.map((o) => ({ ...o, capacity: o.cols * Math.max(1, Math.floor((gridH - pad * 2 + gap) / (o.size + gap))) }));
  const choose = (gridH: number, need: number) => {
    const fits = capacities(gridH);
    return fits.find((o) => o.capacity >= need) ?? fits.reduce((a, b) => (b.capacity > a.capacity ? b : a));
  };

  // Everything on one page, as when a search narrows the catalog.
  const total = imagesOf(products);
  if (products.length <= BROWSE_PAGE_SIZE) {
    const whole = choose(room, total);
    if (whole.capacity >= total) return { cols: whole.cols, gap, pad, pageSize: BROWSE_PAGE_SIZE, paginated: false, narrow };
  }
  // Paged: the product's twelve per page where they fit, fewer where they don't.
  const gridH = room - (narrow ? PAGE_BAR.narrow : PAGE_BAR.wide);
  const firstPage = imagesOf(products.slice(0, BROWSE_PAGE_SIZE));
  const pick = choose(gridH, firstPage);
  let pageSize = BROWSE_PAGE_SIZE;
  while (pageSize > 1 && pages(products, pageSize).some((page) => imagesOf(page) > pick.capacity)) pageSize -= 1;
  return { cols: pick.cols, gap, pad, pageSize, paginated: products.length > pageSize, narrow };
}

/* ------------------------------------------------------------------ tile */

function MediaTile({
  tile,
  selected,
  onSelect,
}: {
  tile: Tile;
  selected: boolean;
  onSelect: (tile: Tile, shiftKey: boolean) => void;
}) {
  const featured = tile.position === 1;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${tile.product.title}, ${featured ? "featured image" : `image ${tile.position}`}`}
      title={`${tile.product.title} — ${featured ? "featured" : `image #${tile.position}`}`}
      onClick={(e) => onSelect(tile, e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(tile, e.shiftKey);
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border bg-(--surface) text-left select-none",
        "transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ink) motion-reduce:transition-none",
        selected
          ? "border-(--ink) shadow-(--shadow-lift) ring-2 ring-(--ink) ring-offset-2 ring-offset-(--surface)"
          : "border-(--line) shadow-(--shadow-soft) hover:shadow-(--shadow-lift)",
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-(--surface-2)">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media */}
        <img
          src={tile.media.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(
            "h-full w-full object-cover transition-transform duration-700 ease-(--ease-out-soft) motion-reduce:transition-none",
            "group-hover:scale-[1.03]",
            selected && "scale-[1.02]",
          )}
        />
      </div>
      {featured && (
        <span aria-hidden className="absolute top-2 left-2 size-2 rounded-full border border-(--line) bg-(--surface) shadow-(--shadow-soft)" />
      )}
      <motion.span
        aria-hidden
        initial={false}
        animate={{ scale: selected ? 1 : 0.85, opacity: selected ? 1 : 0 }}
        transition={{ duration: 0.2, ease: easeSoft }}
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-lg bg-(--ink) text-(--surface)"
      >
        <Check />
      </motion.span>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

const PAGE_NAV_BUTTON =
  "flex size-8 cursor-pointer items-center justify-center rounded-lg text-(--ink-faint) transition-colors hover:bg-(--surface) hover:text-(--ink) disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none";

/** The view switch, drawn as the product draws it on the bar (Grid on); this tile only has the Grid view. */
function ViewSwitch() {
  const views = [
    { key: "grouped", Icon: Rows3 },
    { key: "grid", Icon: LayoutGrid },
    { key: "list", Icon: List },
  ];
  return (
    <div aria-hidden className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-xl border border-transparent bg-(--surface-2) p-1 @min-[500px]/listing:inline-flex">
      {views.map(({ key, Icon }) => (
        <span
          key={key}
          className={cn(
            "relative flex h-7 items-center rounded-lg px-2.5",
            key === "grid" ? "border border-(--line) bg-(--surface) text-(--ink) shadow-(--shadow-soft)" : "text-(--ink-soft)",
          )}
        >
          <Icon {...ICON} />
        </span>
      ))}
    </div>
  );
}

export function BrowseView({
  products,
  filtering,
  query,
  onQuery,
  tag,
  onTag,
  page,
  onPage,
  selected,
  onSelect,
  onRunCatalog,
  runCatalogRef,
  hint,
  selectionBar,
  entered,
  reducedMotion,
}: {
  /** The products the search and filter keep. */
  products: CcProduct[];
  filtering: boolean;
  query: string;
  onQuery: (q: string) => void;
  tag: string;
  onTag: (t: string) => void;
  page: number;
  onPage: (p: number) => void;
  selected: ReadonlySet<string>;
  onSelect: (tile: Tile, shiftKey: boolean) => void;
  onRunCatalog: () => void;
  runCatalogRef: Ref<HTMLButtonElement>;
  /** The how-to line, in the pill's strip until something is selected. */
  hint?: ReactNode;
  /** The SelectionBar (in its AnimatePresence), drawn in the strip under the grid. */
  selectionBar?: ReactNode;
  /** The tile has been seen: the grid's stagger plays then, not while it is still below the fold. */
  entered: boolean;
  reducedMotion: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ tile: 1152, tileHeight: 720, width: 832, height: 480 });
  const [refreshing, setRefreshing] = useState(false);
  const runHover = useHover(reducedMotion);

  useLayoutEffect(() => {
    const el = body.current;
    const root = el?.closest(".cc");
    if (!el || !root) return;
    const measure = () => setBox({ tile: root.clientWidth, tileHeight: root.clientHeight, width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const layout = fitGrid(box.tile, box.width, box.height, products);
  const pageCount = Math.max(1, Math.ceil(products.length / layout.pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = layout.paginated ? products.slice(safePage * layout.pageSize, (safePage + 1) * layout.pageSize) : products;
  const images = imagesOf(products);
  // A phone-sized tile has no room for the page title: Run catalog moves into the filter bar.
  const compact = layout.narrow && box.tileHeight < 600;

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const runCatalog = (
    <Button
      ref={runCatalogRef}
      variant="primary"
      size={compact ? "sm" : "md"}
      onClick={onRunCatalog}
      className={cn(compact && "ml-auto")}
      {...runHover.props}
    >
      <IconBox>
        <PlayIcon hover={runHover.hover} />
      </IconBox>
      Run catalog
    </Button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* PageHeader: the title on the bare canvas, Run catalog on its row (Caption images is left out). */}
      <div className={cn("mb-3 flex items-start justify-between gap-4 [@container_cc_(height>=600px)]:mb-5", compact && "hidden")}>
        <div className="min-w-0">
          <p className="text-xl leading-7 font-semibold">Browse products</p>
          <p className="mt-0.5 hidden max-w-xl text-sm text-(--ink-soft) [@container_cc_(height>=600px)]:block">
            Pick product media, then run a workflow on a selection or the whole catalog.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{runCatalog}</div>
      </div>

      <div className="@container/listing flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-(--line) bg-(--surface) shadow-(--shadow-soft)">
        {/* The filter bar: the listing card's header. */}
        <div className={cn("flex shrink-0 items-center gap-2 border-b border-(--line) bg-(--surface-2) py-3", layout.narrow ? "px-3" : "px-4")}>
          <label
            className={cn(
              "flex h-8 items-center gap-1 rounded-lg border border-(--line) bg-(--surface) px-2 transition-colors focus-within:border-(--ink)",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--ink)",
              layout.narrow ? "min-w-0 flex-1" : "w-56 min-w-0 shrink",
            )}
          >
            <IconBox className="shrink-0 text-(--ink-faint)">
              <Search />
            </IconBox>
            <span className="sr-only">Search products</span>
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={layout.narrow ? "Search products…" : "Search products, captions…"}
              className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-(--ink-faint) focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
          </label>

          {!layout.narrow && (
            <span className="relative inline-flex shrink-0">
              <select
                aria-label="Filter by tag"
                value={tag}
                onChange={(e) => onTag(e.target.value)}
                className="h-8 cursor-pointer appearance-none rounded-lg border border-(--line) bg-(--surface) pr-8 pl-3 text-sm text-(--ink-soft) outline-none transition-colors hover:bg-(--surface-2) focus:border-(--ink)"
              >
                <option value="all">All tags</option>
                {STORE_TAGS.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-(--ink-faint)">
                <ChevronDown size={14} />
              </span>
            </span>
          )}

          {!layout.narrow && (
            <span className="hidden shrink-0 px-1 text-sm whitespace-nowrap text-(--ink-faint) @min-[640px]/listing:inline">
              {filtering
                ? `${images} image${images === 1 ? "" : "s"} · ${products.length} product${products.length === 1 ? "" : "s"}`
                : `${products.length} products`}
            </span>
          )}

          {layout.narrow ? (
            compact && runCatalog
          ) : (
            <>
              <ViewSwitch />
              <button
                type="button"
                onClick={refresh}
                aria-label="Refresh from store"
                title="Refresh from store"
                className="ml-auto flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-(--ink-faint) transition-colors hover:bg-(--surface) hover:text-(--ink) motion-reduce:transition-none @min-[500px]/listing:ml-0"
              >
                <IconBox className={cn(refreshing && !reducedMotion && "animate-spin")}>
                  <RefreshCw />
                </IconBox>
              </button>
            </>
          )}
        </div>

        <div ref={body} className="flex min-h-0 flex-1 flex-col">
          {products.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
              <p className="text-sm text-(--ink-soft)">No products match your search or filters.</p>
              <Button
                className="mt-3"
                onClick={() => {
                  onQuery("");
                  onTag("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <motion.div
              variants={staggerParent}
              initial={reducedMotion ? false : "initial"}
              animate={entered || reducedMotion ? "animate" : "initial"}
              className="grid min-h-0 flex-1 content-start overflow-hidden"
              style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`, gap: layout.gap, padding: layout.pad }}
            >
              {paged.flatMap((product) =>
                product.media.map((media, i) => {
                  const tile: Tile = { id: `${product.slug}#${i + 1}`, product, media, position: i + 1 };
                  return (
                    <motion.div key={tile.id} variants={staggerChild}>
                      <MediaTile tile={tile} selected={selected.has(tile.id)} onSelect={onSelect} />
                    </motion.div>
                  );
                }),
              )}
            </motion.div>
          )}

          {/* The pill rises out from behind the pagination bar into this strip. */}
          <div className="relative z-0 flex shrink-0 items-center justify-center px-2" style={{ height: PILL_STRIP }}>
            {hint}
            {selectionBar}
          </div>

          {layout.paginated && products.length > 0 && (
            <div
              className={cn(
                "relative z-10 flex shrink-0 items-center justify-between border-t border-(--line) bg-(--surface-2) px-4",
                layout.narrow ? "py-1.5" : "py-2.5",
              )}
            >
              <span className="text-sm text-(--ink-faint)">
                {safePage * layout.pageSize + 1}–{Math.min((safePage + 1) * layout.pageSize, products.length)} of {products.length} products
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onPage(safePage - 1)} disabled={safePage === 0} aria-label="Previous page" className={PAGE_NAV_BUTTON}>
                  <IconBox>
                    <ChevronLeft />
                  </IconBox>
                </button>
                <span className="px-1 text-sm text-(--ink-soft) tabular-nums">
                  {safePage + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => onPage(safePage + 1)}
                  disabled={safePage >= pageCount - 1}
                  aria-label="Next page"
                  className={PAGE_NAV_BUTTON}
                >
                  <IconBox>
                    <ChevronRight />
                  </IconBox>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
