import { forwardRef, type ButtonHTMLAttributes, type ComponentPropsWithRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

// The pieces of the app's split dialogs (src/components/ui/Dialog.tsx) and
// menus (src/components/ui/Menu.tsx) the Assets view is built from, with the
// app's theme names spelled as .nb tokens.

export const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nb-selection)]";

/** Small mono uppercase label: section eyebrows, status lines, meta. */
export function DialogEyebrow({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...rest} className={cn("nb-font-mono nb-tracking-eyebrow nb-text-ink-3 text-[11px] leading-4 uppercase", className)}>
      {children}
    </span>
  );
}

export function DialogTextButton({ className, type = "button", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type={type}
      className={cn(
        "nb-font-display h-7 rounded px-1.5 text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-100",
        ring,
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

const BUTTON_VARIANT = {
  primary: "bg-neutral-200 text-neutral-900 hover:bg-[#ededed]",
  outline: "border nb-border-card text-neutral-200 hover:border-neutral-600 hover:bg-white/[0.03]",
} as const;

export function DialogButton({
  variant = "outline",
  size = "sm",
  className,
  type = "button",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANT; size?: "sm" | "md" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--nb-selection)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nb-card)] focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "nb-font-display h-9 px-4 text-[13px] font-semibold tracking-[-0.01em]" : "h-8 px-3.5 text-[13px]",
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A 32px search well with the glyph at 11px, for the top of a filter pane. */
export const DialogSearchField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function DialogSearchField(
  { className, ...rest },
  ref,
) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <Search className="pointer-events-none absolute top-2 left-[11px] h-4 w-4 text-neutral-500" strokeWidth={1.75} />
      <input
        ref={ref}
        type="text"
        {...rest}
        className={cn(
          "nb-font-display nb-bg-canvas h-8 w-full rounded-lg border nb-border-card pr-3 pl-[34px] text-[13px] text-neutral-100 placeholder:text-neutral-500",
          "transition-colors focus-visible:border-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-500 focus-visible:outline-none",
        )}
      />
    </div>
  );
});

/** One filter row: 28px, inset to the search icon, a soft fill when it is the current filter. */
export function DialogFilterItem({ active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      className={cn(
        "nb-font-display flex h-7 shrink-0 items-center gap-2.5 rounded-md px-[11px] text-left text-[13px] tracking-[-0.01em] transition-colors",
        ring,
        active ? "bg-white/[0.06] font-semibold text-neutral-100" : "font-medium text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DialogPaneRule({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-px bg-white/[0.06]", className)} />;
}

/* -------------------------------------------------------------------- Menus */

export function MenuSurface({ variant = "list", className, children, ...rest }: ComponentPropsWithRef<"div"> & { variant?: "list" | "bar" }) {
  return (
    <div
      {...rest}
      className={cn(
        "nb-menu-surface",
        variant === "list" ? "min-w-[160px] overflow-hidden outline-none" : "flex items-center gap-1 p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuSectionLabel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("nb-font-mono nb-tracking-eyebrow nb-text-ink-3 text-[10px] leading-[14px] uppercase", className)}>
      {children}
    </div>
  );
}

export const menuItemClass = cn(
  "flex min-h-7 w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors",
  "focus-visible:bg-neutral-700 focus-visible:text-neutral-100 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
  "text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100",
);

export function MenuItem({ className, type = "button", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} type={type} className={cn(menuItemClass, className)}>
      {children}
    </button>
  );
}

export function MenuShortcut({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("nb-font-mono nb-text-ink-3 ml-auto pl-3 text-[11px] whitespace-nowrap", className)}>{children}</span>;
}

export function MenuDivider({ variant = "list", className }: { variant?: "list" | "bar"; className?: string }) {
  return variant === "bar" ? (
    <div aria-hidden className={cn("h-4 w-px bg-neutral-600", className)} />
  ) : (
    <div role="separator" className={cn("border-t nb-border-chrome", className)} />
  );
}

export function MenuBarLabel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border-r border-neutral-600 px-2 text-[10px] font-medium whitespace-nowrap text-neutral-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The quiet 28px surface every header control shares (AssetsHeader's toolClass + quietTool). */
export const toolClass = cn(
  "nb-font-display flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border px-2.5 text-xs font-medium tracking-[-0.01em] transition-colors",
  ring,
);
export const quietTool = "border-white/[0.09] bg-white/[0.03] text-neutral-300 hover:border-white/[0.18] hover:text-neutral-100";

/** Place a popover inside its layer, clamped to the edges now that its size is known. */
export function placeInto(el: HTMLElement | null, layer: HTMLElement | null, x: number, y: number, edge = 8) {
  if (!el) return;
  const w = layer?.clientWidth ?? Infinity;
  const h = layer?.clientHeight ?? Infinity;
  el.style.left = `${Math.max(edge, Math.min(x, w - el.offsetWidth - edge))}px`;
  el.style.top = `${Math.max(edge, Math.min(y, h - el.offsetHeight - edge))}px`;
}
