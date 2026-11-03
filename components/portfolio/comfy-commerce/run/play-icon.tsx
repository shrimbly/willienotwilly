"use client";

import { useState } from "react";
import { motion } from "motion/react";

// Ported from web/src/lib/animated-icons/PlayIcon.tsx (on the IconSvg shell in
// shared.tsx) and lib/useHover.ts: the run buttons' play glyph, which pops on
// hover. At rest it is the ICONCINO play path, pixel for pixel.

const POP = {
  rest: { scale: 1 },
  hover: { scale: 1.18, transition: { type: "spring" as const, visualDuration: 0.2, bounce: 0.45 } },
};

/** The play glyph; `hover` springs it up a touch about its centre. Decorative. */
export function PlayIcon({ hover = false, size = 18 }: { hover?: boolean; size?: number }) {
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
      animate={hover ? "hover" : "rest"}
      className="shrink-0"
    >
      <motion.path
        d="M8 17.259V6.74104C8 5.96925 8.83721 5.48837 9.50387 5.87726L19.2596 11.5681C19.5904 11.761 19.5904 12.2389 19.2596 12.4319L9.50387 18.1227C8.83721 18.5116 8 18.0308 8 17.259Z"
        variants={POP}
        style={{ transformBox: "view-box", transformOrigin: "12px 12px" }}
      />
    </motion.svg>
  );
}

/** useHover: spread `props` on the button and pass `hover` to its PlayIcon. Off under reduced motion. */
export function useHover(reducedMotion = false) {
  const [hovered, setHovered] = useState(false);
  return {
    hover: hovered && !reducedMotion,
    props: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  };
}
