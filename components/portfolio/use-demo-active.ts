"use client";

import { useSyncExternalStore, type RefObject } from "react";
import { useInView } from "motion/react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/**
 * Whether a demo should run its own motion: on screen, in a visible tab, and
 * without a reduced-motion preference. Interactions should keep working when
 * this is false; only autoplay, loops and scripted sequences stop.
 *
 * Both preferences read as "motion on, tab visible" on the server and during
 * hydration, so a server-rendered hero hydrates without a mismatch and then
 * picks up the real values.
 */
export function useDemoActive(ref: RefObject<Element | null>, amount = 0.25) {
  const inView = useInView(ref, { amount });
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    () => !document.hidden,
    () => true,
  );

  return {
    active: inView && pageVisible && !reducedMotion,
    inView,
    reducedMotion,
    pageVisible,
  };
}
