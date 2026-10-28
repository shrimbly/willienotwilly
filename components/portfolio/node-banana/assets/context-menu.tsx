"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Copy, FolderOpen, History, Maximize2, RotateCcw, SquareCheck, Star, Tag, Trash2, Workflow, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { copyPrompt, workflowActions } from "./asset-detail";
import { formatCount } from "./format";
import { ASSETS_BY_ID, bulkFavoriteOp, useLibrary } from "./library";
import { MenuDivider, MenuItem, MenuSectionLabel, MenuShortcut, MenuSurface, placeInto } from "./ui";

// Right-click menu on a tile (src/components/assets/AssetContextMenu.tsx).
// On a tile inside a larger selection it acts on the selection.

const MENU_WIDTH = 248;

interface MenuEntry {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  hint?: string;
  danger?: boolean;
}
type MenuPart = MenuEntry | "divider";

export function AssetContextMenu({ x, y, anchorId, ids, layer }: { x: number; y: number; anchorId: string; ids: string[]; layer: HTMLElement | null }) {
  const { state, actions } = useLibrary();
  const ref = useRef<HTMLDivElement>(null);
  const asset = ASSETS_BY_ID[anchorId];
  const record = state.records[anchorId];
  const view = state.filters.view;
  const many = ids.length > 1;

  const close = () => {
    actions.closePopover();
    requestAnimationFrame(() => layer?.querySelector<HTMLElement>(`[data-asset-tile="${anchorId}"]`)?.focus({ preventScroll: true }));
  };
  const act = (run: () => void) => () => {
    close();
    run();
  };
  const openTags = () => actions.openPopover({ kind: "tags", x, y, ids });
  const removal: MenuPart[] =
    view === "trash"
      ? [
          { key: "restore", label: "Restore", icon: RotateCcw, onSelect: act(() => actions.bulk(ids, { action: "restore" })) },
          { key: "delete", label: "Delete permanently…", icon: Trash2, danger: true, onSelect: () => actions.confirmDelete(ids) },
        ]
      : [{ key: "trash", label: "Trash", icon: Trash2, hint: "⌫", onSelect: act(() => actions.bulk(ids, { action: "trash" })) }];

  const parts: MenuPart[] = many
    ? [
        { key: "tags", label: "Tags…", icon: Tag, onSelect: openTags },
        {
          key: "favorite",
          label: bulkFavoriteOp(state.records, ids).action === "favorite" ? "Favorite" : "Unfavorite",
          icon: Star,
          onSelect: act(() => actions.bulk(ids, bulkFavoriteOp(state.records, ids))),
        },
        "divider",
        ...removal,
        { key: "clear", label: "Clear selection", onSelect: act(actions.clearSelection) },
      ]
    : [
        { key: "open", label: "Open", icon: Maximize2, hint: "↵", onSelect: act(() => actions.openDetail(anchorId)) },
        ...workflowActions(asset).map<MenuEntry>((action) => ({
          key: action.label,
          label: action.label,
          icon: action.secondary ? History : asset.project ? FolderOpen : Workflow,
          onSelect: act(() => actions.openCanvas(asset.workflow.id, asset.id)),
        })),
        "divider",
        ...(asset.prompt ? [{ key: "copy", label: "Copy prompt", icon: Copy, onSelect: act(() => void copyPrompt(asset, actions.notify)) }] : []),
        { key: "tags", label: "Tags…", icon: Tag, onSelect: openTags },
        { key: "favorite", label: record.favorite ? "Unfavorite" : "Favorite", icon: Star, onSelect: act(() => actions.bulk([anchorId], { action: record.favorite ? "unfavorite" : "favorite" })) },
        { key: "select", label: state.selection.includes(anchorId) ? "Deselect" : "Select", icon: SquareCheck, onSelect: act(() => actions.toggleSelect(anchorId)) },
        "divider",
        ...removal,
      ];

  useLayoutEffect(() => placeInto(ref.current, layer, x, y), [x, y, layer, parts.length]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) actions.closePopover();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [actions]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = rows.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % rows.length;
    else if (event.key === "ArrowUp") next = index <= 0 ? rows.length - 1 : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = rows.length - 1;
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close();
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
      aria-label={many ? `${formatCount(ids.length)} selected` : "Asset"}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      className="nb-drop-in absolute z-50 py-1 motion-reduce:animate-none"
      style={{ left: x, top: y, width: MENU_WIDTH }}
    >
      {many && <MenuSectionLabel className="px-2.5 pt-1.5 pb-1">{formatCount(ids.length)} selected</MenuSectionLabel>}
      {parts.map((part, index) => {
        if (part === "divider") return <MenuDivider key={`divider-${index}`} className="my-1" />;
        const Icon = part.icon;
        return (
          <MenuItem key={part.key} role="menuitem" onClick={part.onSelect} className={cn(part.danger && "text-red-400 hover:text-red-300")}>
            {Icon ? <Icon size={14} strokeWidth={1.75} className="shrink-0 text-neutral-400" /> : <span className="w-3.5 shrink-0" />}
            <span className="truncate">{part.label}</span>
            {part.hint && <MenuShortcut>{part.hint}</MenuShortcut>}
          </MenuItem>
        );
      })}
    </MenuSurface>
  );
}
