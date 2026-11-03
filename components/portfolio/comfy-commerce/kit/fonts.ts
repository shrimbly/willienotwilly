import { Geist } from "next/font/google";

/**
 * Geist, the product's only face (it ships @fontsource-variable/geist as
 * 'Geist Variable'). Variable, so the regular and medium weights the product
 * uses (and the semibold page titles) come from one file. preload is off: the
 * project route is shared by every portfolio page, and only this product's
 * tiles need it. The variable is applied on CcRoot only.
 */
export const geist = Geist({
  variable: "--cc-font-geist",
  subsets: ["latin"],
  preload: false,
});
