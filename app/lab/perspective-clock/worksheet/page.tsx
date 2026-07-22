import type { Metadata } from "next";

import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  fmtInt,
  mixHex,
} from "@/components/lab/perspective-clock/static-data";

// Direction 8 — THE WORKSHEET.
// The clock's honesty made the hero: every number arrives with its working.
// An engineer's calculation sheet on graph paper — the expectancy derived
// line by line, each moment written as the formula it is, the mortality
// model's actual parameters on the page. The grid is just FIG. 1, taped on.

export const metadata: Metadata = {
  title: "Perspective Clock — Worksheet",
  robots: { index: false, follow: false },
};

const T = {
  paper: "#F7F8F4",
  grid: "#DFE8ED",
  gridMajor: "#CBDAE4",
  ink: "#2B3036",
  dim: "#71787E",
  faint: "#A4ABB0",
  red: "#BE4A33",
  blue: "#33689E",
  rule: "#C8CFD4",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-mono)" };
const CAPS: React.CSSProperties = {
  ...MONO,
  fontSize: 9.5,
  lineHeight: "14px",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

// FIG. 1 geometry — the compact grid, demoted to a taped-on figure.
const CELL = 5;
const PITCH = 6;
const G_GUTTER = 3;
const rowY = (r: number) => r * PITCH + Math.floor(r / 10) * G_GUTTER;
const FIG_H = rowY(DATA.yearCount - 1) + CELL;
const FIG_W = 52 * PITCH - 1;

// The expectancy table entries for the author profile, shown as the sum they
// are (see lib/life-clock.ts SEX_BASELINE / *_ADJ).
const DERIVATION = [
  { label: "BASELINE — SEX: MALE", value: "78.0" },
  { label: "REGION — W. EUROPE / OCEANIA", value: "+1.0" },
  { label: "SMOKING — NEVER", value: "+0.0" },
  { label: "EXERCISE — WEEKLY", value: "+1.0" },
];

function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <div className="mt-10 flex items-baseline gap-3 border-b pb-1" style={{ borderColor: T.ink }}>
      <span style={{ ...MONO, fontSize: 11, color: T.dim }}>{n}</span>
      <span style={{ ...CAPS, fontSize: 11, letterSpacing: "0.16em" }}>{title}</span>
    </div>
  );
}

function CalcLine({
  lhs,
  rhs,
  boxed,
  note,
}: {
  lhs: string;
  rhs: string;
  boxed?: boolean;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 py-[3px]">
      <span style={{ ...MONO, fontSize: 12, color: T.dim }}>{lhs}</span>
      <span
        style={{
          ...MONO,
          fontSize: 12.5,
          color: T.ink,
          ...(boxed
            ? {
                border: `1.5px solid ${T.ink}`,
                borderBottomStyle: "double" as const,
                borderBottomWidth: 4,
                padding: "1px 8px",
              }
            : {}),
        }}
      >
        {rhs}
      </span>
      {note ? (
        <span style={{ ...MONO, fontSize: 10, color: T.faint }}>{note}</span>
      ) : null}
    </div>
  );
}

export default function WorksheetPage() {
  const daysLived = Math.floor(
    (DATA.now.getTime() - DATA.dob.getTime()) / 86_400_000,
  );

  return (
    <div
      className="min-h-screen py-12"
      style={{
        backgroundColor: "#DADDD6",
        color: T.ink,
        fontFamily: "var(--font-inter)",
      }}
    >
      <div
        className="relative mx-auto max-w-[880px] px-10 py-10"
        style={{
          backgroundColor: T.paper,
          backgroundImage: `linear-gradient(${T.grid} 1px, transparent 1px), linear-gradient(90deg, ${T.grid} 1px, transparent 1px), linear-gradient(${T.gridMajor} 1px, transparent 1px), linear-gradient(90deg, ${T.gridMajor} 1px, transparent 1px)`,
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
          boxShadow: "0 2px 18px rgba(40,45,50,0.25)",
        }}
      >
        {/* Binder tabs — the view ladder as sheet tabs */}
        <div className="absolute -top-[26px] right-10 flex gap-1">
          {VIEW_NAMES.map((v) => (
            <span
              key={v}
              style={{
                ...CAPS,
                fontSize: 8.5,
                padding: "5px 14px 3px",
                borderRadius: "6px 6px 0 0",
                backgroundColor: v === "LIFE" ? T.paper : "#E7E9E2",
                color: v === "LIFE" ? T.ink : T.faint,
                border: `1px solid ${T.rule}`,
                borderBottom: "none",
                boxShadow: v === "LIFE" ? "0 -2px 6px rgba(40,45,50,0.08)" : undefined,
              }}
            >
              {v}
            </span>
          ))}
        </div>

        {/* Title block */}
        <div className="grid grid-cols-[2fr_1fr_1fr] border" style={{ borderColor: T.ink }}>
          <div className="border-r px-4 py-3" style={{ borderColor: T.ink }}>
            <div style={{ ...CAPS, color: T.dim }}>PROJECT</div>
            <div style={{ fontSize: 19, fontWeight: 650, letterSpacing: "0.01em" }}>
              Perspective Clock
            </div>
            <div style={{ ...CAPS, fontSize: 8.5, color: T.dim }}>
              CALC SHEET — LIFE VIEW · {DATA.modeLine}
            </div>
          </div>
          <div className="border-r px-4 py-3" style={{ borderColor: T.ink }}>
            <div style={{ ...CAPS, color: T.dim }}>OBSERVED</div>
            <div style={{ ...MONO, fontSize: 13 }}>{DATA.clock}</div>
            <div style={{ ...CAPS, fontSize: 8.5, color: T.dim }}>
              {DATA.weekday} {DATA.dateStr} · {DATA.tz}
            </div>
          </div>
          <div className="px-4 py-3">
            <div style={{ ...CAPS, color: T.dim }}>CHECKED</div>
            <div style={{ ...MONO, fontSize: 13, color: T.red }}>NEVER ✓</div>
            <div style={{ ...CAPS, fontSize: 8.5, color: T.dim }}>
              SEE NOTE, SEC. 6
            </div>
          </div>
        </div>

        {/* 1 — the span, derived */}
        <SectionHead n="1" title="Estimated span — derivation" />
        <div className="mt-3 max-w-[430px]">
          {DERIVATION.map((d) => (
            <div key={d.label} className="flex items-baseline justify-between py-[2px]">
              <span style={{ ...MONO, fontSize: 12, color: T.dim }}>{d.label}</span>
              <span style={{ ...MONO, fontSize: 12.5 }}>{d.value}</span>
            </div>
          ))}
          <div
            className="mt-1 flex items-baseline justify-between border-t pt-1"
            style={{ borderColor: T.ink }}
          >
            <span style={{ ...MONO, fontSize: 12, color: T.dim }}>
              SPAN = max(AGE+1, min(105, Σ))
            </span>
            <span
              style={{
                ...MONO,
                fontSize: 13,
                border: `1.5px solid ${T.ink}`,
                borderBottomStyle: "double",
                borderBottomWidth: 4,
                padding: "1px 8px",
              }}
            >
              80.0 YR
            </span>
          </div>
        </div>

        {/* 2 — current state */}
        <SectionHead n="2" title="Current state" />
        <div className="mt-3">
          <CalcLine
            lhs={`AGE = (${DATA.dateStr} − ${DATA.dobStr}) =`}
            rhs={`${fmtInt(daysLived)} D = ${DATA.ageYears.toFixed(2)} YR`}
          />
          <CalcLine
            lhs={`ELAPSED = ${DATA.ageYears.toFixed(2)} / 80.0 =`}
            rhs={DATA.elapsedPct}
            boxed
            note="FLOORED, NEVER ROUNDED UP"
          />
          <CalcLine lhs="REMAINING =" rhs={DATA.remaining} boxed />
          <CalcLine
            lhs="CELL = WEEK"
            rhs={`${DATA.cellText}`}
            boxed
            note="ONE CELL PER ISO WEEK"
          />
        </div>

        {/* 3 — FIG.1, taped on */}
        <SectionHead n="3" title="Fig. 1 — the grid, for reference" />
        <div className="mt-5 flex justify-center">
          <div
            className="relative bg-white px-5 pb-3 pt-5"
            style={{
              transform: "rotate(-0.6deg)",
              boxShadow: "0 2px 10px rgba(40,45,50,0.22)",
            }}
          >
            <span
              aria-hidden
              className="absolute -top-[9px] left-1/2 h-[20px] w-[86px] -translate-x-1/2"
              style={{
                backgroundColor: "rgba(224, 213, 160, 0.55)",
                transform: "translateX(-50%) rotate(1.4deg)",
              }}
            />
            <div className="flex justify-center gap-3">
              <div className="relative" style={{ width: 20, height: FIG_H }}>
                {DATA.years.map((row) =>
                  row.age % 10 === 0 ? (
                    <span
                      key={row.age}
                      className="absolute right-0"
                      style={{ ...MONO, fontSize: 7, top: rowY(row.age) - 2, color: T.dim }}
                    >
                      {row.age}
                    </span>
                  ) : null,
                )}
              </div>
              <div className="relative" style={{ width: FIG_W, height: FIG_H }}>
                {DATA.years.map((row) => (
                  <div
                    key={row.year}
                    className="absolute flex"
                    style={{ left: row.startCol * PITCH, top: rowY(row.age), gap: PITCH - CELL }}
                  >
                    {row.weeks.map((w) => (
                      <span
                        key={w.col}
                        style={{
                          width: CELL,
                          height: CELL,
                          backgroundColor:
                            w.state === "live"
                              ? T.red
                              : w.state === "future"
                                ? "#E8EAE4"
                                : w.place
                                  ? mixHex(w.place, "#FFFFFF", 0.12)
                                  : "#3A3E42",
                        }}
                      />
                    ))}
                  </div>
                ))}
                {DATA.events.map((e) => (
                  <span
                    key={e.id}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: e.col * PITCH,
                      top: rowY(e.row),
                      width: CELL,
                      height: CELL,
                      fontSize: 5.5,
                      lineHeight: 1,
                      color: e.isPast ? "#FFFFFF" : T.ink,
                    }}
                  >
                    {e.symbol}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-2 text-center" style={{ ...CAPS, fontSize: 7.5, color: T.dim }}>
              FIG. 1 — {fmtInt(DATA.totalWeeks)} WEEKS · LIVE WEEK IN CHECKING RED ·{" "}
              {SYMBOL_KEY.map((k) => `${k.symbol} ${k.label}`).join("  ")}
            </div>
          </div>
        </div>

        {/* 4 — the moments, as calculations */}
        <SectionHead n="4" title="Moments — each shown with its working" />
        <div className="mt-3">
          {DATA.events.map((e) => (
            <div
              key={e.id}
              className="grid items-baseline gap-x-4 border-b py-[9px]"
              style={{ borderColor: T.rule, gridTemplateColumns: "26px 30px 1fr auto" }}
            >
              <span style={{ ...MONO, fontSize: 10, color: T.faint }}>
                {String(e.n).padStart(2, "0")}
              </span>
              <span
                style={{
                  ...MONO,
                  fontSize: 11,
                  color: e.isPast ? T.red : T.blue,
                  fontWeight: 700,
                }}
              >
                {e.isPast ? "✓" : "→"}
              </span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 650 }}>
                  <span aria-hidden style={{ ...MONO, fontSize: 10 }}>
                    {e.symbol}
                  </span>{" "}
                  {e.label}
                </div>
                <div style={{ ...MONO, fontSize: 10.5, color: T.dim }}>
                  {e.basis} <span style={{ color: T.faint }}>⇒</span> {e.dateStr}{" "}
                  <span style={{ color: T.faint }}>({e.relative} · AGE {e.ageAt.toFixed(1)})</span>
                </div>
                <p style={{ fontSize: 11.5, lineHeight: "16px", color: T.dim, maxWidth: "62ch" }}>
                  {e.detail}
                </p>
              </div>
              <span style={{ ...CAPS, fontSize: 8, color: e.isPast ? T.red : T.blue }}>
                {e.isPast ? "RECORDED" : e.kind}
              </span>
            </div>
          ))}
        </div>

        {/* 5 — residences */}
        <SectionHead n="5" title="Residence schedule" />
        <div className="mt-3 max-w-[520px]">
          {DATA.places.map((p) => (
            <div key={p.label} className="flex items-baseline gap-3 py-[3px]">
              <span aria-hidden style={{ width: 10, height: 10, backgroundColor: p.hex, alignSelf: "center" }} />
              <span style={{ fontSize: 13, fontWeight: 650, minWidth: 110 }}>{p.label}</span>
              <span style={{ ...MONO, fontSize: 11.5, color: T.dim }}>{p.years}</span>
              <span style={{ ...MONO, fontSize: 11.5, color: T.faint }}>{p.duration}</span>
            </div>
          ))}
          <div className="mt-2" style={{ ...CAPS, fontSize: 8.5, color: T.dim }}>
            OVERLAY: ON — FIG. 1 IS TINTED BY RESIDENCE · [P] TOGGLES
          </div>
        </div>

        {/* 6 — the model, laid bare */}
        <SectionHead n="6" title="Mortality model — parameters as used" />
        <div className="mt-3 grid gap-8 md:grid-cols-[1fr_1fr]">
          <div>
            <div style={{ ...MONO, fontSize: 12.5 }}>
              μ(x) = A + B·e<sup style={{ fontSize: 9 }}>θx</sup>
            </div>
            <div className="mt-1" style={{ ...MONO, fontSize: 12.5 }}>
              S(x) = exp(−A·x − (B/θ)(e<sup style={{ fontSize: 9 }}>θx</sup> − 1))
            </div>
            <p className="mt-2" style={{ fontSize: 11.5, lineHeight: "16px", color: T.dim }}>
              Gompertz–Makeham hazard, shaped to Stats NZ period life tables
              2020–22. Drives every ◇ probability above; nothing else uses it.
            </p>
          </div>
          <table style={{ ...MONO, fontSize: 11 }}>
            <thead>
              <tr style={{ ...CAPS, fontSize: 8, color: T.dim }}>
                <td className="pr-5" />
                <td className="pr-5">A</td>
                <td className="pr-5">B</td>
                <td>θ</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pr-5" style={{ color: T.dim }}>MALE</td>
                <td className="pr-5">2.0e-4</td>
                <td className="pr-5">2.0e-5</td>
                <td>0.098</td>
              </tr>
              <tr>
                <td className="pr-5" style={{ color: T.dim }}>FEMALE</td>
                <td className="pr-5">1.2e-4</td>
                <td className="pr-5">1.0e-5</td>
                <td>0.102</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes + stamp */}
        <div className="mt-10 grid gap-8 border-t pt-6 md:grid-cols-[1fr_220px]" style={{ borderColor: T.ink }}>
          <div>
            <div style={{ ...CAPS, color: T.dim }}>NOTES</div>
            <p className="mt-2" style={{ fontSize: 11.5, lineHeight: "17px", color: T.dim }}>
              {DATA.disclaimerLong}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span style={{ ...CAPS, fontSize: 8.5, border: `1.5px solid ${T.ink}`, padding: "4px 12px" }}>
                MAP YOUR LIFE →
              </span>
              <span style={{ ...CAPS, fontSize: 8.5, color: T.dim }}>
                [+/-] ZOOM · [0] NOW · [C] CALIBRATE · [P] PLACES
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <span
              style={{
                ...CAPS,
                fontSize: 12,
                letterSpacing: "0.2em",
                color: T.red,
                border: `2.5px solid ${T.red}`,
                borderRadius: 4,
                padding: "10px 16px",
                transform: "rotate(-4deg)",
                opacity: 0.85,
              }}
            >
              {DATA.disclaimerShort}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
