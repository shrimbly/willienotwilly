"use client";

import { AnimatePresence, motion } from "motion/react";
import { Medal, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorPickerFabV9,
  DEFAULT_CONFIG,
  type Config,
} from "@/components/lab/color-picker-fab-v9";
import {
  BRAND_COLOR_GAME_BRANDS,
  type BrandColorGameBrand,
} from "@/lib/brandColorGameBrands";

type Guess = {
  errorPoints: number;
  medal: MedalKind | null;
  label?: string;
  points?: number;
  clutch?: boolean;
  multiplier?: number;
};

type PickWave = {
  id: number;
  color: string;
  medal: MedalKind | null;
  nearMiss: boolean;
  foreground: string;
  mutedForeground: string;
};

type MultiplierBurst = {
  id: number;
  multiplier: number;
};

type ScoreTrail = {
  id: number;
  points: number;
};

type TimeoutCollapse = {
  id: number;
  color: string;
};

type MedalKind = "platinum" | "gold" | "silver" | "bronze";
type IntroPhase = "hud" | "fab" | "ripple" | "color" | "logo" | "name" | "ready";

const DEVICE_SCREEN_W = 360;
const DEVICE_SCREEN_H = 720;
const DEVICE_BEZEL = 6;
const DEVICE_FRAME_W = DEVICE_SCREEN_W + DEVICE_BEZEL * 2;
const DEVICE_FRAME_H = DEVICE_SCREEN_H + DEVICE_BEZEL * 2;
const DEVICE_PADDING = 24;
const FAB_INSET_FROM_SCREEN = 41;
const THUMB_ASPECT = 354 / 360;
const THUMB_FAB_MULTIPLE = 5.2;
const THUMB_TIP_OFFSET_X = -0.19;
const THUMB_TIP_OFFSET_Y = -0.16;
const PICKER_CENTER_DEG = 225;
const PICKER_HALF_SPAN_DEG = 53;
const THUMB_MAX_ROTATION_DEG = 30;
const SCORE_REVEAL_DELAY_MS = 520;
const NEXT_ROUND_DELAY_MS = 1050;
const CHALLENGE_START_AFTER_PICKS = 2;
const CHALLENGE_BASE_ROUND_MS = 9000;
const CHALLENGE_MIN_ROUND_MS = 4500;
const CHALLENGE_STEP_MS = 650;
const CHALLENGE_URGENT_AT_MS = 1800;
const CHALLENGE_HEARTBEAT_AT_MS = 1000;
const STARTING_LIVES = 3;
const CLUTCH_RATIO = 0.15;
const NEAR_MISS_POINTS = 22;
const WAVE_ORIGIN = `calc(100% - ${FAB_INSET_FROM_SCREEN}px) calc(100% - ${FAB_INSET_FROM_SCREEN}px)`;
const REWARD_EASE = [0.16, 1, 0.3, 1] as const;
const OKLAB_REFERENCE_DISTANCE = 0.62;
const INTRO_PHASE_ORDER: IntroPhase[] = [
  "hud",
  "fab",
  "ripple",
  "color",
  "logo",
  "name",
  "ready",
];
const INTRO_PHASE_TIMINGS: Array<{ phase: IntroPhase; at: number }> = [
  { phase: "fab", at: 520 },
  { phase: "ripple", at: 960 },
  { phase: "color", at: 2040 },
  { phase: "logo", at: 2280 },
  { phase: "name", at: 2600 },
  { phase: "ready", at: 3120 },
];

const GAME_PICKER_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  holdMs: 120,
  fabSize: 64,
  fabInset: FAB_INSET_FROM_SCREEN,
  swatchSize: 32,
  arcRadius: 132,
  ribbonInner: 184,
  ribbonOuter: 218,
  toneInner: 226,
  toneOuter: 286,
  toneSpanDeg: 44,
  arcSpanDeg: 106,
  ribbonL: 0.62,
  ribbonC: 0.26,
  openDurationMs: 340,
};

const MEDALS: Record<MedalKind, { label: string; color: string }> = {
  platinum: { label: "Platinum", color: "#E5E4E2" },
  gold: { label: "Gold", color: "#F6C64A" },
  silver: { label: "Silver", color: "#C9CED6" },
  bronze: { label: "Bronze", color: "#C8844A" },
};

const MEDAL_POINTS: Record<MedalKind, number> = {
  platinum: 1000,
  gold: 600,
  silver: 350,
  bronze: 150,
};

function shuffledBrands() {
  const brands = [...BRAND_COLOR_GAME_BRANDS];
  for (let i = brands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [brands[i], brands[j]] = [brands[j], brands[i]];
  }
  return brands;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function ThumbCursor({
  visible,
  fabSize,
  fabBottom,
  fabRight,
  clipRect,
}: {
  visible: boolean;
  fabSize: number;
  fabBottom: number;
  fabRight: number;
  clipRect?: {
    bottom: number;
    right: number;
    width: number;
    height: number;
    borderRadius: number;
  };
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", handler);
    window.addEventListener("pointerdown", handler);
    return () => {
      window.removeEventListener("pointermove", handler);
      window.removeEventListener("pointerdown", handler);
    };
  }, []);

  if (!visible || !pos) return null;

  const width = fabSize * THUMB_FAB_MULTIPLE;
  const height = width * THUMB_ASPECT;
  const fabCornerX = window.innerWidth - fabRight;
  const fabCornerY = window.innerHeight - fabBottom;
  const angleRad = Math.atan2(pos.y - fabCornerY, pos.x - fabCornerX);
  const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;
  let offset = ((angleDeg - PICKER_CENTER_DEG + 540) % 360) - 180;
  offset = Math.max(
    -PICKER_HALF_SPAN_DEG,
    Math.min(PICKER_HALF_SPAN_DEG, offset),
  );
  const rotation = (offset / PICKER_HALF_SPAN_DEG) * THUMB_MAX_ROTATION_DEG;

  if (clipRect) {
    const clipLeft = window.innerWidth - clipRect.right - clipRect.width;
    const clipTop = window.innerHeight - clipRect.bottom - clipRect.height;
    return (
      <div
        className="pointer-events-none fixed z-[100] select-none overflow-hidden"
        style={{
          bottom: clipRect.bottom,
          right: clipRect.right,
          width: clipRect.width,
          height: clipRect.height,
          borderRadius: clipRect.borderRadius,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/lab/thumb.png"
          alt=""
          width={width}
          height={height}
          draggable={false}
          className="absolute"
          style={{
            left: pos.x - clipLeft + width * THUMB_TIP_OFFSET_X,
            top: pos.y - clipTop + height * THUMB_TIP_OFFSET_Y,
            transform: `rotate(${rotation.toFixed(2)}deg)`,
            transformOrigin: `${-width * THUMB_TIP_OFFSET_X}px ${-height * THUMB_TIP_OFFSET_Y}px`,
            transition: "transform 120ms ease-out",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
          }}
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/lab/thumb.png"
      alt=""
      width={width}
      height={height}
      draggable={false}
      className="pointer-events-none fixed z-[100] select-none"
      style={{
        left: pos.x + width * THUMB_TIP_OFFSET_X,
        top: pos.y + height * THUMB_TIP_OFFSET_Y,
        transform: `rotate(${rotation.toFixed(2)}deg)`,
        transformOrigin: `${-width * THUMB_TIP_OFFSET_X}px ${-height * THUMB_TIP_OFFSET_Y}px`,
        transition: "transform 120ms ease-out",
        filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
      }}
    />
  );
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function hueFromHex(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue = 0;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return Math.round((hue * 60 + 360) % 360);
}

function hexToRgbString(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

function foregroundForBackground(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance =
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b);
  return luminance > 0.52
    ? { foreground: "#18181b", mutedForeground: "rgba(24,24,27,0.56)" }
    : { foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)" };
}

function resolveCssColor(color: string) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "#000000";
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return rgbToHex(r, g, b);
  } catch {
    return "#000000";
  }
}

function errorPointsFor(a: string, b: string) {
  const delta = oklabDistance(hexToOklab(a), hexToOklab(b));
  return Math.round(Math.min(100, (delta / OKLAB_REFERENCE_DISTANCE) * 100));
}

function medalFor(errorPoints: number): MedalKind | null {
  if (errorPoints <= 1) return "platinum";
  if (errorPoints <= 5) return "gold";
  if (errorPoints <= 10) return "silver";
  if (errorPoints <= 15) return "bronze";
  return null;
}

function challengeDurationFor(completedPicks: number) {
  const challengeRounds = Math.max(0, completedPicks - CHALLENGE_START_AFTER_PICKS);
  const level = Math.floor(challengeRounds / 5);
  return Math.max(
    CHALLENGE_MIN_ROUND_MS,
    CHALLENGE_BASE_ROUND_MS - level * CHALLENGE_STEP_MS,
  );
}

function pointsFor({
  medal,
  streak,
  clutch,
}: {
  medal: MedalKind | null;
  streak: number;
  clutch: boolean;
}) {
  if (!medal) return 0;
  const multiplier = multiplierForStreak(streak);
  return {
    points: MEDAL_POINTS[medal] * multiplier + (clutch ? 250 : 0),
    multiplier,
  };
}

function formatScore(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function multiplierForStreak(streak: number) {
  return Math.min(5, 1 + Math.floor(streak / 3));
}

function srgbToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function hexToOklab(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

function oklabDistance(
  a: { l: number; a: number; b: number },
  b: { l: number; a: number; b: number },
) {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

function rewardMotion(medal: MedalKind | null) {
  if (medal === "platinum") {
    return {
      initial: { opacity: 0, y: -28, scale: 0.58, rotate: -10 },
      animate: { opacity: 1, y: 0, scale: [0.96, 1.26, 1], rotate: [0, 2, 0] },
      transition: { duration: 0.78, ease: REWARD_EASE },
      className:
        "border-white/90 bg-white/96 shadow-[0_0_0_13px_rgba(255,255,255,0.24),0_0_72px_rgba(255,255,255,0.66),0_24px_64px_rgba(0,0,0,0.20)]",
      burstCount: 20,
    };
  }
  if (medal === "gold") {
    return {
      initial: { opacity: 0, y: -22, scale: 0.68, rotate: -4 },
      animate: { opacity: 1, y: 0, scale: [0.98, 1.18, 1], rotate: 0 },
      transition: { duration: 0.62, ease: REWARD_EASE },
      className:
        "border-amber-200/95 bg-white/96 shadow-[0_0_0_10px_rgba(246,198,74,0.22),0_0_54px_rgba(246,198,74,0.50),0_22px_58px_rgba(0,0,0,0.18)]",
      burstCount: 14,
    };
  }
  if (medal === "silver") {
    return {
      initial: { opacity: 0, y: -14, scale: 0.86 },
      animate: { opacity: 1, y: 0, scale: [1, 1.05, 1] },
      transition: { duration: 0.36, ease: REWARD_EASE },
      className:
        "border-zinc-200 bg-white/94 shadow-[0_14px_34px_rgba(0,0,0,0.12)]",
      burstCount: 5,
    };
  }
  if (medal === "bronze") {
    return {
      initial: { opacity: 0, y: -10, scale: 0.92 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.28, ease: REWARD_EASE },
      className:
        "border-orange-200/70 bg-white/92 shadow-[0_10px_28px_rgba(0,0,0,0.10)]",
      burstCount: 0,
    };
  }
  return {
    initial: { opacity: 0, y: -8, scale: 0.94 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.24, ease: REWARD_EASE },
    className: "border-zinc-200 bg-white/90 shadow-[0_10px_24px_rgba(0,0,0,0.10)]",
    burstCount: 0,
  };
}

function hapticFor(medal: MedalKind | null, nearMiss = false) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (medal === "platinum") navigator.vibrate([14, 24, 26, 32, 36]);
  else if (medal === "gold") navigator.vibrate([12, 22, 28]);
  else if (medal === "silver") navigator.vibrate([10, 18, 18]);
  else if (medal === "bronze") navigator.vibrate(18);
  else if (nearMiss) navigator.vibrate([10, 24, 10]);
  else navigator.vibrate(26);
}

function AnimatedScore({
  value,
  startFrom = value,
  durationMs,
}: {
  value: number;
  startFrom?: number;
  durationMs?: number;
}) {
  const [displayValue, setDisplayValue] = useState(startFrom);
  const previousValue = useRef(startFrom);

  useEffect(() => {
    const from = previousValue.current;
    const to = value;
    previousValue.current = value;

    if (from === to) {
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration =
      durationMs ?? Math.min(520, Math.max(260, Math.abs(to - from) * 0.18));

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, value]);

  return (
    <motion.span
      key={value}
      initial={{ scale: 1 }}
      animate={{ scale: value > 0 ? [1, 1.18, 1] : 1 }}
      transition={{ duration: 0.34, ease: REWARD_EASE }}
      className="inline-block"
    >
      {formatScore(displayValue)}
    </motion.span>
  );
}

function RewardToast({ result }: { result: Guess }) {
  const medal = result.medal ? MEDALS[result.medal] : null;
  const motionConfig = rewardMotion(result.medal);
  const nearMiss = !result.medal && result.errorPoints <= NEAR_MISS_POINTS;

  return (
    <motion.div
      key="reward-toast"
      initial={motionConfig.initial}
      animate={
        nearMiss
          ? {
              opacity: 1,
              y: 0,
              scale: 1,
              x: [0, -4, 4, -2, 2, 0],
            }
          : motionConfig.animate
      }
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={motionConfig.transition}
      className={`absolute left-1/2 top-[72px] z-30 flex w-fit max-w-[calc(100%-3rem)] -translate-x-1/2 items-center gap-3 overflow-visible rounded-full border px-4 py-2.5 ${motionConfig.className}`}
    >
      {Array.from({ length: motionConfig.burstCount }).map((_, index) => {
        const angle = (index / Math.max(1, motionConfig.burstCount)) * Math.PI * 2;
        const distance = result.medal === "platinum" ? 72 : result.medal === "gold" ? 58 : 32;
        return (
          <motion.span
            key={index}
            aria-hidden
            className={`absolute left-1/2 top-1/2 rounded-full ${
              result.medal === "platinum" ? "size-2" : "size-1.5"
            }`}
            style={{ background: medal?.color ?? "#fff" }}
            initial={{ x: "-50%", y: "-50%", opacity: 0, scale: 0.4 }}
            animate={{
              x: `calc(-50% + ${Math.cos(angle) * distance}px)`,
              y: `calc(-50% + ${Math.sin(angle) * distance}px)`,
              opacity: [0, 1, 0],
              scale: [0.4, 1, 0.2],
            }}
            transition={{
              duration: result.medal === "platinum" ? 0.92 : result.medal === "gold" ? 0.72 : 0.56,
              ease: "easeOut",
              delay: 0.04 + index * 0.012,
            }}
          />
        );
      })}
      {result.medal && (
        <>
          <motion.span
            aria-hidden
            className="absolute inset-[-6px] rounded-full"
            style={{ border: `1px solid ${medal?.color ?? "#fff"}` }}
            initial={{ opacity: 0.55, scale: 0.84 }}
            animate={{ opacity: 0, scale: result.medal === "platinum" ? 1.56 : result.medal === "gold" ? 1.42 : 1.24 }}
            transition={{ duration: result.medal === "bronze" ? 0.4 : 0.72, ease: "easeOut" }}
          />
          {(result.medal === "platinum" || result.medal === "gold") && (
            <motion.span
              aria-hidden
              className="absolute inset-[-14px] rounded-full"
              style={{ border: `1px solid ${medal?.color ?? "#fff"}` }}
              initial={{ opacity: 0.34, scale: 0.78 }}
              animate={{ opacity: 0, scale: result.medal === "platinum" ? 1.9 : 1.68 }}
              transition={{ duration: 0.94, ease: "easeOut", delay: 0.08 }}
            />
          )}
        </>
      )}
      {nearMiss && (
        <motion.span
          aria-hidden
          className="absolute inset-[-4px] rounded-full border border-zinc-950/12"
          initial={{ opacity: 0.45, scale: 0.95 }}
          animate={{ opacity: 0, scale: 1.18 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
        />
      )}
      <div
        className="grid size-8 shrink-0 place-items-center rounded-full"
        style={{ background: medal ? `${medal.color}38` : nearMiss ? "#fef3c7" : "#f1f1f1" }}
      >
        <Medal
          className="size-4"
          style={{ color: medal ? medal.color : nearMiss ? "#d97706" : "#a1a1aa" }}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-950">
          {result.label ?? (medal ? medal.label : "No medal")}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          {result.points ? `+${formatScore(result.points)}` : `${result.errorPoints} points off`}
          {result.clutch ? " / clutch" : ""}
          {result.multiplier && result.multiplier > 1
            ? ` / x${result.multiplier}`
            : ""}
        </p>
      </div>
      {(result.medal === "platinum" || result.medal === "gold") && (
        <motion.span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-gradient-to-r from-transparent to-transparent ${
            result.medal === "platinum" ? "via-white/80" : "via-amber-100/80"
          }`}
          initial={{ x: "-120%", opacity: 0 }}
          animate={{ x: "120%", opacity: [0, 0.9, 0] }}
          transition={{ duration: result.medal === "platinum" ? 0.92 : 0.76, ease: "easeOut", delay: 0.08 }}
        />
      )}
    </motion.div>
  );
}

function IntroPhoneScreen({
  phase,
  brand,
  totalRounds,
  showDeviceChrome,
}: {
  phase: IntroPhase;
  brand?: BrandColorGameBrand;
  totalRounds: number;
  showDeviceChrome: boolean;
}) {
  const phaseIndex = INTRO_PHASE_ORDER.indexOf(phase);
  const showColor = phaseIndex >= INTRO_PHASE_ORDER.indexOf("color");
  const showLogo = phaseIndex >= INTRO_PHASE_ORDER.indexOf("logo");
  const showName = phaseIndex >= INTRO_PHASE_ORDER.indexOf("name");

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f8f6ee] text-zinc-950">
      {showDeviceChrome && (
        <>
          <div className="absolute left-6 top-2.5 text-[11px] font-medium tracking-wide text-zinc-500">
            9:41
          </div>
          <div className="absolute left-1/2 top-3 size-2.5 -translate-x-1/2 rounded-full bg-zinc-950/85" />
          <div className="absolute right-6 top-2.5 flex items-center gap-1 text-[11px] font-medium tracking-wide text-zinc-500">
            <span>5G</span>
            <span>100%</span>
          </div>
        </>
      )}

      <div
        className={`relative z-10 flex h-full flex-col px-7 pb-8 ${
          showDeviceChrome ? "pt-16" : "pt-8"
        }`}
      >
        <motion.div
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: REWARD_EASE }}
        >
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: 0.02 }}
          >
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              Score
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums">0</p>
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: 0.1 }}
          >
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              1/{totalRounds || BRAND_COLOR_GAME_BRANDS.length}
            </p>
            <p className="font-mono text-xs text-zinc-500">
              {"●".repeat(STARTING_LIVES)}
            </p>
          </motion.div>
          <motion.div
            className="ml-auto grid size-8 place-items-center rounded-full text-zinc-400"
            initial={{ opacity: 0, y: -6, rotate: -18 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: 0.18 }}
          >
            <RotateCcw className="size-3.5" />
          </motion.div>
        </motion.div>

        {brand && (
          <>
            <motion.section className="flex min-h-[260px] flex-col items-center justify-center pt-8">
              <motion.div
                className="relative grid h-44 w-56 place-items-center overflow-hidden rounded-[36px]"
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={
                  showColor
                    ? { opacity: 1, y: 0, scale: 1 }
                    : { opacity: 0, y: 14, scale: 0.96 }
                }
                transition={{ duration: 0.42, ease: REWARD_EASE }}
                style={{ backgroundColor: brand.targetHex }}
              >
                <motion.div
                  aria-hidden
                  className="absolute inset-0 bg-white"
                  initial={{ x: "0%" }}
                  animate={showColor ? { x: "112%" } : { x: "0%" }}
                  transition={{ duration: 0.54, ease: REWARD_EASE }}
                />
                <motion.div
                  className={`relative overflow-hidden ${brand.logoSizeClassName}`}
                  initial={{ opacity: 0, y: 8, scale: 0.92 }}
                  animate={
                    showLogo
                      ? { opacity: 1, y: 0, scale: [0.96, 1.04, 1] }
                      : { opacity: 0, y: 8, scale: 0.92 }
                  }
                  transition={{ duration: 0.42, ease: REWARD_EASE }}
                >
                  <Image
                    src={brand.logoSrc}
                    alt={`${brand.name} logo`}
                    fill
                    priority
                    sizes="208px"
                    className="object-contain"
                  />
                </motion.div>
              </motion.div>
            </motion.section>

            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={showName ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                Match the primary brand color
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">
                {brand.name}
              </h1>
            </motion.div>
          </>
        )}
      </div>

      {showDeviceChrome && (
        <div className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-zinc-950/24" />
      )}
    </div>
  );
}

function IntroPickerRipple({
  color,
  fabSize,
  fabBottom,
  fabRight,
}: {
  color: string;
  fabSize: number;
  fabBottom: number;
  fabRight: number;
}) {
  const {
    arcRadius,
    swatchSize,
    swatchSpanDeg,
    arcSpanDeg,
    ribbonInner,
    ribbonOuter,
    toneInner,
    toneOuter,
    toneSpanDeg,
    ribbonL,
    ribbonC,
  } = GAME_PICKER_CONFIG;
  const arcCenterDeg = 225;
  const swatchStartDeg = arcCenterDeg - swatchSpanDeg / 2;
  const ribbonStartDeg = arcCenterDeg - arcSpanDeg / 2;
  const ribbonEndDeg = arcCenterDeg + arcSpanDeg / 2;
  const ribbonMid = (ribbonInner + ribbonOuter) / 2;
  const toneCenterDeg = 225;
  const toneStartDeg = toneCenterDeg - toneSpanDeg / 2;
  const toneEndDeg = toneCenterDeg + toneSpanDeg / 2;
  const toneMid = (toneInner + toneOuter) / 2;
  const swatchColors = [0, 58, 118, 176, 238, 306].map(
    (hue) => `oklch(${ribbonL} ${ribbonC} ${hue})`,
  );
  const targetHue = hueFromHex(color);
  const arcPath = (
    radius: number,
    startDeg: number,
    endDeg: number,
  ) => {
    const start = polar(0, 0, radius, startDeg);
    const end = polar(0, 0, radius, endDeg);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  };

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[45]"
      style={{
        right: fabRight,
        bottom: fabBottom,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <motion.div
        className="absolute left-0 top-0 rounded-full"
        style={{
          width: fabSize * 1.9,
          height: fabSize * 1.9,
          marginLeft: -fabSize * 0.95,
          marginTop: -fabSize * 0.95,
          background: `radial-gradient(circle, ${color}55, ${color}1f 42%, transparent 70%)`,
        }}
        initial={{ opacity: 0, scale: 0.42 }}
        animate={{ opacity: [0, 0.82, 0], scale: [0.42, 1.24] }}
        transition={{ duration: 0.54, ease: REWARD_EASE }}
      />

      {swatchColors.map((swatchColor, index) => {
        const deg =
          swatchStartDeg +
          (index * swatchSpanDeg) / Math.max(1, swatchColors.length - 1);
        const pos = polar(0, 0, arcRadius, deg);
        return (
          <motion.div
            key={swatchColor}
            className="absolute rounded-full"
            style={{
              width: swatchSize,
              height: swatchSize,
              left: pos.x - swatchSize / 2,
              top: pos.y - swatchSize / 2,
              background: swatchColor,
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.58), 0 8px 18px rgba(0,0,0,0.18)",
            }}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.2, 1.08, 1, 0.92],
            }}
            transition={{
              duration: 0.86,
              ease: REWARD_EASE,
              delay: 0.05 + index * 0.035,
            }}
          />
        );
      })}

      <motion.svg
        className="absolute left-0 top-0 overflow-visible"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.88, 1.02, 1.02, 0.98] }}
        transition={{ duration: 0.98, ease: REWARD_EASE, delay: 0.28 }}
      >
        <defs>
          <linearGradient id="intro-picker-ribbon" x1="-1" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.62 0.26 0)" />
            <stop offset="18%" stopColor="oklch(0.62 0.26 42)" />
            <stop offset="34%" stopColor="oklch(0.62 0.26 95)" />
            <stop offset="50%" stopColor="oklch(0.62 0.26 155)" />
            <stop offset="66%" stopColor="oklch(0.62 0.26 215)" />
            <stop offset="84%" stopColor="oklch(0.62 0.26 285)" />
            <stop offset="100%" stopColor="oklch(0.62 0.26 340)" />
          </linearGradient>
          <linearGradient id="intro-picker-tone" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={`oklch(0.08 0.04 ${targetHue})`} />
            <stop offset="52%" stopColor={`oklch(0.58 0.28 ${targetHue})`} />
            <stop offset="100%" stopColor={`oklch(0.96 0.08 ${targetHue})`} />
          </linearGradient>
        </defs>
        <motion.path
          d={arcPath(ribbonMid, ribbonStartDeg, ribbonEndDeg)}
          fill="none"
          stroke="rgba(255,255,255,0.92)"
          strokeLinecap="round"
          strokeWidth={ribbonOuter - ribbonInner + 7}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.58, ease: REWARD_EASE, delay: 0.28 }}
          style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.18))" }}
        />
        <motion.path
          d={arcPath(ribbonMid, ribbonStartDeg, ribbonEndDeg)}
          fill="none"
          stroke="url(#intro-picker-ribbon)"
          strokeLinecap="round"
          strokeWidth={ribbonOuter - ribbonInner}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.58, ease: REWARD_EASE, delay: 0.3 }}
        />
        <motion.path
          d={arcPath(toneMid, toneStartDeg, toneEndDeg)}
          fill="none"
          stroke="rgba(255,255,255,0.88)"
          strokeLinecap="round"
          strokeWidth={toneOuter - toneInner + 8}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.58, ease: REWARD_EASE, delay: 0.62 }}
          style={{ filter: "drop-shadow(0 10px 26px rgba(0,0,0,0.20))" }}
        />
        <motion.path
          d={arcPath(toneMid, toneStartDeg, toneEndDeg)}
          fill="none"
          stroke="url(#intro-picker-tone)"
          strokeLinecap="round"
          strokeWidth={toneOuter - toneInner}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.58, ease: REWARD_EASE, delay: 0.64 }}
        />
      </motion.svg>

      {[ribbonMid, toneMid].map((radius, index) => (
        <motion.div
          key={radius}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: radius * 2,
            height: radius * 2,
            marginLeft: -radius,
            marginTop: -radius,
            border: `1px solid ${color}44`,
          }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{
            opacity: [0, index === 0 ? 0.22 : 0.16, 0],
            scale: [0.4, 1],
          }}
          transition={{
            duration: 0.78,
            ease: REWARD_EASE,
            delay: index === 0 ? 0.28 : 0.62,
          }}
        />
      ))}
    </motion.div>
  );
}

function PhoneScreen({
  brand,
  result,
  isResolving,
  resolvingMedal,
  resolvingNearMiss,
  score,
  lives,
  streak,
  multiplierBurst,
  scoreTrail,
  bestPulse,
  lifePulse,
  timeoutCollapse,
  completedPicks,
  gameOver,
  bestScore,
  newBestThisRun,
  challengeIntro,
  challengeActive,
  challengePaused,
  challengeKey,
  challengeDurationMs,
  showDeviceChrome,
  waves,
  roundIndex,
  totalRounds,
  onWaveComplete,
  onReset,
  suppressInitialReveal = false,
}: {
  brand: BrandColorGameBrand;
  result: Guess | null;
  isResolving: boolean;
  resolvingMedal: MedalKind | null;
  resolvingNearMiss: boolean;
  score: number;
  lives: number;
  streak: number;
  multiplierBurst: MultiplierBurst | null;
  scoreTrail: ScoreTrail | null;
  bestPulse: number;
  lifePulse: number;
  timeoutCollapse: TimeoutCollapse | null;
  completedPicks: number;
  gameOver: boolean;
  bestScore: number;
  newBestThisRun: boolean;
  challengeIntro: boolean;
  challengeActive: boolean;
  challengePaused: boolean;
  challengeKey: number;
  challengeDurationMs: number;
  showDeviceChrome: boolean;
  waves: PickWave[];
  roundIndex: number;
  totalRounds: number;
  onWaveComplete: (id: number) => void;
  onReset: () => void;
  suppressInitialReveal?: boolean;
}) {
  const brandRgb = hexToRgbString(brand.targetHex);
  const activeWave = waves.at(-1);
  const screenForeground = activeWave?.foreground ?? "#18181b";
  const screenMuted = activeWave?.mutedForeground ?? undefined;
  const dangerDelay = Math.max(
    0,
    (challengeDurationMs - CHALLENGE_URGENT_AT_MS) / 1000,
  );
  const heartbeatDelay = Math.max(
    0,
    (challengeDurationMs - CHALLENGE_HEARTBEAT_AT_MS) / 1000,
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f8f6ee] text-zinc-950">
      <AnimatePresence>
        {challengeActive && !gameOver && (
          <>
            <motion.div
              key={`challenge-${challengeKey}`}
              className="pointer-events-none absolute left-0 top-0 z-0 w-full"
              style={{
                background: `linear-gradient(180deg, rgba(${brandRgb}, 0.13), rgba(${brandRgb}, 0.28))`,
                boxShadow: `0 16px 48px rgba(${brandRgb}, 0.16)`,
              }}
              initial={{ height: "0%", opacity: 0.72 }}
              animate={
                challengePaused
                  ? {
                      opacity: 0.24,
                    }
                  : {
                      height: "100%",
                      opacity: [0.72, 0.72, 0.95, 0.66, 0.95, 0.72],
                    }
              }
              exit={{ opacity: 0 }}
              transition={
                challengePaused
                  ? { duration: 0.18 }
                  : {
                      height: {
                        duration: challengeDurationMs / 1000,
                        ease: "linear",
                      },
                      opacity: {
                        duration: challengeDurationMs / 1000,
                        times: [
                          0,
                          1 - CHALLENGE_URGENT_AT_MS / challengeDurationMs,
                          0.82,
                          0.9,
                          0.96,
                          1,
                        ],
                      },
                    }
              }
            />
            {!challengePaused && (
              <motion.div
                key={`danger-${challengeKey}`}
                className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-1/3"
                style={{
                  background: `linear-gradient(0deg, rgba(${brandRgb}, 0.28), rgba(${brandRgb}, 0))`,
                }}
                initial={{ opacity: 0, scaleY: 0.86, transformOrigin: "bottom" }}
                animate={{ opacity: [0, 0.34, 0.12, 0.42], scaleY: [0.86, 1.04, 0.96, 1.08] }}
                exit={{ opacity: 0 }}
                transition={{
                  delay: dangerDelay,
                  duration: 0.68,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
              />
            )}
            {!challengePaused && (
              <motion.div
                key={`heartbeat-${challengeKey}`}
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                  boxShadow: `inset 0 0 0 0 rgba(${brandRgb}, 0)`,
                }}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0, 0.28, 0, 0.38, 0, 0.5, 0],
                  boxShadow: [
                    `inset 0 0 0 0 rgba(${brandRgb}, 0)`,
                    `inset 0 0 0 3px rgba(${brandRgb}, 0.24)`,
                    `inset 0 0 0 0 rgba(${brandRgb}, 0)`,
                    `inset 0 0 0 4px rgba(${brandRgb}, 0.30)`,
                    `inset 0 0 0 0 rgba(${brandRgb}, 0)`,
                    `inset 0 0 0 5px rgba(${brandRgb}, 0.36)`,
                    `inset 0 0 0 0 rgba(${brandRgb}, 0)`,
                  ],
                }}
                transition={{
                  delay: heartbeatDelay,
                  duration: 0.92,
                  ease: "easeInOut",
                }}
              />
            )}
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {timeoutCollapse && (
          <motion.div
            key={timeoutCollapse.id}
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{ background: timeoutCollapse.color, transformOrigin: "bottom" }}
            initial={{ opacity: 0.18, scaleY: 1 }}
            animate={{ opacity: [0.18, 0.34, 0], scaleY: [1, 0.12, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>
      {waves.map((wave) => (
        <div key={wave.id} className="pointer-events-none absolute inset-0 z-0">
          <motion.div
            className="absolute inset-0"
            style={{ background: wave.color }}
            initial={{ clipPath: `circle(0px at ${WAVE_ORIGIN})` }}
            animate={{ clipPath: `circle(150vmax at ${WAVE_ORIGIN})` }}
            transition={{ duration: 0.86, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => onWaveComplete(wave.id)}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at ${WAVE_ORIGIN}, rgba(255,255,255,0.68) 0 14%, ${wave.color}00 32%)`,
            }}
            initial={{ clipPath: `circle(0px at ${WAVE_ORIGIN})`, opacity: 0.95 }}
            animate={{
              clipPath: `circle(${wave.medal ? "115vmax" : wave.nearMiss ? "88vmax" : "68vmax"} at ${WAVE_ORIGIN})`,
              opacity: 0,
            }}
            transition={{
              duration: wave.medal ? 0.58 : 0.42,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </div>
      ))}
      {showDeviceChrome && (
        <>
          <div className="absolute left-6 top-2.5 text-[11px] font-medium tracking-wide text-zinc-500">
            9:41
          </div>
          <div className="absolute left-1/2 top-3 size-2.5 -translate-x-1/2 rounded-full bg-zinc-950/85" />
          <div className="absolute right-6 top-2.5 flex items-center gap-1 text-[11px] font-medium tracking-wide text-zinc-500">
            <span>5G</span>
            <span>100%</span>
          </div>
        </>
      )}

      <div
        className={`relative z-10 flex h-full flex-col px-7 pb-8 ${
          showDeviceChrome ? "pt-16" : "pt-8"
        }`}
      >
        <motion.div
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
          animate={
            gameOver
              ? { opacity: 0, y: -12, scale: 0.98 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <div>
            <p
              className="font-mono text-[11px] uppercase tracking-widest text-zinc-400"
              style={screenMuted ? { color: screenMuted } : undefined}
            >
              Score
            </p>
            <motion.p
              className="font-mono text-sm font-semibold tabular-nums"
              key={`score-${bestPulse}`}
              animate={
                bestPulse
                  ? { color: [screenForeground, "#f59e0b", screenForeground], scale: [1, 1.18, 1] }
                  : { color: screenForeground, scale: 1 }
              }
              transition={{ duration: 0.5, ease: REWARD_EASE }}
            >
              <AnimatedScore value={score} />
            </motion.p>
          </div>
          <div className="text-center">
            <p
              className="font-mono text-[11px] uppercase tracking-widest text-zinc-400"
              style={screenMuted ? { color: screenMuted } : undefined}
            >
              {roundIndex + 1}/{totalRounds}
            </p>
            <motion.p
              key={`${lives}-${lifePulse}`}
              className="font-mono text-xs text-zinc-500"
              style={screenMuted ? { color: screenMuted } : undefined}
              initial={lifePulse ? { x: 0, scale: 1 } : false}
              animate={
                lifePulse
                  ? { x: [0, -3, 3, -2, 2, 0], scale: [1, 1.12, 1] }
                  : { x: 0, scale: 1 }
              }
              transition={{ duration: 0.34, ease: REWARD_EASE }}
            >
              {"●".repeat(lives)}
              <span style={activeWave ? { color: screenMuted } : undefined} className="text-zinc-300">
                {"●".repeat(STARTING_LIVES - lives)}
              </span>
            </motion.p>
          </div>
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset game"
            className="ml-auto grid size-8 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-950"
            style={activeWave ? { color: screenMuted } : undefined}
          >
            <RotateCcw className="size-3.5" />
          </button>
        </motion.div>

        <AnimatePresence>
          {challengeIntro && (
            <motion.div
              className="absolute left-1/2 top-[112px] z-30 -translate-x-1/2 rounded-full border border-zinc-950/10 bg-zinc-950 px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-white shadow-[0_14px_38px_rgba(0,0,0,0.22)]"
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: [1, 1.06, 1] }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.36, ease: REWARD_EASE }}
            >
              Challenge mode
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section
          className="flex min-h-[260px] flex-col items-center justify-center pt-8"
          animate={
            gameOver
              ? { opacity: 0, y: -18, scale: 0.92, rotate: -1 }
              : { opacity: 1, y: 0, scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.42, ease: REWARD_EASE }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={brand.id}
              initial={
                suppressInitialReveal
                  ? false
                  : { opacity: 0, y: 12, scale: 0.98 }
              }
              animate={{
                opacity: 1,
                y: isResolving && !resolvingMedal && !resolvingNearMiss ? [0, 6, 0] : 0,
                scale: isResolving
                  ? resolvingMedal === "platinum"
                    ? [1, 0.96, 1.12, 1]
                    : resolvingMedal === "gold"
                      ? [1, 0.975, 1.075, 1]
                      : resolvingMedal === "silver"
                        ? [1, 0.99, 1.035, 1]
                        : resolvingMedal === "bronze"
                          ? [1, 0.995, 1.02, 1]
                          : resolvingNearMiss
                            ? [1, 0.99, 1.012, 1]
                            : [1, 0.985, 0.995, 1]
                  : 1,
                boxShadow: isResolving
                  ? "0 4px 14px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.12)"
                  : "0 18px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.16)",
              }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: isResolving ? 0.36 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="grid h-44 w-56 place-items-center rounded-[36px]"
              style={{ backgroundColor: brand.targetHex }}
            >
              {isResolving && (resolvingMedal === "platinum" || resolvingMedal === "gold") && (
                <motion.div
                  aria-hidden
                  className={`absolute rounded-[42px] border ${
                    resolvingMedal === "platinum"
                      ? "inset-[-10px] border-white/85"
                      : "inset-[-8px] border-amber-200/85"
                  }`}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{
                    opacity: [0, resolvingMedal === "platinum" ? 0.95 : 0.78, 0],
                    scale: resolvingMedal === "platinum" ? [0.9, 1.16, 1.32] : [0.92, 1.12, 1.24],
                  }}
                  transition={{ duration: resolvingMedal === "platinum" ? 0.84 : 0.68, ease: REWARD_EASE }}
                />
              )}
              <div className={`relative overflow-hidden ${brand.logoSizeClassName}`}>
                <Image
                  src={brand.logoSrc}
                  alt={`${brand.name} logo`}
                  fill
                  priority
                  sizes="208px"
                  className="object-contain"
                />
                {isResolving && resolvingMedal && (
                  <motion.div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent mix-blend-screen"
                    initial={{ x: "-130%", opacity: 0 }}
                    animate={{ x: "130%", opacity: [0, 0.9, 0] }}
                    transition={{
                      duration: resolvingMedal === "platinum" ? 0.92 : resolvingMedal === "gold" ? 0.68 : 0.52,
                      ease: "easeOut",
                      delay: resolvingMedal === "platinum" ? 0.06 : 0,
                    }}
                  />
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.section>

        <motion.div
          className="text-center"
          animate={
            gameOver
              ? { opacity: 0, y: 14, scale: 0.96 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{ duration: 0.32, ease: "easeOut" }}
        >
          <p
            className="font-mono text-[11px] uppercase tracking-widest text-zinc-400"
            style={screenMuted ? { color: screenMuted } : undefined}
          >
            Match the primary brand color
          </p>
          <h1
            className="mt-2 text-4xl font-semibold tracking-tight"
            style={activeWave ? { color: screenForeground } : undefined}
          >
            {brand.name}
          </h1>
        </motion.div>

        <motion.div
          className="mt-auto pb-20"
          animate={gameOver ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <AnimatePresence mode="wait">
            {!result && (
              <motion.div
                key={`${brand.id}-prompt`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-10"
              />
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>{result && <RewardToast result={result} />}</AnimatePresence>

        <AnimatePresence>
          {scoreTrail && !gameOver && (
            <motion.div
              key={scoreTrail.id}
              className="pointer-events-none absolute left-8 top-[62px] z-40 rounded-full bg-zinc-950 px-2.5 py-1 font-mono text-[11px] font-semibold text-white shadow-[0_10px_26px_rgba(0,0,0,0.22)]"
              initial={{ opacity: 0, y: 18, scale: 0.9 }}
              animate={{ opacity: [0, 1, 0], y: [18, 2, -18], scale: [0.9, 1.04, 0.96] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              +{formatScore(scoreTrail.points)}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {streak >= 2 && !gameOver && (
            <motion.div
              className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-zinc-950/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-white"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
            >
              Streak {streak}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {multiplierBurst && !gameOver && (
            <motion.div
              key={multiplierBurst.id}
              className="absolute left-7 top-[104px] z-30 rounded-full border border-zinc-950/10 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-white shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
              initial={{ opacity: 0, y: 10, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: [1, 1.16, 1] }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.42, ease: REWARD_EASE }}
            >
              x{multiplierBurst.multiplier}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {gameOver && (
            <motion.div
              className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#f8f6ee]/96 px-7 backdrop-blur-[2px]"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
            >
              <motion.div
                aria-hidden
                className="absolute inset-0 bg-zinc-950"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.08, 0] }}
                transition={{ duration: 0.42, ease: "easeOut" }}
              />
              <motion.div
                aria-hidden
                className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-950/8"
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: [0, 0.48, 0.14], scale: [0.62, 1.08, 1.24] }}
                transition={{ duration: 1.05, ease: REWARD_EASE }}
              />
              <motion.div
                aria-hidden
                className="absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-950/6"
                initial={{ opacity: 0, scale: 0.54 }}
                animate={{ opacity: [0, 0.28, 0], scale: [0.54, 1.04, 1.34] }}
                transition={{ duration: 1.18, ease: REWARD_EASE, delay: 0.08 }}
              />
              <motion.div
                aria-hidden
                className="absolute left-1/2 top-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-3xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.82, scale: 1.15 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              <motion.div
                className="relative w-full rounded-[8px] border border-zinc-950/10 bg-white/90 p-6 text-center shadow-[0_20px_62px_rgba(0,0,0,0.16)]"
                initial={{ opacity: 0, y: 34, scale: 0.86, rotate: -1.5 }}
                animate={{ opacity: 1, y: 0, scale: [0.98, 1.045, 1], rotate: 0 }}
                exit={{ opacity: 0, y: 10, scale: 0.99 }}
                transition={{ duration: 0.58, ease: REWARD_EASE, delay: 0.06 }}
              >
                {newBestThisRun && (
                  <motion.div
                    className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
                    initial={{ opacity: 0, y: 8, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: [1, 1.12, 1] }}
                    transition={{ duration: 0.42, ease: REWARD_EASE, delay: 0.28 }}
                  >
                    New best
                  </motion.div>
                )}
                <motion.p
                  className="font-mono text-[11px] uppercase tracking-widest text-zinc-400"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut", delay: 0.16 }}
                >
                  Game over
                </motion.p>
                <motion.p
                  className="mt-3 text-6xl font-semibold tabular-nums tracking-tight"
                  initial={{ opacity: 0, y: 10, scale: 0.82 }}
                  animate={{ opacity: 1, y: 0, scale: [0.92, 1.12, 1] }}
                  transition={{ duration: 0.62, ease: REWARD_EASE, delay: 0.22 }}
                >
                  <AnimatedScore value={score} startFrom={0} durationMs={950} />
                </motion.p>
                <motion.div
                  className="mt-5 grid grid-cols-2 divide-x divide-zinc-950/10 rounded-[8px] border border-zinc-950/10 bg-zinc-50/80 py-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, ease: "easeOut", delay: 0.38 }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.48 }}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                      Best
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                      <AnimatedScore value={bestScore} startFrom={0} durationMs={780} />
                    </p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.56 }}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                      Matched
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                      <AnimatedScore value={completedPicks} startFrom={0} durationMs={620} />
                    </p>
                  </motion.div>
                </motion.div>
                <motion.button
                  type="button"
                  onClick={onReset}
                  className="mt-5 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800"
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.32, ease: REWARD_EASE, delay: 0.64 }}
                >
                  Play again
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {showDeviceChrome && (
          <div className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-zinc-950/24" />
        )}
      </div>
    </div>
  );
}

export function BrandColorGame() {
  const [brandOrder, setBrandOrder] = useState<readonly BrandColorGameBrand[]>(
    [],
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const [result, setResult] = useState<Guess | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [completedPicks, setCompletedPicks] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [streak, setStreak] = useState(0);
  const [multiplierBurst, setMultiplierBurst] = useState<MultiplierBurst | null>(null);
  const [scoreTrail, setScoreTrail] = useState<ScoreTrail | null>(null);
  const [bestPulse, setBestPulse] = useState(0);
  const [lifePulse, setLifePulse] = useState(0);
  const [timeoutCollapse, setTimeoutCollapse] = useState<TimeoutCollapse | null>(null);
  const [resolvingMedal, setResolvingMedal] = useState<MedalKind | null>(null);
  const [resolvingNearMiss, setResolvingNearMiss] = useState(false);
  const [newBestThisRun, setNewBestThisRun] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [challengeIntro, setChallengeIntro] = useState(false);
  const [waves, setWaves] = useState<PickWave[]>([]);
  const [hasPicked, setHasPicked] = useState(false);
  const [hasInteractedWithPicker, setHasInteractedWithPicker] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [pickerCloseSignal, setPickerCloseSignal] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [introPhase, setIntroPhase] = useState<IntroPhase>("hud");
  const revealTimer = useRef<number | null>(null);
  const autoAdvanceTimer = useRef<number | null>(null);
  const challengeTimer = useRef<number | null>(null);
  const challengeStartedAt = useRef<number | null>(null);
  const challengeIntroTimer = useRef<number | null>(null);
  const multiplierBurstTimer = useRef<number | null>(null);
  const scoreTrailTimer = useRef<number | null>(null);
  const timeoutCollapseTimer = useRef<number | null>(null);
  const waveId = useRef(0);
  const multiplierBurstId = useRef(0);
  const scoreTrailId = useRef(0);
  const timeoutCollapseId = useRef(0);
  const brand = brandOrder[roundIndex];
  const introComplete = introPhase === "ready";
  const introPhaseIndex = INTRO_PHASE_ORDER.indexOf(introPhase);
  const challengeActive = completedPicks >= CHALLENGE_START_AFTER_PICKS;
  const challengeDurationMs = challengeDurationFor(completedPicks);

  useEffect(() => {
    const storedBest = window.localStorage.getItem("brand-color-game-best");
    if (storedBest) setBestScore(parseInt(storedBest, 10) || 0);
    setBrandOrder(shuffledBrands());
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    INTRO_PHASE_TIMINGS.forEach(({ phase, at }) => {
      timers.push(window.setTimeout(() => setIntroPhase(phase), at));
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const desktopRightInset = useMemo(() => {
    if (isMobile) return DEVICE_PADDING;
    const containerInnerW = 1024 - 24 * 2;
    return Math.max(DEVICE_PADDING, (vp.w - containerInnerW) / 2);
  }, [isMobile, vp.w]);

  const fabBottomDesktop =
    DEVICE_PADDING + DEVICE_BEZEL + FAB_INSET_FROM_SCREEN;
  const fabRightDesktop =
    desktopRightInset + DEVICE_BEZEL + FAB_INSET_FROM_SCREEN;
  const actualFabBottom = isMobile ? GAME_PICKER_CONFIG.fabInset : fabBottomDesktop;
  const actualFabRight = isMobile ? GAME_PICKER_CONFIG.fabInset : fabRightDesktop;

  const closePicker = () => {
    setPressed(false);
    setPickerCloseSignal((current) => current + 1);
  };

  const handlePressedChange = (nextPressed: boolean) => {
    setPressed(nextPressed);
    if (nextPressed) setHasInteractedWithPicker(true);
  };

  const showMultiplierBurst = (multiplier: number) => {
    if (multiplierBurstTimer.current) {
      clearTimeout(multiplierBurstTimer.current);
      multiplierBurstTimer.current = null;
    }
    setMultiplierBurst({ id: ++multiplierBurstId.current, multiplier });
    multiplierBurstTimer.current = window.setTimeout(() => {
      setMultiplierBurst(null);
      multiplierBurstTimer.current = null;
    }, 760);
  };

  const showScoreTrail = (points: number) => {
    if (scoreTrailTimer.current) {
      clearTimeout(scoreTrailTimer.current);
      scoreTrailTimer.current = null;
    }
    setScoreTrail({ id: ++scoreTrailId.current, points });
    scoreTrailTimer.current = window.setTimeout(() => {
      setScoreTrail(null);
      scoreTrailTimer.current = null;
    }, 820);
  };

  const showTimeoutCollapse = () => {
    if (!brand) return;
    if (timeoutCollapseTimer.current) {
      clearTimeout(timeoutCollapseTimer.current);
      timeoutCollapseTimer.current = null;
    }
    setTimeoutCollapse({
      id: ++timeoutCollapseId.current,
      color: brand.targetHex,
    });
    timeoutCollapseTimer.current = window.setTimeout(() => {
      setTimeoutCollapse(null);
      timeoutCollapseTimer.current = null;
    }, 520);
  };

  const handlePick = (raw: string) => {
    if (!brand) return;
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (challengeTimer.current) {
      clearTimeout(challengeTimer.current);
      challengeTimer.current = null;
    }
    if (gameOver) return;
    const hex = resolveCssColor(raw);
    const errorPoints = errorPointsFor(hex, brand.targetHex);
    const medal = medalFor(errorPoints);
    const nearMiss = !medal && errorPoints <= NEAR_MISS_POINTS;
    const waveContrast = foregroundForBackground(hex);
    const clutch =
      challengeActive &&
      challengeStartedAt.current !== null &&
      Math.max(
        0,
        1 - (Date.now() - challengeStartedAt.current) / challengeDurationMs,
      ) <= CLUTCH_RATIO;
    const nextStreak = medal ? streak + 1 : 0;
    const previousMultiplier = multiplierForStreak(streak);
    const nextMultiplier = multiplierForStreak(nextStreak);
    const pointsResult = pointsFor({ medal, streak: nextStreak, clutch });
    const nextCompletedPicks = completedPicks + 1;
    setHasPicked(true);
    setResult(null);
    setIsResolving(true);
    setResolvingMedal(medal);
    setResolvingNearMiss(nearMiss);
    setCompletedPicks(nextCompletedPicks);
    setStreak(nextStreak);
    if (!medal) {
      setLives((current) => Math.max(0, current - 1));
      setLifePulse((current) => current + 1);
    }
    hapticFor(medal, nearMiss);
    setWaves((current) => [
      ...current,
      {
        id: ++waveId.current,
        color: raw,
        medal,
        nearMiss,
        ...waveContrast,
      },
    ]);

    revealTimer.current = window.setTimeout(() => {
      revealTimer.current = null;
      if (pointsResult) {
        showScoreTrail(pointsResult.points);
        if (nextMultiplier > previousMultiplier) {
          showMultiplierBurst(nextMultiplier);
          hapticFor("gold");
        }
        setScore((current) => {
          const next = current + pointsResult.points;
          setBestScore((currentBest) => {
            if (next <= currentBest) return currentBest;
            window.localStorage.setItem("brand-color-game-best", String(next));
            setNewBestThisRun(true);
            setBestPulse((currentPulse) => currentPulse + 1);
            return next;
          });
          return next;
        });
      }
      setResult({
        errorPoints,
        medal,
        label: nearMiss ? "Close" : undefined,
        points: pointsResult ? pointsResult.points : 0,
        multiplier: pointsResult ? pointsResult.multiplier : 1,
        clutch,
      });
      autoAdvanceTimer.current = window.setTimeout(() => {
        autoAdvanceTimer.current = null;
        const outOfLives = !medal && lives <= 1;
        setResult(null);
        setIsResolving(false);
        setResolvingMedal(null);
        setResolvingNearMiss(false);
        setWaves([]);
        if (outOfLives) {
          hapticFor("bronze");
          setGameOver(true);
        } else {
          if (nextCompletedPicks === CHALLENGE_START_AFTER_PICKS) {
            setChallengeIntro(true);
            if (challengeIntroTimer.current) clearTimeout(challengeIntroTimer.current);
            challengeIntroTimer.current = window.setTimeout(() => {
              setChallengeIntro(false);
              challengeIntroTimer.current = null;
            }, 1100);
          }
          setRoundIndex((current) => (current + 1) % brandOrder.length);
        }
      }, NEXT_ROUND_DELAY_MS);
    }, SCORE_REVEAL_DELAY_MS);
  };

  const handleChallengeTimeout = () => {
    if (revealTimer.current || autoAdvanceTimer.current || isResolving) return;
    closePicker();
    hapticFor(null);
    showTimeoutCollapse();
    const outOfLives = lives <= 1;
    setHasPicked(true);
    setIsResolving(true);
    setResolvingMedal(null);
    setResolvingNearMiss(false);
    setStreak(0);
    setLifePulse((current) => current + 1);
    setLives((current) => Math.max(0, current - 1));
    setResult({
      errorPoints: 100,
      medal: null,
      label: "Time",
    });
    autoAdvanceTimer.current = window.setTimeout(() => {
      autoAdvanceTimer.current = null;
      setResult(null);
      setIsResolving(false);
      setResolvingMedal(null);
      setResolvingNearMiss(false);
      setWaves([]);
      if (outOfLives) {
        hapticFor("bronze");
        setGameOver(true);
      } else {
        setRoundIndex((current) => (current + 1) % brandOrder.length);
      }
    }, NEXT_ROUND_DELAY_MS);
  };

  const resetGame = () => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (challengeTimer.current) {
      clearTimeout(challengeTimer.current);
      challengeTimer.current = null;
    }
    if (challengeIntroTimer.current) {
      clearTimeout(challengeIntroTimer.current);
      challengeIntroTimer.current = null;
    }
    if (multiplierBurstTimer.current) {
      clearTimeout(multiplierBurstTimer.current);
      multiplierBurstTimer.current = null;
    }
    if (scoreTrailTimer.current) {
      clearTimeout(scoreTrailTimer.current);
      scoreTrailTimer.current = null;
    }
    if (timeoutCollapseTimer.current) {
      clearTimeout(timeoutCollapseTimer.current);
      timeoutCollapseTimer.current = null;
    }
    setResult(null);
    setIsResolving(false);
    setResolvingMedal(null);
    setResolvingNearMiss(false);
    setCompletedPicks(0);
    setScore(0);
    setLives(STARTING_LIVES);
    setStreak(0);
    setNewBestThisRun(false);
    setMultiplierBurst(null);
    setScoreTrail(null);
    setTimeoutCollapse(null);
    setGameOver(false);
    setChallengeIntro(false);
    setWaves([]);
    closePicker();
    setHasPicked(false);
    setHasInteractedWithPicker(false);
    setBrandOrder(shuffledBrands());
    setRoundIndex(0);
  };

  const handleWaveComplete = () => {
    // Keep the expanded color in place until the next brand appears.
  };

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      if (challengeTimer.current) clearTimeout(challengeTimer.current);
      if (challengeIntroTimer.current) clearTimeout(challengeIntroTimer.current);
      if (multiplierBurstTimer.current) clearTimeout(multiplierBurstTimer.current);
      if (scoreTrailTimer.current) clearTimeout(scoreTrailTimer.current);
      if (timeoutCollapseTimer.current) clearTimeout(timeoutCollapseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (challengeTimer.current) {
      clearTimeout(challengeTimer.current);
      challengeTimer.current = null;
    }
    if (!brand || !challengeActive || challengeIntro || gameOver || isResolving || result) return;

    challengeStartedAt.current = Date.now();
    challengeTimer.current = window.setTimeout(() => {
      challengeTimer.current = null;
      handleChallengeTimeout();
    }, challengeDurationMs);

    return () => {
      if (challengeTimer.current) {
        clearTimeout(challengeTimer.current);
        challengeTimer.current = null;
      }
    };
    // `brand.id` restarts the timeout for each randomized round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand?.id, challengeActive, challengeDurationMs, challengeIntro, gameOver, isResolving, result]);

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-200 text-zinc-950 dark:from-zinc-900 dark:to-zinc-950 dark:text-white">
      <section className="relative mx-auto hidden min-h-[100dvh] max-w-5xl px-6 py-16 md:block">
        <div className="max-w-md pt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Lab / unlisted
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Brand Color Match
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            A game layer for the radial picker. Real brand marks, one primary
            color, escalating pressure, streaks, and medals for close matches.
          </p>
        </div>
      </section>

      <div
        className="fixed z-0 hidden select-none overflow-hidden bg-[#f8f6ee] md:block"
        style={{
          bottom: DEVICE_PADDING + DEVICE_BEZEL,
          right: desktopRightInset + DEVICE_BEZEL,
          width: DEVICE_SCREEN_W,
          height: DEVICE_SCREEN_H,
          borderRadius: 38,
        }}
      >
        {introComplete && brand ? (
          <PhoneScreen
            brand={brand}
            result={result}
            isResolving={isResolving}
            resolvingMedal={resolvingMedal}
            resolvingNearMiss={resolvingNearMiss}
            score={score}
            lives={lives}
            streak={streak}
            multiplierBurst={multiplierBurst}
            scoreTrail={scoreTrail}
            bestPulse={bestPulse}
            lifePulse={lifePulse}
            timeoutCollapse={timeoutCollapse}
            completedPicks={completedPicks}
            gameOver={gameOver}
            bestScore={bestScore}
            newBestThisRun={newBestThisRun}
            challengeIntro={challengeIntro}
            challengeActive={challengeActive}
            challengePaused={isResolving || result !== null}
            challengeKey={roundIndex}
            challengeDurationMs={challengeDurationMs}
            showDeviceChrome
            waves={waves}
            roundIndex={roundIndex}
            totalRounds={brandOrder.length}
            onWaveComplete={handleWaveComplete}
            onReset={resetGame}
            suppressInitialReveal={completedPicks === 0 && roundIndex === 0}
          />
        ) : (
          <IntroPhoneScreen
            phase={introPhase}
            brand={brand}
            totalRounds={brandOrder.length}
            showDeviceChrome
          />
        )}
      </div>

      <div
        aria-hidden
        className="pointer-events-none fixed z-[31] hidden select-none md:block"
        style={{
          bottom: DEVICE_PADDING,
          right: desktopRightInset,
          width: DEVICE_FRAME_W,
          height: DEVICE_FRAME_H,
          border: `${DEVICE_BEZEL}px solid #0a0a0a`,
          borderRadius: 44,
          boxSizing: "border-box",
          boxShadow:
            "0 1px 0 1px rgba(255,255,255,0.04) inset, 0 24px 64px rgba(0,0,0,0.45)",
        }}
      />

      <div className="fixed inset-0 z-0 md:hidden">
        {introComplete && brand ? (
          <PhoneScreen
            brand={brand}
            result={result}
            isResolving={isResolving}
            resolvingMedal={resolvingMedal}
            resolvingNearMiss={resolvingNearMiss}
            score={score}
            lives={lives}
            streak={streak}
            multiplierBurst={multiplierBurst}
            scoreTrail={scoreTrail}
            bestPulse={bestPulse}
            lifePulse={lifePulse}
            timeoutCollapse={timeoutCollapse}
            completedPicks={completedPicks}
            gameOver={gameOver}
            bestScore={bestScore}
            newBestThisRun={newBestThisRun}
            challengeIntro={challengeIntro}
            challengeActive={challengeActive}
            challengePaused={isResolving || result !== null}
            challengeKey={roundIndex}
            challengeDurationMs={challengeDurationMs}
            showDeviceChrome={false}
            waves={waves}
            roundIndex={roundIndex}
            totalRounds={brandOrder.length}
            onWaveComplete={handleWaveComplete}
            onReset={resetGame}
            suppressInitialReveal={completedPicks === 0 && roundIndex === 0}
          />
        ) : (
          <IntroPhoneScreen
            phase={introPhase}
            brand={brand}
            totalRounds={brandOrder.length}
            showDeviceChrome={false}
          />
        )}
      </div>

      <AnimatePresence>
        {brand && introComplete && !hasPicked && !hasInteractedWithPicker && (
          <motion.div
            key="picker-helper"
            className="pointer-events-none fixed z-[55] rounded-full border border-zinc-950/10 bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-lg shadow-black/10 backdrop-blur-sm"
            style={{
              bottom: actualFabBottom + GAME_PICKER_CONFIG.fabSize + 16,
              right: actualFabRight + GAME_PICKER_CONFIG.fabSize / 2,
              translate: "50% 0",
            }}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            Drag to select color
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {brand && introPhase === "ripple" && (
          <IntroPickerRipple
            key="intro-picker-ripple"
            color={brand.targetHex}
            fabSize={GAME_PICKER_CONFIG.fabSize}
            fabBottom={actualFabBottom}
            fabRight={actualFabRight}
          />
        )}
      </AnimatePresence>

      {(introPhaseIndex >= INTRO_PHASE_ORDER.indexOf("fab") &&
        (introComplete ? brand && !gameOver : true)) && (
        <ColorPickerFabV9
          config={GAME_PICKER_CONFIG}
          onPick={introComplete ? handlePick : undefined}
          closeSignal={pickerCloseSignal}
          onPressedChange={handlePressedChange}
          disableBackdropBlur
          disabled={!introComplete}
          screenEdgeInset={FAB_INSET_FROM_SCREEN}
          fabBottomInset={isMobile ? undefined : fabBottomDesktop}
          fabRightInset={isMobile ? undefined : fabRightDesktop}
        />
      )}

      <ThumbCursor
        visible={!isMobile && pressed && !gameOver}
        fabSize={GAME_PICKER_CONFIG.fabSize}
        fabBottom={actualFabBottom}
        fabRight={actualFabRight}
        clipRect={{
          bottom: DEVICE_PADDING + DEVICE_BEZEL,
          right: desktopRightInset + DEVICE_BEZEL,
          width: DEVICE_SCREEN_W,
          height: DEVICE_SCREEN_H,
          borderRadius: 38,
        }}
      />
    </main>
  );
}
