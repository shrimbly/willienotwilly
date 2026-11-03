import { REVIEW_PAIRS, type ReviewPair } from "@/lib/comfy-commerce/media";

import type { StageAction } from "../kit/staging-actions";
import type { StagingState } from "../kit/status-chip";

/** One staged result in the hero's queue (a slice of the product's StagingItem). */
export interface QueueItem {
  id: string;
  pair: ReviewPair;
  action: StageAction;
  /** 1-based gallery slot an in-place replacement swaps. */
  targetPosition: number;
  state: StagingState;
}

/** The queue, in order: two landscape loft shots either side of the portrait studio one. */
const QUEUE_PAIRS = ["spaghetti-black-standing", "we-black-model", "hologram-black-standing", "floral-seated"];

/**
 * Four results waiting for a person, each replacing its listing's featured
 * image (so Approve then Publish both happen in the lightbox, as for a
 * replacement in the product; an add would go on to Finalize instead).
 */
export function initialQueue(): QueueItem[] {
  return QUEUE_PAIRS.map((id) => {
    const pair = REVIEW_PAIRS.find((p) => p.id === id)!;
    return { id, pair, action: "replace-position", targetPosition: 1, state: "pending" };
  });
}

/** The thumbnail loop rejects this one (the gate has two answers); the rest it approves and publishes. */
export const SCRIPTED_REJECT = "hologram-black-standing";

/** The lightbox's caption pairs (CompareMedia.tsx): side by side, then wipe. */
export function captionsFor(action: StageAction) {
  return action === "add-new"
    ? { side: ["Source", "New"] as const, wipe: ["Source", "New"] as const }
    : { side: ["Before · live", "After"] as const, wipe: ["Before", "After"] as const };
}
