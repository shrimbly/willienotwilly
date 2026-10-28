import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils";

import { nbFontVariables } from "./fonts";
import "./node-banana.css";

export type NbRootProps = ComponentPropsWithRef<"div">;

/**
 * The scope every Node Banana demo renders inside: the .nb tokens, the
 * app's fonts, dark color-scheme and the canvas ground. Fills the demo frame
 * and is a size container, so `@md:`-style variants inside it measure the tile.
 */
export function NbRoot({ className, children, ...rest }: NbRootProps) {
  return (
    <div data-nb-root className={cn("nb absolute inset-0", nbFontVariables, className)} {...rest}>
      {children}
    </div>
  );
}
