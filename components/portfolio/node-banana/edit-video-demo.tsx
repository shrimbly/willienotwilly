"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";

import { EditHeader, MediaPane } from "./edit-video/chrome";
import { createClock } from "./edit-video/clock";
import { EDIT_NAME, FRAME_ASPECT, INITIAL_EDIT, RESTING_PLAYHEAD } from "./edit-video/data";
import {
  MAX_START_SEC,
  audioLength,
  clamp,
  clipLength,
  formatTimecode,
  moveItem,
  placedClips,
  sequenceEnd,
  type EvEdit,
  type EvText,
} from "./edit-video/model";
import { CompactInspector, EditorRail } from "./edit-video/rail";
import { Stage } from "./edit-video/stage";
import { CONTROLS_MIN_PX, CONTROLS_PX, GEOMETRY, HEADER_PX, MEDIA_PANE_PX, RAIL_PX } from "./edit-video/styles";
import { TIMELINE_PX, Timeline, trimTo, type Selection } from "./edit-video/timeline";
import { DemoHint, NbRoot } from "./kit";
import "./edit-video/edit-video.css";

interface Layout {
  pane: boolean;
  header: "full" | "compact" | null;
  /** The inspector: the 280px rail beside the stage, or a 52px strip under it. */
  rail: "side" | "strip";
  /** The least height of the stage: the preview and its control row. */
  stage: number;
  width: number;
}

/**
 * The editor is laid out at least this big, in its own px, and scaled down to the tile. Fullest first: a smaller tile
 * takes the first layout it can show at MIN_SCALE or more, so it drops a secondary panel (the media pane, the header,
 * the rail beside the stage) instead of shrinking the whole editor past reading. The timeline always keeps its strip
 * under the audio row: + Audio, + Text and Line up on the left, the tile's hint on the right.
 */
const LAYOUTS: readonly Layout[] = [
  { pane: true, header: "full", rail: "side", stage: 370, width: 1180 },
  { pane: false, header: "full", rail: "side", stage: 292, width: 860 },
  { pane: false, header: null, rail: "side", stage: 220, width: 840 },
  { pane: false, header: "compact", rail: "strip", stage: 216, width: 440 },
  { pane: false, header: null, rail: "strip", stage: 216, width: 440 },
];
const MIN_SCALE = 0.76;
const COMPACT_HEADER_PX = 48;
const INSPECTOR_STRIP_PX = 52;
/** The smallest type keeps this many px on screen however far the editor is scaled. */
const MIN_TEXT_PX = 9;

const headerPx = (layout: Layout) => (layout.header === "full" ? HEADER_PX : layout.header ? COMPACT_HEADER_PX : 0);
const layoutHeight = (layout: Layout) => headerPx(layout) + layout.stage + (layout.rail === "strip" ? INSPECTOR_STRIP_PX : 0) + TIMELINE_PX;

function fitEditor(width: number, height: number) {
  const fits = LAYOUTS.map((layout) => ({ layout, scale: Math.min(1, width / layout.width, height / layoutHeight(layout)) }));
  const { layout, scale } = fits.find((f) => f.scale >= MIN_SCALE) ?? fits.reduce((a, b) => (b.scale > a.scale ? b : a));
  return { layout, scale, width: width / scale, height: height / scale };
}

const MAX_HISTORY = 50;
const RENDER_MS = 2400;

/** Room for a new text layer at t on the text row: from t to the next layer (at most 4 s), or null. */
function textRoomAt(texts: readonly EvText[], t: number): { start: number; end: number } | null {
  if (texts.some((o) => t >= o.startSec - 1e-6 && t < o.endSec)) return null;
  const next = texts.filter((o) => o.startSec > t).reduce((at, o) => Math.min(at, o.startSec), Infinity);
  const end = Math.min(t + 4, next);
  return end - t >= 0.5 ? { start: t, end } : null;
}

export function NodeBananaEditVideoDemo() {
  const root = useRef<HTMLDivElement | null>(null);
  const { active, inView, pageVisible } = useDemoActive(root);
  const onScreen = inView && pageVisible;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [clock] = useState(() => createClock(RESTING_PLAYHEAD));
  const [edit, setEdit] = useState<EvEdit>(INITIAL_EDIT);
  const [history, setHistory] = useState<{ past: EvEdit[]; future: EvEdit[]; key: string | null }>({ past: [], future: [], key: null });
  const [selection, setSelection] = useState<Selection>({ kind: "clip", id: "c2" });
  const [touched, setTouched] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [snap, setSnap] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [saved, setSaved] = useState(true);
  const [paneOpen, setPaneOpen] = useState<boolean | null>(null);
  const [paneLayout, setPaneLayout] = useState<"list" | "grid">("list");
  const [rendering, setRendering] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    observer.observe(el);
    // Nothing in the tile scrolls: focus moving into a clipped panel must not shift it (the page scrolls instead)
    const unscroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !el.contains(target)) return;
      if (target.scrollTop !== 0) target.scrollTop = 0;
      if (target.scrollLeft !== 0) target.scrollLeft = 0;
    };
    el.addEventListener("scroll", unscroll, true);
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", unscroll, true);
    };
  }, []);

  // While the tile is on screen and nobody has touched it, it plays the edit so the stacking reads at a glance
  const isPlaying = touched ? playing : active;
  const running = isPlaying && onScreen;
  const placed = useMemo(() => placedClips(edit), [edit]);
  const end = sequenceEnd(placed);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    if (clock.get() >= end - 0.02) clock.set(0);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = clock.get() + dt;
      clock.set(t >= end ? 0 : t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, clock, end]);

  // The render's progress, then its toast; both wait while the tile is off screen
  useEffect(() => {
    if (rendering === null || !onScreen) return;
    const id = window.setTimeout(() => {
      if (rendering >= 100) {
        setRendering(null);
        setToast(`Rendered “${EDIT_NAME}” · ${formatTimecode(end, 0)}`);
      } else {
        setRendering(Math.min(100, rendering + 100 / (RENDER_MS / 60)));
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [rendering, end, onScreen]);
  useEffect(() => {
    if (!toast || !onScreen) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast, onScreen]);

  const textRoom = useSyncExternalStore(
    clock.subscribe,
    () => textRoomAt(edit.texts, clock.get()) !== null,
    () => textRoomAt(INITIAL_EDIT.texts, RESTING_PLAYHEAD) !== null,
  );

  const touch = () => {
    if (touched) return;
    setTouched(true);
    setPlaying(active);
  };
  const pause = () => {
    setTouched(true);
    setPlaying(false);
  };

  const commit = (next: EvEdit, coalesce?: string) => {
    if (next === edit) return;
    setHistory((h) =>
      coalesce && h.key === coalesce
        ? { ...h, future: [] }
        : { past: [...h.past.slice(-(MAX_HISTORY - 1)), edit], future: [], key: coalesce ?? null },
    );
    setEdit(next);
    setSaved(false);
  };
  const undo = () => {
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [edit, ...history.future], key: null });
    setEdit(previous);
    setSaved(false);
  };
  const redo = () => {
    const next = history.future[0];
    if (!next) return;
    setHistory({ past: [...history.past, edit], future: history.future.slice(1), key: null });
    setEdit(next);
    setSaved(false);
  };
  /** I / O: the selected box's In or Out at the playhead, when the playhead is inside it (setEdgeAtPlayheadForSelection). */
  const edgeAtPlayhead = (edge: "in" | "out") => {
    if (!selection) return;
    const t = clock.get();
    let span: [number, number] | null = null;
    if (selection.kind === "clip" && edit.mode === "stacked") {
      const c = edit.clips.find((o) => o.id === selection.id);
      if (c) span = [c.start, c.start + clipLength(c)];
    } else if (selection.kind === "text") {
      const o = edit.texts.find((x) => x.id === selection.id);
      if (o) span = [o.startSec, o.endSec];
    } else if (selection.kind === "audio") {
      span = [edit.audio.startSec, edit.audio.startSec + audioLength(edit.audio)];
    }
    if (span && t > span[0] && t < span[1]) commit(trimTo(edit, selection.kind, selection.id, edge, t));
  };
  const addText = () => {
    const room = textRoomAt(edit.texts, clock.get());
    if (!room) return;
    const id = `t${edit.texts.length + 1}-${Math.round(room.start * 100)}`;
    const text: EvText = { id, text: "Title", startSec: room.start, endSec: room.end, fadeInSec: 0.5, fadeOutSec: 0.5, weight: 600, wash: 0.5 };
    commit({ ...edit, texts: [...edit.texts, text].sort((a, b) => a.startSec - b.startSec) });
    setSelection({ kind: "text", id });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || target.closest("input, textarea, select, [contenteditable]")) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      touch();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    // The selected clip's modifier (editorKeys.ts): ⌥← ⌥→ nudge it a frame (⇧ ten), ⌥↑ ⌥↓ change its row
    if (event.altKey && !mod && edit.mode === "stacked" && selection?.kind === "clip" && event.key.startsWith("Arrow")) {
      const at = edit.clips.findIndex((c) => c.id === selection.id);
      if (at < 0) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        touch();
        const step = ((event.shiftKey ? 10 : 1) / 60) * (event.key === "ArrowLeft" ? -1 : 1);
        commit(
          { ...edit, clips: edit.clips.map((c, i) => (i === at ? { ...c, start: clamp(c.start + step, 0, MAX_START_SEC) } : c)) },
          `nudge:${selection.id}`,
        );
      } else if (!event.shiftKey) {
        event.preventDefault();
        const to = clamp(at + (event.key === "ArrowUp" ? -1 : 1), 0, edit.clips.length - 1);
        touch();
        if (to !== at) commit({ ...edit, clips: moveItem(edit.clips, at, to) });
      }
      return;
    }
    const key = event.key.toLowerCase();
    if ((key === "i" || key === "o") && !mod && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      touch();
      edgeAtPlayhead(key === "i" ? "in" : "out");
      return;
    }
    // Space plays and pauses, unless a button or switch has focus (its own Space presses it)
    if (event.key === " " && !mod && !target.closest("button, [role=switch]")) {
      event.preventDefault();
      touch();
      setPlaying(!isPlaying);
    }
  };

  const fit = size ? fitEditor(size.w, size.h) : null;
  const layout = fit?.layout ?? LAYOUTS[0];
  const scale = fit?.scale ?? 1;
  const W = fit?.width ?? layout.width;
  const H = fit?.height ?? layoutHeight(layout);
  const sideRail = layout.rail === "side";
  // The header's Show media opens the pane on any layout that has the header
  const paneShown = layout.header === "full" && (paneOpen ?? layout.pane);
  const colW = W - (paneShown ? MEDIA_PANE_PX : 0);
  const stageH = H - headerPx(layout) - TIMELINE_PX - (sideRail ? 0 : INSPECTOR_STRIP_PX);
  const stageW = sideRail ? colW - RAIL_PX : colW;
  // EditorStage keeps 32px at the sides and 24px above and below; a short or narrow stage gives some of it back
  const padX = sideRail ? 32 : 12;
  const [padAbove, padBelow] = !sideRail ? [8, 4] : stageH >= 360 ? [24, 24] : [12, 12];
  const room = { w: Math.max(80, stageW - padX * 2), h: Math.max(60, stageH - padAbove - padBelow - CONTROLS_PX) };
  const frame =
    room.w / room.h > FRAME_ASPECT
      ? { width: room.h * FRAME_ASPECT, height: room.h }
      : { width: room.w, height: room.w / FRAME_ASPECT };
  const rowWidth = sideRail ? Math.min(room.w, Math.max(frame.width, CONTROLS_MIN_PX)) : room.w;
  const padTop = Math.max(padAbove, (stageH - frame.height - CONTROLS_PX) / 2);

  const stage = (
    <Stage
      edit={edit}
      clock={clock}
      running={running}
      load={inView}
      frame={frame}
      rowWidth={rowWidth}
      padTop={padTop}
      soundOn={soundOn}
      snap={snap}
      onTogglePlay={() => {
        setTouched(true);
        setPlaying(!isPlaying);
      }}
      onGoTo={(where) => {
        pause();
        clock.set(where === "start" ? 0 : end);
      }}
      onSoundOn={setSoundOn}
      onSnap={setSnap}
      onFrameToCanvas={() => setToast(`Added the frame at ${formatTimecode(clock.get())} to the canvas`)}
      onCrossfade={(on) => commit({ ...edit, crossfade: on })}
      onMode={(mode) => {
        if (mode !== edit.mode) commit({ ...edit, mode });
      }}
    />
  );

  return (
    <NbRoot
      ref={root}
      role="group"
      aria-label="Node Banana's Edit Video editor: four generated clips on a stacked timeline, one row per clip"
      style={{ "--ev-strip": `${GEOMETRY.audioStrip * scale}px` } as CSSProperties}
      onPointerDownCapture={touch}
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">
        Press play, drag a clip along the timeline or onto another row, drag the ruler to scrub, or select a clip to change its
        speed. Option and the arrow keys nudge the selected clip or move it a row; I and O trim it to the playhead.
      </p>
      <div
        data-ev-editor=""
        tabIndex={-1}
        className="nb-ev outline-none"
        style={
          {
            width: W,
            height: H,
            transform: `scale(${scale})`,
            visibility: fit ? "visible" : "hidden",
            "--ev-min-text": `${MIN_TEXT_PX / scale}px`,
          } as CSSProperties
        }
      >
        <div className="flex h-full">
          {paneShown && (
            <MediaPane
              edit={edit}
              selection={selection}
              layout={paneLayout}
              onLayout={setPaneLayout}
              onHide={() => setPaneOpen(false)}
              onPick={setSelection}
              onAddText={addText}
              onAddTextDisabled={!textRoom}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {layout.header && (
              <EditHeader
                compact={layout.header === "compact"}
                paneOpen={layout.header === "full" ? paneShown : null}
                saved={saved}
                canUndo={history.past.length > 0}
                canRedo={history.future.length > 0}
                rendering={rendering}
                onShowMedia={() => setPaneOpen(true)}
                onUndo={undo}
                onRedo={redo}
                onSave={() => setSaved(true)}
                onRender={() => {
                  setToast(null);
                  setRendering(0);
                }}
                onStopRender={() => setRendering(null)}
              />
            )}
            {sideRail ? (
              <div className="flex min-h-0 shrink-0" style={{ height: stageH }}>
                <div className="flex min-w-0 flex-1 flex-col items-center">{stage}</div>
                <EditorRail edit={edit} selection={selection} onCommit={commit} height={stageH} />
              </div>
            ) : (
              <>
                <div className="min-h-0 shrink-0" style={{ height: stageH }}>
                  {stage}
                </div>
                <CompactInspector edit={edit} selection={selection} onCommit={commit} />
              </>
            )}
            <Timeline
              edit={edit}
              width={colW}
              scale={scale}
              addAudio={sideRail}
              clock={clock}
              selection={selection}
              snap={snap}
              onSelect={setSelection}
              onCommit={commit}
              onPause={pause}
              onInteract={touch}
              onAddText={addText}
              onAddTextDisabled={!textRoom}
            />
          </div>
        </div>
        <div role="status" className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center">
          {toast && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[13px] whitespace-nowrap text-neutral-200 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
              {toast}
            </div>
          )}
        </div>
      </div>
      {/* On the right end of the strip under the audio row, which the playhead's line stops above */}
      <DemoHint corner="bottom-right" hidden={touched} className="bottom-0 flex h-[var(--ev-strip)] items-center">
        Drag a clip to any time or row
      </DemoHint>
    </NbRoot>
  );
}
