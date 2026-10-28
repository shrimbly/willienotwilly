"use client";

import { useEffect, useState, type RefObject } from "react";
import { useInView, useReducedMotion } from "motion/react";

/**
 * Whether a demo should run its own motion: on screen, in a visible tab, and
 * without a reduced-motion preference. Interactions should keep working when
 * this is false; only autoplay, loops and scripted sequences stop.
 */
export function useDemoActive(ref: RefObject<Element | null>, amount = 0.25) {
  const inView = useInView(ref, { amount });
  const reducedMotion = useReducedMotion() ?? false;
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return {
    active: inView && pageVisible && !reducedMotion,
    inView,
    reducedMotion,
  };
}
