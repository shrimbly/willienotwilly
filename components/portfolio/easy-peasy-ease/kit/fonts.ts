import { DM_Mono } from "next/font/google";

/**
 * DM Mono, the face the product's font-mono token names. The shipped product
 * actually renders those readouts in Helvetica Neue (see easy-peasy-ease.css),
 * so this is opt-in: <EpeRoot mono="dm-mono">. preload is off so the file is
 * only fetched when a scope opts in. The UI sans is the system
 * "Helvetica Neue", Helvetica stack; nothing to load for it.
 */
export const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  preload: false,
});

/** Variable-weight face for TextPressure: the portfolio's already-loaded Inter. */
export const EPE_WORDMARK_FONT = "var(--font-inter)";
