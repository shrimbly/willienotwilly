import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils";

import { geistSerif } from "./fonts";
import "./booth.css";

export type BoothTheme = "light" | "dark";

export interface BoothRootProps extends ComponentPropsWithRef<"div"> {
  /** Theme.swift's palette: light (the default; the portfolio never applies `.dark`) or dark. */
  theme?: BoothTheme;
  /** Holds every CSS loop in place (pass `!active && !reducedMotion` from useDemoActive). */
  paused?: boolean;
}

/**
 * The scope every Booth demo renders inside: Booth's tokens (`--booth-*`, light or dark), the
 * system SF Pro stack at the popover's 13/17 body size, the Geist Serif variable for the
 * signature and a `booth` size container, so `@container booth` queries measure the tile. Fills
 * its positioned parent on the website's paper; override either with className. Forwards ref,
 * role, aria-* and any other div props.
 */
export function BoothRoot({ theme = "light", paused = false, className, children, ...rest }: BoothRootProps) {
  return (
    <div
      data-booth-root
      data-theme={theme}
      data-paused={paused || undefined}
      className={cn("booth absolute inset-0 isolate overflow-hidden bg-(color:--booth-paper)", geistSerif.variable, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
