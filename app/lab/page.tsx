import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lab",
  robots: { index: false, follow: false },
};

type Iteration = {
  slug: string;
  version: string;
  title: string;
  note: string;
};

const ITERATIONS: { project: string; entries: Iteration[] }[] = [
  {
    project: "Life clock",
    entries: [
      {
        slug: "perspective-clock",
        version: "v2",
        title: "Perspective Clock — five UI directions",
        note: "Static studies for the rename and UI rework: the same frozen LIFE view rendered as five different user experiences — annotated plate, almanac, transit line, mission console, and orbital disc.",
      },
      {
        slug: "life-clock",
        version: "v1",
        title: "Life Clock",
        note: "A zoomable monochrome time instrument — one pixel per five seconds of the day, zooming out through week and year to a whole life measured against an estimated span.",
      },
    ],
  },
  {
    project: "Depth clock",
    entries: [
      {
        slug: "depth-clock-v4",
        version: "v4",
        title: "Depth dither clock",
        note: "A depth-map particle clock where each sample becomes animated ordered dither cells with preserved z-depth.",
      },
      {
        slug: "depth-clock-v3",
        version: "v3",
        title: "Depth clock upload",
        note: "Upload an image, generate a Depth Anything V2 map through Comfy Cloud, and rebuild the point-cloud clock from the result.",
      },
      {
        slug: "depth-clock-v2",
        version: "v2",
        title: "Depth point-cloud clock particles",
        note: "A cinematic depth-map particle clock with separate clock particles, fog bands, chromatic depth, and digit-triggered spatial ripples.",
      },
      {
        slug: "depth-clock",
        version: "v1",
        title: "Depth point-cloud clock",
        note: "A depth-map particle field with foreground points pulled forward and a glass clock overlay.",
      },
    ],
  },
  {
    project: "Gradient animation",
    entries: [
      {
        slug: "clock-1",
        version: "clock-1",
        title: "Clock 1",
        note: "A clean landscape glass clock composition without the title, controls, or frame counter.",
      },
      {
        slug: "gradient-ripples-v3",
        version: "v3",
        title: "Chromatic clock",
        note: "A recessed sage shader field with a large seven-segment glass clock over the lower-right corner.",
      },
      {
        slug: "gradient-ripples-v2",
        version: "v2",
        title: "Chromatic field v2",
        note: "A nested-ripple version with fewer origins and layered chromatic waves inside each other.",
      },
      {
        slug: "gradient-ripples",
        version: "v1",
        title: "Chromatic field",
        note: "A customisable Three.js shader sketch with noisy layered gradients and irregular ripple fields.",
      },
    ],
  },
  {
    project: "Pick a colour game",
    entries: [
      {
        slug: "brand-color-game",
        version: "game",
        title: "Pick a color",
        note: "A brand-colour guessing game built on the radial picker, with real logos, timed rounds, medals, and streaks.",
      },
    ],
  },
  {
    project: "Radial color picker",
    entries: [
      {
        slug: "color-picker-v9",
        version: "v9",
        title: "Life-size thumb cursor for desktop demo",
        note: "Replaces the mouse cursor with a PNG of a real thumb so it's easier to evaluate how much of the picker is obstructed by a finger.",
      },
      {
        slug: "color-picker-v8",
        version: "v8",
        title: "Improved touch-interaction visibility",
        note: "Swatches drift outward as the thumb approaches; ribbon thickens and lifts while it's under the thumb — so the layer you're aiming at never hides under your finger.",
      },
      {
        slug: "color-picker-v7",
        version: "v7",
        title: "Third layer: tone plane (L × C)",
        note: "Thick arc beyond the ribbon. Hue locks on entry; tangential picks chroma, radial picks lightness.",
      },
      {
        slug: "color-picker-v6",
        version: "v6",
        title: "Full 360° hue ribbon",
        note: "Ribbon exposes the entire hue wheel including magenta/pink, decoupled from the swatch palette.",
      },
      {
        slug: "color-picker-v5",
        version: "v5",
        title: "Eased swatch entry + ribbon outline preview",
        note: "Swatches scale and fade in on an ease-out. Hovering a swatch shows a white outline of the ribbon shape.",
      },
      {
        slug: "color-picker-v4",
        version: "v4",
        title: "OKLCH ribbon + live FAB preview + tuning panel",
        note: "Smoother gradient in OKLCH. Thumb previews the hovered colour. Sliders for every parameter.",
      },
      {
        slug: "color-picker-v3",
        version: "v3",
        title: "Muted ribbon + blur-in backdrop",
        note: "Ribbon tonality matched to swatch palette. Backdrop tints and blurs in on a soft ease.",
      },
      {
        slug: "color-picker-v2",
        version: "v2",
        title: "Hue ribbon",
        note: "Second layer is a continuous spectrum ribbon. Tighter spacing, soft vignette.",
      },
      {
        slug: "color-picker",
        version: "v1",
        title: "Discrete fine-hue dots",
        note: "Six swatches fan out; pushing further reveals nine discrete hue variations.",
      },
    ],
  },
];

export default function LabIndexPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Lab
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Experiments
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Isolated sketches for refining interaction ideas before they ship.
        </p>

        <div className="mt-12 flex flex-col gap-12">
          {ITERATIONS.map((group) => (
            <section key={group.project}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {group.project}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {group.entries.map((it) => (
                  <li key={it.slug}>
                    <Link
                      href={`/lab/${it.slug}`}
                      className="group flex items-baseline gap-4 rounded-lg border border-foreground/10 bg-background/40 px-4 py-3 transition hover:border-foreground/30 hover:bg-background/70"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {it.version}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">
                          {it.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {it.note}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground transition group-hover:translate-x-0.5">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
