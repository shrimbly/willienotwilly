"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { LIBRARY_ROOT } from "@/lib/node-banana/assets";

import { ASSET_KINDS, KIND_PLURALS, formatNumber } from "./format";
import { useLibrary, type DatePreset, type FacetRow, type FilterList, type LibraryView } from "./library";
import { DialogEyebrow, DialogFilterItem, DialogPaneRule, DialogSearchField, DialogTextButton, ring } from "./ui";

// The filter rail (src/components/assets/AssetsRail.tsx): search, the filters
// that are on as chips, the Library views, and the facets, each folding from
// its header. Groups narrow together; rows within a group add up.

export const RAIL_WIDTH = 232;
const COLLAPSED_ROWS = 5;

const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

type GroupKey = "type" | "projects" | "workflows" | "models" | "tags" | "date";
const DEFAULT_OPEN: Record<GroupKey, boolean> = { type: true, projects: true, workflows: false, models: false, tags: false, date: false };

function Count({ children }: { children: ReactNode }) {
  return <span className="nb-font-mono nb-text-ink-3 ml-auto pl-2 text-[11px] font-normal tabular-nums">{children}</span>;
}

function FilterChip({ label, title, onRemove }: { label: string; title: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      title={title}
      className={cn(
        "nb-font-display nb-bg-canvas inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-white/10 pr-1 pl-[9px] text-xs font-medium text-neutral-200 transition-colors hover:border-white/20",
        ring,
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <X size={12} strokeWidth={2} className="shrink-0 text-neutral-400" />
    </button>
  );
}

function FilterGroup({
  label,
  open,
  onToggle,
  activeCount,
  total,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  activeCount: number;
  total?: number;
  children: ReactNode;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div role="group" aria-label={label} className="flex shrink-0 flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "nb-font-display flex h-[30px] w-full items-center gap-2 rounded-md pr-2 pl-[7px] text-left text-[13px] font-semibold tracking-[-0.01em] text-neutral-300 transition-colors hover:bg-white/[0.03] hover:text-neutral-100",
          ring,
        )}
      >
        <Chevron size={14} strokeWidth={2} className="shrink-0 text-neutral-500" />
        <span className="min-w-0 truncate">{label}</span>
        {activeCount > 0 && (
          <span
            className="nb-font-mono flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-neutral-200 px-[5px] text-[10px] font-medium text-neutral-950"
            aria-label={`${activeCount} on`}
          >
            {activeCount}
          </span>
        )}
        {total !== undefined && <span className="nb-font-mono ml-auto text-[11px] font-normal text-neutral-500 tabular-nums">{total}</span>}
      </button>
      {open && <div className="flex flex-col pb-2 pl-[18px]">{children}</div>}
    </div>
  );
}

function MultiRows({ list, rows, selected, empty }: { list: FilterList; rows: FacetRow[]; selected: string[]; empty?: string }) {
  const { actions } = useLibrary();
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return empty ? <p className="px-[11px] pt-0.5 pb-1 text-xs leading-4 text-neutral-500">{empty}</p> : null;
  const shown = expanded ? rows : rows.filter((row, i) => i < COLLAPSED_ROWS || selected.includes(row.value));
  return (
    <>
      {shown.map((row) => {
        const active = selected.includes(row.value);
        return (
          <DialogFilterItem
            key={row.value}
            active={active}
            onClick={() => actions.toggleFilter(list, row.value)}
            title={row.title ?? row.label}
            className={cn(!active && row.count === 0 && "text-neutral-600")}
          >
            <span className="min-w-0 truncate">{row.label}</span>
            <Count>{formatNumber(row.count)}</Count>
          </DialogFilterItem>
        );
      })}
      {rows.length > COLLAPSED_ROWS && (expanded || rows.length > shown.length) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 h-6 self-start pl-[11px] text-[10px] uppercase hover:text-neutral-200"
        >
          {expanded ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}

export function AssetsRail({ drawer = false, onClose }: { drawer?: boolean; onClose?: () => void }) {
  const { state, actions, facets } = useLibrary();
  const { filters } = state;
  const [open, setOpen] = useState(DEFAULT_OPEN);
  const toggleOpen = (key: GroupKey) => setOpen((current) => ({ ...current, [key]: !current[key] }));

  const libraryRows: { view: LibraryView; label: string; count: number }[] = [
    { view: "all", label: "All assets", count: facets.total },
    { view: "favorites", label: "Favorites", count: facets.favorites },
    { view: "trash", label: "Trash", count: facets.trash },
  ];
  const typeRows: FacetRow[] = ASSET_KINDS.map((kind) => ({ value: kind, label: KIND_PLURALS[kind], count: facets.kinds[kind] }));

  const labelIn = (rows: FacetRow[], value: string) => rows.find((row) => row.value === value)?.label ?? value;
  const chipsFor = (list: FilterList, kind: string, rows: FacetRow[]) =>
    filters[list].map((value) => ({
      id: `${list}:${value}`,
      label: labelIn(rows, value),
      title: `${kind}: ${labelIn(rows, value)}`,
      remove: () => actions.toggleFilter(list, value),
    }));
  const active = [
    ...chipsFor("kinds", "Type", typeRows),
    ...chipsFor("projects", "Project", facets.projects),
    ...chipsFor("workflows", "Workflow", facets.workflows),
    ...chipsFor("models", "Model", facets.models),
    ...chipsFor("tags", "Tag", facets.tags),
    ...(filters.date !== "any"
      ? [
          {
            id: "date",
            label: DATE_OPTIONS.find((option) => option.value === filters.date)?.label ?? filters.date,
            title: "Date",
            remove: () => actions.setFilters({ date: "any" }),
          },
        ]
      : []),
  ];

  return (
    <div
      className={cn(
        "nb-bg-pane flex min-h-0 shrink-0 flex-col justify-between gap-2 px-4 pt-5 pb-3",
        drawer ? "nb-shadow-dialog h-full border-r border-white/[0.06]" : "z-[1]",
      )}
      style={{ width: RAIL_WIDTH }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <DialogSearchField
            aria-label="Search assets"
            placeholder="Search assets"
            value={filters.q}
            onChange={(event) => actions.search(event.target.value)}
            className="min-w-0 flex-1"
          />
          {drawer && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100", ring)}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {active.length > 0 && (
          <div role="group" aria-label="Filters on" className="mt-3.5 flex shrink-0 flex-col gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex items-center pl-[11px]">
              <DialogEyebrow className="text-neutral-500">Filtering by</DialogEyebrow>
              <DialogTextButton onClick={actions.clearFilters} className="ml-auto h-5 text-xs">
                Clear all
              </DialogTextButton>
            </div>
            <div className="flex flex-wrap gap-1.5 pr-1 pl-[7px]">
              {active.map((filter) => (
                <FilterChip key={filter.id} label={filter.label} title={filter.title} onRemove={filter.remove} />
              ))}
            </div>
          </div>
        )}

        <div className="-mx-4 mt-3.5 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-2">
          <div role="group" aria-label="Library" className="flex flex-col">
            {libraryRows.map((row) => (
              <DialogFilterItem key={row.view} active={filters.view === row.view} onClick={() => actions.setView(row.view)}>
                {row.label}
                <Count>{formatNumber(row.count)}</Count>
              </DialogFilterItem>
            ))}
          </div>

          <DialogPaneRule className="my-2 shrink-0" />

          <div className="flex flex-col gap-0.5">
            <FilterGroup label="Type" open={open.type} onToggle={() => toggleOpen("type")} activeCount={filters.kinds.length}>
              <MultiRows list="kinds" rows={typeRows} selected={filters.kinds} />
            </FilterGroup>
            <FilterGroup
              label="Projects"
              open={open.projects}
              onToggle={() => toggleOpen("projects")}
              activeCount={filters.projects.length}
              total={facets.projects.length}
            >
              <MultiRows list="projects" rows={facets.projects} selected={filters.projects} empty="No projects yet." />
            </FilterGroup>
            <FilterGroup
              label="Workflows"
              open={open.workflows}
              onToggle={() => toggleOpen("workflows")}
              activeCount={filters.workflows.length}
              total={facets.workflows.length}
            >
              <MultiRows list="workflows" rows={facets.workflows} selected={filters.workflows} empty="No workflows yet." />
            </FilterGroup>
            <FilterGroup
              label="Models"
              open={open.models}
              onToggle={() => toggleOpen("models")}
              activeCount={filters.models.length}
              total={facets.models.length}
            >
              <MultiRows list="models" rows={facets.models} selected={filters.models} empty="No models yet." />
            </FilterGroup>
            <FilterGroup label="Tags" open={open.tags} onToggle={() => toggleOpen("tags")} activeCount={filters.tags.length} total={facets.tags.length}>
              <MultiRows list="tags" rows={facets.tags} selected={filters.tags} empty="No tags yet. Add them from an asset's details." />
            </FilterGroup>
            <FilterGroup label="Date" open={open.date} onToggle={() => toggleOpen("date")} activeCount={filters.date === "any" ? 0 : 1}>
              {DATE_OPTIONS.map((option) => (
                <DialogFilterItem key={option.value} active={filters.date === option.value} onClick={() => actions.setFilters({ date: option.value })}>
                  {option.label}
                </DialogFilterItem>
              ))}
            </FilterGroup>
          </div>
        </div>
      </div>

      {/* Where the files are; the drawer gives the room to the filters */}
      <div className={cn("flex shrink-0 flex-col gap-1 border-t border-white/[0.06] px-[11px] pt-2.5", drawer && "hidden")}>
        <DialogEyebrow className="text-neutral-500">Saved to</DialogEyebrow>
        <span className="nb-font-mono truncate text-left text-[11px] leading-4 text-neutral-300" title={LIBRARY_ROOT} dir="rtl">
          <bdi>{LIBRARY_ROOT}</bdi>
        </span>
        <div aria-hidden className="nb-font-display -ml-1.5 flex items-center gap-1 text-xs font-medium text-neutral-400">
          <span className="px-1.5 leading-7">Show</span>
          <span className="px-1.5 leading-7">Change…</span>
        </div>
      </div>
    </div>
  );
}
