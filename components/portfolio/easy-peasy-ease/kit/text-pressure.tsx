"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import { EPE_WORDMARK_FONT } from "./fonts";

/**
 * Port of easy-peasy-ease/components/text/text-pressure.tsx, the wordmark:
 * each character's variable-font weight responds to cursor proximity
 * (wght 900 far away, thinning to 400 under the cursor, within 150px).
 *
 * Changes from the product:
 * - Pointer position lives in a ref and is applied in one rAF, instead of a
 *   React state update per mousemove.
 * - `active` gates the intro sweep and the window listener (pass
 *   useDemoActive().active); the sweep runs the first time it turns true.
 * - fontFamily defaults to the portfolio's Inter (variable wght); the
 *   product's fontUrl <style> injection is dropped.
 *
 * Landing call: <TextPressure text="EasyPeasyEase" weight width={false} italic={false}
 *   alpha={false} flex={false} initialAnimationDelay={700}
 *   className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground max-w-4xl" />
 */
interface TextPressureProps {
  text: string;
  fontFamily?: string;
  width?: boolean;
  weight?: boolean;
  italic?: boolean;
  alpha?: boolean;
  flex?: boolean;
  stroke?: boolean;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  initialAnimationDelay?: number;
  /** Run the intro sweep and follow the mouse only while true. */
  active?: boolean;
  className?: string;
}

const MAX_DISTANCE = 150;
const SWEEP_DURATION = 2000;
const FAR_AWAY = -1e6;

export function TextPressure({
  text,
  fontFamily = EPE_WORDMARK_FONT,
  width = true,
  weight = true,
  italic = true,
  alpha = false,
  flex = true,
  stroke = false,
  textColor = "currentColor",
  strokeColor = "var(--destructive)",
  strokeWidth = 2,
  initialAnimationDelay = 0,
  active = true,
  className,
}: TextPressureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);
  const pointerRef = useRef({ x: FAR_AWAY, y: FAR_AWAY });
  const frameRef = useRef(0);
  const shouldReduceMotion = useReducedMotion();
  const [isAnimating, setIsAnimating] = useState(true);

  const updateCharacters = useCallback(() => {
    if (shouldReduceMotion || !containerRef.current || charsRef.current.length === 0) return;
    const { x, y } = pointerRef.current;

    charsRef.current.forEach((char) => {
      if (!char) return;
      const rect = char.getBoundingClientRect();
      const charCenterX = rect.left + rect.width / 2;
      const charCenterY = rect.top + rect.height / 2;
      const distance = Math.sqrt(Math.pow(x - charCenterX, 2) + Math.pow(y - charCenterY, 2));
      const influence = Math.max(0, 1 - distance / MAX_DISTANCE);

      let fontVariationSettings = "";
      if (weight) {
        // Reverse: start at 900 (super bold), thin to 400 on hover.
        fontVariationSettings += `"wght" ${900 - influence * 500}`;
      }
      if (width) {
        if (fontVariationSettings) fontVariationSettings += ", ";
        fontVariationSettings += `"wdth" ${100 + influence * 50}`;
      }
      if (italic) {
        if (fontVariationSettings) fontVariationSettings += ", ";
        fontVariationSettings += `"ital" ${influence}`;
      }
      if (fontVariationSettings) {
        char.style.fontVariationSettings = fontVariationSettings;
      }
      if (alpha) {
        char.style.opacity = (0.5 + influence * 0.5).toString();
      }
    });
  }, [alpha, italic, shouldReduceMotion, weight, width]);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      updateCharacters();
    });
  }, [updateCharacters]);

  useEffect(() => {
    scheduleUpdate();
    return () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [scheduleUpdate]);

  // Intro: a simulated cursor drags left to right across the word.
  useEffect(() => {
    if (shouldReduceMotion || !active || !isAnimating) return;

    let animationFrame = 0;
    const delayTimer = window.setTimeout(() => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      const startX = containerRect.left - 100;
      const endX = containerRect.right + 100;
      const centerY = containerRect.top + containerRect.height / 2;
      let startTime: number | null = null;

      const animateMouseDrag = (now: number) => {
        startTime ??= now;
        const progress = Math.min((now - startTime) / SWEEP_DURATION, 1);
        const easedProgress = -(Math.cos(Math.PI * progress) - 1) / 2;
        pointerRef.current = { x: startX + (endX - startX) * easedProgress, y: centerY };
        updateCharacters();
        if (progress < 1) {
          animationFrame = requestAnimationFrame(animateMouseDrag);
        } else {
          setIsAnimating(false);
        }
      };
      animationFrame = requestAnimationFrame(animateMouseDrag);
    }, initialAnimationDelay);

    return () => {
      window.clearTimeout(delayTimer);
      cancelAnimationFrame(animationFrame);
    };
  }, [active, initialAnimationDelay, isAnimating, shouldReduceMotion, updateCharacters]);

  // Then the real cursor takes over.
  useEffect(() => {
    if (isAnimating || shouldReduceMotion || !active) return;
    const handleMouseMove = (e: MouseEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      scheduleUpdate();
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [active, isAnimating, scheduleUpdate, shouldReduceMotion]);

  const characters = text.split("");

  return (
    <div
      ref={containerRef}
      className={cn(
        "inline-flex w-full items-center justify-center",
        flex ? "flex-wrap" : "flex-nowrap",
        className,
      )}
      style={{
        fontFamily,
        color: textColor,
        lineHeight: "1.2",
        letterSpacing: "-0.02em",
      }}
    >
      {characters.map((char, index) => (
        <span
          key={index}
          ref={(el) => {
            if (el) charsRef.current[index] = el;
          }}
          style={
            {
              display: "inline-block",
              position: "relative",
              WebkitTextStroke: stroke ? `${strokeWidth}px ${strokeColor}` : undefined,
              whiteSpace: char === " " ? "pre" : undefined,
              transition: shouldReduceMotion
                ? undefined
                : "font-variation-settings 120ms cubic-bezier(0.2, 0, 0, 1)",
            } as CSSProperties
          }
        >
          {char}
        </span>
      ))}
    </div>
  );
}
