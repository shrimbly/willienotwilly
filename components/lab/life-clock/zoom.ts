// Zoom state machine: detented views driven by a continuous charge
// accumulator (wheel / pinch / keys), with pre-commit lean, reversible
// transitions, chained jumps, and rubber-banding at the ladder ends.
// Pure logic + input binding — no three.js, no React.

import type { ViewIndex, ZoomCallbacks } from "./types";
import { VIEW_DAY, VIEW_LIFE } from "./types";

const LEAN_MAX = 0.08; // morph-progress preview at |charge| = 1
const COMMIT_CHARGE = 1;
const TOUCH_RELEASE_COMMIT = 0.55;
const IDLE_DECAY_DELAY_MS = 90;
const IDLE_DECAY_TAU_MS = 140;
const POST_COMMIT_GATE_MS = 250;
const POST_COMMIT_GAIN = 0.25;
const LIMIT_GAIN = 0.35;
const STEP_MS = 600;
const CHAIN_MS_PER_LEG = 450;
const REVERSE_MS_PER_P = 300;
const REDUCED_MS = 160;

/** Solve a CSS cubic-bezier timing function numerically. */
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const sampleX = (t: number) =>
    3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t;
  const sampleY = (t: number) =>
    3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-5) break;
      if (err > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

const EASE_STEP = cubicBezier(0.65, 0, 0.35, 1);
const EASE_CHAIN = cubicBezier(0.6, 0, 0.3, 1);
const EASE_REVERSE = cubicBezier(0.33, 1, 0.68, 1);
const EASE_LINEAR = (t: number) => t;

interface Anim {
  fromPos: number;
  toPos: number;
  startMs: number;
  durMs: number;
  ease: (t: number) => number;
}

/**
 * One-finger drag panning (the scrollable LIFE grid on phones). When `active`
 * returns true a single touch drags the content instead of doing nothing;
 * two-finger pinch still drives the view ladder. `by` receives the incremental
 * CONTENT delta (finger up ⇒ positive dy ⇒ scroll toward later years); `end`
 * receives the release velocity in px/ms for inertia.
 */
export interface ZoomPanOptions {
  active: () => boolean;
  by: (dx: number, dy: number) => void;
  end?: (vx: number, vy: number) => void;
}

export interface ZoomMachineOptions {
  /** Inputs are ignored while this returns false (e.g. calibration open). */
  enabled: () => boolean;
  reducedMotion: () => boolean;
  /** Highest reachable view (2 while no profile exists, else 3). */
  maxView: () => ViewIndex;
  /** Double-click zoom is suppressed when the point sits in the slot marker. */
  inSlot?: (x: number, y: number) => boolean;
  /** One-finger drag panning for the scrollable LIFE grid. */
  pan?: ZoomPanOptions;
}

export class ZoomMachine {
  private cb: ZoomCallbacks;
  private opts: ZoomMachineOptions;

  private restView: number = VIEW_DAY;
  private pos: number = VIEW_DAY;
  private charge = 0;
  private lastInputMs = 0;
  private lastTickMs = 0;
  private postCommitUntilMs = 0;
  private anim: Anim | null = null;
  private queuedDir: -1 | 0 | 1 = 0;

  private el: HTMLElement | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStartDist = 0;
  private pinchActive = false;
  private pinchStartMs = 0;
  private pinchPeak = 0;
  // Safari trackpad pinch arrives as proprietary gesture* events.
  private gestureActive = false;
  private gestureBaseScale = 1;
  // One-finger pan (scrollable LIFE grid).
  private panning = false;
  private panLastX = 0;
  private panLastY = 0;
  private panLastMs = 0;
  private panVX = 0;
  private panVY = 0;

  constructor(callbacks: ZoomCallbacks, opts: ZoomMachineOptions) {
    this.cb = callbacks;
    this.opts = opts;
  }

  get viewPos(): number {
    return this.pos;
  }

  get restingView(): ViewIndex {
    return this.restView as ViewIndex;
  }

  get isAtRest(): boolean {
    return this.anim === null && this.charge === 0;
  }

  /** Rubber-band scale: 1 ± 0.03 while leaning past a ladder end. */
  get rubberScale(): number {
    if (this.anim || this.opts.reducedMotion()) return 1;
    const overIn = this.restView === VIEW_DAY && this.charge > 0;
    const overOut = this.restView >= this.opts.maxView() && this.charge < 0;
    if (overIn) return 1 + 0.03 * Math.min(this.charge, 1);
    if (overOut) return 1 - 0.03 * Math.min(-this.charge, 1);
    return 1;
  }

  /** Instant placement with no animation (mount, reduced-motion intro). */
  snapTo(view: ViewIndex): void {
    this.anim = null;
    this.charge = 0;
    this.queuedDir = 0;
    this.restView = view;
    this.pos = view;
    this.cb.onRest(view);
  }

  /** Animate to an arbitrary view; chained multi-leg timing. */
  jumpTo(view: ViewIndex, nowMs: number, durMs?: number): void {
    const target = Math.min(view, this.opts.maxView());
    if (this.anim === null && target === this.restView) return;
    const legs = Math.abs(target - this.pos);
    if (legs === 0) return;
    const reduced = this.opts.reducedMotion();
    this.charge = 0;
    this.queuedDir = 0;
    this.anim = {
      fromPos: this.pos,
      toPos: target,
      startMs: nowMs,
      durMs: reduced ? REDUCED_MS : (durMs ?? CHAIN_MS_PER_LEG * legs),
      ease: reduced ? EASE_LINEAR : EASE_CHAIN,
    };
    this.cb.onTransitionStart(
      Math.round(this.pos) as ViewIndex,
      target as ViewIndex,
    );
  }

  stepIn(nowMs: number): void {
    this.stepBy(-1, nowMs);
  }

  stepOut(nowMs: number): void {
    this.stepBy(1, nowMs);
  }

  private stepBy(dir: -1 | 1, nowMs: number): void {
    if (this.anim) {
      // One queued leg max (R9); same direction extends, opposite reverses.
      const animDir = Math.sign(this.anim.toPos - this.anim.fromPos);
      if (dir === animDir) this.queuedDir = dir;
      else this.reverse(nowMs);
      return;
    }
    const target = this.restView + dir;
    if (target < VIEW_DAY || target > this.opts.maxView()) {
      this.cb.onLimit?.(dir);
      return;
    }
    this.commitTo(target as ViewIndex, nowMs, STEP_MS);
  }

  private commitTo(target: ViewIndex, nowMs: number, baseMs: number): void {
    const reduced = this.opts.reducedMotion();
    const from = Math.round(this.pos) as ViewIndex;
    const p0 = Math.abs(this.pos - this.restView);
    this.charge = 0;
    this.postCommitUntilMs = nowMs + POST_COMMIT_GATE_MS;
    this.anim = {
      fromPos: this.pos,
      toPos: target,
      startMs: nowMs,
      durMs: reduced ? REDUCED_MS : Math.max(120, baseMs * (1 - p0)),
      ease: reduced ? EASE_LINEAR : EASE_STEP,
    };
    this.cb.onTransitionStart(from, target);
  }

  private reverse(nowMs: number): void {
    if (!this.anim) return;
    const origin = this.anim.fromPos;
    const back = Math.round(origin);
    const p = Math.abs(this.pos - back);
    this.anim = {
      fromPos: this.pos,
      toPos: back,
      startMs: nowMs,
      durMs: this.opts.reducedMotion()
        ? REDUCED_MS
        : Math.max(80, REVERSE_MS_PER_P * p),
      ease: this.opts.reducedMotion() ? EASE_LINEAR : EASE_REVERSE,
    };
    this.queuedDir = 0;
  }

  /** Advance the machine; call once per rAF. */
  tick(nowMs: number): void {
    const dt = this.lastTickMs > 0 ? nowMs - this.lastTickMs : 16;
    this.lastTickMs = nowMs;

    if (this.anim) {
      const a = this.anim;
      const u = Math.min(1, (nowMs - a.startMs) / a.durMs);
      this.pos = a.fromPos + (a.toPos - a.fromPos) * a.ease(u);
      if (u >= 1) {
        this.pos = a.toPos;
        this.restView = Math.round(a.toPos);
        this.anim = null;
        const queued = this.queuedDir;
        this.queuedDir = 0;
        if (queued !== 0) {
          const next = this.restView + queued;
          if (next >= VIEW_DAY && next <= this.opts.maxView()) {
            this.commitTo(next as ViewIndex, nowMs, STEP_MS);
          }
        }
        if (!this.anim) this.cb.onRest(this.restView as ViewIndex);
      }
    } else {
      if (
        this.charge !== 0 &&
        !this.pinchActive &&
        !this.gestureActive &&
        nowMs - this.lastInputMs > IDLE_DECAY_DELAY_MS
      ) {
        this.charge *= Math.exp(-dt / IDLE_DECAY_TAU_MS);
        if (Math.abs(this.charge) < 0.01) this.charge = 0;
      }
      this.pos = this.leanedPos();
    }

    this.cb.onFrame(this.pos, this.rubberScale);
  }

  private leanedPos(): number {
    if (this.opts.reducedMotion()) return this.restView;
    // charge > 0 = zoom in = toward DAY (lower index).
    const lean = LEAN_MAX * Math.max(-1, Math.min(1, -this.charge));
    return Math.max(
      VIEW_DAY,
      Math.min(this.opts.maxView(), this.restView + lean),
    );
  }

  private addCharge(delta: number, nowMs: number): void {
    if (this.anim) {
      // Analog input mid-transition: enough opposite charge reverses.
      const animDir = Math.sign(this.anim.toPos - this.anim.fromPos);
      const inputDir = -Math.sign(delta); // charge>0 = in = toward lower index
      if (inputDir === animDir) return;
      this.charge += delta;
      if (Math.abs(this.charge) >= 0.5) {
        this.charge = 0;
        this.reverse(nowMs);
      }
      return;
    }
    let gain = 1;
    if (nowMs < this.postCommitUntilMs) gain *= POST_COMMIT_GAIN;
    const dir = Math.sign(delta);
    const atInLimit = this.restView === VIEW_DAY && dir > 0;
    const atOutLimit = this.restView >= this.opts.maxView() && dir < 0;
    if (atInLimit || atOutLimit) gain *= LIMIT_GAIN;
    this.charge += delta * gain;
    this.lastInputMs = nowMs;
    this.maybeCommit(nowMs, COMMIT_CHARGE);
  }

  private maybeCommit(nowMs: number, threshold: number): void {
    if (this.anim || Math.abs(this.charge) < threshold) return;
    const dir = this.charge > 0 ? -1 : 1;
    const target = this.restView + dir;
    if (target < VIEW_DAY || target > this.opts.maxView()) return;
    this.commitTo(target as ViewIndex, nowMs, STEP_MS);
  }

  // -- input binding ---------------------------------------------------------

  attach(el: HTMLElement): void {
    this.el = el;
    el.style.touchAction = "none";
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("dblclick", this.onDblClick);
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("gesturestart", this.onGestureStart as EventListener, {
      passive: false,
    });
    el.addEventListener("gesturechange", this.onGestureChange as EventListener, {
      passive: false,
    });
    el.addEventListener("gestureend", this.onGestureEnd as EventListener, {
      passive: false,
    });
    window.addEventListener("keydown", this.onKeyDown);
  }

  detach(): void {
    const el = this.el;
    if (el) {
      el.removeEventListener("wheel", this.onWheel);
      el.removeEventListener("dblclick", this.onDblClick);
      el.removeEventListener("pointerdown", this.onPointerDown);
      el.removeEventListener("pointermove", this.onPointerMove);
      el.removeEventListener("pointerup", this.onPointerUp);
      el.removeEventListener("pointercancel", this.onPointerUp);
      el.removeEventListener(
        "gesturestart",
        this.onGestureStart as EventListener,
      );
      el.removeEventListener(
        "gesturechange",
        this.onGestureChange as EventListener,
      );
      el.removeEventListener("gestureend", this.onGestureEnd as EventListener);
    }
    window.removeEventListener("keydown", this.onKeyDown);
    this.el = null;
    this.pointers.clear();
  }

  private onGestureStart = (e: Event): void => {
    e.preventDefault();
    if (!this.opts.enabled()) return;
    this.gestureActive = true;
    this.gestureBaseScale = 1;
    this.charge = 0;
  };

  private onGestureChange = (e: Event): void => {
    e.preventDefault();
    if (!this.gestureActive || !this.opts.enabled()) return;
    const nowMs = Date.now();
    const scale = (e as unknown as { scale?: number }).scale || 1;
    this.charge = Math.log(scale / this.gestureBaseScale) / Math.log(2.2);
    this.lastInputMs = nowMs;
    if (Math.abs(this.charge) >= COMMIT_CHARGE && !this.anim) {
      this.maybeCommit(nowMs, COMMIT_CHARGE);
      this.gestureBaseScale = scale;
    }
  };

  private onGestureEnd = (e: Event): void => {
    e.preventDefault();
    if (!this.gestureActive) return;
    this.gestureActive = false;
    const nowMs = Date.now();
    if (!this.anim && Math.abs(this.charge) >= TOUCH_RELEASE_COMMIT) {
      this.maybeCommit(nowMs, TOUCH_RELEASE_COMMIT);
    }
    this.lastInputMs = nowMs - IDLE_DECAY_DELAY_MS;
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.opts.enabled()) return;
    e.preventDefault();
    const nowMs = Date.now();
    const px =
      e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
    // Trackpad pinch arrives as ctrlKey+wheel. Scroll down = zoom out.
    this.addCharge(-px / (e.ctrlKey ? 120 : 320), nowMs);
  };

  private onDblClick = (e: MouseEvent): void => {
    if (!this.opts.enabled()) return;
    if (this.opts.inSlot?.(e.clientX, e.clientY)) return;
    const nowMs = Date.now();
    if (e.shiftKey) this.stepOut(nowMs);
    else this.stepIn(nowMs);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.opts.enabled()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT")
    ) {
      return;
    }
    const nowMs = Date.now();
    switch (e.key) {
      case "=":
      case "+":
      case "ArrowDown":
      case "PageDown":
        e.preventDefault();
        this.stepIn(nowMs);
        break;
      case "-":
      case "_":
      case "ArrowUp":
      case "PageUp":
        e.preventDefault();
        this.stepOut(nowMs);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        this.jumpTo((Number(e.key) - 1) as ViewIndex, nowMs);
        break;
      case "0":
      case "Home":
      case "Escape":
        this.jumpTo(VIEW_DAY, nowMs);
        break;
      case "End":
        this.jumpTo(VIEW_LIFE, nowMs);
        break;
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      // Arm a possible one-finger pan; it only engages if opts.pan.active().
      this.panLastX = e.clientX;
      this.panLastY = e.clientY;
      this.panLastMs = Date.now();
      this.panVX = 0;
      this.panVY = 0;
    } else if (this.pointers.size === 2) {
      this.panning = false;
      this.pinchStartDist = this.pinchDist();
      this.pinchActive = true;
      this.pinchStartMs = Date.now();
      this.pinchPeak = 0;
      this.charge = 0;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // One-finger drag pans the scrollable grid (never touches the ladder).
    if (this.pointers.size === 1 && this.opts.pan?.active()) {
      const nowMs = Date.now();
      const dx = this.panLastX - e.clientX;
      const dy = this.panLastY - e.clientY;
      const dtp = Math.max(1, nowMs - this.panLastMs);
      this.panVX = dx / dtp;
      this.panVY = dy / dtp;
      this.panLastX = e.clientX;
      this.panLastY = e.clientY;
      this.panLastMs = nowMs;
      this.panning = true;
      this.opts.pan.by(dx, dy);
      return;
    }
    if (!this.pinchActive || this.pointers.size < 2 || !this.opts.enabled()) {
      return;
    }
    const nowMs = Date.now();
    const s = this.pinchDist() / this.pinchStartDist;
    // Live (not accumulated) charge; spread = zoom in.
    this.charge = Math.log(s) / Math.log(2.2);
    this.pinchPeak = Math.max(this.pinchPeak, Math.abs(this.charge));
    this.lastInputMs = nowMs;
    if (Math.abs(this.charge) >= COMMIT_CHARGE && !this.anim) {
      this.maybeCommit(nowMs, COMMIT_CHARGE);
      this.pinchStartDist = this.pinchDist();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointers.delete(e.pointerId)) return;
    // Releasing the last pan finger flings the scroll; a two-finger release
    // drops back to a single armed finger, ready to pan without a jump.
    if (this.panning && this.pointers.size === 0) {
      this.panning = false;
      this.opts.pan?.end?.(this.panVX, this.panVY);
    } else if (this.pointers.size === 1) {
      const [p] = [...this.pointers.values()];
      this.panLastX = p.x;
      this.panLastY = p.y;
      this.panLastMs = Date.now();
      this.panVX = 0;
      this.panVY = 0;
    }
    if (this.pinchActive && this.pointers.size < 2) {
      this.pinchActive = false;
      const nowMs = Date.now();
      if (
        !this.anim &&
        nowMs - this.pinchStartMs < 300 &&
        this.pinchPeak < 0.15
      ) {
        // Two-finger tap: no real pinch happened — zoom out one step.
        this.charge = 0;
        if (this.opts.enabled()) this.stepOut(nowMs);
      } else if (!this.anim && Math.abs(this.charge) >= TOUCH_RELEASE_COMMIT) {
        this.maybeCommit(nowMs, TOUCH_RELEASE_COMMIT);
      }
      this.lastInputMs = nowMs - IDLE_DECAY_DELAY_MS; // decay immediately
    }
  };

  private pinchDist(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 1;
    return Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
  }
}
