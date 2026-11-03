import localFont from "next/font/local";

/**
 * Geist Serif Regular, the one face Booth bundles (studiovoice/site/assets and
 * app/Resources/Fonts), used for the "Booth" signature only. It isn't on Google Fonts, so the
 * file and its OFL licence (GeistSerif-OFL.txt) sit beside this module. Not preloaded: the
 * project route is shared by every portfolio page. BoothRoot applies the variable.
 *
 * The UI face is SF Pro through the system stack, as Booth's site sets it: nothing to load.
 */
export const geistSerif = localFont({
  src: "./GeistSerif-Regular.ttf",
  weight: "400",
  style: "normal",
  variable: "--booth-font-serif",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});
