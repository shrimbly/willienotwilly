// The portfolio's shared press and touch helpers, re-exported for Comfy
// Commerce tiles. They live in the Node Banana kit but are product-agnostic:
// useInteractOnRelease counts a mouse press at once and a finger only when it
// lifts (a scroll past the tile never counts); TouchClaim hands a touch press
// to the demo only once it moves sideways, so vertical swipes scroll the page.
export { interactHandlers, useInteractOnRelease, type InteractHandlers } from "@/components/portfolio/node-banana/kit/use-interact";
export { TouchClaim, touchClaim } from "@/components/portfolio/node-banana/kit/touch";
