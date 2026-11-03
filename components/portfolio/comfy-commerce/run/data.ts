import type { CSSProperties } from "react";

import { BUILTIN_WORKFLOWS, PRODUCTS, type CcImage, type CcProduct } from "@/lib/comfy-commerce/media";
import { OUTPUTS_PER_INPUT, SAMPLE_SIZE, type EngineId, type StageAction } from "@/lib/comfy-commerce/run";

import { gradientFor } from "../kit/gradient";

// The run demo's model: the Browse grid's media tiles (BrowsePage's
// selectionsOf over the seeded catalog), the run target and its estimate
// (RunSheet targetLabel, the /runs/estimate counts), and runs as the Activity
// page lists them (packages/shared Run, RunItem), with local state in place
// of the broker and its executor.

const RUN_ROOT = "/images/portfolio/demos/comfy-commerce/run";

/** One media tile in the grid: a product's image, by position (1 = featured). */
export interface Tile {
  id: string;
  product: CcProduct;
  media: CcImage;
  position: number;
}

/** Every in-scope image in display order, product by product (BrowsePage's visibleSelections). */
export const TILES: Tile[] = PRODUCTS.flatMap((product) =>
  product.media.map((media, i) => ({ id: `${product.slug}#${i + 1}`, product, media, position: i + 1 })),
);

export const TILE_BY_ID = new Map(TILES.map((t) => [t.id, t]));

/** The store's tags (seed-products.ts gives every tee the same two). */
export const STORE_TAGS = ["merch", "tee"] as const;

/**
 * BrowsePage's media-first search, reduced to what the seeded catalog has: a
 * word-boundary match on the title or a tag keeps the whole product (there are
 * no captions to match image by image; the store's enrichment table is empty).
 */
export function filterProducts(query: string, tag: string): CcProduct[] {
  const q = query.trim().toLowerCase();
  const re = q ? new RegExp("\\b" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  // Every tee carries both tags, so a tag filter keeps the lot.
  if (tag !== "all" && !(STORE_TAGS as readonly string[]).includes(tag)) return [];
  return PRODUCTS.filter((p) => !re || re.test(p.title) || STORE_TAGS.some((t) => re.test(t)));
}

/* --------------------------------------------------------------- targets */

export type RunTarget = { kind: "catalog" } | { kind: "selection"; inputs: string[] };

export function targetTiles(target: RunTarget): Tile[] {
  if (target.kind === "catalog") return TILES;
  // The broker groups a selection's refs by product, in the order the products first appear.
  const order: string[] = [];
  const byProduct = new Map<string, Tile[]>();
  for (const id of target.inputs) {
    const tile = TILE_BY_ID.get(id);
    if (!tile) continue;
    const list = byProduct.get(tile.product.slug);
    if (list) list.push(tile);
    else {
      byProduct.set(tile.product.slug, [tile]);
      order.push(tile.product.slug);
    }
  }
  return order.flatMap((slug) => byProduct.get(slug) ?? []);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** RunSheet's targetLabel. */
export function targetLabel(target: RunTarget): string {
  if (target.kind === "catalog") return "Entire catalog (in scope)";
  return `${plural(target.inputs.length, "selected image")}`;
}

/** The estimate the sheet shows beside it: images and the products they come from. */
export function estimateOf(target: RunTarget) {
  const tiles = targetTiles(target);
  return { images: tiles.length, products: new Set(tiles.map((t) => t.product.slug)).size };
}

/** runService pickSample: spread the sample across distinct products before taking seconds. */
export function pickSample(tiles: Tile[], size = SAMPLE_SIZE): Tile[] {
  if (tiles.length <= size) return tiles;
  const byProduct = new Map<string, Tile[]>();
  for (const tile of tiles) byProduct.set(tile.product.slug, [...(byProduct.get(tile.product.slug) ?? []), tile]);
  const groups = [...byProduct.values()];
  const sample: Tile[] = [];
  for (let round = 0; sample.length < size; round += 1) {
    let took = false;
    for (const group of groups) {
      const tile = group[round];
      if (!tile) continue;
      sample.push(tile);
      took = true;
      if (sample.length >= size) break;
    }
    if (!took) break;
  }
  return sample;
}

/* ------------------------------------------------------------ workflows */

export type PickerWorkflow = (typeof BUILTIN_WORKFLOWS)[number];

/** The picker's 40px thumbnails: centre crops of the cards' images at 120px. Tripo's card is a clip, so it draws a gradient. */
export const PICKER_THUMBS: Record<string, string | null> = {
  "builtin:subtle-grade": `${RUN_ROOT}/subtle-grade.webp`,
  "builtin:t-shirt-shoot-x3": `${RUN_ROOT}/t-shirt-shoot-x3.webp`,
  "builtin:relighting": `${RUN_ROOT}/relighting.webp`,
  "builtin:change-aspect-ratio": `${RUN_ROOT}/change-aspect-ratio.webp`,
  "builtin:fit-to-768px": `${RUN_ROOT}/fit-to-768px.webp`,
  "builtin:nano-banana-2-generic": `${RUN_ROOT}/nano-banana-2-generic.webp`,
  "builtin:gpt-image-2-generic": `${RUN_ROOT}/gpt-image-2-generic.webp`,
  "builtin:amazon-spec-product-image": `${RUN_ROOT}/amazon-spec-product-image.webp`,
  "builtin:tripo-p1-image-to-3d": null,
};

export const workflowById = (id: string | null) => BUILTIN_WORKFLOWS.find((w) => w.id === id);

/* --------------------------------------------------------------- outputs */

/**
 * The first output of a T-Shirt Shoot: x3 run, where the real store has one
 * (144px crops of the staged results): the standing shot, or the seated one
 * where only that was kept.
 */
const SHOOT_OUTPUTS: Partial<Record<string, string>> = {
  "spaghetti-tee-black": `${RUN_ROOT}/out-spaghetti-tee-black-standing.webp`,
  "hologram-tee-black": `${RUN_ROOT}/out-hologram-tee-black-standing.webp`,
  "artists-tool-tee-floral": `${RUN_ROOT}/out-artists-tool-tee-floral-seated.webp`,
  "artists-tool-tee-chrome": `${RUN_ROOT}/out-artists-tool-tee-chrome-standing.webp`,
  "spaghetti-tee-grape": `${RUN_ROOT}/out-spaghetti-tee-grape-seated.webp`,
  "we-tee-bone": `${RUN_ROOT}/out-we-tee-bone-standing.webp`,
};

/** A run output's thumbnail: a real image, or the product's placeholder gradient where no real result exists. */
export type OutputThumb = { src: string } | { style: CSSProperties };

/**
 * What a finished item shows in the run's thumbnail fan. Real where the
 * product has it: T-Shirt Shoot results from the store, and for Resize the
 * flat-lay itself (its output is the same picture, smaller). Results nobody
 * ever generated are drawn as gradientFor, the product's own stand-in for a
 * missing thumbnail, never as a made-up picture.
 */
export function outputFor(workflowId: string, tile: Tile): OutputThumb {
  if (workflowId === "builtin:t-shirt-shoot-x3") {
    const src = SHOOT_OUTPUTS[tile.product.slug];
    if (src) return { src };
  }
  if (workflowId === "builtin:fit-to-768px") return { src: tile.media.src };
  return { style: gradientFor(`${workflowId}:${tile.id}`) };
}

/* ------------------------------------------------------------------ runs */

export type ItemState = "pending" | "editing" | "done" | "failed";

export interface DemoRunItem {
  tileId: string;
  productTitle: string;
  state: ItemState;
  error?: string;
  output?: OutputThumb;
}

export type RunState = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface DemoRun {
  id: string;
  workflowId: string;
  workflowName: string;
  engineId: EngineId;
  targetKind: RunTarget["kind"];
  stageAction: StageAction;
  sample: boolean;
  /** The full target's size, for a sample ("Sample of N"). */
  sampleOfTotal?: number;
  /** Tiles the sample left for "Run remaining". */
  remaining?: string[];
  /** Set once its remainder has been run (the demo then drops the button; see ChainRow). */
  promoted?: boolean;
  items: DemoRunItem[];
  state: RunState;
  /** timeAgo of its start ("just now" for runs made here). */
  ago: string;
  /** Results already reviewed, so the row reads "Reviewed" (the history rows). */
  reviewed?: boolean;
}

export function runCounts(run: Pick<DemoRun, "items">) {
  let done = 0;
  let failed = 0;
  for (const item of run.items) {
    if (item.state === "done") done += 1;
    else if (item.state === "failed") failed += 1;
  }
  return { total: run.items.length, done, failed };
}

/** Results this run staged that still wait for a person (pending staging items). */
export function pendingReview(run: DemoRun) {
  if (run.reviewed) return 0;
  return runCounts(run).done * (OUTPUTS_PER_INPUT[run.workflowId] ?? 1);
}

let nextRunId = 0;

/** A new run over `tiles`, its first item already generating (the executor picks it up at once). */
export function makeRun(
  fields: Omit<DemoRun, "id" | "items" | "state" | "ago">,
  tiles: Tile[],
  { finished = false }: { finished?: boolean } = {},
): DemoRun {
  nextRunId += 1;
  return {
    ...fields,
    id: `run-${nextRunId}`,
    state: finished ? "completed" : "running",
    ago: "just now",
    items: tiles.map((tile, i) => ({
      tileId: tile.id,
      productTitle: tile.product.title,
      state: finished ? "done" : i === 0 ? "editing" : "pending",
      output: finished ? outputFor(fields.workflowId, tile) : undefined,
    })),
  };
}

/** Finish the item at `index` and start the next, or settle the run when none is left. */
export function advanceRun(run: DemoRun, index: number): DemoRun {
  const tile = TILE_BY_ID.get(run.items[index]?.tileId ?? "");
  if (!tile || run.items[index].state !== "editing") return run;
  const items = run.items.map((item, i) =>
    i === index ? { ...item, state: "done" as const, output: outputFor(run.workflowId, tile) } : item,
  );
  const next = items.findIndex((item) => item.state === "pending");
  if (next >= 0) {
    items[next] = { ...items[next], state: "editing" };
    return { ...run, items };
  }
  return settle({ ...run, items });
}

/** A run with nothing left in flight: completed if anything came back, failed otherwise. */
function settle(run: DemoRun): DemoRun {
  const { done } = runCounts(run);
  return { ...run, state: done > 0 ? "completed" : "failed" };
}

/** CancelControl's "Skip current image": the in-flight item fails, the batch keeps going. */
export function skipCurrent(run: DemoRun): DemoRun {
  const index = run.items.findIndex((item) => item.state === "editing");
  if (index < 0) return run;
  const items = run.items.map((item, i) => (i === index ? { ...item, state: "failed" as const, error: "Skipped" } : item));
  const next = items.findIndex((item) => item.state === "pending");
  if (next >= 0) {
    items[next] = { ...items[next], state: "editing" };
    return { ...run, items };
  }
  return settle({ ...run, items });
}

/** runService cancel: every unfinished item fails as "Cancelled" and the run stops. */
export function cancelRun(run: DemoRun): DemoRun {
  return {
    ...run,
    state: "cancelled",
    items: run.items.map((item) =>
      item.state === "editing" || item.state === "pending" ? { ...item, state: "failed" as const, error: "Cancelled" } : item,
    ),
  };
}

/** Retry: the failed items go back in line and the run picks up again. */
export function retryRun(run: DemoRun): DemoRun {
  const items = run.items.map((item) => (item.state === "failed" ? { ...item, state: "pending" as const, error: undefined } : item));
  const first = items.findIndex((item) => item.state === "pending");
  if (first < 0) return run;
  items[first] = { ...items[first], state: "editing" };
  return { ...run, state: "running", items };
}

/** A finished run, already reviewed, for the Activity history. */
function pastRun(fields: Omit<DemoRun, "id" | "items" | "state" | "ago" | "stageAction" | "sample">, tileIds: string[], ago: string): DemoRun {
  const tiles = tileIds.map((id) => TILE_BY_ID.get(id)).filter((t): t is Tile => Boolean(t));
  return {
    ...makeRun({ ...fields, stageAction: "add-new", sample: false }, tiles, { finished: true }),
    ago,
    reviewed: true,
  };
}

/**
 * What the Activity page already holds before this tile's run: two finished,
 * reviewed runs from the store's own history (the T-Shirt Shoot results on
 * the Chrome and Grape tees, and a Resize over the catalog, the run in the
 * product's screenshots), newest first.
 */
export function historyRuns(): DemoRun[] {
  return [
    pastRun(
      { workflowId: "builtin:t-shirt-shoot-x3", workflowName: "T-Shirt Shoot: x3", engineId: "comfy-cloud", targetKind: "selection" },
      ["artists-tool-tee-chrome#1", "spaghetti-tee-grape#1"],
      "3h ago",
    ),
    pastRun(
      { workflowId: "builtin:fit-to-768px", workflowName: "Resize", engineId: "comfy-local", targetKind: "catalog" },
      TILES.map((t) => t.id),
      "20h ago",
    ),
  ];
}

/** ActivityPage's dominantProvider: the engine most runs used, so only the odd one out names its engine. */
export function dominantEngine(runs: DemoRun[]): EngineId | null {
  const tally = new Map<EngineId, number>();
  for (const r of runs) tally.set(r.engineId, (tally.get(r.engineId) ?? 0) + 1);
  let top: EngineId | null = null;
  let max = 0;
  for (const [engine, n] of tally) {
    if (n > max) {
      max = n;
      top = engine;
    }
  }
  return top;
}

/**
 * The tiles the scripted pass picks: three tees whose T-Shirt Shoot results
 * are real, all on the first page even of a phone-sized tile.
 */
export const SCRIPT_PICKS = ["we-tee-bone#1", "spaghetti-tee-black#1", "hologram-tee-black#1"];
/** And the workflow and engine it chooses. */
export const SCRIPT_WORKFLOW = "builtin:t-shirt-shoot-x3";
export const SCRIPT_ENGINE: EngineId = "comfy-cloud";
