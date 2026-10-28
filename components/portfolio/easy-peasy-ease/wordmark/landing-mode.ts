import type { Variants } from "motion/react";

export type LandingMode = "stitch" | "split";

/** The landing's per-mode copy, verbatim from easy-peasy-ease/app/page.tsx. */
export const LANDING_MODE_COPY = {
  stitch: {
    title: "Upload your clips",
    detail: "MP4, WebM — select one or more clips",
    description: "Combine several short clips into a single eased loop.",
  },
  split: {
    title: "Upload one long video",
    detail: "MP4, WebM — we’ll cut it into eased clips",
    description:
      "Chop one long video into equal clips and ease each one — great for beat-synced loops.",
  },
} as const satisfies Record<LandingMode, { title: string; detail: string; description: string }>;

/**
 * The product's validation messages for a drop (processVideosUpload,
 * handleDropZoneDrop). Returns null when the product would accept the files.
 */
export function validateLandingDrop(mode: LandingMode, files: File[]): string | null {
  const videoFiles = files.filter((file) => file.type.startsWith("video/"));
  if (mode === "split") {
    return videoFiles.length === 1 ? null : "Split mode accepts exactly one video file.";
  }
  return videoFiles.length > 0 ? null : "Drop one or more MP4 or WebM video files.";
}

/**
 * The mode swap: incoming copy slides in from the side it is coming from
 * with a 4px blur, outgoing copy leaves the other way (page.tsx
 * modeRevealVariant / modeGroupVariant). `direction` is 1 for split, -1 for stitch.
 */
export function landingModeVariants(reduceMotion: boolean) {
  const exit = (direction: number) =>
    reduceMotion
      ? { opacity: 0, filter: "blur(2px)", transition: { duration: 0.15 } }
      : {
          x: direction * 4,
          opacity: 0,
          filter: "blur(4px)",
          transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const },
        };

  const reveal = {
    hidden: (direction: number) =>
      reduceMotion
        ? { opacity: 0, filter: "blur(2px)" }
        : { x: direction * -4, opacity: 0, filter: "blur(4px)" },
    visible: { x: 0, opacity: 1, filter: "blur(0px)" },
    exit,
  } satisfies Variants;

  const group = { exit } satisfies Variants;

  return { reveal, group };
}
