"use client";

import { motion } from "motion/react";

// The Publish button's icon, ported from web/src/lib/animated-icons/UploadCloudIcon.tsx
// and the IconSvg shell in animated-icons/shared.tsx. At rest it is the
// ICONCINO upload-cloud glyph (the kit's static UploadCloud), path for path;
// on hover the cloud settles up a touch and the arrow rises clearly more.

/** easeOutCubic: a soft, settling rise with no overshoot (the product's own value). */
const EASE = [0.33, 1, 0.68, 1] as const;
const TRANSITION = { duration: 0.4, ease: EASE };

/** Units are viewBox (24) coordinates, so a `y` of 5 is about 3.75px at 18px. */
const CLOUD = { rest: { y: 0 }, hover: { y: [1.5, 0], transition: TRANSITION } };
const ARROW = { rest: { y: 0 }, hover: { y: [5, 0], transition: TRANSITION } };

/**
 * The product drives `animate` from the button's hover (lib/useHover.ts), so
 * the lift plays each time the pointer comes onto Publish. Decorative: the
 * button's label names it.
 */
export function UploadCloudIcon({ animate = "rest", size = 18 }: { animate?: "rest" | "hover"; size?: number }) {
  return (
    <motion.svg
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="rest"
      animate={animate}
      className="shrink-0"
    >
      <motion.path
        d="M7 19L5.78311 18.9954C3.12231 18.8818 1 16.6888 1 14C1 11.3501 3.06139 9.18169 5.66806 9.01084C6.78942 6.64027 9.20316 5 12 5C15.5268 5 18.4445 7.60822 18.9293 11.001L19 11C21.2091 11 23 12.7909 23 15C23 17.1422 21.316 18.8911 19.1996 18.9951L17 19"
        variants={CLOUD}
        style={{ transformBox: "view-box" }}
      />
      <motion.g variants={ARROW} style={{ transformBox: "view-box" }}>
        <path d="M12 20V12" />
        <path d="M9 15L12 12L15 15" />
      </motion.g>
    </motion.svg>
  );
}
