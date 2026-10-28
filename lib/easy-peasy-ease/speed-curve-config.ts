/**
 * Speed-curve constants, from easy-peasy-ease/lib/speed-curve-config.ts (the
 * subset the portfolio demos use).
 */

/** 60 fps output for smooth easing at full quality. */
export const MAX_OUTPUT_FPS = 60;
/** Preview renders (the product default) run at 30 fps. */
export const PREVIEW_FPS = 30;

/** Kling clips are 5 seconds long. */
export const DEFAULT_INPUT_DURATION = 5;
/** Each clip is eased down to 1.5 s by default. */
export const DEFAULT_OUTPUT_DURATION = 1.5;
/** Closest easing.dev curve to the old easeInOutSine. */
export const DEFAULT_EASING = "In Out Quad";
