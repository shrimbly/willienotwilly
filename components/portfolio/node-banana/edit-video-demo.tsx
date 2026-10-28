"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";

import { EditHeader, MediaPane } from "./edit-video/chrome";
import { createClock } from "./edit-video/clock";
import { EDIT_NAME, FRAME_ASPECT, INITIAL_EDIT, RESTING_PLAYHEAD } from "./edit-video/data";
import { MAX_START_SEC, clamp, formatTimecode, moveItem, placedClips, sequenceEnd, type EvEdit, type EvText } from "./edit-video/model";
import { CompactInspector, EditorRail } from "./edit-video/rail";
import { Stage } from "./edit-video/stage";
import { HEADER_PX, MEDIA_PANE_PX, RAIL_PX } from "./edit-video/styles";
import { Timeline, timelineHeight, type Selection } from "./edit-video/timeline";
import { NbRoot } from "./kit";
import "./edit-video/edit-video.css";

type Layout = "wide" | "medium" | "narrow";

/**
 * The least room each layout is drawn at, in the editor's own px: the editor is laid out at that size and scaled down
 * to the tile, so a small tile shows the real editor smaller rather than a different one. Wide keeps the media pane;
 * narrow drops it and folds the rail into a strip under the preview.
 */
const NEEDS: Record<Layout, { w: number; h: number }> = {
  wide: { w: 1180, h: HEADER_PX + 330 + timelineHeight(false) },
  medium: { w: 880, h: HEADER_PX + 300 + timelineHeight(false) },
  narrow: { w: 470, h: 48 + 216 + 52 + timelineHeight(true) },
};

function fitEditor(width: number, height: number) {
  const layout: Layout = width < 600 ? "narrow" : width < 860 ? "medium" : "wide";
  const need = NEEDS[layout];
  const scale = Math.min(1, width / need.w, height / need.h);
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
  const { active, inView, reducedMotion } = useDemoActive(root);
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
    return () => observer.disconnect();
  }, []);

  // While the tile is on screen and nobody has touched it, it plays the edit so the stacking reads at a glance
  const isPlaying = touched ? playing : active;
  const running = isPlaying && inView && (active || reducedMotion);
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

  // The render's progress, then its toast
  useEffect(() => {
    if (rendering === null) return;
    const id = window.setTimeout(() => {
      if (rendering >= 100) {
        setRendering(null);
        setToast(`Rendered “${EDIT_NAME}” · ${formatTimecode(end, 0)}`);
      } else {
        setRendering(Math.min(100, rendering + 100 / (RENDER_MS / 60)));
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [rendering, end]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

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
  const pause = () => setPlaying(false);

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
    if (target.closest("input, textarea, select, [contenteditable]")) return;
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
    // Space plays and pauses, unless a button or switch has focus (its own Space presses it)
    if (event.key === " " && !mod && !target.closest("button, [role=switch]")) {
      event.preventDefault();
      touch();
      setPlaying(!isPlaying);
    }
  };

  const fit = size ? fitEditor(size.w, size.h) : null;
  const layout: Layout = fit?.layout ?? "wide";
  const scale = fit?.scale ?? 1;
  const W = fit?.width ?? NEEDS.wide.w;
  const H = fit?.height ?? NEEDS.wide.h;
  const narrow = layout === "narrow";
  const paneShown = !narrow && (paneOpen ?? layout === "wide");
  const colW = W - (paneShown ? MEDIA_PANE_PX : 0);
  const timelineH = timelineHeight(narrow);
  const headerH = narrow ? 48 : HEADER_PX;
  const stageH = H - headerH - timelineH - (narrow ? 52 : 0);
  const stageW = narrow ? colW : colW - RAIL_PX;
  const padX = narrow ? 12 : 32;
  const padY = narrow ? 8 : 24;
  const room = { w: Math.max(80, stageW - padX * 2), h: Math.max(60, stageH - padY * (narrow ? 1 : 2) - 56) };
  const frame =
    room.w / room.h > FRAME_ASPECT
      ? { width: room.h * FRAME_ASPECT, height: room.h }
      : { width: room.w, height: room.w / FRAME_ASPECT };
  const rowWidth = narrow ? room.w : Math.min(room.w, Math.max(frame.width, 576));
  const padTop = narrow ? padY : Math.max(16, (stageH - frame.height - 56) / 2);

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
      onTogglePlay={() => setPlaying((p) => !p)}
      onGoTo={(where) => {
        pause();
        clock.set(where === "start" ? 0 : end);
      }}
      onSoundOn={setSoundOn}
      onSnap={setSnap}
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
      onPointerDownCapture={touch}
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">
        Press play, drag a clip along the timeline or onto another row, drag the ruler to scrub, or select a clip to change its
        speed. Option and the arrow keys nudge the selected clip or move it a row.
      </p>
      <div
        data-ev-editor=""
        tabIndex={-1}
        className="nb-ev outline-none"
        style={{ width: W, height: H, transform: `scale(${scale})`, visibility: fit ? "visible" : "hidden" }}
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
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <EditHeader
              compact={narrow}
              paneOpen={narrow ? null : paneShown}
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
            {narrow ? (
              <>
                <div className="min-h-0 shrink-0" style={{ height: stageH }}>
                  {stage}
                </div>
                <CompactInspector edit={edit} selection={selection} onCommit={commit} />
              </>
            ) : (
              <div className="flex min-h-0 shrink-0" style={{ height: stageH }}>
                <div className="flex min-w-0 flex-1 flex-col items-center">{stage}</div>
                <EditorRail edit={edit} selection={selection} onCommit={commit} height={stageH} />
              </div>
            )}
            <Timeline
              edit={edit}
              width={colW}
              scale={scale}
              compact={narrow}
              clock={clock}
              selection={selection}
              snap={snap}
              hint={!touched}
              onSelect={setSelection}
              onCommit={commit}
              onPause={pause}
              onInteract={touch}
              onAddText={addText}
              onAddTextDisabled={!textRoom}
            />
          </div>
        </div>
        {toast && (
          <div
            role="status"
            className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[13px] whitespace-nowrap text-neutral-200 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
          >
            {toast}
          </div>
        )}
      </div>
    </NbRoot>
  );
}
