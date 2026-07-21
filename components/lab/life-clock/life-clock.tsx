"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  MS_PER_YEAR,
  PERCENT_DECIMALS,
  formatClock,
  formatDate,
  formatDayRemaining,
  formatLifeRemaining,
  formatPercent,
  formatWeekRemaining,
  formatYearRemaining,
  getDayProgress,
  getLifeProgress,
  getWeekProgress,
  getYearProgress,
  isoWeek,
  isoWeekYear,
  parseDob,
  type LifeProfile,
} from "@/lib/life-clock";
import {
  DEFAULT_PROFILE,
  clearProfile,
  hasSeenIntro,
  hasSeenZoomHint,
  loadProfile,
  markIntroSeen,
  markZoomHintSeen,
} from "@/lib/life-clock-storage";
import { buildEvents } from "@/lib/life-events";
import { buildPlaceBands, placeYears, type PlaceBand } from "@/lib/life-places";

import { LifeClockCalibration } from "./calibration";
import { HoverCard, formatEventDate, formatRelative } from "./event-card";
import { LifeClockHud } from "./hud";
import { MarkerIcons, type MarkerIcon } from "./marker-icons";
import {
  buildLayout,
  computeMorphEnvelope,
  computeMorphTransforms,
} from "./layout";
import { LifeClockRenderer } from "./renderer";
import {
  AXIS_LEFT_GUTTER,
  AXIS_TOP_GUTTER,
  IDENTITY_TRANSFORM,
  TOKENS,
  VIEW_DAY,
  VIEW_LIFE,
  VIEW_NAMES,
  VIEW_YEAR,
  EVENT_SYMBOL,
  eventSymbol,
  pulseAlpha,
  type AxisSpec,
  type ClockEvent,
  type EventMarker,
  type HoverCardInfo,
  type HudFrameFields,
  type HudHandle,
  type MorphFrame,
  type Rect,
  type ViewIndex,
  type ViewLayout,
} from "./types";
import { ZoomMachine } from "./zoom";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const HINT_DELAY_MS = 6_000;
const INTRO_DWELL_MS = 500;
const INTRO_DIVE_MS = 1_350;
const AXIS_FADE_TAU_MS = 80;
const EVENT_HOVER_RADIUS_PX = 16;
const EVENT_HOVER_TAU_MS = 90;
const PLACES_FADE_TAU_MS = 140;
// Decay constant for the LIFE-scroll flick inertia (touch phones).
const SCROLL_FLING_TAU_MS = 130;
const MS_PER_DAY = 86_400_000;

const CERTAINTY_LABEL = {
  record: "RECORD",
  estimate: "ESTIMATE",
  probability: "PROBABILITY",
} as const;

interface StageMetrics {
  mobile: boolean;
  axisVisible: boolean;
  gridArea: Rect;
}

// Reserves clear the HUD corner blocks (two lines at the inset) and the
// ladder rail by a few px — the grid takes everything else.
function computeMetrics(w: number, h: number): StageMetrics {
  const mobile = w < 768;
  const axisVisible = w >= 640;
  const top = (mobile ? 46 : 54) + (axisVisible ? AXIS_TOP_GUTTER : 0);
  const bottom = mobile ? 84 : 58;
  const left = (mobile ? 14 : 18) + (axisVisible ? AXIS_LEFT_GUTTER : 0);
  const right = mobile ? 14 : 78;
  return {
    mobile,
    axisVisible,
    gridArea: {
      x: left,
      y: top,
      w: Math.max(40, w - left - right),
      h: Math.max(40, h - top - bottom),
    },
  };
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

interface HudStrings {
  clock: string;
  modeLine: string;
  elapsed: string;
  remaining: string;
  cell: string;
}

function composeStrings(
  view: ViewIndex,
  now: Date,
  profile: LifeProfile | null,
): HudStrings {
  const clock = formatClock(now);
  if (view === VIEW_LIFE && profile) {
    const lp = getLifeProgress(now, profile);
    return {
      clock,
      modeLine: `LIFE · AGE ${lp.ageYears.toFixed(2)}/${lp.expectancyYears.toFixed(2)}`,
      elapsed: formatPercent(lp.fraction, PERCENT_DECIMALS.life),
      remaining: formatLifeRemaining(lp.msRemaining),
      cell: `${fmtInt(lp.weeksLived)}/${fmtInt(lp.totalWeeks)}`,
    };
  }
  if (view === VIEW_YEAR) {
    const yp = getYearProgress(now);
    return {
      clock,
      modeLine: `YEAR · ${isoWeekYear(now)}`,
      elapsed: formatPercent(yp.fraction, PERCENT_DECIMALS.year),
      remaining: formatYearRemaining(yp.remainingSeconds),
      cell: `${yp.dayOfYear}/${yp.daysInYear}`,
    };
  }
  if (view === 1) {
    const wp = getWeekProgress(now);
    const minute = Math.floor(wp.elapsedSeconds / 60);
    return {
      clock,
      modeLine: `WEEK · W${String(isoWeek(now)).padStart(2, "0")} ${isoWeekYear(now)}`,
      elapsed: formatPercent(wp.fraction, PERCENT_DECIMALS.week),
      remaining: formatWeekRemaining(wp.remainingSeconds),
      cell: `${fmtInt(minute + 1)}/${fmtInt(10_080)}`,
    };
  }
  const dp = getDayProgress(now);
  return {
    clock,
    modeLine: `DAY · ${WEEKDAYS[now.getDay()]} ${formatDate(now)}`,
    elapsed: formatPercent(dp.fraction, PERCENT_DECIMALS.day),
    remaining: formatDayRemaining(dp.remainingSeconds),
    cell: `${fmtInt(dp.liveCellIndex + 1)}/${fmtInt(17_280)}`,
  };
}

export function LifeClockLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HudHandle | null>(null);
  // Inner (translated) layer of the marker overlay — moved imperatively with the
  // LIFE scroll, so markers pan with their cells without a per-frame re-render.
  const markerLayerRef = useRef<HTMLDivElement | null>(null);

  const [booted, setBooted] = useState(false);
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [hint, setHint] = useState<"scroll" | "pinch" | null>(null);
  // PLACES overlay on/off. Changes on user action, never per frame.
  const [placesOn, setPlacesOn] = useState(false);
  // Life-event markers as Lucide icons, pinned to their cells. The list + size
  // change only on a layout rebuild; `atRestLife` gates the fade.
  const [markerIcons, setMarkerIcons] = useState<MarkerIcon[]>([]);
  const [iconSize, setIconSize] = useState(16);
  const [atRestLife, setAtRestLife] = useState(false);
  // Hover readout (event or place). Changes on pointer move, not per frame.
  const [hovered, setHovered] = useState<HoverCardInfo | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Only for keeping the event card on screen; updated on resize, not per frame.
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [axisState, setAxisState] = useState<{
    view: ViewIndex;
    axis: AxisSpec;
    gridRect: Rect;
  } | null>(null);
  // Which view's axis content React has actually committed to the DOM — the
  // fade-in gate, so stale graduations never show on the wrong view.
  const axisCommittedRef = useRef<number>(-1);
  useEffect(() => {
    axisCommittedRef.current = axisState?.view ?? -1;
  }, [axisState]);
  // Derived, not state: profile only changes via user action, and the age
  // clamp inside the estimate moves at most daily.
  const expectancyYears = profile
    ? getLifeProgress(new Date(), profile).expectancyYears
    : 81.5;

  const calOpenRef = useRef(calOpen);
  const openCalibrationRef = useRef<() => void>(() => {});
  const zoomRef = useRef<ZoomMachine | null>(null);
  const placesOnRef = useRef(placesOn);
  const togglePlacesRef = useRef<() => void>(() => {});

  // Bands drive the legend; also gate whether the PLACES control is offered.
  const placeBands = useMemo<PlaceBand[]>(
    () => (profile ? buildPlaceBands(profile, new Date()) : []),
    [profile],
  );
  const placesAvailable = placeBands.length > 0;

  useEffect(() => {
    calOpenRef.current = calOpen;
  }, [calOpen]);

  useEffect(() => {
    placesOnRef.current = placesOn;
  }, [placesOn]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    openCalibrationRef.current = () => {
      if (!calOpenRef.current) setCalOpen(true);
    };
  }, []);

  useEffect(() => {
    // Client-only storage hydration: SSR renders the null-profile shell, then
    // the first client effect swaps in the stored profile. With no stored
    // profile the clock shows the author's life rather than prompting.
    /* eslint-disable react-hooks/set-state-in-effect */
    setProfile(loadProfile() ?? DEFAULT_PROFILE);
    setBooted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!booted) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    const reduced = () => motionQuery.matches;

    let metrics = computeMetrics(container.clientWidth, container.clientHeight);
    const layouts: (ViewLayout | null)[] = [null, null, null, null];
    const maxView: ViewIndex = profile ? VIEW_LIFE : VIEW_YEAR;

    // Scrollable LIFE grid: a legible fixed cell size that overflows the area,
    // panned by one finger. Only on touch phones (coarse pointer, narrow) —
    // where the age axis is hidden, so nothing else needs the scroll offset.
    let scrollable = coarseQuery.matches && !metrics.axisVisible;
    // Current 2D pan of the LIFE grid + release inertia, in layout px.
    let scrollX = 0;
    let scrollY = 0;
    let maxScrollX = 0;
    let maxScrollY = 0;
    let flingVX = 0;
    let flingVY = 0;

    const events: ClockEvent[] = profile ? buildEvents(profile, new Date()) : [];
    const eventById = new Map(events.map((e) => [e.id, e]));
    let markers: EventMarker[] = [];

    // Events resolve to cells through the LIFE layout's own index math, so the
    // mapping stays correct across rebuilds (resize, rollover, recalibration).
    // The markers feed the renderer's hover-range lookup; the symbol list (with
    // cell-centre positions) drives the DOM symbol overlay.
    const resolveMarkers = (life: ViewLayout | null) => {
      if (!life?.cellIndexForDate || events.length === 0) {
        markers = [];
        renderer.setEventMarkers(markers);
        setMarkerIcons([]);
        return;
      }
      // -1 when a date falls off the grid — the marker (and its symbol) is then
      // dropped rather than pinned to an edge cell.
      const cellFor = life.cellIndexForDate.bind(life);
      markers = events
        .map((event) => ({
          id: event.id,
          index: cellFor(event.date),
          rangeStart: event.rangeStart ? cellFor(event.rangeStart) : -1,
          rangeEnd: event.rangeEnd ? cellFor(event.rangeEnd) : -1,
        }))
        .filter((marker) => marker.index >= 0);
      renderer.setEventMarkers(markers);
      // Symbols sit at cell centres, sized to the (square) cell; valid to read
      // as screen px only at rest in LIFE, which is exactly when they show.
      // `lived` (event before now) picks the ink so it contrasts with its cell.
      const nowMs = Date.now();
      setIconSize(life.cellW);
      setMarkerIcons(
        markers.map((m) => {
          const c = life.cellRect(m.index);
          const ev = eventById.get(m.id);
          return {
            id: m.id,
            symbol: ev ? eventSymbol(ev) : EVENT_SYMBOL.record,
            lived: ev ? ev.date.getTime() <= nowMs : false,
            x: c.x + c.w / 2,
            y: c.y + c.h / 2,
          };
        }),
      );
    };

    // Places resolve to per-cell tint the same way markers resolve to indices:
    // through the LIFE layout's own date math, recomputed on every rebuild.
    const bands = profile ? buildPlaceBands(profile, new Date()) : [];
    const dobDate = profile ? parseDob(profile.dob, new Date()) : null;
    // cell index → band index (or -1), index-aligned to the LIFE layout, for
    // hover hit-testing. Rebuilt alongside the tint on every layout rebuild.
    let placeCellBand: Int16Array | null = null;
    const onGridIndex = (
      cellFor: (d: Date) => number,
      date: Date,
      dir: 1 | -1,
    ): number => {
      // Nudge day-by-day toward the grid: a band edge before birth / after the
      // expectancy row (or on a ghost week) still resolves to the nearest cell.
      let t = date.getTime();
      for (let k = 0; k < 420; k++) {
        const idx = cellFor(new Date(t));
        if (idx >= 0) return idx;
        t += dir * MS_PER_DAY;
      }
      return -1;
    };
    const resolvePlaceTints = (life: ViewLayout | null) => {
      if (!life?.cellIndexForDate || bands.length === 0) {
        placeCellBand = null;
        renderer.setLifePlaceTints(null);
        return;
      }
      const cellFor = life.cellIndexForDate.bind(life);
      const tints = new Float32Array(life.cellCount * 4);
      const cellBand = new Int16Array(life.cellCount).fill(-1);
      bands.forEach((band, bi) => {
        let i0 = onGridIndex(cellFor, band.start, 1);
        let i1 = onGridIndex(cellFor, band.end, -1);
        if (i0 < 0 || i1 < 0) return;
        if (i1 < i0) [i0, i1] = [i1, i0];
        const [r, g, b] = band.rgb;
        for (let i = i0; i <= i1; i++) {
          const o = i * 4;
          tints[o] = r;
          tints[o + 1] = g;
          tints[o + 2] = b;
          tints[o + 3] = 1;
          cellBand[i] = bi; // a later stay wins the shared boundary week
        }
      });
      placeCellBand = cellBand;
      renderer.setLifePlaceTints(tints);
    };

    const buildAll = (now: Date) => {
      for (let v = 0; v <= maxView; v++) {
        layouts[v] = buildLayout({
          view: v as ViewIndex,
          gridArea: metrics.gridArea,
          now,
          profile: profile ?? undefined,
          scrollable: v === VIEW_LIFE ? scrollable : false,
        });
      }
      for (let v = maxView + 1; v < 4; v++) layouts[v] = null;
      resolveMarkers(layouts[VIEW_LIFE]);
      resolvePlaceTints(layouts[VIEW_LIFE]);
      recomputeScrollBounds();
      resetLifeScroll();
    };

    // The overflow the LIFE grid can be panned across, derived from its (bigger
    // than the area) gridRect. Zero on any axis that already fits.
    const recomputeScrollBounds = () => {
      const life = layouts[VIEW_LIFE];
      if (!scrollable || !life) {
        maxScrollX = 0;
        maxScrollY = 0;
        return;
      }
      const a = metrics.gridArea;
      maxScrollX = Math.max(0, life.gridRect.w - a.w);
      maxScrollY = Math.max(0, life.gridRect.h - a.h);
    };

    const clampScroll = () => {
      scrollX = Math.max(0, Math.min(maxScrollX, scrollX));
      scrollY = Math.max(0, Math.min(maxScrollY, scrollY));
    };

    // Land the LIFE grid centred on "now" (this year's row), so zooming out from
    // YEAR arrives looking at the present rather than at birth.
    const resetLifeScroll = () => {
      flingVX = 0;
      flingVY = 0;
      const life = layouts[VIEW_LIFE];
      if (!scrollable || !life?.slotRect) {
        scrollX = 0;
        scrollY = 0;
        return;
      }
      const a = metrics.gridArea;
      const s = life.slotRect;
      scrollX = s.x + s.w / 2 - (a.x + a.w / 2);
      scrollY = s.y + s.h / 2 - (a.y + a.h / 2);
      clampScroll();
    };

    // Apply a content-space pan delta; hitting a bound kills that axis's fling.
    const applyScroll = (dx: number, dy: number) => {
      const px = scrollX;
      const py = scrollY;
      scrollX += dx;
      scrollY += dy;
      clampScroll();
      if (scrollX === px && dx !== 0) flingVX = 0;
      if (scrollY === py && dy !== 0) flingVY = 0;
    };

    const renderer = new LifeClockRenderer(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setViewport(container.clientWidth, container.clientHeight, dpr);
    renderer.setFrameRect(metrics.gridArea);
    buildAll(new Date());

    let dateKey = new Date().toDateString();
    let lastHour = new Date().getHours();
    let currentChild = -1;
    let currentParent = -1;
    let lastLiveIndex = -1;
    let lastLiveView = -1;
    let commitStartMs = -1;
    let axisOpacity = 1;
    let lastTickKey = -1;
    let lastStringsView: ViewIndex | null = null;
    let strings: HudStrings | null = null;
    let hintTimer: number | undefined;
    let introTimer: number | undefined;
    let rafId = 0;
    let running = false;
    let lastFrameMs = 0;
    let introActive = false;
    let pendingRollover = false;
    let slotClickAtMs = 0;
    let hoveredId: string | null = null;
    // Identity of whatever the card currently shows (event id or place cell),
    // so the card only re-renders when the target actually changes.
    let hoverKey: string | null = null;
    let hoverAmount = 0;
    let placesAmount = 0;
    const transition = { from: -1, to: -1 };

    const restingSlotHit = (clientX: number, clientY: number): boolean => {
      if (!zoom.isAtRest || zoom.restingView === VIEW_DAY) return false;
      const layout = layouts[zoom.restingView];
      const slot = layout?.slotRect;
      if (!slot) return false;
      const rect = container.getBoundingClientRect();
      // The scrollable LIFE grid is shifted on screen by the pan; map the tap
      // back into layout space before testing the slot rect.
      const isLife = zoom.restingView === VIEW_LIFE;
      const x = clientX - rect.left + (isLife ? scrollX : 0);
      const y = clientY - rect.top + (isLife ? scrollY : 0);
      return (
        x >= slot.x && x <= slot.x + slot.w && y >= slot.y && y <= slot.y + slot.h
      );
    };

    const armHint = () => {
      window.clearTimeout(hintTimer);
      if (hasSeenZoomHint() || calOpenRef.current) return;
      hintTimer = window.setTimeout(() => {
        if (zoom.isAtRest && zoom.restingView === VIEW_DAY && !calOpenRef.current) {
          setHint(coarseQuery.matches ? "pinch" : "scroll");
        }
      }, HINT_DELAY_MS);
    };

    const syncAxis = () => {
      const layout = layouts[zoom.restingView];
      if (layout && metrics.axisVisible) {
        const active = layout.activeAxis(new Date());
        setAxisState({
          view: zoom.restingView,
          axis: {
            ...layout.axis,
            activeLeft: active.left,
            activeTop: active.top,
          },
          gridRect: layout.gridRect,
        });
      } else {
        setAxisState(null);
      }
    };

    const zoom: ZoomMachine = new ZoomMachine(
      {
        onFrame: () => {},
        onTransitionStart: (from, to) => {
          transition.from = from;
          transition.to = to;
          // Icons fade with the grid; a morph is starting, so leave rest-LIFE.
          setAtRestLife(false);
          if (hoveredId !== null || hoverKey !== null) {
            hoveredId = null;
            hoverKey = null;
            setHovered(null);
          }
          setHint(null);
          window.clearTimeout(hintTimer);
          // The hint is consumed by USER zooms only — not the intro dive.
          if (!introActive && !hasSeenZoomHint()) markZoomHintSeen();
        },
        onRest: () => {
          introActive = false;
          transition.from = -1;
          transition.to = -1;
          if (pendingRollover) {
            pendingRollover = false;
            dateKey = new Date().toDateString();
            buildAll(new Date());
            currentChild = -1;
            currentParent = -1;
            clearHover();
          }
          syncAxis();
          // Icons appear once settled in LIFE, and fade otherwise.
          const inLife = zoom.restingView === VIEW_LIFE;
          if (inLife) resetLifeScroll();
          setAtRestLife(inLife);
          if (zoom.restingView === VIEW_DAY) armHint();
        },
        onLimit: (dir) => {
          hudRef.current?.limitDip(dir === -1 ? VIEW_DAY : VIEW_LIFE);
        },
      },
      {
        enabled: () => !calOpenRef.current,
        reducedMotion: reduced,
        maxView: () => maxView,
        // Recent slot clicks also suppress dblclick zoom (double-step guard).
        inSlot: (x, y) =>
          restingSlotHit(x, y) || Date.now() - slotClickAtMs < 400,
        pan: {
          active: () =>
            scrollable &&
            !calOpenRef.current &&
            zoom.isAtRest &&
            zoom.restingView === VIEW_LIFE &&
            (maxScrollX > 0 || maxScrollY > 0),
          by: (dx, dy) => {
            flingVX = 0;
            flingVY = 0;
            applyScroll(dx, dy);
          },
          end: (vx, vy) => {
            flingVX = vx;
            flingVY = vy;
          },
        },
      },
    );
    zoom.attach(canvas);
    zoomRef.current = zoom;

    // Toggling PLACES on carries the view to LIFE (where the bands live); the
    // ref lets the imperative frame loop read the state without a re-render.
    const togglePlaces = () => {
      if (bands.length === 0) return;
      const turningOn = !placesOnRef.current;
      placesOnRef.current = turningOn;
      setPlacesOn(turningOn);
      if (turningOn && !(zoom.isAtRest && zoom.restingView === VIEW_LIFE)) {
        zoom.jumpTo(VIEW_LIFE, Date.now());
      }
    };
    togglePlacesRef.current = togglePlaces;

    // First-run choreography: dive LIFE → DAY once, then always mount at DAY.
    if (profile && !hasSeenIntro()) {
      markIntroSeen();
      if (reduced()) {
        zoom.snapTo(VIEW_DAY);
      } else {
        zoom.snapTo(VIEW_LIFE);
        introTimer = window.setTimeout(() => {
          introActive = true;
          zoom.jumpTo(VIEW_DAY, Date.now(), INTRO_DIVE_MS);
        }, INTRO_DWELL_MS);
      }
    } else {
      zoom.snapTo(VIEW_DAY);
    }

    const onSlotClick = (e: MouseEvent) => {
      if (calOpenRef.current) return;
      if (restingSlotHit(e.clientX, e.clientY)) {
        slotClickAtMs = Date.now();
        zoom.stepIn(slotClickAtMs);
      }
    };
    // Event markers are hit-tested in layout px: at rest in LIFE the layer
    // transform is identity, so a cell centre is already its screen position.
    const eventHitTest = (clientX: number, clientY: number) => {
      if (!zoom.isAtRest || zoom.restingView !== VIEW_LIFE) return null;
      const life = layouts[VIEW_LIFE];
      if (!life || markers.length === 0) return null;
      const rect = container.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      let best: { event: ClockEvent; x: number; y: number; id: string } | null =
        null;
      let bestDist = EVENT_HOVER_RADIUS_PX;
      for (const marker of markers) {
        if (marker.index < 0) continue;
        const event = eventById.get(marker.id);
        if (!event) continue;
        const cell = life.cellRect(marker.index);
        const cx = cell.x + cell.w / 2;
        const cy = cell.y + cell.h / 2;
        const dist = Math.hypot(px - cx, py - cy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { event, x: cx, y: cy, id: marker.id };
        }
      }
      return best;
    };

    // Which place band a cell in the LIFE grid belongs to, by hit-testing the
    // pointer against cell rects (identity transform at rest in LIFE). Only
    // cells inside a band return a hit — future/empty cells read as null.
    const placeHitTest = (clientX: number, clientY: number) => {
      if (!placesOnRef.current) return null;
      if (!zoom.isAtRest || zoom.restingView !== VIEW_LIFE) return null;
      const life = layouts[VIEW_LIFE];
      if (!life || !placeCellBand) return null;
      const rect = container.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      for (let i = 0; i < life.cellCount; i++) {
        const c = life.cellRect(i);
        if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) {
          const bi = placeCellBand[i];
          if (bi < 0) return null;
          return {
            band: bands[bi],
            cellIndex: i,
            x: c.x + c.w / 2,
            y: c.y + c.h / 2,
          };
        }
      }
      return null;
    };

    const eventInfo = (
      hit: NonNullable<ReturnType<typeof eventHitTest>>,
    ): HoverCardInfo => {
      const e = hit.event;
      return {
        key: `event:${e.id}`,
        // Monochrome to match the icons — the kind label and shape carry the
        // meaning, not a colour.
        swatch: TOKENS.text,
        hollow: e.crossroad === true,
        kind: e.crossroad ? "CROSSROAD" : CERTAINTY_LABEL[e.certainty],
        dateLine: `${formatEventDate(e.date)} · ${formatRelative(e.date, new Date())}`,
        title: e.label,
        detail: e.detail,
        basis: e.basis,
        x: hit.x,
        y: hit.y,
      };
    };

    const placeInfo = (
      hit: NonNullable<ReturnType<typeof placeHitTest>>,
    ): HoverCardInfo => {
      const { band } = hit;
      const now = new Date();
      const durMs = band.end.getTime() - band.start.getTime();
      const durYears = Math.round(durMs / MS_PER_YEAR);
      const span =
        durYears >= 1
          ? `${durYears} YR`
          : `${Math.max(1, Math.round(durMs / (MS_PER_DAY * 30)))} MO`;
      const ageAt = (d: Date) =>
        dobDate
          ? Math.max(0, Math.floor((d.getTime() - dobDate.getTime()) / MS_PER_YEAR))
          : null;
      const a0 = ageAt(band.start);
      const a1 = ageAt(band.ongoing ? now : band.end);
      const detail =
        a0 === null || a1 === null
          ? band.ongoing
            ? "Where I live now."
            : "Where I lived."
          : band.ongoing
            ? `From age ${a0} to now — still here.`
            : `From age ${a0} to ${a1}.`;
      return {
        key: `place:${hit.cellIndex}`,
        swatch: band.hex,
        hollow: true,
        kind: "PLACE",
        dateLine: `${placeYears(band)} · ${span}`,
        title: band.label,
        detail,
        basis: "WHERE I'VE LIVED",
        x: hit.x,
        y: hit.y,
      };
    };

    // Single entry point for the card + range highlight. `markerId` drives the
    // renderer's range lift (events only); places pass null. Gated on identity
    // so it only re-renders React when the target actually changes.
    const applyHover = (info: HoverCardInfo | null, markerId: string | null) => {
      const key = info ? info.key : null;
      if (key === hoverKey && markerId === hoveredId) return;
      hoverKey = key;
      hoveredId = markerId;
      setHovered(info);
    };
    // A layout rebuild invalidates the hovered target's pixel position; drop
    // the card until the pointer re-establishes a hit.
    const clearHover = () => applyHover(null, null);

    const onPointerMove = (e: PointerEvent) => {
      // Hover is a pointer affordance; on touch a drag pans the grid instead.
      if (e.pointerType === "touch") return;
      const evHit = eventHitTest(e.clientX, e.clientY);
      if (evHit) {
        applyHover(eventInfo(evHit), evHit.id);
        canvas.style.cursor = "pointer";
        return;
      }
      const plHit = placeHitTest(e.clientX, e.clientY);
      if (plHit) {
        applyHover(placeInfo(plHit), null);
        canvas.style.cursor = "default";
        return;
      }
      clearHover();
      canvas.style.cursor = restingSlotHit(e.clientX, e.clientY)
        ? "pointer"
        : "default";
    };
    const onPointerLeave = () => clearHover();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (calOpenRef.current) return;
      if (e.key === "c" || e.key === "C") openCalibrationRef.current();
      if (e.key === "p" || e.key === "P") togglePlaces();
    };
    canvas.addEventListener("click", onSlotClick);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);

    const frame = () => {
      rafId = requestAnimationFrame(frame);
      const nowMs = Date.now();
      const dt = lastFrameMs > 0 ? nowMs - lastFrameMs : 16;
      lastFrameMs = nowMs;
      const now = new Date(nowMs);

      if (now.toDateString() !== dateKey) {
        // A boundary mid-transition finishes with the stale slot rect; the
        // rebuild happens at rest (interaction spec §5 rollover rule).
        if (zoom.isAtRest) {
          dateKey = now.toDateString();
          buildAll(now);
          currentChild = -1;
          currentParent = -1;
          clearHover();
          syncAxis();
        } else {
          pendingRollover = true;
        }
      }

      zoom.tick(nowMs);
      const viewPos = zoom.viewPos;
      const lower = Math.min(3, Math.max(0, Math.floor(viewPos))) as ViewIndex;
      const upper = Math.min(3, lower + 1) as ViewIndex;
      const p = viewPos - lower;
      const morphing = p > 0.0005 && layouts[upper] !== null;
      const isReduced = reduced();

      // LIFE scroll flick inertia — glide the pan after release while resting in
      // the scrollable grid; any other state cancels leftover velocity.
      if (scrollable && !morphing && zoom.restingView === VIEW_LIFE) {
        if (flingVX !== 0 || flingVY !== 0) {
          applyScroll(flingVX * dt, flingVY * dt);
          const decay = Math.exp(-dt / SCROLL_FLING_TAU_MS);
          flingVX *= decay;
          flingVY *= decay;
          if (Math.abs(flingVX) < 0.003) flingVX = 0;
          if (Math.abs(flingVY) < 0.003) flingVY = 0;
        }
      } else {
        flingVX = 0;
        flingVY = 0;
      }

      // Reduced motion crossfades DIRECTLY between the transition's endpoints
      // — chained jumps must not flash intermediate views.
      let renderChild: number = lower;
      let renderParent: number = morphing ? upper : -1;
      let crossP = p;
      if (
        isReduced &&
        morphing &&
        transition.from >= 0 &&
        transition.to >= 0 &&
        layouts[transition.from] &&
        layouts[transition.to]
      ) {
        renderChild = transition.from;
        renderParent = transition.to;
        crossP = Math.min(
          1,
          Math.abs(viewPos - transition.from) /
            (Math.abs(transition.to - transition.from) || 1),
        );
      }

      if (renderChild !== currentChild) {
        renderer.setLayer("child", layouts[renderChild]);
        currentChild = renderChild;
      }
      if (renderParent !== currentParent) {
        renderer.setLayer(
          "parent",
          renderParent >= 0 ? layouts[renderParent] : null,
        );
        currentParent = renderParent;
      }

      const childLayout = layouts[renderChild];
      if (!childLayout) return;
      // First-run calibration renders over the EMPTY grid — the machine
      // visibly exists but isn't running yet.
      const preboot = profile === null && calOpenRef.current;
      const childLive = preboot
        ? { index: -1, frac: 0, filled: 0 }
        : childLayout.liveState(now);

      // Commit flash: the just-finished cell, tracked per resting view.
      if (!morphing) {
        if (lastLiveView === lower && childLive.index > lastLiveIndex) {
          commitStartMs = nowMs;
        }
        lastLiveView = lower;
        lastLiveIndex = childLive.index;
      }
      const commitAge =
        commitStartMs >= 0 && nowMs - commitStartMs < 350
          ? (nowMs - commitStartMs) / 1000
          : -1;

      const pulse = preboot
        ? 0
        : isReduced
          ? 0.65
          : pulseAlpha((nowMs % 1000) / 1000);

      hoverAmount +=
        ((hoveredId ? 1 : 0) - hoverAmount) *
        Math.min(1, dt / EVENT_HOVER_TAU_MS);
      const lifeShown = renderChild === VIEW_LIFE || renderParent === VIEW_LIFE;
      const eventsFrame =
        lifeShown && markers.length > 0
          ? { markers, hoveredId, hoverAmount }
          : null;

      // Places overlay only reads on the LIFE grid; ease it out on the way in
      // and out so toggling (or zooming away) crossfades rather than snaps.
      const placesTarget = placesOnRef.current && lifeShown ? 1 : 0;
      placesAmount +=
        (placesTarget - placesAmount) * Math.min(1, dt / PLACES_FADE_TAU_MS);
      if (Math.abs(placesTarget - placesAmount) < 0.005) placesAmount = placesTarget;

      let morphFrame: MorphFrame;
      if (!morphing) {
        morphFrame = {
          child: {
            transform: IDENTITY_TRANSFORM,
            opacity: 1,
            live: childLive,
          },
          parent: null,
          slotOutlineOpacity: 0,
          pulseAlpha: pulse,
          commitAge,
          rubberScale: zoom.rubberScale,
          reducedMotion: isReduced,
          events: eventsFrame,
          placesAmount,
        };
      } else {
        const parentLayout = layouts[renderParent]!;
        const parentLive = parentLayout.liveState(now);
        if (isReduced) {
          morphFrame = {
            child: {
              transform: IDENTITY_TRANSFORM,
              opacity: 1 - crossP,
              live: childLive,
            },
            parent: {
              transform: IDENTITY_TRANSFORM,
              opacity: crossP,
              slotInteriorOpacity: crossP,
              live: parentLive,
            },
            slotOutlineOpacity: 0,
            pulseAlpha: pulse,
            commitAge: -1,
            rubberScale: 1,
            reducedMotion: true,
            events: eventsFrame,
            placesAmount,
          };
        } else {
          const env = computeMorphEnvelope(p);
          const transforms = computeMorphTransforms(
            childLayout,
            parentLayout,
            metrics.gridArea,
            p,
          );
          morphFrame = {
            child: {
              transform: transforms.child,
              opacity: env.childOpacity,
              live: childLive,
            },
            parent: {
              transform: transforms.parent,
              opacity: env.parentOpacity,
              slotInteriorOpacity: env.slotInteriorOpacity,
              live: parentLive,
            },
            slotOutlineOpacity: env.slotOutlineOpacity,
            pulseAlpha: pulse,
            commitAge: -1,
            rubberScale: 1,
            reducedMotion: false,
            events: eventsFrame,
            placesAmount,
          };
        }
      }
      // 2D pan of the scrollable LIFE grid: shift whichever layer holds LIFE by
      // the scroll offset in SCREEN space, so the stage frame stays put and
      // clips. LIFE is the child at rest and the parent mid-morph; the shift
      // eases out with `p` as it dives into a slot. The frame border, drawn in
      // the fixed line layer, is unaffected.
      if (scrollable) {
        const lifeInvolved =
          renderChild === VIEW_LIFE || renderParent === VIEW_LIFE;
        renderer.setClip(lifeInvolved ? metrics.gridArea : null);
        const shift =
          renderChild === VIEW_LIFE ? 1 : renderParent === VIEW_LIFE ? p : 0;
        const sx = scrollX * shift;
        const sy = scrollY * shift;
        if (sx !== 0 || sy !== 0) {
          if (morphFrame.child) {
            const t = morphFrame.child.transform;
            morphFrame.child = {
              ...morphFrame.child,
              transform: { ...t, offsetX: t.offsetX - sx, offsetY: t.offsetY - sy },
            };
          }
          if (morphFrame.parent) {
            const t = morphFrame.parent.transform;
            morphFrame.parent = {
              ...morphFrame.parent,
              transform: { ...t, offsetX: t.offsetX - sx, offsetY: t.offsetY - sy },
            };
          }
        }
        if (markerLayerRef.current) {
          markerLayerRef.current.style.transform = `translate(${-sx}px, ${-sy}px)`;
        }
      } else {
        renderer.setClip(null);
      }
      renderer.drawFrame(morphFrame);

      // HUD: strings recompute at 1 Hz (or on view change); per-frame fields
      // flow through the imperative handle only.
      const nearest = Math.round(viewPos) as ViewIndex;
      const tickKey = Math.floor(nowMs / 1000);
      if (
        strings === null ||
        tickKey !== lastTickKey ||
        nearest !== lastStringsView
      ) {
        strings = composeStrings(nearest, now, profile);
        lastTickKey = tickKey;
        lastStringsView = nearest;
        // The DAY axis highlight moves hourly; refresh the axis DOM then.
        if (now.getHours() !== lastHour) {
          lastHour = now.getHours();
          if (zoom.isAtRest) syncAxis();
        }
      }
      const axisTarget =
        !morphing && axisCommittedRef.current === lower ? 1 : 0;
      axisOpacity +=
        (axisTarget - axisOpacity) * Math.min(1, dt / AXIS_FADE_TAU_MS);
      if (Math.abs(axisTarget - axisOpacity) < 0.01) axisOpacity = axisTarget;

      const fields: HudFrameFields = {
        ...strings,
        ladderPos: viewPos,
        dotAlpha: pulse,
        nearestView: nearest,
        axisOpacity,
      };
      hudRef.current?.update(fields);
    };

    const start = () => {
      if (running) return;
      running = true;
      lastFrameMs = 0;
      rafId = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        lastTickKey = -1; // drop memos; wake-from-sleep recomputes honestly
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 2 || h < 2) return;
      setViewport({ w, h });
      metrics = computeMetrics(w, h);
      scrollable = coarseQuery.matches && !metrics.axisVisible;
      renderer.setViewport(w, h, Math.min(window.devicePixelRatio || 1, 2));
      renderer.setFrameRect(metrics.gridArea);
      buildAll(new Date());
      currentChild = -1;
      currentParent = -1;
      clearHover();
      syncAxis();
    });
    resizeObserver.observe(container);

    // A DPR change without a resize (window dragged between monitors, browser
    // zoom) must re-snap buffers to the new device-pixel grid.
    let dprQuery: MediaQueryList | null = null;
    const onDprChange = () => {
      renderer.setViewport(
        container.clientWidth,
        container.clientHeight,
        Math.min(window.devicePixelRatio || 1, 2),
      );
      currentChild = -1;
      currentParent = -1;
      armDprWatch();
    };
    const armDprWatch = () => {
      dprQuery?.removeEventListener("change", onDprChange);
      dprQuery = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      dprQuery.addEventListener("change", onDprChange);
    };
    armDprWatch();

    syncAxis();
    armHint();
    start();

    return () => {
      stop();
      window.clearTimeout(hintTimer);
      window.clearTimeout(introTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("click", onSlotClick);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      resizeObserver.disconnect();
      dprQuery?.removeEventListener("change", onDprChange);
      if (zoomRef.current === zoom) zoomRef.current = null;
      zoom.detach();
      renderer.dispose();
    };
  }, [booted, profile]);

  const isAuthor = profile === null || profile.author === true;
  const hoveredEventId =
    hovered && hovered.key.startsWith("event:") ? hovered.key.slice(6) : null;
  // The stage rect for clipping the marker overlay — derived from the viewport,
  // matching the renderer's frame rect.
  const stageGridArea = useMemo(
    () => computeMetrics(Math.max(1, viewport.w), Math.max(1, viewport.h)).gridArea,
    [viewport.w, viewport.h],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-[100dvh] w-full overflow-hidden overscroll-none"
      style={{ backgroundColor: TOKENS.bg }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        aria-label={`Life Clock — zoomable time grid. Views: ${VIEW_NAMES.join(", ")}.`}
      />
      <div
        // inert while the calibration dialog is open: opacity/pointer-events
        // alone leave invisible controls in the tab order.
        inert={calOpen}
        style={{
          opacity: calOpen ? 0 : 1,
          transition: "opacity 200ms linear",
          pointerEvents: calOpen ? "none" : undefined,
        }}
      >
        <LifeClockHud
          ref={hudRef}
          axis={axisState?.axis ?? null}
          gridRect={axisState?.gridRect ?? null}
          expectancyYears={expectancyYears}
          mode={isAuthor ? "author" : "custom"}
          hint={hint}
          placesAvailable={placesAvailable}
          placesOn={placesOn}
          onTogglePlaces={() => togglePlacesRef.current()}
          onSelectView={(view) => {
            if (!calOpenRef.current) {
              zoomRef.current?.jumpTo(view, Date.now());
            }
          }}
          onCalibrate={() => openCalibrationRef.current()}
        />
        <MarkerIcons
          icons={markerIcons}
          size={iconSize}
          visible={atRestLife}
          hoveredId={hoveredEventId}
          reducedMotion={reducedMotion}
          clip={stageGridArea}
          innerRef={markerLayerRef}
        />
        <HoverCard
          info={hovered}
          viewportW={viewport.w}
          viewportH={viewport.h}
          reducedMotion={reducedMotion}
        />
      </div>
      {booted && calOpen ? (
        <LifeClockCalibration
          // Author mode maps a fresh life; custom mode edits the stored one.
          profile={isAuthor ? null : profile}
          onComplete={(next) => {
            // A recalibration lands back at DAY; the overlay (which may no
            // longer have places) starts off.
            setPlacesOn(false);
            setProfile(next);
            setCalOpen(false);
          }}
          onCancel={() => setCalOpen(false)}
          onReset={
            isAuthor
              ? undefined
              : () => {
                  clearProfile();
                  setPlacesOn(false);
                  setProfile(DEFAULT_PROFILE);
                  setCalOpen(false);
                }
          }
        />
      ) : null}
    </div>
  );
}
