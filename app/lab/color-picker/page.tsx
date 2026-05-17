import type { Metadata } from "next";
import { ColorPickerFab } from "@/components/lab/color-picker-fab";

export const metadata: Metadata = {
  title: "Lab — Color Picker",
  robots: { index: false, follow: false },
};

export default function ColorPickerLabPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-md px-6 pt-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Lab
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Radial color picker
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Press and hold the dot in the bottom-right. Drag your thumb out to a
          colour. Push further to fine-tune the hue. Release to pick.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Best on mobile. Works with a mouse too.
        </p>
      </div>

      <ColorPickerFab />
    </div>
  );
}
