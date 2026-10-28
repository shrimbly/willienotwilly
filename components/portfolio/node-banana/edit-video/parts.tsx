"use client";

import { Fragment, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { KbdGroup } from "../kit";
import { formatTimecode, parseTimecode } from "./model";
import {
  HEADER_TITLE,
  INK_3,
  RAIL_ACTION,
  SEGMENT,
  SEGMENT_OFF,
  SEGMENT_ON,
  SEGMENTS,
  TIMECODE_WELL,
} from "./styles";

// The editor's small parts: the hover label (src/components/ui/Tooltip.tsx), the rail's rows (railParts.tsx) and the
// timecode well (TimecodeField.tsx).

/** The kit's xs cap, at the editor's least size. */
const CAP = "text-[length:max(10px,var(--ev-min-text,0px))]";

/** The hover label: shown after 300ms on hover or keyboard focus of its `group` wrapper. */
export function Tooltip({
  label,
  shortcut,
  placement = "top",
  align = "center",
}: {
  label: string;
  shortcut?: string | readonly string[];
  placement?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const side = placement === "bottom" ? "top-full mt-2.5" : "bottom-full mb-2.5";
  const edge = align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2";
  const keys = shortcut === undefined ? [] : typeof shortcut === "string" ? [shortcut] : shortcut;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-30 flex items-center gap-1.5 whitespace-nowrap rounded-md nb-squircle border border-white/10 bg-neutral-950 py-1 pr-1.5 pl-2 nb-ev-t10 font-medium leading-3 text-neutral-200 opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-opacity delay-300 duration-[120ms] group-hover:opacity-100 group-has-focus-visible:opacity-100",
        side,
        edge,
      )}
    >
      {label}
      {keys.map((shortcut, i) => (
        <Fragment key={shortcut}>
          {i > 0 && <span className="-mx-0.5 text-neutral-500">/</span>}
          <KbdGroup keys={shortcut} capClassName={CAP} />
        </Fragment>
      ))}
    </span>
  );
}

/** What the rail shows: its name in the display face, and a quiet line or two under it. */
export function RailTitle({ title, lines }: { title: string; lines: ReadonlyArray<string> }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className={cn(HEADER_TITLE, "truncate leading-5")}>{title}</span>
      {lines.filter(Boolean).map((line, i) => (
        <span key={i} className={cn("mt-1 truncate text-xs leading-4 tabular-nums", INK_3)}>
          {line}
        </span>
      ))}
    </div>
  );
}

export function RailFields({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-7 grid auto-cols-fr grid-flow-col gap-2", className)}>{children}</div>;
}

export function RailField({
  label,
  hint,
  shortcut,
  last,
  children,
}: {
  label: string;
  hint?: string;
  shortcut?: string | readonly string[];
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="group relative flex min-w-0 flex-col">
      <span className={cn("mb-1.5 text-xs leading-3", INK_3)}>{label}</span>
      {children}
      {hint && <Tooltip label={hint} shortcut={shortcut} placement="top" align={last ? "end" : "start"} />}
    </label>
  );
}

export function RailNote({ children }: { children: ReactNode }) {
  return <p className={cn("mt-2 text-xs leading-4", INK_3)}>{children}</p>;
}

export function RailLabel({ children }: { children: ReactNode }) {
  return <div className={cn("mb-1.5 text-xs leading-3", INK_3)}>{children}</div>;
}

/** 32×18: a white track with a dark knob when on, a dark grey one with a grey knob when off. */
export function RailSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[18px] w-8 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-neutral-100" : "bg-[var(--nb-edit-switch-off)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 left-0 h-3.5 w-3.5 rounded-full transition-transform motion-reduce:transition-none",
          checked ? "translate-x-4 bg-[var(--nb-pane)]" : "translate-x-0.5 bg-[var(--nb-ink-3)]",
        )}
      />
    </button>
  );
}

export function RailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between gap-3">
      <span className="text-[13px] text-neutral-300">{label}</span>
      {children}
    </div>
  );
}

export function RailSlider({
  label,
  ariaLabel,
  value,
  disabled,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex h-8 items-center gap-3">
      <span className="w-[52px] shrink-0 text-[13px] text-neutral-300">{label}</span>
      <input
        type="range"
        aria-label={ariaLabel}
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="nb-ev-range min-w-0 flex-1"
        style={{ "--p": `${value}%` } as CSSProperties}
      />
      <span className={cn("w-9 shrink-0 text-right text-xs tabular-nums", INK_3)}>{`${value}%`}</span>
    </div>
  );
}

export interface RailSegment {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

/**
 * One Tab stop for a row (or grid) of buttons: ←/→ move to the next enabled one, ↑/↓ a row of `columns` (a row on its
 * own: the next one), Home/End the ends; a press picks. The stop is the button focus last moved to while it is inside
 * the group, else `preferred` (the pressed one).
 */
export function useRovingStop(preferred: number, columns = 1) {
  const [focused, setFocused] = useState<number | null>(null);
  const buttons = (group: HTMLElement) => Array.from(group.querySelectorAll<HTMLButtonElement>("button"));
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const at = buttons(event.currentTarget).indexOf(event.target as HTMLButtonElement);
    if (at >= 0) setFocused(at);
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const all = buttons(event.currentTarget);
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const open = all.map((button, i) => (button.disabled ? -1 : i)).filter((i) => i >= 0);
    if (at === -1 || !open.length) return;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    let next: number | undefined;
    if (event.key === "Home") next = open[0];
    else if (event.key === "End") next = open[open.length - 1];
    else if (event.key in step) {
      const by = step[event.key];
      next = by > 0 ? open.find((i) => i >= at + by) : open.findLast((i) => i <= at + by);
      next ??= at;
    } else return;
    event.preventDefault();
    all[next].focus();
  };
  return { stop: focused ?? preferred, groupProps: { onFocus, onBlur, onKeyDown } };
}

export function RailSegments({
  label,
  segments,
  className,
}: {
  label: string;
  segments: ReadonlyArray<RailSegment>;
  className?: string;
}) {
  const pressed = segments.findIndex((segment) => segment.pressed && !segment.disabled);
  const { stop, groupProps } = useRovingStop(pressed >= 0 ? pressed : Math.max(0, segments.findIndex((segment) => !segment.disabled)));
  return (
    <div role="group" aria-label={label} className={cn(SEGMENTS, className)} {...groupProps}>
      {segments.map((segment, i) => (
        <button
          key={segment.label}
          type="button"
          aria-pressed={segment.pressed}
          disabled={segment.disabled}
          title={segment.title}
          tabIndex={i === stop ? 0 : -1}
          onClick={segment.onClick}
          className={cn(SEGMENT, segment.pressed ? SEGMENT_ON : SEGMENT_OFF)}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}

export function RailAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className={RAIL_ACTION} onClick={onClick}>
      <span className={cn("flex shrink-0 [&_svg]:size-4", INK_3)}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

/**
 * A timecode well (TimecodeField.tsx): shows the value formatted; typing commits on Enter or blur, Escape puts it
 * back, ↑/↓ nudge (⇧ further) when the caller takes nudges.
 */
export function TimecodeField({
  label,
  value,
  format = formatTimecode,
  parse = parseTimecode,
  disabled,
  readOnly,
  onCommit,
  onNudge,
  className,
}: {
  label: string;
  value: number;
  format?: (value: number) => string;
  parse?: (text: string) => number | null;
  disabled?: boolean;
  readOnly?: boolean;
  onCommit?: (value: number) => void;
  onNudge?: (dir: 1 | -1, big: boolean) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? format(value);
  const commit = () => {
    if (draft === null) return;
    const parsed = parse(draft);
    setDraft(null);
    if (parsed !== null && onCommit) onCommit(parsed);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      setDraft(null);
    } else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && onNudge) {
      event.preventDefault();
      setDraft(null);
      onNudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
    }
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={shown}
      disabled={disabled}
      readOnly={readOnly || !onCommit}
      spellCheck={false}
      autoComplete="off"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(TIMECODE_WELL, className)}
    />
  );
}
