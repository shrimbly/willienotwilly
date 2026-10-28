"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { hasTag, normalizeTag } from "./format";
import { useLibrary, type RecordState } from "./library";
import { MenuSectionLabel, MenuSurface, placeInto, ring } from "./ui";

// Tags (src/components/assets/TagEditor.tsx): chips and a field in the
// detail panel, and a checklist popover for several assets at once.

type TagState = "all" | "some" | "none";

function tagStates(records: RecordState[]): Map<string, TagState> {
  const counts = new Map<string, number>();
  for (const record of records) for (const tag of new Set(record.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const states = new Map<string, TagState>();
  for (const [tag, count] of counts) states.set(tag, count === records.length ? "all" : "some");
  return states;
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.06] pl-2 text-xs text-neutral-200",
        onRemove ? "pr-0.5" : "pr-2",
      )}
    >
      <span className="truncate">{tag}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag}`}
          className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-white/[0.08] hover:text-neutral-100", ring)}
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </span>
  );
}

/** Enter or comma adds what was typed (or the highlighted suggestion); Backspace in an empty field takes the last chip off. */
export function TagInput({
  id,
  tags,
  suggestions,
  onAdd,
  onRemove,
  placeholder = "Add a tag",
}: {
  id: string;
  tags: string[];
  suggestions: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const [focused, setFocused] = useState(false);
  const listId = `nb-assets-tags-${id}`;

  const matches = useMemo(() => {
    const needle = draft.trim().toLowerCase();
    return suggestions.filter((tag) => !hasTag(tags, tag) && (!needle || tag.toLowerCase().includes(needle))).slice(0, 6);
  }, [draft, suggestions, tags]);

  const commit = (raw: string) => {
    const tag = normalizeTag(raw);
    setDraft("");
    setHighlight(-1);
    if (!tag || hasTag(tags, tag)) return;
    onAdd(tag);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(highlight >= 0 && matches[highlight] ? matches[highlight] : draft);
    } else if (event.key === "Backspace" && !draft && tags.length) {
      onRemove(tags[tags.length - 1]);
    } else if (event.key === "ArrowDown" && matches.length) {
      event.preventDefault();
      setHighlight((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp" && matches.length) {
      event.preventDefault();
      setHighlight((i) => (i <= 0 ? matches.length - 1 : i - 1));
    }
  };

  const open = focused && matches.length > 0;

  return (
    <div className="relative">
      <div className="nb-bg-card flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border nb-border-card px-1.5 py-1.5 focus-within:border-neutral-500">
        {tags.map((tag) => (
          <TagChip key={tag} tag={tag} onRemove={() => onRemove(tag)} />
        ))}
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setHighlight(-1);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={tags.length ? "" : placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-6 min-w-[80px] flex-1 bg-transparent px-1 text-[13px] text-neutral-100 outline-none placeholder:text-neutral-500"
        />
      </div>
      {open && (
        <MenuSurface id={listId} role="listbox" className="absolute top-full right-0 left-0 z-10 mt-1 py-1">
          {matches.map((tag, index) => (
            <button
              key={tag}
              type="button"
              role="option"
              aria-selected={index === highlight}
              // Before the input blurs, or the list would be gone
              onMouseDown={(event) => {
                event.preventDefault();
                commit(tag);
              }}
              className={cn(
                "flex h-7 w-full items-center px-2.5 text-left text-xs text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100",
                index === highlight && "bg-neutral-700 text-neutral-100",
              )}
            >
              {tag}
            </button>
          ))}
        </MenuSurface>
      )}
    </div>
  );
}

const POPOVER_WIDTH = 248;

/**
 * Tags for several assets at once: every tag any of them carries, with its
 * state (all ✓, some –, none). A partial or absent tag goes on all of them;
 * a full one comes off all.
 */
export function BulkTagEditor({ ids, x, y, above, layer }: { ids: string[]; x: number; y: number; above?: boolean; layer: HTMLElement | null }) {
  const { state, actions, facets } = useLibrary();
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const records = ids.map((id) => state.records[id]).filter(Boolean);
  const states = tagStates(records);
  const rows = [...states.keys()].sort((a, b) => a.localeCompare(b));
  for (const row of facets.tags) if (!states.has(row.value) && rows.length < 24) rows.push(row.value);

  useLayoutEffect(() => {
    const el = ref.current;
    placeInto(el, layer, x, above && el ? y - el.offsetHeight : y);
  }, [x, y, above, layer, rows.length]);

  useEffect(() => {
    ref.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) actions.closePopover();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [actions]);

  const apply = (tag: string, tagState: TagState) =>
    actions.bulk(ids, tagState === "all" ? { action: "untag", tags: [tag] } : { action: "tag", tags: [tag] });

  return (
    <MenuSurface
      ref={ref}
      role="dialog"
      aria-label="Tags"
      className="nb-drop-in absolute z-50 flex max-h-[300px] flex-col motion-reduce:animate-none"
      style={{ left: x, top: y, width: POPOVER_WIDTH }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        actions.closePopover();
      }}
    >
      <div className="border-b nb-border-chrome p-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const tag = normalizeTag(draft);
            if (tag) apply(tag, "none");
            setDraft("");
          }}
          placeholder="Add a tag to all"
          aria-label="Add a tag to all"
          className="nb-bg-canvas h-7 w-full rounded-md px-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-500"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {rows.length === 0 ? (
          <div className="px-2.5 py-2 text-xs text-neutral-500">No tags yet. Type one above.</div>
        ) : (
          <>
            <MenuSectionLabel className="px-2.5 pt-1.5 pb-1">{records.length > 1 ? `${records.length} assets` : "Tags"}</MenuSectionLabel>
            {rows.map((tag) => {
              const tagState = states.get(tag) ?? "none";
              return (
                <button
                  key={tag}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={tagState === "all" ? true : tagState === "some" ? "mixed" : false}
                  onClick={() => apply(tag, tagState)}
                  className="flex h-7 w-full items-center gap-2 px-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100 focus-visible:bg-neutral-700 focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                      tagState === "none" ? "border-neutral-600" : "border-neutral-200 bg-neutral-200 text-neutral-900",
                    )}
                  >
                    {tagState === "all" && <Check size={10} strokeWidth={3} />}
                    {tagState === "some" && <Minus size={10} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{tag}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </MenuSurface>
  );
}
