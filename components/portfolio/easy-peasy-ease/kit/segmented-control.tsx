"use client";

import type { ComponentProps } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * Port of easy-peasy-ease/components/ui/segmented-control.tsx (working tree,
 * with indicatorClassName). Radii are spelled in px (product rounded-lg = 12px,
 * rounded-md = 8px) and landing-surface is epe-landing-surface.
 *
 * Landing: <SegmentedControl activeIndex={i} indicatorClassName="bg-(color:--brand-strong)">
 *   with <button aria-pressed className={segmentedControlItemClassName}> items.
 * Inspector tabs (Video / Audio): see inspectorTabsListClassName below.
 *
 * Added: a pressed item sits on the light indicator, where the product's lime
 * focus ring (--ring is --primary) disappears, so its ring is the dark
 * primary-foreground instead.
 */
export const segmentedControlClassName =
  "epe-landing-surface relative isolate inline-grid h-10 grid-cols-2 rounded-[12px] border border-border/70 bg-secondary/40 p-1";

export const segmentedControlItemClassName =
  "relative z-10 inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-transparent px-2 text-sm font-medium text-muted-foreground transition-[color,scale] duration-200 ease-out before:absolute before:inset-x-0 before:inset-y-[-4px] before:content-[''] hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none aria-pressed:text-primary-foreground aria-pressed:focus-visible:ring-(color:--primary-foreground)/60";

/**
 * The FinalVideoEditor inspector tabs are Radix TabsList / TabsTrigger whose
 * own classes cn-merge with the ones above. These are those merged results:
 *   <div role="tablist" className={inspectorTabsListClassName}>
 *     <SegmentedControlIndicator activeIndex={i} className="bg-accent" />
 *     <button role="tab" aria-selected data-state={active ? "active" : "inactive"}
 *       className={inspectorTabClassName}>Video</button> …
 */
export const inspectorTabsListClassName =
  "items-center justify-center text-muted-foreground epe-landing-surface relative isolate inline-grid h-10 grid-cols-2 rounded-[12px] border border-border/70 p-1 mb-2 w-full bg-background/40";

export const inspectorTabClassName =
  "flex-1 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 relative z-10 inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-transparent px-2 text-sm font-medium text-muted-foreground transition-[color,scale] duration-200 ease-out before:absolute before:inset-x-0 before:inset-y-[-4px] before:content-[''] hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset data-[state=active]:bg-transparent data-[state=active]:shadow-none aria-pressed:text-primary-foreground data-[state=active]:text-accent-foreground";

interface SegmentedControlIndicatorProps {
  activeIndex: 0 | 1;
  className?: string;
}

export function SegmentedControlIndicator({ activeIndex, className }: SegmentedControlIndicatorProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.span
      aria-hidden="true"
      initial={false}
      animate={{ x: activeIndex === 0 ? "0%" : "100%" }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { type: "tween", duration: 0.24, ease: "easeOut" }
      }
      className={cn(
        "pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%_-_0.25rem)] rounded-[8px] bg-primary shadow-sm",
        className,
      )}
    />
  );
}

interface SegmentedControlProps extends ComponentProps<"div"> {
  activeIndex: 0 | 1;
  indicatorClassName?: string;
}

export function SegmentedControl({
  activeIndex,
  indicatorClassName,
  className,
  children,
  ...props
}: SegmentedControlProps) {
  return (
    <div className={cn(segmentedControlClassName, className)} {...props}>
      <SegmentedControlIndicator activeIndex={activeIndex} className={indicatorClassName} />
      {children}
    </div>
  );
}
