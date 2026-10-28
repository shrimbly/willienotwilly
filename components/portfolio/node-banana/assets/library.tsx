"use client";

import { createContext, useContext, useMemo, useReducer, useRef, type ReactNode } from "react";

import { DAYS, LIBRARY_ASSETS, WORKFLOW_HEROES, type AssetKind, type LibraryAsset } from "@/lib/node-banana/assets";

import { ASSET_KINDS, dayKey, formatCount, hasTag, projectLabel } from "./format";
import type { GridDirection } from "./masonry";

// The app's asset store (src/store/assetStore.ts) cut down to one in-memory
// library: filters narrow together (rows within a group add up), every bulk
// action leaves a notice with Undo, and the open detail steps through the
// list the filters show.

export type LibraryView = "all" | "favorites" | "trash";
export type DatePreset = "any" | "today" | "7d" | "30d";
export type TileSize = "s" | "m" | "l";
export type SortOrder = "newest" | "oldest";
export type FilterList = "kinds" | "projects" | "workflows" | "models" | "tags";

export interface Filters {
  view: LibraryView;
  q: string;
  kinds: string[];
  projects: string[];
  workflows: string[];
  models: string[];
  tags: string[];
  date: DatePreset;
}

export interface RecordState {
  favorite: boolean;
  tags: string[];
  trashed: boolean;
}

export type Popover =
  | { kind: "menu"; x: number; y: number; anchorId: string; ids: string[] }
  | { kind: "sort"; x: number; y: number }
  | { kind: "tags"; x: number; y: number; ids: string[]; above?: boolean };

export interface Notice {
  id: number;
  message: string;
  tone: "info" | "error";
  undo: boolean;
}

interface UndoEntry {
  label: string;
  before: Record<string, RecordState>;
}

export type BulkOp =
  | { action: "favorite" | "unfavorite" | "trash" | "restore" }
  | { action: "tag" | "untag"; tags: string[] };

export interface LibraryState {
  records: Record<string, RecordState>;
  /** Arrivals that are in the library now. */
  landed: string[];
  /** Arrivals held behind the "↑ 1 new" pill while the grid is scrolled. */
  waiting: string[];
  filters: Filters;
  sort: SortOrder;
  tileSize: TileSize;
  selectMode: boolean;
  selection: string[];
  anchorId: string | null;
  focusedId: string | null;
  detailId: string | null;
  popover: Popover | null;
  notice: Notice | null;
  noticeSeq: number;
  undo: UndoEntry[];
  /** The rail as a drawer, where the frame is too narrow to dock it. */
  railOpen: boolean;
  appView: "assets" | "canvas";
  tabs: string[];
  canvas: { workflowId: string; assetId: string };
}

export const ASSETS_BY_ID: Record<string, LibraryAsset> = Object.fromEntries(LIBRARY_ASSETS.map((asset) => [asset.id, asset]));
export const ARRIVALS = LIBRARY_ASSETS.filter((asset) => asset.arrival !== undefined).sort((a, b) => a.arrival! - b.arrival!);

const DEFAULT_FILTERS: Filters = { view: "all", q: "", kinds: [], projects: [], workflows: [], models: [], tags: [], date: "any" };
const CLEARED: Partial<Filters> = { kinds: [], projects: [], workflows: [], models: [], tags: [], date: "any" };
const DATE_DAYS: Record<DatePreset, number> = { any: Infinity, today: 0, "7d": 6, "30d": 29 };
const UNDO_LIMIT = 20;

function initialRecords(): Record<string, RecordState> {
  return Object.fromEntries(
    LIBRARY_ASSETS.map((asset) => [asset.id, { favorite: !!asset.favorite, tags: asset.tags ?? [], trashed: !!asset.trashed }]),
  );
}

export function initialState(): LibraryState {
  return {
    records: initialRecords(),
    landed: [],
    waiting: [],
    filters: DEFAULT_FILTERS,
    sort: "newest",
    tileSize: "m",
    selectMode: false,
    selection: [],
    anchorId: null,
    focusedId: null,
    detailId: null,
    popover: null,
    notice: null,
    noticeSeq: 0,
    undo: [],
    railOpen: false,
    appView: "assets",
    tabs: ["wf-lookbook", "wf-cars"],
    canvas: { workflowId: "wf-lookbook", assetId: WORKFLOW_HEROES["wf-lookbook"] },
  };
}

function inLibrary(state: Pick<LibraryState, "landed">, asset: LibraryAsset): boolean {
  return asset.arrival === undefined || state.landed.includes(asset.id);
}

function searchTerms(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 16);
}

/** What the filters show, in sort order. */
export function listOf(state: Pick<LibraryState, "records" | "landed" | "filters" | "sort">): LibraryAsset[] {
  const { filters, records } = state;
  const terms = searchTerms(filters.q);
  const daysAgo = Object.fromEntries(DAYS.map((day) => [day.key, day.daysAgo]));
  const list = LIBRARY_ASSETS.filter((asset) => {
    if (!inLibrary(state, asset)) return false;
    const record = records[asset.id];
    if (filters.view === "trash" ? !record.trashed : record.trashed) return false;
    if (filters.view === "favorites" && !record.favorite) return false;
    if (filters.kinds.length && !filters.kinds.includes(asset.kind)) return false;
    if (filters.projects.length && !filters.projects.includes(asset.project ?? "")) return false;
    if (filters.workflows.length && !filters.workflows.includes(asset.workflow.id)) return false;
    if (filters.models.length && !(asset.model && filters.models.includes(asset.model.id))) return false;
    if (filters.tags.length && !record.tags.some((tag) => hasTag(filters.tags, tag))) return false;
    if (daysAgo[dayKey(asset.at)] > DATE_DAYS[filters.date]) return false;
    if (terms.length) {
      const text = [
        asset.prompt ?? "",
        asset.filename,
        asset.model?.id ?? "",
        asset.model?.displayName ?? "",
        asset.workflow.name,
        asset.producer.title,
        record.tags.join("\n"),
      ]
        .join("\n")
        .toLowerCase();
      if (!terms.every((term) => text.includes(term))) return false;
    }
    return true;
  });
  return list.sort((a, b) => (state.sort === "oldest" ? a.at - b.at : b.at - a.at) || (a.id < b.id ? 1 : -1));
}

export interface FacetRow {
  value: string;
  label: string;
  count: number;
  title?: string;
}

export interface Facets {
  total: number;
  favorites: number;
  trash: number;
  kinds: Record<AssetKind, number>;
  projects: FacetRow[];
  workflows: FacetRow[];
  models: FacetRow[];
  tags: FacetRow[];
}

/** Counts for the rail, over the whole library whatever the filters show. */
export function facetsOf(state: Pick<LibraryState, "records" | "landed">): Facets {
  const kinds = Object.fromEntries(ASSET_KINDS.map((kind) => [kind, 0])) as Record<AssetKind, number>;
  const projects = new Map<string, FacetRow>();
  const workflows = new Map<string, FacetRow & { last: number }>();
  const models = new Map<string, FacetRow>();
  const tags = new Map<string, FacetRow>();
  let total = 0;
  let favorites = 0;
  let trash = 0;
  for (const asset of LIBRARY_ASSETS) {
    if (!inLibrary(state, asset)) continue;
    const record = state.records[asset.id];
    if (record.trashed) {
      trash++;
      continue;
    }
    total++;
    if (record.favorite) favorites++;
    kinds[asset.kind]++;
    const project = asset.project ?? "";
    const p = projects.get(project) ?? { value: project, label: projectLabel(asset.project), count: 0, title: asset.project ?? "Not in a project" };
    p.count++;
    projects.set(project, p);
    const w = workflows.get(asset.workflow.id) ?? { value: asset.workflow.id, label: asset.workflow.name, count: 0, last: 0 };
    w.count++;
    w.last = Math.max(w.last, asset.at);
    workflows.set(asset.workflow.id, w);
    if (asset.model) {
      const m = models.get(asset.model.id) ?? { value: asset.model.id, label: asset.model.displayName, count: 0, title: asset.model.displayName };
      m.count++;
      models.set(asset.model.id, m);
    }
    for (const tag of record.tags) {
      const t = tags.get(tag) ?? { value: tag, label: tag, count: 0 };
      t.count++;
      tags.set(tag, t);
    }
  }
  return {
    total,
    favorites,
    trash,
    kinds,
    projects: [...projects.values()].sort((a, b) => (a.value === "" ? 1 : b.value === "" ? -1 : a.label.localeCompare(b.label))),
    workflows: [...workflows.values()].sort((a, b) => b.last - a.last),
    models: [...models.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    tags: [...tags.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

export function hasActiveFilters(filters: Filters): boolean {
  return (
    !!filters.q.trim() ||
    filters.kinds.length > 0 ||
    filters.projects.length > 0 ||
    filters.workflows.length > 0 ||
    filters.models.length > 0 ||
    filters.tags.length > 0 ||
    filters.date !== "any"
  );
}

/** Favorite the lot, or unfavorite it when every one already is. */
export function bulkFavoriteOp(records: Record<string, RecordState>, ids: string[]): BulkOp {
  return { action: ids.length > 0 && ids.every((id) => records[id]?.favorite) ? "unfavorite" : "favorite" };
}

function describe(op: BulkOp, count: number): string {
  const n = formatCount(count);
  switch (op.action) {
    case "trash":
      return `Trashed ${n}`;
    case "restore":
      return `Restored ${n}`;
    case "favorite":
      return `Added ${n} to Favorites`;
    case "unfavorite":
      return `Removed ${n} from Favorites`;
    case "tag":
      return `Tagged ${n}`;
    case "untag":
      return `Untagged ${n}`;
  }
}

function applyOp(record: RecordState, op: BulkOp): RecordState {
  switch (op.action) {
    case "favorite":
      return { ...record, favorite: true };
    case "unfavorite":
      return { ...record, favorite: false };
    case "trash":
      return { ...record, trashed: true };
    case "restore":
      return { ...record, trashed: false };
    case "tag":
      return { ...record, tags: [...record.tags, ...op.tags.filter((tag) => !hasTag(record.tags, tag))] };
    case "untag":
      return { ...record, tags: record.tags.filter((tag) => !hasTag(op.tags, tag)) };
  }
}

type Action =
  | { type: "search"; q: string }
  | { type: "view"; view: LibraryView }
  | { type: "toggleFilter"; list: FilterList; value: string }
  | { type: "filters"; patch: Partial<Filters> }
  | { type: "sort"; sort: SortOrder }
  | { type: "tileSize"; size: TileSize }
  | { type: "selectMode"; on: boolean }
  | { type: "toggleSelect"; id: string }
  | { type: "selectRange"; id: string }
  | { type: "setSelected"; ids: string[]; selected: boolean }
  | { type: "selectAll" }
  | { type: "clearSelection" }
  | { type: "focus"; id: string | null }
  | { type: "openDetail"; id: string }
  | { type: "closeDetail" }
  | { type: "stepDetail"; delta: number }
  | { type: "popover"; popover: Popover | null }
  | { type: "bulk"; ids: string[]; op: BulkOp }
  | { type: "undo" }
  | { type: "notice"; message: string; tone?: "info" | "error" }
  | { type: "dismissNotice" }
  | { type: "arrive"; id: string; atTop: boolean }
  | { type: "showArrivals" }
  | { type: "landAll" }
  | { type: "rail"; open: boolean }
  | { type: "openCanvas"; workflowId: string; assetId?: string }
  | { type: "showAssets" };

function withNotice(state: LibraryState, message: string, tone: "info" | "error" = "info", undo = false): LibraryState {
  const id = state.noticeSeq + 1;
  return { ...state, noticeSeq: id, notice: { id, message, tone, undo } };
}

/** Selection, detail and popovers start over when the list changes under them. */
function refiltered(state: LibraryState, filters: Filters): LibraryState {
  return { ...state, filters, selection: [], anchorId: null, detailId: null, popover: null };
}

function reducer(state: LibraryState, action: Action): LibraryState {
  switch (action.type) {
    case "search":
      return { ...state, filters: { ...state.filters, q: action.q } };
    case "view":
      return refiltered({ ...state, selectMode: false }, { ...state.filters, view: action.view });
    case "toggleFilter": {
      const current = state.filters[action.list];
      const next = current.includes(action.value) ? current.filter((v) => v !== action.value) : [...current, action.value];
      return refiltered(state, { ...state.filters, [action.list]: next });
    }
    case "filters":
      return refiltered(state, { ...state.filters, ...action.patch });
    case "sort":
      return { ...state, sort: action.sort, popover: null };
    case "tileSize":
      return { ...state, tileSize: action.size };
    case "selectMode":
      return { ...state, selectMode: action.on, selection: action.on ? state.selection : [], anchorId: action.on ? state.anchorId : null };
    case "toggleSelect": {
      const selected = state.selection.includes(action.id);
      return {
        ...state,
        selection: selected ? state.selection.filter((id) => id !== action.id) : [...state.selection, action.id],
        anchorId: action.id,
        focusedId: action.id,
      };
    }
    case "selectRange": {
      const ids = listOf(state).map((asset) => asset.id);
      const from = state.anchorId ? ids.indexOf(state.anchorId) : -1;
      const to = ids.indexOf(action.id);
      if (from === -1 || to === -1) return reducer(state, { type: "toggleSelect", id: action.id });
      const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
      return { ...state, selection: [...new Set([...state.selection, ...range])], focusedId: action.id };
    }
    case "setSelected": {
      const rest = state.selection.filter((id) => !action.ids.includes(id));
      return { ...state, selection: action.selected ? [...rest, ...action.ids] : rest };
    }
    case "selectAll":
      return { ...state, selection: listOf(state).map((asset) => asset.id) };
    case "clearSelection":
      return { ...state, selection: [], anchorId: null };
    case "focus":
      return state.focusedId === action.id ? state : { ...state, focusedId: action.id };
    case "openDetail":
      return { ...state, detailId: action.id, focusedId: action.id, popover: null, railOpen: false };
    case "closeDetail":
      return { ...state, detailId: null };
    case "stepDetail": {
      const ids = listOf(state).map((asset) => asset.id);
      const index = state.detailId ? ids.indexOf(state.detailId) : -1;
      const next = ids[index + action.delta];
      return next ? { ...state, detailId: next, focusedId: next } : state;
    }
    case "popover":
      return { ...state, popover: action.popover };
    case "bulk": {
      const ids = action.ids.filter((id) => state.records[id]);
      if (ids.length === 0) return state;
      const before: Record<string, RecordState> = {};
      const records = { ...state.records };
      for (const id of ids) {
        before[id] = state.records[id];
        records[id] = applyOp(state.records[id], action.op);
      }
      const removing = action.op.action === "trash" || action.op.action === "restore";
      const label = describe(action.op, ids.length);
      let next: LibraryState = {
        ...state,
        records,
        undo: [...state.undo, { label, before }].slice(-UNDO_LIMIT),
        popover: state.popover?.kind === "tags" ? state.popover : null,
      };
      // The open detail moves on when its asset leaves the list
      if (state.detailId) {
        const oldIds = listOf(state).map((asset) => asset.id);
        const newIds = listOf(next).map((asset) => asset.id);
        if (!newIds.includes(state.detailId)) {
          const index = oldIds.indexOf(state.detailId);
          const following = oldIds.slice(index + 1).find((id) => newIds.includes(id));
          const preceding = oldIds
            .slice(0, Math.max(0, index))
            .reverse()
            .find((id) => newIds.includes(id));
          const moveTo = following ?? preceding ?? null;
          next = { ...next, detailId: moveTo, focusedId: moveTo };
        }
      }
      if (removing) next = { ...next, selection: next.selection.filter((id) => !ids.includes(id)) };
      return withNotice(next, label, "info", true);
    }
    case "undo": {
      const entry = state.undo[state.undo.length - 1];
      if (!entry) return state;
      return withNotice({ ...state, records: { ...state.records, ...entry.before }, undo: state.undo.slice(0, -1) }, `Undid: ${entry.label}`);
    }
    case "notice":
      return withNotice(state, action.message, action.tone);
    case "dismissNotice":
      return { ...state, notice: null };
    case "arrive":
      if (state.landed.includes(action.id) || state.waiting.includes(action.id)) return state;
      return action.atTop ? { ...state, landed: [...state.landed, action.id] } : { ...state, waiting: [...state.waiting, action.id] };
    case "showArrivals":
      return { ...state, landed: [...state.landed, ...state.waiting], waiting: [] };
    case "landAll":
      return { ...state, landed: ARRIVALS.map((asset) => asset.id), waiting: [] };
    case "rail":
      return { ...state, railOpen: action.open };
    case "openCanvas": {
      const assetId = action.assetId ?? WORKFLOW_HEROES[action.workflowId];
      return {
        ...state,
        appView: "canvas",
        tabs: state.tabs.includes(action.workflowId) ? state.tabs : [...state.tabs, action.workflowId],
        canvas: { workflowId: action.workflowId, assetId },
        detailId: null,
        popover: null,
        railOpen: false,
      };
    }
    case "showAssets":
      return { ...state, appView: "assets" };
  }
}

export interface LibraryActions {
  search: (q: string) => void;
  setView: (view: LibraryView) => void;
  toggleFilter: (list: FilterList, value: string) => void;
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  setSort: (sort: SortOrder) => void;
  setTileSize: (size: TileSize) => void;
  setSelectMode: (on: boolean) => void;
  toggleSelect: (id: string) => void;
  selectRange: (id: string) => void;
  setSelected: (ids: string[], selected: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  focus: (id: string | null) => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  stepDetail: (delta: number) => void;
  openPopover: (popover: Popover) => void;
  closePopover: () => void;
  bulk: (ids: string[], op: BulkOp) => void;
  undo: () => void;
  notify: (message: string, tone?: "info" | "error") => void;
  dismissNotice: () => void;
  arrive: (id: string, atTop: boolean) => void;
  showArrivals: () => void;
  /** Every arrival in at once: the resting state under reduced motion. */
  landAll: () => void;
  setRailOpen: (open: boolean) => void;
  openCanvas: (workflowId: string, assetId?: string) => void;
  showAssets: () => void;
}

interface GridHandlers {
  nav: (direction: GridDirection) => void;
  top: () => void;
}

/** The grid's keyboard movement and scroll, which the view's key handler cannot see: registered while the grid is mounted. */
export interface GridApi {
  register: (handlers: GridHandlers) => () => void;
  navigate: (direction: GridDirection) => void;
  scrollTop: () => void;
}

interface LibraryContextValue {
  state: LibraryState;
  actions: LibraryActions;
  list: LibraryAsset[];
  facets: Facets;
  grid: GridApi;
  reducedMotion: boolean;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibrary outside LibraryProvider");
  return value;
}

export function LibraryProvider({ reducedMotion, children }: { reducedMotion: boolean; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const gridHandlers = useRef<GridHandlers | null>(null);
  const grid = useMemo<GridApi>(
    () => ({
      register: (handlers) => {
        gridHandlers.current = handlers;
        return () => {
          if (gridHandlers.current === handlers) gridHandlers.current = null;
        };
      },
      navigate: (direction) => gridHandlers.current?.nav(direction),
      scrollTop: () => gridHandlers.current?.top(),
    }),
    [],
  );

  const actions = useMemo<LibraryActions>(
    () => ({
      search: (q) => dispatch({ type: "search", q }),
      setView: (view) => dispatch({ type: "view", view }),
      toggleFilter: (list, value) => dispatch({ type: "toggleFilter", list, value }),
      setFilters: (patch) => dispatch({ type: "filters", patch }),
      clearFilters: () => dispatch({ type: "filters", patch: CLEARED }),
      setSort: (sort) => dispatch({ type: "sort", sort }),
      setTileSize: (size) => dispatch({ type: "tileSize", size }),
      setSelectMode: (on) => dispatch({ type: "selectMode", on }),
      toggleSelect: (id) => dispatch({ type: "toggleSelect", id }),
      selectRange: (id) => dispatch({ type: "selectRange", id }),
      setSelected: (ids, selected) => dispatch({ type: "setSelected", ids, selected }),
      selectAll: () => dispatch({ type: "selectAll" }),
      clearSelection: () => dispatch({ type: "clearSelection" }),
      focus: (id) => dispatch({ type: "focus", id }),
      openDetail: (id) => dispatch({ type: "openDetail", id }),
      closeDetail: () => dispatch({ type: "closeDetail" }),
      stepDetail: (delta) => dispatch({ type: "stepDetail", delta }),
      openPopover: (popover) => dispatch({ type: "popover", popover }),
      closePopover: () => dispatch({ type: "popover", popover: null }),
      bulk: (ids, op) => dispatch({ type: "bulk", ids, op }),
      undo: () => dispatch({ type: "undo" }),
      notify: (message, tone) => dispatch({ type: "notice", message, tone }),
      dismissNotice: () => dispatch({ type: "dismissNotice" }),
      arrive: (id, atTop) => dispatch({ type: "arrive", id, atTop }),
      showArrivals: () => dispatch({ type: "showArrivals" }),
      landAll: () => dispatch({ type: "landAll" }),
      setRailOpen: (open) => dispatch({ type: "rail", open }),
      openCanvas: (workflowId, assetId) => dispatch({ type: "openCanvas", workflowId, assetId }),
      showAssets: () => dispatch({ type: "showAssets" }),
    }),
    [],
  );

  const { records, landed, filters, sort } = state;
  const list = useMemo(() => listOf({ records, landed, filters, sort }), [records, landed, filters, sort]);
  const facets = useMemo(() => facetsOf({ records, landed }), [records, landed]);

  const value = useMemo(
    () => ({ state, actions, list, facets, grid, reducedMotion }),
    [state, actions, list, facets, grid, reducedMotion],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

/** The record as the library holds it now. */
export function recordOf(state: LibraryState, id: string): RecordState {
  return state.records[id];
}
