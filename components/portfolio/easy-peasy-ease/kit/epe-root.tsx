import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { dmMono } from "./fonts";
import "./easy-peasy-ease.css";

/**
 * The Easy Peasy Ease scope. Everything EPE renders inside this element:
 * it carries `dark` (the product is dark-only and its dark: variants must
 * apply), `epe` (the product's tokens, fonts and base styles) and an `epe`
 * container, so kit components respond to the tile's width the way the
 * product responds to the viewport (@min-[640px]/epe: = the product's sm:).
 *
 * Fills its positioned parent by default (absolute inset-0); override with
 * className. Forwards ref, role, aria-* and any other div props.
 */
export function EpeRoot({
  className,
  children,
  mono = "product",
  ...props
}: ComponentProps<"div"> & {
  /** "product" (default): readouts in Helvetica Neue, as the product renders them. */
  mono?: "product" | "dm-mono";
}) {
  return (
    <div
      data-mono={mono}
      className={cn(
        "dark epe @container/epe absolute inset-0 isolate overflow-hidden",
        mono === "dm-mono" && dmMono.variable,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
