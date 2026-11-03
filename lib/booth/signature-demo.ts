// The numbers behind the signature highlight: the website's `.name` (studiovoice/site/index.html),
// which draws the app's 44 pt name at 56 px. The demo's CSS (components/portfolio/booth/
// signature/signature-demo.css) holds the same values in em of the site's 56 px, so the name
// keeps its look at any size.

import { SIGNATURE_LETTERS } from "./signature";

/** The site's drawings of the name, in px at its 56 px size (site/index.html `.name-*`). */
export const SITE_NAME = {
  size: 56,
  /** The resting drawing, and between the clouds, where it is a little sharper. */
  restBlur: 1.3,
  cloudRestBlur: 1.15,
  restAlpha: 0.4,
  /** The mistier drawing the clouds show. */
  mistBlur: 2.25,
  mistAlpha: 0.37,
  /** The drawing under the pointer: most of the blur goes, never all of it. */
  focusBlur: 0.5,
  focusAlpha: 0.5,
} as const;

/** A site px at 56 px, in em, so it scales with the demo's name. */
export const siteEm = (px: number) => px / SITE_NAME.size;

/** What a screen reader hears for the letter the keyboard's focus rests on. */
export function letterLabel(index: number): string {
  const letter = SIGNATURE_LETTERS[index] ?? "";
  return `${letter}, letter ${index + 1} of ${SIGNATURE_LETTERS.length}`;
}

/** The demo's states, as the live region reads them out. */
export const SIGNATURE_STATUS = {
  reveal: "Booth comes forward through fog, letter by letter.",
  over: "A file is over the popover: the whole name sharpens.",
  overGone: "The file has gone: the name is soft again, with mist drifting through it.",
  dropped: "The file was let go. Nothing is read or uploaded; the name is soft again.",
} as const;
