// Words and numbers for the Assets view, ported from the app's assetFormat.ts.
// Dates are fixed strings built from the records (no clock, no locale), so the
// server and the client render the same thing.

import { DAYS, type AssetKind, type AssetOrigin, type LibraryAsset } from "@/lib/node-banana/assets";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_START = { year: 2026, month: 9, date: 26 };

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` of an asset's day. */
export function dayKey(at: number): string {
  return `2026-10-${pad2(DAY_START.date + Math.floor(at / 1440))}`;
}

export function dayInfo(key: string) {
  return DAYS.find((day) => day.key === key);
}

/** Heading of a day section: "Today", "Yesterday", "Mon 26 Oct". */
export function daySectionLabel(key: string): string {
  return dayInfo(key)?.label ?? key;
}

function clock(at: number): string {
  const minutes = at % 1440;
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

function dateOf(at: number): string {
  return `${DAY_START.date + Math.floor(at / 1440)} ${MONTHS[DAY_START.month]} ${DAY_START.year}`;
}

/** "29 Oct 2026, 14:02": the Created row. */
export function formatDateTime(at: number): string {
  return `${dateOf(at)}, ${clock(at)}`;
}

/** Decimal units, as Finder shows them: "512 B", "1.2 KB", "34 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : unit >= 2 ? 2 : 1;
  return `${Number(value.toFixed(digits))} ${units[unit]}`;
}

/** "0:07", "12:05". */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}

/** "1,240" without the locale's say. */
export function formatNumber(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "1 asset", "1,240 assets". */
export function formatCount(count: number, noun = "asset", plural = `${noun}s`): string {
  return `${formatNumber(count)} ${count === 1 ? noun : plural}`;
}

/** "$0.034", "$0.13", "Est. $0.35". */
export function formatCost(cost: { amount: number; estimated?: boolean }): string {
  const amount = cost.amount >= 0.1 ? cost.amount.toFixed(2) : Number(cost.amount.toFixed(4)).toString();
  return `${cost.estimated ? "Est. " : ""}$${amount}`;
}

export function formatDimensions(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  return `${width} × ${height}`;
}

export const KIND_LABELS: Record<AssetKind, string> = { image: "Image", video: "Video", audio: "Audio", "3d": "3D" };
export const KIND_PLURALS: Record<AssetKind, string> = { image: "Images", video: "Videos", audio: "Audio", "3d": "3D" };
export const ASSET_KINDS: AssetKind[] = ["image", "video", "audio", "3d"];
const ORIGIN_LABELS: Record<AssetOrigin, string> = { generated: "Generated", edited: "Edited", uploaded: "Uploaded" };

const OPERATION_LABELS: Record<string, string> = {
  easeCurve: "Ease curve",
  splitGrid: "Grid split",
  upload: "Upload",
};

export function operationLabel(operation?: string): string | null {
  if (!operation) return null;
  return OPERATION_LABELS[operation] ?? operation;
}

/** Last folder name of a path. */
export function projectLabel(path: string | null): string {
  if (!path) return "Not in a project";
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

/** The first line of the prompt; else what made the asset and where: "Grid split · cell 3 · Cars". */
export function assetTitle(asset: LibraryAsset): string {
  const line = asset.prompt
    ?.split(/\r?\n/)
    .find((l) => l.trim())
    ?.trim();
  if (line) return line.length > 120 ? `${line.slice(0, 117).trimEnd()}…` : line;
  const made = asset.origin === "edited" ? (operationLabel(asset.producer.operation) ?? ORIGIN_LABELS.edited) : KIND_LABELS[asset.kind];
  const cell = asset.producer.batchIndex !== undefined && /split/i.test(asset.producer.operation ?? "") ? `cell ${asset.producer.batchIndex + 1}` : null;
  return [made, cell, asset.workflow.name].filter(Boolean).join(" · ");
}

/** Eyebrow over the detail title: "Image · Generated · 29 Oct 2026". */
export function assetEyebrow(asset: LibraryAsset): string {
  const origin =
    asset.origin === "edited"
      ? (operationLabel(asset.producer.operation) ?? ORIGIN_LABELS.edited)
      : asset.origin === "uploaded"
        ? ORIGIN_LABELS.uploaded
        : ORIGIN_LABELS.generated;
  return [KIND_LABELS[asset.kind], origin, dateOf(asset.at)].join(" · ");
}

/** Tags are free text: trimmed, single-spaced, at most 64 characters. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 64);
}

export const hasTag = (tags: readonly string[], tag: string) => tags.some((t) => t.toLowerCase() === tag.toLowerCase());
