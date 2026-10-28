"use client";

import { memo, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { AudioWaveform, Box, Check, Image as ImageIcon, Play, Star, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AssetKind, LibraryAsset } from "@/lib/node-banana/assets";

import { assetTitle, formatDuration } from "./format";

// One asset in the grid (src/components/assets/AssetTile.tsx): the picture,
// badges for what it is, a checkbox and a favorite star. Videos preview on
// hover after the canvas's 300ms hover delay, unless motion is reduced.

const VIDEO_HOVER_DELAY_MS = 300;
export const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const MOVE = { duration: 0.45, ease: EASE_OUT };

/** Kind colour (the node sockets' colours): placeholder ground and glyph. */
export const KIND_TONE: Record<AssetKind, { ground: string; glyph: string }> = {
  image: { ground: "bg-[color-mix(in_srgb,var(--nb-handle-image)_10%,transparent)]", glyph: "text-[var(--nb-handle-image)]" },
  video: { ground: "bg-[color-mix(in_srgb,var(--nb-handle-video)_10%,transparent)]", glyph: "text-[var(--nb-handle-video)]" },
  audio: { ground: "bg-[color-mix(in_srgb,var(--nb-handle-audio)_10%,transparent)]", glyph: "text-[var(--nb-handle-audio)]" },
  "3d": { ground: "bg-[color-mix(in_srgb,var(--nb-handle-3d)_10%,transparent)]", glyph: "text-[var(--nb-handle-3d)]" },
};

const KIND_ICONS: Record<AssetKind, typeof ImageIcon> = { image: ImageIcon, video: Video, audio: AudioWaveform, "3d": Box };

/** Kind-coloured stand-in: audio, or anything without a picture. */
export function AssetPlaceholder({ kind, className, size = 28 }: { kind: AssetKind; className?: string; size?: number }) {
  const Icon = KIND_ICONS[kind];
  return (
    <div className={cn("flex h-full w-full items-center justify-center", KIND_TONE[kind].ground, className)}>
      <Icon size={size} strokeWidth={1.5} className={cn(KIND_TONE[kind].glyph, "opacity-80")} />
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="nb-font-mono inline-flex h-5 items-center gap-1 rounded-[5px] bg-black/70 px-1.5 text-[10px] leading-none text-neutral-100">
      {children}
    </span>
  );
}

export type TileEnter = "none" | "reveal" | "arrive";

export interface AssetTileProps {
  asset: LibraryAsset;
  width: number;
  height: number;
  x: number;
  y: number;
  favorite: boolean;
  selected: boolean;
  focused: boolean;
  tabbable: boolean;
  /** Show the checkbox at rest (select mode, or something is selected). */
  selecting: boolean;
  enter: TileEnter;
  delay: number;
  /** Jump rather than glide (a resize relayout). */
  instant: boolean;
  reducedMotion: boolean;
  onFocus: (id: string) => void;
  onActivate: (id: string, event: ReactMouseEvent) => void;
  onToggleSelect: (id: string, event: ReactMouseEvent) => void;
  onToggleFavorite: (id: string) => void;
  onContextMenu: (id: string, event: ReactMouseEvent) => void;
}

export const AssetTile = memo(function AssetTile({
  asset,
  width,
  height,
  x,
  y,
  favorite,
  selected,
  focused,
  tabbable,
  selecting,
  enter,
  delay,
  instant,
  reducedMotion,
  onFocus,
  onActivate,
  onToggleSelect,
  onToggleFavorite,
  onContextMenu,
}: AssetTileProps) {
  const { id, kind } = asset;
  const [previewing, setPreviewing] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = assetTitle(asset);

  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );

  const startPreview = () => {
    if (kind !== "video" || !asset.media || reducedMotion) return;
    hoverTimer.current = setTimeout(() => setPreviewing(true), VIDEO_HOVER_DELAY_MS);
  };
  const stopPreview = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setPreviewing(false);
  };

  const still = reducedMotion || enter === "none";
  const fade = { duration: 0.42, ease: EASE_OUT, delay };

  return (
    <motion.div
      className="group absolute top-0 left-0"
      style={{ width, height }}
      data-asset-id={id}
      initial={still ? false : { opacity: 0, scale: 0.96, x, y: enter === "arrive" ? y - 14 : y }}
      animate={{ opacity: 1, scale: 1, x, y }}
      exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, transition: { duration: 0.16, ease: "easeOut" } }}
      transition={{
        x: instant || reducedMotion ? { duration: 0 } : MOVE,
        y: instant || reducedMotion ? { duration: 0 } : enter === "arrive" ? { ...MOVE, delay } : MOVE,
        opacity: reducedMotion ? { duration: 0 } : fade,
        scale: reducedMotion ? { duration: 0 } : fade,
      }}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
    >
      <button
        type="button"
        tabIndex={tabbable ? 0 : -1}
        aria-label={title}
        aria-pressed={selecting ? selected : undefined}
        data-asset-tile={id}
        onFocus={() => onFocus(id)}
        onClick={(event) => onActivate(id, event)}
        onContextMenu={(event) => onContextMenu(id, event)}
        className={cn(
          "nb-rounded-media nb-bg-well relative block h-full w-full overflow-hidden text-left",
          "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-[box-shadow,opacity] duration-[120ms]",
          "focus-visible:outline-none",
          selected
            ? "ring-2 ring-[var(--nb-selection)] ring-offset-1 ring-offset-[var(--nb-canvas)]"
            : focused
              ? "ring-2 ring-white/40 ring-offset-1 ring-offset-[var(--nb-canvas)]"
              : "group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
        )}
      >
        {asset.thumb ? (
          <Image
            src={asset.thumb.src}
            alt=""
            width={asset.thumb.width}
            height={asset.thumb.height}
            unoptimized
            draggable={false}
            className="pointer-events-none h-full w-full object-cover"
          />
        ) : (
          <AssetPlaceholder kind={kind} size={kind === "audio" ? Math.min(40, height * 0.45) : 28} />
        )}
        {previewing && asset.media && (
          <video
            src={asset.media}
            muted
            loop
            autoPlay
            playsInline
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex gap-1">
          {kind === "video" && (
            <Badge>
              <Play size={9} strokeWidth={0} fill="currentColor" />
              {asset.durationSec ? formatDuration(asset.durationSec) : "Video"}
            </Badge>
          )}
          {kind === "audio" && asset.durationSec ? <Badge>{formatDuration(asset.durationSec)}</Badge> : null}
        </span>
      </button>

      {/* Checkbox, top-left: on hover, while selecting, or when selected */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? `Deselect ${title}` : `Select ${title}`}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelect(id, event);
        }}
        className={cn(
          "absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-[5px] border transition-opacity duration-[120ms]",
          selected
            ? "border-[var(--nb-selection)] bg-[var(--nb-selection)] text-white opacity-100"
            : cn("border-white/70 bg-black/50 text-transparent", selecting ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"),
        )}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      {/* Favorite, top-right: always when on, on hover to add */}
      <button
        type="button"
        aria-label={favorite ? "Remove from Favorites" : "Add to Favorites"}
        aria-pressed={favorite}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(id);
        }}
        className={cn(
          "absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-md text-white transition-opacity duration-[120ms] hover:bg-black/40",
          favorite ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
        )}
      >
        <Star size={15} strokeWidth={1.75} fill={favorite ? "currentColor" : "rgba(0,0,0,0.25)"} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      </button>
    </motion.div>
  );
});
