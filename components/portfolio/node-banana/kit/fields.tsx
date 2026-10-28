"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { ellipsisClass } from "./controls-card";

// Settings-panel fields, ported from src/components/nodes/ui/Field.tsx and
// Dropdown.tsx: one column, a 22px row, a 72px label and a dark well.

/** The dark well every input sits in. */
export const wellClass =
  "nodrag block h-[22px] w-full min-w-0 px-[7px] nb-rounded-well nb-squircle nb-bg-well nb-shadow-well " +
  "nb-text-node text-neutral-200 placeholder:text-neutral-500 " +
  "focus:outline-none focus:ring-1 focus:ring-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed";

export interface FieldProps {
  label: string;
  /** "label" (default) wraps the control, naming it without ids; "div" when the control names itself. */
  as?: "label" | "div";
  /** Let the row grow (textarea, curve editors). */
  tall?: boolean;
  className?: string;
  children: ReactNode;
}

// Labels wrap their control rather than pointing at an id: useId differs
// between the server render and hydration inside the lazy demo slot.
export function Field({ label, as: Tag = "label", tall, className, children }: FieldProps) {
  return (
    <Tag className={cn("grid grid-cols-[72px_minmax(0,1fr)] gap-x-2", tall ? "items-start" : "h-[22px] items-center", className)}>
      <span className={cn("nb-text-node min-w-0 text-neutral-400", ellipsisClass, tall && "pt-[5px]")}>{label}</span>
      {children}
    </Tag>
  );
}

/** A full-width row without a label column (buttons, chips, editors). */
export function FieldRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex min-h-[22px] items-center gap-1", className)}>{children}</div>;
}

export interface SelectOption {
  value: string;
  label: string;
  /** Mono meta on the right ("2K", "$0.13"). */
  meta?: string;
  icon?: ReactNode;
  group?: string;
  disabled?: boolean;
}

const normalize = (options: ReadonlyArray<SelectOption | string>): SelectOption[] =>
  options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));

/** The list's gap from the trigger, its margin from the tile edges, and its tallest scroll area (host px). */
const LIST_GAP = 4;
const LIST_MARGIN = 6;
const LIST_MAX_H = 240;
/** Never shrink the list below three rows (and its padding) to make it fit. */
const LIST_MIN_H = 3 * 22 + 8;

/** Where the open list sits: host px (the host may be under the canvas zoom), and the room around the trigger. */
interface ListPlace {
  host: HTMLElement;
  scale: number;
  left: number;
  /** The trigger's right edge: a list aligned to the end ends here. */
  right: number;
  /** Top of a list that opens downward. */
  top: number;
  /** Bottom offset of a list that opens upward. */
  bottom: number;
  minWidth: number;
  /** Room between the trigger and the visible edges of the tile, less the gap and margin. */
  room: { above: number; below: number; leftEdge: number; rightEdge: number };
}

/** The client rect left visible by every clipping ancestor of `el` (and the viewport). */
function visibleRect(el: HTMLElement) {
  let top = 0;
  let left = 0;
  let bottom = window.innerHeight;
  let right = window.innerWidth;
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (style.overflowX === "visible" && style.overflowY === "visible") continue;
    const r = n.getBoundingClientRect();
    top = Math.max(top, r.top);
    left = Math.max(left, r.left);
    bottom = Math.min(bottom, r.bottom);
    right = Math.min(right, r.right);
  }
  return { top, left, bottom, right };
}

/**
 * Client px the list keeps clear at the top and bottom of the visible area:
 * the `inset` prop, else `--nb-list-inset-top` / `--nb-list-inset-bottom`
 * (unitless px) set on any ancestor, so a demo whose chrome covers part of
 * the canvas (a run bar, a legend) declares it once for every dropdown in it.
 */
function listInsets(trigger: HTMLElement, inset: SelectWellProps["inset"]) {
  const style = getComputedStyle(trigger);
  const read = (name: string) => parseFloat(style.getPropertyValue(name)) || 0;
  return { top: inset?.top ?? read("--nb-list-inset-top"), bottom: inset?.bottom ?? read("--nb-list-inset-bottom") };
}

export interface SelectWellProps {
  value: string;
  options: ReadonlyArray<SelectOption | string>;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  /** Hover text on the trigger. */
  title?: string;
  /**
   * Replaces the well's content (the value and its chevron), for an icon
   * trigger like the app's Dropdown with a custom trigger. Style it with
   * `triggerClassName`, which then replaces the well's look.
   */
  trigger?: ReactNode;
  triggerClassName?: string;
  /** The list's own name (default: the trigger's aria-label). */
  listLabel?: string;
  /** Line the list up with the trigger's start (default) or end edge. */
  align?: "start" | "end";
  /**
   * Client px at the top or bottom of the visible area the list keeps clear of
   * (a floating bar). Defaults to --nb-list-inset-top / -bottom on an ancestor.
   */
  inset?: { top?: number; bottom?: number };
}

/**
 * The node-size dropdown: a well with a 10px chevron, and a menu-surface
 * listbox of 22px rows. The list is mounted on the node (or the demo root),
 * so the controls card's clip never cuts it, and it scales with the canvas.
 * It opens upward when the tile has more room above the trigger than below,
 * and scrolls when neither side has room for all of it.
 */
export function SelectWell({
  value,
  options,
  onChange,
  disabled,
  placeholder,
  className,
  title,
  trigger: triggerContent,
  triggerClassName,
  listLabel,
  align = "start",
  inset,
  ...rest
}: SelectWellProps) {
  // Only used while the list is open, which never happens on the server.
  const listId = `nb-list-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const list = normalize(options);
  const selectedIndex = list.findIndex((o) => o.value === value);
  const selected = list[selectedIndex];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<ListPlace | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPlace(null);
  }, []);

  const openList = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const host = (trigger.closest("[data-nb-node]") ?? trigger.closest("[data-nb-root]")) as HTMLElement | null;
    if (!host) return;
    // The host may sit under the canvas zoom: measure its scale from its own box.
    const h = host.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    const scale = host.offsetWidth > 0 ? h.width / host.offsetWidth : 1;
    const clip = visibleRect(host);
    const keep = listInsets(trigger, inset);
    setPlace({
      host,
      scale,
      left: (t.left - h.left) / scale,
      right: (t.right - h.left) / scale,
      top: (t.bottom - h.top) / scale + LIST_GAP,
      bottom: host.offsetHeight - (t.top - h.top) / scale + LIST_GAP,
      minWidth: Math.max(t.width / scale, 160),
      room: {
        above: (t.top - clip.top - keep.top) / scale - LIST_GAP - LIST_MARGIN,
        below: (clip.bottom - keep.bottom - t.bottom) / scale - LIST_GAP - LIST_MARGIN,
        leftEdge: (clip.left - h.left) / scale + LIST_MARGIN,
        rightEdge: (clip.right - h.left) / scale - LIST_MARGIN,
      },
    });
    setActive(selectedIndex);
    setOpen(true);
  };

  // Measure the list as first laid out (at its full height) and settle its
  // side, height and horizontal position before it paints. These are written
  // to the element; React's style for it never names them.
  useLayoutEffect(() => {
    const el = listRef.current;
    const scroller = scrollerRef.current;
    if (!place || !el || !scroller) return;
    const { room } = place;
    const height = el.offsetHeight;
    const up = height > room.below && room.above > room.below;
    const space = up ? room.above : room.below;
    // The scroll area sits inside the surface's 1px border.
    if (height > space) scroller.style.maxHeight = `${Math.max(LIST_MIN_H, Math.min(LIST_MAX_H, space - 2))}px`;
    const width = el.offsetWidth;
    const start = align === "end" ? place.right - width : place.left;
    const left = start + width > room.rightEdge ? Math.max(room.leftEdge, room.rightEdge - width) : Math.max(room.leftEdge, start);
    el.style.left = `${left}px`;
    el.style.top = up ? "" : `${place.top}px`;
    el.style.bottom = up ? `${place.bottom}px` : "";
    el.dataset.side = up ? "top" : "bottom";
  }, [place, align]);

  const pick = (o: SelectOption) => {
    if (o.disabled) return;
    onChange(o.value);
    close();
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  // Keep the active option in view by scrolling the list alone: scrollIntoView
  // would also scroll the clipped canvas and the page.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!open || active < 0 || !scroller) return;
    const item = scroller.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!item) return;
    const top = item.offsetTop - scroller.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = bottom - scroller.clientHeight;
  }, [open, active, place]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((a) => {
        let next = a;
        for (let i = 0; i < list.length; i++) {
          next = (next + step + list.length) % list.length;
          if (!list[next].disabled) break;
        }
        return next;
      });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (list[active]) pick(list[active]);
    } else if (event.key === "Tab") {
      close();
    }
  };

  const sections = list.map((o, i) => (o.group && o.group !== list[i - 1]?.group ? o.group : null));

  return (
    <div className={cn("relative min-w-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={rest["aria-label"]}
        title={title}
        data-open={open ? "" : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={
          triggerContent !== undefined
            ? cn("nodrag cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", triggerClassName)
            : cn(
                "nodrag nb-rounded-well nb-squircle nb-bg-well nb-shadow-well nb-text-node flex h-[22px] w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 pr-[6px] pl-[7px] text-left text-neutral-200 transition-colors hover:enabled:bg-[#1f1f1f] focus:ring-1 focus:ring-neutral-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                open && "ring-1 ring-neutral-600",
                triggerClassName,
              )
        }
      >
        {triggerContent !== undefined ? (
          triggerContent
        ) : (
          <>
            <span className={cn("min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap", !selected && "text-neutral-500")}>
              {selected ? selected.label : (placeholder ?? "")}
            </span>
            <ChevronDown
              size={10}
              strokeWidth={2.5}
              className={cn("shrink-0 transition-transform duration-150", open ? "rotate-180 text-neutral-300" : "text-neutral-500")}
            />
          </>
        )}
      </button>
      {open &&
        place &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={listLabel ?? rest["aria-label"]}
            className="nodrag nb-menu-surface nb-drop-in nb-font-ui overflow-hidden outline-none"
            style={{ position: "absolute", zIndex: 60, minWidth: place.minWidth, maxWidth: 280 }}
            onKeyDown={onKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div ref={scrollerRef} className="max-h-[240px] overflow-y-auto overscroll-contain py-1">
              {list.map((o, i) => {
                const section = sections[i];
                return (
                  <div key={o.value || `empty-${i}`}>
                    {section && (
                      <div className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 px-2 pt-1.5 pb-0.5 text-[9px] leading-3 uppercase">
                        {section}
                      </div>
                    )}
                    <div
                      role="option"
                      id={`${listId}-${i}`}
                      data-index={i}
                      aria-selected={o.value === value}
                      aria-disabled={o.disabled || undefined}
                      onMouseEnter={() => !o.disabled && setActive(i)}
                      onClick={() => pick(o)}
                      className={cn(
                        "nb-text-node flex h-[22px] cursor-pointer items-center gap-1.5 px-2 whitespace-nowrap",
                        i === active ? "bg-neutral-700 text-neutral-100" : "text-neutral-300",
                        o.disabled && "cursor-not-allowed opacity-30",
                      )}
                    >
                      {o.icon != null && (
                        <span aria-hidden className="flex w-[10px] shrink-0 justify-center">
                          {o.icon}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis">{o.label}</span>
                      {o.meta != null && <span className="nb-font-mono nb-text-ink-3 text-[9px] whitespace-nowrap">{o.meta}</span>}
                      <span className="flex w-[10px] shrink-0 justify-center">
                        {o.value === value && <Check size={10} strokeWidth={2.5} className="text-neutral-200" />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>,
          place.host,
        )}
    </div>
  );
}

export function SelectField({ label, ...props }: SelectWellProps & { label: string }) {
  return (
    <Field label={label} as="div">
      <SelectWell {...props} aria-label={props["aria-label"] ?? label} />
    </Field>
  );
}

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Short unit inside the well's right edge ("s", "px"). */
  unit?: string;
  trailing?: ReactNode;
}

/** A number well; `trailing` (a mode button) sits after it but outside the label, so its name stays its own. */
export function NumberField({ label, value, onChange, min, max, step = 0.1, unit, trailing }: NumberFieldProps) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const n = parseFloat(text);
    setText(null);
    if (Number.isNaN(n)) return;
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
  };
  const field = (
    <Field label={label} className={trailing != null ? "min-w-0 flex-1" : undefined}>
      <div className="relative min-w-0">
        <input
          type="number"
          value={text ?? String(value)}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(
            wellClass,
            "tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            unit && "pr-6",
          )}
        />
        {unit && <span className="nb-text-node pointer-events-none absolute top-1/2 right-[7px] -translate-y-1/2 text-neutral-500">{unit}</span>}
      </div>
    </Field>
  );
  if (trailing == null) return field;
  return (
    <div className="flex h-[22px] min-w-0 items-center gap-1">
      {field}
      {trailing}
    </div>
  );
}

export interface RangeFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
}

export function RangeField({ label, value, onChange, min, max, step = 1, format }: RangeFieldProps) {
  return (
    <Field label={label}>
      <div className="grid h-[22px] grid-cols-[minmax(0,1fr)_36px] items-center gap-2">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="nodrag h-1 w-full cursor-pointer accent-neutral-300"
        />
        <span className="nb-text-node text-right text-neutral-300 tabular-nums">{format ? format(value) : value}</span>
      </div>
    </Field>
  );
}

export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Field label={label}>
      <div className="flex h-[22px] items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="nodrag h-3 w-3 cursor-pointer accent-neutral-300"
        />
      </div>
    </Field>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

/** Mutually exclusive chips inside a well (mode pickers). */
export function ChipGroup<T extends string>({
  value,
  options,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<ChipOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("nodrag nb-rounded-well nb-squircle nb-bg-well nb-shadow-well flex h-[22px] items-center gap-[2px] p-[2px]", className)}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              "nb-squircle nb-text-node h-full min-w-0 flex-1 rounded-[6px] px-1.5 transition-colors",
              ellipsisClass,
              on ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PanelButton({ className, primary, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "nodrag nb-rounded-well nb-squircle nb-text-node h-[22px] px-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        primary ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600",
        className,
      )}
    />
  );
}
