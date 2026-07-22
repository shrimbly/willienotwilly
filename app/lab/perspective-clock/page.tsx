import type { Metadata } from "next";
import Link from "next/link";

import { DATA } from "@/components/lab/perspective-clock/static-data";

// Index for the five static UI-direction studies of the Perspective Clock
// (the Life Clock, renamed). Each study renders the same frozen LIFE-view
// dataset — same events, places, telemetry — as a different user experience.

export const metadata: Metadata = {
  title: "Perspective Clock — UI directions",
  robots: { index: false, follow: false },
};

const DIRECTIONS = [
  {
    slug: "observatory",
    title: "Observatory Plate",
    thesis:
      "The instrument, fully annotated. Nothing hides behind hover — every moment is pinned by a leader line to the margins: recorded facts left, projected arithmetic right.",
  },
  {
    slug: "almanac",
    title: "The Almanac",
    thesis:
      "A document, not an instrument. Life typeset as a civil register read top to bottom — decades as chapters, years as punch-card lines, events as ledger entries, now as the registrar's red mark.",
  },
  {
    slug: "transit",
    title: "Transit",
    thesis:
      "Time as a route. One horizontal band runs birth to estimate, residences as the coloured substrate, the NOW cursor slicing the viewport, and every moment on a departures board below.",
  },
  {
    slug: "console",
    title: "Mission Console",
    thesis:
      "Triage over monument. An amber-phosphor bento of instruments — big numbers first, futures as countdowns, the past as a log, the grid one card among equals.",
  },
  {
    slug: "orbit",
    title: "Orbit",
    thesis:
      "One held image. A cyanotype disc — one ring per year, birth at the centre, the estimate at the rim — with every moment plotted at its polar position and keyed to a legend.",
  },
];

export default function PerspectiveClockIndex() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#060707",
        color: "#DDE2E0",
        fontFamily: "var(--font-geist-mono)",
      }}
    >
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.14em]"
          style={{ color: "#7A827F" }}
        >
          LAB · LIFE CLOCK → PERSPECTIVE CLOCK
        </p>
        <h1 className="mt-3 text-2xl tracking-[0.08em]">
          FIVE WAYS TO SHOW A LIFE
        </h1>
        <p
          className="mt-4 text-[13px] leading-relaxed"
          style={{ color: "#7A827F" }}
        >
          Static studies of the LIFE view — same frozen dataset ({DATA.weekday}{" "}
          {DATA.dateStr}, {DATA.clock}, age {DATA.ageYears.toFixed(2)} of{" "}
          {DATA.expectancyYears.toFixed(2)}), five different user experiences.
          No interaction, no hover; every UI element is present on each page.
        </p>

        <ol className="mt-12 flex flex-col gap-6">
          {DIRECTIONS.map((d, i) => (
            <li key={d.slug}>
              <Link
                href={`/lab/perspective-clock/${d.slug}`}
                className="block border p-5"
                style={{ borderColor: "rgba(255,255,255,0.14)" }}
              >
                <div className="flex items-baseline gap-4">
                  <span className="text-[11px]" style={{ color: "#464B4A" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[13px] font-medium tracking-[0.1em] uppercase">
                    {d.title}
                  </span>
                  <span className="ml-auto text-[11px]" style={{ color: "#464B4A" }}>
                    →
                  </span>
                </div>
                <p
                  className="mt-2 pl-9 text-[12px] leading-relaxed"
                  style={{ color: "#7A827F" }}
                >
                  {d.thesis}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
