"use client";

import { useEffect, useRef, useState } from "react";

import {
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
  type LifeProfile,
} from "@/lib/life-clock";
import {
  hasSeenIntro,
  hasSeenZoomHint,
  loadProfile,
  markIntroSeen,
  markZoomHintSeen,
} from "@/lib/life-clock-storage";

import { LifeClockCalibration } from "./calibration";
import { LifeClockHud } from "./hud";
import {
  buildLayout,
  computeMorphEnvelope,
  computeMorphTransforms,
} from "./layout";
import { LifeClockRenderer } from "./renderer";
import {
  IDENTITY_TRANSFORM,
  TOKENS,
  VIEW_DAY,
  VIEW_LIFE,
  VIEW_NAMES,
  VIEW_YEAR,
  pulseAlpha,
  type AxisSpec,
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

interface StageMetrics {
  mobile: boolean;
  axisVisible: boolean;
  gridArea: Rect;
}

function computeMetrics(w: number, h: number): StageMetrics {
  const mobile = w < 768;
  const axisVisible = w >= 640;
  const top = (mobile ? 56 : 64) + (axisVisible ? 24 : 0);
  const bottom = mobile ? 88 : 64;
  const left = (mobile ? 16 : 32) + (axisVisible ? 40 : 0);
  const right = mobile ? 16 : 88;
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

  const [booted, setBooted] = useState(false);
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calEdit, setCalEdit] = useState(false);
  const [hint, setHint] = useState<"scroll" | "pinch" | null>(null);
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

  useEffect(() => {
    calOpenRef.current = calOpen;
  }, [calOpen]);

  useEffect(() => {
    openCalibrationRef.current = () => {
      if (!calOpenRef.current && profile) {
        setCalEdit(true);
        setCalOpen(true);
      }
    };
  }, [profile]);

  useEffect(() => {
    // Client-only storage hydration: SSR renders the null-profile shell, then
    // the first client effect swaps in the stored profile (two-pass render).
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = loadProfile();
    setProfile(stored);
    setCalOpen(stored === null);
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

    const buildAll = (now: Date) => {
      for (let v = 0; v <= maxView; v++) {
        layouts[v] = buildLayout({
          view: v as ViewIndex,
          gridArea: metrics.gridArea,
          now,
          profile: profile ?? undefined,
        });
      }
      for (let v = maxView + 1; v < 4; v++) layouts[v] = null;
    };
    buildAll(new Date());

    const renderer = new LifeClockRenderer(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setViewport(container.clientWidth, container.clientHeight, dpr);
    renderer.setFrameRect(metrics.gridArea);

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
    const transition = { from: -1, to: -1 };

    const restingSlotHit = (clientX: number, clientY: number): boolean => {
      if (!zoom.isAtRest || zoom.restingView === VIEW_DAY) return false;
      const layout = layouts[zoom.restingView];
      const slot = layout?.slotRect;
      if (!slot) return false;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
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

    const zoom = new ZoomMachine(
      {
        onFrame: () => {},
        onTransitionStart: (from, to) => {
          transition.from = from;
          transition.to = to;
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
          }
          syncAxis();
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
      },
    );
    zoom.attach(canvas);
    zoomRef.current = zoom;

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
    const onPointerMove = (e: PointerEvent) => {
      canvas.style.cursor = restingSlotHit(e.clientX, e.clientY)
        ? "pointer"
        : "default";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (calOpenRef.current) return;
      if (e.key === "c" || e.key === "C") openCalibrationRef.current();
    };
    canvas.addEventListener("click", onSlotClick);
    canvas.addEventListener("pointermove", onPointerMove);
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
          };
        }
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
      metrics = computeMetrics(w, h);
      renderer.setViewport(w, h, Math.min(window.devicePixelRatio || 1, 2));
      renderer.setFrameRect(metrics.gridArea);
      buildAll(new Date());
      currentChild = -1;
      currentParent = -1;
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
      window.removeEventListener("keydown", onKeyDown);
      resizeObserver.disconnect();
      dprQuery?.removeEventListener("change", onDprChange);
      if (zoomRef.current === zoom) zoomRef.current = null;
      zoom.detach();
      renderer.dispose();
    };
  }, [booted, profile]);

  const hudHidden = calOpen && !calEdit;

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
          opacity: hudHidden ? 0 : 1,
          transition: "opacity 200ms linear",
          pointerEvents: hudHidden ? "none" : undefined,
        }}
      >
        <LifeClockHud
          ref={hudRef}
          axis={axisState?.axis ?? null}
          gridRect={axisState?.gridRect ?? null}
          expectancyYears={expectancyYears}
          demo={profile?.demo ?? false}
          hint={hint}
          onSelectView={(view) => {
            if (!calOpenRef.current) {
              zoomRef.current?.jumpTo(view, Date.now());
            }
          }}
          onCalibrate={() => openCalibrationRef.current()}
        />
      </div>
      {booted && calOpen ? (
        <LifeClockCalibration
          profile={profile}
          editMode={calEdit}
          onComplete={(next) => {
            setProfile(next);
            setCalOpen(false);
            setCalEdit(false);
          }}
          onCancel={
            calEdit
              ? () => {
                  setCalOpen(false);
                  setCalEdit(false);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
