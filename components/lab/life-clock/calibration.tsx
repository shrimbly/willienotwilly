"use client";

import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject,
} from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  DAYS_PER_YEAR,
  estimateExpectancyRaw,
  formatExpectancy,
  parseDob,
  type Exercise,
  type LifePeople,
  type LifeProfile,
  type Region,
  type RelatedPerson,
  type Sex,
  type Smoking,
} from "@/lib/life-clock";
import { saveProfile } from "@/lib/life-clock-storage";
import { TOKENS } from "./types";

const ENTER_MS = 300;
const EXIT_MS = 200;
const STEP_MS = 260;

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
const TITLE_STYLE: CSSProperties = {
  fontSize: "18px",
  lineHeight: "24px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
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

const DEFAULT_PARTNER_LABEL = "my partner";
const DEFAULT_CHILD_LABEL = "my child";

/** Natural-case parent label from the sex chip, for first-person event copy. */
function parentLabel(sex: Sex): string {
  return sex === "female" ? "my mother" : sex === "male" ? "my father" : "my parent";
}

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
const YESNO_OPTIONS: ChoiceOption<"yes" | "no">[] = [
  { value: "yes", label: "YES" },
  { value: "no", label: "NOT NOW" },
];

function ChipRow<T extends string>({
  labelId,
  options,
  value,
  onChange,
  autoFocus = false,
}: {
  labelId?: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  autoFocus?: boolean;
}) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  useEffect(() => {
    if (autoFocus) chipRefs.current[selectedIndex]?.focus();
    // Focus once per mount; selectedIndex is the initial selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      className="flex flex-wrap gap-2"
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
              height: 30,
              padding: "0 14px",
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

interface DateTriple {
  yyyy: string;
  mm: string;
  dd: string;
  setYyyy: (v: string) => void;
  setMm: (v: string) => void;
  setDd: (v: string) => void;
  /** "YYYY-MM-DD" — only meaningful when `valid`. */
  value: string;
  /** All three parts have their full width. */
  filled: boolean;
  /** No digits entered at all. */
  empty: boolean;
  valid: boolean;
}

function useDateTriple(initial: string | undefined): DateTriple {
  const [yyyy, setYyyy] = useState(() => initial?.slice(0, 4) ?? "");
  const [mm, setMm] = useState(() => initial?.slice(5, 7) ?? "");
  const [dd, setDd] = useState(() => initial?.slice(8, 10) ?? "");
  const value = `${yyyy}-${mm}-${dd}`;
  const filled = yyyy.length === 4 && mm.length === 2 && dd.length === 2;
  const empty = yyyy === "" && mm === "" && dd === "";
  const valid = useMemo(
    () => filled && parseDob(value, new Date()) !== null,
    [value, filled],
  );
  return { yyyy, mm, dd, setYyyy, setMm, setDd, value, filled, empty, valid };
}

function DateFields({
  labelId,
  namePrefix,
  triple,
  birthAutoComplete = false,
  firstRef,
  errorOnPartial = false,
}: {
  labelId?: string;
  namePrefix: string;
  triple: DateTriple;
  birthAutoComplete?: boolean;
  firstRef?: RefObject<HTMLInputElement | null>;
  /** Optional dates warn as soon as any digit is present, not only when full. */
  errorOnPartial?: boolean;
}) {
  const localYearRef = useRef<HTMLInputElement>(null);
  const yearRef = firstRef ?? localYearRef;
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  const showError = errorOnPartial
    ? !triple.empty && !triple.valid
    : triple.filled && !triple.valid;
  const errorBorder = showError ? { borderColor: TOKENS.text } : null;

  const handleYearChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
    triple.setYyyy(digits);
    if (digits.length === 4) monthRef.current?.focus();
  };
  const handleMonthChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
    triple.setMm(digits);
    if (digits.length === 2) dayRef.current?.focus();
  };
  const handleDayChange = (event: ChangeEvent<HTMLInputElement>) => {
    triple.setDd(event.target.value.replace(/\D/g, "").slice(0, 2));
  };
  const padOnBlur = (value: string, setter: (v: string) => void) => () => {
    if (value.length === 1) setter(`0${value}`);
  };

  return (
    <>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex items-center gap-2"
      >
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          autoComplete={birthAutoComplete ? "bday-year" : "off"}
          placeholder="YYYY"
          aria-label={`${namePrefix} year`}
          aria-invalid={showError || undefined}
          value={triple.yyyy}
          onChange={handleYearChange}
          className={DATE_INPUT_CLASS}
          style={{ ...DATE_INPUT_STYLE, width: 58, ...errorBorder }}
        />
        <span aria-hidden style={{ color: TOKENS.textFaint }}>
          -
        </span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          autoComplete={birthAutoComplete ? "bday-month" : "off"}
          placeholder="MM"
          aria-label={`${namePrefix} month`}
          aria-invalid={showError || undefined}
          value={triple.mm}
          onChange={handleMonthChange}
          onBlur={padOnBlur(triple.mm, triple.setMm)}
          className={DATE_INPUT_CLASS}
          style={{ ...DATE_INPUT_STYLE, width: 40, ...errorBorder }}
        />
        <span aria-hidden style={{ color: TOKENS.textFaint }}>
          -
        </span>
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          autoComplete={birthAutoComplete ? "bday-day" : "off"}
          placeholder="DD"
          aria-label={`${namePrefix} day`}
          aria-invalid={showError || undefined}
          value={triple.dd}
          onChange={handleDayChange}
          onBlur={padOnBlur(triple.dd, triple.setDd)}
          className={DATE_INPUT_CLASS}
          style={{ ...DATE_INPUT_STYLE, width: 40, ...errorBorder }}
        />
      </div>
      {showError ? (
        <p role="alert" style={{ ...LABEL_METRICS, color: TOKENS.text, marginTop: 10 }}>
          {DOB_ERROR}
        </p>
      ) : null}
    </>
  );
}

/** One animated question. Remounts per step so the enter transition replays. */
function StepPanel({
  direction,
  reducedMotion,
  children,
}: {
  direction: number;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const [entered, setEntered] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [reducedMotion]);
  const offset = reducedMotion ? 0 : direction * 24;
  return (
    <div
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateX(0)" : `translateX(${offset}px)`,
        transition: reducedMotion
          ? "none"
          : `opacity ${STEP_MS}ms ${TOKENS.easeOut}, transform ${STEP_MS}ms ${TOKENS.easeOut}`,
      }}
    >
      {children}
    </div>
  );
}

type StepId =
  | "dob"
  | "sex"
  | "smoking"
  | "exercise"
  | "region"
  | "partner-gate"
  | "partner-details"
  | "child-gate"
  | "child-details"
  | "parents-gate"
  | "parents-details"
  | "review";

const SECTION: Record<StepId, string> = {
  dob: "YOUR LIFE",
  sex: "YOUR LIFE",
  smoking: "YOUR LIFE",
  exercise: "YOUR LIFE",
  region: "YOUR LIFE",
  "partner-gate": "YOUR PARTNER",
  "partner-details": "YOUR PARTNER",
  "child-gate": "YOUR CHILD",
  "child-details": "YOUR CHILD",
  "parents-gate": "YOUR PARENTS",
  "parents-details": "YOUR PARENTS",
  review: "REVIEW",
};

function buildSequence(gates: {
  partner: boolean;
  child: boolean;
  parents: boolean;
}): StepId[] {
  const seq: StepId[] = ["dob", "sex", "smoking", "exercise", "region"];
  seq.push("partner-gate");
  if (gates.partner) seq.push("partner-details");
  seq.push("child-gate");
  if (gates.child) seq.push("child-details");
  seq.push("parents-gate");
  if (gates.parents) seq.push("parents-details");
  seq.push("review");
  return seq;
}

export interface CalibrationProps {
  /** Pre-fill for editing an existing custom profile; null starts fresh. */
  profile: LifeProfile | null;
  onComplete: (profile: LifeProfile) => void;
  /** Back out with no change (returns to whatever was showing). */
  onCancel: () => void;
  /** Only in custom mode: discard the custom profile, revert to the default. */
  onReset?: () => void;
}

export function LifeClockCalibration({
  profile,
  onComplete,
  onCancel,
  onReset,
}: CalibrationProps) {
  const baseId = useId();
  const editing = profile !== null && !profile.author;
  const seed = editing ? profile : null;
  const people = seed?.people;

  const dobTriple = useDateTriple(seed?.dob);
  const [sex, setSex] = useState<Sex>(seed?.sex ?? "unspecified");
  const [smoking, setSmoking] = useState<Smoking>(seed?.smoking ?? "never");
  const [exercise, setExercise] = useState<Exercise>(seed?.exercise ?? "weekly");
  const [region, setRegion] = useState<Region>(seed?.region ?? "unspecified");

  const metTriple = useDateTriple(people?.partnerMet);
  const marriedTriple = useDateTriple(people?.partnerMarried);
  const childTriple = useDateTriple(people?.children?.[0]?.dob);
  const parentATriple = useDateTriple(people?.parents?.[0]?.dob);
  const parentBTriple = useDateTriple(people?.parents?.[1]?.dob);
  const [parentASex, setParentASex] = useState<Sex>(
    people?.parents?.[0]?.sex ?? "unspecified",
  );
  const [parentBSex, setParentBSex] = useState<Sex>(
    people?.parents?.[1]?.sex ?? "unspecified",
  );

  const [partnerGate, setPartnerGate] = useState<"yes" | "no">(
    people?.partnerMet || people?.partnerMarried ? "yes" : "no",
  );
  const [childGate, setChildGate] = useState<"yes" | "no">(
    people?.children?.length ? "yes" : "no",
  );
  const [parentsGate, setParentsGate] = useState<"yes" | "no">(
    people?.parents?.length ? "yes" : "no",
  );

  const gates = {
    partner: partnerGate === "yes",
    child: childGate === "yes",
    parents: parentsGate === "yes",
  };
  const sequence = buildSequence(gates);

  const [nav, setNav] = useState<{ step: StepId; direction: number }>({
    step: "dob",
    direction: 1,
  });
  const step = nav.step;
  const stepIndex = Math.max(0, sequence.indexOf(step));

  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

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

  const buildPeople = (): LifePeople | undefined => {
    const next: LifePeople = {};
    if (gates.partner) {
      if (metTriple.valid) next.partnerMet = metTriple.value;
      if (marriedTriple.valid) next.partnerMarried = marriedTriple.value;
      if (next.partnerMet !== undefined || next.partnerMarried !== undefined) {
        next.partnerLabel = people?.partnerLabel ?? DEFAULT_PARTNER_LABEL;
      }
    }
    if (gates.child && childTriple.valid) {
      next.children = [
        {
          label: people?.children?.[0]?.label ?? DEFAULT_CHILD_LABEL,
          dob: childTriple.value,
          ...(people?.children?.[0]?.sex ? { sex: people.children[0].sex } : {}),
        },
      ];
    }
    if (gates.parents) {
      const parents: RelatedPerson[] = [];
      const inputs = [
        { triple: parentATriple, sex: parentASex, index: 0 },
        { triple: parentBTriple, sex: parentBSex, index: 1 },
      ] as const;
      for (const parent of inputs) {
        if (!parent.triple.valid) continue;
        // The wizard has no parent-label field, so the label is always derived
        // from the current sex chip — re-derive on edit too, or a flipped sex
        // would keep a stale "my father"/"my mother" mismatch.
        parents.push({
          label: parentLabel(parent.sex),
          dob: parent.triple.value,
          sex: parent.sex,
        });
      }
      if (parents.length > 0) next.parents = parents;
    }
    return Object.keys(next).length > 0 ? next : undefined;
  };

  const handleSubmit = () => {
    if (!dobTriple.valid) return;
    const saved = saveProfile({
      dob: dobTriple.value,
      sex,
      smoking,
      exercise,
      region,
      people: buildPeople(),
      demo: false,
    });
    closeThen(() => onComplete(saved));
  };

  // An optional date blocks the step when any digit is present but it is not a
  // valid date, so a half-typed date is never silently dropped on save.
  const partial = (t: DateTriple) => !t.empty && !t.valid;
  const stepBlocked = (id: StepId): boolean => {
    switch (id) {
      case "dob":
        return !dobTriple.valid;
      case "partner-details":
        return partial(metTriple) || partial(marriedTriple);
      case "child-details":
        return partial(childTriple);
      case "parents-details":
        return partial(parentATriple) || partial(parentBTriple);
      default:
        return false;
    }
  };

  const goTo = (id: StepId, dir: number) => {
    setNav({ step: id, direction: dir });
  };

  const next = () => {
    if (step === "review") {
      handleSubmit();
      return;
    }
    if (stepBlocked(step)) return;
    // Recompute the sequence from the latest gate answers before advancing.
    const seq = buildSequence(gates);
    const i = seq.indexOf(step);
    const target = seq[Math.min(seq.length - 1, i + 1)];
    goTo(target, 1);
  };

  const back = () => {
    const seq = buildSequence(gates);
    const i = seq.indexOf(step);
    if (i <= 0) {
      closeThen(onCancel);
      return;
    }
    goTo(seq[i - 1], -1);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      back();
      return;
    }
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      // Chips consume Enter themselves; buttons fire their own click.
      if (target.getAttribute("role") === "radio" || target.tagName === "BUTTON") {
        return;
      }
      e.preventDefault();
      next();
      return;
    }
    trapTab(e);
  };

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

  // Capture the trigger DURING first render — a child step control steals
  // focus in its own mount effect (which runs before this parent effect), so
  // reading document.activeElement in an effect would miss the real opener.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(frame);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [opener]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // What will actually persist — so the review summary can't claim a person
  // was added when a blank/invalid date means buildPeople drops them.
  const preview = buildPeople();
  const visible = entered && !closing;
  const transitionMs = closing ? EXIT_MS : ENTER_MS;
  const progress = sequence.length > 1 ? stepIndex / (sequence.length - 1) : 1;
  const blocked = stepBlocked(step);
  const cornerTickStyle: CSSProperties = { width: 10, height: 10 };
  const tickBorder = `1px solid ${TOKENS.hairlineStrong}`;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Life Clock calibration"
      onKeyDown={onKeyDown}
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
            width: 440,
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
          {(
            [
              { top: -1, left: -1, borderTop: tickBorder, borderLeft: tickBorder },
              { top: -1, right: -1, borderTop: tickBorder, borderRight: tickBorder },
              { bottom: -1, left: -1, borderBottom: tickBorder, borderLeft: tickBorder },
              { bottom: -1, right: -1, borderBottom: tickBorder, borderRight: tickBorder },
            ] as CSSProperties[]
          ).map((corner, i) => (
            <span
              key={i}
              aria-hidden
              className="pointer-events-none absolute"
              style={{ ...cornerTickStyle, ...corner }}
            />
          ))}

          {/* Header: section eyebrow + progress rail. */}
          <div className="flex items-baseline justify-between">
            <p style={{ ...LABEL_METRICS, color: TOKENS.textFaint }}>
              CALIBRATION
              <span style={{ color: TOKENS.textFaint }}>{" · "}</span>
              <span style={{ color: TOKENS.textDim }}>{SECTION[step]}</span>
            </p>
            <p style={{ ...LABEL_METRICS, color: TOKENS.textFaint }}>
              {String(stepIndex + 1).padStart(2, "0")} /{" "}
              {String(sequence.length).padStart(2, "0")}
            </p>
          </div>
          <div
            aria-hidden
            className="mt-2 h-px w-full"
            style={{ backgroundColor: TOKENS.hairline }}
          >
            <div
              className="h-px"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: TOKENS.text,
                transition: reducedMotion
                  ? "none"
                  : `width ${STEP_MS}ms ${TOKENS.easeOut}`,
              }}
            />
          </div>

          {/* The active question. */}
          <div className="mt-7" style={{ minHeight: 188 }}>
            <StepPanel
              key={step}
              direction={nav.direction}
              reducedMotion={reducedMotion}
            >
              <StepBody
                step={step}
                baseId={baseId}
                dobTriple={dobTriple}
                sex={sex}
                setSex={setSex}
                smoking={smoking}
                setSmoking={setSmoking}
                exercise={exercise}
                setExercise={setExercise}
                region={region}
                setRegion={setRegion}
                partnerGate={partnerGate}
                setPartnerGate={setPartnerGate}
                childGate={childGate}
                setChildGate={setChildGate}
                parentsGate={parentsGate}
                setParentsGate={setParentsGate}
                metTriple={metTriple}
                marriedTriple={marriedTriple}
                childTriple={childTriple}
                parentATriple={parentATriple}
                parentBTriple={parentBTriple}
                parentASex={parentASex}
                setParentASex={setParentASex}
                parentBSex={parentBSex}
                setParentBSex={setParentBSex}
                rawExpectancy={rawExpectancy}
                spanDays={spanDays}
                partnerAdded={
                  !!(preview?.partnerMet || preview?.partnerMarried)
                }
                childAdded={!!preview?.children?.length}
                parentsAdded={!!preview?.parents?.length}
              />
            </StepPanel>
          </div>

          {/* Navigation. */}
          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={back}
              className={`${FOCUS_RING} h-10 shrink-0 border border-[var(--lc-hairline-strong)] px-4 text-[var(--lc-text-dim)] transition-colors duration-[120ms] hover:text-[var(--lc-text)]`}
              style={{
                fontSize: "12px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {stepIndex === 0 ? "CANCEL" : "BACK"}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={blocked}
              className={`${FOCUS_RING} h-10 flex-1 transition-colors duration-[120ms] ${
                blocked
                  ? "cursor-default border border-[var(--lc-hairline-strong)] bg-transparent text-[var(--lc-text-dim)]"
                  : "bg-[var(--lc-text)] text-[var(--lc-bg)] hover:bg-white active:bg-[var(--lc-cell-filled)]"
              }`}
              style={{
                fontSize: "12px",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {step === "review" ? "START CLOCK" : "NEXT"}
            </button>
          </div>

          <p
            className="mt-3 text-center"
            style={{ ...LABEL_METRICS, color: TOKENS.textFaint }}
          >
            STORED IN THIS BROWSER ONLY
          </p>
          {editing && onReset ? (
            <button
              type="button"
              onClick={() => closeThen(onReset)}
              className={`${FOCUS_RING} mx-auto mt-2 block underline underline-offset-2`}
              style={{ ...LABEL_METRICS, color: TOKENS.textDim }}
            >
              DISCARD — USE THE DEFAULT LIFE
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface StepBodyProps {
  step: StepId;
  baseId: string;
  dobTriple: DateTriple;
  sex: Sex;
  setSex: (v: Sex) => void;
  smoking: Smoking;
  setSmoking: (v: Smoking) => void;
  exercise: Exercise;
  setExercise: (v: Exercise) => void;
  region: Region;
  setRegion: (v: Region) => void;
  partnerGate: "yes" | "no";
  setPartnerGate: (v: "yes" | "no") => void;
  childGate: "yes" | "no";
  setChildGate: (v: "yes" | "no") => void;
  parentsGate: "yes" | "no";
  setParentsGate: (v: "yes" | "no") => void;
  metTriple: DateTriple;
  marriedTriple: DateTriple;
  childTriple: DateTriple;
  parentATriple: DateTriple;
  parentBTriple: DateTriple;
  parentASex: Sex;
  setParentASex: (v: Sex) => void;
  parentBSex: Sex;
  setParentBSex: (v: Sex) => void;
  rawExpectancy: number;
  spanDays: number;
  partnerAdded: boolean;
  childAdded: boolean;
  parentsAdded: boolean;
}

function Prompt({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 style={TITLE_STYLE}>{title}</h2>
      {hint ? (
        <p style={{ ...LABEL_STYLE, marginTop: 8, lineHeight: "16px" }}>{hint}</p>
      ) : null}
    </div>
  );
}

function StepBody(props: StepBodyProps) {
  const { step, baseId } = props;
  const firstFocus = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstFocus.current?.focus();
  }, []);

  switch (step) {
    case "dob":
      return (
        <>
          <Prompt
            title="WHEN WERE YOU BORN?"
            hint="THE CLOCK MEASURES EVERYTHING FROM HERE."
          />
          <DateFields
            labelId={`${baseId}-dob`}
            namePrefix="Birth"
            triple={props.dobTriple}
            birthAutoComplete
            firstRef={firstFocus}
          />
        </>
      );
    case "sex":
      return (
        <>
          <Prompt title="SEX AT BIRTH" hint="IT SETS THE BASELINE LIFE TABLE." />
          <ChipRow options={SEX_OPTIONS} value={props.sex} onChange={props.setSex} autoFocus />
        </>
      );
    case "smoking":
      return (
        <>
          <Prompt title="DO YOU SMOKE?" hint="THE SINGLE LARGEST MODIFIABLE FACTOR." />
          <ChipRow
            options={SMOKING_OPTIONS}
            value={props.smoking}
            onChange={props.setSmoking}
            autoFocus
          />
        </>
      );
    case "exercise":
      return (
        <>
          <Prompt title="HOW OFTEN DO YOU EXERCISE?" />
          <ChipRow
            options={EXERCISE_OPTIONS}
            value={props.exercise}
            onChange={props.setExercise}
            autoFocus
          />
        </>
      );
    case "region":
      return (
        <>
          <Prompt title="WHERE DO YOU LIVE?" hint="ADJUSTS TOWARD THE REGIONAL LIFE TABLE." />
          <ChipRow
            options={REGION_OPTIONS}
            value={props.region}
            onChange={props.setRegion}
            autoFocus
          />
        </>
      );
    case "partner-gate":
      return (
        <>
          <Prompt
            title="DO YOU HAVE A PARTNER?"
            hint="THEIR DATES UNLOCK THE MOMENTS BETWEEN YOU."
          />
          <ChipRow
            options={YESNO_OPTIONS}
            value={props.partnerGate}
            onChange={props.setPartnerGate}
            autoFocus
          />
        </>
      );
    case "partner-details":
      return (
        <>
          <Prompt title="YOU & YOUR PARTNER" hint="LEAVE EITHER BLANK TO SKIP IT." />
          <div className="flex flex-col gap-5">
            <div>
              <p id={`${baseId}-met`} style={LABEL_STYLE}>
                THE DAY YOU MET
              </p>
              <div className="mt-2">
                <DateFields
                  labelId={`${baseId}-met`}
                  namePrefix="Met"
                  triple={props.metTriple}
                  firstRef={firstFocus}
                  errorOnPartial
                />
              </div>
            </div>
            <div>
              <p id={`${baseId}-married`} style={LABEL_STYLE}>
                THE DAY YOU MARRIED
              </p>
              <div className="mt-2">
                <DateFields
                  labelId={`${baseId}-married`}
                  namePrefix="Married"
                  triple={props.marriedTriple}
                  errorOnPartial
                />
              </div>
            </div>
          </div>
        </>
      );
    case "child-gate":
      return (
        <>
          <Prompt
            title="DO YOU HAVE A CHILD?"
            hint="THEIR BIRTH DRAWS THE YEARS YOU HAVE TOGETHER."
          />
          <ChipRow
            options={YESNO_OPTIONS}
            value={props.childGate}
            onChange={props.setChildGate}
            autoFocus
          />
        </>
      );
    case "child-details":
      return (
        <>
          <Prompt title="YOUR CHILD" hint="THE DAY THEY WERE BORN." />
          <DateFields
            labelId={`${baseId}-child`}
            namePrefix="Child birth"
            triple={props.childTriple}
            firstRef={firstFocus}
            errorOnPartial
          />
        </>
      );
    case "parents-gate":
      return (
        <>
          <Prompt
            title="ADD YOUR PARENTS?"
            hint="THEIR AGES SHAPE THE HARDEST PREDICTIONS."
          />
          <ChipRow
            options={YESNO_OPTIONS}
            value={props.parentsGate}
            onChange={props.setParentsGate}
            autoFocus
          />
        </>
      );
    case "parents-details":
      return (
        <>
          <Prompt title="YOUR PARENTS" hint="LEAVE EITHER BLANK TO SKIP IT." />
          <div className="flex flex-col gap-5">
            <div>
              <p id={`${baseId}-parentA`} style={LABEL_STYLE}>
                PARENT ONE — BORN
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <DateFields
                  labelId={`${baseId}-parentA`}
                  namePrefix="Parent one birth"
                  triple={props.parentATriple}
                  firstRef={firstFocus}
                  errorOnPartial
                />
                <ChipRow
                  options={SEX_OPTIONS}
                  value={props.parentASex}
                  onChange={props.setParentASex}
                />
              </div>
            </div>
            <div>
              <p id={`${baseId}-parentB`} style={LABEL_STYLE}>
                PARENT TWO — BORN
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <DateFields
                  labelId={`${baseId}-parentB`}
                  namePrefix="Parent two birth"
                  triple={props.parentBTriple}
                  errorOnPartial
                />
                <ChipRow
                  options={SEX_OPTIONS}
                  value={props.parentBSex}
                  onChange={props.setParentBSex}
                />
              </div>
            </div>
          </div>
        </>
      );
    case "review": {
      const added = [
        props.partnerAdded ? "PARTNER" : null,
        props.childAdded ? "CHILD" : null,
        props.parentsAdded ? "PARENTS" : null,
      ].filter(Boolean) as string[];
      return (
        <>
          <Prompt title="READY" hint="YOU CAN RECALIBRATE ANY TIME." />
          <div style={{ paddingTop: 4 }}>
            <div style={LABEL_STYLE}>ESTIMATED SPAN</div>
            <div style={{ ...VALUE_STYLE, marginTop: 2 }}>
              {formatExpectancy(props.rawExpectancy)}
              <span style={{ color: TOKENS.textFaint }}>{" · "}</span>
              {props.spanDays.toLocaleString("en-US")} DAYS
            </div>
            <div style={{ ...LABEL_STYLE, marginTop: 16 }}>ADDED</div>
            <div style={{ ...VALUE_STYLE, marginTop: 2 }}>
              {added.length ? added.join(" · ") : "JUST YOU"}
            </div>
          </div>
        </>
      );
    }
    default:
      return null;
  }
}

export { LifeClockCalibration as LifeClockCalibrationWizard };
