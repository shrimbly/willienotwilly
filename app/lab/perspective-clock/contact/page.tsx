import type { Metadata } from "next";

import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  type StaticYearRow,
} from "@/components/lab/perspective-clock/static-data";

// Direction 9 — CONTACT SHEET.
// A life reviewed like a roll of negatives. Eighty-one year-frames on nine
// film strips, each frame holding its 52 weeks as an exposure; the frames
// that matter are circled in grease pencil and keyed to the edit notes.
// Unexposed frames are the years not yet lived. The loupe never lies.

export const metadata: Metadata = {
  title: "Perspective Clock — Contact Sheet",
  robots: { index: false, follow: false },
};

const T = {
  bench: "#171412",
  film: "#0C0A08",
  frameEdge: "#242019",
  matte: "#050403",
  text: "#DCD6C9",
  dim: "#8A8477",
  faint: "#544F44",
  edgePrint: "#C9A15A",
  grease: "#E0442A",
  live: "#63E2B7",
  unexposed: "#191612",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-mono)" };
const CAPS: React.CSSProperties = {
  ...MONO,
  fontSize: 9,
  lineHeight: "14px",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const FRAME_W = 104;
const FRAME_H = 72;
const PER_STRIP = 9;

function strips(): StaticYearRow[][] {
  const out: StaticYearRow[][] = [];
  for (let i = 0; i < DATA.years.length; i += PER_STRIP) {
    out.push(DATA.years.slice(i, i + PER_STRIP));
  }
  return out;
}

function Sprockets() {
  return (
    <div
      aria-hidden
      className="h-[10px]"
      style={{
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 9px, ${T.frameEdge} 9px, ${T.frameEdge} 17px, transparent 17px, transparent 26px)`,
        backgroundSize: "26px 6px",
        backgroundPosition: "6px 2px",
        backgroundRepeat: "repeat-x",
      }}
    />
  );
}

function YearFrame({ row }: { row: StaticYearRow }) {
  const isNowYear = row.age === DATA.nowRow;
  const lived = row.weeks.some((w) => w.state !== "future");
  const event = DATA.events.find((e) => e.row === row.age);
  // Deterministic little imperfections per frame — no Math.random in sight.
  const tilt = ((row.year * 7) % 5) - 2;

  return (
    <div className="relative" style={{ width: FRAME_W }}>
      <div
        className="relative flex items-center justify-center"
        style={{
          width: FRAME_W,
          height: FRAME_H,
          backgroundColor: T.matte,
          border: `1px solid ${T.frameEdge}`,
          outline: isNowYear ? `1.5px solid ${T.live}` : undefined,
          outlineOffset: 1,
        }}
      >
        {/* The exposure: 52 weeks, 13 × 4 */}
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(13, 6px)", gap: 1, paddingLeft: row.startCol > 0 ? 0 : 0 }}
        >
          {Array.from({ length: 52 }, (_, c) => {
            const w = row.weeks.find((x) => x.col === c);
            return (
              <span
                key={c}
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: !w
                    ? "transparent"
                    : w.state === "live"
                      ? T.live
                      : w.state === "future"
                        ? T.unexposed
                        : (w.place ?? "#B9B3A4"),
                  opacity: w && w.state === "lived" ? 0.92 : 1,
                }}
              />
            );
          })}
        </div>
        {!lived ? (
          <span
            className="absolute"
            style={{ ...CAPS, fontSize: 7, color: T.faint, bottom: 3, right: 5 }}
          >
            UNEXPOSED
          </span>
        ) : null}
      </div>

      {/* Grease-pencil circle on the frames that matter */}
      {event ? (
        <svg
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: -8, top: -8 }}
          width={FRAME_W + 16}
          height={FRAME_H + 16}
        >
          <ellipse
            cx={(FRAME_W + 16) / 2}
            cy={(FRAME_H + 16) / 2}
            rx={FRAME_W / 2 + 2}
            ry={FRAME_H / 2 + 1}
            fill="none"
            stroke={T.grease}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeDasharray="230 40"
            transform={`rotate(${tilt * 14} ${(FRAME_W + 16) / 2} ${(FRAME_H + 16) / 2})`}
            opacity={0.85}
          />
          <text
            x={FRAME_W + 6}
            y={12}
            textAnchor="end"
            style={{ ...MONO, fontSize: 11, fontWeight: 700 }}
            fill={T.grease}
            transform={`rotate(${tilt} ${FRAME_W - 6} 10)`}
          >
            {String(event.n).padStart(2, "0")}
            {event.symbol}
          </text>
        </svg>
      ) : null}

      {/* Edge print */}
      <div className="mt-[3px] flex items-baseline justify-between">
        <span style={{ ...MONO, fontSize: 7.5, color: T.edgePrint }}>
          {row.year}
        </span>
        <span style={{ ...MONO, fontSize: 7, color: isNowYear ? T.live : T.faint }}>
          {isNowYear ? "◀ NOW" : `A${String(row.age).padStart(2, "0")}`}
        </span>
      </div>
    </div>
  );
}

export default function ContactSheetPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: T.bench, color: T.text, ...MONO }}
    >
      <div className="mx-auto max-w-[1420px] px-6 py-7">
        {/* Bench header */}
        <header className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-4">
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.14em" }}>
              PERSPECTIVE CLOCK
            </span>
            <span style={{ ...CAPS, color: T.dim }}>
              CONTACT SHEET · ROLL 1 OF 1 · {DATA.modeLine}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden style={{ width: 5, height: 5, backgroundColor: T.live }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{DATA.clock}</span>
            <span style={{ ...CAPS, color: T.dim }}>{DATA.tz} · LOCAL</span>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-8">
          {/* The sheet */}
          <div className="min-w-0 flex-1">
            {strips().map((strip, i) => (
              <div
                key={i}
                className="mb-3 px-3 pb-2 pt-1"
                style={{ backgroundColor: T.film, border: `1px solid ${T.frameEdge}` }}
              >
                <div className="flex items-baseline justify-between px-1">
                  <span style={{ ...MONO, fontSize: 7.5, color: T.edgePrint }}>
                    PERSPECTIVE 400 · STRIP {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ ...MONO, fontSize: 7.5, color: T.faint }}>
                    AGES {strip[0].age}–{strip[strip.length - 1].age}
                  </span>
                </div>
                <Sprockets />
                <div className="flex justify-between gap-2 py-1">
                  {strip.map((row) => (
                    <YearFrame key={row.year} row={row} />
                  ))}
                </div>
                <Sprockets />
              </div>
            ))}

            {/* Bench notes under the sheet */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-7">
                {[
                  { label: "ELAPSED", value: DATA.elapsedPct },
                  { label: "REMAINING", value: DATA.remaining },
                  { label: "CELL", value: DATA.cellText },
                ].map((s) => (
                  <div key={s.label}>
                    <div style={{ ...CAPS, fontSize: 8, color: T.faint }}>{s.label}</div>
                    <div style={{ fontSize: 12 }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...CAPS, color: T.dim }}>
                ROLL{" "}
                {VIEW_NAMES.map((v) => (
                  <span key={v} className="ml-2" style={{ color: v === "LIFE" ? T.text : T.faint }}>
                    {v === "LIFE" ? "[LIFE]" : v}
                  </span>
                ))}
              </div>
              <div style={{ ...CAPS, fontSize: 8, color: T.faint }}>
                [+/-] ZOOM · [0] NOW · [C] CALIBRATE · [P] PLACES
              </div>
            </div>
          </div>

          {/* Edit notes rail */}
          <aside className="w-[300px] flex-none">
            <div className="border-b pb-2" style={{ borderColor: T.faint }}>
              <span style={{ ...CAPS, fontSize: 11, letterSpacing: "0.18em" }}>
                EDIT NOTES
              </span>
              <span style={{ ...CAPS, fontSize: 8, color: T.faint }} className="ml-3">
                {DATA.events.length} FRAMES MARKED
              </span>
            </div>
            {DATA.events.map((e) => (
              <div
                key={e.id}
                className="border-b py-[9px]"
                style={{ borderColor: "rgba(220,214,201,0.12)" }}
              >
                <div className="flex items-baseline gap-2">
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.grease }}>
                    {String(e.n).padStart(2, "0")}
                    {e.symbol}
                  </span>
                  <span style={{ ...CAPS, fontSize: 9, letterSpacing: "0.08em", color: T.text }}>
                    {e.label}
                  </span>
                </div>
                <div style={{ ...CAPS, fontSize: 7.5, color: T.dim }}>
                  {e.dateStr} · {e.relative} · {e.kind}
                </div>
                <p style={{ fontSize: 10, lineHeight: "14px", color: T.dim, marginTop: 2 }}>
                  {e.detail}
                </p>
                <p style={{ ...CAPS, fontSize: 6.5, color: T.faint, marginTop: 2 }}>
                  {e.basis}
                </p>
              </div>
            ))}

            <div className="mt-4">
              <div style={{ ...CAPS, fontSize: 8, color: T.faint }}>FILM STOCKS — RESIDENCES</div>
              <div className="mt-2 flex flex-col gap-[4px]">
                {DATA.places.map((p) => (
                  <div key={p.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span aria-hidden style={{ width: 7, height: 7, backgroundColor: p.hex }} />
                      <span style={{ ...CAPS, fontSize: 8, color: T.dim }}>{p.label}</span>
                    </span>
                    <span style={{ ...MONO, fontSize: 8, color: T.faint }}>{p.years}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span style={{ ...CAPS, fontSize: 8, color: T.text, border: `1px solid ${T.text}`, padding: "4px 9px" }}>
                PLACES
              </span>
              <span style={{ ...CAPS, fontSize: 8, color: T.text, border: `1px solid ${T.faint}`, padding: "4px 9px" }}>
                MAP YOUR LIFE →
              </span>
            </div>

            <div className="mt-4" style={{ ...MONO, fontSize: 8, color: T.faint }}>
              {SYMBOL_KEY.map((k) => `${k.symbol} ${k.label}`).join(" · ")}
            </div>
            <div className="mt-2" style={{ ...CAPS, fontSize: 8, color: T.faint }}>
              {DATA.disclaimerShort}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
