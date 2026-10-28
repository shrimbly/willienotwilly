"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";

import {
  CheckboxField,
  ControlsCard,
  Field,
  FieldRow,
  HeightGrip,
  LetterMark,
  LoadingOverlay,
  NODE_DEFAULT_W,
  NodeCard,
  NodeVideo,
  NumberField,
  PanelButton,
  PromptSurface,
  RangeField,
  ScrubRow,
  SelectField,
  SummaryValues,
  type NodeCardProps,
  type SocketSpec,
} from "../kit";
import { BezierEditor, type Bezier } from "./bezier-editor";

// The node types the kit has no preset for, built on NodeCard the way the app
// builds them (src/components/nodes/*Node.tsx), plus the schema-driven
// settings panel the generate nodes open into (ModelParameters).

type Shell = Omit<NodeCardProps, "title" | "media" | "gap" | "controls" | "children">;

/** Resizable edges double-click back to the type's default width (store/utils/nodeDefaults.ts), as the app's do. */
function resizeTo(resizable: Shell["resizable"], defaultWidth: number, min?: number): Shell["resizable"] {
  if (!resizable) return resizable;
  return { min, defaultWidth, ...(resizable === true ? {} : resizable) };
}

/* ----------------------------------------------------------------- Sockets */

export const IMAGE_MODEL_INPUTS: SocketSpec[] = [
  { id: "image-0", type: "image", label: "Image" },
  { id: "text-0", type: "text", label: "Prompt" },
];
export const TEXT_SOCKETS: SocketSpec[] = [{ id: "text", type: "text", label: "Text" }];
export const LLM_INPUTS: SocketSpec[] = [
  { id: "image", type: "image", label: "Image" },
  { id: "text", type: "text", label: "Prompt" },
];
export const SPLIT_INPUTS: SocketSpec[] = [{ id: "image", type: "image", label: "Image" }];
export const SPLIT_OUTPUTS: SocketSpec[] = [{ id: "reference", type: "reference", label: "Ref" }];
export const EASE_INPUTS: SocketSpec[] = [
  { id: "video", type: "video", label: "Video In" },
  { id: "easeCurve", type: "easeCurve", label: "Settings" },
];
export const EASE_OUTPUTS: SocketSpec[] = [
  { id: "video", type: "video", label: "Video Out" },
  { id: "easeCurve", type: "easeCurve", label: "Settings" },
];

/* ------------------------------------------------------- Schema parameters */

export type ParamSpec =
  | { kind: "select"; label: string; options: string[]; value: string }
  | { kind: "range"; label: string; min: number; max: number; step: number; value: number; decimals?: number }
  | { kind: "check"; label: string; value: boolean };

/** A model's settings as the app draws its schema: one 22px field per parameter. */
export function SchemaFields({ params }: { params: ReadonlyArray<ParamSpec> }) {
  const [values, setValues] = useState(() => params.map((p) => p.value));
  const set = (i: number, v: string | number | boolean) => setValues((all) => all.map((x, j) => (j === i ? v : x)));
  return (
    <>
      {params.map((p, i) => {
        const v = values[i];
        if (p.kind === "select") return <SelectField key={p.label} label={p.label} value={String(v)} options={p.options} onChange={(x) => set(i, x)} />;
        if (p.kind === "check") return <CheckboxField key={p.label} label={p.label} checked={Boolean(v)} onChange={(x) => set(i, x)} />;
        return (
          <RangeField
            key={p.label}
            label={p.label}
            value={Number(v)}
            min={p.min}
            max={p.max}
            step={p.step}
            format={(x) => x.toFixed(p.decimals ?? 0)}
            onChange={(x) => set(i, x)}
          />
        );
      })}
    </>
  );
}

/* -------------------------------------------------------- Prompt Constructor */

/** Prompt Constructor: Text in and out, the template surface, "Type @ to insert variables". */
export function PromptConstructorNode({ value, height, onHeightChange, ...shell }: Shell & { value: string; height: number; onHeightChange?: (h: number) => void }) {
  return (
    <NodeCard
      {...shell}
      resizable={resizeTo(shell.resizable, NODE_DEFAULT_W.promptConstructor)}
      title="Prompt Constructor"
      inputs={TEXT_SOCKETS}
      outputs={TEXT_SOCKETS}
      media={{ height }}
      controls={<ControlsCard summary={{ title: "Type @ to insert variables" }} />}
    >
      <PromptSurface value={value} />
      <HeightGrip height={height} onChange={onHeightChange} />
    </NodeCard>
  );
}

/* -------------------------------------------------------------- LLM Generate */

const LLM_PROVIDERS = [
  { value: "google", label: "Google" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];
/** The app's dropdowns (src/lib/llm/catalog.ts LLM_MODELS); the first per provider is what a switch picks. */
const LLM_MODELS: Record<string, { value: string; label: string }[]> = {
  google: [
    { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    { value: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
    { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
  openai: [
    { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { value: "gpt-6-astra", label: "GPT-6 Astra" },
  ],
  anthropic: [
    { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { value: "claude-opus-5", label: "Claude Opus 5" },
    { value: "claude-fable-5-1", label: "Claude Fable 5.1" },
  ],
};
/** The saved workflow's model, no longer offered: it stays selectable until another is picked (llmModelOptions). */
const SAVED_MODEL = { value: "gemini-3-flash", label: "Gemini 3 Flash" };
const LETTERS: Record<string, string> = { google: "G", openai: "O", anthropic: "A" };
const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** LLM Generate: Image + Prompt in, Text out, the output text, "G Gemini 3 Flash · temp 0.70". */
export function LlmGenerateNode({ output, height = 160, onRun, ...shell }: Shell & { output: string; height?: number }) {
  const [provider, setProvider] = useState("google");
  const [model, setModel] = useState(SAVED_MODEL.value);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [expanded, setExpanded] = useState(false);
  const models = model === SAVED_MODEL.value ? [...LLM_MODELS[provider], SAVED_MODEL] : LLM_MODELS[provider];
  const label = models.find((m) => m.value === model)?.label ?? models[0].label;
  return (
    <NodeCard
      {...shell}
      resizable={resizeTo(shell.resizable, NODE_DEFAULT_W.llmGenerate)}
      onRun={onRun}
      title="LLM Generate"
      inputs={LLM_INPUTS}
      outputs={TEXT_SOCKETS}
      media={{ height }}
      controls={
        <ControlsCard
          summary={{ icon: <LetterMark letter={LETTERS[provider]} />, title: label, values: <SummaryValues items={[`temp ${temperature.toFixed(2)}`]} /> }}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
        >
          <SelectField
            label="Provider"
            value={provider}
            options={LLM_PROVIDERS}
            onChange={(p) => {
              setProvider(p);
              setModel(LLM_MODELS[p][0].value);
              if (p === "anthropic") setTemperature((t) => Math.min(1, t));
            }}
          />
          <SelectField label="Model" value={model} options={models} onChange={setModel} />
          <RangeField label="Temperature" value={temperature} min={0} max={provider === "anthropic" ? 1 : 2} step={0.01} format={(v) => v.toFixed(2)} onChange={setTemperature} />
          <RangeField label="Max tokens" value={maxTokens} min={256} max={16384} step={256} format={thousands} onChange={setMaxTokens} />
        </ControlsCard>
      }
    >
      <PromptSurface value={output} />
      {shell.running && <LoadingOverlay />}
    </NodeCard>
  );
}

/* ---------------------------------------------------------------- Split Grid */

const MIN_GRID = 1;
const MAX_GRID = 10;
/** The app's default Split Grid width (NODE_DEFAULT_W has no entry for it). */
const SPLIT_GRID_W = 300;

/** Rows / Columns stepper (SplitGridNode's GridDimField). */
function GridDimField({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const clampGrid = (n: number) => Math.min(MAX_GRID, Math.max(MIN_GRID, n));
  const commit = (raw: string) => {
    setDraft(null);
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) onChange(clampGrid(n));
  };
  const stepper =
    "nodrag px-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100 disabled:text-neutral-700 disabled:hover:bg-transparent";
  return (
    <Field label={label} as="div">
      <div className="nb-rounded-well nb-squircle nb-bg-well nb-shadow-well flex h-[22px] items-stretch overflow-hidden focus-within:ring-1 focus-within:ring-neutral-600">
        <button type="button" onClick={() => onChange(clampGrid(value - 1))} disabled={disabled || value <= MIN_GRID} className={stepper} aria-label={`Decrease ${label.toLowerCase()}`}>
          <Minus size={10} strokeWidth={2} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          disabled={disabled}
          aria-label={label}
          className="nodrag nb-text-node w-full min-w-0 bg-transparent text-center font-medium text-neutral-100 focus:outline-none disabled:text-neutral-600"
        />
        <button type="button" onClick={() => onChange(clampGrid(value + 1))} disabled={disabled || value >= MAX_GRID} className={stepper} aria-label={`Increase ${label.toLowerCase()}`}>
          <Plus size={10} strokeWidth={2} />
        </button>
      </div>
    </Field>
  );
}

/** Split Grid: the source image with its blue cell outlines; Rows and Columns redraw them. */
export function SplitGridNode({ image, onRun, ...shell }: Shell & { image: { src: string; width: number; height: number } }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [expanded, setExpanded] = useState(false);
  return (
    <NodeCard
      {...shell}
      resizable={resizeTo(shell.resizable, SPLIT_GRID_W, 240)}
      onRun={onRun}
      title="Split Grid"
      inputs={SPLIT_INPUTS}
      outputs={SPLIT_OUTPUTS}
      media={{ aspect: image.width / image.height }}
      controls={
        <ControlsCard summary={{ title: `${rows}×${cols} grid` }} expanded={expanded} onToggle={() => setExpanded((e) => !e)}>
          <GridDimField label="Rows" value={rows} disabled={shell.running} onChange={setRows} />
          <GridDimField label="Columns" value={cols} disabled={shell.running} onChange={setCols} />
          <FieldRow className="justify-end">
            <PanelButton primary onClick={onRun} disabled={shell.running} className="w-[136px]">
              Split {rows}×{cols} now
            </PanelButton>
          </FieldRow>
        </ControlsCard>
      }
    >
      <Image src={image.src} alt="" width={image.width} height={image.height} unoptimized draggable={false} />
      <div
        className="pointer-events-none absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }, (_, i) => (
          <div key={i} className="border border-blue-400/50" />
        ))}
      </div>
      {shell.running && <LoadingOverlay />}
    </NodeCard>
  );
}

/* ---------------------------------------------------------------- Ease Curve */

type Easing = (t: number) => number;
const easeInExpo: Easing = (t) => (t === 0 ? 0 : 2 ** (10 * t - 10));
const easeOutCubic: Easing = (t) => (t - 1) ** 3 + 1;
const easeInQuart: Easing = (t) => t ** 4;
const easeOutQuad: Easing = (t) => t * (2 - t);
/** createAsymmetricEase: one curve into the midpoint, another out of it. */
const asymmetric = (into: Easing, out: Easing): Easing => (t) => (t <= 0.5 ? 0.5 * into(t * 2) : 0.5 + 0.5 * out((t - 0.5) * 2));

/** The app's presets (src/lib/easing): bezier handles (PRESET_BEZIERS) and the true function (functions.ts). */
const PRESETS: ReadonlyArray<readonly [string, Bezier, Easing]> = [
  ["easeInExpoOutCubic", [0.85, 0, 0.15, 1], asymmetric(easeInExpo, easeOutCubic)],
  ["easeInOutExpo", [0.87, 0, 0.13, 1], (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2)],
  ["easeInQuartOutQuad", [0.8, 0, 0.2, 1], asymmetric(easeInQuart, easeOutQuad)],
  ["easeInOutCubic", [0.65, 0, 0.35, 1], (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)],
  ["easeInOutSine", [0.37, 0, 0.63, 1], (t) => -(Math.cos(Math.PI * t) - 1) / 2],
];

/** easingPolyline(name, 100, 100, 50): the editor's overlay for a picked preset. */
function easingPolyline(fn: Easing, samples = 50): string {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    return `${(t * 100).toFixed(1)},${((1 - fn(t)) * 100).toFixed(1)}`;
  }).join(" ");
}

/** The site's curve: M0 100 C 80.42 74.62, 18.32 13.77, 100 0. */
const SITE_CURVE: Bezier = [0.8042, 0.2538, 0.1832, 0.8623];

/**
 * Ease Curve: video and settings in and out, the eased clip with its scrub
 * row, and the controls card held open on the curve editor, narrowed to
 * 216px so the square sets its width.
 */
export function EaseCurveNode({
  video,
  playing,
  onRun,
  ...shell
}: Shell & { video: { src: string; poster: string; width: number; height: number; duration: number }; playing: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [curve, setCurve] = useState<Bezier>(SITE_CURVE);
  const [preset, setPreset] = useState<string | null>(null);
  const [duration, setDuration] = useState(1.5);
  const [expanded, setExpanded] = useState(true);
  const following = PRESETS[(PRESETS.findIndex(([name]) => name === preset) + 1) % PRESETS.length];
  const active = PRESETS.find(([name]) => name === preset);
  const nextPreset = () => {
    setPreset(following[0]);
    setCurve([...following[1]]);
  };
  return (
    <NodeCard
      {...shell}
      resizable={resizeTo(shell.resizable, NODE_DEFAULT_W.easeCurve, 300)}
      onRun={onRun}
      title="Ease Curve"
      inputs={EASE_INPUTS}
      outputs={EASE_OUTPUTS}
      media={{ aspect: video.width / video.height }}
      gap={<ScrubRow videoRef={ref} src={video.src} duration={video.duration} />}
      controls={
        <ControlsCard
          className="max-w-[216px]"
          summary={{ title: "Ease curve", values: <SummaryValues items={[preset ?? "custom", `${duration.toFixed(1)}s`]} /> }}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
        >
          <FieldRow className="justify-between">
            <span className="nb-text-node text-neutral-400">Easing function</span>
            <button
              type="button"
              onClick={nextPreset}
              aria-label={`Presets, next: ${following[0]}`}
              title={`Next preset: ${following[0]}`}
              className="nodrag nb-rounded-well nb-squircle nb-text-node h-[22px] bg-neutral-700 px-2 text-neutral-200 transition-colors hover:bg-neutral-600"
            >
              Presets
            </button>
          </FieldRow>
          <BezierEditor
            value={curve}
            easingCurve={active ? easingPolyline(active[2]) : undefined}
            onChange={(v) => {
              setCurve(v);
              setPreset(null);
            }}
          />
          {preset && <span className="nb-text-node text-neutral-500">Current: {preset}</span>}
          <NumberField label="Duration" unit="s" value={duration} min={0.1} max={30} step={0.1} onChange={setDuration} />
          <FieldRow className="justify-end">
            <PanelButton onClick={onRun} disabled={shell.running}>
              {shell.running ? "Applying..." : "Apply"}
            </PanelButton>
          </FieldRow>
        </ControlsCard>
      }
    >
      <NodeVideo ref={ref} src={video.src} poster={video.poster} playing={playing && !shell.running} />
      {shell.running && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-900/70">
          <LoadingOverlay className="relative inset-auto bg-transparent" />
          <span className="text-xs text-white">Processing...</span>
        </div>
      )}
    </NodeCard>
  );
}
