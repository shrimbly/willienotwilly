import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Ports of easy-peasy-ease/components/ui/label.tsx and field-label.tsx, with a
 * plain <label> in place of Radix Label (same classes).
 */
export const labelClassName =
  "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

export const fieldLabelClassName =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label data-slot="label" className={cn(labelClassName, className)} {...props} />;
}

/** The uppercase micro-label above inspector fields ("SECONDS", "CURVE"). */
export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <Label className={cn(fieldLabelClassName, className)} {...props} />;
}
