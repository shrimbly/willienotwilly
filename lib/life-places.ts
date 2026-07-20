// Life Clock — the PLACES dimension.
// Pure: turns a profile's `places` into resolved, dated bands with a stable
// colour each, ready to tint the LIFE grid and fill the legend. Zero browser
// APIs; every function takes an explicit `now` so it is deterministic.

import { parseDob, type LifeProfile, type LifePlace } from "@/lib/life-clock";

/**
 * A cartographic, low-key palette — distinct hues that read as regions rather
 * than shouting like the event accents. Assigned in the order places appear.
 * Extra entries let a profile carry more than five places without collision.
 */
export const PLACE_PALETTE = [
  "#C99A3B", // gold
  "#4B93B5", // steel blue
  "#D97D57", // terracotta
  "#A96FB0", // orchid
  "#CE6D7E", // dusty rose
  "#6BA88E", // sage
  "#B08CC9", // lilac
  "#C7A76B", // wheat
] as const;

export interface PlaceBand {
  label: string;
  /** Local-midnight arrival. */
  start: Date;
  /** Local-midnight departure (clamped to `now` for an open-ended stay). */
  end: Date;
  /** True when the stay has no recorded end — still there, shown as "…–now". */
  ongoing: boolean;
  /** Legend swatch, e.g. "#4B93B5". */
  hex: string;
  /** Raw sRGB components 0..1 (for the grid tint shader, which is unmanaged). */
  rgb: [number, number, number];
}

/** "1991", or "1991–2009", or "2021–now" for an ongoing stay. */
export function placeYears(band: PlaceBand): string {
  const from = band.start.getFullYear();
  if (band.ongoing) return `${from}–now`;
  const to = band.end.getFullYear();
  return from === to ? String(from) : `${from}–${to}`;
}

/**
 * Resolve `profile.places` to dated, coloured bands, in the profile's order.
 * A place with an unparseable start is dropped; a missing/invalid end is
 * treated as ongoing (clamped to `now`). Bands are NOT clipped against each
 * other — a later band's start may share a week with the previous band's end;
 * the grid tint lets the later one win, matching a same-week move.
 */
export function buildPlaceBands(profile: LifeProfile, now: Date): PlaceBand[] {
  const places = profile.places ?? [];
  const bands: PlaceBand[] = [];
  places.forEach((place: LifePlace, i) => {
    const start = parseDob(place.start, now);
    if (start === null) return;
    const parsedEnd = place.end ? parseDob(place.end, now) : null;
    const hasEnd = parsedEnd !== null && parsedEnd.getTime() > start.getTime();
    const end = hasEnd ? parsedEnd : now;
    const hex = PLACE_PALETTE[i % PLACE_PALETTE.length];
    bands.push({
      label: place.label,
      start,
      end,
      ongoing: !hasEnd,
      hex,
      rgb: hexToRgb(hex),
    });
  });
  return bands;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
