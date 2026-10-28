"use client";

import { useEffect, useRef, useState } from "react";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
  blur?: string;
  once?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function BlurFade({
  children,
  className = "",
  delay = 0,
  duration = 700,
  yOffset = 12,
  blur = "10px",
  once = true,
  as: Tag = "div",
}: BlurFadeProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  // Shown without the transition, e.g. because keyboard focus landed inside
  // before it scrolled into view.
  const [instant, setInstant] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setVisible(false);
            setSettled(false);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once]);

  const Element = Tag as unknown as React.ElementType;
  // Once revealed, drop the filter, transform and will-change so a block
  // holding live content doesn't keep its own compositing layer.
  const done = visible && (settled || instant);

  return (
    <Element
      ref={ref as React.RefObject<HTMLElement>}
      className={`${className} motion-reduce:transform-none! motion-reduce:opacity-100! motion-reduce:filter-none! motion-reduce:transition-none!`}
      onFocus={() => {
        if (visible) return;
        setInstant(true);
        setVisible(true);
      }}
      onTransitionEnd={(e: React.TransitionEvent) => {
        if (e.target === e.currentTarget && visible) setSettled(true);
      }}
      style={
        done
          ? undefined
          : {
              opacity: visible ? 1 : 0,
              filter: visible ? "blur(0px)" : `blur(${blur})`,
              transform: visible ? "translate3d(0,0,0)" : `translate3d(0,${yOffset}px,0)`,
              transition: instant
                ? "none"
                : `opacity ${duration}ms ${EASE} ${delay}ms, filter ${duration}ms ${EASE} ${delay}ms, transform ${duration}ms ${EASE} ${delay}ms`,
              willChange: visible ? undefined : "opacity, filter, transform",
            }
      }
    >
      {children}
    </Element>
  );
}
