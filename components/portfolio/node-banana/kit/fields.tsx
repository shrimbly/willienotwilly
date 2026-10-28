"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
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

export interface SelectWellProps {
  value: string;
  options: ReadonlyArray<SelectOption | string>;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * The node-size dropdown: a well with a 10px chevron, and a menu-surface
 * listbox of 22px rows. The list is mounted on the node (or the demo root),
 * so the controls card's clip never cuts it, and it scales with the canvas.
 */
export function SelectWell({ value, options, onChange, disabled, placeholder, className, ...rest }: SelectWellProps) {
  // Only used while the list is open, which never happens on the server.
  const listId = `nb-list-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const list = normalize(options);
  const selectedIndex = list.findIndex((o) => o.value === value);
  const selected = list[selectedIndex];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<{ host: HTMLElement; style: CSSProperties } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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
    setPlace({
      host,
      style: {
        position: "absolute",
        zIndex: 60,
        left: (t.left - h.left) / scale,
        top: (t.bottom - h.top) / scale + 4,
        minWidth: Math.max(t.width / scale, 160),
        maxWidth: 280,
      },
    });
    setActive(selectedIndex);
    setOpen(true);
  };

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

  useLayoutEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

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
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          "nodrag nb-rounded-well nb-squircle nb-bg-well nb-shadow-well nb-text-node flex h-[22px] w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 pr-[6px] pl-[7px] text-left text-neutral-200 transition-colors hover:enabled:bg-[#1f1f1f] focus:ring-1 focus:ring-neutral-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-1 ring-neutral-600",
        )}
      >
        <span className={cn("min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap", !selected && "text-neutral-500")}>
          {selected ? selected.label : (placeholder ?? "")}
        </span>
        <ChevronDown
          size={10}
          strokeWidth={2.5}
          className={cn("shrink-0 transition-transform duration-150", open ? "rotate-180 text-neutral-300" : "text-neutral-500")}
        />
      </button>
      {open &&
        place &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={rest["aria-label"]}
            className="nodrag nb-menu-surface nb-drop-in nb-font-ui overflow-hidden outline-none"
            style={place.style}
            onKeyDown={onKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="max-h-[240px] overflow-y-auto overscroll-contain py-1">
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

export function NumberField({ label, value, onChange, min, max, step = 0.1, unit, trailing }: NumberFieldProps) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const n = parseFloat(text);
    setText(null);
    if (Number.isNaN(n)) return;
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
  };
  return (
    <Field label={label}>
      <div className="flex min-w-0 items-center gap-1">
        <div className="relative min-w-0 flex-1">
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
          {unit && (
            <span className="nb-text-node pointer-events-none absolute top-1/2 right-[7px] -translate-y-1/2 text-neutral-500">{unit}</span>
          )}
        </div>
        {trailing}
      </div>
    </Field>
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
