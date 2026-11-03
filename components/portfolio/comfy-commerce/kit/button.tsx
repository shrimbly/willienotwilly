import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Ported from web/src/components/ui/Button.tsx: the same five variants and two
// sizes, class for class, with the colour utilities on the scoped tokens.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-(--accent) text-(--accent-ink) hover:bg-(--accent-deep) border border-transparent shadow-(--shadow-soft)",
  secondary: "bg-(--surface) text-(--ink) border border-(--line-strong) hover:bg-(--surface-2)",
  ghost: "bg-transparent text-(--ink-soft) hover:text-(--ink) hover:bg-(--surface-2) border border-transparent",
  danger: "bg-transparent text-(--danger) border border-(--line) hover:bg-(--danger-soft)",
  success: "bg-(--success-strong) text-white hover:opacity-90 border border-transparent shadow-(--shadow-soft)",
};

/**
 * What a press looks like on each variant (its hover fill plus the
 * active:scale), for a scripted press in a thumbnail where no pointer is.
 */
const PRESSED: Record<ButtonVariant, string> = {
  primary: "bg-(--accent-deep) scale-[0.98]",
  secondary: "bg-(--surface-2) scale-[0.98]",
  ghost: "text-(--ink) bg-(--surface-2) scale-[0.98]",
  danger: "bg-(--danger-soft) scale-[0.98]",
  success: "opacity-90 scale-[0.98]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2 gap-1",
  md: "h-8 px-3 gap-1",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Draw the pressed state without a pointer (a scripted thumbnail press). */
  pressed?: boolean;
}

/** The product's button: rounded-lg, 14px medium, a 0.98 press, 45% when disabled. */
export function Button({ className, variant = "secondary", size = "md", pressed = false, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-pressed={pressed || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap",
        "cursor-pointer transition-all duration-200 ease-out select-none",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none",
        VARIANTS[variant],
        SIZES[size],
        pressed && PRESSED[variant],
        className,
      )}
      {...props}
    />
  );
}
