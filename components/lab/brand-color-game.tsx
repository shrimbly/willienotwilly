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
const RESULT_TOAST_MS = 1100;
const WAVE_ORIGIN = `calc(100% - ${FAB_INSET_FROM_SCREEN}px) calc(100% - ${FAB_INSET_FROM_SCREEN}px)`;

const GAME_PICKER_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  holdMs: 120,
  fabSize: 64,
  fabInset: FAB_INSET_FROM_SCREEN,
  swatchSize: 32,
  arcRadius: 132,
  ribbonInner: 162,
  ribbonOuter: 196,
  toneInner: 204,
  toneOuter: 262,
  toneSpanDeg: 44,
  arcSpanDeg: 106,
  ribbonL: 0.7,
  ribbonC: 0.18,
  openDurationMs: 340,
};

const MEDALS: Record<MedalKind, { label: string; color: string }> = {
  platinum: { label: "Platinum", color: "#E5E4E2" },
  gold: { label: "Gold", color: "#F6C64A" },
  silver: { label: "Silver", color: "#C9CED6" },
  bronze: { label: "Bronze", color: "#C8844A" },
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
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  const delta = Math.hypot(ar.r - br.r, ar.g - br.g, ar.b - br.b);
  const maxDelta = Math.sqrt(255 * 255 * 3);
  return Math.round((delta / maxDelta) * 100);
}

function medalFor(errorPoints: number): MedalKind | null {
  if (errorPoints === 0) return "platinum";
  if (errorPoints <= 5) return "gold";
  if (errorPoints <= 10) return "silver";
  if (errorPoints <= 15) return "bronze";
  return null;
}

function PhoneScreen({
  brand,
  result,
  waves,
  roundIndex,
  totalRounds,
  onWaveComplete,
  onReset,
}: {
  brand: BrandColorGameBrand;
  result: Guess | null;
  waves: PickWave[];
  roundIndex: number;
  totalRounds: number;
  onWaveComplete: (id: number) => void;
  onReset: () => void;
}) {
  const medal = result?.medal ? MEDALS[result.medal] : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f8f6ee] text-zinc-950">
      {waves.map((wave) => (
        <motion.div
          key={wave.id}
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: wave.color }}
          initial={{ clipPath: `circle(0px at ${WAVE_ORIGIN})` }}
          animate={{ clipPath: `circle(150vmax at ${WAVE_ORIGIN})` }}
          transition={{ duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => onWaveComplete(wave.id)}
        />
      ))}
      <div className="absolute left-6 top-2.5 text-[10px] font-medium tracking-wide text-zinc-500">
        9:41
      </div>
      <div className="absolute left-1/2 top-3 size-2.5 -translate-x-1/2 rounded-full bg-zinc-950/85" />
      <div className="absolute right-6 top-2.5 flex items-center gap-1 text-[10px] font-medium tracking-wide text-zinc-500">
        <span>5G</span>
        <span>100%</span>
      </div>

      <div className="relative z-10 flex h-full flex-col px-7 pb-8 pt-16">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            {roundIndex + 1}/{totalRounds}
          </span>
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset game"
            className="grid size-8 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-950"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>

        <section className="flex min-h-[260px] flex-col items-center justify-center pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="grid h-44 w-56 place-items-center rounded-[36px] shadow-[0_18px_48px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.16)]"
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
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            Match the primary brand color
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {brand.name}
          </h1>
        </div>

        <div className="mt-auto pb-20">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key={`${brand.id}-result`}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="mx-auto flex w-fit max-w-full items-center gap-3 rounded-full border border-zinc-950/10 bg-white/90 px-4 py-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.12)]"
              >
                <div
                  className="grid size-8 place-items-center rounded-full"
                  style={{ background: medal ? `${medal.color}33` : "#f1f1f1" }}
                >
                  <Medal
                    className="size-4"
                    style={{ color: medal ? medal.color : "#a1a1aa" }}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-950">
                    {medal ? medal.label : "No medal"}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    {result.errorPoints} points off
                  </p>
                </div>
              </motion.div>
            ) : (
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

        <div className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-zinc-950/24" />
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
  const [waves, setWaves] = useState<PickWave[]>([]);
  const [hasPicked, setHasPicked] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const autoAdvanceTimer = useRef<number | null>(null);
  const waveId = useRef(0);
  const brand = brandOrder[roundIndex] ?? BRAND_COLOR_GAME_BRANDS[0];

  useEffect(() => {
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
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    const hex = resolveCssColor(raw);
    const errorPoints = errorPointsFor(hex, brand.targetHex);
    setHasPicked(true);
    setWaves((current) => [
      ...current,
      {
        id: ++waveId.current,
        color: raw,
      },
    ]);
    setResult({
      errorPoints,
      medal: medalFor(errorPoints),
    });
    autoAdvanceTimer.current = window.setTimeout(() => {
      setResult(null);
      setRoundIndex((current) => (current + 1) % brandOrder.length);
    }, RESULT_TOAST_MS);
  };

  const resetGame = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setResult(null);
    setWaves([]);
    setHasPicked(false);
    setBrandOrder(shuffledBrands());
    setRoundIndex(0);
  };

  const handleWaveComplete = (id: number) => {
    setWaves((current) => current.filter((wave) => wave.id !== id));
  };

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

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
            color, and a small medal for close matches.
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
        onPick={handlePick}
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
