"use client";

import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Magnet, Plus, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

import { touchClaim, type TouchClaim } from "../kit";
import type { PlayheadClock } from "./clock";
import { BEAT_DURATION, BEAT_PEAKS, INITIAL_EDIT, SOURCE_BY_ID, STRIP_FRAMES, STRIP_TILE } from "./data";
import {
  MAX_START_SEC,
  MIN_CLIP_SEC,
  SNAP_THRESHOLD_PX,
  WHERE_IT_WAS,
  audioLength,
  buildEnvelope,
  clamp,
  clipLength,
  clipName,
  formatSeconds,
  formatTimecode,
  gapsOf,
  isLinedUp,
  lineUp,
  moveDragAt,
  moveItem,
  moveRowAt,
  moveSnapText,
  moveTargets,
  overlayFadeKnees,
  overlayFirstLine,
  peakInRange,
  placedClips,
  rateLabel,
  rulerTicks,
  sequenceEnd,
  sourceTimeAt,
  weightPieces,
  type EvClip,
  type EvEdit,
  type MoveResult,
  type MoveTarget,
  type WeightPiece,
} from "./model";
import {
  EDITOR_CHIP,
  EDIT_FIELD,
  EDIT_LINE,
  GEOMETRY,
  INK_3,
  LENGTH_CHIP,
  MOVING_CLIP,
  MUTED_BADGE,
  PANE,
  SELECTED_RING,
  SPEED_BADGE,
  TEXT_GHOST,
} from "./styles";

export type Selection = { kind: "clip" | "text" | "audio"; id: string } | null;

export interface Axis {
  pps: number;
  total: number;
  timeToX: (t: number) => number;
  xToTime: (x: number) => number;
}

const ORIGIN = GEOMETRY.origin;
const ROW = GEOMETRY.stackRow;
const DRAG_START_PX = 4;
/** One row per clip, as the app draws them under its 3.5-row cap; the demo's clips never change in number. */
export const STACK_ROWS = INITIAL_EDIT.clips.length;

/** Fit: the sequence, its text and its audio fill the lanes, with the room the real lane keeps after them. */
export function makeAxis(edit: EvEdit, width: number): Axis {
  const clips = placedClips(edit);
  const total = Math.max(
    1,
    sequenceEnd(clips),
    ...edit.texts.map((t) => t.endSec),
    edit.audio.startSec + audioLength(edit.audio),
  );
  const pps = Math.max(4, (width - ORIGIN - GEOMETRY.laneTrailing) / total);
  return { pps, total, timeToX: (t) => ORIGIN + t * pps, xToTime: (x) => (x - ORIGIN) / pps };
}

/** The timeline's height: ruler, the text row, Stacked's rows, the audio row and the strip under it. */
export const TIMELINE_PX = 1 + GEOMETRY.ruler + GEOMETRY.overlayRow + STACK_ROWS * ROW + GEOMETRY.audioRow + GEOMETRY.audioStrip;

type Drag =
  | {
      kind: "move";
      id: string;
      index: number;
      startSec: number;
      lengthSec: number;
      px: number;
      py: number;
      targets: MoveTarget[];
      lifted: boolean;
      result: MoveResult;
      dy: number;
      drop: number;
    }
  | {
      kind: "slide";
      target: "text" | "audio";
      id: string;
      startSec: number;
      lengthSec: number;
      px: number;
      py: number;
      targets: MoveTarget[];
      lifted: boolean;
      result: MoveResult;
    }
  | {
      kind: "trim";
      target: "clip" | "text" | "audio";
      id: string;
      edge: "in" | "out";
      edgeSec: number;
      px: number;
      targets: MoveTarget[];
      lifted: boolean;
      live: EvEdit;
      snapped: MoveTarget | null;
    };

/** Every edge a slid or trimmed box can meet: the playhead, 0:00, the clips' ends, the text's and the audio's. */
function timeTargets(edit: EvEdit, playhead: number, self: { kind: "clip" | "text" | "audio"; id: string }): MoveTarget[] {
  const out: MoveTarget[] = [
    { t: playhead, kind: "playhead", label: "the playhead", edge: "both", row: null },
    { t: 0, kind: "edge", label: "the start", edge: "both", row: null },
  ];
  placedClips(edit).forEach((c, row) => {
    if (self.kind === "clip" && self.id === c.id) return;
    out.push(
      { t: c.start, kind: "edge", label: `${clipName(row)}'s start`, edge: "both", row },
      { t: c.start + clipLength(c), kind: "edge", label: `${clipName(row)}'s end`, edge: "both", row },
    );
  });
  edit.texts.forEach((t, i) => {
    if (self.kind === "text" && self.id === t.id) return;
    out.push(
      { t: t.startSec, kind: "edge", label: `Text ${i + 1}'s start`, edge: "both", row: null },
      { t: t.endSec, kind: "edge", label: `Text ${i + 1}'s end`, edge: "both", row: null },
    );
  });
  if (self.kind !== "audio") {
    const a = edit.audio;
    out.push(
      { t: a.startSec, kind: "edge", label: "the audio's start", edge: "both", row: null },
      { t: a.startSec + audioLength(a), kind: "edge", label: "the audio's end", edge: "both", row: null },
    );
  }
  return out;
}

function snapEdge(t: number, targets: readonly MoveTarget[], pps: number, on: boolean): { t: number; snapped: MoveTarget | null } {
  if (!on) return { t, snapped: null };
  let best: MoveTarget | null = null;
  let distance = SNAP_THRESHOLD_PX / pps;
  for (const target of targets) {
    const d = Math.abs(target.t - t);
    if (d <= distance) {
      best = target;
      distance = d;
    }
  }
  return best ? { t: best.t, snapped: best } : { t, snapped: null };
}

/** A trim with the frames fixed in time (trimClipInPlace): the In edge moves the start, the Out edge the end. */
export function trimTo(edit: EvEdit, target: "clip" | "text" | "audio", id: string, edge: "in" | "out", t: number): EvEdit {
  if (target === "clip") {
    return {
      ...edit,
      clips: edit.clips.map((c) => {
        if (c.id !== id) return c;
        const duration = SOURCE_BY_ID.get(c.source)?.duration ?? c.outSec;
        const end = c.start + clipLength(c);
        if (edge === "in") {
          const start = clamp(t, Math.max(0, c.start - c.inSec / c.speed), end - MIN_CLIP_SEC);
          return { ...c, start, inSec: c.inSec + (start - c.start) * c.speed };
        }
        const next = clamp(t, c.start + MIN_CLIP_SEC, c.start + (duration - c.inSec) / c.speed);
        return { ...c, outSec: c.inSec + (next - c.start) * c.speed };
      }),
    };
  }
  if (target === "text") {
    return {
      ...edit,
      texts: edit.texts.map((o) => {
        if (o.id !== id) return o;
        if (edge === "in") return { ...o, startSec: clamp(t, 0, o.endSec - MIN_CLIP_SEC) };
        return { ...o, endSec: clamp(t, o.startSec + MIN_CLIP_SEC, MAX_START_SEC) };
      }),
    };
  }
  const a = edit.audio;
  const end = a.startSec + audioLength(a);
  if (edge === "in") {
    const start = clamp(t, Math.max(0, a.startSec - a.inSec), end - MIN_CLIP_SEC);
    return { ...edit, audio: { ...a, startSec: start, inSec: a.inSec + (start - a.startSec) } };
  }
  const next = clamp(t, a.startSec + MIN_CLIP_SEC, a.startSec + (a.duration - a.inSec));
  return { ...edit, audio: { ...a, outSec: a.inSec + (next - a.startSec) } };
}

// ---------- Small pieces ----------

/**
 * A mouse press takes no focus itself: the editor panel keeps it (EDITOR_PANEL_SELECTOR), so Space and the editor's
 * keys keep working after a click.
 */
const keepFocus = (event: ReactMouseEvent<HTMLElement>) => {
  event.preventDefault();
  event.currentTarget.closest<HTMLElement>("[data-ev-editor]")?.focus({ preventScroll: true });
};

/** A clip's In or Out handle: shown on hover (white on the one selected clip), and while its edge is dragged. */
function EdgeHandle({
  side,
  width,
  selected,
  active,
  onPointerDown,
}: {
  side: "in" | "out";
  width: number;
  selected: boolean;
  active: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <div
      role="presentation"
      data-trim-handle={side}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute inset-y-0 z-1 flex cursor-ew-resize touch-pan-y items-center justify-center",
        side === "in" ? "left-0" : "right-0",
        active ? "bg-neutral-200" : cn("opacity-0 group-hover:opacity-100", selected ? "bg-neutral-100" : "bg-white/18"),
      )}
      style={{ width }}
    >
      {width >= 4 && (
        <span aria-hidden="true" className={cn("h-3.5 w-0.5 rounded-[1px]", active || selected ? "bg-neutral-900" : "bg-white/80")} />
      )}
    </div>
  );
}

const handleWidthFor = (width: number) => Math.min(GEOMETRY.handle, width / 3);

/**
 * A clip's frames, one 56px cell after another from its left edge, each the frame its time plays (a ramp bunches
 * and spreads them, a faster clip skips through them), cover-fitted from the source's eight-frame strip.
 */
const Filmstrip = memo(function Filmstrip({
  clip,
  width,
  height,
  pps,
}: {
  clip: EvClip;
  width: number;
  height: number;
  pps: number;
}) {
  const source = SOURCE_BY_ID.get(clip.source);
  if (!source) return null;
  const cell = GEOMETRY.frameCell;
  const scale = Math.max(cell / STRIP_TILE.width, height / STRIP_TILE.height);
  const tw = STRIP_TILE.width * scale;
  const th = STRIP_TILE.height * scale;
  const count = Math.max(0, Math.ceil(width / cell));
  const cells = [];
  for (let k = 0; k < count; k++) {
    const mid = (k * cell + cell / 2) / pps;
    const src = sourceTimeAt(clip, clip.start + mid);
    const frame = clamp(Math.floor((src / source.duration) * STRIP_FRAMES), 0, STRIP_FRAMES - 1);
    cells.push(
      <div
        key={k}
        className="nb-ev-frame"
        style={{
          left: k * cell,
          width: cell,
          backgroundImage: `url(${source.strip})`,
          backgroundSize: `${tw * STRIP_FRAMES}px ${th}px`,
          backgroundPosition: `${-(frame * tw) - (tw - cell) / 2}px ${-(th - height) / 2}px`,
        }}
      />,
    );
  }
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {cells}
    </div>
  );
});

/** A fade drawn as its ramp: the darkened corner above the line the picture climbs or falls on. */
function Wedge({ side, width, left }: { side: "in" | "out"; width: number; left: number }) {
  const incoming = side === "in";
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0"
      style={{ left, width, height: "100%" }}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      <polygon points={incoming ? "0,0 1,0 0,1" : "0,0 1,0 1,1"} className="fill-black/40" />
      <line
        x1="0"
        y1={incoming ? 1 : 0}
        x2="1"
        y2={incoming ? 0 : 1}
        className="stroke-neutral-200/70"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * A clip's share of the picture over its own span (CrossfadeMark.tsx LayerMarks): nothing where it is the whole
 * picture, a wedge where it fades over the clip below or under the one above, and a dark band where a higher row
 * hides it.
 */
function LayerMarks({ pieces, pps, crossfade }: { pieces: readonly WeightPiece[]; pps: number; crossfade: boolean }) {
  return (
    <>
      {pieces.map((piece) => {
        const left = piece.fromSec * pps;
        const width = (piece.toSec - piece.fromSec) * pps;
        if (!(width >= 2)) return null;
        const key = `${piece.kind}:${piece.fromSec}`;
        if (piece.kind === "hidden") {
          const name = clipName(piece.coveredByRow);
          return (
            <div
              key={key}
              title={crossfade ? `Hidden under ${name}.` : `Hidden under ${name}. Its sound plays.`}
              className="absolute inset-y-0 bg-black/50"
              style={{ left, width }}
            />
          );
        }
        if (piece.kind === "ramp") {
          const fadeIn = piece.from <= 1e-6 && piece.to >= 1 - 1e-6;
          const fadeOut = piece.from >= 1 - 1e-6 && piece.to <= 1e-6;
          if (fadeIn || fadeOut) return <Wedge key={key} side={fadeIn ? "in" : "out"} width={width} left={left} />;
        }
        const points: ReadonlyArray<readonly [number, number]> =
          piece.kind === "ramp"
            ? [
                [piece.fromSec, piece.from],
                [piece.toSec, piece.to],
              ]
            : piece.points;
        const xy = points.map(([t, w]) => `${t},${1 - w}`);
        return (
          <svg
            key={key}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0"
            style={{ left, width, height: "100%" }}
            viewBox={`${piece.fromSec} 0 ${piece.toSec - piece.fromSec} 1`}
            preserveAspectRatio="none"
          >
            <polygon points={`${piece.fromSec},0 ${piece.toSec},0 ${xy.slice().reverse().join(" ")}`} className="fill-black/40" />
            <polyline points={xy.join(" ")} fill="none" className="stroke-neutral-200/70" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
        );
      })}
    </>
  );
}

function ClipBox({
  clip,
  row,
  x,
  top,
  width,
  height,
  pps,
  selected,
  focusable,
  moving,
  trimEdge,
  compact,
  marks,
  onPointerDown,
  onHandlePointerDown,
  dragHandlers,
}: {
  clip: EvClip;
  row: number;
  x: number;
  top: number;
  width: number;
  height: number;
  pps: number;
  selected: boolean;
  focusable: boolean;
  moving: boolean;
  trimEdge: "in" | "out" | null;
  compact: boolean;
  marks: ReactNode;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onHandlePointerDown: (event: ReactPointerEvent<HTMLElement>, edge: "in" | "out") => void;
  dragHandlers: DragHandlers;
}) {
  const rate = rateLabel(clip);
  const atRest = !moving;
  const lengthText = formatSeconds(clipLength(clip), trimEdge ? 2 : 1);
  const badgeLeft = trimEdge ? "left-4" : "left-1.5 group-hover:left-4";
  const badgeTop = compact ? "top-[11px]" : "top-1.5";
  const speedLeft = clip.muted ? (trimEdge ? "left-[38px]" : "left-7 group-hover:left-[38px]") : badgeLeft;
  const handleWidth = handleWidthFor(width);
  return (
    <div
      data-clip-id={clip.id}
      role="option"
      aria-selected={selected}
      aria-label={compact ? `${clipName(row)}, starts ${formatTimecode(clip.start)}` : clipName(row)}
      tabIndex={focusable ? 0 : -1}
      onPointerDown={onPointerDown}
      onMouseDown={keepFocus}
      {...dragHandlers}
      className={cn(
        "group absolute touch-pan-y overflow-hidden rounded-md select-none outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nb-pane)]",
        EDIT_FIELD,
        moving ? MOVING_CLIP : compact && "cursor-grab",
        trimEdge === "in" && "z-1",
      )}
      style={{ left: x, top, width, height }}
    >
      <Filmstrip clip={clip} width={width} height={height} pps={pps} />
      {marks}
      {(selected || trimEdge) && !moving && <span aria-hidden="true" className={SELECTED_RING} />}
      {width >= 56 && (
        <span className={cn(LENGTH_CHIP, trimEdge || moving ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")}>
          {lengthText}
        </span>
      )}
      {clip.muted && (
        <span aria-hidden="true" className={cn(MUTED_BADGE, badgeTop, badgeLeft)}>
          <VolumeX size={11} strokeWidth={2} />
        </span>
      )}
      {rate && width >= 16 + 8 + 7 * rate.length + (compact ? 22 + 6 * lengthText.length : 14) && (
        <span aria-hidden="true" className={cn(SPEED_BADGE, badgeTop, speedLeft)}>
          <span>{rate}</span>
        </span>
      )}
      {atRest && compact && (
        <>
          <EdgeHandle
            side="in"
            width={handleWidth}
            selected={selected}
            active={trimEdge === "in"}
            onPointerDown={(event) => onHandlePointerDown(event, "in")}
          />
          <EdgeHandle
            side="out"
            width={handleWidth}
            selected={selected}
            active={trimEdge === "out"}
            onPointerDown={(event) => onHandlePointerDown(event, "out")}
          />
        </>
      )}
    </div>
  );
}

interface DragHandlers {
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

/** A text layer's fades as ramps over its box: the part above them lit faintly. */
function FadeRamps({ x, width, axis, text }: { x: number; width: number; axis: Axis; text: EvEdit["texts"][number] }) {
  if (!(text.fadeInSec > 0) && !(text.fadeOutSec > 0)) return null;
  const height = GEOMETRY.overlayBlock;
  const { fadeInEnd, fadeOutStart, peak } = overlayFadeKnees(text);
  const inX = Math.min(width, Math.max(0, axis.timeToX(fadeInEnd) - x));
  const outX = Math.min(width, Math.max(inX, axis.timeToX(fadeOutStart) - x));
  const peakY = height * (1 - peak);
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={width} height={height}>
      <polygon points={`0,0 0,${height} ${inX},${peakY} ${outX},${peakY} ${width},${height} ${width},0`} className="fill-white/6" />
      {inX > 0 && <line x1={0} y1={height} x2={inX} y2={peakY} strokeWidth={1} className="stroke-white/30" />}
      {outX < width && <line x1={outX} y1={peakY} x2={width} y2={height} strokeWidth={1} className="stroke-white/30" />}
    </svg>
  );
}

/** The audio clip's waveform: 2px bars on a 3px pitch, mirrored about the block's centre, 28/44 of its height at full scale. */
function Waveform({
  axis,
  blockX,
  width,
  height,
  sourceOffset,
  selected,
}: {
  axis: Axis;
  blockX: number;
  width: number;
  height: number;
  sourceOffset: number;
  selected: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = selected ? "#a3a3a3" : "#5c5c5c";
    const reach = height * (28 / 44);
    const centre = height / 2;
    for (let k = 0; k * 3 < width; k++) {
      const x0 = blockX + k * 3;
      const peak = peakInRange(BEAT_PEAKS, BEAT_DURATION, axis.xToTime(x0) + sourceOffset, axis.xToTime(x0 + 3) + sourceOffset);
      if (peak <= 0) continue;
      const barHeight = Math.max(1, peak * reach);
      ctx.fillRect(k * 3, centre - barHeight / 2, 2, barHeight);
    }
  }, [axis, blockX, width, height, sourceOffset, selected]);
  return (
    <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute top-0 left-0" style={{ width, height }} />
  );
}

/** The playhead: a 1px white line down the lanes and a 9×12 head on the ruler, moved by writing their left. */
function Playhead({ axis, clock, bottom }: { axis: Axis; clock: PlayheadClock; bottom: number }) {
  const line = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const move = (t: number) => {
      const at = axis.timeToX(Math.min(t, axis.total));
      if (line.current) line.current.style.left = `${at}px`;
      if (head.current) head.current.style.left = `${at - 4}px`;
    };
    move(clock.get());
    return clock.subscribe(move);
  }, [axis, clock]);
  return (
    <>
      <div
        ref={line}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 z-3 w-px bg-neutral-100"
        style={{ left: ORIGIN, bottom }}
      />
      <div
        ref={head}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 z-3 w-[9px] rounded-t-[2px] rounded-b-[5px] bg-neutral-100"
        style={{ left: ORIGIN - 4, height: GEOMETRY.playheadHead }}
      />
    </>
  );
}

function SnapGuide({ x, bottom, chipTop, text }: { x: number; bottom: number; chipTop: number; text: string }) {
  const top = GEOMETRY.playheadHead;
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-20 border-l border-dashed border-neutral-200/70"
        style={{ left: x, top, height: bottom - top + 1 }}
      />
      <div
        aria-hidden="true"
        className={cn(EDITOR_CHIP, "pointer-events-none absolute z-20 inline-flex items-center gap-1.5 whitespace-nowrap text-neutral-300")}
        style={{ left: x + 9, top: chipTop }}
      >
        <Magnet size={11} strokeWidth={1.75} />
        {text}
      </div>
    </>
  );
}

// ---------- The timeline ----------

export interface TimelineProps {
  edit: EvEdit;
  width: number;
  /** The editor's scale on screen: pointer travel is divided by it. */
  scale: number;
  /** The strip's + Audio, which is off (the demo has no asset library); a narrow editor leaves it out. */
  addAudio: boolean;
  clock: PlayheadClock;
  selection: Selection;
  snap: boolean;
  onSelect: (selection: Selection) => void;
  onCommit: (next: EvEdit, coalesce?: string) => void;
  onPause: () => void;
  /** A key or a button used the timeline (the demo's root counts pointer presses itself). */
  onInteract: () => void;
  onAddText: () => void;
  onAddTextDisabled: boolean;
}

/**
 * Stacked's timeline (Timeline.tsx, StackedClipsLane.tsx): the ruler, the text row, one row per clip at its own
 * start (row 0 in front), the audio row, the strip with + Audio, + Text and Line up, and the playhead down the lanes.
 * A clip's body drags it in time and across rows (it snaps unless ⇧); its edges trim it; the ruler scrubs.
 */
export function Timeline({
  edit,
  width,
  scale,
  addAudio,
  clock,
  selection,
  snap,
  onSelect,
  onCommit,
  onPause,
  onInteract,
  onAddText,
  onAddTextDisabled,
}: TimelineProps) {
  const axis = useMemo(() => makeAxis(edit, width), [edit, width]);
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const lanesRef = useRef<HTMLDivElement>(null);
  const stacked = edit.mode === "stacked";

  // What is drawn: a trim's live edit, or the edit with the moving clip where release will leave it
  const drawn = drag?.kind === "trim" && drag.lifted ? drag.live : edit;
  const landing = useMemo(() => {
    if (!drag || drag.kind !== "move" || !drag.lifted) return null;
    const moved = edit.clips.map((c) => (c.id === drag.id ? { ...c, start: drag.result.startSec } : c));
    return moveItem(moved, drag.index, drag.drop);
  }, [drag, edit.clips]);
  const marksClips = useMemo(() => placedClips({ clips: landing ?? drawn.clips, mode: drawn.mode }), [landing, drawn]);
  const env = useMemo(
    () =>
      buildEnvelope(
        marksClips.map((c, row) => ({ start: c.start, length: clipLength(c), row })),
        drawn.crossfade && stacked,
      ),
    [marksClips, drawn.crossfade, stacked],
  );
  const piecesById = useMemo(() => {
    const map = new Map<string, WeightPiece[]>();
    marksClips.forEach((c, row) => map.set(c.id, weightPieces(env, row, axis.pps)));
    return map;
  }, [marksClips, env, axis.pps]);
  const gaps = useMemo(() => (stacked ? gapsOf(env) : []), [env, stacked]);
  const placed = useMemo(() => placedClips(drawn), [drawn]);

  // Escape puts a drag back
  useEffect(() => {
    if (!drag?.lifted) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDrag(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag?.lifted]);

  const textTop = GEOMETRY.ruler;
  const rowsTop = GEOMETRY.ruler + GEOMETRY.overlayRow;
  const rowsHeight = STACK_ROWS * ROW;
  const audioTop = rowsTop + rowsHeight;
  const stripTop = audioTop + GEOMETRY.audioRow;

  // ---------- Pointer ----------

  const laneX = (clientX: number) => {
    const rect = lanesRef.current?.getBoundingClientRect();
    return rect ? (clientX - rect.left) / scale : 0;
  };

  /**
   * A finger's press until it is the timeline's: what it does (select, seek) waits until it lifts (a tap) or goes
   * sideways (the drag's TouchClaim). A swipe the page takes for a scroll ends in a pointercancel, so it never selects,
   * seeks, lifts a clip or pauses.
   */
  const finger = useRef<{ pointerId: number; claim: TouchClaim; settle: () => void } | null>(null);
  /** A press does its part at once for a mouse or a pen; a finger's waits. */
  const press = (event: ReactPointerEvent<HTMLElement>, settle: () => void) => {
    const claim = touchClaim(event);
    finger.current = claim ? { pointerId: event.pointerId, claim, settle } : null;
    if (!claim) settle();
  };
  const settleFinger = (pointerId: number) => {
    const f = finger.current;
    if (!f || f.pointerId !== pointerId) return;
    finger.current = null;
    f.settle();
  };
  /** Whether a moving press is the timeline's yet: a finger's only once it goes sideways (the page takes a vertical one). */
  const ours = (event: ReactPointerEvent<HTMLElement>) => {
    const f = finger.current;
    if (!f || f.pointerId !== event.pointerId) return true;
    if (!f.claim.move(event.clientX, event.clientY)) return false;
    settleFinger(event.pointerId);
    return true;
  };

  const pressClip = (event: ReactPointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0) return;
    const clip = edit.clips[index];
    press(event, () => onSelect({ kind: "clip", id: clip.id }));
    if (!stacked) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      kind: "move",
      id: clip.id,
      index,
      startSec: clip.start,
      lengthSec: clipLength(clip),
      px: event.clientX,
      py: event.clientY,
      targets: [],
      lifted: false,
      result: { startSec: clip.start, deltaSec: 0, snapped: null, snappedEdge: null },
      dy: 0,
      drop: index,
    });
  };

  const pressSlide = (event: ReactPointerEvent<HTMLElement>, target: "text" | "audio", id: string) => {
    if (event.button !== 0) return;
    press(event, () => onSelect({ kind: target, id }));
    const startSec = target === "text" ? (edit.texts.find((t) => t.id === id)?.startSec ?? 0) : edit.audio.startSec;
    const lengthSec =
      target === "text"
        ? (() => {
            const t = edit.texts.find((o) => o.id === id);
            return t ? t.endSec - t.startSec : 0;
          })()
        : audioLength(edit.audio);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      kind: "slide",
      target,
      id,
      startSec,
      lengthSec,
      px: event.clientX,
      py: event.clientY,
      targets: [],
      lifted: false,
      result: { startSec, deltaSec: 0, snapped: null, snappedEdge: null },
    });
  };

  const pressHandle = (
    event: ReactPointerEvent<HTMLElement>,
    target: "clip" | "text" | "audio",
    id: string,
    edge: "in" | "out",
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    press(event, () => onSelect({ kind: target, id }));
    let edgeSec = 0;
    if (target === "clip") {
      const c = placed.find((p) => p.id === id);
      if (!c || !stacked) return;
      edgeSec = edge === "in" ? c.start : c.start + clipLength(c);
    } else if (target === "text") {
      const t = edit.texts.find((o) => o.id === id);
      if (!t) return;
      edgeSec = edge === "in" ? t.startSec : t.endSec;
    } else {
      edgeSec = edge === "in" ? edit.audio.startSec : edit.audio.startSec + audioLength(edit.audio);
    }
    // The capture goes to the box, which carries the drag handlers
    const box = event.currentTarget.parentElement;
    box?.setPointerCapture?.(event.pointerId);
    setDrag({ kind: "trim", target, id, edge, edgeSec, px: event.clientX, targets: [], lifted: false, live: edit, snapped: null });
  };

  const onDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (event.clientX - d.px) / scale;
    const dy = d.kind === "trim" ? 0 : (event.clientY - d.py) / scale;
    if (!d.lifted && (Math.hypot(dx, dy) < DRAG_START_PX || !ours(event))) return;
    const first = !d.lifted;
    if (first) onPause();
    const playhead = clock.get();
    const useSnap = snap && !event.shiftKey;
    if (d.kind === "move") {
      const targets = first ? moveTargets(edit.clips, d.index, playhead) : d.targets;
      const result = moveDragAt({ startSec: d.startSec, lengthSec: d.lengthSec, pxPerSec: axis.pps, targets }, dx, useSnap);
      const rows = edit.clips.length;
      const travel = clamp(dy, -d.index * ROW, (rows - 1 - d.index) * ROW);
      const drop = moveRowAt(d.index, travel, d.drop, rows, ROW);
      setDrag({ ...d, lifted: true, targets, result, dy: travel, drop });
    } else if (d.kind === "slide") {
      const targets = first
        ? timeTargets(edit, playhead, { kind: d.target, id: d.id }).concat({
            t: d.startSec,
            kind: "edge",
            label: WHERE_IT_WAS,
            edge: "start",
            row: null,
          })
        : d.targets;
      const result = moveDragAt({ startSec: d.startSec, lengthSec: d.lengthSec, pxPerSec: axis.pps, targets }, dx, useSnap);
      setDrag({ ...d, lifted: true, targets, result });
    } else {
      const targets = first ? timeTargets(edit, playhead, { kind: d.target, id: d.id }) : d.targets;
      const snapped = snapEdge(d.edgeSec + dx / axis.pps, targets, axis.pps, useSnap);
      setDrag({ ...d, lifted: true, targets, snapped: snapped.snapped, live: trimTo(edit, d.target, d.id, d.edge, snapped.t) });
    }
  };

  const onDragEnd = () => {
    const d = dragRef.current;
    setDrag(null);
    if (!d || !d.lifted) return;
    if (d.kind === "move") {
      const moved = edit.clips.map((c) => (c.id === d.id ? { ...c, start: d.result.startSec } : c));
      if (d.result.deltaSec === 0 && d.drop === d.index) return;
      onCommit({ ...edit, clips: moveItem(moved, d.index, d.drop) });
    } else if (d.kind === "slide") {
      if (d.result.deltaSec === 0) return;
      if (d.target === "text") {
        onCommit({
          ...edit,
          texts: edit.texts.map((t) =>
            t.id === d.id ? { ...t, startSec: d.result.startSec, endSec: d.result.startSec + (t.endSec - t.startSec) } : t,
          ),
        });
      } else {
        onCommit({ ...edit, audio: { ...edit.audio, startSec: d.result.startSec } });
      }
    } else {
      onCommit(d.live);
    }
  };

  const dragHandlers: DragHandlers = {
    onPointerMove: onDragMove,
    onPointerUp: onDragEnd,
    onPointerCancel: () => setDrag(null),
  };

  // The ruler: a press or drag seeks (and pauses)
  const scrubbing = useRef(false);
  const seekTo = (clientX: number) => clock.set(clamp(axis.xToTime(laneX(clientX)), 0, axis.total));
  const onRulerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    scrubbing.current = true;
    const x = event.clientX;
    press(event, () => {
      onPause();
      seekTo(x);
    });
  };
  const rulerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const write = (t: number) => {
      const el = rulerRef.current;
      if (!el) return;
      el.setAttribute("aria-valuenow", t.toFixed(2));
      el.setAttribute("aria-valuetext", formatTimecode(t));
    };
    write(clock.get());
    return clock.subscribe(write);
  }, [clock]);
  const onRulerKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 1 : 1 / 24;
    const t = clock.get();
    const next =
      event.key === "ArrowRight" ? t + step : event.key === "ArrowLeft" ? t - step : event.key === "Home" ? 0 : event.key === "End" ? axis.total : null;
    if (next === null) return;
    event.preventDefault();
    onInteract();
    onPause();
    clock.set(clamp(next, 0, axis.total));
  };

  // ---------- Keyboard: the clips' listbox ----------

  const selectedClipIndex = selection?.kind === "clip" ? edit.clips.findIndex((c) => c.id === selection.id) : -1;
  const tabStop = selectedClipIndex >= 0 ? selectedClipIndex : 0;
  const focusClip = (id: string) => {
    requestAnimationFrame(() => lanesRef.current?.querySelector<HTMLElement>(`[data-clip-id="${id}"]`)?.focus());
  };
  const onClipsKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = tabStop;
    const clip = edit.clips[at];
    if (!clip) return;
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(edit.clips.length - 1, at + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, at - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = edit.clips.length - 1;
    if (next === null) return;
    event.preventDefault();
    onInteract();
    onSelect({ kind: "clip", id: edit.clips[next].id });
    focusClip(edit.clips[next].id);
  };

  // ---------- Drawing ----------

  const ticks = rulerTicks(axis.pps, 0, axis.xToTime(width));
  const labels = ticks.labels.filter(({ t }) => axis.timeToX(t) + 5 + 52 <= width);
  const labelled = new Set(labels.map(({ t }) => t));

  const moveDrag = drag?.kind === "move" && drag.lifted ? drag : null;
  const insertionY =
    moveDrag && moveDrag.drop !== moveDrag.index
      ? rowsTop + (moveDrag.drop < moveDrag.index ? moveDrag.drop * ROW : (moveDrag.drop + 1) * ROW)
      : null;
  const linedUp = useMemo(() => isLinedUp(edit.clips), [edit.clips]);

  const audio = drawn.audio;
  const audioX = axis.timeToX(audio.startSec);
  const audioW = Math.max(2, audioLength(audio) * axis.pps);
  const seqEnd = sequenceEnd(placed);
  const audioHatch = Math.max(0, axis.timeToX(seqEnd) - audioX);
  const audioSelected = selection?.kind === "audio";
  const trimOf = (target: "clip" | "text" | "audio", id: string) =>
    drag?.kind === "trim" && drag.target === target && drag.id === id ? drag.edge : null;

  // A trim's ghost: the frames it cuts, hatched where they were, on the side they leave from
  let trimGhost: ReactNode = null;
  if (drag?.kind === "trim" && drag.lifted && drag.target === "clip") {
    const row = edit.clips.findIndex((c) => c.id === drag.id);
    const rest = edit.clips[row];
    const live = drag.live.clips[row];
    if (rest && live) {
      const restX = axis.timeToX(rest.start);
      const restW = clipLength(rest) * axis.pps;
      const liveX = axis.timeToX(live.start);
      const liveEnd = liveX + clipLength(live) * axis.pps;
      const [from, to] = drag.edge === "in" ? [restX, liveX] : [liveEnd, restX + restW];
      if (to - from >= 1) {
        trimGhost = (
          <div
            aria-hidden="true"
            className={cn("pointer-events-none absolute overflow-hidden", drag.edge === "in" ? "rounded-l-md" : "rounded-r-md")}
            style={{ left: from, top: row * ROW + GEOMETRY.stackClipTop, width: to - from, height: GEOMETRY.stackClipHeight }}
          >
            <div className="absolute inset-y-0 opacity-30" style={{ left: restX - from, width: restW }}>
              <Filmstrip clip={rest} width={restW} height={GEOMETRY.stackClipHeight} pps={axis.pps} />
            </div>
            <div className="nb-ev-hatch absolute inset-0" />
          </div>
        );
      }
    }
  }

  // The move chip and the snap guide
  let moveChip: ReactNode = null;
  if (moveDrag) {
    const boxX = axis.timeToX(moveDrag.result.startSec);
    const boxW = moveDrag.lengthSec * axis.pps;
    const boxTop = rowsTop + moveDrag.index * ROW + GEOMETRY.stackClipTop + moveDrag.dy;
    const text = `${formatTimecode(moveDrag.result.startSec)}–${formatTimecode(moveDrag.result.startSec + moveDrag.lengthSec)} · ${formatSeconds(moveDrag.result.deltaSec, 2, { signed: true })}`;
    const chipW = text.length * 5.4 + 18;
    const chipX = boxX + boxW + 12 + chipW <= width ? boxX + boxW + 12 : Math.max(0, boxX - 12 - chipW);
    const snapText = moveSnapText(moveDrag.result);
    const bottom = boxTop + GEOMETRY.stackClipHeight;
    const targetRow = moveDrag.result.snapped?.row;
    const targetBottom = targetRow == null ? 0 : rowsTop + targetRow * ROW + GEOMETRY.stackClipTop + GEOMETRY.stackClipHeight;
    moveChip = (
      <>
        <div
          aria-hidden="true"
          className={cn(EDITOR_CHIP, "pointer-events-none absolute z-20 whitespace-nowrap tabular-nums text-neutral-200")}
          style={{ left: chipX, top: boxTop + 10 }}
        >
          {text}
        </div>
        {moveDrag.result.snapped && snapText && (
          <SnapGuide
            x={axis.timeToX(moveDrag.result.snapped.t)}
            bottom={Math.max(bottom, targetBottom)}
            chipTop={bottom + 12}
            text={snapText}
          />
        )}
      </>
    );
  }
  let edgeGuide: ReactNode = null;
  if (drag?.lifted && drag.kind !== "move") {
    const snapped = drag.kind === "trim" ? drag.snapped : drag.result.snapped;
    if (snapped) {
      const isEnd = drag.kind === "slide" && drag.result.snappedEdge === "end";
      const label = drag.kind === "trim" ? `Snapped to ${snapped.label}` : `${isEnd ? "End snapped" : "Snapped"} to ${snapped.label}`;
      const guideBottom =
        drag.target === "clip"
          ? rowsTop + rowsHeight
          : drag.target === "audio"
            ? audioTop + GEOMETRY.audioBlock
            : textTop + GEOMETRY.overlayBlockTop + GEOMETRY.overlayBlock;
      edgeGuide = <SnapGuide x={axis.timeToX(snapped.t)} bottom={guideBottom} chipTop={Math.min(guideBottom + 8, stripTop)} text={label} />;
    }
  }

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden border-t", EDIT_LINE, PANE)}
      style={{ height: TIMELINE_PX }}
      onPointerUpCapture={(event) => settleFinger(event.pointerId)}
      onPointerCancelCapture={(event) => {
        if (finger.current?.pointerId === event.pointerId) finger.current = null;
      }}
    >
      <div ref={lanesRef} className="absolute inset-0">
        {/* The ruler: a press or drag moves the playhead */}
        <div
          ref={rulerRef}
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuenow={0}
          aria-valuemax={Number(axis.total.toFixed(2))}
          onPointerDown={onRulerDown}
          onPointerMove={(event) => {
            if (scrubbing.current && ours(event)) seekTo(event.clientX);
          }}
          onPointerUp={() => {
            scrubbing.current = false;
          }}
          onPointerCancel={() => {
            scrubbing.current = false;
          }}
          onKeyDown={onRulerKey}
          className="absolute inset-x-0 top-0 z-4 cursor-pointer touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
          style={{ height: GEOMETRY.ruler }}
        >
          {ticks.minors.map((t) => (
            <span key={`m${t}`} aria-hidden="true" className="absolute bottom-0 h-1.5 w-px bg-neutral-800" style={{ left: axis.timeToX(t) }} />
          ))}
          {ticks.majors.map((t) => (
            <span
              key={`M${t}`}
              aria-hidden="true"
              className={cn("absolute bottom-0 w-px bg-[var(--nb-edit-tick)]", labelled.has(t) ? "top-2" : "h-2")}
              style={{ left: axis.timeToX(t) }}
            />
          ))}
          {labels.map(({ t, text }) => (
            <span
              key={`L${t}`}
              aria-hidden="true"
              className={cn("pointer-events-none absolute top-[9px] nb-ev-t11 leading-[11px] tabular-nums", INK_3)}
              style={{ left: axis.timeToX(t) + 5 }}
            >
              {text}
            </span>
          ))}
          {gaps.map((gap) => (
            <div
              key={gap.fromSec}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 h-[3px] bg-neutral-800"
              style={{ left: axis.timeToX(gap.fromSec), width: (gap.toSec - gap.fromSec) * axis.pps }}
            />
          ))}
        </div>

        {/* The text layers' row */}
        <div
          role="listbox"
          aria-label="Text layers"
          className="absolute inset-x-0 border-b border-white/4"
          style={{ top: textTop, height: GEOMETRY.overlayRow }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) press(event, () => onSelect(null));
          }}
        >
          {drawn.texts.map((t, i) => {
            const x = axis.timeToX(t.startSec);
            const w = Math.max(2, (t.endSec - t.startSec) * axis.pps);
            const sliding = drag?.kind === "slide" && drag.lifted && drag.target === "text" && drag.id === t.id ? drag : null;
            const left = sliding ? axis.timeToX(sliding.result.startSec) : x;
            const line = overlayFirstLine(t.text);
            const selected = selection?.kind === "text" && selection.id === t.id;
            const edge = trimOf("text", t.id);
            const hatchFrom = seqEnd > 0 ? Math.max(0, axis.timeToX(seqEnd) - x) : Infinity;
            return (
              <div
                key={t.id}
                role="option"
                aria-selected={selected}
                aria-label={`${line ?? "Empty text"}, Text ${i + 1}, starts ${formatTimecode(t.startSec)}`}
                tabIndex={0}
                onPointerDown={(event) => pressSlide(event, "text", t.id)}
                onMouseDown={keepFocus}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect({ kind: "text", id: t.id });
                  }
                }}
                {...dragHandlers}
                className={cn(
                  "group absolute cursor-grab touch-pan-y overflow-hidden rounded-md bg-[var(--nb-edit-clip)] select-none outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nb-pane)]",
                  sliding && MOVING_CLIP,
                )}
                style={{ left, top: GEOMETRY.overlayBlockTop, width: w, height: GEOMETRY.overlayBlock }}
              >
                <FadeRamps x={x} width={w} axis={axis} text={t} />
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 truncate nb-ev-t11 leading-4",
                    line ? "text-neutral-300" : INK_3,
                  )}
                >
                  {line ?? "Empty text"}
                </span>
                {hatchFrom < w && (
                  <div title="After the last frame: not shown" className="nb-ev-hatch absolute inset-y-0 right-0 opacity-60" style={{ left: hatchFrom }} />
                )}
                {(selected || edge) && !sliding && <span aria-hidden="true" className={SELECTED_RING} />}
                {w >= 56 && (
                  <span className={cn(LENGTH_CHIP, edge || sliding ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")}>
                    {formatSeconds(t.endSec - t.startSec, edge ? 2 : 1)}
                  </span>
                )}
                {!sliding && (
                  <>
                    <EdgeHandle
                      side="in"
                      width={handleWidthFor(w)}
                      selected={selected}
                      active={edge === "in"}
                      onPointerDown={(event) => pressHandle(event, "text", t.id, "in")}
                    />
                    <EdgeHandle
                      side="out"
                      width={handleWidthFor(w)}
                      selected={selected}
                      active={edge === "out"}
                      onPointerDown={(event) => pressHandle(event, "text", t.id, "out")}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Stacked's rows: one per clip, a black band over each gap */}
        <div className="absolute inset-x-0" style={{ top: rowsTop, height: rowsHeight }}>
          {stacked &&
            edit.clips.map((c, row) => (
              <div
                key={c.id}
                aria-hidden="true"
                className={cn("absolute inset-x-0 border-b border-white/4", selection?.kind === "clip" && selection.id === c.id && "bg-white/4")}
                style={{ top: row * ROW, height: ROW }}
              />
            ))}
          {!stacked && <div aria-hidden="true" className="absolute inset-x-0 top-0 border-b border-white/4" style={{ height: GEOMETRY.clipRow }} />}
          {gaps.map((gap) => {
            const left = axis.timeToX(gap.fromSec);
            const w = (gap.toSec - gap.fromSec) * axis.pps;
            const label = `Gap ${formatSeconds(gap.toSec - gap.fromSec, 1)}`;
            return (
              <div
                key={gap.fromSec}
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-1 flex justify-center border-x border-dashed border-white/12 bg-black"
                style={{ left, width: w }}
              >
                {w >= 64 + 7 * Math.max(0, label.length - 9) && (
                  <span className={cn(EDITOR_CHIP, "mt-1.5 self-start whitespace-nowrap text-neutral-400")}>{label}</span>
                )}
              </div>
            );
          })}
          <div
            role="listbox"
            aria-label="Clips"
            aria-orientation="vertical"
            onKeyDown={onClipsKey}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) press(event, () => onSelect(null));
            }}
            className="absolute inset-0 z-2"
          >
            {edit.clips.map((clip, row) => {
              const shown = placed[row] ?? clip;
              const moving = moveDrag?.id === clip.id ? moveDrag : null;
              const length = clipLength(shown);
              const x = moving ? axis.timeToX(moving.result.startSec) : axis.timeToX(shown.start);
              const top = stacked
                ? row * ROW + GEOMETRY.stackClipTop + (moving ? moving.dy : 0)
                : GEOMETRY.clipTop;
              const w = Math.max(2, length * axis.pps - (stacked ? 0 : 2));
              const selected = selection?.kind === "clip" && selection.id === clip.id;
              return (
                <ClipBox
                  key={clip.id}
                  clip={shown}
                  row={row}
                  x={x}
                  top={top}
                  width={w}
                  height={stacked ? GEOMETRY.stackClipHeight : GEOMETRY.clipHeight}
                  pps={axis.pps}
                  selected={selected}
                  focusable={row === tabStop}
                  moving={moving !== null}
                  trimEdge={trimOf("clip", clip.id)}
                  compact={stacked}
                  marks={
                    stacked && !moving ? (
                      <LayerMarks pieces={piecesById.get(clip.id) ?? []} pps={axis.pps} crossfade={drawn.crossfade} />
                    ) : null
                  }
                  onPointerDown={(event) => pressClip(event, row)}
                  onHandlePointerDown={(event, e) => pressHandle(event, "clip", clip.id, e)}
                  dragHandlers={dragHandlers}
                />
              );
            })}
            {trimGhost}
            {insertionY !== null && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-20 h-[3px] rounded-[2px] bg-neutral-100"
                style={{ top: insertionY - rowsTop - 1.5 }}
              />
            )}
          </div>
        </div>

        {/* The audio row */}
        <div
          role="listbox"
          aria-label="Audio"
          className="absolute inset-x-0"
          style={{ top: audioTop, height: GEOMETRY.audioRow }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) press(event, () => onSelect(null));
          }}
        >
          {(() => {
            const sliding = drag?.kind === "slide" && drag.lifted && drag.target === "audio" ? drag : null;
            const left = sliding ? axis.timeToX(sliding.result.startSec) : audioX;
            const edge = trimOf("audio", audio.id);
            const fadeLine = audioSelected && !audio.muted;
            const fadePx = Math.min(audioW / 2, axis.pps);
            return (
              <div
                role="option"
                aria-selected={audioSelected}
                aria-label={`Audio 1, ${audio.name}, starts ${formatTimecode(audio.startSec)}`}
                tabIndex={0}
                onPointerDown={(event) => pressSlide(event, "audio", audio.id)}
                onMouseDown={keepFocus}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect({ kind: "audio", id: audio.id });
                  }
                }}
                {...dragHandlers}
                className={cn(
                  "group absolute cursor-grab touch-pan-y overflow-hidden rounded-md bg-[var(--nb-edit-clip)] select-none outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nb-pane)]",
                  sliding && MOVING_CLIP,
                )}
                style={{ left, top: 0, width: audioW, height: GEOMETRY.audioBlock }}
              >
                <div className={cn("absolute inset-0", audio.muted && "opacity-35")}>
                  <Waveform
                    axis={axis}
                    blockX={audioX}
                    width={audioW}
                    height={GEOMETRY.audioBlock}
                    sourceOffset={audio.inSec - audio.startSec}
                    selected={audioSelected}
                  />
                </div>
                {audio.muted && (
                  <span aria-hidden="true" className={cn(MUTED_BADGE, "top-1.5 left-1.5 group-hover:left-4")}>
                    <VolumeX size={11} strokeWidth={2} />
                  </span>
                )}
                {fadeLine && (
                  <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={audioW} height={GEOMETRY.audioBlock}>
                    <polyline
                      points={[
                        audio.fade.in ? `0,${GEOMETRY.audioBlock - 4}` : "0,6",
                        audio.fade.in ? `${fadePx},6` : null,
                        audio.fade.out ? `${audioW - fadePx},6` : null,
                        audio.fade.out ? `${audioW},${GEOMETRY.audioBlock - 4}` : `${audioW},6`,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      fill="none"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      className="stroke-neutral-100"
                    />
                  </svg>
                )}
                {audioHatch < audioW && (
                  <div title="After the last frame: not heard" className="nb-ev-hatch absolute inset-y-0 right-0 opacity-60" style={{ left: audioHatch }} />
                )}
                {(audioSelected || edge) && !sliding && <span aria-hidden="true" className={SELECTED_RING} />}
                {audioW >= 56 && (
                  <span className={cn(LENGTH_CHIP, edge || sliding ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")}>
                    {formatSeconds(audioLength(audio), edge ? 2 : 1)}
                  </span>
                )}
                {!sliding && (
                  <>
                    <EdgeHandle
                      side="in"
                      width={handleWidthFor(audioW)}
                      selected={audioSelected}
                      active={edge === "in"}
                      onPointerDown={(event) => pressHandle(event, "audio", audio.id, "in")}
                    />
                    <EdgeHandle
                      side="out"
                      width={handleWidthFor(audioW)}
                      selected={audioSelected}
                      active={edge === "out"}
                      onPointerDown={(event) => pressHandle(event, "audio", audio.id, "out")}
                    />
                  </>
                )}
              </div>
            );
          })()}
        </div>

        <Playhead axis={axis} clock={clock} bottom={GEOMETRY.audioStrip} />
        {moveChip}
        {edgeGuide}

        {/* The strip under the audio rows: + Audio, + Text and, in Stacked, Line up */}
        <div
          className="pointer-events-none absolute inset-x-0 z-5 flex items-center gap-1 pr-4"
          style={{ top: stripTop, height: GEOMETRY.audioStrip, paddingLeft: ORIGIN - 6 }}
        >
          {addAudio && (
            <button
              type="button"
              aria-label="Add audio"
              title="The asset library is off"
              disabled
              className={cn(TEXT_GHOST, "pointer-events-auto")}
            >
              <Plus size={12} strokeWidth={1.5} />
              Audio
            </button>
          )}
          <button
            type="button"
            aria-label="Add text"
            title={onAddTextDisabled ? "A text layer is at the playhead" : "Add text"}
            disabled={onAddTextDisabled}
            onClick={onAddText}
            className={cn(TEXT_GHOST, "pointer-events-auto")}
          >
            <Plus size={12} strokeWidth={1.5} />
            Text
          </button>
          {stacked && (
            <button
              type="button"
              title={linedUp ? "The clips are lined up" : "Line up: each clip starts 1.0 s before the one above ends"}
              disabled={linedUp}
              onClick={() => {
                onInteract();
                onCommit({ ...edit, clips: lineUp(edit.clips) });
              }}
              className={cn(TEXT_GHOST, "pointer-events-auto")}
            >
              Line up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
