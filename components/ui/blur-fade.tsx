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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once]);

  const Element = Tag as unknown as React.ElementType;

  return (
    <Element
      ref={ref as React.RefObject<HTMLElement>}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        filter: visible ? "blur(0px)" : `blur(${blur})`,
        transform: visible ? "translate3d(0,0,0)" : `translate3d(0,${yOffset}px,0)`,
        transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, filter ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: "opacity, filter, transform",
      }}
    >
      {children}
    </Element>
  );
}
