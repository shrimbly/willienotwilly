"use client";

import { useRef, type Ref } from "react";
import { RotateCcw, Star, Tag, Trash2, X, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatNumber } from "./format";
import { bulkFavoriteOp, useLibrary } from "./library";
import { MenuBarLabel, MenuDivider, MenuSurface, ring } from "./ui";

// The selection's actions, bottom-centre (src/components/assets/BulkBar.tsx):
// count, Tags…, Favorite, Trash, Clear; Restore and Delete permanently… in
// the Trash. Labels fold into icons in a narrow tile.

function BarButton({
  icon: Icon,
  label,
  onClick,
  danger,
  iconOnly,
  buttonRef,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  iconOnly?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100",
        ring,
        danger && "text-red-400 hover:text-red-300",
        iconOnly && "w-7 justify-center px-0",
      )}
    >
      <Icon size={14} strokeWidth={1.75} />
      {!iconOnly && <span className="hidden @[560px]:inline">{label}</span>}
    </button>
  );
}

export function BulkBar({ layer }: { layer: HTMLElement | null }) {
  const { state, actions } = useLibrary();
  const tagsButton = useRef<HTMLButtonElement>(null);
  const { selection, filters } = state;
  if (selection.length === 0) return null;
  const favorite = bulkFavoriteOp(state.records, selection);

  const openTags = () => {
    const rect = tagsButton.current?.getBoundingClientRect();
    const origin = layer?.getBoundingClientRect();
    actions.openPopover({ kind: "tags", x: (rect?.left ?? 0) - (origin?.left ?? 0), y: (rect?.top ?? 0) - (origin?.top ?? 0) - 8, ids: selection, above: true });
  };

  return (
    <MenuSurface variant="bar" role="toolbar" aria-label="Selected assets" className="nb-drop-in pointer-events-auto motion-reduce:animate-none">
      <MenuBarLabel className="py-1 text-[11px]">{formatNumber(selection.length)} selected</MenuBarLabel>
      {filters.view === "trash" ? (
        <>
          <BarButton icon={RotateCcw} label="Restore" onClick={() => actions.bulk(selection, { action: "restore" })} />
          <BarButton icon={Trash2} label="Delete permanently…" danger onClick={() => actions.confirmDelete(selection)} />
        </>
      ) : (
        <>
          <BarButton icon={Tag} label="Tags…" onClick={openTags} buttonRef={tagsButton} />
          <BarButton icon={Star} label={favorite.action === "favorite" ? "Favorite" : "Unfavorite"} onClick={() => actions.bulk(selection, favorite)} />
          <MenuDivider variant="bar" className="mx-0.5" />
          <BarButton icon={Trash2} label="Trash" onClick={() => actions.bulk(selection, { action: "trash" })} />
        </>
      )}
      <MenuDivider variant="bar" className="mx-0.5" />
      <BarButton icon={X} label="Clear selection" iconOnly onClick={actions.clearSelection} />
    </MenuSurface>
  );
}
