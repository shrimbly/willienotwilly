"use client";

import Image from "next/image";
import { AudioLines, ChevronRight, LayoutGrid, List, PanelLeft, PanelLeftClose, Plus, Redo2, Type, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { EDIT_NAME, SOURCES } from "./data";
import { formatTimecode, type EvEdit } from "./model";
import { Tooltip } from "./parts";
import {
  CONTROL_BUTTON,
  EDIT_FIELD,
  EDIT_LINE,
  HEADER_GHOST,
  HEADER_ICON_BUTTON,
  HEADER_OUTLINE,
  HEADER_PRIMARY,
  HEADER_TITLE,
  INK_3,
  MEDIA_PANE_PX,
  PANE,
} from "./styles";
import type { Selection } from "./timeline";

export interface EditHeaderProps {
  compact: boolean;
  paneOpen: boolean | null;
  saved: boolean;
  canUndo: boolean;
  canRedo: boolean;
  rendering: number | null;
  onShowMedia?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onRender: () => void;
  onStopRender: () => void;
}

/**
 * The open edit's header (EditHeader.tsx): Show media while the pane is hidden, "Edits › name" and how saving
 * stands; at the right Undo, Redo and ⋯, then Save and Render. A render in progress takes Save and Render's place
 * with "Rendering N%" and Stop, and fills a line along the header's foot.
 */
export function EditHeader({
  compact,
  paneOpen,
  saved,
  canUndo,
  canRedo,
  rendering,
  onShowMedia,
  onUndo,
  onRedo,
  onSave,
  onRender,
  onStopRender,
}: EditHeaderProps) {
  const percent = rendering === null ? 0 : Math.round(rendering);
  return (
    <div
      className={cn(
        "relative z-20 flex shrink-0 items-center gap-2",
        PANE,
        compact ? "h-12 pr-3 pl-3" : cn("h-14 pr-4", paneOpen ? "pl-5" : "pl-3"),
      )}
    >
      {paneOpen === false && onShowMedia && (
        <div className="group relative flex shrink-0">
          <button type="button" aria-label="Show media" aria-expanded={false} className={HEADER_ICON_BUTTON} onClick={onShowMedia}>
            <PanelLeft size={16} strokeWidth={1.5} />
          </button>
          <Tooltip label="Show media" placement="bottom" align="start" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-center">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
          <span className={cn("-mx-1 shrink-0 rounded-md px-1 py-0.5 text-[13px] leading-4", INK_3)}>Edits</span>
          <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-neutral-600" aria-hidden="true" />
          <span className={cn(HEADER_TITLE, "truncate")} aria-current="page">
            {EDIT_NAME}
          </span>
        </nav>
        <span aria-live="polite" className={cn("ml-3 shrink-0 text-xs leading-4 whitespace-nowrap", INK_3)}>
          {saved ? "Saved" : "Unsaved"}
        </span>
      </div>
      {!compact && (
        <div className="flex shrink-0 items-center gap-0.5">
          <div className="group relative flex">
            <button type="button" aria-label="Undo" disabled={!canUndo} className={HEADER_ICON_BUTTON} onClick={onUndo}>
              <Undo2 size={16} strokeWidth={1.5} />
            </button>
            <Tooltip label="Undo" shortcut="⌘Z" placement="bottom" />
          </div>
          <div className="group relative flex">
            <button type="button" aria-label="Redo" disabled={!canRedo} className={HEADER_ICON_BUTTON} onClick={onRedo}>
              <Redo2 size={16} strokeWidth={1.5} />
            </button>
            <Tooltip label="Redo" shortcut="⇧⌘Z" placement="bottom" />
          </div>
        </div>
      )}
      {rendering !== null ? (
        <div className="ml-2 flex shrink-0 items-center gap-3">
          <span className="w-[104px] text-right text-[13px] whitespace-nowrap text-neutral-300 tabular-nums">{`Rendering ${percent}%`}</span>
          <button type="button" className={HEADER_OUTLINE} onClick={onStopRender}>
            Stop
          </button>
        </div>
      ) : (
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {!compact && (
            <div className="group relative flex">
              <button type="button" className={HEADER_GHOST} disabled={saved} onClick={onSave}>
                Save
              </button>
              <Tooltip label="Save" shortcut="⌘S" placement="bottom" />
            </div>
          )}
          <button type="button" className={HEADER_PRIMARY} onClick={onRender}>
            Render
          </button>
        </div>
      )}
      {rendering !== null && (
        <div
          role="progressbar"
          aria-label="Rendering"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--nb-edit-line)]"
        >
          <div className="nb-ev-progress h-full bg-neutral-100" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

export interface MediaPaneProps {
  edit: EvEdit;
  selection: Selection;
  layout: "list" | "grid";
  onLayout: (layout: "list" | "grid") => void;
  onHide: () => void;
  onPick: (selection: Selection) => void;
  onAddText: () => void;
  onAddTextDisabled: boolean;
}

/**
 * The edit's media (MediaPane.tsx): 264px on the pane, its header with List | Grid, Add media (off: the demo has no
 * asset library), Add text and Hide media, then the videos and sounds the edit uses. A row the selected clip comes
 * from is lit; a press on one selects its clip.
 */
export function MediaPane({ edit, selection, layout, onLayout, onHide, onPick, onAddText, onAddTextDisabled }: MediaPaneProps) {
  const selectedSource =
    selection?.kind === "clip" ? edit.clips.find((c) => c.id === selection.id)?.source : selection?.kind === "audio" ? "audio" : null;
  const items = SOURCES.map((source) => ({
    source,
    clip: edit.clips.find((c) => c.source === source.id) ?? null,
  }));
  const list = layout === "list";
  return (
    <aside aria-label="Media" className={cn("relative flex shrink-0 flex-col border-r", EDIT_LINE, PANE)} style={{ width: MEDIA_PANE_PX }}>
      <div className="flex h-14 shrink-0 items-center gap-0.5 pr-2 pl-4">
        <h2 className="mr-auto text-[13px] font-medium text-neutral-400">Media</h2>
        <div role="group" aria-label="Layout" className="flex shrink-0 items-center gap-0.5">
          {(
            [
              { option: "list", label: "List", Icon: List },
              { option: "grid", label: "Grid", Icon: LayoutGrid },
            ] as const
          ).map(({ option, label, Icon }) => (
            <div key={option} className="group relative flex">
              <button type="button" aria-label={label} aria-pressed={option === layout} onClick={() => onLayout(option)} className={CONTROL_BUTTON}>
                <Icon size={16} strokeWidth={1.5} />
              </button>
              <Tooltip label={label} placement="bottom" />
            </div>
          ))}
        </div>
        <div className="group relative flex shrink-0">
          <button type="button" aria-label="Add media" disabled className={HEADER_ICON_BUTTON}>
            <Plus size={16} strokeWidth={1.5} />
          </button>
          <Tooltip label="The asset library is off" placement="bottom" />
        </div>
        <div className="group relative flex shrink-0">
          <button type="button" aria-label="Add text" disabled={onAddTextDisabled} className={HEADER_ICON_BUTTON} onClick={onAddText}>
            <Type size={16} strokeWidth={1.5} />
          </button>
          <Tooltip label={onAddTextDisabled ? "A text layer is at the playhead" : "Add text"} placement="bottom" />
        </div>
        <div className="group relative flex shrink-0">
          <button
            type="button"
            aria-label="Hide media"
            aria-expanded
            className={cn(HEADER_ICON_BUTTON, "aria-expanded:bg-transparent aria-expanded:text-neutral-400 aria-expanded:hover:bg-white/6 aria-expanded:hover:text-neutral-100")}
            onClick={onHide}
          >
            <PanelLeftClose size={16} strokeWidth={1.5} />
          </button>
          <Tooltip label="Hide media" placement="bottom" align="end" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-1 pb-4">
        <ul className={list ? "flex flex-col gap-0.5" : "grid grid-cols-2 gap-2"}>
          {items.map(({ source, clip }) => {
            const selected = selectedSource === source.id;
            const length = formatTimecode(source.duration, 0);
            const cover = (
              <Image src={source.poster} alt="" fill unoptimized sizes="120px" draggable={false} className="object-cover" />
            );
            const inner = list ? (
              <>
                <span aria-hidden="true" className={cn("relative h-8 w-14 shrink-0 overflow-hidden rounded", EDIT_FIELD)}>
                  {cover}
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-4", selected ? "text-neutral-100" : "text-neutral-300 group-hover/row:text-neutral-100")}>
                  {source.name}
                </span>
                <span className={cn("shrink-0 text-xs tabular-nums", INK_3)}>{length}</span>
              </>
            ) : (
              <span className="flex min-w-0 flex-col gap-1">
                <span aria-hidden="true" className={cn("relative aspect-video w-full overflow-hidden rounded-md", EDIT_FIELD)}>
                  {cover}
                  <span className="absolute bottom-1 left-1 rounded-[4px] bg-black/60 px-1 nb-ev-t10 leading-4 text-neutral-100 tabular-nums">
                    {length}
                  </span>
                </span>
                <span className={cn("truncate text-xs", selected ? "text-neutral-100" : "text-neutral-300")}>{source.name}</span>
              </span>
            );
            return (
              <li
                key={source.id}
                className={cn(
                  "group/row relative flex min-w-0 items-center rounded-md transition-colors",
                  list ? "-mx-2 h-10" : "p-1",
                  selected && "bg-[var(--nb-edit-pressed)]",
                  clip && "hover:bg-[var(--nb-edit-pressed)]",
                )}
              >
                {clip ? (
                  <button
                    type="button"
                    aria-label={`${source.name}, ${formatTimecode(source.duration, 1)}: select its clip`}
                    title={source.name}
                    onClick={() => onPick({ kind: "clip", id: clip.id })}
                    className={cn(
                      "flex h-full min-w-0 flex-1 items-center text-left focus-visible:outline-none",
                      list ? "gap-2.5 pr-2.5 pl-2" : "",
                      "rounded-md focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-inset",
                    )}
                  >
                    {inner}
                  </button>
                ) : (
                  <span title={`${source.name}: not in this edit`} className={cn("flex h-full min-w-0 flex-1 items-center opacity-70", list ? "gap-2.5 pr-2.5 pl-2" : "")}>
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
          <li
            className={cn(
              "group/row relative flex min-w-0 items-center rounded-md transition-colors hover:bg-[var(--nb-edit-pressed)]",
              list ? "-mx-2 h-10" : "col-span-2 h-8 bg-[var(--nb-edit-field)]",
              selectedSource === "audio" && "bg-[var(--nb-edit-pressed)]",
            )}
          >
            <button
              type="button"
              aria-label={`${edit.audio.name}, ${formatTimecode(edit.audio.duration, 1)}: select its clip`}
              onClick={() => onPick({ kind: "audio", id: edit.audio.id })}
              className={cn(
                "flex h-full min-w-0 flex-1 items-center rounded-md text-left focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none focus-visible:ring-inset",
                list ? "gap-2.5 pr-2.5 pl-2" : "gap-2 px-2",
              )}
            >
              {list ? (
                <span aria-hidden="true" className="flex h-8 w-14 shrink-0 items-center justify-center rounded bg-[var(--nb-edit-slot)]">
                  <AudioLines size={14} strokeWidth={1.5} className={INK_3} />
                </span>
              ) : (
                <AudioLines size={14} strokeWidth={1.5} aria-hidden="true" className={cn("shrink-0", INK_3)} />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  list ? "text-[13px] leading-4" : "text-xs",
                  selectedSource === "audio" ? "text-neutral-100" : "text-neutral-300 group-hover/row:text-neutral-100",
                )}
              >
                {edit.audio.name}
              </span>
              <span className={cn("shrink-0 tabular-nums", INK_3, list ? "text-xs" : "nb-ev-t11")}>
                {formatTimecode(edit.audio.duration, 0)}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
