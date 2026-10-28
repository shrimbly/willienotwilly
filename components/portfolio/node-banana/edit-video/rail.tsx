"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { TimerReset } from "lucide-react";

import { cn } from "@/lib/utils";

import { SOURCE_BY_ID } from "./data";
import {
  MAX_START_SEC,
  MIN_CLIP_SEC,
  RAMP_PRESETS,
  SPEED_PRESETS,
  audioLength,
  clamp,
  clipLength,
  clipName,
  easingLabel,
  easingPolyline,
  formatSeconds,
  formatSpeed,
  nudgeSpeed,
  overlayFirstLine,
  parseSpeed,
  rampEase,
  rampModeOf,
  seedRamp,
  sliderToSpeed,
  speedToSlider,
  EASINGS,
  type EvAudio,
  type EvClip,
  type EvEdit,
  type EvText,
  type RampCurve,
  type RampMode,
} from "./model";
import {
  RailAction,
  RailField,
  RailFields,
  RailLabel,
  RailNote,
  RailRow,
  RailSegments,
  RailSlider,
  RailSwitch,
  RailTitle,
  TimecodeField,
} from "./parts";
import { EDIT_LINE, HEADER_TITLE, INK_3, SEGMENT_OFF, SEGMENT_ON } from "./styles";
import type { Selection } from "./timeline";

const FRAME = 1 / 60;
const THUMB_PX = 24;
const THUMBS = RAMP_PRESETS.map((name) => ({ name, label: easingLabel(name), points: easingPolyline(EASINGS[name], THUMB_PX, THUMB_PX, 20) }));
const MODES: ReadonlyArray<{ mode: RampMode; label: string }> = [
  { mode: "none", label: "None" },
  { mode: "preset", label: "Preset" },
  { mode: "bezier", label: "Bezier" },
  { mode: "points", label: "Points" },
];
const WEIGHTS = [400, 500, 600, 700];
const TEXT_AREA =
  "block max-h-[180px] min-h-[76px] w-full min-w-0 resize-none rounded-md border-0 bg-[var(--nb-edit-field)] px-2.5 py-2 text-[13px] leading-5 text-neutral-200 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40";

export interface RailProps {
  edit: EvEdit;
  selection: Selection;
  onCommit: (next: EvEdit, coalesce?: string) => void;
}

const patchClip = (edit: EvEdit, id: string, patch: (c: EvClip) => EvClip): EvEdit => ({
  ...edit,
  clips: edit.clips.map((c) => (c.id === id ? patch(c) : c)),
});
const patchText = (edit: EvEdit, id: string, patch: Partial<EvText>): EvEdit => ({
  ...edit,
  texts: edit.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
});
const patchAudio = (edit: EvEdit, patch: Partial<EvAudio>): EvEdit => ({ ...edit, audio: { ...edit.audio, ...patch } });

/** Speed keeps the clip's start; its length follows (clipLength). */
const withSpeed = (c: EvClip, speed: number): EvClip => ({ ...c, speed: clamp(speed, 0.1, 10) });

/** In keeps the frames where they are in time: the start moves with it (trimClipInPlace). */
function withIn(c: EvClip, inSec: number): EvClip {
  const next = clamp(inSec, Math.max(0, c.inSec - c.start * c.speed), c.outSec - MIN_CLIP_SEC * c.speed);
  return { ...c, inSec: next, start: c.start + (next - c.inSec) / c.speed };
}
function withOut(c: EvClip, outSec: number): EvClip {
  const duration = SOURCE_BY_ID.get(c.source)?.duration ?? c.outSec;
  return { ...c, outSec: clamp(outSec, c.inSec + MIN_CLIP_SEC * c.speed, duration) };
}

/** The ramp presets as curve thumbnails, one tab stop: the arrows move, a press picks (EasePicker.tsx). */
function PresetGrid({ name, onPick }: { name: string; onPick: (name: (typeof RAMP_PRESETS)[number]) => void }) {
  const pressed = THUMBS.findIndex((t) => t.name === name);
  const stop = pressed === -1 ? 0 : pressed;
  return (
    <div
      role="group"
      aria-label="Ramp presets"
      className="mt-2 grid grid-cols-6 gap-0.5 rounded-lg bg-[var(--nb-edit-field)] p-0.5"
      onKeyDown={(event) => {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (at === -1) return;
        const moves: Record<string, number> = { ArrowLeft: at - 1, ArrowRight: at + 1, ArrowUp: at - 6, ArrowDown: at + 6, Home: 0, End: buttons.length - 1 };
        if (!(event.key in moves)) return;
        event.preventDefault();
        buttons[clamp(moves[event.key], 0, buttons.length - 1)].focus();
      }}
    >
      {THUMBS.map((thumb, i) => (
        <button
          key={thumb.name}
          type="button"
          aria-pressed={i === pressed}
          aria-label={thumb.label}
          title={thumb.label}
          tabIndex={i === stop ? 0 : -1}
          onClick={() => onPick(thumb.name)}
          className={cn(
            "flex aspect-square items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none",
            i === pressed ? SEGMENT_ON : SEGMENT_OFF,
          )}
        >
          <svg aria-hidden="true" viewBox={`0 0 ${THUMB_PX} ${THUMB_PX}`} className="h-6 w-6 overflow-visible">
            <polyline points={thumb.points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** A bezier or points ramp, drawn read-only: source progress up, the clip's time across, over its average. */
function RampPreview({ ramp }: { ramp: RampCurve }) {
  const W = 240;
  const H = 56;
  const inset = 6;
  const width = W - 2 * inset;
  const span = H - 2 * inset;
  const ease = rampEase(ramp);
  const y = (q: number) => inset + (1 - clamp(q, 0, 1)) * span;
  const line = Array.from({ length: 61 }, (_, k) => `${(inset + (k / 60) * width).toFixed(1)},${y(ease(k / 60)).toFixed(1)}`).join(" ");
  const knots = ramp.kind === "points" ? ramp.points.slice(1, -1) : [];
  return (
    <svg aria-hidden="true" width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="mt-2 block rounded-lg bg-[var(--nb-edit-field)]">
      <line x1={inset} y1={y(0)} x2={inset + width} y2={y(1)} strokeWidth={1} strokeDasharray="3 3" className="stroke-white/10" />
      {ramp.kind === "bezier" && (
        <>
          <line x1={inset} y1={y(0)} x2={inset + ramp.handles[0] * width} y2={y(ramp.handles[1])} strokeWidth={1} className="stroke-white/25" />
          <line x1={inset + width} y1={y(1)} x2={inset + ramp.handles[2] * width} y2={y(ramp.handles[3])} strokeWidth={1} className="stroke-white/25" />
          <circle cx={inset + ramp.handles[0] * width} cy={y(ramp.handles[1])} r={3} className="fill-neutral-100" />
          <circle cx={inset + ramp.handles[2] * width} cy={y(ramp.handles[3])} r={3} className="fill-neutral-100" />
        </>
      )}
      <polyline points={line} fill="none" strokeWidth={1.5} strokeLinejoin="round" className="stroke-neutral-100" />
      {knots.map(([p, q]) => (
        <circle key={p} cx={inset + p * width} cy={y(q)} r={2.5} className="fill-neutral-100" />
      ))}
    </svg>
  );
}

function ClipRail({ edit, clip, row, onCommit }: { edit: EvEdit; clip: EvClip; row: number; onCommit: RailProps["onCommit"] }) {
  const source = SOURCE_BY_ID.get(clip.source);
  const duration = source?.duration ?? clip.outSec;
  const length = clipLength(clip);
  const sourceLength = clip.outSec - clip.inSec;
  const full = formatSeconds(duration);
  // railDetail in an edit: the library's clips carry no kind, so the line is the length, "4.00 s of 5.08 s"
  const detail = formatSeconds(sourceLength) === full ? full : `${formatSeconds(sourceLength)} of ${full}`;
  const set = (patch: (c: EvClip) => EvClip, coalesce?: string) => onCommit(patchClip(edit, clip.id, patch), coalesce);
  const pos = Math.round(speedToSlider(clip.speed));
  const mode = rampModeOf(clip.ramp);
  const stacked = edit.mode === "stacked";
  return (
    <>
      <RailTitle title={`${clipName(row)} of ${edit.clips.length}`} lines={[detail]} />

      <RailFields>
        {stacked && (
          <RailField label="Start" hint="Start on the timeline">
            <TimecodeField
              label="Start on the timeline"
              value={clip.start}
              onCommit={(sec) => set((c) => ({ ...c, start: clamp(sec, 0, MAX_START_SEC) }))}
              onNudge={(dir, big) => set((c) => ({ ...c, start: clamp(c.start + dir * (big ? 10 : 1) * FRAME, 0, MAX_START_SEC) }), `start:${clip.id}`)}
            />
          </RailField>
        )}
        <RailField label="In" hint="In at the playhead" shortcut="I">
          <TimecodeField label="In" value={clip.inSec} onCommit={(sec) => set((c) => withIn(c, sec))} />
        </RailField>
        <RailField label="Out" hint="Out at the playhead" shortcut="O" last>
          <TimecodeField label="Out" value={clip.outSec} onCommit={(sec) => set((c) => withOut(c, sec))} />
        </RailField>
      </RailFields>

      <div className="mt-7">
        <RailRow label="Sound">
          <RailSwitch label="Sound" checked={!clip.muted} onChange={(on) => set((c) => ({ ...c, muted: !on }))} />
        </RailRow>
        <RailSlider
          label="Volume"
          ariaLabel="Clip volume"
          value={Math.round(clip.volume * 100)}
          disabled={clip.muted}
          onChange={(pct) => set((c) => ({ ...c, volume: pct / 100 }), `volume:${clip.id}`)}
        />
      </div>

      <div className="mt-5">
        <div className="flex h-8 items-center gap-3">
          <span className="w-[52px] shrink-0 text-[13px] text-neutral-300">Speed</span>
          <input
            type="range"
            aria-label="Clip speed"
            aria-valuetext={formatSpeed(clip.speed)}
            min={0}
            max={100}
            step={1}
            value={pos}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (next !== pos) set((c) => withSpeed(c, sliderToSpeed(next)), `speed:${clip.id}`);
            }}
            className="nb-ev-range min-w-0 flex-1"
            style={{ "--p": `${pos}%` } as CSSProperties}
          />
          <div className="w-[76px] shrink-0">
            <TimecodeField
              label="Speed"
              value={clip.speed}
              format={formatSpeed}
              parse={parseSpeed}
              onCommit={(value) => set((c) => withSpeed(c, value))}
              onNudge={(dir, big) => set((c) => withSpeed(c, nudgeSpeed(c.speed, dir, big)), `speed:${clip.id}`)}
            />
          </div>
        </div>
        <RailSegments
          label="Speed presets"
          className="mt-2"
          segments={SPEED_PRESETS.map((value) => ({
            label: formatSpeed(value),
            pressed: clip.speed === value,
            onClick: () => set((c) => withSpeed(c, value)),
          }))}
        />
        {clip.speed !== 1 && <RailNote>{`Lasts ${formatSeconds(length)} on the timeline.`}</RailNote>}
        {!clip.ramp && (clip.speed > 4 || clip.speed < 0.25) && <RailNote>No sound above 4× or below 0.25×.</RailNote>}
      </div>

      <div className="mt-5">
        <RailLabel>Ramp</RailLabel>
        <RailSegments
          label="Ramp"
          segments={MODES.map(({ mode: m, label }) => ({
            label,
            pressed: mode === m,
            onClick: () => {
              if (m !== mode) set((c) => ({ ...c, ramp: seedRamp(m, c.ramp) }));
            },
          }))}
        />
        {clip.ramp?.kind === "preset" && (
          <PresetGrid name={clip.ramp.name} onPick={(name) => set((c) => ({ ...c, ramp: { kind: "preset", name } }))} />
        )}
        {clip.ramp && clip.ramp.kind !== "preset" && <RampPreview ramp={clip.ramp} />}
      </div>

      {(clip.speed !== 1 || clip.ramp) && (
        <div className="mt-auto flex flex-col pt-6">
          <RailAction
            icon={<TimerReset size={16} strokeWidth={1.5} />}
            label="Reset speed"
            onClick={() => set((c) => ({ ...c, speed: 1, ramp: null }))}
          />
        </div>
      )}
    </>
  );
}

function TextRail({ edit, text, index, onCommit }: { edit: EvEdit; text: EvText; index: number; onCommit: RailProps["onCommit"] }) {
  const set = (patch: Partial<EvText>, coalesce?: string) => onCommit(patchText(edit, text.id, patch), coalesce);
  const length = text.endSec - text.startSec;
  return (
    <>
      <RailTitle title={overlayFirstLine(text.text) ?? "Empty text"} lines={[`Text ${index + 1} · ${formatSeconds(length)}`]} />
      <div className="mt-7">
        <RailField label="Text">
          <textarea
            rows={3}
            maxLength={2000}
            value={text.text}
            spellCheck={false}
            onChange={(event) => set({ text: event.target.value }, `text:${text.id}`)}
            className={TEXT_AREA}
          />
        </RailField>
      </div>
      <div className="mt-5">
        <RailLabel>Weight</RailLabel>
        <RailSegments
          label="Weight"
          segments={WEIGHTS.map((weight) => ({ label: String(weight), pressed: text.weight === weight, onClick: () => set({ weight }) }))}
        />
      </div>
      <div className="mt-5">
        <RailSlider label="Wash" ariaLabel="Wash" value={Math.round(text.wash * 100)} onChange={(pct) => set({ wash: pct / 100 }, `wash:${text.id}`)} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <RailField label="Fade in">
          <TimecodeField
            label="Fade in"
            value={text.fadeInSec}
            format={(v) => formatSeconds(v, 1)}
            onCommit={(v) => set({ fadeInSec: clamp(v, 0, length) })}
            onNudge={(dir, big) => set({ fadeInSec: clamp(text.fadeInSec + dir * (big ? 1 : 0.1), 0, length) }, `fadein:${text.id}`)}
          />
        </RailField>
        <RailField label="Fade out" last>
          <TimecodeField
            label="Fade out"
            value={text.fadeOutSec}
            format={(v) => formatSeconds(v, 1)}
            onCommit={(v) => set({ fadeOutSec: clamp(v, 0, length) })}
            onNudge={(dir, big) => set({ fadeOutSec: clamp(text.fadeOutSec + dir * (big ? 1 : 0.1), 0, length) }, `fadeout:${text.id}`)}
          />
        </RailField>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <RailField label="Start" hint="Start on the timeline">
          <TimecodeField
            label="Start on the timeline"
            value={text.startSec}
            onCommit={(v) => {
              const start = clamp(v, 0, MAX_START_SEC);
              set({ startSec: start, endSec: start + length });
            }}
          />
        </RailField>
        <RailField label="Length" last>
          <TimecodeField
            label="Length"
            value={length}
            format={(v) => formatSeconds(v)}
            onCommit={(v) => set({ endSec: text.startSec + clamp(v, MIN_CLIP_SEC, MAX_START_SEC) })}
          />
        </RailField>
      </div>
    </>
  );
}

function AudioRail({ edit, onCommit }: { edit: EvEdit; onCommit: RailProps["onCommit"] }) {
  const a = edit.audio;
  const set = (patch: Partial<EvAudio>, coalesce?: string) => onCommit(patchAudio(edit, patch), coalesce);
  const length = audioLength(a);
  return (
    <>
      <RailTitle title="Audio 1" lines={[a.name, `${formatSeconds(length)} of ${formatSeconds(a.duration)}`]} />
      <RailFields>
        <RailField label="Start" hint="Start on the timeline">
          <TimecodeField label="Start on the timeline" value={a.startSec} onCommit={(v) => set({ startSec: clamp(v, 0, MAX_START_SEC) })} />
        </RailField>
        <RailField label="In" hint="In at the playhead" shortcut="I">
          <TimecodeField
            label="In"
            value={a.inSec}
            onCommit={(v) => {
              const inSec = clamp(v, 0, a.outSec - MIN_CLIP_SEC);
              set({ inSec, startSec: Math.max(0, a.startSec + (inSec - a.inSec)) });
            }}
          />
        </RailField>
        <RailField label="Out" hint="Out at the playhead" shortcut="O" last>
          <TimecodeField label="Out" value={a.outSec} onCommit={(v) => set({ outSec: clamp(v, a.inSec + MIN_CLIP_SEC, a.duration) })} />
        </RailField>
      </RailFields>
      <div className="mt-7">
        <RailRow label="Sound">
          <RailSwitch label="Sound" checked={!a.muted} onChange={(on) => set({ muted: !on })} />
        </RailRow>
      </div>
      <div className="mt-3">
        <div className={cn("mb-2 text-xs leading-3", INK_3)}>Volume</div>
        <RailSegments
          label="Volume curve"
          segments={[
            { label: "Flat", pressed: !a.fade.in && !a.fade.out, disabled: a.muted, onClick: () => set({ fade: { in: false, out: false } }) },
            { label: "Fade in", pressed: a.fade.in, disabled: a.muted, onClick: () => set({ fade: { ...a.fade, in: !a.fade.in } }) },
            { label: "Fade out", pressed: a.fade.out, disabled: a.muted, onClick: () => set({ fade: { ...a.fade, out: !a.fade.out } }) },
          ]}
        />
      </div>
    </>
  );
}

/** The 280px rail beside the stage (EditorRail.tsx): the selected clip, text layer or audio clip. */
export function EditorRail({ edit, selection, onCommit, height }: RailProps & { height: number }) {
  const ref = useRef<HTMLElement>(null);
  const key = selection ? `${selection.kind}:${selection.id}` : "none";
  // A new selection shows the rail from its top
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [key]);
  let body: ReactNode = null;
  let label = "Clip";
  if (selection?.kind === "clip") {
    const row = edit.clips.findIndex((c) => c.id === selection.id);
    if (row >= 0) body = <ClipRail edit={edit} clip={edit.clips[row]} row={row} onCommit={onCommit} />;
  } else if (selection?.kind === "text") {
    const index = edit.texts.findIndex((t) => t.id === selection.id);
    label = "Text";
    if (index >= 0) body = <TextRail edit={edit} text={edit.texts[index]} index={index} onCommit={onCommit} />;
  } else if (selection?.kind === "audio") {
    label = "Audio clip";
    body = <AudioRail edit={edit} onCommit={onCommit} />;
  }
  return (
    <aside
      ref={ref}
      aria-label={label}
      className={cn("w-[280px] shrink-0 overflow-y-auto border-l", EDIT_LINE)}
      style={{ height }}
    >
      <div className="flex min-h-full flex-col p-5">
        {body ?? <p className={cn("text-[13px] leading-5", INK_3)}>Select a clip to edit it.</p>}
      </div>
    </aside>
  );
}

/** Narrow: the rail as one row under the preview, with what matters most for the selection. */
export function CompactInspector({ edit, selection, onCommit }: RailProps) {
  let body: ReactNode = <p className={cn("text-[13px]", INK_3)}>Select a clip to edit it.</p>;
  if (selection?.kind === "clip") {
    const row = edit.clips.findIndex((c) => c.id === selection.id);
    const clip = edit.clips[row];
    if (clip) {
      body = (
        <>
          <div className="flex w-[92px] shrink-0 flex-col">
            <span className={cn(HEADER_TITLE, "truncate text-[14px] leading-4")}>{`${clipName(row)} of ${edit.clips.length}`}</span>
            <span className={cn("mt-0.5 truncate text-[11px] leading-4 tabular-nums", INK_3)}>{formatSeconds(clipLength(clip))}</span>
          </div>
          <RailSegments
            label="Speed presets"
            className="min-w-0 flex-1"
            segments={SPEED_PRESETS.map((value) => ({
              label: formatSpeed(value),
              pressed: clip.speed === value,
              onClick: () => onCommit(patchClip(edit, clip.id, (c) => withSpeed(c, value))),
            }))}
          />
        </>
      );
    }
  } else if (selection?.kind === "text") {
    const text = edit.texts.find((t) => t.id === selection.id);
    if (text) {
      body = (
        <label className="flex min-w-0 flex-1 items-center gap-3">
          <span className={cn(HEADER_TITLE, "shrink-0 text-[14px]")}>Text</span>
          <input
            type="text"
            value={text.text}
            maxLength={2000}
            spellCheck={false}
            onChange={(event) => onCommit(patchText(edit, text.id, { text: event.target.value }), `text:${text.id}`)}
            className="h-8 w-full min-w-0 rounded-md border-0 bg-[var(--nb-edit-field)] px-2.5 text-[13px] text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          />
        </label>
      );
    }
  } else if (selection?.kind === "audio") {
    body = (
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className={cn(HEADER_TITLE, "text-[14px] leading-4")}>Audio 1</span>
          <span className={cn("mt-0.5 truncate text-[11px] leading-4", INK_3)}>{edit.audio.name}</span>
        </div>
        <RailRow label="Sound">
          <RailSwitch label="Sound" checked={!edit.audio.muted} onChange={(on) => onCommit(patchAudio(edit, { muted: !on }))} />
        </RailRow>
      </div>
    );
  }
  return (
    <div className={cn("flex h-[52px] shrink-0 items-center gap-3 border-t px-3", EDIT_LINE)} aria-label="Inspector" role="region">
      {body}
    </div>
  );
}
