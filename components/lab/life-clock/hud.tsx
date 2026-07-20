"use client";

import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  Ref,
} from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { formatExpectancy } from "@/lib/life-clock";
import {
  AXIS_LEFT_GUTTER,
  AXIS_TOP_GUTTER,
  TOKENS,
  VIEW_LABELS,
  VIEW_NAMES,
  type AxisSpec,
  type HudFrameFields,
  type HudHandle,
  type Rect,
  type ViewIndex,
} from "./types";

const IDLE_DIM_MS = 45_000;
const LEGEND_HIDE_MS = 8_000;
const LADDER_ROW_H = 18;
const LADDER_STOP_W = 56;

// Fixed value-span widths (ch) per view so telemetry never reflows (R4 formats).
const ELAPSED_CH = [7, 8, 9, 11] as const;
const REMAINING_CH = [10, 13, 12, 11] as const;
const CELL_CH = [13, 13, 7, 11] as const;

const CSS_VARS = {
  "--lc-bg": TOKENS.bg,
  "--lc-cell-filled": TOKENS.cellFilled,
  "--lc-hairline": TOKENS.hairline,
  "--lc-hairline-strong": TOKENS.hairlineStrong,
  "--lc-text": TOKENS.text,
  "--lc-text-dim": TOKENS.textDim,
  "--lc-text-faint": TOKENS.textFaint,
  "--lc-live": TOKENS.live,
} as CSSProperties;

const LABEL_METRICS: CSSProperties = {
  fontSize: "10px",
  lineHeight: "16px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const LABEL_STYLE: CSSProperties = { ...LABEL_METRICS, color: TOKENS.textDim };
const VALUE_STYLE: CSSProperties = {
  fontSize: "13px",
  lineHeight: "20px",
  fontWeight: 400,
  letterSpacing: "0.02em",
  color: TOKENS.text,
};
const CLOCK_STYLE: CSSProperties = {
  fontSize: "16px",
  lineHeight: "20px",
  fontWeight: 500,
  letterSpacing: "0.02em",
  color: TOKENS.text,
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--lc-text)]";

const DIM_GROUP_TEXT =
  "text-[var(--lc-text-dim)] transition-colors duration-[120ms] group-hover:text-[var(--lc-text)]";

function formatTzOffset(): string {
  const offMin = -new Date().getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const mins = abs % 60;
  return `GMT${sign}${hours}${mins > 0 ? `:${String(mins).padStart(2, "0")}` : ""}`;
}

export interface HudProps {
  /** At-rest axis graduations for the current view; null hides the axis layer. */
  axis: AxisSpec | null;
  /** Grid outer rect in layout px — anchors the axis gutters. */
  gridRect: Rect | null;
  /** Clamped expectancy years for the CAL chip (rendered at 1 dp). */
  expectancyYears: number;
  /** Renders the bright DEMO tag inside the chip (R2). */
  demo: boolean;
  /** First-use hint variant; null hides it. Parent owns timing + dismissal. */
  hint: "scroll" | "pinch" | null;
  onSelectView: (view: ViewIndex) => void;
  onCalibrate: () => void;
  ref?: Ref<HudHandle>;
}

export function LifeClockHud({
  axis,
  gridRect,
  expectancyYears,
  demo,
  hint,
  onSelectView,
  onCalibrate,
  ref,
}: HudProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [idle, setIdle] = useState(false);
  const [legendVisible, setLegendVisible] = useState(true);
  // Empty until mounted: SSR and first client render must match exactly.
  const [tzOffset, setTzOffset] = useState("");

  const isMobileRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const clockRef = useRef<HTMLSpanElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const modeLineRef = useRef<HTMLDivElement | null>(null);
  const modeWordRef = useRef<HTMLSpanElement | null>(null);
  const modeSepRef = useRef<HTMLSpanElement | null>(null);
  const modeRestRef = useRef<HTMLSpanElement | null>(null);
  const elapsedRef = useRef<HTMLDivElement | null>(null);
  const remainingRef = useRef<HTMLDivElement | null>(null);
  const cellRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const axisLayerRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const fieldsRef = useRef<HudFrameFields>({
    clock: "",
    modeLine: "",
    elapsed: "",
    remaining: "",
    cell: "",
    ladderPos: 0,
    dotAlpha: 0.65,
    nearestView: 0,
    axisOpacity: 1,
  });

  // Per-frame path: refs only — never React state (R15).
  const applyFields = useCallback(
    (fields: Partial<HudFrameFields>, force: boolean) => {
      const prev = fieldsRef.current;
      if (fields.clock !== undefined && (force || fields.clock !== prev.clock)) {
        prev.clock = fields.clock;
        if (clockRef.current) clockRef.current.textContent = fields.clock;
      }
      if (
        fields.modeLine !== undefined &&
        (force || fields.modeLine !== prev.modeLine)
      ) {
        const next = fields.modeLine;
        const prevSepIndex = prev.modeLine.indexOf(" · ");
        const prevWord =
          prevSepIndex >= 0 ? prev.modeLine.slice(0, prevSepIndex) : prev.modeLine;
        const sepIndex = next.indexOf(" · ");
        const word = sepIndex >= 0 ? next.slice(0, sepIndex) : next;
        const rest = sepIndex >= 0 ? next.slice(sepIndex + 3) : "";
        prev.modeLine = next;
        if (modeWordRef.current) modeWordRef.current.textContent = word;
        if (modeSepRef.current) modeSepRef.current.textContent = rest ? " · " : "";
        if (modeRestRef.current) modeRestRef.current.textContent = rest;
        const line = modeLineRef.current;
        if (line && !force && word !== prevWord && !reducedMotionRef.current) {
          line.style.transition = "none";
          line.style.opacity = "0";
          void line.offsetWidth;
          line.style.transition = "opacity 120ms linear";
          line.style.opacity = "1";
        }
      }
      if (
        fields.elapsed !== undefined &&
        (force || fields.elapsed !== prev.elapsed)
      ) {
        prev.elapsed = fields.elapsed;
        if (elapsedRef.current) elapsedRef.current.textContent = fields.elapsed;
      }
      if (
        fields.remaining !== undefined &&
        (force || fields.remaining !== prev.remaining)
      ) {
        prev.remaining = fields.remaining;
        if (remainingRef.current)
          remainingRef.current.textContent = fields.remaining;
      }
      if (fields.cell !== undefined && (force || fields.cell !== prev.cell)) {
        prev.cell = fields.cell;
        if (cellRef.current) cellRef.current.textContent = fields.cell;
      }
      if (
        fields.ladderPos !== undefined &&
        (force || fields.ladderPos !== prev.ladderPos)
      ) {
        prev.ladderPos = fields.ladderPos;
        const thumb = thumbRef.current;
        if (thumb) {
          if (isMobileRef.current) {
            thumb.style.left = `${
              fields.ladderPos * LADDER_STOP_W + LADDER_STOP_W / 2 - 1.5
            }px`;
          } else {
            thumb.style.top = `${
              (3 - fields.ladderPos) * LADDER_ROW_H + LADDER_ROW_H / 2 - 1.5
            }px`;
          }
        }
      }
      if (
        fields.dotAlpha !== undefined &&
        (force || fields.dotAlpha !== prev.dotAlpha)
      ) {
        prev.dotAlpha = fields.dotAlpha;
        if (dotRef.current) dotRef.current.style.opacity = String(fields.dotAlpha);
      }
      if (
        fields.axisOpacity !== undefined &&
        (force || fields.axisOpacity !== prev.axisOpacity)
      ) {
        prev.axisOpacity = fields.axisOpacity;
        if (axisLayerRef.current)
          axisLayerRef.current.style.opacity = String(fields.axisOpacity);
      }
      if (
        fields.nearestView !== undefined &&
        (force || fields.nearestView !== prev.nearestView)
      ) {
        const view = fields.nearestView;
        prev.nearestView = view;
        for (let i = 0; i < 4; i++) {
          const active = i === view;
          const label = labelRefs.current[i];
          if (label) label.style.color = active ? TOKENS.text : TOKENS.textDim;
          const tick = tickRefs.current[i];
          if (tick) {
            tick.style.backgroundColor = active ? TOKENS.text : TOKENS.textFaint;
            if (isMobileRef.current) {
              tick.style.height = active ? "10px" : "4px";
            } else {
              tick.style.width = active ? "10px" : "4px";
            }
          }
          const radio = radioRefs.current[i];
          if (radio) {
            radio.setAttribute("aria-checked", active ? "true" : "false");
            radio.tabIndex = active ? 0 : -1;
          }
        }
        if (elapsedRef.current)
          elapsedRef.current.style.minWidth = `${ELAPSED_CH[view]}ch`;
        if (remainingRef.current)
          remainingRef.current.style.minWidth = `${REMAINING_CH[view]}ch`;
        if (cellRef.current)
          cellRef.current.style.minWidth = `${CELL_CH[view]}ch`;
      }
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      update: (fields) => applyFields(fields, false),
      limitDip: (view) => {
        const tick = tickRefs.current[view];
        if (!tick) return;
        tick.style.transition = "none";
        tick.style.opacity = "0.3";
        void tick.offsetWidth;
        tick.style.transition = "opacity 120ms linear";
        tick.style.opacity = "1";
      },
    }),
    [applyFields],
  );

  // Radio pattern: arrows move focus AND selection along the ladder.
  const onLadderKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const current = fieldsRef.current.nearestView;
      let next: number | null = null;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        next = isMobileRef.current ? current - 1 : current + 1;
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        next = isMobileRef.current ? current + 1 : current - 1;
      }
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      const clamped = Math.max(0, Math.min(3, next)) as ViewIndex;
      if (clamped !== current) {
        onSelectView(clamped);
        radioRefs.current[clamped]?.focus();
      }
    },
    [onSelectView],
  );

  // Re-sync imperative DOM after any structural re-render (refs are recreated).
  useEffect(() => {
    applyFields(fieldsRef.current, true);
  });

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMobile = () => {
      isMobileRef.current = mobileQuery.matches;
      setIsMobile(mobileQuery.matches);
    };
    const syncMotion = () => {
      reducedMotionRef.current = motionQuery.matches;
      setReducedMotion(motionQuery.matches);
    };
    const syncTz = () => {
      setTzOffset(formatTzOffset());
    };
    syncMobile();
    syncMotion();
    syncTz();
    mobileQuery.addEventListener("change", syncMobile);
    motionQuery.addEventListener("change", syncMotion);
    // The UTC offset can change mid-session (DST); cheap to re-check.
    const tzTimer = window.setInterval(syncTz, 60_000);
    document.addEventListener("visibilitychange", syncTz);
    return () => {
      mobileQuery.removeEventListener("change", syncMobile);
      motionQuery.removeEventListener("change", syncMotion);
      window.clearInterval(tzTimer);
      document.removeEventListener("visibilitychange", syncTz);
    };
  }, []);

  useEffect(() => {
    let idleTimer: number | undefined;
    let legendTimer: number | undefined;
    const arm = () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(legendTimer);
      if (!reducedMotion) {
        idleTimer = window.setTimeout(() => setIdle(true), IDLE_DIM_MS);
      }
      legendTimer = window.setTimeout(
        () => setLegendVisible(false),
        LEGEND_HIDE_MS,
      );
    };
    const onActivity = () => {
      setIdle(false);
      setLegendVisible(true);
      arm();
    };
    const events = [
      "pointermove",
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
    ] as const;
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    arm();
    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(legendTimer);
      for (const name of events) {
        window.removeEventListener(name, onActivity);
      }
    };
  }, [reducedMotion]);

  const chip = (
    <button
      type="button"
      onClick={onCalibrate}
      aria-label="Open calibration"
      className={`group pointer-events-auto border border-[var(--lc-hairline-strong)] transition-colors duration-[120ms] hover:border-[var(--lc-text)] ${FOCUS_RING}`}
      style={{ ...LABEL_METRICS, padding: "4px 10px" }}
    >
      <span className={DIM_GROUP_TEXT}>CAL</span>
      <span style={{ color: TOKENS.textFaint }}>{" · "}</span>
      {demo ? <span style={{ color: TOKENS.text }}>DEMO </span> : null}
      <span className={DIM_GROUP_TEXT}>{formatExpectancy(expectancyYears)}</span>
    </button>
  );

  const desktopLadder = (
    <div
      role="radiogroup"
      aria-label="Zoom level"
      onKeyDown={onLadderKeyDown}
      className="pointer-events-auto absolute bottom-[max(14px,env(safe-area-inset-bottom))] right-[max(14px,env(safe-area-inset-right))]"
      style={{ width: 64, height: 4 * LADDER_ROW_H }}
    >
      <span
        aria-hidden
        className="absolute right-0 top-0 h-full w-px"
        style={{ backgroundColor: TOKENS.hairline }}
      />
      {([3, 2, 1, 0] as const).map((view) => (
        <button
          key={view}
          ref={(el) => {
            radioRefs.current[view] = el;
          }}
          type="button"
          role="radio"
          aria-checked={false}
          tabIndex={view === 0 ? 0 : -1}
          aria-label={VIEW_LABELS[view]}
          onClick={() => onSelectView(view)}
          className={`flex w-full items-center justify-end gap-2 ${FOCUS_RING}`}
          style={{ height: LADDER_ROW_H }}
        >
          <span
            ref={(el) => {
              labelRefs.current[view] = el;
            }}
            style={{ ...LABEL_STYLE, transition: "color 150ms linear" }}
          >
            {VIEW_NAMES[view]}
          </span>
          <span className="flex w-[10px] justify-end">
            <span
              ref={(el) => {
                tickRefs.current[view] = el;
              }}
              style={{ width: 4, height: 1, backgroundColor: TOKENS.textFaint }}
            />
          </span>
        </button>
      ))}
      <span
        ref={thumbRef}
        aria-hidden
        className="absolute"
        style={{
          right: -1,
          top: 3 * LADDER_ROW_H + LADDER_ROW_H / 2 - 1.5,
          width: 3,
          height: 3,
          backgroundColor: TOKENS.text,
        }}
      />
    </div>
  );

  const mobileLadder = (
    <div
      role="radiogroup"
      aria-label="Zoom level"
      onKeyDown={onLadderKeyDown}
      className="pointer-events-auto absolute bottom-[10px] left-1/2 -translate-x-1/2"
      style={{ width: 4 * LADDER_STOP_W, height: 28 }}
    >
      <span
        aria-hidden
        className="absolute left-0 right-0 top-0 h-px"
        style={{ backgroundColor: TOKENS.hairline }}
      />
      {([0, 1, 2, 3] as const).map((view) => (
        <button
          key={view}
          ref={(el) => {
            radioRefs.current[view] = el;
          }}
          type="button"
          role="radio"
          aria-checked={false}
          tabIndex={view === 0 ? 0 : -1}
          aria-label={VIEW_LABELS[view]}
          onClick={() => onSelectView(view)}
          className={`absolute ${FOCUS_RING}`}
          style={{ left: view * LADDER_STOP_W, top: 0, width: LADDER_STOP_W, height: 28 }}
        >
          <span
            ref={(el) => {
              tickRefs.current[view] = el;
            }}
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              width: 1,
              height: 4,
              marginLeft: -0.5,
              backgroundColor: TOKENS.textFaint,
            }}
          />
          <span
            ref={(el) => {
              labelRefs.current[view] = el;
            }}
            style={{
              ...LABEL_STYLE,
              position: "absolute",
              left: 0,
              right: 0,
              top: 12,
              textAlign: "center",
              transition: "color 150ms linear",
            }}
          >
            {VIEW_NAMES[view]}
          </span>
        </button>
      ))}
      <span
        ref={thumbRef}
        aria-hidden
        className="absolute"
        style={{
          top: -1,
          left: LADDER_STOP_W / 2 - 1.5,
          width: 3,
          height: 3,
          backgroundColor: TOKENS.text,
        }}
      />
    </div>
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 select-none"
      style={{
        ...CSS_VARS,
        fontFamily: "var(--font-geist-mono)",
        opacity: idle ? 0.5 : 1,
        transition: idle
          ? `opacity 2000ms ${TOKENS.easeOut}`
          : "opacity 200ms linear",
      }}
    >
      {axis && gridRect ? (
        <div
          ref={axisLayerRef}
          aria-hidden
          data-lc-axis
          className="absolute inset-0 hidden sm:block"
        >
          {axis.left.map((tick, i) => {
            const len = tick.major ? 6 : 3;
            return (
              <Fragment key={`l${i}`}>
                <span
                  className="absolute"
                  style={{
                    left: gridRect.x - len,
                    top: tick.pos,
                    width: len,
                    height: 1,
                    backgroundColor: tick.major
                      ? TOKENS.hairlineStrong
                      : TOKENS.hairline,
                  }}
                />
                {tick.label ? (
                  <span
                    className="absolute"
                    style={{
                      ...LABEL_METRICS,
                      left: gridRect.x - AXIS_LEFT_GUTTER,
                      width: AXIS_LEFT_GUTTER - 8,
                      top: tick.pos - 8,
                      textAlign: "right",
                      color:
                        i === axis.activeLeft ? TOKENS.text : TOKENS.textDim,
                    }}
                  >
                    {tick.label}
                  </span>
                ) : null}
              </Fragment>
            );
          })}
          {axis.top.map((tick, i) => {
            const len = tick.major ? 6 : 3;
            return (
              <Fragment key={`t${i}`}>
                <span
                  className="absolute"
                  style={{
                    left: tick.pos,
                    top: gridRect.y - len,
                    width: 1,
                    height: len,
                    backgroundColor: tick.major
                      ? TOKENS.hairlineStrong
                      : TOKENS.hairline,
                  }}
                />
                {tick.label ? (
                  <span
                    className="absolute"
                    style={{
                      ...LABEL_METRICS,
                      left: tick.pos - 28,
                      width: 56,
                      top: gridRect.y - AXIS_TOP_GUTTER,
                      textAlign: "center",
                      color: i === axis.activeTop ? TOKENS.text : TOKENS.textDim,
                    }}
                  >
                    {tick.label}
                  </span>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      ) : null}

      <div className="absolute left-[max(10px,env(safe-area-inset-left))] top-[max(10px,env(safe-area-inset-top))] sm:left-[max(14px,env(safe-area-inset-left))] sm:top-[max(14px,env(safe-area-inset-top))]">
        <div
          style={{
            fontSize: "13px",
            lineHeight: "20px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            color: TOKENS.text,
          }}
        >
          LIFE CLOCK
        </div>
        <div ref={modeLineRef} style={LABEL_STYLE}>
          <span ref={modeWordRef} style={{ color: TOKENS.text }} />
          <span ref={modeSepRef} style={{ color: TOKENS.textFaint }} />
          <span ref={modeRestRef} />
        </div>
      </div>

      <div className="absolute right-[max(10px,env(safe-area-inset-right))] top-[max(10px,env(safe-area-inset-top))] text-right sm:right-[max(14px,env(safe-area-inset-right))] sm:top-[max(14px,env(safe-area-inset-top))]">
        <div style={CLOCK_STYLE}>
          <span
            ref={dotRef}
            aria-hidden
            style={{
              display: "inline-block",
              width: 5,
              height: 5,
              marginRight: 8,
              verticalAlign: "middle",
              backgroundColor: TOKENS.live,
              opacity: 0.65,
            }}
          />
          <span
            ref={clockRef}
            style={{ display: "inline-block", minWidth: "8ch", textAlign: "right" }}
          />
        </div>
        <div style={LABEL_STYLE}>
          {tzOffset ? (
            <>
              {tzOffset}
              <span style={{ color: TOKENS.textFaint }}>{" · "}</span>
              LOCAL
            </>
          ) : null}
        </div>
      </div>

      <div className="absolute bottom-[48px] left-[max(10px,env(safe-area-inset-left))] flex gap-8 sm:bottom-[max(14px,env(safe-area-inset-bottom))] sm:left-[max(14px,env(safe-area-inset-left))]">
        <div>
          <div style={LABEL_STYLE}>ELAPSED</div>
          <div ref={elapsedRef} style={{ ...VALUE_STYLE, minWidth: "7ch" }} />
        </div>
        <div>
          <div style={LABEL_STYLE}>REMAINING</div>
          <div ref={remainingRef} style={{ ...VALUE_STYLE, minWidth: "10ch" }} />
        </div>
        <div className="hidden sm:block">
          <div style={LABEL_STYLE}>CELL</div>
          <div ref={cellRef} style={{ ...VALUE_STYLE, minWidth: "13ch" }} />
        </div>
      </div>

      <div className="absolute bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 hidden -translate-x-1/2 flex-col items-center sm:flex">
        <div
          style={{
            ...LABEL_STYLE,
            opacity: legendVisible ? 1 : 0,
            transition: legendVisible
              ? "opacity 200ms linear"
              : "opacity 400ms linear",
          }}
        >
          <span>[+/-] ZOOM</span>
          <span style={{ color: TOKENS.textFaint }}>{" · "}</span>
          <span>[0] NOW</span>
          <span style={{ color: TOKENS.textFaint }}>{" · "}</span>
          <span>[C] CALIBRATE</span>
        </div>
        <div className="mt-3">{chip}</div>
      </div>
      <div className="absolute bottom-[44px] right-[max(10px,env(safe-area-inset-right))] sm:hidden">
        {chip}
      </div>

      {isMobile ? mobileLadder : desktopLadder}

      <div
        aria-hidden={!hint}
        className="absolute bottom-[96px] left-1/2 -translate-x-1/2"
        style={{
          ...LABEL_STYLE,
          opacity: hint ? 1 : 0,
          transition: "opacity 200ms linear",
        }}
      >
        {hint === "pinch" ? "PINCH TO ZOOM OUT" : "SCROLL TO ZOOM OUT"}
      </div>
    </div>
  );
}
