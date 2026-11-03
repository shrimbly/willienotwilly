"use client";

import { Button } from "./button";
import { Check, IconBox, RotateCcw, Undo2, X } from "./icons";
import { Spinner } from "./spinner";
import type { StagingState } from "./status-chip";

// Ported from StagingActions in web/src/features/review/ReviewCard.tsx: the
// state-appropriate review buttons the list rows and the lightbox share.

/** How a result lands: replace-position swaps a live image in place; the adds keep it. */
export type StageAction = "replace-position" | "add-new" | "add-featured";

/** Which action a scripted press is drawing (see Button's `pressed`). */
export type StagingPress = "approve" | "reject" | "publish" | "revert" | null;

/**
 * Pending: Reject and Approve. Approved: Reject, plus Publish for an in-place
 * replacement (an add's publish goes through Finalize, where the gallery
 * order is set). Published: Revert (or Remove, for an add). Failed: Reject
 * and Retry. Rejected: nothing. While `busy`, a spinner. Retry (re-running the
 * workflow) is left out: it opens the RunSheet, which a tile doesn't have.
 *
 * The primary action carries data-primary, so a demo can move focus to it
 * when the buttons swap under a keyboard user.
 */
export function StagingActions({
  state,
  action = "replace-position",
  busy = false,
  pressed = null,
  canRevert = true,
  onApprove,
  onReject,
  onPublish,
  onRevert,
}: {
  state: StagingState;
  action?: StageAction;
  busy?: boolean;
  pressed?: StagingPress;
  canRevert?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPublish: () => void;
  onRevert: () => void;
}) {
  if (busy || state === "publishing") return <Spinner label="Working" />;
  // Keyed, so a swap (Approve -> Publish) mounts a new button, as the product's separate branches do, rather than morphing one.
  const reject = (
    <Button key="reject" variant="ghost" size="sm" onClick={onReject} pressed={pressed === "reject"}>
      <IconBox>
        <X />
      </IconBox>
      Reject
    </Button>
  );
  if (state === "pending") {
    return (
      <>
        {reject}
        <Button key="approve" data-primary variant="success" size="sm" onClick={onApprove} pressed={pressed === "approve"}>
          <IconBox>
            <Check />
          </IconBox>
          Approve
        </Button>
      </>
    );
  }
  if (state === "approved") {
    return (
      <>
        {reject}
        {action === "replace-position" && (
          <Button key="publish" data-primary variant="primary" size="sm" onClick={onPublish} pressed={pressed === "publish"}>
            Publish
          </Button>
        )}
      </>
    );
  }
  if (state === "published") {
    const isAdd = action !== "replace-position";
    return (
      <Button key="revert" data-primary variant="ghost" size="sm" onClick={onRevert} disabled={!canRevert} pressed={pressed === "revert"}>
        <IconBox>
          <Undo2 />
        </IconBox>
        {isAdd ? "Remove" : "Revert"}
      </Button>
    );
  }
  if (state === "failed") {
    return (
      <>
        {reject}
        <Button key="retry" data-primary variant="primary" size="sm" onClick={onPublish} pressed={pressed === "publish"}>
          <IconBox>
            <RotateCcw />
          </IconBox>
          Retry
        </Button>
      </>
    );
  }
  return null;
}
