import type { Metadata } from "next";

import { MS_PER_YEAR } from "@/lib/life-clock";
import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  fmtInt,
  mixHex,
} from "@/components/lab/perspective-clock/static-data";

// Direction 4 — MISSION CONSOLE.
// The single monumental grid gives way to triage: an amber-phosphor bento of
// instruments. Big numbers first, then the queue — every future moment is a
// countdown, every past one a log line. The grid survives as one card among
// equals rather than the whole room.

export const metadata: Metadata = {
  title: "Perspective Clock — Mission Console",
  robots: { index: false, follow: false },
};

const T = {
  bg: "#0B0907",
  card: "#121009",
  edge: "#2A2314",
  amber: "#E19A3C",
  amberHot: "#F6B95F",
  ivory: "#E8E2D3",
  dim: "#8C8471",
  faint: "#5A523C",
  open: "#221D12",
  lived: "#D8D1BF",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-mono)" };
const CAPS: React.CSSProperties = {
  ...MONO,
  fontSize: 9,
  lineHeight: "14px",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const CELL = 6;
const PITCH = 7;
const DECADE_GUTTER = 3;
const rowY = (r: number) => r * PITCH + Math.floor(r / 10) * DECADE_GUTTER;
const GRID_H = rowY(DATA.yearCount - 1) + CELL;
const GRID_W = 52 * PITCH - 1;

function Card({
  title,
  right,
  className,
  children,
}: {
  title: string;
  right?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col border p-4 ${className ?? ""}`}
      style={{ backgroundColor: T.card, borderColor: T.edge }}
    >
      <div className="flex items-baseline justify-between">
        <span style={{ ...CAPS, color: T.amber }}>{title}</span>
        {right ? <span style={{ ...CAPS, color: T.faint }}>{right}</span> : null}
      </div>
      {children}
    </div>
  );
}

function gaugePoint(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx - r * Math.cos(a), cy - r * Math.sin(a)] as const;
}

/** Semicircle arc from 0..`f` of the dial (left = 0, right = full span). */
function gaugeArc(cx: number, cy: number, r: number, f: number): string {
  const [x0, y0] = gaugePoint(cx, cy, r, 0);
  const [x1, y1] = gaugePoint(cx, cy, r, 180 * Math.min(1, Math.max(0, f)));
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

export default function ConsolePage() {
  const scheduled = DATA.events.filter((e) => !e.isPast);
  const log = [...DATA.events.filter((e) => e.isPast)].reverse();
  const dialF = DATA.ageYears / DATA.expectancyYears;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: T.bg, color: T.ivory, ...MONO }}
    >
      <div className="mx-auto max-w-[1240px] px-5 py-6">
        {/* Header strip */}
        <header
          className="flex items-center justify-between border-b pb-4"
          style={{ borderColor: T.edge }}
        >
          <div className="flex items-baseline gap-4">
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.16em",
              }}
            >
              PERSPECTIVE CLOCK
            </span>
            <span style={{ ...CAPS, color: T.dim }}>
              CONSOLE · {DATA.modeLine}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              style={{ width: 5, height: 5, backgroundColor: T.amber }}
            />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{DATA.clock}</span>
            <span style={{ ...CAPS, color: T.dim }}>
              {DATA.weekday} {DATA.dateStr} · {DATA.tz}
            </span>
          </div>
        </header>

        {/* Bento */}
        <div className="mt-4 grid grid-cols-12 gap-3">
          {/* ELAPSED hero */}
          <Card title="ELAPSED" right="OF THE ESTIMATED SPAN" className="col-span-5">
            <div
              className="mt-4"
              style={{
                fontSize: 52,
                lineHeight: "56px",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: T.amberHot,
              }}
            >
              {DATA.elapsedPct}
            </div>
            <div
              className="relative mt-5 h-3"
              style={{ backgroundColor: T.open }}
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${DATA.fraction * 100}%`,
                  backgroundColor: T.amber,
                }}
              />
              {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((p) => (
                <span
                  key={p}
                  aria-hidden
                  className="absolute inset-y-0"
                  style={{
                    left: `${p}%`,
                    width: 1,
                    backgroundColor: "rgba(0,0,0,0.55)",
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex justify-between">
              <span style={{ ...CAPS, color: T.dim }}>
                {fmtInt(DATA.weeksLived)} OF {fmtInt(DATA.totalWeeks)} WEEKS
              </span>
              <span style={{ ...CAPS, color: T.faint }}>
                BORN {DATA.dobStr}
              </span>
            </div>
          </Card>

          {/* REMAINING dial */}
          <Card title="REMAINING" right="EST." className="col-span-4">
            <div
              className="mt-4"
              style={{
                fontSize: 30,
                lineHeight: "34px",
                fontWeight: 500,
                color: T.ivory,
              }}
            >
              {DATA.remaining}
            </div>
            <div className="mt-3 flex justify-center">
              <svg width={210} height={112} aria-hidden>
                <path
                  d={gaugeArc(105, 100, 78, 1)}
                  fill="none"
                  stroke={T.open}
                  strokeWidth={10}
                />
                <path
                  d={gaugeArc(105, 100, 78, dialF)}
                  fill="none"
                  stroke={T.amber}
                  strokeWidth={10}
                />
                {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                  const [x0, y0] = gaugePoint(105, 100, 88, 180 * f);
                  const [x1, y1] = gaugePoint(105, 100, 92, 180 * f);
                  return (
                    <line
                      key={f}
                      x1={x0}
                      y1={y0}
                      x2={x1}
                      y2={y1}
                      stroke={T.faint}
                      strokeWidth={1}
                    />
                  );
                })}
                {(() => {
                  const [x, y] = gaugePoint(105, 100, 64, 180 * dialF);
                  return (
                    <line
                      x1={105}
                      y1={100}
                      x2={x}
                      y2={y}
                      stroke={T.amberHot}
                      strokeWidth={2}
                    />
                  );
                })()}
              </svg>
            </div>
            <div className="flex justify-between">
              <span style={{ ...CAPS, color: T.faint }}>AGE 0</span>
              <span style={{ ...CAPS, color: T.dim }}>
                NEEDLE {DATA.ageYears.toFixed(1)}
              </span>
              <span style={{ ...CAPS, color: T.faint }}>
                {DATA.expectancyYears.toFixed(1)}
              </span>
            </div>
          </Card>

          {/* SYSTEM */}
          <Card title="SYSTEM" className="col-span-3">
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <div style={{ ...CAPS, color: T.faint }}>VIEW</div>
                <div
                  className="mt-1 grid grid-cols-4 border"
                  style={{ borderColor: T.edge }}
                >
                  {VIEW_NAMES.map((v) => (
                    <span
                      key={v}
                      className="py-1 text-center"
                      style={{
                        ...CAPS,
                        fontSize: 8,
                        color: v === "LIFE" ? T.bg : T.dim,
                        backgroundColor: v === "LIFE" ? T.amber : "transparent",
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ ...CAPS, color: T.faint }}>PLACES</span>
                <span
                  className="px-2 py-[2px]"
                  style={{
                    ...CAPS,
                    fontSize: 8,
                    color: T.bg,
                    backgroundColor: T.amber,
                  }}
                >
                  ON
                </span>
              </div>
              <div
                className="border py-[5px] text-center"
                style={{ ...CAPS, borderColor: T.dim, color: T.ivory }}
              >
                MAP YOUR LIFE →
              </div>
              <div style={{ ...CAPS, fontSize: 8, color: T.faint }}>
                [+/-] ZOOM · [0] NOW
                <br />
                [C] CALIBRATE · [P] PLACES
              </div>
            </div>
          </Card>

          {/* GRID */}
          <Card
            title="THE GRID"
            right={`${fmtInt(DATA.totalWeeks)} WEEKS`}
            className="col-span-5 row-span-2"
          >
            <div className="mt-4 flex justify-center">
              <div
                className="relative"
                style={{ width: GRID_W + 26, height: GRID_H }}
              >
                {DATA.years.map((row) =>
                  row.age % 10 === 0 ? (
                    <span
                      key={row.age}
                      className="absolute"
                      style={{
                        ...CAPS,
                        fontSize: 8,
                        left: 0,
                        top: rowY(row.age) - 3,
                        width: 18,
                        textAlign: "right",
                        color: T.faint,
                      }}
                    >
                      {row.age}
                    </span>
                  ) : null,
                )}
                {DATA.years.map((row) => (
                  <div
                    key={row.year}
                    className="absolute flex"
                    style={{
                      left: 26 + row.startCol * PITCH,
                      top: rowY(row.age),
                      gap: PITCH - CELL,
                    }}
                  >
                    {row.weeks.map((w) => (
                      <span
                        key={w.col}
                        style={{
                          width: CELL,
                          height: CELL,
                          backgroundColor:
                            w.state === "live"
                              ? T.amberHot
                              : w.state === "future"
                                ? T.open
                                : w.place
                                  ? mixHex(w.place, T.lived, 0.3)
                                  : T.lived,
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
                      left: 26 + e.col * PITCH,
                      top: rowY(e.row),
                      width: CELL,
                      height: CELL,
                      fontSize: 6,
                      lineHeight: 1,
                      color: e.isPast ? T.bg : T.amber,
                    }}
                  >
                    {e.symbol}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-between">
              <span style={{ ...CAPS, color: T.faint }}>
                {SYMBOL_KEY.map((k) => `${k.symbol} ${k.label}`).join("  ")}
              </span>
            </div>
          </Card>

          {/* SCHEDULED */}
          <Card
            title="SCHEDULED"
            right={`${scheduled.length} AHEAD`}
            className="col-span-4 row-span-2"
          >
            <div className="mt-2">
              {scheduled.map((e) => (
                <div
                  key={e.id}
                  className="grid items-baseline gap-x-3 border-b py-[7px]"
                  style={{
                    borderColor: T.edge,
                    gridTemplateColumns: "58px 1fr",
                  }}
                >
                  <span
                    className="text-right"
                    style={{ fontSize: 11, color: T.amber }}
                  >
                    T-{((e.date.getTime() - DATA.now.getTime()) / MS_PER_YEAR).toFixed(1)}Y
                  </span>
                  <div>
                    <div
                      style={{
                        ...CAPS,
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        color: T.ivory,
                      }}
                    >
                      {e.symbol} {e.label}
                    </div>
                    <div style={{ ...CAPS, fontSize: 8, color: T.faint }}>
                      {e.dateStr} · AGE {e.ageAt.toFixed(0)} · {e.kind}
                    </div>
                    <p
                      className="line-clamp-1 mt-[2px]"
                      style={{ fontSize: 9, lineHeight: "13px", color: T.dim }}
                    >
                      {e.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* LOG */}
          <Card title="LOG" right="RECORDED" className="col-span-3 self-start">
            <div className="mt-2">
              {log.map((e) => (
                <div
                  key={e.id}
                  className="border-b py-[7px]"
                  style={{ borderColor: T.edge }}
                >
                  <div
                    style={{
                      ...CAPS,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      color: T.ivory,
                    }}
                  >
                    {e.symbol} {e.label}
                  </div>
                  <div style={{ ...CAPS, fontSize: 8, color: T.faint }}>
                    {e.dateStr} · {e.relative}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* PLACES */}
          <Card title="PLACES" right="LIVED IN 5" className="col-span-3">
            <div
              className="relative mt-3 h-3"
              style={{ backgroundColor: T.open }}
            >
              {DATA.places.map((p) => (
                <span
                  key={p.label}
                  className="absolute inset-y-0"
                  style={{
                    left: `${p.tStart * 100}%`,
                    width: `${(p.tEnd - p.tStart) * 100}%`,
                    backgroundColor: p.hex,
                  }}
                />
              ))}
              <span
                aria-hidden
                className="absolute inset-y-[-3px]"
                style={{
                  left: `${DATA.fraction * 100}%`,
                  width: 1,
                  backgroundColor: T.amberHot,
                }}
              />
            </div>
            <div className="mt-3 flex flex-col gap-[5px]">
              {DATA.places.map((p) => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      style={{ width: 6, height: 6, backgroundColor: p.hex }}
                    />
                    <span style={{ ...CAPS, fontSize: 8, color: T.dim }}>
                      {p.label}
                    </span>
                  </span>
                  <span style={{ ...CAPS, fontSize: 8, color: T.faint }}>
                    {p.years}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Footer strip */}
          <div
            className="col-span-12 flex items-baseline justify-between gap-8 border px-4 py-3"
            style={{ backgroundColor: T.card, borderColor: T.edge }}
          >
            <span style={{ ...CAPS, color: T.amber }}>
              {DATA.disclaimerShort}
            </span>
            <p
              className="max-w-[110ch] text-right"
              style={{ fontSize: 9, lineHeight: "13px", color: T.faint }}
            >
              {DATA.disclaimerLong}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
