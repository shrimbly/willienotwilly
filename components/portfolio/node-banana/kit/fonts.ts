import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

// Node Banana's own faces (src/app/layout.tsx). App UI text uses the system
// stack; these are for headings (display) and for eyebrows and meta (mono).
// Neither is preloaded: the project route is shared by every portfolio page,
// and preloading would fetch them on pages that never show a Node Banana demo.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--nb-font-space-grotesk",
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--nb-font-jetbrains-mono",
  display: "swap",
  preload: false,
});

/** Class names that define the two font variables; NbRoot applies them. */
export const nbFontVariables = `${spaceGrotesk.variable} ${jetbrainsMono.variable}`;
