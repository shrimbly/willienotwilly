"use client";

import { useEffect, useMemo, type CSSProperties, type HTMLAttributes, type Ref } from "react";
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * Port of easy-peasy-ease/components/ui/light-rays.tsx (working tree): ambient
 * god-rays plus the hover beam the landing turns on over the drop zone.
 *
 * Changes from the product:
 * - Sized by its container, not the viewport: length defaults to "70%", the
 *   beam is 105% tall and clamp(220px, 28cqw, 420px) wide (cqw of the EpeRoot).
 * - Rays come from a seeded generator (`seed`), so the server and client
 *   render the same layout and there is no post-mount pop-in.
 * - `active={false}` (pass useDemoActive().active) parks the rays in their
 *   static reduced-motion pose instead of looping forever offscreen.
 *
 * Landing call: <LightRays color="oklch(0.889 0.027 234 / 0.15)" count={7} speed={14} interactive={hovered} />
 */
interface LightRaysProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
  > {
  ref?: Ref<HTMLDivElement>;
  count?: number;
  /** Only the trailing alpha is used (the hue is --ambient-light's). Must end in "<number>)". */
  color?: string;
  blur?: number;
  speed?: number;
  length?: string;
  interactive?: boolean;
  active?: boolean;
  seed?: number;
}

type LightRay = {
  id: string;
  left: number;
  rotate: number;
  width: number;
  swing: number;
  delay: number;
  duration: number;
  intensity: number;
};

// mulberry32: tiny deterministic PRNG.
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const createRays = (count: number, cycle: number, seed: number): LightRay[] => {
  if (count <= 0) return [];
  const random = seededRandom(seed);

  return Array.from({ length: count }, (_, index) => {
    const left = 8 + random() * 84;
    const rotate = -28 + random() * 56;
    const width = 160 + random() * 160;
    const swing = 0.8 + random() * 1.8;
    const delay = random() * cycle;
    const duration = cycle * (0.75 + random() * 0.5);
    const intensity = 0.6 + random() * 0.5;

    return {
      id: `${index}-${Math.round(left * 10)}`,
      left,
      rotate,
      width,
      swing,
      delay,
      duration,
      intensity,
    };
  });
};

const Ray = ({
  left,
  rotate,
  width,
  swing,
  delay,
  duration,
  intensity,
  still,
}: LightRay & { still: boolean }) => {
  return (
    <motion.div
      className="pointer-events-none absolute -top-[12%] left-[var(--ray-left)] h-[var(--light-rays-length)] w-[var(--ray-width)] origin-top -translate-x-1/2 rounded-full bg-gradient-to-b from-[color-mix(in_srgb,var(--light-rays-color)_70%,transparent)] to-transparent opacity-0 mix-blend-screen blur-[var(--light-rays-blur)]"
      style={
        {
          "--ray-left": `${left}%`,
          "--ray-width": `${width}px`,
        } as CSSProperties
      }
      initial={{ rotate }}
      animate={
        still
          ? { opacity: intensity * 0.45, rotate }
          : {
              opacity: [0, intensity, 0],
              rotate: [rotate - swing, rotate + swing, rotate - swing],
            }
      }
      transition={
        still
          ? { duration: 0 }
          : {
              duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay,
              repeatDelay: duration * 0.1,
            }
      }
    />
  );
};

const HoverBeam = ({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) => {
  const opacity = useMotionValue(0);

  useEffect(() => {
    const opacityAnimation = animate(opacity, active && !reduceMotion ? 0.36 : 0, {
      duration: active ? 0.75 : 0.45,
      ease: active ? [0.22, 1, 0.36, 1] : "easeInOut",
    });
    return () => opacityAnimation.stop();
  }, [active, opacity, reduceMotion]);

  return (
    <motion.div aria-hidden className="pointer-events-none absolute inset-0">
      <motion.div
        data-hover-beam="true"
        className="absolute -top-[10%] left-1/2 h-[105%] w-[clamp(220px,28cqw,420px)] -translate-x-1/2"
        style={{
          opacity,
          background:
            "radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--ambient-light) 22%, transparent) 0%, color-mix(in oklch, var(--ambient-light) 21.8%, transparent) 8%, color-mix(in oklch, var(--ambient-light) 20.8%, transparent) 15%, color-mix(in oklch, var(--ambient-light) 19.2%, transparent) 22%, color-mix(in oklch, var(--ambient-light) 16.8%, transparent) 30%, color-mix(in oklch, var(--ambient-light) 13.4%, transparent) 38%, color-mix(in oklch, var(--ambient-light) 10%, transparent) 47%, color-mix(in oklch, var(--ambient-light) 6.7%, transparent) 56%, color-mix(in oklch, var(--ambient-light) 4%, transparent) 65%, color-mix(in oklch, var(--ambient-light) 2.1%, transparent) 73%, color-mix(in oklch, var(--ambient-light) 0.8%, transparent) 80%, transparent 87%, transparent 100%)",
        }}
      />
      <motion.div
        data-hover-bloom="true"
        className="absolute left-1/2 top-[46%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{
          opacity,
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--ambient-light) 7%, transparent) 0%, color-mix(in oklch, var(--ambient-light) 5.7%, transparent) 22%, color-mix(in oklch, var(--ambient-light) 3.5%, transparent) 42%, color-mix(in oklch, var(--ambient-light) 1.6%, transparent) 60%, color-mix(in oklch, var(--ambient-light) 0.5%, transparent) 76%, transparent 90%)",
        }}
      />
    </motion.div>
  );
};

export function LightRays({
  className,
  style,
  count = 7,
  color = "oklch(0.889 0.027 234 / 0.2)",
  blur = 36,
  speed = 14,
  length = "70%",
  interactive = false,
  active = true,
  seed = 7,
  ref,
  ...props
}: LightRaysProps) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const opacityValue = useMotionValue(0.15);
  const cycleDuration = Math.max(speed, 0.1);
  const rays = useMemo(() => createRays(count, cycleDuration, seed), [count, cycleDuration, seed]);

  // Extract the opacity from the colour string and animate it.
  useEffect(() => {
    const match = color.match(/[\d.]+\)$/);
    if (!match) return;
    const controls = animate(opacityValue, parseFloat(match[0]), {
      duration: shouldReduceMotion ? 0 : 0.9,
      ease: "easeInOut",
    });
    return () => controls.stop();
  }, [color, opacityValue, shouldReduceMotion]);

  const animatedColor = useMotionTemplate`oklch(0.889 0.027 234 / ${opacityValue})`;

  return (
    <motion.div
      ref={ref}
      className={cn(
        "pointer-events-none absolute inset-0 isolate overflow-hidden rounded-[inherit]",
        className,
      )}
      style={
        {
          "--light-rays-color": animatedColor,
          "--light-rays-blur": `${blur}px`,
          "--light-rays-length": length,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 20% 15%, color-mix(in srgb, var(--light-rays-color) 45%, transparent), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 80% 10%, color-mix(in srgb, var(--light-rays-color) 35%, transparent), transparent 75%)",
          }}
        />
        {rays.map((ray) => (
          <Ray key={ray.id} {...ray} still={shouldReduceMotion || !active} />
        ))}
        <HoverBeam active={interactive} reduceMotion={shouldReduceMotion} />
      </div>
    </motion.div>
  );
}
