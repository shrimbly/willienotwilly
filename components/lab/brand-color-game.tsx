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
};

type MedalKind = "platinum" | "gold" | "silver" | "bronze";

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
const STARTING_LIVES = 3;
const CLUTCH_RATIO = 0.15;
const WAVE_ORIGIN = `calc(100% - ${FAB_INSET_FROM_SCREEN}px) calc(100% - ${FAB_INSET_FROM_SCREEN}px)`;
const REWARD_EASE = [0.16, 1, 0.3, 1] as const;
const OKLAB_REFERENCE_DISTANCE = 0.62;

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

function hexToRgbString(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
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
  const multiplier = Math.min(5, 1 + Math.floor(streak / 3));
  return {
    points: MEDAL_POINTS[medal] * multiplier + (clutch ? 250 : 0),
    multiplier,
  };
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
      initial: { opacity: 0, y: -22, scale: 0.72, rotate: -8 },
      animate: { opacity: 1, y: 0, scale: [1, 1.18, 1], rotate: 0 },
      transition: { duration: 0.62, ease: REWARD_EASE },
      className:
        "border-white/80 bg-white/95 shadow-[0_0_0_10px_rgba(255,255,255,0.22),0_0_48px_rgba(255,255,255,0.48),0_20px_54px_rgba(0,0,0,0.16)]",
      burstCount: 12,
    };
  }
  if (medal === "gold") {
    return {
      initial: { opacity: 0, y: -18, scale: 0.78 },
      animate: { opacity: 1, y: 0, scale: [1, 1.1, 1] },
      transition: { duration: 0.48, ease: REWARD_EASE },
      className:
        "border-amber-200/90 bg-white/95 shadow-[0_0_0_7px_rgba(246,198,74,0.18),0_0_34px_rgba(246,198,74,0.36),0_18px_44px_rgba(0,0,0,0.16)]",
      burstCount: 8,
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

function RewardToast({ result }: { result: Guess }) {
  const medal = result.medal ? MEDALS[result.medal] : null;
  const motionConfig = rewardMotion(result.medal);

  return (
    <motion.div
      key="reward-toast"
      initial={motionConfig.initial}
      animate={motionConfig.animate}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={motionConfig.transition}
      className={`absolute left-1/2 top-[72px] z-30 flex w-fit max-w-[calc(100%-3rem)] -translate-x-1/2 items-center gap-3 overflow-visible rounded-full border px-4 py-2.5 ${motionConfig.className}`}
    >
      {Array.from({ length: motionConfig.burstCount }).map((_, index) => {
        const angle = (index / Math.max(1, motionConfig.burstCount)) * Math.PI * 2;
        const distance = result.medal === "platinum" ? 52 : result.medal === "gold" ? 42 : 32;
        return (
          <motion.span
            key={index}
            aria-hidden
            className="absolute left-1/2 top-1/2 size-1.5 rounded-full"
            style={{ background: medal?.color ?? "#fff" }}
            initial={{ x: "-50%", y: "-50%", opacity: 0, scale: 0.4 }}
            animate={{
              x: `calc(-50% + ${Math.cos(angle) * distance}px)`,
              y: `calc(-50% + ${Math.sin(angle) * distance}px)`,
              opacity: [0, 1, 0],
              scale: [0.4, 1, 0.2],
            }}
            transition={{
              duration: result.medal === "platinum" ? 0.72 : 0.56,
              ease: "easeOut",
              delay: 0.04 + index * 0.012,
            }}
          />
        );
      })}
      {result.medal && (
        <motion.span
          aria-hidden
          className="absolute inset-[-6px] rounded-full"
          style={{ border: `1px solid ${medal?.color ?? "#fff"}` }}
          initial={{ opacity: 0.45, scale: 0.88 }}
          animate={{ opacity: 0, scale: result.medal === "platinum" ? 1.38 : 1.24 }}
          transition={{ duration: result.medal === "bronze" ? 0.4 : 0.62, ease: "easeOut" }}
        />
      )}
      <div
        className="grid size-8 shrink-0 place-items-center rounded-full"
        style={{ background: medal ? `${medal.color}38` : "#f1f1f1" }}
      >
        <Medal
          className="size-4"
          style={{ color: medal ? medal.color : "#a1a1aa" }}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-950">
          {result.label ?? (medal ? medal.label : "No medal")}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          {result.points ? `+${result.points}` : `${result.errorPoints} points off`}
          {result.clutch ? " / clutch" : ""}
          {result.multiplier && result.multiplier > 1
            ? ` / x${result.multiplier}`
            : ""}
        </p>
      </div>
      {result.medal === "platinum" && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
          initial={{ x: "-120%", opacity: 0 }}
          animate={{ x: "120%", opacity: [0, 0.8, 0] }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.08 }}
        />
      )}
    </motion.div>
  );
}

function PhoneScreen({
  brand,
  result,
  isResolving,
  score,
  lives,
  streak,
  completedPicks,
  gameOver,
  bestScore,
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
}: {
  brand: BrandColorGameBrand;
  result: Guess | null;
  isResolving: boolean;
  score: number;
  lives: number;
  streak: number;
  completedPicks: number;
  gameOver: boolean;
  bestScore: number;
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
}) {
  const brandRgb = hexToRgbString(brand.targetHex);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f8f6ee] text-zinc-950">
      <AnimatePresence>
        {challengeActive && !gameOver && (
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
        )}
      </AnimatePresence>
      {waves.map((wave) => (
        <motion.div
          key={wave.id}
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: wave.color }}
          initial={{ clipPath: `circle(0px at ${WAVE_ORIGIN})` }}
          animate={{ clipPath: `circle(150vmax at ${WAVE_ORIGIN})` }}
          transition={{ duration: 0.88, ease: [0.16, 1, 0.3, 1] }}
          onAnimationComplete={() => onWaveComplete(wave.id)}
        />
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
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              Score
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums">
              {score}
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              {roundIndex + 1}/{totalRounds}
            </p>
            <p className="font-mono text-xs text-zinc-500">
              {"●".repeat(lives)}
              <span className="text-zinc-300">{"●".repeat(STARTING_LIVES - lives)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset game"
            className="ml-auto grid size-8 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-950"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>

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

        <section className="flex min-h-[260px] flex-col items-center justify-center pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                boxShadow: isResolving
                  ? "0 4px 14px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.12)"
                  : "0 18px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.16)",
              }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: isResolving ? 0.22 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="grid h-44 w-56 place-items-center rounded-[36px]"
              style={{ backgroundColor: brand.targetHex }}
            >
              <div className={`relative ${brand.logoSizeClassName}`}>
                <Image
                  src={brand.logoSrc}
                  alt={`${brand.name} logo`}
                  fill
                  priority
                  sizes="208px"
                  className="object-contain"
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        <div className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
            Match the primary brand color
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {brand.name}
          </h1>
        </div>

        <div className="mt-auto pb-20">
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
        </div>

        <AnimatePresence>{result && <RewardToast result={result} />}</AnimatePresence>

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
          {gameOver && (
            <motion.div
              className="absolute inset-0 z-40 flex items-center justify-center bg-[#f8f6ee]/96 px-7 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <motion.div
                className="w-full rounded-[8px] border border-zinc-950/10 bg-white/88 p-6 text-center shadow-[0_18px_52px_rgba(0,0,0,0.14)]"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.99 }}
                transition={{ duration: 0.38, ease: REWARD_EASE, delay: 0.04 }}
              >
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                  Game over
                </p>
                <p className="mt-3 text-6xl font-semibold tabular-nums tracking-tight">
                  {score}
                </p>
                <div className="mt-5 grid grid-cols-2 divide-x divide-zinc-950/10 rounded-[8px] border border-zinc-950/10 bg-zinc-50/80 py-3">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                      Best
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                      {bestScore}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                      Matched
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                      {completedPicks}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onReset}
                  className="mt-5 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800"
                >
                  Play again
                </button>
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
    BRAND_COLOR_GAME_BRANDS,
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const [result, setResult] = useState<Guess | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [completedPicks, setCompletedPicks] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [streak, setStreak] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [challengeIntro, setChallengeIntro] = useState(false);
  const [waves, setWaves] = useState<PickWave[]>([]);
  const [hasPicked, setHasPicked] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const revealTimer = useRef<number | null>(null);
  const autoAdvanceTimer = useRef<number | null>(null);
  const challengeTimer = useRef<number | null>(null);
  const challengeStartedAt = useRef<number | null>(null);
  const challengeIntroTimer = useRef<number | null>(null);
  const waveId = useRef(0);
  const brand = brandOrder[roundIndex] ?? BRAND_COLOR_GAME_BRANDS[0];
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

  const handlePick = (raw: string) => {
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
    const clutch =
      challengeActive &&
      challengeStartedAt.current !== null &&
      Math.max(
        0,
        1 - (Date.now() - challengeStartedAt.current) / challengeDurationMs,
      ) <= CLUTCH_RATIO;
    const nextStreak = medal ? streak + 1 : 0;
    const pointsResult = pointsFor({ medal, streak: nextStreak, clutch });
    const nextCompletedPicks = completedPicks + 1;
    setHasPicked(true);
    setResult(null);
    setIsResolving(true);
    setCompletedPicks(nextCompletedPicks);
    setStreak(nextStreak);
    if (!medal) setLives((current) => Math.max(0, current - 1));
    if (pointsResult) {
      setScore((current) => {
        const next = current + pointsResult.points;
        setBestScore((currentBest) => {
          if (next <= currentBest) return currentBest;
          window.localStorage.setItem("brand-color-game-best", String(next));
          return next;
        });
        return next;
      });
    }
    setWaves((current) => [
      ...current,
      {
        id: ++waveId.current,
        color: raw,
      },
    ]);

    revealTimer.current = window.setTimeout(() => {
      revealTimer.current = null;
      setResult({
        errorPoints,
        medal,
        points: pointsResult ? pointsResult.points : 0,
        multiplier: pointsResult ? pointsResult.multiplier : 1,
        clutch,
      });
      autoAdvanceTimer.current = window.setTimeout(() => {
        autoAdvanceTimer.current = null;
        const outOfLives = !medal && lives <= 1;
        setResult(null);
        setIsResolving(false);
        setWaves([]);
        if (outOfLives) {
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
    const outOfLives = lives <= 1;
    setHasPicked(true);
    setIsResolving(true);
    setStreak(0);
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
      setWaves([]);
      if (outOfLives) {
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
    setResult(null);
    setIsResolving(false);
    setCompletedPicks(0);
    setScore(0);
    setLives(STARTING_LIVES);
    setStreak(0);
    setGameOver(false);
    setChallengeIntro(false);
    setWaves([]);
    setHasPicked(false);
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
    };
  }, []);

  useEffect(() => {
    if (challengeTimer.current) {
      clearTimeout(challengeTimer.current);
      challengeTimer.current = null;
    }
    if (!challengeActive || challengeIntro || gameOver || isResolving || result) return;

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
  }, [brand.id, challengeActive, challengeDurationMs, challengeIntro, gameOver, isResolving, result]);

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
        <PhoneScreen
          brand={brand}
          result={result}
          isResolving={isResolving}
          score={score}
          lives={lives}
          streak={streak}
          completedPicks={completedPicks}
          gameOver={gameOver}
          bestScore={bestScore}
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
        />
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
        <PhoneScreen
          brand={brand}
          result={result}
          isResolving={isResolving}
          score={score}
          lives={lives}
          streak={streak}
          completedPicks={completedPicks}
          gameOver={gameOver}
          bestScore={bestScore}
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
        />
      </div>

      <AnimatePresence>
        {!hasPicked && (
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
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            Drag to select color
          </motion.div>
        )}
      </AnimatePresence>

      <ColorPickerFabV9
        config={GAME_PICKER_CONFIG}
        onPick={gameOver ? undefined : handlePick}
        onPressedChange={setPressed}
        disableBackdropBlur
        screenEdgeInset={FAB_INSET_FROM_SCREEN}
        fabBottomInset={isMobile ? undefined : fabBottomDesktop}
        fabRightInset={isMobile ? undefined : fabRightDesktop}
      />

      <ThumbCursor
        visible={!isMobile && pressed}
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
