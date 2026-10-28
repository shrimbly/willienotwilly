"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, Minus, SearchX, Star, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { AssetTile, EASE_OUT, type TileEnter } from "./asset-tile";
import { dayKey, daySectionLabel, formatCount, formatNumber } from "./format";
import { hasActiveFilters, useLibrary, type TileSize } from "./library";
import { fitColumns, layoutGrid, neighbourIndex, tileBounds, type GridLayout } from "./masonry";
import { DialogTextButton, ring } from "./ui";

// The masonry of assets, one block per day under a sticky header
// (src/components/assets/AssetGrid.tsx). Tiles glide to their new places
// when filters, sorting or a new arrival reflow the columns.

/** Target column width per tile size (the app's 180/240/320, scaled to the tile). */
const TARGET_WIDTH: Record<TileSize, number> = { s: 150, m: 200, l: 280 };
/** Phone tiles: two columns at the default size, as the site's phone layout. */
const NARROW_TARGET_WIDTH: Record<TileSize, number> = { s: 96, m: 140, l: 300 };
const GAP = 8;
const HEADER_HEIGHT = 40;
const SECTION_GAP = 16;
const BOTTOM_PADDING = 96;
const MOVE = { duration: 0.45, ease: EASE_OUT };

function SectionHeader({ label, count, state, onToggle }: { label: string; count: number; state: "all" | "some" | "none"; onToggle: () => void }) {
  return (
    <div className="nb-bg-canvas pointer-events-auto sticky top-0 z-10 -mx-2 flex items-center gap-2 px-2" style={{ height: HEADER_HEIGHT }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={state === "all" ? true : state === "some" ? "mixed" : false}
        aria-label={`Select ${label}`}
        onClick={onToggle}
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors",
          ring,
          state === "none"
            ? "border-neutral-600 text-transparent hover:border-neutral-400"
            : "border-[var(--nb-selection)] bg-[var(--nb-selection)] text-white",
        )}
      >
        {state === "some" ? <Minus size={10} strokeWidth={3} /> : <Check size={10} strokeWidth={3} />}
      </button>
      <span className="nb-font-mono nb-tracking-eyebrow text-[11px] leading-4 text-neutral-300 uppercase">{label}</span>
      <span className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 text-[11px] leading-4">{formatNumber(count)}</span>
    </div>
  );
}

function EmptyFrame({ icon: Icon, title, children, action }: { icon: typeof SearchX; title: string; children: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
      <Icon size={40} strokeWidth={1.25} className="mb-4 text-neutral-600" />
      <p className="nb-font-display text-base leading-6 font-semibold tracking-[-0.01em] text-neutral-100">{title}</p>
      <p className="nb-text-ink-3 mt-1.5 max-w-md text-[13px] leading-5">{children}</p>
      {action && <div className="mt-5 flex items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function AssetGrid({ inView }: { inView: boolean }) {
  const { state, actions, list, grid, reducedMotion, onScreen } = useLibrary();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [instant, setInstant] = useState(true);
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);

  // Measure the grid; a resize relays out at once instead of gliding
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      setBox({ width: el.clientWidth, height: el.clientHeight });
      setInstant(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setInstant(false), 160);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // The library fills in tile by tile the first time it comes into view (the site's reveal)
  if (!shown && box && (inView || reducedMotion)) setShown(true);
  useEffect(() => {
    if (!shown || settled) return;
    const timer = setTimeout(() => setSettled(true), 1400);
    return () => clearTimeout(timer);
  }, [shown, settled]);

  const narrow = (box?.width ?? 1000) < 520;
  const pad = narrow ? 16 : 32;
  const { columnCount, columnWidth } = fitColumns((box?.width ?? 0) - pad * 2, (narrow ? NARROW_TARGET_WIDTH : TARGET_WIDTH)[state.tileSize], GAP);
  const items = useMemo(
    () => list.map((asset) => ({ id: asset.id, day: dayKey(asset.at), kind: asset.kind, width: asset.thumb?.width, height: asset.thumb?.height })),
    [list],
  );
  const layout: GridLayout = useMemo(
    () => layoutGrid(items, { columnCount, columnWidth, gap: GAP, headerHeight: HEADER_HEIGHT, sectionGap: SECTION_GAP }),
    [items, columnCount, columnWidth],
  );

  const selecting = state.selectMode || state.selection.length > 0;
  const selection = useMemo(() => new Set(state.selection), [state.selection]);
  const tabStop = state.focusedId && list.some((asset) => asset.id === state.focusedId) ? state.focusedId : list[0]?.id;

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      const bounds = tileBounds(layout, index);
      if (!el || !bounds) return;
      if (bounds.top - HEADER_HEIGHT < el.scrollTop) el.scrollTop = Math.max(0, bounds.top - HEADER_HEIGHT - GAP);
      else if (bounds.bottom > el.scrollTop + el.clientHeight) el.scrollTop = bounds.bottom - el.clientHeight + GAP;
    },
    [layout],
  );

  useEffect(() => {
    const nav = (direction: Parameters<typeof neighbourIndex>[2]) => {
      const current = state.focusedId ? list.findIndex((asset) => asset.id === state.focusedId) : -1;
      const next = current === -1 ? 0 : neighbourIndex(layout, current, direction);
      if (next === null || !list[next]) return;
      const id = list[next].id;
      actions.focus(id);
      scrollToIndex(next);
      requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>(`[data-asset-tile="${id}"]`)?.focus({ preventScroll: true }));
    };
    const top = () => scrollRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    return grid.register({ nav, top });
  }, [grid, layout, list, state.focusedId, actions, scrollToIndex, reducedMotion]);

  // Back to the tile the detail ended on, when it closes
  const detailOpen = state.detailId !== null;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !detailOpen && state.focusedId) {
      const index = list.findIndex((asset) => asset.id === state.focusedId);
      if (index !== -1) scrollToIndex(index);
      scrollRef.current?.querySelector<HTMLElement>(`[data-asset-tile="${state.focusedId}"]`)?.focus({ preventScroll: true });
    }
    wasOpen.current = detailOpen;
  }, [detailOpen, state.focusedId, list, scrollToIndex]);

  const onActivate = useCallback(
    (id: string, event: ReactMouseEvent) => {
      if (event.shiftKey) actions.selectRange(id);
      else if (event.metaKey || event.ctrlKey || state.selectMode) actions.toggleSelect(id);
      else actions.openDetail(id);
    },
    [actions, state.selectMode],
  );
  const onToggleSelect = useCallback(
    (id: string, event: ReactMouseEvent) => {
      if (event.shiftKey) actions.selectRange(id);
      else actions.toggleSelect(id);
    },
    [actions],
  );
  const onToggleFavorite = useCallback(
    (id: string) => actions.bulk([id], { action: state.records[id]?.favorite ? "unfavorite" : "favorite" }),
    [actions, state.records],
  );
  const onContextMenu = useCallback(
    (id: string, event: ReactMouseEvent) => {
      event.preventDefault();
      actions.focus(id);
      const layer = scrollRef.current?.closest<HTMLElement>("[data-assets-layer]");
      const origin = layer?.getBoundingClientRect();
      const ids = selection.has(id) && selection.size > 1 ? [...selection] : [id];
      actions.openPopover({ kind: "menu", x: event.clientX - (origin?.left ?? 0), y: event.clientY - (origin?.top ?? 0), anchorId: id, ids });
    },
    [actions, selection],
  );
  const onFocus = useCallback((id: string) => actions.focus(id), [actions]);

  const enterFor: TileEnter = settled ? "arrive" : "reveal";

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        data-asset-scroller=""
        className="nb-assets-scroll absolute inset-0 [scrollbar-gutter:stable]"
      >
        {list.length === 0 ? (
          <div className="flex h-full flex-col">
            {hasActiveFilters(state.filters) ? (
              <EmptyFrame icon={SearchX} title="No assets match" action={<DialogTextButton onClick={actions.clearFilters}>Clear filters</DialogTextButton>}>
                Try another search, or fewer filters.
              </EmptyFrame>
            ) : state.filters.view === "trash" ? (
              <EmptyFrame icon={Trash2} title="Trash is empty">
                Items in Trash are deleted after 30 days.
              </EmptyFrame>
            ) : (
              <EmptyFrame icon={Star} title="No favorites yet">
                Star an asset to keep it here.
              </EmptyFrame>
            )}
          </div>
        ) : (
          <div className="relative" style={{ height: shown ? layout.height + BOTTOM_PADDING : "100%" }}>
            {shown &&
              layout.sections.map((section) => {
                const size = section.masonry.tiles.length;
                const ids = list.slice(section.start, section.start + size).map((asset) => asset.id);
                const picked = ids.filter((id) => selection.has(id)).length;
                const sectionState = picked === 0 ? "none" : picked === size ? "all" : "some";
                const label = daySectionLabel(section.day);
                return (
                  <motion.section
                    key={section.day}
                    aria-label={label}
                    className="pointer-events-none absolute top-0 z-10"
                    style={{ left: pad, right: pad, height: HEADER_HEIGHT + section.masonry.height }}
                    initial={reducedMotion || !settled ? false : { opacity: 0, y: section.top }}
                    animate={{ opacity: 1, y: section.top }}
                    transition={{ y: instant || reducedMotion ? { duration: 0 } : MOVE, opacity: { duration: 0.2 } }}
                  >
                    <SectionHeader label={label} count={size} state={sectionState} onToggle={() => actions.setSelected(ids, sectionState !== "all")} />
                  </motion.section>
                );
              })}
            <AnimatePresence initial={false}>
              {shown &&
                layout.sections.flatMap((section) =>
                  section.masonry.tiles.map((tile, local) => {
                    const index = section.start + local;
                    const asset = list[index];
                    const record = state.records[asset.id];
                    return (
                      <AssetTile
                        key={asset.id}
                        asset={asset}
                        width={tile.width}
                        height={tile.height}
                        x={pad + tile.x}
                        y={section.top + HEADER_HEIGHT + tile.y}
                        favorite={record.favorite}
                        selected={selection.has(asset.id)}
                        focused={state.focusedId === asset.id}
                        tabbable={asset.id === tabStop}
                        selecting={selecting}
                        enter={enterFor}
                        delay={settled ? 0 : 0.2 + Math.min(index, 16) * 0.04}
                        instant={instant}
                        reducedMotion={reducedMotion}
                        preview={onScreen && !reducedMotion}
                        onFocus={onFocus}
                        onActivate={onActivate}
                        onToggleSelect={onToggleSelect}
                        onToggleFavorite={onToggleFavorite}
                        onContextMenu={onContextMenu}
                      />
                    );
                  }),
                )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {state.waiting.length > 0 && (
        <button
          type="button"
          onClick={() => {
            actions.showArrivals();
            grid.scrollTop();
          }}
          className={cn(
            "nb-drop-in nb-font-display nb-shadow-menu absolute top-3 left-1/2 z-20 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-neutral-200 px-3.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-white motion-reduce:animate-none",
            ring,
          )}
        >
          <ArrowUp size={14} strokeWidth={2} />
          {formatCount(state.waiting.length, "new", "new")}
        </button>
      )}
    </div>
  );
}
