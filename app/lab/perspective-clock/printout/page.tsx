import type { Metadata } from "next";

import {
  DATA,
  type StaticYearRow,
} from "@/components/lab/perspective-clock/static-data";

// Direction 6 — PRINTOUT.
// The clock as a batch job. LIFE.RPT comes off a line printer onto green-bar
// paper: the grid is 52 characters per year, residences are code letters with
// a lookup table, moments are ASCII marks, and the only red on the ribbon is
// struck for the week now passing. A report you tear off and file.

export const metadata: Metadata = {
  title: "Perspective Clock — Printout",
  robots: { index: false, follow: false },
};

const T = {
  paper: "#F8FAF4",
  band: "#E9F1E3",
  ink: "#31383B",
  dim: "#7E8689",
  red: "#BF3B2B",
  holeEdge: "#D4DACB",
};

// The printer's character set for the four marker glyphs.
const ASCII_SYMBOL: Record<string, string> = {
  RECORD: "O",
  ESTIMATE: "*",
  PROBABILITY: "?",
  CROSSROAD: "X",
};

const PLACE_CODES = ["A", "B", "C", "D", "E", "F", "G", "H"];

interface Seg {
  text: string;
  tone?: "dim" | "red";
}

type Line = Seg[];

const RULE_EQ: Line = [{ text: "=".repeat(98) }];
const RULE_DASH: Line = [{ text: "-".repeat(98), tone: "dim" }];
const BLANK: Line = [{ text: " " }];

function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

function wrap(s: string, width: number): string[] {
  const words = s.split(" ");
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if (line.length + w.length + 1 > width && line.length > 0) {
      out.push(line);
      line = w;
    } else {
      line = line.length === 0 ? w : `${line} ${w}`;
    }
  }
  if (line.length > 0) out.push(line);
  return out;
}

function placeCode(hex: string | undefined): string {
  if (!hex) return "#";
  const i = DATA.places.findIndex((p) => p.hex === hex);
  return i === -1 ? "#" : PLACE_CODES[i];
}

/** One grid row: `1991 A00 <52 chars>  <-- 04 MY SON WAS BORN`. */
function gridLine(row: StaticYearRow): Line {
  const events = DATA.events.filter((e) => e.row === row.age);
  const eventCol = new Map(events.map((e) => [e.col, e]));
  const chars: { ch: string; red: boolean }[] = [];
  for (let c = 0; c < 52; c++) {
    const w = row.weeks.find((x) => x.col === c);
    if (!w) {
      chars.push({ ch: " ", red: false });
      continue;
    }
    const ev = eventCol.get(c);
    if (ev) {
      chars.push({ ch: ASCII_SYMBOL[ev.kind], red: false });
    } else if (w.state === "live") {
      chars.push({ ch: "@", red: true });
    } else if (w.state === "future") {
      chars.push({ ch: ".", red: false });
    } else {
      chars.push({ ch: placeCode(w.place), red: false });
    }
  }

  const segs: Line = [
    { text: `${row.year} `, tone: "dim" },
    { text: `${pad(`A${String(row.age).padStart(2, "0")}`, 4)}`, tone: "dim" },
  ];
  // Merge run-length so the live '@' can carry ribbon red.
  let buf = "";
  let red = false;
  for (const { ch, red: r } of chars) {
    if (r !== red && buf.length > 0) {
      segs.push(red ? { text: buf, tone: "red" } : { text: buf });
      buf = "";
    }
    red = r;
    buf += ch;
  }
  if (buf.length > 0) segs.push(red ? { text: buf, tone: "red" } : { text: buf });

  if (events.length > 0) {
    segs.push({
      text: `  <-- ${events
        .map((e) => `${String(e.n).padStart(2, "0")} ${e.label.toUpperCase()}`)
        .join(" / ")}`,
      tone: "dim",
    });
  }
  return segs;
}

function buildReport(): Line[] {
  const L: Line[] = [];
  const push = (...lines: Line[]) => L.push(...lines);

  push(
    RULE_EQ,
    [
      { text: pad("PERSPECTIVE CLOCK  v2.0", 50) },
      { text: `RUN DATE ${DATA.dateStr}  ${DATA.clock} ${DATA.tz}`, tone: "dim" },
    ],
    [
      { text: pad("JOB ....... LIFE.RPT", 50) },
      { text: "OPERATOR . WILLIE (AUTHOR PROFILE)", tone: "dim" },
    ],
    RULE_EQ,
    BLANK,
    [{ text: `MODE ...... ${DATA.modeLine}` }],
    [{ text: `ELAPSED ... ${DATA.elapsedPct} OF THE ESTIMATED SPAN` }],
    [{ text: `REMAINING . ${DATA.remaining}` }],
    [{ text: `CELL ...... WEEK ${DATA.cellText}  (ONE CHAR = ONE WEEK)` }],
    [{ text: `SPAN ...... BORN ${DATA.dobStr}  ->  EST. END ${DATA.expectancyStr}  (${DATA.expectancyYears.toFixed(1)} YR)` }],
    BLANK,
    [
      { text: "VIEWS ..... DAY   WEEK   YEAR  ", tone: "dim" },
      { text: "[LIFE]" },
      { text: "        KEYS: [+/-] ZOOM  [0] NOW  [C] CALIBRATE  [P] PLACES", tone: "dim" },
    ],
    [
      { text: "SWITCHES .. ", tone: "dim" },
      { text: "[ PLACES: ON ]  [ MAP YOUR LIFE -> ]" },
    ],
    BLANK,
    RULE_DASH,
    [{ text: "RESIDENCE TABLE                          MARK TABLE" }],
    RULE_DASH,
  );

  const marks = [
    ["O", "RECORD", "A DATED FACT"],
    ["*", "ESTIMATE", "ARITHMETIC ON FACTS"],
    ["?", "PROBABILITY", "A POPULATION CURVE"],
    ["X", "CROSSROAD", "A FORK IN THE PATH"],
  ];
  DATA.places.forEach((p, i) => {
    const left = `${PLACE_CODES[i]}  ${pad(p.label.toUpperCase(), 12)} ${pad(p.years, 10)} ${p.duration}`;
    const mark = marks[i];
    push([
      { text: pad(left, 41) },
      mark
        ? { text: `${mark[0]}  ${pad(mark[1], 12)} ${mark[2]}`, tone: "dim" }
        : { text: "" },
    ]);
  });
  push([
    { text: pad("@  CURRENT WEEK — STRUCK IN RED RIBBON", 41), tone: "red" },
    { text: ".  A WEEK NOT YET LIVED", tone: "dim" },
  ]);

  push(
    BLANK,
    RULE_DASH,
    [{ text: "GRID — ONE LINE PER YEAR OF AGE" }],
    RULE_DASH,
    [
      {
        text: "YEAR AGE 1---------13------------26------------39----------52",
        tone: "dim",
      },
    ],
  );

  for (const row of DATA.years) {
    push(gridLine(row));
    if (row.age === DATA.nowRow) {
      push([
        {
          text: `>>>>>>>>> YOU ARE HERE  ${DATA.weekday} ${DATA.dateStr}  ${DATA.clock} ${DATA.tz} <<<<<<<<<`,
          tone: "red",
        },
      ]);
    }
  }

  push(
    BLANK,
    RULE_DASH,
    [{ text: `EVENT REGISTER — ${DATA.events.length} ENTRIES, CHRONOLOGICAL` }],
    RULE_DASH,
  );
  for (const e of DATA.events) {
    push(BLANK, [
      { text: `${String(e.n).padStart(2, "0")}  ${ASCII_SYMBOL[e.kind]}  ` },
      { text: `${e.dateStr}  ${pad(e.relative, 11)} `, tone: "dim" },
      { text: e.label.toUpperCase() },
    ]);
    for (const line of wrap(e.detail, 72)) {
      push([{ text: `           ${line}`, tone: "dim" }]);
    }
    push([{ text: `           ${e.kind} — ${e.basis}`, tone: "dim" }]);
  }

  push(
    BLANK,
    RULE_DASH,
    [{ text: "NOTES" }],
    RULE_DASH,
  );
  for (const line of wrap(DATA.disclaimerLong, 90)) {
    push([{ text: line, tone: "dim" }]);
  }
  push(
    BLANK,
    [{ text: `*** END OF REPORT — ${DATA.disclaimerShort} ***` }],
    RULE_EQ,
  );
  return L;
}

const REPORT = buildReport();

export default function PrintoutPage() {
  return (
    <div
      className="min-h-screen py-10"
      style={{ backgroundColor: "#B9BDB2", fontFamily: "var(--font-geist-mono)" }}
    >
      <div
        className="mx-auto flex"
        style={{ width: 1010, boxShadow: "0 2px 14px rgba(30,35,30,0.35)" }}
      >
        {/* Left sprocket strip */}
        <SprocketStrip side="left" />

        {/* The paper */}
        <div
          className="flex-1 px-6 py-8"
          style={{
            color: T.ink,
            fontSize: 12.5,
            lineHeight: "16px",
            whiteSpace: "pre",
            background: `repeating-linear-gradient(180deg, ${T.band} 0px, ${T.band} 32px, ${T.paper} 32px, ${T.paper} 64px)`,
            overflowX: "auto",
          }}
        >
          {REPORT.map((line, i) => (
            <div key={i}>
              {line.map((seg, j) => (
                <span
                  key={j}
                  style={{
                    color:
                      seg.tone === "red"
                        ? T.red
                        : seg.tone === "dim"
                          ? T.dim
                          : T.ink,
                  }}
                >
                  {seg.text}
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Right sprocket strip */}
        <SprocketStrip side="right" />
      </div>
    </div>
  );
}

function SprocketStrip({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className="w-[42px] flex-none"
      style={{
        backgroundColor: T.paper,
        backgroundImage: `radial-gradient(circle at 21px 16px, #AEB2A6 5px, ${T.holeEdge} 5.5px, transparent 7px)`,
        backgroundSize: "42px 32px",
        borderRight: side === "left" ? `1px dashed ${T.holeEdge}` : undefined,
        borderLeft: side === "right" ? `1px dashed ${T.holeEdge}` : undefined,
      }}
    />
  );
}
