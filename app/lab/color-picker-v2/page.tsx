import type { Metadata } from "next";
import { ColorPickerFabV2 } from "@/components/lab/color-picker-fab-v2";

export const metadata: Metadata = {
  title: "Lab — Color Picker v2",
  robots: { index: false, follow: false },
};

export default function ColorPickerV2LabPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-md px-6 pt-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Lab · v2
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Radial color picker
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Press and hold the dot. Drag to a swatch for a preset, or push past
          the ring to reveal the full hue ribbon. Release to pick.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Best on mobile. Works with a mouse too.
        </p>
      </div>

      <ColorPickerFabV2 />
    </div>
  );
}
