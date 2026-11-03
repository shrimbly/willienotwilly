import type { ReactNode } from "react";

// Booth's icons from studiovoice/app/Sources/Booth/UI/Icons.swift: the same SVG path strings in
// the same view boxes, stroked with round caps and joins at the same widths.

type IconDef = { viewBox: number; paint: "fill" } | { viewBox: number; paint: "stroke"; width: number };

const ICONS = {
  /** Lucide "settings" (classic), stroke 2. */
  gear: {
    viewBox: 24,
    paint: "stroke",
    width: 2,
    body: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  /** Settings' back chevron, stroke 1.8. */
  back: { viewBox: 18, paint: "stroke", width: 1.8, body: <path d="M11 4 L6 9 L11 14" /> },
  /** The dismiss cross, stroke 1.6. */
  close: { viewBox: 16, paint: "stroke", width: 1.6, body: <path d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5" /> },
  /** Lucide "film", stroke 2.2 so it reads as heavy as the gear at chip size. */
  film: {
    viewBox: 24,
    paint: "stroke",
    width: 2.2,
    body: (
      <>
        <path d="M7 3v18 M3 7.5h4 M3 12h18 M3 16.5h4 M17 3v18 M17 7.5h4 M17 16.5h4" />
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </>
    ),
  },
  /** Lucide "sliders-horizontal", stroke 2.2. */
  sliders: {
    viewBox: 24,
    paint: "stroke",
    width: 2.2,
    body: <path d="M21 4H14 M10 4H3 M21 12H12 M8 12H3 M21 20H16 M12 20H3 M14 2V6 M8 10V14 M16 18V22" />,
  },
  /** The Finder face: a rounded square split by the profile's nose, two eyes and a smile. */
  finder: {
    viewBox: 24,
    paint: "stroke",
    width: 2,
    body: (
      <>
        <path d="M12.5 3 C 11.2 6.5 10.2 9.5 10.4 13 L 12.4 13 C 12.2 16 12.5 18.5 13 21 M8 8.5 V10 M16 8.5 V10 M7.5 15.5 C 10 17.6 14 17.6 16.5 15.5" />
        <rect x="3" y="3" width="18" height="18" rx="4" />
      </>
    ),
  },
  play: { viewBox: 14, paint: "fill", body: <path d="M4.5 2.6 L11.5 7 L4.5 11.4 Z" /> },
  pause: {
    viewBox: 14,
    paint: "fill",
    body: (
      <>
        <rect x="3" y="2.5" width="3" height="9" rx="1" />
        <rect x="8" y="2.5" width="3" height="9" rx="1" />
      </>
    ),
  },
} satisfies Record<string, IconDef & { body: ReactNode }>;

export type BoothIconName = keyof typeof ICONS;

/**
 * One of Booth's icons at `size` points in the current colour (Icons.swift `IconView`).
 * Decorative: the control around it carries the label.
 */
export function BoothIcon({ name, size, className }: { name: BoothIconName; size: number; className?: string }) {
  const icon: IconDef & { body: ReactNode } = ICONS[name];
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox={`0 0 ${icon.viewBox} ${icon.viewBox}`}
      className={className}
      fill={icon.paint === "fill" ? "currentColor" : "none"}
      stroke={icon.paint === "stroke" ? "currentColor" : undefined}
      strokeWidth={icon.paint === "stroke" ? icon.width : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon.body}
    </svg>
  );
}
