"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDownUp, Check, ChevronDown, Grid3x3, LayoutGrid, ListFilter, Square, SquareCheck } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatCount, formatNumber } from "./format";
import { hasActiveFilters, useLibrary, type LibraryView, type SortOrder, type TileSize } from "./library";
import { MenuItem, MenuSectionLabel, MenuSurface, placeInto, quietTool, toolClass } from "./ui";

// Title and count on the left ("4 of 31" while filters narrow the view); on
// the right one row of quiet 28px controls (src/components/assets/AssetsHeader.tsx).

const VIEW_TITLES: Record<LibraryView, string> = { all: "Assets", favorites: "Favorites", trash: "Trash" };
const SORT_LABELS: Record<SortOrder, string> = { newest: "Newest", oldest: "Oldest" };
const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];
const SIZE_OPTIONS: { value: TileSize; label: string; Icon: typeof Grid3x3 }[] = [
  { value: "s", label: "Small tiles", Icon: Grid3x3 },
  { value: "m", label: "Medium tiles", Icon: LayoutGrid },
  { value: "l", label: "Large tiles", Icon: Square },
];
const SORT_MENU_WIDTH = 176;
const SORT_TRIGGER = "data-assets-sort-trigger";

/** The header's sort menu: arrows move between the two choices; choosing one closes it. */
export function AssetsSortMenu({ x, y, layer }: { x: number; y: number; layer: HTMLElement | null }) {
  const { state, actions } = useLibrary();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => placeInto(ref.current, layer, x, y), [x, y, layer]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (ref.current && !ref.current.contains(target) && !target?.closest?.(`[${SORT_TRIGGER}]`)) actions.closePopover();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [actions]);

  const backToTrigger = () => requestAnimationFrame(() => layer?.querySelector<HTMLElement>(`[${SORT_TRIGGER}]`)?.focus({ preventScroll: true }));

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    const index = rows.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % rows.length;
    else if (event.key === "ArrowUp") next = index <= 0 ? rows.length - 1 : index - 1;
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      actions.closePopover();
      backToTrigger();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    rows[next]?.focus();
  };

  return (
    <MenuSurface
      ref={ref}
      role="menu"
      aria-label="Sort"
      onKeyDown={onKeyDown}
      className="nb-drop-in absolute z-50 py-1 motion-reduce:animate-none"
      style={{ left: x, top: y, width: SORT_MENU_WIDTH }}
    >
      <MenuSectionLabel className="px-2.5 pt-1.5 pb-1">Sort by date</MenuSectionLabel>
      {SORT_OPTIONS.map((option) => {
        const active = option.value === state.sort;
        return (
          <MenuItem
            key={option.value}
            role="menuitemradio"
            aria-checked={active}
            onClick={() => {
              actions.setSort(option.value);
              backToTrigger();
            }}
          >
            <span className="truncate">{option.label}</span>
            {active && <Check size={14} strokeWidth={2} className="ml-auto shrink-0 text-neutral-100" />}
          </MenuItem>
        );
      })}
    </MenuSurface>
  );
}

export function AssetsHeader({ layer }: { layer: HTMLElement | null }) {
  const { state, actions, list, facets } = useLibrary();
  const { filters, sort, tileSize, selectMode, popover } = state;
  const sortOpen = popover?.kind === "sort";
  const base = filters.view === "favorites" ? facets.favorites : filters.view === "trash" ? facets.trash : facets.total;
  const total = list.length;
  const narrowed = hasActiveFilters(filters) && base !== total;
  const filterCount =
    filters.kinds.length + filters.projects.length + filters.workflows.length + filters.models.length + filters.tags.length + (filters.date === "any" ? 0 : 1) + (filters.q.trim() ? 1 : 0);

  const toggleSort = (button: HTMLButtonElement) => {
    if (sortOpen) return actions.closePopover();
    const rect = button.getBoundingClientRect();
    const origin = layer?.getBoundingClientRect();
    actions.openPopover({ kind: "sort", x: rect.left - (origin?.left ?? 0), y: rect.bottom - (origin?.top ?? 0) + 4 });
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-4 pt-3 pb-1 @[560px]:h-16 @[560px]:pt-4 @[560px]:pr-6 @[560px]:pb-2 @[560px]:pl-8">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h3 className="nb-font-display nb-tracking-display truncate text-xl leading-7 font-bold text-neutral-100">{VIEW_TITLES[filters.view]}</h3>
        <span aria-live="polite" className="nb-font-display hidden shrink-0 text-[13px] font-medium whitespace-nowrap text-neutral-500 @[400px]:inline">
          {narrowed ? (
            <>
              <span className="font-semibold text-neutral-400">{formatNumber(total)}</span> of {formatNumber(base)}
            </>
          ) : (
            formatCount(total)
          )}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Below the docked rail's width the rail opens as a drawer from here */}
        <button
          type="button"
          aria-expanded={state.railOpen}
          aria-label="Filters"
          title="Filters"
          onClick={() => actions.setRailOpen(!state.railOpen)}
          className={cn(toolClass, quietTool, "@[840px]:hidden", state.railOpen && "border-white/[0.18] text-neutral-100")}
        >
          <ListFilter size={14} strokeWidth={1.75} className="nb-text-ink-3" />
          <span className="hidden @[480px]:inline">Filters</span>
          {filterCount > 0 && (
            <span className="nb-font-mono flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-200 px-1 text-[10px] font-medium text-neutral-950">
              {filterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          {...{ [SORT_TRIGGER]: "" }}
          aria-haspopup="menu"
          aria-expanded={sortOpen}
          aria-label={`Sort: ${SORT_LABELS[sort]} first`}
          onClick={(event) => toggleSort(event.currentTarget)}
          className={cn(toolClass, quietTool, "hidden @[560px]:flex", sortOpen && "border-white/[0.18] text-neutral-100")}
        >
          <ArrowDownUp size={14} strokeWidth={1.75} className="nb-text-ink-3" />
          {SORT_LABELS[sort]}
          <ChevronDown size={12} strokeWidth={2} className="text-neutral-500" />
        </button>

        <div role="group" aria-label="Tile size" className="hidden gap-0.5 rounded-[7px] border border-white/[0.09] bg-white/[0.03] p-0.5 @[840px]:flex">
          {SIZE_OPTIONS.map(({ value, label, Icon }) => {
            const active = tileSize === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                aria-label={label}
                title={label}
                onClick={() => actions.setTileSize(value)}
                className={cn(
                  "flex h-[22px] w-6 items-center justify-center rounded-[5px] transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-[var(--nb-selection)] focus-visible:outline-none",
                  active ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-200",
                )}
              >
                <Icon size={14} strokeWidth={1.75} />
              </button>
            );
          })}
        </div>

        <span aria-hidden className="mx-1 hidden h-[18px] w-px bg-white/[0.08] @[840px]:block" />

        <button
          type="button"
          aria-pressed={selectMode}
          onClick={() => actions.setSelectMode(!selectMode)}
          title={selectMode ? "Done selecting" : "Select assets"}
          className={cn(toolClass, selectMode ? "border-neutral-200 bg-neutral-200 font-semibold text-neutral-900 hover:bg-white" : quietTool)}
        >
          {selectMode ? <Check size={14} strokeWidth={2} /> : <SquareCheck size={14} strokeWidth={1.75} className="nb-text-ink-3" />}
          {selectMode ? "Done" : "Select"}
        </button>
      </div>
    </header>
  );
}
