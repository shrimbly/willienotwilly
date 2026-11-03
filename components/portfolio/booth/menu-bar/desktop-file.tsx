import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

// A recording on the desktop, as DemoRenderer.swift's `FileIcon` draws the file it carries to
// Booth: its icon over its name, the name on Finder's selection blue while it is selected. The
// app asks macOS for the system's document icon; that artwork is Apple's, so this draws a plain
// page with a folded corner and a few bars of sound in Booth's own ink instead.

/** Finder's selection blue behind the name (DemoRenderer `FileIcon.selectionBlue`). */
const SELECTION_BLUE = "rgb(0 122 255)";

/** The page: 40 × 50 pt with a 12 pt fold, a hairline and a soft shadow. */
function DocumentIcon() {
  return (
    <svg aria-hidden width={40} height={50} viewBox="0 0 40 50" className="block overflow-visible drop-shadow-[0_1px_1.5px_rgb(0_0_0/0.18)]">
      <path d="M4 0.5 H27.5 L39.5 12.5 V45.5 A4 4 0 0 1 35.5 49.5 H4.5 A4 4 0 0 1 0.5 45.5 V4.5 A4 4 0 0 1 4.5 0.5 Z" fill="#fff" stroke="rgb(0 0 0 / 0.16)" />
      <path d="M27.5 0.5 V9.5 A3 3 0 0 0 30.5 12.5 H39.5" fill="rgb(0 0 0 / 0.04)" stroke="rgb(0 0 0 / 0.16)" />
      {/* A few bars of a voice, the waveform's 2 pt bars on a 2 pt gap. */}
      {[5, 9, 14, 8, 12, 6, 3].map((h, i) => (
        <rect key={i} x={10 + i * 3} y={30 - h / 2} width={2} height={h} rx={1} fill="#1d1d1f" />
      ))}
    </svg>
  );
}

export interface DesktopFileProps {
  name: string;
  selected?: boolean;
  /** The see-through copy carried in a drag: no selection, drawn at 70%. */
  ghost?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** The icon over its name, 11 pt medium; selected, the icon on a soft grey and the name on blue. */
export function DesktopFile({ name, selected = false, ghost = false, className, style }: DesktopFileProps) {
  return (
    <span className={cn("flex w-[132px] flex-col items-center gap-[3px] select-none", className)} style={style}>
      <span data-icon className={cn("rounded-[6px] p-[5px] transition-colors duration-150", selected && !ghost ? "bg-black/10" : "bg-transparent")}>
        <DocumentIcon />
      </span>
      {/* Finder wraps a long name onto a second line, each line on its own blue. */}
      <span className="line-clamp-2 max-w-full text-center font-(family-name:--booth-sans) text-[11px] leading-[14px] font-medium [overflow-wrap:anywhere]">
        <span
          className="rounded-[3px] px-1 py-px [box-decoration-break:clone] transition-colors duration-150"
          style={selected && !ghost ? { background: SELECTION_BLUE, color: "#fff" } : { color: "var(--booth-ink)" }}
        >
          {name}
        </span>
      </span>
    </span>
  );
}

/**
 * The pointer that carries the file in the storyline (DemoRenderer draws the system arrow):
 * a plain arrow, black on a white edge, with its hot spot at the tip.
 */
export function DemoCursor({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden width={14} height={21} viewBox="0 0 14 21" className={cn("pointer-events-none absolute top-0 left-0 overflow-visible", className)} style={style}>
      <path
        d="M1 1 V16.2 L4.8 12.6 L7.6 19.2 L10.4 18 L7.7 11.6 H12.9 Z"
        fill="#000"
        stroke="#fff"
        strokeWidth={1.1}
        strokeLinejoin="round"
        className="drop-shadow-[0_1px_1.5px_rgb(0_0_0/0.35)]"
      />
    </svg>
  );
}
