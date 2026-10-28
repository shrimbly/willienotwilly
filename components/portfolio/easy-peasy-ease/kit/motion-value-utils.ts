import { isMotionValue, type MotionValue } from "motion/react";

/** Narrowing form of motion's isMotionValue for `number | MotionValue<number>` props. */
export function isNumberMotionValue(
  value: number | MotionValue<number> | undefined,
): value is MotionValue<number> {
  return value !== undefined && typeof value !== "number" && isMotionValue(value);
}

/**
 * Call `apply` with the current value and on every change (motion value), or
 * once (number). Returns the unsubscribe, for use as an effect cleanup.
 */
export function followValue(
  value: number | MotionValue<number>,
  apply: (latest: number) => void,
): (() => void) | undefined {
  if (isNumberMotionValue(value)) {
    apply(value.get());
    return value.on("change", apply);
  }
  apply(value);
  return undefined;
}
