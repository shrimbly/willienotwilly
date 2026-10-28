import { Caveat, JetBrains_Mono, Space_Grotesk } from "next/font/google";

// Node Banana's own faces (src/app/layout.tsx). App UI text uses the system
// stack; these are for headings (display), eyebrows and meta (mono), and the
// site's handwritten "play with me" hint (hand).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--nb-font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--nb-font-jetbrains-mono",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--nb-font-caveat",
  display: "swap",
  preload: false,
});

/** Class names that define the three font variables; NbRoot applies them. */
export const nbFontVariables = `${spaceGrotesk.variable} ${jetbrainsMono.variable} ${caveat.variable}`;
