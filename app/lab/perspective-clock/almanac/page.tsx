import type { Metadata } from "next";
import { Newsreader } from "next/font/google";

import {
  DATA,
  SYMBOL_KEY,
  VIEW_NAMES,
  fmtInt,
  type StaticYearRow,
} from "@/components/lab/perspective-clock/static-data";

// Direction 2 — THE ALMANAC.
// The opposite user experience to an instrument: a document. Life typeset as
// a civil register you read top to bottom — decades as chapters, each year a
// punch-card line of weeks in the flow, every event a ledger entry at its
// place in the record. The only red on the page is the registrar's mark: now.

export const metadata: Metadata = {
  title: "Perspective Clock — Almanac",
  robots: { index: false, follow: false },
};

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
});

const T = {
  paper: "#F4F3EE",
  ink: "#22241F",
  dim: "#6E7069",
  faint: "#A3A49B",
  rule: "#DAD9D0",
  ruleStrong: "#B9B8AE",
  lived: "#2A2C27",
  open: "#CFCEC4",
  stamp: "#A63D2C",
  viridian: "#2A6B54",
};

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-geist-mono)",
};
const CAPS: React.CSSProperties = {
  ...MONO,
  fontSize: 10,
  lineHeight: "16px",
  fontWeight: 500,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

function decadeRows(): StaticYearRow[][] {
  const groups: StaticYearRow[][] = [];
  for (const row of DATA.years) {
    const k = Math.floor(row.age / 10);
    (groups[k] ??= []).push(row);
  }
  return groups;
}

function WeekSquares({ row }: { row: StaticYearRow }) {
  return (
    <div className="flex" style={{ gap: 2, paddingLeft: row.startCol * 10 }}>
      {row.weeks.map((w) => (
        <span
          key={w.col}
          style={{
            width: 8,
            height: 8,
            backgroundColor:
              w.state === "live"
                ? T.stamp
                : w.state === "future"
                  ? "transparent"
                  : (w.place ?? T.lived),
            boxShadow:
              w.state === "future" ? `inset 0 0 0 1px ${T.open}` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default function AlmanacPage() {
  const groups = decadeRows();
  const eventsByRow = new Map<number, typeof DATA.events>();
  for (const e of DATA.events) {
    const list = eventsByRow.get(e.row) ?? [];
    list.push(e);
    eventsByRow.set(e.row, list);
  }

  return (
    <div
      className={newsreader.variable}
      style={{
        backgroundColor: T.paper,
        color: T.ink,
        fontFamily: "var(--font-newsreader)",
        minHeight: "100vh",
      }}
    >
      <div className="mx-auto max-w-[780px] px-6 py-16">
        {/* Title block — set like a certificate. */}
        <header
          className="border p-1 text-center"
          style={{ borderColor: T.ruleStrong }}
        >
          <div className="border px-8 py-10" style={{ borderColor: T.rule }}>
            <div style={{ ...CAPS, color: T.dim }}>
              LAB REGISTER · ENTRY No. 5 · LIFE VIEW
            </div>
            <h1
              className="mt-4"
              style={{
                fontSize: 46,
                lineHeight: "52px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              The Perspective Clock
            </h1>
            <p
              className="mx-auto mt-3 max-w-[46ch]"
              style={{
                fontStyle: "italic",
                fontSize: 17,
                lineHeight: "26px",
                color: T.dim,
              }}
            >
              Being a complete account of one measured life — what is recorded,
              what is estimated, and what is merely probable.
            </p>

            <div
              className="mx-auto mt-8 grid grid-cols-4 border-t pt-5"
              style={{ borderColor: T.rule }}
            >
              {[
                {
                  label: "OBSERVED",
                  value: DATA.clock,
                  sub: `${DATA.weekday} ${DATA.dateStr} · ${DATA.tz}`,
                },
                { label: "ELAPSED", value: DATA.elapsedPct, sub: DATA.modeLine },
                {
                  label: "REMAINING",
                  value: DATA.remaining,
                  sub: `OF ${DATA.expectancyYears.toFixed(1)} YR ESTIMATED`,
                },
                {
                  label: "WEEK",
                  value: DATA.cellText,
                  sub: "ONE SQUARE PER WEEK",
                },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ ...CAPS, color: T.faint }}>{s.label}</div>
                  <div style={{ ...MONO, fontSize: 13, lineHeight: "22px" }}>
                    {s.value}
                  </div>
                  <div style={{ ...CAPS, fontSize: 8, color: T.faint }}>
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6" style={{ ...CAPS, color: T.dim }}>
              VIEWS IN THIS REGISTER{" "}
              {VIEW_NAMES.map((v, i) => (
                <span key={v}>
                  {i > 0 ? <span style={{ color: T.faint }}> · </span> : " "}
                  <span
                    style={
                      v === "LIFE"
                        ? {
                            color: T.viridian,
                            borderBottom: `1px solid ${T.viridian}`,
                          }
                        : { color: T.faint }
                    }
                  >
                    {v}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Front matter — residences and the vocabulary of certainty. */}
        <section className="mt-12 grid grid-cols-2 gap-10">
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Residences
            </h2>
            <div
              className="mt-3 border-t"
              style={{ borderColor: T.ruleStrong }}
            >
              {DATA.places.map((p) => (
                <div
                  key={p.label}
                  className="flex items-baseline justify-between border-b py-2"
                  style={{ borderColor: T.rule }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      style={{ width: 8, height: 8, backgroundColor: p.hex }}
                    />
                    <span style={{ fontSize: 15 }}>{p.label}</span>
                  </span>
                  <span style={{ ...MONO, fontSize: 11, color: T.dim }}>
                    {p.years}
                    <span style={{ color: T.faint }}> · {p.duration}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3" style={{ ...CAPS, color: T.dim }}>
              [×] RESIDENCES PRINTED IN THE WEEK LINES
            </div>
          </div>
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Marks used
            </h2>
            <div
              className="mt-3 border-t"
              style={{ borderColor: T.ruleStrong }}
            >
              {SYMBOL_KEY.map((k, i) => (
                <div
                  key={k.label}
                  className="flex items-baseline justify-between border-b py-2"
                  style={{ borderColor: T.rule }}
                >
                  <span style={{ ...MONO, fontSize: 12 }}>
                    {k.symbol}{" "}
                    <span style={{ ...CAPS, color: T.dim }}>{k.label}</span>
                  </span>
                  <span
                    style={{
                      fontStyle: "italic",
                      fontSize: 13,
                      color: T.dim,
                    }}
                  >
                    {
                      [
                        "a dated fact",
                        "arithmetic on facts",
                        "a population curve",
                        "a fork in the path",
                      ][i]
                    }
                  </span>
                </div>
              ))}
            </div>
            <p
              className="mt-3"
              style={{
                fontStyle: "italic",
                fontSize: 13,
                lineHeight: "20px",
                color: T.dim,
              }}
            >
              The week now passing is printed in{" "}
              <span style={{ color: T.stamp }}>registrar&rsquo;s red</span>.
            </p>
          </div>
        </section>

        {/* The record — decades as chapters. */}
        {groups.map((rows, k) => {
          const first = rows[0];
          const last = rows[rows.length - 1];
          const total = rows.reduce((acc, r) => acc + r.weeks.length, 0);
          const lived = rows.reduce(
            (acc, r) =>
              acc + r.weeks.filter((w) => w.state !== "future").length,
            0,
          );
          return (
            <section key={k} className="mt-14">
              <div className="flex items-baseline justify-between">
                <h2 style={{ fontSize: 22, fontWeight: 500 }}>
                  <span style={{ ...MONO, fontSize: 12, color: T.faint }}>
                    DECADE {ROMAN[k]}
                  </span>{" "}
                  <span className="ml-2">
                    {first.age === last.age
                      ? `Age ${first.age}`
                      : `Ages ${first.age}–${last.age}`}
                  </span>
                </h2>
                <span style={{ ...CAPS, color: T.dim }}>
                  {first.year}–{last.year}
                  <span style={{ color: T.faint }}>
                    {" · "}
                    {lived === total
                      ? `ALL ${fmtInt(total)} WEEKS LIVED`
                      : lived === 0
                        ? `${fmtInt(total)} WEEKS AHEAD`
                        : `${fmtInt(lived)} OF ${fmtInt(total)} WEEKS LIVED`}
                  </span>
                </span>
              </div>
              <div
                className="mt-2 border-t"
                style={{ borderColor: T.ruleStrong }}
              />

              {rows.map((row) => (
                <div key={row.year}>
                  <div
                    className="grid items-center gap-4 py-[5px]"
                    style={{ gridTemplateColumns: "104px 1fr" }}
                  >
                    <div className="flex items-baseline justify-between">
                      <span style={{ ...MONO, fontSize: 12 }}>{row.year}</span>
                      <span style={{ ...CAPS, fontSize: 8, color: T.faint }}>
                        AGE {row.age}
                      </span>
                    </div>
                    <WeekSquares row={row} />
                  </div>

                  {(eventsByRow.get(row.age) ?? []).map((e) => (
                    <div
                      key={e.id}
                      className="grid gap-4 py-3"
                      style={{ gridTemplateColumns: "104px 1fr" }}
                    >
                      <div
                        className="text-right"
                        style={{ ...MONO, fontSize: 10, color: T.dim }}
                      >
                        {e.dateStr}
                        <div style={{ color: T.faint }}>{e.relative}</div>
                      </div>
                      <div
                        className="border-l pl-4"
                        style={{
                          borderColor: e.crossroad ? T.ink : T.rule,
                        }}
                      >
                        <div className="flex items-baseline justify-between">
                          <span style={{ fontSize: 17, fontWeight: 500 }}>
                            <span aria-hidden style={{ ...MONO, fontSize: 12 }}>
                              {e.symbol}
                            </span>{" "}
                            {e.label}
                          </span>
                          <span style={{ ...CAPS, color: T.faint }}>
                            {e.kind}
                          </span>
                        </div>
                        <p
                          className="mt-1 max-w-[58ch]"
                          style={{
                            fontStyle: "italic",
                            fontSize: 14.5,
                            lineHeight: "22px",
                            color: T.dim,
                          }}
                        >
                          {e.detail}
                        </p>
                        <p
                          className="mt-1"
                          style={{ ...CAPS, fontSize: 8, color: T.faint }}
                        >
                          {e.basis}
                        </p>
                      </div>
                    </div>
                  ))}

                  {row.age === DATA.nowRow ? (
                    <div
                      className="my-3 flex items-center gap-3"
                      style={{ color: T.stamp }}
                    >
                      <span
                        className="h-px flex-1"
                        style={{ backgroundColor: T.stamp }}
                      />
                      <span style={{ ...CAPS, color: T.stamp }}>
                        YOU ARE HERE — {DATA.weekday} {DATA.dateStr} ·{" "}
                        {DATA.clock} {DATA.tz}
                      </span>
                      <span
                        className="h-px flex-1"
                        style={{ backgroundColor: T.stamp }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          );
        })}

        {/* Colophon */}
        <footer
          className="mt-16 border-t pt-8"
          style={{ borderColor: T.ruleStrong }}
        >
          <div className="flex items-center justify-between">
            <span style={{ ...CAPS, color: T.dim }}>
              TO AMEND THIS RECORD
            </span>
            <span
              style={{
                ...CAPS,
                color: T.ink,
                border: `1px solid ${T.ink}`,
                padding: "5px 12px",
              }}
            >
              MAP YOUR LIFE →
            </span>
          </div>
          <div className="mt-4" style={{ ...CAPS, color: T.faint }}>
            [+/-] ZOOM · [0] NOW · [C] CALIBRATE · [P] PLACES
          </div>
          <p
            className="mt-6"
            style={{
              fontStyle: "italic",
              fontSize: 13.5,
              lineHeight: "21px",
              color: T.dim,
              textAlign: "justify",
            }}
          >
            {DATA.disclaimerLong}
          </p>
          <div className="mt-8 flex justify-center">
            <span
              style={{
                ...CAPS,
                fontSize: 11,
                letterSpacing: "0.22em",
                color: T.dim,
                border: `2px solid ${T.ruleStrong}`,
                padding: "8px 18px",
              }}
            >
              {DATA.disclaimerShort}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
