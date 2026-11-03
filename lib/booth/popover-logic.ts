// The popover's screens, frame styles and menu bar glyph modes as pure functions, ported from
// studiovoice/app/Sources/BoothCore/PopoverLogic.swift (Main.dc.html's view logic) and the
// geometry in Shell/GlyphRenderer.swift and UI/PopoverRootView.swift.

/** The popover screens a demo can show (the app also has first run, Settings and Error). */
export type BoothScreen = "idle" | "working" | "done";

/** Menu bar icon states (Glyph.dc.html, brand "booth"). */
export type GlyphMode = "idle" | "target" | "working" | "done" | "attention";

/** The border around the popover's inner frame. */
export type FrameStyle = "none" | "dotted" | "dropTarget";

/** The signature belongs to the drop zone (and setup) only. */
export function showsSignature(screen: BoothScreen): boolean {
  return screen === "idle";
}

/** The gear sits on the drop zone (and setup). Working is all progress bar. */
export function showsGear(screen: BoothScreen): boolean {
  return screen === "idle";
}

/** The dotted outline marks the drop zone; any screen shows the drop-target outline under a file. */
export function frameStyle(screen: BoothScreen, dropHover: boolean): FrameStyle {
  if (dropHover) return "dropTarget";
  return screen === "idle" ? "dotted" : "none";
}

/** The menu bar icon's state: a file over it, else a job in the booth, else one finished unseen. */
export function glyphMode({
  iconTarget = false,
  attention = false,
  isOpen = false,
  working = false,
  unseen = false,
}: {
  iconTarget?: boolean;
  attention?: boolean;
  isOpen?: boolean;
  working?: boolean;
  unseen?: boolean;
}): GlyphMode {
  if (iconTarget) return "target";
  if (attention && !isOpen) return "attention";
  if (working) return "working";
  if (unseen) return "done";
  return "idle";
}

/** The screen the popover opens on (`viewOnOpen`), for the screens a demo has. */
export function screenOnOpen({ working = false, unseen = false, done = false }: { working?: boolean; unseen?: boolean; done?: boolean }): BoothScreen {
  if (working) return "working";
  if (unseen || done) return "done";
  return "idle";
}

/** The popover's sizes in points (PopoverRootView.swift, DoneScreen.swift). */
export const POPOVER = {
  width: 320,
  /** The panel's 6 pt padding plus its 0.5 pt border; 4 pt (+0.5) while a file is in the booth. */
  panelInset: 6.5,
  workingPanelInset: 4.5,
  borderWidth: 0.5,
  cornerRadius: 14,
  /** The inner frame: radius 10, a 1.5 pt border, at least 156 pt tall on the drop zone. */
  frameRadius: 10,
  frameBorder: 1.5,
  idleMinHeight: 156,
  /** CSS `dotted` at 1.5 pt: dots on a 3 pt pitch, adjusted so they close evenly round the corners. */
  dotPitch: 3,
  /** The content's insets inside the frame; the bottom leaves room for the signature or footer. */
  contentInsets: { top: 13, side: 15, bottom: { idle: 13, done: 14, working: 0 } },
  /** 307 pt less 2 × (1.5 pt border + 15 pt padding). */
  contentWidth: 274,
  /** The signature sits 16 pt in and 2 pt up from the frame's bottom left, at 44 pt. */
  signature: { left: 16, bottom: 2, size: 44 },
} as const;

/** The 18-unit menu bar glyph (GlyphRenderer.swift), y down, so the numbers match the SVG. */
export const GLYPH = {
  size: 18,
  frame: { x: 3.25, y: 2.25, width: 11.5, height: 13.5, radius: 3.6 },
  lamp: { cx: 9, cy: 7.2, r: 2.1 },
  /** The idle and attention lamp is a ring. */
  ring: { r: 1.85, stroke: 1.3 },
  attentionDot: { cx: 15.2, cy: 3, r: 2.6 },
  stroke: 1.5,
  targetStroke: 1.8,
  /** The working lamp breathes once per 1.4 s: `0.5 + 0.5·sin(2π·phase)`. */
  breathSeconds: 1.4,
  /** The working lamp, the only colour Booth shows in the menu bar. */
  work: "#0A84FF",
  /** The menu bar button behind it under a file (GlyphStates.dc.html): 32 × 22, radius 6. */
  button: { width: 32, height: 22, radius: 6 },
} as const;

/** The working lamp's breath, 0…1, at `phase` (0…1) through a 1.4 s cycle. */
export function breathe(phase: number): number {
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * phase);
}
