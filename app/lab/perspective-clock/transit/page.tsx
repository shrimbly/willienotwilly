import type { Metadata } from "next";
import { IBM_Plex_Sans_Condensed } from "next/font/google";

import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  type StaticEvent,
} from "@/components/lab/perspective-clock/static-data";

// Direction 3 — TRANSIT.
// Time as a route, not a grid. One horizontal band runs birth → estimated end
// across the full viewport; residences are the coloured substrate, the NOW
// cursor slices the whole composition, and every moment hangs off the line as
// a signal flag. Below, the full detail reads as a departures board: what has
// departed, what is scheduled.

export const metadata: Metadata = {
  title: "Perspective Clock — Transit",
  robots: { index: false, follow: false },
};

const plex = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-condensed",
});

const T = {
  bg: "#101318",
  panel: "#14181E",
  hair: "rgba(255,255,255,0.08)",
  hairStrong: "rgba(255,255,255,0.22)",
  board: "#EAE8E0",
  dim: "#8B9097",
  faint: "#575D65",
  live: "#63E2B7",
  future: "#1A1F26",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-mono)" };
const CAPS: React.CSSProperties = {
  fontSize: 11,
  lineHeight: "16px",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const LANES = 6;
const LANE_H = 26;
const FLAGS_H = LANES * LANE_H + 10;
const STRIP_H = 108;
const REF_W = 1380; // label-collision estimate only; positions are in %

function flagText(e: StaticEvent): string {
  return `${e.dateStr.slice(0, 4)} · ${e.label.toUpperCase()}`;
}

interface FlagPos {
  lane: number;
  /** Label anchor in % — clamped left so late labels stay inside the strip. */
  labelPct: number;
}

/** First-fit lanes at the reference width so labels never overprint. */
function placeFlags(events: StaticEvent[]): FlagPos[] {
  const laneEnd = new Array<number>(LANES).fill(-Infinity);
  return events.map((e) => {
    const width = flagText(e).length * 6.2 + 30;
    const x = Math.min(e.t * REF_W, REF_W - width);
    let lane = laneEnd.findIndex((end) => x > end + 8);
    if (lane === -1) {
      let min = 0;
      for (let i = 1; i < LANES; i++) {
        if (laneEnd[i] < laneEnd[min]) min = i;
      }
      lane = min;
    }
    laneEnd[lane] = x + width;
    return { lane, labelPct: (x / REF_W) * 100 };
  });
}

export default function TransitPage() {
  const flags = placeFlags(DATA.events);
  const departed = DATA.events.filter((e) => e.isPast);
  const scheduled = DATA.events.filter((e) => !e.isPast);
  const nowPct = DATA.fraction * 100;

  return (
    <div
      className={plex.variable}
      style={{
        backgroundColor: T.bg,
        color: T.board,
        fontFamily: "var(--font-plex-condensed)",
        minHeight: "100vh",
      }}
    >
      {/* Cockpit bar */}
      <header
        className="flex items-center justify-between border-b px-6 py-3"
        style={{ borderColor: T.hairStrong }}
      >
        <div className="flex items-baseline gap-4">
          <span style={{ ...CAPS, fontSize: 13, letterSpacing: "0.2em" }}>
            PERSPECTIVE CLOCK
          </span>
          <span style={{ ...CAPS, color: T.dim }}>
            LIFE LINE · AGE {DATA.ageYears.toFixed(2)} OF{" "}
            {DATA.expectancyYears.toFixed(2)}
          </span>
        </div>
        <div style={{ ...CAPS, color: T.faint }} className="hidden md:block">
          [+/-] ZOOM · [0] NOW · [C] CALIBRATE · [P] PLACES
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            style={{ width: 5, height: 5, backgroundColor: T.live }}
          />
          <span style={{ ...MONO, fontSize: 14 }}>{DATA.clock}</span>
          <span style={{ ...CAPS, color: T.dim }}>{DATA.tz} LOCAL</span>
        </div>
      </header>

      {/* The line */}
      <section className="overflow-x-clip px-6 pb-2 pt-10">
        <div className="relative">
          {/* Signal flags — stems stand at the true week; labels clamp inside. */}
          <div className="relative" style={{ height: FLAGS_H }}>
            {DATA.events.map((e, i) => {
              const { lane, labelPct } = flags[i];
              const top = FLAGS_H - 10 - (lane + 1) * LANE_H;
              return (
                <div key={e.id}>
                  <div
                    className="absolute whitespace-nowrap"
                    style={{
                      ...CAPS,
                      left: `${labelPct}%`,
                      top,
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      paddingLeft: 5,
                      color: e.isPast ? T.board : T.dim,
                    }}
                  >
                    <span aria-hidden style={{ ...MONO, fontSize: 9 }}>
                      {e.symbol}
                    </span>{" "}
                    {flagText(e)}
                  </div>
                  <span
                    aria-hidden
                    className="absolute"
                    style={{
                      left: `${e.t * 100}%`,
                      top: top + 15,
                      width: 1,
                      height: FLAGS_H - top - 15,
                      backgroundColor: e.isPast ? T.hairStrong : T.hair,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* The strip: residences as substrate, hatch beyond now */}
          <div
            className="relative overflow-hidden"
            style={{ height: STRIP_H, backgroundColor: T.future }}
          >
            {DATA.places.map((p) => (
              <div
                key={p.label}
                className="absolute inset-y-0"
                style={{
                  left: `${p.tStart * 100}%`,
                  width: `${(p.tEnd - p.tStart) * 100}%`,
                  backgroundColor: p.hex,
                }}
              >
                {p.tEnd - p.tStart > 0.07 ? (
                  <div className="px-3 py-2">
                    <div
                      style={{
                        ...CAPS,
                        fontSize: 12,
                        color: "rgba(10,11,11,0.82)",
                      }}
                    >
                      {p.label}
                    </div>
                    <div
                      style={{
                        ...MONO,
                        fontSize: 9,
                        color: "rgba(10,11,11,0.6)",
                      }}
                    >
                      {p.years}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {/* Year graduation texture + future hatch */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 17.25px)",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-y-0 right-0"
              style={{
                left: `${nowPct}%`,
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent 0px, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 7px)",
              }}
            />
            {/* Estimated end cap */}
            <div
              className="absolute inset-y-0 right-0 flex flex-col items-end justify-center pr-3"
              style={{ borderRight: `2px solid ${T.hairStrong}` }}
            >
              <span style={{ ...CAPS, fontSize: 10, color: T.dim }}>
                ✱ EST. END
              </span>
              <span style={{ ...MONO, fontSize: 9, color: T.faint }}>
                {DATA.expectancyStr} · {DATA.expectancyYears.toFixed(1)} YR
              </span>
            </div>
          </div>

          {/* NOW cursor slicing the whole composition */}
          <div
            aria-hidden
            className="absolute"
            style={{
              left: `${nowPct}%`,
              top: 0,
              bottom: -34,
              width: 2,
              backgroundColor: T.live,
            }}
          />
          <div
            className="absolute whitespace-nowrap"
            style={{
              left: `${nowPct}%`,
              top: -26,
              paddingLeft: 7,
              color: T.live,
            }}
          >
            <span style={{ ...CAPS, fontSize: 10 }}>
              NOW · AGE {DATA.ageYears.toFixed(2)} · WEEK {DATA.cellText}
            </span>
          </div>

          {/* Age scale */}
          <div className="relative" style={{ height: 34 }}>
            {Array.from({ length: 9 }, (_, i) => i * 10).map((age) => (
              <div
                key={age}
                className="absolute"
                style={{ left: `${(age / DATA.expectancyYears) * 100}%` }}
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-0"
                  style={{
                    width: 1,
                    height: 7,
                    backgroundColor: T.hairStrong,
                  }}
                />
                <span
                  className="absolute top-[9px] whitespace-nowrap"
                  style={{
                    ...MONO,
                    fontSize: 9,
                    color: T.dim,
                    transform: age === 0 ? undefined : "translateX(-50%)",
                  }}
                >
                  {age === 0 ? `AGE 0 · ${DATA.firstYear}` : age}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Legend under the line */}
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t pt-4"
          style={{ borderColor: T.hair }}
        >
          <div className="flex flex-wrap items-center gap-5">
            {DATA.places.map((p) => (
              <span key={p.label} className="flex items-center gap-2">
                <span
                  aria-hidden
                  style={{ width: 8, height: 8, backgroundColor: p.hex }}
                />
                <span style={{ ...CAPS, fontSize: 10, color: T.dim }}>
                  {p.label} <span style={{ color: T.faint }}>{p.years}</span>
                </span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span
              style={{
                ...CAPS,
                fontSize: 10,
                color: T.board,
                border: `1px solid ${T.board}`,
                padding: "4px 10px",
              }}
            >
              PLACES
            </span>
            <span
              style={{
                ...CAPS,
                fontSize: 10,
                color: T.board,
                border: `1px solid ${T.hairStrong}`,
                padding: "4px 10px",
              }}
            >
              MAP YOUR LIFE →
            </span>
          </div>
        </div>
      </section>

      {/* The manifest */}
      <section className="grid gap-10 px-6 py-10 lg:grid-cols-[2fr_3fr]">
        {[
          { title: "DEPARTED", note: "RECORDED FACTS", rows: departed },
          { title: "SCHEDULED", note: "ESTIMATES & PROBABILITIES", rows: scheduled },
        ].map((board) => (
          <div key={board.title}>
            <div
              className="flex items-baseline justify-between border-b pb-2"
              style={{ borderColor: T.hairStrong }}
            >
              <span style={{ ...CAPS, fontSize: 14, letterSpacing: "0.22em" }}>
                {board.title}
              </span>
              <span style={{ ...CAPS, fontSize: 9, color: T.faint }}>
                {board.note} · {board.rows.length}
              </span>
            </div>
            {board.rows.map((e) => (
              <div
                key={e.id}
                className="grid items-baseline gap-x-4 border-b py-3"
                style={{
                  borderColor: T.hair,
                  gridTemplateColumns: "34px 1fr auto",
                }}
              >
                <span style={{ ...MONO, fontSize: 10, color: T.faint }}>
                  {String(e.n).padStart(2, "0")}
                </span>
                <div>
                  <div
                    style={{
                      ...CAPS,
                      fontSize: 13,
                      letterSpacing: "0.08em",
                      color: T.board,
                    }}
                  >
                    <span aria-hidden style={{ ...MONO, fontSize: 10 }}>
                      {e.symbol}
                    </span>{" "}
                    {e.label}
                  </div>
                  <p
                    className="mt-1 max-w-[52ch]"
                    style={{
                      fontSize: 12,
                      lineHeight: "17px",
                      fontWeight: 400,
                      color: T.dim,
                    }}
                  >
                    {e.detail}
                  </p>
                  <p
                    className="mt-1"
                    style={{
                      ...MONO,
                      fontSize: 8,
                      letterSpacing: "0.08em",
                      color: T.faint,
                    }}
                  >
                    {e.kind} · {e.basis}
                  </p>
                </div>
                <div className="text-right">
                  <div style={{ ...MONO, fontSize: 11 }}>{e.dateStr}</div>
                  <div
                    style={{
                      ...MONO,
                      fontSize: 10,
                      color: e.isPast ? T.faint : T.live,
                    }}
                  >
                    {e.relative}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Bottom bar */}
      <footer
        className="flex flex-wrap items-center justify-between gap-6 border-t px-6 py-4"
        style={{ borderColor: T.hairStrong }}
      >
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
              <div style={{ ...MONO, fontSize: 12 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Route-map view selector */}
        <div className="flex items-center">
          {VIEW_NAMES.map((v, i) => (
            <span key={v} className="flex items-center">
              {i > 0 ? (
                <span
                  aria-hidden
                  style={{
                    width: 34,
                    height: 1,
                    backgroundColor: T.hairStrong,
                  }}
                />
              ) : null}
              <span className="flex flex-col items-center gap-1 px-1">
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: v === "LIFE" ? T.live : "transparent",
                    border: `1px solid ${v === "LIFE" ? T.live : T.hairStrong}`,
                  }}
                />
                <span
                  style={{
                    ...CAPS,
                    fontSize: 9,
                    color: v === "LIFE" ? T.board : T.faint,
                  }}
                >
                  {v}
                </span>
              </span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-5">
          <span className="flex gap-3" style={{ ...MONO, fontSize: 9, color: T.dim }}>
            {SYMBOL_KEY.map((k) => (
              <span key={k.label}>
                {k.symbol} {k.label}
              </span>
            ))}
          </span>
          <span style={{ ...CAPS, fontSize: 9, color: T.faint }}>
            {DATA.disclaimerShort}
          </span>
        </div>
      </footer>
    </div>
  );
}
