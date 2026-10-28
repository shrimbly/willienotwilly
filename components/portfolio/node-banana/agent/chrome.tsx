"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { CHROME_ICON_BUTTON, CHROME_ICON_BUTTON_OPEN, CHROME_ICON_BUTTON_SIZE, ClaudeMark, CodexMark, Kbd } from "../kit";

// The agent window's small parts: AgentChrome.tsx (PanelIconButton,
// StatusDot), ui/Tooltip.tsx, HarnessIcon.tsx, ai-elements/shimmer.tsx and the
// radix menus restyled as the app's Menu (ui/Menu.tsx).

/** Lucide icons at the chrome's weight (AGENT_ICON). */
export const AGENT_ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

/** The hover label under an icon-only button: CSS only, 300ms in. Inside a `group/tip relative` wrapper. */
export function Tooltip({
  label,
  shortcut,
  placement = "bottom",
  align = "center",
}: {
  label: string;
  shortcut?: string;
  placement?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const side = placement === "bottom" ? "top-full mt-2.5" : "bottom-full mb-2.5";
  const edge = align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2";
  return (
    <span
      aria-hidden
      className={cn(
        "nb-squircle pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-md border border-white/10 bg-neutral-950 py-1 pr-1.5 pl-2 text-[10px] leading-3 font-medium whitespace-nowrap text-neutral-200 opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-opacity delay-300 duration-[120ms] group-hover/tip:opacity-100 group-has-focus-visible/tip:opacity-100",
        side,
        edge,
        !shortcut && "pr-2",
      )}
    >
      {label}
      {shortcut && <Kbd className="h-[14px] min-w-[14px] text-[9px] text-neutral-400">{shortcut}</Kbd>}
    </span>
  );
}

/** One of the window's 28px icon buttons, with its hover label below (PanelIconButton). */
export function PanelIconButton({
  label,
  shortcut,
  open = false,
  tooltipAlign = "center",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: string;
  open?: boolean;
  tooltipAlign?: "start" | "center" | "end";
}) {
  return (
    <div className="group/tip relative flex">
      <button
        type="button"
        aria-label={label}
        {...rest}
        className={cn(CHROME_ICON_BUTTON, CHROME_ICON_BUTTON_SIZE.sm, open && CHROME_ICON_BUTTON_OPEN, "[&_svg]:size-4", className)}
      >
        {children}
      </button>
      <Tooltip label={label} shortcut={shortcut} align={tooltipAlign} />
    </div>
  );
}

/** A harness's brand mark in colour: Claude's spark, Codex's cloud. */
export function HarnessIcon({ harness, className }: { harness: "claude" | "codex"; className?: string }) {
  return harness === "claude" ? <ClaudeMark className={cn("size-4", className)} /> : <CodexMark className={cn("size-4", className)} />;
}

/** The light band sweeping over ink-3 text (Shimmer); still ink under reduced motion (in the kit's CSS). */
export function Shimmer({ children, duration = 1, className }: { children: string; duration?: number; className?: string }) {
  return (
    <span
      className={cn("nb-text-shimmer relative inline-block", className)}
      style={{ ["--nb-shimmer-chars" as string]: children.length, animationDuration: `${duration}s` } as CSSProperties}
    >
      {children}
    </span>
  );
}

/** A pulsing dot while something runs (ToolStatus). */
export function PingDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative flex size-1.5 shrink-0", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-neutral-300 opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-1.5 rounded-full bg-neutral-300" />
    </span>
  );
}

/* ---------------------------------------------------------------- menus */

const MENU_START: CSSProperties = { position: "absolute", zIndex: 95, top: 0, left: 0, visibility: "hidden" };

/** menuItemClass + the agent's MENU_ROW. */
export const MENU_ROW =
  "relative flex w-full min-h-7 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1 text-left text-xs text-neutral-300 outline-none select-none hover:bg-neutral-700 hover:text-neutral-100 focus-visible:bg-neutral-700 focus-visible:text-neutral-100 disabled:pointer-events-none disabled:opacity-30";

export function MenuSectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("nb-font-mono nb-tracking-eyebrow nb-text-ink-3 text-[10px] leading-[14px] uppercase", className)}>{children}</div>
  );
}

export function RowCheck({ checked }: { checked: boolean }) {
  return checked ? (
    <Check className="size-3.5 shrink-0 text-neutral-200" strokeWidth={2} aria-hidden />
  ) : (
    <span className="size-3.5 shrink-0" aria-hidden />
  );
}

/**
 * A dropdown menu portalled into `host` (the agent window), placed against its
 * trigger and flipped above it when there is no room below. Arrow keys move
 * between the rows; Escape and a press outside close it.
 */
export function Menu({
  open,
  onClose,
  anchor,
  host,
  align = "start",
  side = "bottom",
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  host: RefObject<HTMLElement | null>;
  align?: "start" | "end";
  side?: "bottom" | "top";
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Placed against the trigger before paint (written to the element: no extra render).
  useLayoutEffect(() => {
    const menu = ref.current;
    const a = anchor.current?.getBoundingClientRect();
    const h = host.current?.getBoundingClientRect();
    if (!open || !menu || !a || !h) return;
    const height = menu.offsetHeight;
    const below = h.bottom - a.bottom;
    const up = side === "top" ? a.top - h.top > height + 8 || below < height + 8 : below < height + 8 && a.top - h.top > below;
    menu.style.top = up ? "auto" : `${a.bottom - h.top + 6}px`;
    menu.style.bottom = up ? `${h.bottom - a.top + 6}px` : "auto";
    menu.style.left = align === "end" ? "auto" : `${Math.max(4, a.left - h.left)}px`;
    menu.style.right = align === "end" ? `${Math.max(4, h.right - a.right)}px` : "auto";
    menu.style.visibility = "visible";
  }, [open, anchor, host, align, side]);

  useEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLElement>("[role^='menuitem']:not([disabled])");
    first?.focus({ preventScroll: true });
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return;
      close.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, anchor]);

  if (!open || !host.current) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close.current();
      anchor.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const rows = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role^='menuitem']:not([disabled])") ?? []);
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const next = rows[(at + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length];
    next?.focus({ preventScroll: true });
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("nb-menu-surface nb-drop-in p-1 text-neutral-300", className)}
      style={MENU_START}
    >
      {children}
    </div>,
    host.current,
  );
}
