import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { geist } from "./fonts";
import "./comfy-commerce.css";

/**
 * The Comfy Commerce scope. Everything a Comfy Commerce tile renders sits in
 * this element: it carries `cc` (the product's light tokens, Geist, the
 * squircle radius scale and its base styles) and a size container named `cc`,
 * so tiles respond to their own size the way the product responds to its
 * window (@min-[880px]/cc:, and cqw/cqh maths).
 *
 * Fills its positioned parent (absolute inset-0); override with className.
 * `backdrop` (default on) paints the app's mesh-and-grain canvas (.app-bg).
 * `paused` sets data-paused, which holds every CSS animation inside (the
 * spinner, the publishing dot): pass `!active && !reducedMotion`.
 * Forwards ref, role, aria-* and any other div props.
 */
export function CcRoot({
  className,
  children,
  backdrop = true,
  paused = false,
  ...props
}: ComponentProps<"div"> & {
  backdrop?: boolean;
  paused?: boolean;
}) {
  return (
    <div
      data-paused={paused || undefined}
      className={cn("cc absolute inset-0 isolate overflow-hidden", backdrop && "cc-app-bg", geist.variable, className)}
      {...props}
    >
      {children}
    </div>
  );
}
