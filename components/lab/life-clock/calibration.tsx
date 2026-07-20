"use client";

import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  DAYS_PER_YEAR,
  estimateExpectancyRaw,
  formatExpectancy,
  parseDob,
  type Exercise,
  type LifeProfile,
  type Region,
  type Sex,
  type Smoking,
} from "@/lib/life-clock";
import { createDemoProfile, saveProfile } from "@/lib/life-clock-storage";
import { TOKENS } from "./types";

const ENTER_MS = 300;
const EXIT_MS = 200;

const CSS_VARS = {
  "--lc-bg": TOKENS.bg,
  "--lc-cell-filled": TOKENS.cellFilled,
  "--lc-hairline": TOKENS.hairline,
  "--lc-hairline-strong": TOKENS.hairlineStrong,
  "--lc-text": TOKENS.text,
  "--lc-text-dim": TOKENS.textDim,
  "--lc-text-faint": TOKENS.textFaint,
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

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--lc-text)]";

// 16px on coarse pointers: anything smaller triggers iOS Safari's focus zoom.
const DATE_INPUT_CLASS =
  "rounded-none border-b border-[rgba(255,255,255,0.25)] bg-transparent text-center text-[14px] [@media(pointer:coarse)]:text-[16px] focus:border-[var(--lc-text)] focus:outline-none placeholder:text-[var(--lc-text-faint)]";

const DATE_INPUT_STYLE: CSSProperties = {
  height: 32,
  fontWeight: 400,
  letterSpacing: "0.02em",
  color: TOKENS.text,
  caretColor: TOKENS.text,
};

const DOB_ERROR = "! ENTER A VALID DATE BETWEEN 1900-01-01 AND TODAY";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

const SEX_OPTIONS: ChoiceOption<Sex>[] = [
  { value: "female", label: "FEMALE" },
  { value: "male", label: "MALE" },
  { value: "unspecified", label: "PREFER NOT TO SAY" },
];
const SMOKING_OPTIONS: ChoiceOption<Smoking>[] = [
  { value: "never", label: "NEVER" },
  { value: "former", label: "FORMER" },
  { value: "current", label: "CURRENT" },
];
const EXERCISE_OPTIONS: ChoiceOption<Exercise>[] = [
  { value: "rarely", label: "RARELY" },
  { value: "weekly", label: "1–2× PER WEEK" },
  { value: "often", label: "3+× PER WEEK" },
];
const REGION_OPTIONS: ChoiceOption<Region>[] = [
  { value: "east-asia", label: "EAST ASIA (JP / KR / SG / HK / TW)" },
  { value: "western-europe-oceania", label: "W. EUROPE / CANADA / AUS / NZ" },
  { value: "united-states", label: "UNITED STATES" },
  { value: "latin-america", label: "LATIN AMERICA & CARIBBEAN" },
  { value: "mena", label: "MIDDLE EAST & N. AFRICA" },
  { value: "eastern-europe-central-asia", label: "E. EUROPE & CENTRAL ASIA" },
  { value: "south-southeast-asia", label: "SOUTH & SOUTHEAST ASIA" },
  { value: "sub-saharan-africa", label: "SUB-SAHARAN AFRICA" },
  { value: "unspecified", label: "PREFER NOT TO SAY" },
];

function FieldLabel({
  index,
  id,
  children,
}: {
  index: string;
  id: string;
  children: string;
}) {
  return (
    <div id={id} style={LABEL_STYLE}>
      <span style={{ color: TOKENS.textFaint }}>{index}</span>
      <span style={{ marginLeft: 8 }}>{children}</span>
    </div>
  );
}

function ChipRow<T extends string>({
  labelId,
  options,
  value,
  onChange,
}: {
  labelId: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  // Radio pattern: one tab stop per group, arrows move focus + selection.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") delta = 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") delta = -1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    const next = (selectedIndex + delta + options.length) % options.length;
    onChange(options[next].value);
    chipRefs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      onKeyDown={onKeyDown}
      className="mt-2 flex flex-wrap gap-2"
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === selectedIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`${FOCUS_RING} transition-colors duration-[120ms] ${
              selected
                ? "border border-transparent bg-[var(--lc-text)] text-[var(--lc-bg)]"
                : "border border-[rgba(255,255,255,0.25)] text-[var(--lc-text-dim)] hover:border-[rgba(255,255,255,0.45)]"
            }`}
            style={{
              height: 28,
              padding: "0 12px",
              fontSize: "12px",
              fontWeight: 400,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface CalibrationProps {
  profile: LifeProfile | null;
  onComplete: (profile: LifeProfile) => void;
  onCancel?: () => void;
  editMode: boolean;
}

export function LifeClockCalibration({
  profile,
  onComplete,
  onCancel,
  editMode,
}: CalibrationProps) {
  const baseId = useId();
  const [yyyy, setYyyy] = useState(() => (profile ? profile.dob.slice(0, 4) : ""));
  const [mm, setMm] = useState(() => (profile ? profile.dob.slice(5, 7) : ""));
  const [dd, setDd] = useState(() => (profile ? profile.dob.slice(8, 10) : ""));
  const [sex, setSex] = useState<Sex>(profile?.sex ?? "unspecified");
  const [smoking, setSmoking] = useState<Smoking>(profile?.smoking ?? "never");
  const [exercise, setExercise] = useState<Exercise>(profile?.exercise ?? "weekly");
  const [region, setRegion] = useState<Region>(profile?.region ?? "unspecified");
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  const dob = `${yyyy}-${mm}-${dd}`;
  const complete = yyyy.length === 4 && mm.length === 2 && dd.length === 2;
  const dobValid = useMemo(
    () => complete && parseDob(dob, new Date()) !== null,
    [dob, complete],
  );
  const showError = complete && !dobValid;
  const rawExpectancy = useMemo(
    () => estimateExpectancyRaw({ sex, smoking, exercise, region }),
    [sex, smoking, exercise, region],
  );
  const spanDays = Math.round(rawExpectancy * DAYS_PER_YEAR);

  const closingRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const closeThen = useCallback((after: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    exitTimerRef.current = window.setTimeout(after, EXIT_MS);
  }, []);
  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    },
    [],
  );

  const handleSubmit = () => {
    if (!dobValid) return;
    const saved = saveProfile({ dob, sex, smoking, exercise, region, demo: false });
    closeThen(() => onComplete(saved));
  };
  const handleSkip = () => {
    const saved = saveProfile(createDemoProfile(new Date()));
    closeThen(() => onComplete(saved));
  };
  const handleCancel = () => {
    if (onCancel) closeThen(onCancel);
  };

  const escapeRef = useRef<() => void>(() => {});
  useEffect(() => {
    escapeRef.current = editMode ? handleCancel : handleSkip;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      escapeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    const focusTimer = window.setTimeout(() => yearRef.current?.focus(), 60);
    // Return focus to whatever opened the dialog (the CAL chip in edit mode).
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>("button, input"),
    ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !root.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(motionQuery.matches);
    sync();
    motionQuery.addEventListener("change", sync);
    return () => motionQuery.removeEventListener("change", sync);
  }, []);

  const visible = entered && !closing;
  const transitionMs = closing ? EXIT_MS : ENTER_MS;

  const handleYearChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
    setYyyy(digits);
    if (digits.length === 4) monthRef.current?.focus();
  };
  const handleMonthChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
    setMm(digits);
    if (digits.length === 2) dayRef.current?.focus();
  };
  const handleDayChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDd(event.target.value.replace(/\D/g, "").slice(0, 2));
  };
  const padOnBlur = (value: string, setter: (v: string) => void) => () => {
    if (value.length === 1) setter(`0${value}`);
  };

  const errorBorder = showError ? { borderColor: TOKENS.text } : null;
  const cornerTickStyle: CSSProperties = { width: 10, height: 10 };
  const tickBorder = `1px solid ${TOKENS.hairlineStrong}`;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Life Clock calibration"
      onKeyDown={trapTab}
      className="absolute inset-0 z-20 overflow-y-auto"
      style={{
        ...CSS_VARS,
        backgroundColor: "rgba(6, 7, 7, 0.72)",
        fontFamily: "var(--font-geist-mono)",
        opacity: visible ? 1 : 0,
        transition: `opacity ${transitionMs}ms ${TOKENS.easeOut}`,
      }}
    >
      <div className="flex min-h-full items-center justify-center p-6">
        <div
          className="relative"
          style={{
            width: 420,
            maxWidth: "calc(100vw - 48px)",
            backgroundColor: "#0A0B0B",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            padding: 28,
            opacity: visible ? 1 : 0,
            transform: reducedMotion
              ? "none"
              : visible
                ? "translateY(0)"
                : "translateY(8px)",
            transition: `opacity ${transitionMs}ms ${TOKENS.easeOut}, transform ${transitionMs}ms ${TOKENS.easeOut}`,
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{ ...cornerTickStyle, top: -1, left: -1, borderTop: tickBorder, borderLeft: tickBorder }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{ ...cornerTickStyle, top: -1, right: -1, borderTop: tickBorder, borderRight: tickBorder }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{ ...cornerTickStyle, bottom: -1, left: -1, borderBottom: tickBorder, borderLeft: tickBorder }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{ ...cornerTickStyle, bottom: -1, right: -1, borderBottom: tickBorder, borderRight: tickBorder }}
          />

          <p style={{ ...LABEL_METRICS, color: TOKENS.textFaint }}>
            LIFE CLOCK · SETUP
          </p>
          <h2
            style={{
              marginTop: 4,
              fontSize: "16px",
              lineHeight: "20px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: TOKENS.text,
            }}
          >
            CALIBRATION
          </h2>
          <p style={{ ...LABEL_STYLE, marginTop: 12 }}>
            THE LIFE SCALE NEEDS A FEW INPUTS. ANSWERS STAY ON THIS DEVICE.
          </p>

          <div className="mt-6 flex flex-col gap-6">
            <div>
              <FieldLabel index="01" id={`${baseId}-dob`}>
                DATE OF BIRTH
              </FieldLabel>
              <div
                role="group"
                aria-labelledby={`${baseId}-dob`}
                className="mt-2 flex items-center gap-2"
              >
                <input
                  ref={yearRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-year"
                  placeholder="YYYY"
                  aria-label="Year of birth"
                  aria-invalid={showError || undefined}
                  value={yyyy}
                  onChange={handleYearChange}
                  className={DATE_INPUT_CLASS}
                  style={{ ...DATE_INPUT_STYLE, width: 56, ...errorBorder }}
                />
                <span aria-hidden style={{ color: TOKENS.textFaint }}>
                  -
                </span>
                <input
                  ref={monthRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-month"
                  placeholder="MM"
                  aria-label="Month of birth"
                  aria-invalid={showError || undefined}
                  value={mm}
                  onChange={handleMonthChange}
                  onBlur={padOnBlur(mm, setMm)}
                  className={DATE_INPUT_CLASS}
                  style={{ ...DATE_INPUT_STYLE, width: 36, ...errorBorder }}
                />
                <span aria-hidden style={{ color: TOKENS.textFaint }}>
                  -
                </span>
                <input
                  ref={dayRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-day"
                  placeholder="DD"
                  aria-label="Day of birth"
                  aria-invalid={showError || undefined}
                  value={dd}
                  onChange={handleDayChange}
                  onBlur={padOnBlur(dd, setDd)}
                  className={DATE_INPUT_CLASS}
                  style={{ ...DATE_INPUT_STYLE, width: 36, ...errorBorder }}
                />
              </div>
              {showError ? (
                <p
                  role="alert"
                  style={{ ...LABEL_METRICS, color: TOKENS.text, marginTop: 8 }}
                >
                  {DOB_ERROR}
                </p>
              ) : null}
            </div>

            <div>
              <FieldLabel index="02" id={`${baseId}-sex`}>
                SEX AT BIRTH
              </FieldLabel>
              <ChipRow
                labelId={`${baseId}-sex`}
                options={SEX_OPTIONS}
                value={sex}
                onChange={setSex}
              />
            </div>

            <div>
              <FieldLabel index="03" id={`${baseId}-smoking`}>
                SMOKING
              </FieldLabel>
              <ChipRow
                labelId={`${baseId}-smoking`}
                options={SMOKING_OPTIONS}
                value={smoking}
                onChange={setSmoking}
              />
            </div>

            <div>
              <FieldLabel index="04" id={`${baseId}-exercise`}>
                EXERCISE
              </FieldLabel>
              <ChipRow
                labelId={`${baseId}-exercise`}
                options={EXERCISE_OPTIONS}
                value={exercise}
                onChange={setExercise}
              />
            </div>

            <div>
              <FieldLabel index="05" id={`${baseId}-region`}>
                REGION
              </FieldLabel>
              <ChipRow
                labelId={`${baseId}-region`}
                options={REGION_OPTIONS}
                value={region}
                onChange={setRegion}
              />
            </div>
          </div>

          {dobValid ? (
            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: `1px solid ${TOKENS.hairline}`,
              }}
            >
              <div style={LABEL_STYLE}>ESTIMATED SPAN</div>
              <div style={VALUE_STYLE}>
                {formatExpectancy(rawExpectancy)}
                <span style={{ color: TOKENS.textFaint }}>{" · "}</span>
                {spanDays.toLocaleString("en-US")} DAYS
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!dobValid || closing}
            onClick={handleSubmit}
            className={`${FOCUS_RING} mt-8 h-10 w-full transition-colors duration-[120ms] ${
              dobValid
                ? "bg-[var(--lc-text)] text-[var(--lc-bg)] hover:bg-white active:bg-[var(--lc-cell-filled)]"
                : "cursor-default border border-[var(--lc-hairline-strong)] bg-transparent text-[var(--lc-text-dim)]"
            }`}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {editMode ? "SAVE CHANGES" : "START CLOCK"}
          </button>

          <p
            className="text-center"
            style={{ ...LABEL_METRICS, color: TOKENS.textFaint, marginTop: 12 }}
          >
            STORED IN THIS BROWSER ONLY
          </p>

          <button
            type="button"
            onClick={editMode ? handleCancel : handleSkip}
            className={`${FOCUS_RING} mx-auto mt-2 block underline underline-offset-2`}
            style={{ ...LABEL_METRICS, color: TOKENS.textDim }}
          >
            {editMode ? "CANCEL" : "SKIP — DEMO PROFILE"}
          </button>
        </div>
      </div>
    </div>
  );
}
