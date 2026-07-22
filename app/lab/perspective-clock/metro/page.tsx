import type { Metadata } from "next";
import { Overpass } from "next/font/google";

import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  dodge,
  type StaticEvent,
} from "@/components/lab/perspective-clock/static-data";

// Direction 7 — METRO.
// Wayfinding, not measurement. The life is one transit line snaking through
// nine decade runs; residences are the line's colours, moments are stations,
// the unlived span is still under construction, and a live roundel marks the
// train you are on. Full particulars live in the station index, like any map.

export const metadata: Metadata = {
  title: "Perspective Clock — Metro",
  robots: { index: false, follow: false },
};

const overpass = Overpass({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-overpass",
});

const T = {
  board: "#FAFAF6",
  ink: "#191A18",
  dim: "#6E706B",
  faint: "#A9ABA3",
  casing: "#E4E4DD",
  future: "#C7C7C0",
  live: "#12B181",
  rule: "#DDDDD5",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-mono)" };
const CAPS: React.CSSProperties = {
  fontSize: 10,
  lineHeight: "15px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

// Map geometry — eight decade runs (ages 0–80), boustrophedon.
const W = 1180;
const XL = 100;
const XR = 1080;
const Y0 = 96;
const PITCH = 106;
const RUNS = 8;
const MAP_H = Y0 + (RUNS - 1) * PITCH + 96;
const SPAN = DATA.expectancyYears;

interface P {
  x: number;
  y: number;
  run: number;
  even: boolean;
}

function agePoint(age: number): P {
  const run = Math.min(RUNS - 1, Math.floor(age / 10));
  const frac = (age - run * 10) / 10;
  const even = run % 2 === 0;
  const x = even ? XL + frac * (XR - XL) : XR - frac * (XR - XL);
  return { x, y: Y0 + run * PITCH, run, even };
}

/** Path along the line between two ages, taking the U-turns with it. */
function routePath(a0: number, a1: number): string {
  const r = PITCH / 2;
  let d = "";
  let a = a0;
  const start = agePoint(a0);
  d += `M ${start.x.toFixed(1)} ${start.y}`;
  while (a < a1 - 1e-6) {
    const run = Math.min(RUNS - 1, Math.floor(a / 10));
    const runEndAge = Math.min(a1, (run + 1) * 10);
    const p = agePoint(Math.min(runEndAge, run * 10 + 9.9999));
    d += ` L ${p.x.toFixed(1)} ${p.y}`;
    if (runEndAge < a1 - 1e-6) {
      // U-turn to the next run: right side after even runs, left after odd.
      const even = run % 2 === 0;
      const x = even ? XR : XL;
      d += ` A ${r} ${r} 0 0 ${even ? 1 : 0} ${x} ${p.y + PITCH}`;
    }
    a = runEndAge;
  }
  return d;
}

/** Per-run label positions, nudged apart where stations crowd. */
function labelOffsets(events: StaticEvent[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let run = 0; run < RUNS; run++) {
    const here = events
      .filter((e) => Math.min(RUNS - 1, Math.floor(e.ageAt / 10)) === run)
      .sort((a, b) => a.ageAt - b.ageAt);
    if (here.length === 0) continue;
    const xs = here.map((e) => {
      const p = agePoint(e.ageAt);
      return p.even ? p.x : W - p.x; // dodge in travel order
    });
    const placed = dodge(xs, 30, XL - 40, XR + 40);
    here.forEach((e, i) => {
      const p = agePoint(e.ageAt);
      const back = p.even ? placed[i] : W - placed[i];
      out.set(e.id, back - p.x);
    });
  }
  return out;
}

function StationMark({ e, p }: { e: StaticEvent; p: P }) {
  if (e.kind === "RECORD" || e.crossroad) {
    // Interchange: the recorded facts get the full roundel treatment.
    return (
      <>
        <circle cx={p.x} cy={p.y} r={7} fill="#fff" stroke={T.ink} strokeWidth={2.5} />
        {e.crossroad ? (
          <circle cx={p.x} cy={p.y} r={2.6} fill={T.ink} />
        ) : null}
      </>
    );
  }
  if (e.kind === "PROBABILITY") {
    return <circle cx={p.x} cy={p.y} r={5} fill={T.board} stroke={T.dim} strokeWidth={2} />;
  }
  // Estimate: a plain stop tick.
  return (
    <rect x={p.x - 2} y={p.y - 9} width={4} height={18} fill={T.dim} />
  );
}

export default function MetroPage() {
  const offsets = labelOffsets(DATA.events);
  const now = agePoint(DATA.ageYears);
  const born = agePoint(0);
  const end = agePoint(SPAN - 0.0001);

  return (
    <div
      className={overpass.variable}
      style={{
        backgroundColor: T.board,
        color: T.ink,
        fontFamily: "var(--font-overpass)",
        minHeight: "100vh",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-7 py-8">
        {/* Masthead with roundel */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <svg width={58} height={58} aria-hidden>
              <circle cx={29} cy={29} r={20} fill="none" stroke={T.live} strokeWidth={9} />
              <rect x={2} y={24} width={54} height={10} fill={T.ink} />
            </svg>
            <div>
              <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "0.02em" }}>
                Perspective Clock
              </div>
              <div style={{ ...CAPS, color: T.dim }}>
                LIFE LINE · {DATA.modeLine.replace("LIFE · ", "")}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div style={{ ...MONO, fontSize: 16, fontWeight: 500 }}>
              <span
                aria-hidden
                className="mr-2 inline-block align-middle"
                style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: T.live }}
              />
              {DATA.clock}
            </div>
            <div style={{ ...CAPS, color: T.dim }}>{DATA.tz} · LOCAL</div>
          </div>
        </header>

        {/* The map */}
        <svg
          className="mt-2 w-full"
          viewBox={`0 0 ${W} ${MAP_H}`}
          role="img"
          aria-label="A life drawn as one transit line through nine decade runs"
        >
          {/* Decade markers above each run's start, clear of the U-turns.
              Run 0 is skipped — the BORN terminus already labels it. */}
          {Array.from({ length: RUNS }, (_, r) => {
            if (r === 0) return null;
            const even = r % 2 === 0;
            return (
              <text
                key={r}
                x={even ? XL : XR}
                y={Y0 + r * PITCH - 15}
                textAnchor={even ? "start" : "end"}
                style={{ ...CAPS, fontSize: 11, paintOrder: "stroke" }}
                stroke={T.board}
                strokeWidth={4}
                fill={r * 10 <= DATA.ageYears ? T.ink : T.faint}
              >
                AGE {r * 10}
              </text>
            );
          })}

          {/* Casing, then the lived colours, then the proposed extension */}
          <path d={routePath(0, SPAN)} fill="none" stroke={T.casing} strokeWidth={13} strokeLinecap="round" />
          {DATA.places.map((p) => (
            <path
              key={p.label}
              d={routePath(p.tStart * SPAN, p.tEnd * SPAN)}
              fill="none"
              stroke={p.hex}
              strokeWidth={9}
              strokeLinecap={p.tStart === 0 ? "round" : "butt"}
            />
          ))}
          <path
            d={routePath(DATA.ageYears, SPAN)}
            fill="none"
            stroke={T.future}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray="11 8"
          />

          {/* Termini */}
          <rect x={born.x - 3.5} y={born.y - 14} width={7} height={28} fill={T.ink} />
          <text x={born.x - 14} y={born.y - 18} textAnchor="start" style={{ ...CAPS, fontSize: 10 }} fill={T.ink}>
            BORN {DATA.firstYear}
          </text>
          <rect x={end.x - 3.5} y={end.y - 14} width={7} height={28} fill={T.dim} />
          <text x={end.x - 4} y={end.y + 34} textAnchor="start" style={{ ...CAPS, fontSize: 10 }} fill={T.dim}>
            EST. TERMINUS · {DATA.expectancyStr.slice(0, 4)} · {DATA.expectancyYears.toFixed(1)} YR · AGE 80
          </text>

          {/* Stations */}
          {DATA.events.map((e) => {
            const p = agePoint(Math.min(e.ageAt, SPAN - 0.0001));
            const dx = offsets.get(e.id) ?? 0;
            const lx = p.x + dx;
            const ly = p.y - 16;
            return (
              <g key={e.id}>
                <StationMark e={e} p={p} />
                {dx !== 0 ? (
                  <line x1={p.x} y1={p.y - 9} x2={lx} y2={ly + 4} stroke={T.faint} strokeWidth={1} />
                ) : null}
                <text
                  transform={`rotate(-38 ${lx} ${ly})`}
                  x={lx}
                  y={ly}
                  textAnchor="start"
                  style={{ fontSize: 11.5, fontWeight: 600 }}
                  fill={e.isPast ? T.ink : T.dim}
                >
                  <tspan style={{ ...MONO, fontSize: 9 }} fill={T.faint}>
                    {String(e.n).padStart(2, "0")}{" "}
                  </tspan>
                  {e.label}
                </text>
              </g>
            );
          })}

          {/* The train — you are here */}
          <circle cx={now.x} cy={now.y} r={9.5} fill={T.live} stroke="#fff" strokeWidth={3} />
          <g>
            <rect x={now.x - 62} y={now.y + 16} width={124} height={34} fill={T.ink} rx={3} />
            <path d={`M ${now.x - 5} ${now.y + 17} L ${now.x} ${now.y + 11} L ${now.x + 5} ${now.y + 17} Z`} fill={T.ink} />
            <text x={now.x} y={now.y + 30} textAnchor="middle" style={{ ...CAPS, fontSize: 9 }} fill="#fff">
              YOU ARE HERE
            </text>
            <text x={now.x} y={now.y + 43} textAnchor="middle" style={{ ...MONO, fontSize: 9 }} fill="#9EE8CD">
              AGE {DATA.ageYears.toFixed(2)} · {DATA.clock}
            </text>
          </g>
        </svg>

        {/* Map furniture */}
        <div className="mt-6 grid gap-6 border-t pt-6 lg:grid-cols-[1fr_1fr_1fr]" style={{ borderColor: T.rule }}>
          <div>
            <div style={{ ...CAPS }}>Key to lines</div>
            <div className="mt-2 flex flex-col gap-[6px]">
              {DATA.places.map((p) => (
                <div key={p.label} className="flex items-center gap-3">
                  <span aria-hidden style={{ width: 26, height: 7, borderRadius: 4, backgroundColor: p.hex }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.label}</span>
                  <span style={{ ...MONO, fontSize: 10, color: T.dim }}>{p.years}</span>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  style={{
                    width: 26,
                    height: 0,
                    borderTop: `4px dashed ${T.future}`,
                  }}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: T.dim }}>
                  Under construction
                </span>
                <span style={{ ...MONO, fontSize: 10, color: T.faint }}>
                  {DATA.remaining}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ ...CAPS }}>Key to stations</div>
            <div className="mt-2 flex flex-col gap-[6px]" style={{ fontSize: 12.5 }}>
              {[
                { mark: "interchange", label: "Record — a dated fact" },
                { mark: "tick", label: "Estimate — arithmetic on facts" },
                { mark: "hollow", label: "Probability — a population curve" },
                { mark: "cross", label: "Crossroad — a fork in the path" },
              ].map((k) => (
                <div key={k.mark} className="flex items-center gap-3">
                  <svg width={26} height={18} aria-hidden>
                    {k.mark === "interchange" ? (
                      <circle cx={13} cy={9} r={6} fill="#fff" stroke={T.ink} strokeWidth={2.5} />
                    ) : k.mark === "tick" ? (
                      <rect x={11} y={1} width={4} height={16} fill={T.dim} />
                    ) : k.mark === "hollow" ? (
                      <circle cx={13} cy={9} r={5} fill={T.board} stroke={T.dim} strokeWidth={2} />
                    ) : (
                      <>
                        <circle cx={13} cy={9} r={6} fill="#fff" stroke={T.ink} strokeWidth={2.5} />
                        <circle cx={13} cy={9} r={2.4} fill={T.ink} />
                      </>
                    )}
                  </svg>
                  <span style={{ fontWeight: 600 }}>{k.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <svg width={26} height={18} aria-hidden>
                  <circle cx={13} cy={9} r={7} fill={T.live} stroke="#fff" strokeWidth={2.5} />
                </svg>
                <span style={{ fontWeight: 600, color: T.live }}>The train — now</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ ...CAPS }}>Journey information</div>
            <div className="mt-2 flex flex-col gap-[5px]" style={{ ...MONO, fontSize: 11.5 }}>
              <div>
                <span style={{ color: T.dim }}>ELAPSED </span>
                {DATA.elapsedPct}
              </div>
              <div>
                <span style={{ color: T.dim }}>REMAINING </span>
                {DATA.remaining}
              </div>
              <div>
                <span style={{ color: T.dim }}>CELL </span>
                {DATA.cellText} WEEKS
              </div>
            </div>
            <div className="mt-4" style={{ ...CAPS, color: T.dim }}>
              Other maps{" "}
              {VIEW_NAMES.map((v) => (
                <span key={v} className="ml-2" style={v === "LIFE" ? { color: T.ink, borderBottom: `2px solid ${T.live}` } : { color: T.faint }}>
                  {v}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span style={{ ...CAPS, fontSize: 9, border: `1.5px solid ${T.ink}`, borderRadius: 99, padding: "4px 12px" }}>
                PLACES · ON
              </span>
              <span style={{ ...CAPS, fontSize: 9, color: T.dim, border: `1.5px solid ${T.faint}`, borderRadius: 99, padding: "4px 12px" }}>
                MAP YOUR LIFE →
              </span>
            </div>
          </div>
        </div>

        {/* Station index */}
        <div className="mt-8 border-t pt-5" style={{ borderColor: T.rule }}>
          <div style={{ ...CAPS }}>Station index</div>
          <div className="mt-3 grid gap-x-10 gap-y-4 md:grid-cols-2">
            {DATA.events.map((e) => (
              <div key={e.id} className="flex gap-3">
                <span style={{ ...MONO, fontSize: 10, color: T.faint, minWidth: 18 }}>
                  {String(e.n).padStart(2, "0")}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {e.label}
                    <span style={{ ...MONO, fontSize: 9.5, fontWeight: 400, color: T.dim }}>
                      {"  "}
                      {e.dateStr} · {e.relative} · AGE {e.ageAt.toFixed(1)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, lineHeight: "17px", color: T.dim }}>
                    {e.detail}
                  </p>
                  <p style={{ ...MONO, fontSize: 8.5, letterSpacing: "0.06em", color: T.faint }}>
                    {e.kind} · {e.basis}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright line */}
        <footer
          className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: T.rule }}
        >
          <span style={{ ...CAPS, fontSize: 9, color: T.dim }}>
            [+/-] ZOOM · [0] NOW · [C] CALIBRATE · [P] PLACES
          </span>
          <span style={{ ...MONO, fontSize: 9, color: T.faint }}>
            {SYMBOL_KEY.map((k) => `${k.symbol} ${k.label}`).join(" · ")}
          </span>
          <span style={{ ...CAPS, fontSize: 9, color: T.dim }}>
            {DATA.disclaimerShort} · NOT A SCHEDULE
          </span>
        </footer>
      </div>
    </div>
  );
}
