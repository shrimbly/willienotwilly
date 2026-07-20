// Life Clock — localStorage envelope. The only impure layer of the model:
// loadProfile/saveProfile/clearProfile and the intro/hint helpers touch
// `window`; validateProfile and createDemoProfile stay pure for tests.
// All entry points are SSR-safe (no window at module top level).

import {
  daysInMonth,
  parseDob,
  type Exercise,
  type LifePeople,
  type LifeProfile,
  type Region,
  type RelatedPerson,
  type Sex,
  type Smoking,
} from "@/lib/life-clock";

export const STORAGE_KEY = "life-clock-profile";
export const INTRO_KEY = "life-clock-intro";
export const HINT_ZOOM_KEY = "life-clock-hint-zoom";

const SEX_VALUES: readonly Sex[] = ["female", "male", "unspecified"];
const SMOKING_VALUES: readonly Smoking[] = ["never", "former", "current"];
const EXERCISE_VALUES: readonly Exercise[] = ["rarely", "weekly", "often"];
const REGION_VALUES: readonly Region[] = [
  "east-asia",
  "western-europe-oceania",
  "united-states",
  "latin-america",
  "mena",
  "eastern-europe-central-asia",
  "south-southeast-asia",
  "sub-saharan-africa",
  "unspecified",
];

/**
 * The author's life — what the clock shows before anyone calibrates.
 * `dob` is an inferred placeholder: Jan 1 signals "unset", the real value
 * is unknown. Everything else is ground truth as of 2026-07-20.
 */
export const DEFAULT_PROFILE: LifeProfile = {
  v: 2,
  dob: "1989-01-01",
  sex: "male",
  smoking: "never",
  exercise: "weekly",
  region: "western-europe-oceania",
  people: {
    partnerLabel: "MY WIFE",
    partnerMet: "2010-04-08",
    partnerMarried: "2021-02-13",
    children: [{ label: "MY SON", dob: "2023-10-30", sex: "male" }],
    parents: [
      { label: "DAD", dob: "1958-01-01", sex: "male" },
      { label: "MUM", dob: "1959-01-01", sex: "female" },
    ],
  },
  demo: false,
  savedAt: "2026-07-20T00:00:00.000Z",
};

/**
 * SSR-safe read + validate. null ⇒ show setup.
 * Corrupt/invalid payloads are removed; a `v > 2` payload (written by a
 * newer deploy) is preserved untouched — an old cached bundle must never
 * destroy newer-schema data.
 */
export function loadProfile(): LifeProfile | null {
  if (typeof window === "undefined") return null;
  let text: string | null;
  try {
    text = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (text === null) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    removeKey(STORAGE_KEY);
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    removeKey(STORAGE_KEY);
    return null;
  }
  const v = (raw as { v?: unknown }).v;
  if (typeof v === "number" && v > 2) return null;

  const profile = validateProfile(raw);
  if (profile === null) {
    removeKey(STORAGE_KEY);
    return null;
  }
  return profile;
}

/**
 * Stamps v: 2 and savedAt, writes JSON. Swallows quota/security errors —
 * the clock still runs from the returned in-memory profile.
 */
export function saveProfile(
  input: Omit<LifeProfile, "v" | "savedAt">,
): LifeProfile {
  const profile: LifeProfile = {
    ...input,
    v: 2,
    savedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // quota/security — run from memory
    }
  }
  return profile;
}

export function clearProfile(): void {
  removeKey(STORAGE_KEY);
}

/**
 * Pure: raw unknown → LifeProfile | null. No side effects (loadProfile owns
 * removeItem). `demo`/`savedAt` are cosmetic and coerced rather than fatal.
 * A valid v:1 payload migrates to v:2 with no `people` block.
 * `now` parameterizes the dob range check for tests.
 */
export function validateProfile(
  raw: unknown,
  now: Date = new Date(),
): LifeProfile | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.v !== 1 && obj.v !== 2) return null;
  if (typeof obj.dob !== "string" || parseDob(obj.dob, now) === null) {
    return null;
  }
  if (!isOneOf(obj.sex, SEX_VALUES)) return null;
  if (!isOneOf(obj.smoking, SMOKING_VALUES)) return null;
  if (!isOneOf(obj.exercise, EXERCISE_VALUES)) return null;
  if (!isOneOf(obj.region, REGION_VALUES)) return null;

  const demo = obj.demo === true;
  const savedAt =
    typeof obj.savedAt === "string" && !Number.isNaN(Date.parse(obj.savedAt))
      ? obj.savedAt
      : now.toISOString();

  return {
    v: 2,
    dob: obj.dob,
    sex: obj.sex,
    smoking: obj.smoking,
    exercise: obj.exercise,
    region: obj.region,
    people: obj.v === 2 ? validatePeople(obj.people, now) : undefined,
    demo,
    savedAt,
  };
}

/**
 * Relationships are decoration on top of a working clock: a malformed entry
 * costs its own events, never the whole profile. Invalid fields and invalid
 * array entries are dropped; an empty result collapses to undefined.
 */
function validatePeople(raw: unknown, now: Date): LifePeople | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const people: LifePeople = {};

  if (typeof obj.partnerLabel === "string" && obj.partnerLabel.trim() !== "") {
    people.partnerLabel = clampLabel(obj.partnerLabel);
  }
  const met = validateDateString(obj.partnerMet, now);
  if (met !== undefined) people.partnerMet = met;
  const married = validateDateString(obj.partnerMarried, now);
  if (married !== undefined) people.partnerMarried = married;

  const children = validatePersons(obj.children, now);
  if (children.length > 0) people.children = children;
  const parents = validatePersons(obj.parents, now);
  if (parents.length > 0) people.parents = parents;

  return Object.keys(people).length > 0 ? people : undefined;
}

function validatePersons(raw: unknown, now: Date): RelatedPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: RelatedPerson[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const obj = entry as Record<string, unknown>;
    if (typeof obj.label !== "string" || obj.label.trim() === "") continue;
    const dob = validateDateString(obj.dob, now);
    if (dob === undefined) continue;
    const person: RelatedPerson = { label: clampLabel(obj.label), dob };
    if (isOneOf(obj.sex, SEX_VALUES)) person.sex = obj.sex;
    out.push(person);
  }
  return out;
}

/** Person labels appear in a fixed-width card; cap so they stay legible. */
function clampLabel(label: string): string {
  return label.trim().slice(0, 24);
}

function validateDateString(raw: unknown, now: Date): string | undefined {
  if (typeof raw !== "string") return undefined;
  return parseDob(raw, now) === null ? undefined : raw;
}

/**
 * Pure: the SKIP profile — dob = now minus 30 years (day clamped to the
 * target month's length, so a Feb 29 first-run yields Feb 28), demo: true.
 * Neutral answers ⇒ expectancy 81.5.
 */
export function createDemoProfile(now: Date): Omit<LifeProfile, "v" | "savedAt"> {
  const year = now.getFullYear() - 30;
  const month0 = now.getMonth();
  const day = Math.min(now.getDate(), daysInMonth(year, month0));
  const dob = `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
  return {
    dob,
    sex: "unspecified",
    smoking: "never",
    exercise: "weekly",
    region: "unspecified",
    demo: true,
  };
}

export function hasSeenIntro(): boolean {
  return readFlag(INTRO_KEY);
}

export function markIntroSeen(): void {
  writeFlag(INTRO_KEY);
}

export function hasSeenZoomHint(): boolean {
  return readFlag(HINT_ZOOM_KEY);
}

export function markZoomHintSeen(): void {
  writeFlag(HINT_ZOOM_KEY);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // quota/security — non-fatal
  }
}

function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // security — non-fatal
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
