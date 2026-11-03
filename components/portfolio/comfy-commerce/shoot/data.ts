import { SHOOT_SPAGHETTI_BLACK, type CcImage } from "@/lib/comfy-commerce/media";

// "One shirt, three shots": the T-Shirt Shoot: x3 run on the Spaghetti Tee —
// Black, as the broker recorded it (run 84ad5946 in comfy-commerce.sqlite,
// 2026-07-05, Comfy Cloud, selection target, stage action add-new) and the
// run listed under it on the Activity page (17b578bd, 2026-07-03).

const THUMBS = "/images/portfolio/demos/comfy-commerce/shoot";

/** The flat-lay the run started from, at compare size. */
export const SOURCE = SHOOT_SPAGHETTI_BLACK.source;
export const PRODUCT_TITLE = SHOOT_SPAGHETTI_BLACK.productTitle;
export const WORKFLOW_NAME = SHOOT_SPAGHETTI_BLACK.workflow;

const result = (shot: "standing" | "seated" | "close-up") =>
  SHOOT_SPAGHETTI_BLACK.results.find((r) => r.shot === shot)!.image;

export interface Shot {
  id: string;
  /** The workflow's label for the prompt that makes this shot (builtin-graphs.ts params). */
  title: string;
  image: CcImage;
}

/**
 * The three outputs in the order the run staged them (staging_items for run
 * 84ad5946: 377f92ab, 2bb12f7d, d4742359, 330 ms apart), titled with the
 * labels of the three prompt params that make them (text-35, value-34,
 * value-31), which run in that same order.
 */
export const SHOTS: Shot[] = [
  { id: "standing", title: "Model standing by window", image: result("standing") },
  { id: "detail", title: "Detail macro shot", image: result("close-up") },
  { id: "seated", title: "Model seated", image: result("seated") },
];

/** What a staged add reads as in review (ReviewCard.tsx actionLabel for add-new, image). */
export const ACTION_LABEL = "Add as new image";

/* ------------------------------------------------------------- the runs */

/** A slice of the product's Run and RunItem (packages/shared/src/runs.ts). */
export type RunState = "queued" | "running" | "completed" | "failed" | "cancelled";
export type RunItemState = "pending" | "editing" | "done" | "failed";

export interface DemoRunItem {
  productTitle: string;
  state: RunItemState;
  /** The item's afterUrl: its first output, as a small square thumbnail (a 3D model has none to draw). */
  output: string | null;
  mediaType?: "image" | "model3d";
}

export interface DemoRun {
  id: string;
  workflowName: string;
  state: RunState;
  items: DemoRunItem[];
  /** timeAgo(createdAt), fixed: "just now" for the live run, the date for the old one. */
  when: string;
  /** Results this run staged that still wait for a person (the Review (n) button). */
  pendingReview: number;
}

/**
 * Two runs listed under the live one, from the same store's history, every
 * result long since reviewed. Dates are the product's timeAgo in Willie's time
 * zone (UTC+12).
 *  - 17b578bd: T-Shirt Shoot: x3 over two hand-picked flat-lays (Artists'
 *    Tool Tee — Floral, Hologram Tee — Black), all published. Two items, so
 *    its thumbnail is the product's two-card fan. 2026-07-03T23:50Z.
 *  - a752bc24: Tripo P1 Image to 3D on the Send Nodes Cap, rejected. Its
 *    output is a .glb, which the thumbnail draws as the boxed 3D glyph.
 *    2026-07-01T16:29Z.
 */
export const EARLIER_RUNS: DemoRun[] = [
  {
    id: "17b578bd",
    workflowName: WORKFLOW_NAME,
    state: "completed",
    items: [
      { productTitle: "Artists' Tool Tee — Floral", state: "done", output: `${THUMBS}/artists-tool-tee-floral-standing-thumb.webp` },
      { productTitle: "Hologram Tee — Black", state: "done", output: `${THUMBS}/hologram-tee-black-standing-thumb.webp` },
    ],
    when: "Jul 4",
    pendingReview: 0,
  },
  {
    id: "a752bc24",
    workflowName: "Tripo P1 Image to 3D",
    state: "completed",
    items: [{ productTitle: "Send Nodes Cap", state: "done", output: "send-nodes-cap.glb", mediaType: "model3d" }],
    when: "Jul 2",
    pendingReview: 0,
  },
];

/** The live run's afterUrl: the first output (the standing shot), cut square for the 48px thumbnail. */
const LIVE_OUTPUT = `${THUMBS}/spaghetti-tee-black-standing-thumb.webp`;

/**
 * The scripted run's beats. One flat-lay is one RunItem however many images
 * the workflow returns: the item goes pending -> editing -> done, and the
 * broker then stages its three outputs into review one after another.
 */
export type Phase = "queued" | "running" | "staging" | "completed";

export interface Script {
  /** Bumped on Replay, so the run row enters again as a new run. */
  take: number;
  phase: Phase;
  /** Outputs staged into review so far (0–3). */
  staged: number;
}

export const START: Script = { take: 0, phase: "queued", staged: 0 };
/** The resting frame under reduced motion: the run done, all three shots staged. */
export const FINISHED: Script = { take: 0, phase: "completed", staged: SHOTS.length };

/** The live run as the product's Run would read at this beat. */
export function liveRun(script: Script): DemoRun {
  const { phase, staged } = script;
  const itemState: RunItemState = phase === "queued" ? "pending" : phase === "running" ? "editing" : "done";
  return {
    id: `84ad5946-${script.take}`,
    workflowName: WORKFLOW_NAME,
    state: phase === "queued" ? "queued" : phase === "completed" ? "completed" : "running",
    items: [{ productTitle: PRODUCT_TITLE, state: itemState, output: itemState === "done" ? LIVE_OUTPUT : null }],
    when: "just now",
    pendingReview: staged,
  };
}

/*
 * Timing. The real run took 59 s on Comfy Cloud, almost all of it in one
 * generation; the tile keeps the shape and drops the wait.
 */
/** Queued until a run slot frees (RUN_CONCURRENCY). */
const QUEUED_MS = 700;
/** The generation: the bar holds at half (an in-flight item counts half). */
const GENERATE_MS = 3000;
/** Between staged outputs, as the real rows were written. */
const STAGE_GAP_MS = 330;
/** From the last output staged to the run reading completed (the bar's 0.8 s fill has landed). */
const SETTLE_MS = 450;
/** A listing thumbnail holds the finished run this long, then runs it again. */
const THUMBNAIL_HOLD_MS = 4500;

/** The next beat after `script` and how long until it, or null where the run rests. */
export function nextBeat(script: Script, loop: boolean): { after: number; to: Script } | null {
  const { phase, staged } = script;
  if (phase === "queued") return { after: QUEUED_MS, to: { ...script, phase: "running" } };
  if (phase === "running") return { after: GENERATE_MS, to: { ...script, phase: "staging", staged: 1 } };
  if (phase === "staging") {
    return staged < SHOTS.length
      ? { after: STAGE_GAP_MS, to: { ...script, staged: staged + 1 } }
      : { after: SETTLE_MS, to: { ...script, phase: "completed" } };
  }
  return loop ? { after: THUMBNAIL_HOLD_MS, to: { ...START, take: script.take + 1 } } : null;
}
