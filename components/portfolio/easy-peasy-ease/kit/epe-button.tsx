import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Port of easy-peasy-ease/components/ui/button.tsx. Only the radius changes:
 * the product's rounded-md is 8px, which the portfolio theme would render at
 * 6px, so it is spelled rounded-[8px]. Needs the EpeRoot (dark) ancestor for
 * the outline variant's dark: classes.
 *
 * The product's brand CTA ("Update All Clips"):
 *   <EpeButton size="sm" className="bg-(color:--brand-strong) hover:bg-(color:--brand-strong)/90" />
 */
export const epeButtonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-medium transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-out after:absolute after:content-[''] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 after:inset-x-0 after:inset-y-[-2px] has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 after:inset-x-0 after:inset-y-[-4px] has-[>svg]:px-2.5",
        lg: "h-10 px-6 after:inset-0 has-[>svg]:px-4",
        icon: "size-9 after:-inset-0.5",
        "icon-sm": "size-8 after:-inset-1",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function EpeButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof epeButtonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(epeButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
