import type { Metadata } from "next";
import { Archivo } from "next/font/google";

import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  dodge,
  fmtInt,
} from "@/components/lab/perspective-clock/static-data";

// Direction 10 — SIGNAL.
// No visualization at all — typography is the interface. The live colour,
// until now a single pulsing cell, becomes the whole room, and the entire
// dataset is subordinated to one pair of numbers you can read from across
// the street. The grid survives as a one-pixel spine along the poster's foot.

export const metadata: Metadata = {
  title: "Perspective Clock — Signal",
  robots: { index: false, follow: false },
};

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-archivo",
});

const T = {
  field: "#63E2B7",
  ink: "#08130F",
  inkSoft: "rgba(8,19,15,0.62)",
  inkFaint: "rgba(8,19,15,0.38)",
  inkLine: "rgba(8,19,15,0.22)",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-mono)" };
const CAPS: React.CSSProperties = {
  ...MONO,
  fontSize: 9.5,
  lineHeight: "14px",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

export default function SignalPage() {
  const weeksToGo = DATA.totalWeeks - DATA.weeksLived;
  // Spine tick positions, nudged apart where moments crowd (in % points).
  const byT = [...DATA.events].sort((a, b) => a.t - b.t);
  const ticks = dodge(
    byT.map((e) => e.t * 100),
    1.9,
    0,
    100,
  );
  const tickPct = new Map(byT.map((e, i) => [e.id, ticks[i]]));

  return (
    <div
      className={archivo.variable}
      style={{
        backgroundColor: T.field,
        color: T.ink,
        fontFamily: "var(--font-archivo)",
        minHeight: "100vh",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col px-8 py-6">
        {/* Top rule */}
        <header
          className="flex items-baseline justify-between border-t-4 pt-3"
          style={{ borderColor: T.ink }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.06em" }}>
            PERSPECTIVE CLOCK
          </span>
          <span style={{ ...CAPS, color: T.inkSoft }}>{DATA.modeLine}</span>
          <span style={{ ...MONO, fontSize: 14, fontWeight: 500 }}>
            {DATA.clock}
            <span style={{ ...CAPS, color: T.inkSoft }}> {DATA.tz} LOCAL</span>
          </span>
        </header>

        {/* The message */}
        <main className="flex flex-1 flex-col justify-center py-10">
          <div>
            {[
              { n: DATA.weeksLived, label: "WEEKS DOWN" },
              { n: weeksToGo, label: "WEEKS TO GO" },
            ].map((row, i) => (
              <div key={row.label} className="flex items-baseline gap-6">
                <span
                  style={{
                    fontSize: "clamp(96px, 15.5vw, 196px)",
                    lineHeight: 0.98,
                    fontWeight: 900,
                    letterSpacing: "-0.035em",
                    fontVariantNumeric: "tabular-nums",
                    opacity: i === 1 ? 0.44 : 1,
                  }}
                >
                  {fmtInt(row.n)}
                </span>
                <span
                  style={{
                    fontSize: "clamp(17px, 2vw, 26px)",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    opacity: i === 1 ? 0.44 : 1,
                  }}
                >
                  {row.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8" style={{ ...MONO, fontSize: 13, color: T.inkSoft }}>
            {DATA.elapsedPct} ELAPSED · {DATA.remaining} REMAINING · WEEK{" "}
            {DATA.cellText} · BORN {DATA.dobStr} · EST. END {DATA.expectancyStr}{" "}
            · {DATA.disclaimerShort}
          </div>
        </main>

        {/* The spine — the whole grid, one pixel tall */}
        <section>
          <div className="relative" style={{ height: 30 }}>
            {byT.map((e) => (
              <div
                key={e.id}
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: `${tickPct.get(e.id)}%` }}
              >
                <span style={{ ...MONO, fontSize: 8, color: T.inkSoft }}>
                  {String(e.n).padStart(2, "0")}
                </span>
                <span style={{ ...MONO, fontSize: 9, color: e.isPast ? T.ink : T.inkSoft }}>
                  {e.symbol}
                </span>
                <span
                  aria-hidden
                  style={{ width: 1, height: 5, backgroundColor: T.inkSoft }}
                />
              </div>
            ))}
          </div>
          <div className="relative" style={{ height: 6 }}>
            <div className="absolute inset-0" style={{ backgroundColor: T.inkLine }} />
            {DATA.places.map((p) => (
              <div
                key={p.label}
                className="absolute inset-y-0"
                style={{
                  left: `${p.tStart * 100}%`,
                  width: `${(p.tEnd - p.tStart) * 100}%`,
                  backgroundColor: T.ink,
                  opacity: 0.85,
                }}
              />
            ))}
            <div
              aria-hidden
              className="absolute"
              style={{
                left: `${DATA.fraction * 100}%`,
                top: -5,
                bottom: -5,
                width: 3,
                backgroundColor: T.ink,
              }}
            />
          </div>
          <div className="relative mt-1" style={{ ...MONO, fontSize: 8.5, color: T.inkSoft, height: 14 }}>
            {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((age) => (
              <span
                key={age}
                className="absolute"
                style={{
                  left: `${(age / DATA.expectancyYears) * 100}%`,
                  transform: age === 0 ? undefined : age === 80 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {age}
              </span>
            ))}
            <span
              className="absolute whitespace-nowrap"
              style={{
                left: `${DATA.fraction * 100}%`,
                transform: "translateX(-50%)",
                top: 0,
                fontWeight: 700,
                color: T.ink,
              }}
            >
              ▲ NOW
            </span>
          </div>
        </section>

        {/* Appendix — everything, set micro */}
        <section
          className="mt-6 grid gap-x-8 gap-y-3 border-t pt-4 md:grid-cols-4"
          style={{ borderColor: T.inkLine }}
        >
          {DATA.events.map((e) => (
            <div key={e.id} style={{ fontSize: 10, lineHeight: "14px" }}>
              <div style={{ fontWeight: 700 }}>
                <span style={{ ...MONO, fontSize: 8.5, color: T.inkSoft }}>
                  {String(e.n).padStart(2, "0")} {e.symbol}{" "}
                </span>
                {e.label.toUpperCase()}
              </div>
              <div style={{ ...MONO, fontSize: 8.5, color: T.inkSoft }}>
                {e.dateStr} · {e.relative} · {e.kind}
              </div>
              <p style={{ color: T.inkSoft, marginTop: 1 }}>{e.detail}</p>
            </div>
          ))}
        </section>

        {/* Foot rule */}
        <footer
          className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t-4 pt-3 pb-2"
          style={{ borderColor: T.ink }}
        >
          <span style={{ ...CAPS, color: T.inkSoft }}>
            {DATA.places
              .map((p) => `${p.label.toUpperCase()} ${p.years}`)
              .join(" · ")}
          </span>
          <span style={{ ...CAPS, color: T.inkSoft }}>
            {SYMBOL_KEY.map((k) => `${k.symbol} ${k.label}`).join(" ")}
          </span>
          <span style={{ ...CAPS }}>
            {VIEW_NAMES.map((v) => (
              <span key={v} className="ml-2" style={{ opacity: v === "LIFE" ? 1 : 0.4, fontWeight: v === "LIFE" ? 700 : 500 }}>
                {v}
              </span>
            ))}
          </span>
          <span className="flex items-center gap-2">
            <span style={{ ...CAPS, fontSize: 8.5, border: `1.5px solid ${T.ink}`, padding: "3px 9px" }}>
              PLACES ON
            </span>
            <span style={{ ...CAPS, fontSize: 8.5, border: `1.5px solid ${T.inkFaint}`, padding: "3px 9px" }}>
              MAP YOUR LIFE →
            </span>
          </span>
          <span style={{ ...CAPS, fontSize: 8.5, color: T.inkFaint }}>
            [+/-] ZOOM · [0] NOW · [C] CALIBRATE · [P] PLACES
          </span>
        </footer>
      </div>
    </div>
  );
}
