// The Comfy Commerce kit, in one import: `import { CcRoot, Button, … } from "../kit"`.
// Each file's header names the product source it ports.
export { CcRoot } from "./cc-root";
export { geist } from "./fonts";
export * from "./motion";
export * from "./icons";
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "./button";
export { Segmented, type SegmentedOption } from "./segmented";
export { StatusChip, STATUS_STYLES, type StagingState } from "./status-chip";
export { StagingActions, type StageAction, type StagingPress } from "./staging-actions";
export { Spinner } from "./spinner";
export { BlurDivider } from "./blur-divider";
export { BrandMark, ComfyMark } from "./brand-mark";
export { StoreAvatar } from "./store-avatar";
export { EmptyState } from "./empty-state";
export { CompactBar, NAV, PAGE_TITLES, PageHeader, ReviewBadge, Sidebar, STORE_NAME, type NavKey } from "./shell";
export { CAPTION, Wipe, type WipeImage } from "./wipe";
export { HOVER_WIPE_HIDDEN, HoverWipe, ThumbMedia } from "./hover-wipe";
export { gradientFor } from "./gradient";
export { CcHint, type CcHintCorner } from "./demo-hint";
export { interactHandlers, TouchClaim, touchClaim, useInteractOnRelease, type InteractHandlers } from "./interact";
