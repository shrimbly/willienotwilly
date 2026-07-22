import type { Metadata } from "next";

import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  dodge,
  mixHex,
} from "@/components/lab/perspective-clock/static-data";

// Direction 1 — OBSERVATORY PLATE.
// The instrument keeps its monochrome survey-plate identity, but the reading
// experience changes: nothing hides behind hover. Every moment is pinned by a
// leader line to an annotation in the margins — recorded facts on the left,
// projected arithmetic on the right — like a labelled astronomical plate.

export const metadata: Metadata = {
  title: "Perspective Clock — Observatory Plate",
  robots: { index: false, follow: false },
};

const T = {
  bg: "#060707",
  cellOpen: "#242626",
  cellFilled: "#C9CFCC",
  text: "#DDE2E0",
  dim: "#7A827F",
  faint: "#4A4F4E",
  live: "#63E2B7",
  hair: "rgba(255,255,255,0.09)",
  hairStrong: "rgba(255,255,255,0.26)",
};

const CELL = 11;
const PITCH = 13;
const DECADE_GUTTER = 8;
const COL_W = 270;
const COL_GAP = 40;
const AXIS_W = 30;
const GRID_X = COL_W + COL_GAP + AXIS_W;
const GRID_W = 52 * PITCH - 2;
const RIGHT_X = GRID_X + GRID_W + COL_GAP;
const CANVAS_W = RIGHT_X + COL_W;

const rowY = (r: number) => r * PITCH + Math.floor(r / 10) * DECADE_GUTTER;
const GRID_H = rowY(DATA.yearCount - 1) + CELL;

const LABEL: React.CSSProperties = {
  fontSize: 10,
  lineHeight: "16px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function ObservatoryPage() {
  const recorded = DATA.events.filter((e) => e.isPast);
  const projected = DATA.events.filter((e) => !e.isPast);
  const ENTRY_H = 84;
  const leftSlots = dodge(
    recorded.map((e) => rowY(e.row) - 8),
    ENTRY_H + 14,
    0,
    GRID_H - ENTRY_H,
  );
  const rightSlots = dodge(
    projected.map((e) => rowY(e.row) - 8),
    ENTRY_H + 6,
    0,
    GRID_H - ENTRY_H,
  );

  return (
    <div
      className="min-h-screen overflow-x-auto"
      style={{
        backgroundColor: T.bg,
        color: T.text,
        fontFamily: "var(--font-geist-mono)",
      }}
    >
      <div className="mx-auto px-8 py-7" style={{ width: CANVAS_W + 64 }}>
        {/* Masthead */}
        <header className="flex items-start justify-between">
          <div>
            <div
              style={{
                fontSize: 13,
                lineHeight: "20px",
                fontWeight: 500,
                letterSpacing: "0.12em",
              }}
            >
              PERSPECTIVE CLOCK
            </div>
            <div style={{ ...LABEL, color: T.dim }}>
              <span style={{ color: T.text }}>LIFE</span>
              <span style={{ color: T.faint }}>{" · "}</span>
              AGE {DATA.ageYears.toFixed(2)}/{DATA.expectancyYears.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 16, lineHeight: "20px", fontWeight: 500 }}>
              <span
                aria-hidden
                className="mr-2 inline-block align-middle"
                style={{ width: 5, height: 5, backgroundColor: T.live }}
              />
              {DATA.clock}
            </div>
            <div style={{ ...LABEL, color: T.dim }}>
              {DATA.tz}
              <span style={{ color: T.faint }}>{" · "}</span>LOCAL
            </div>
          </div>
        </header>

        {/* Column headers */}
        <div className="mt-8 flex" style={{ width: CANVAS_W }}>
          <div style={{ ...LABEL, width: COL_W, textAlign: "right", color: T.dim }}>
            RECORDED <span style={{ color: T.faint }}>— WHAT HAPPENED</span>
          </div>
          <div style={{ width: GRID_X - COL_W + GRID_W }} />
          <div style={{ ...LABEL, width: COL_W, color: T.dim, paddingLeft: 0, marginLeft: COL_GAP }}>
            PROJECTED <span style={{ color: T.faint }}>— WHAT THE ARITHMETIC SAYS</span>
          </div>
        </div>

        {/* The plate */}
        <div
          className="relative mt-3"
          style={{ width: CANVAS_W, height: GRID_H }}
        >
          {/* Leader lines */}
          <svg
            aria-hidden
            className="absolute inset-0"
            width={CANVAS_W}
            height={GRID_H}
          >
            {recorded.map((e, i) => {
              const mx = GRID_X + e.col * PITCH + CELL / 2;
              const my = rowY(e.row) + CELL / 2;
              const sy = leftSlots[i] + 8;
              return (
                <g key={e.id} stroke={T.hairStrong} strokeWidth={1} fill="none">
                  <line x1={mx - 8} y1={my} x2={COL_W + 12} y2={sy} />
                  <line x1={COL_W + 12} y1={sy} x2={COL_W + 4} y2={sy} />
                </g>
              );
            })}
            {projected.map((e, i) => {
              const mx = GRID_X + e.col * PITCH + CELL / 2;
              const my = rowY(e.row) + CELL / 2;
              const sy = rightSlots[i] + 8;
              return (
                <g key={e.id} stroke={T.hairStrong} strokeWidth={1} fill="none">
                  <line x1={mx + 8} y1={my} x2={RIGHT_X - 12} y2={sy} />
                  <line x1={RIGHT_X - 12} y1={sy} x2={RIGHT_X - 4} y2={sy} />
                </g>
              );
            })}
          </svg>

          {/* Age axis */}
          {DATA.years.map((row) =>
            row.age % 10 === 0 ? (
              <div key={row.age}>
                <span
                  className="absolute"
                  style={{
                    left: GRID_X - 8,
                    top: rowY(row.age) + CELL / 2,
                    width: 6,
                    height: 1,
                    backgroundColor: T.hairStrong,
                  }}
                />
                <span
                  className="absolute"
                  style={{
                    ...LABEL,
                    left: GRID_X - AXIS_W - 2,
                    top: rowY(row.age) - 2,
                    width: AXIS_W - 10,
                    textAlign: "right",
                    color: row.age === 30 ? T.text : T.dim,
                  }}
                >
                  {row.age}
                </span>
              </div>
            ) : null,
          )}

          {/* Week grid */}
          {DATA.years.map((row) => (
            <div
              key={row.year}
              className="absolute flex"
              style={{
                left: GRID_X + row.startCol * PITCH,
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
                        ? T.live
                        : w.state === "future"
                          ? T.cellOpen
                          : w.place
                            ? mixHex(w.place, T.cellFilled, 0.3)
                            : T.cellFilled,
                  }}
                />
              ))}
            </div>
          ))}

          {/* Event markers */}
          {DATA.events.map((e) => (
            <span
              key={e.id}
              className="absolute flex items-center justify-center"
              style={{
                left: GRID_X + e.col * PITCH,
                top: rowY(e.row),
                width: CELL,
                height: CELL,
                fontSize: 9,
                color: e.isPast ? "#0A0B0B" : T.text,
              }}
            >
              {e.symbol}
            </span>
          ))}

          {/* Recorded annotations — left margin */}
          {recorded.map((e, i) => (
            <div
              key={e.id}
              className="absolute text-right"
              style={{ left: 0, top: leftSlots[i], width: COL_W }}
            >
              <div style={{ fontSize: 11, lineHeight: "16px", letterSpacing: "0.06em" }}>
                <span style={{ color: T.faint }}>
                  {String(e.n).padStart(2, "0")}{" "}
                </span>
                <span aria-hidden>{e.symbol} </span>
                {e.label.toUpperCase()}
              </div>
              <div style={{ ...LABEL, color: T.dim }}>
                {e.dateStr}
                <span style={{ color: T.faint }}>{" · "}</span>
                {e.relative}
              </div>
              <p
                className="line-clamp-2"
                style={{
                  fontSize: 10,
                  lineHeight: "14px",
                  marginTop: 2,
                  color: T.dim,
                }}
              >
                {e.detail}
              </p>
              <p
                className="line-clamp-1"
                style={{
                  fontSize: 8,
                  lineHeight: "12px",
                  marginTop: 2,
                  letterSpacing: "0.08em",
                  color: T.faint,
                }}
              >
                {e.basis}
              </p>
            </div>
          ))}

          {/* Projected annotations — right margin */}
          {projected.map((e, i) => (
            <div
              key={e.id}
              className="absolute"
              style={{ left: RIGHT_X, top: rightSlots[i], width: COL_W }}
            >
              <div style={{ fontSize: 11, lineHeight: "16px", letterSpacing: "0.06em" }}>
                <span style={{ color: T.faint }}>
                  {String(e.n).padStart(2, "0")}{" "}
                </span>
                <span aria-hidden>{e.symbol} </span>
                {e.label.toUpperCase()}
              </div>
              <div style={{ ...LABEL, color: T.dim }}>
                {e.dateStr}
                <span style={{ color: T.faint }}>{" · "}</span>
                {e.relative}
              </div>
              <p
                className="line-clamp-2"
                style={{
                  fontSize: 10,
                  lineHeight: "14px",
                  marginTop: 2,
                  color: T.dim,
                }}
              >
                {e.detail}
              </p>
              <p
                className="line-clamp-1"
                style={{
                  fontSize: 8,
                  lineHeight: "12px",
                  marginTop: 2,
                  letterSpacing: "0.08em",
                  color: T.faint,
                }}
              >
                {e.basis}
              </p>
            </div>
          ))}
        </div>

        {/* Plate caption */}
        <div
          className="mx-auto mt-9 flex flex-col items-center gap-2"
          style={{ width: CANVAS_W }}
        >
          <div style={{ ...LABEL, color: T.dim }}>
            PLATE IV — ONE LIFE IN {DATA.totalWeeks.toLocaleString("en-US")}{" "}
            WEEKS
            <span style={{ color: T.faint }}>{" · "}</span>
            <span style={{ color: T.faint }}>{DATA.disclaimerShort}</span>
          </div>
          <div style={{ ...LABEL, color: T.dim }} className="flex gap-5">
            {SYMBOL_KEY.map((k) => (
              <span key={k.label}>
                <span aria-hidden style={{ color: T.text }}>
                  {k.symbol}
                </span>{" "}
                {k.label}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-5">
            {DATA.places.map((p) => (
              <span
                key={p.label}
                className="flex items-center gap-2"
                style={{ ...LABEL, color: T.dim }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    backgroundColor: mixHex(p.hex, T.cellFilled, 0.3),
                  }}
                />
                {p.label} <span style={{ color: T.faint }}>{p.years}</span>
              </span>
            ))}
          </div>
        </div>

        {/* HUD bar */}
        <footer
          className="mt-10 flex items-end justify-between border-t pt-5"
          style={{ width: CANVAS_W, borderColor: T.hair }}
        >
          <div className="flex gap-8">
            <div>
              <div style={{ ...LABEL, color: T.dim }}>ELAPSED</div>
              <div style={{ fontSize: 13, lineHeight: "20px" }}>
                {DATA.elapsedPct}
              </div>
            </div>
            <div>
              <div style={{ ...LABEL, color: T.dim }}>REMAINING</div>
              <div style={{ fontSize: 13, lineHeight: "20px" }}>
                {DATA.remaining}
              </div>
            </div>
            <div>
              <div style={{ ...LABEL, color: T.dim }}>CELL</div>
              <div style={{ fontSize: 13, lineHeight: "20px" }}>
                {DATA.cellText}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div style={{ ...LABEL, color: T.dim }}>
              [+/-] ZOOM
              <span style={{ color: T.faint }}>{" · "}</span>
              [0] NOW
              <span style={{ color: T.faint }}>{" · "}</span>
              [C] CALIBRATE
              <span style={{ color: T.faint }}>{" · "}</span>
              [P] PLACES
            </div>
            <div className="flex items-center gap-2">
              <span
                style={{
                  ...LABEL,
                  color: T.text,
                  border: `1px solid ${T.text}`,
                  padding: "4px 10px",
                }}
              >
                PLACES
              </span>
              <span
                style={{
                  ...LABEL,
                  color: T.text,
                  border: `1px solid ${T.hairStrong}`,
                  padding: "4px 10px",
                }}
              >
                MAP YOUR LIFE →
              </span>
            </div>
          </div>

          <div className="relative" style={{ width: 64, height: 72 }}>
            <span
              aria-hidden
              className="absolute right-0 top-0 h-full w-px"
              style={{ backgroundColor: T.hair }}
            />
            {([3, 2, 1, 0] as const).map((view, i) => (
              <span
                key={view}
                className="absolute flex w-full items-center justify-end gap-2"
                style={{ top: i * 18, height: 18 }}
              >
                <span
                  style={{
                    ...LABEL,
                    color: view === 3 ? T.text : T.dim,
                  }}
                >
                  {VIEW_NAMES[view]}
                </span>
                <span className="flex w-[10px] justify-end">
                  <span
                    style={{
                      width: view === 3 ? 10 : 4,
                      height: 1,
                      backgroundColor: view === 3 ? T.text : T.faint,
                    }}
                  />
                </span>
              </span>
            ))}
            <span
              aria-hidden
              className="absolute"
              style={{
                right: -1,
                top: 7.5,
                width: 3,
                height: 3,
                backgroundColor: T.text,
              }}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
