import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  dodge,
  mixHex,
} from "@/components/lab/perspective-clock/static-data";

// Direction 5 — ORBIT.
// The life as a single contemplative object: a cyanotype plate where every
// year is one ring, birth at the centre, the estimate at the rim, weeks
// sweeping clockwise from January. Moments sit at their exact polar position
// and are keyed by number to a legend beside the disc. Nothing hides — the
// whole span is one held image.

export const metadata: Metadata = {
  title: "Perspective Clock — Orbit",
  robots: { index: false, follow: false },
};

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-grotesk",
});

const T = {
  bg: "#152F4B",
  bgDeep: "#102438",
  chalk: "#EAF2F8",
  paper: "#F4F8FB",
  dim: "#9DB4C8",
  faint: "#5E7C97",
  hair: "rgba(233,241,247,0.14)",
  future: "rgba(233,241,247,0.10)",
  live: "#7FF0C4",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-mono)" };
const CAPS: React.CSSProperties = {
  ...MONO,
  fontSize: 10,
  lineHeight: "16px",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const SIZE = 940;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R0 = 62;
const RING = 4.3;
const R_OUT = R0 + (DATA.yearCount - 1) * RING;
const R_LABEL = R_OUT + 26;

const radius = (age: number) => R0 + age * RING;
const angleOf = (col: number) => (col / 52) * 360;

function polar(r: number, aDeg: number): [number, number] {
  const a = ((aDeg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1 - 0.0001);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

interface Run {
  key: string;
  r: number;
  a0: number;
  a1: number;
  color: string;
  full: boolean;
}

function buildRuns(): Run[] {
  const runs: Run[] = [];
  for (const row of DATA.years) {
    const r = radius(row.age);
    let start = 0;
    let key = "";
    let color = "";
    const flush = (endCol: number) => {
      if (!key) return;
      const a0 = angleOf(start);
      const a1 = angleOf(endCol + 1);
      runs.push({
        key: `${row.year}:${start}`,
        r,
        a0,
        a1,
        color,
        full: endCol - start >= 51,
      });
    };
    let prevCol = -1;
    for (const w of row.weeks) {
      const k =
        w.state === "future"
          ? "future"
          : w.state === "live"
            ? "live"
            : `p:${w.place ?? "none"}`;
      const c =
        w.state === "future"
          ? T.future
          : w.state === "live"
            ? T.live
            : w.place
              ? mixHex(w.place, T.paper, 0.42)
              : "rgba(234,242,248,0.75)";
      if (k !== key) {
        flush(prevCol);
        key = k;
        color = c;
        start = w.col;
      }
      prevCol = w.col;
    }
    flush(prevCol);
  }
  return runs;
}

export default function OrbitPage() {
  const runs = buildRuns();
  const nowAngle = angleOf(DATA.nowCol + 0.5);
  const [liveX, liveY] = polar(radius(DATA.nowRow), nowAngle);
  const [nowEndX, nowEndY] = polar(R_OUT + 12, nowAngle);

  // Callout labels dodge around the rim so clustered birthdays stay legible.
  const byAngle = [...DATA.events].sort(
    (a, b) => angleOf(a.col) - angleOf(b.col),
  );
  const targets = byAngle.map((e) => angleOf(e.col + 0.5));
  const angles = dodge(targets, 4.6, targets[0], targets[0] + 352);
  const labelAngle = new Map(byAngle.map((e, i) => [e.id, angles[i]]));

  return (
    <div
      className={grotesk.variable}
      style={{
        background: `radial-gradient(circle at 40% 38%, ${T.bg} 0%, ${T.bgDeep} 78%)`,
        color: T.chalk,
        fontFamily: "var(--font-grotesk)",
        minHeight: "100vh",
      }}
    >
      <div className="mx-auto max-w-[1380px] px-6 py-6">
        {/* HUD corners */}
        <header className="flex items-start justify-between">
          <div>
            <div
              style={{
                fontSize: 14,
                letterSpacing: "0.18em",
                fontWeight: 500,
              }}
            >
              PERSPECTIVE CLOCK
            </div>
            <div style={{ ...CAPS, color: T.dim }}>{DATA.modeLine}</div>
          </div>
          <div className="text-right">
            <div style={{ ...MONO, fontSize: 16, fontWeight: 500 }}>
              <span
                aria-hidden
                className="mr-2 inline-block align-middle"
                style={{ width: 5, height: 5, backgroundColor: T.live }}
              />
              {DATA.clock}
            </div>
            <div style={{ ...CAPS, color: T.dim }}>
              {DATA.tz} · LOCAL
            </div>
          </div>
        </header>

        <div className="mt-2 grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* The disc */}
          <div className="flex flex-col items-center">
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="max-w-full"
              role="img"
              aria-label="A life drawn as concentric year rings"
            >
              {/* Quarter spokes — the year's seasons as plate furniture */}
              {[0, 90, 180, 270].map((a) => {
                const [x0, y0] = polar(R0 - 18, a);
                const [x1, y1] = polar(R_OUT + 10, a);
                return (
                  <line
                    key={a}
                    x1={x0}
                    y1={y0}
                    x2={x1}
                    y2={y1}
                    stroke={T.hair}
                    strokeWidth={1}
                  />
                );
              })}
              {[
                ["JAN", 0],
                ["APR", 90],
                ["JUL", 180],
                ["OCT", 270],
              ].map(([m, a]) => {
                const [x, y] = polar(R_OUT + 16, a as number);
                return (
                  <text
                    key={m}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ ...MONO, fontSize: 8, letterSpacing: 1 }}
                    fill={T.faint}
                  >
                    {m}
                  </text>
                );
              })}

              {/* Year rings */}
              {runs.map((run) =>
                run.full ? (
                  <circle
                    key={run.key}
                    cx={CX}
                    cy={CY}
                    r={run.r}
                    fill="none"
                    stroke={run.color}
                    strokeWidth={3}
                  />
                ) : (
                  <path
                    key={run.key}
                    d={arc(run.r, run.a0, run.a1)}
                    fill="none"
                    stroke={run.color}
                    strokeWidth={3}
                  />
                ),
              )}

              {/* Decade scale up the JAN spoke */}
              {Array.from({ length: 9 }, (_, i) => i * 10).map((age) => (
                <g key={age}>
                  <line
                    x1={CX - 4}
                    y1={CY - radius(age)}
                    x2={CX + 4}
                    y2={CY - radius(age)}
                    stroke={T.chalk}
                    strokeWidth={1}
                    opacity={0.6}
                  />
                  <text
                    x={CX + 8}
                    y={CY - radius(age) + 3}
                    style={{ ...MONO, fontSize: 8, paintOrder: "stroke" }}
                    fill={T.dim}
                    stroke={T.bgDeep}
                    strokeWidth={3}
                  >
                    {age}
                  </text>
                </g>
              ))}
              <text
                x={CX}
                y={CY + 4}
                textAnchor="middle"
                style={{ ...MONO, fontSize: 9, letterSpacing: 1 }}
                fill={T.dim}
              >
                {DATA.firstYear}
              </text>

              {/* NOW radial */}
              <line
                x1={CX}
                y1={CY}
                x2={nowEndX}
                y2={nowEndY}
                stroke={T.live}
                strokeWidth={1.5}
                opacity={0.85}
              />
              <circle cx={liveX} cy={liveY} r={3} fill={T.live} />
              {(() => {
                const [x, y] = polar(R_OUT + 24, nowAngle);
                const rightHalf = nowAngle < 180;
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor={rightHalf ? "start" : "end"}
                    style={{ ...MONO, fontSize: 9, letterSpacing: 1, paintOrder: "stroke" }}
                    fill={T.live}
                    stroke={T.bgDeep}
                    strokeWidth={3}
                  >
                    NOW · {DATA.clock} · AGE {DATA.ageYears.toFixed(2)}
                  </text>
                );
              })()}

              {/* Moments + rim callouts */}
              {DATA.events.map((e) => {
                const aMark = angleOf(e.col + 0.5);
                const aLab = labelAngle.get(e.id) ?? aMark;
                const [mx, my] = polar(radius(e.row), aMark);
                const [ex, ey] = polar(R_OUT + 8, aMark);
                const [lx, ly] = polar(R_LABEL - 8, aLab);
                const [tx, ty] = polar(R_LABEL, aLab);
                const rightHalf = aLab % 360 < 180;
                return (
                  <g key={e.id}>
                    <polyline
                      points={`${mx},${my} ${ex},${ey} ${lx},${ly}`}
                      fill="none"
                      stroke={T.hair}
                      strokeWidth={1}
                    />
                    <circle
                      cx={mx}
                      cy={my}
                      r={e.crossroad ? 3.4 : 2.6}
                      fill={e.isPast ? T.bgDeep : T.chalk}
                      stroke={T.chalk}
                      strokeWidth={e.isPast ? 1.2 : 0}
                      transform={
                        e.crossroad
                          ? `rotate(45 ${mx.toFixed(1)} ${my.toFixed(1)})`
                          : undefined
                      }
                    />
                    <text
                      x={tx}
                      y={ty + 3}
                      textAnchor={rightHalf ? "start" : "end"}
                      style={{ ...MONO, fontSize: 9, letterSpacing: 1, paintOrder: "stroke" }}
                      fill={T.dim}
                      stroke={T.bgDeep}
                      strokeWidth={3}
                    >
                      {String(e.n).padStart(2, "0")} {e.symbol}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Plate caption */}
            <div className="mt-2 text-center">
              <div style={{ ...CAPS, color: T.dim }}>
                DRAUGHT No. 5 — THE DISC OF YEARS
              </div>
              <div style={{ ...CAPS, fontSize: 8.5, color: T.faint }}>
                ONE RING PER YEAR · BIRTH AT THE CENTRE, THE ESTIMATE AT THE RIM
                · CLOCKWISE FROM JANUARY · {DATA.disclaimerShort}
              </div>
            </div>

            {/* Places + controls */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-5">
              {DATA.places.map((p) => (
                <span key={p.label} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: mixHex(p.hex, T.paper, 0.42),
                    }}
                  />
                  <span style={{ ...CAPS, fontSize: 9, color: T.dim }}>
                    {p.label} <span style={{ color: T.faint }}>{p.years}</span>
                  </span>
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span
                style={{
                  ...CAPS,
                  color: T.chalk,
                  border: `1px solid ${T.chalk}`,
                  padding: "4px 10px",
                }}
              >
                PLACES
              </span>
              <span
                style={{
                  ...CAPS,
                  color: T.chalk,
                  border: `1px solid rgba(233,241,247,0.35)`,
                  padding: "4px 10px",
                }}
              >
                MAP YOUR LIFE →
              </span>
            </div>
          </div>

          {/* Legend of moments */}
          <aside>
            <div
              className="border-b pb-2"
              style={{ borderColor: "rgba(233,241,247,0.28)" }}
            >
              <span
                style={{ fontSize: 13, letterSpacing: "0.16em", fontWeight: 500 }}
              >
                LEGEND OF MOMENTS
              </span>
              <span style={{ ...CAPS, color: T.faint }} className="ml-3">
                {DATA.events.length} PLOTTED
              </span>
            </div>
            {DATA.events.map((e) => (
              <div
                key={e.id}
                className="border-b py-3"
                style={{ borderColor: T.hair }}
              >
                <div className="flex items-baseline gap-2">
                  <span style={{ ...MONO, fontSize: 10, color: T.faint }}>
                    {String(e.n).padStart(2, "0")}
                  </span>
                  <span aria-hidden style={{ ...MONO, fontSize: 10 }}>
                    {e.symbol}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                    {e.label}
                  </span>
                </div>
                <div
                  className="mt-[2px]"
                  style={{ ...CAPS, fontSize: 8.5, color: T.dim }}
                >
                  {e.dateStr} · {e.relative} · AGE {e.ageAt.toFixed(1)} ·{" "}
                  {e.kind}
                </div>
                <p
                  className="mt-1"
                  style={{ fontSize: 11.5, lineHeight: "17px", color: T.dim }}
                >
                  {e.detail}
                </p>
                <p
                  className="mt-1"
                  style={{ ...CAPS, fontSize: 7.5, color: T.faint }}
                >
                  {e.basis}
                </p>
              </div>
            ))}
          </aside>
        </div>

        {/* Bottom HUD */}
        <footer className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <div className="flex gap-8">
            {[
              { label: "ELAPSED", value: DATA.elapsedPct },
              { label: "REMAINING", value: DATA.remaining },
              { label: "CELL", value: DATA.cellText },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ ...CAPS, fontSize: 9, color: T.faint }}>
                  {s.label}
                </div>
                <div style={{ ...MONO, fontSize: 13 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ ...CAPS, fontSize: 9, color: T.faint }}>
            [+/-] ZOOM · [0] NOW · [C] CALIBRATE · [P] PLACES
            <span className="ml-5">
              {SYMBOL_KEY.map((k) => `${k.symbol} ${k.label}`).join(" · ")}
            </span>
          </div>
          <div className="flex flex-col items-end">
            {([3, 2, 1, 0] as const).map((view) => (
              <span
                key={view}
                className="flex items-center gap-2"
                style={{ height: 17 }}
              >
                <span
                  style={{
                    ...CAPS,
                    fontSize: 9,
                    color: view === 3 ? T.chalk : T.faint,
                  }}
                >
                  {VIEW_NAMES[view]}
                </span>
                <span
                  style={{
                    width: view === 3 ? 10 : 4,
                    height: 1,
                    backgroundColor: view === 3 ? T.chalk : T.faint,
                  }}
                />
              </span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
