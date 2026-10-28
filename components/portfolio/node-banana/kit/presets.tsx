"use client";

import { useState, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { CarouselControls, ScrubRow } from "./gap-row";
import { ControlsCard, SummaryValues } from "./controls-card";
import { CheckboxField, SelectField } from "./fields";
import type { SocketSpec } from "./geometry";
import { EmptyState, LoadingOverlay, MediaTools, NodeVideo, PromptSurface, RunBatchChip, HeightGrip } from "./media";
import {
  GEMINI_IMAGE_MODELS,
  GEMINI_IMAGE_OPTIONS,
  MODEL_DISPLAY_NAMES,
  formatCost,
  imageCost,
  parseAspectRatio,
  type AspectRatio,
  type GeminiImageModel,
  type Resolution,
} from "./models";
import { NodeCard, type NodeCardProps } from "./node-card";
import { ProviderBadge, type ProviderId } from "./provider-badge";

// The app's own node types, composed from NodeCard with their real sockets,
// summary rows and settings (src/components/nodes/*.tsx). Every NodeCard prop
// still passes through (graph, id, selected, onSelect, running, shimmer…).

type ShellProps = Omit<NodeCardProps, "title" | "media" | "gap" | "controls" | "children">;

export interface NodeImage {
  src: string;
  width: number;
  height: number;
  alt?: string;
}

function NodeImg({ image, priority }: { image: NodeImage; priority?: boolean }) {
  return (
    <Image
      src={image.src}
      alt={image.alt ?? ""}
      width={image.width}
      height={image.height}
      unoptimized
      draggable={false}
      priority={priority}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/* ------------------------------------------------------------ Generate Image */

export interface GenerateImageSettings {
  model: GeminiImageModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  googleSearch: boolean;
  imageSearch: boolean;
}

export const GENERATE_IMAGE_DEFAULTS: GenerateImageSettings = {
  model: "nano-banana-pro",
  aspectRatio: "16:9",
  resolution: "2K",
  googleSearch: false,
  imageSearch: false,
};

/** GenerateImageNode's sockets: Image and Prompt in, Image out. */
export const GENERATE_IMAGE_INPUTS: SocketSpec[] = [
  { id: "image", type: "image", label: "Image" },
  { id: "text", type: "text", label: "Prompt" },
];
export const GENERATE_IMAGE_OUTPUTS: SocketSpec[] = [{ id: "image", type: "image", label: "Image" }];

export interface GenerateImageNodeProps extends ShellProps {
  /** Header title; the app shows the model's name ("Nano Banana Pro"). */
  title?: string;
  /** The output on show. The media card takes its proportions; without one it follows the aspect ratio setting. */
  image?: NodeImage | null;
  /** History carousel in the gap row (shown when count > 1). */
  history?: { index: number; count: number; onPrev?: () => void; onNext?: () => void };
  /** "RUN 2 OF 3 · 14:02" on hover. */
  batch?: { index: number; count: number; time?: string };
  /** Gemini settings. Controlled with onSettingsChange, otherwise the node keeps its own from these. */
  settings?: Partial<GenerateImageSettings>;
  onSettingsChange?: (settings: GenerateImageSettings) => void;
  /** Settings panel open at first (the app opens it by default; demos usually start closed). */
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Another provider: its badge, model name, summary values and settings fields replace the Gemini ones. */
  provider?: ProviderId;
  modelLabel?: string;
  values?: ReadonlyArray<ReactNode>;
  fields?: ReactNode;
  onDownload?: () => void;
  onClear?: () => void;
  /** Extra layers over the image (a reveal, a scan line). */
  overlay?: ReactNode;
  priority?: boolean;
}

/**
 * Generate Image with its real anatomy: the model as the header picker, Image
 * and Prompt sockets in, Image out, the media at the output's proportions,
 * the history carousel in the gap row, and the controls card whose summary
 * ("✦ Nano Banana Pro · 16:9 · 2K") opens into Model, Aspect ratio,
 * Resolution and the search checkboxes, as each model allows.
 */
export function GenerateImageNode({
  title,
  image,
  history,
  batch,
  settings: settingsProp,
  onSettingsChange,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  provider = "gemini",
  modelLabel,
  values,
  fields,
  onDownload,
  onClear,
  overlay,
  priority,
  running = false,
  inputs = GENERATE_IMAGE_INPUTS,
  outputs = GENERATE_IMAGE_OUTPUTS,
  ...shell
}: GenerateImageNodeProps) {
  const [own, setOwn] = useState<GenerateImageSettings>(() => ({ ...GENERATE_IMAGE_DEFAULTS, ...settingsProp }));
  const settings = onSettingsChange ? { ...GENERATE_IMAGE_DEFAULTS, ...settingsProp } : own;
  const update = (patch: Partial<GenerateImageSettings>) => {
    const next = { ...settings, ...patch };
    if (onSettingsChange) onSettingsChange(next);
    else setOwn(next);
  };
  const [expandedOwn, setExpandedOwn] = useState(defaultExpanded);
  const expanded = expandedProp ?? expandedOwn;
  const toggle = () => {
    setExpandedOwn(!expanded);
    onExpandedChange?.(!expanded);
  };

  const gemini = provider === "gemini";
  const options = GEMINI_IMAGE_OPTIONS[settings.model];
  const name = modelLabel ?? (gemini ? MODEL_DISPLAY_NAMES[settings.model] : "Select model...");
  const summaryValues = values ?? (gemini ? [settings.aspectRatio, options.resolutions.length > 0 ? settings.resolution : null] : []);
  const aspect = image ? image.width / image.height : parseAspectRatio(settings.aspectRatio);

  const panel = gemini ? (
    <>
      <SelectField label="Model" value={settings.model} options={GEMINI_IMAGE_MODELS} onChange={(v) => update({ model: v as GeminiImageModel })} />
      <SelectField label="Aspect ratio" value={settings.aspectRatio} options={options.aspectRatios} onChange={(v) => update({ aspectRatio: v as AspectRatio })} />
      {options.resolutions.length > 0 && (
        <SelectField label="Resolution" value={settings.resolution} options={options.resolutions} onChange={(v) => update({ resolution: v as Resolution })} />
      )}
      {options.googleSearch && <CheckboxField label="Google Search" checked={settings.googleSearch} onChange={(c) => update({ googleSearch: c })} />}
      {options.imageSearch && <CheckboxField label="Image Search" checked={settings.imageSearch} onChange={(c) => update({ imageSearch: c })} />}
    </>
  ) : (
    fields
  );

  return (
    <NodeCard
      {...shell}
      title={title ?? name}
      provider={shell.titleIcon ? undefined : provider}
      running={running}
      inputs={inputs}
      outputs={outputs}
      media={{ aspect }}
      gap={history && history.count > 1 ? <CarouselControls {...history} noun="image" /> : undefined}
      controls={
        <ControlsCard
          summary={{ icon: <ProviderBadge provider={provider} />, title: name, values: <SummaryValues items={summaryValues} /> }}
          expanded={expanded}
          onToggle={panel ? toggle : undefined}
        >
          {panel}
        </ControlsCard>
      }
    >
      {image ? (
        <>
          <NodeImg image={image} priority={priority} />
          {overlay}
          {running && <LoadingOverlay />}
          {batch && <RunBatchChip>{`Run ${batch.index} of ${batch.count}${batch.time ? ` · ${batch.time}` : ""}`}</RunBatchChip>}
          {(onDownload || onClear) && <MediaTools onDownload={onDownload} onClear={onClear} />}
        </>
      ) : running ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/40">
          <LoaderCircle size={16} strokeWidth={3} className="animate-spin text-neutral-400" aria-label="Loading" />
        </div>
      ) : (
        <EmptyState
          message="Run to generate"
          hint="Connect inputs and run"
          meta={gemini ? `~${formatCost(imageCost(settings.model, settings.resolution))}` : undefined}
        />
      )}
    </NodeCard>
  );
}

/* --------------------------------------------------------------- Image Input */

export const IMAGE_INPUT_INPUTS: SocketSpec[] = [{ id: "reference", type: "reference", label: "Ref" }];
export const IMAGE_INPUT_OUTPUTS: SocketSpec[] = [{ id: "image", type: "image", label: "Image" }];

export interface ImageInputNodeProps extends ShellProps {
  title?: string;
  image: NodeImage;
  /** Summary title (the file name). */
  filename?: string;
  /** Pixel size shown in the summary ("1086×1448"); defaults to the image's. */
  dimensions?: { width: number; height: number };
  optional?: boolean;
  priority?: boolean;
}

/** Image Input: a grey Ref socket in, Image out, the photo at its own proportions, "file.png · 1086×1448". */
export function ImageInputNode({
  title = "Image Input",
  image,
  filename = "Image",
  dimensions,
  optional = false,
  priority,
  inputs = IMAGE_INPUT_INPUTS,
  outputs = IMAGE_INPUT_OUTPUTS,
  ...shell
}: ImageInputNodeProps) {
  const dims = dimensions ?? { width: image.width, height: image.height };
  return (
    <NodeCard
      {...shell}
      title={title}
      inputs={inputs}
      outputs={outputs}
      media={{ aspect: image.width / image.height }}
      controls={<ControlsCard summary={{ title: filename, values: <SummaryValues items={[`${dims.width}×${dims.height}`, optional ? "optional" : null]} /> }} />}
    >
      <NodeImg image={image} priority={priority} />
    </NodeCard>
  );
}

/* -------------------------------------------------------------------- Prompt */

export const PROMPT_INPUTS: SocketSpec[] = [{ id: "text", type: "text", label: "Text" }];
export const PROMPT_OUTPUTS: SocketSpec[] = [{ id: "text", type: "text", label: "Text" }];

export interface PromptNodeProps extends ShellProps {
  title?: string;
  value: string;
  /** Editable textarea when given. */
  onChange?: (value: string) => void;
  /** Text surface height (the app's default is 160). */
  height?: number;
  /** Shows the bottom grip and lets it drag the height. */
  onHeightChange?: (height: number) => void;
  /** "@subject" instead of "Add variable". */
  variable?: string;
  onVariableClick?: () => void;
}

/** Prompt: Text in and out, the text surface, "Add variable · 317 chars". */
export function PromptNode({
  title = "Prompt",
  value,
  onChange,
  height = 160,
  onHeightChange,
  variable,
  onVariableClick,
  inputs = PROMPT_INPUTS,
  outputs = PROMPT_OUTPUTS,
  ...shell
}: PromptNodeProps) {
  const label = variable ? `@${variable}` : "Add variable";
  return (
    <NodeCard
      {...shell}
      title={title}
      inputs={inputs}
      outputs={outputs}
      media={{ height }}
      controls={
        <ControlsCard
          summary={{
            title: onVariableClick ? (
              <button type="button" onClick={onVariableClick} className="nodrag nb-text-node text-blue-400 transition-colors hover:text-blue-300" title="Set variable name">
                {label}
              </button>
            ) : (
              <span className="text-blue-400">{label}</span>
            ),
            values: <SummaryValues items={[`${value.length} chars`]} />,
          }}
        />
      }
    >
      <PromptSurface value={value} onChange={onChange} />
      <HeightGrip height={height} onChange={onHeightChange} />
    </NodeCard>
  );
}

/* ------------------------------------------------------------ Generate Video */

/** schemaSockets for a first-frame model: First frame (image), a placeholder Video slot, Prompt. */
export const GENERATE_VIDEO_INPUTS: SocketSpec[] = [
  { id: "image-0", type: "image", label: "First frame" },
  { id: "video", type: "video", label: "Video", placeholder: true },
  { id: "text-0", type: "text", label: "Prompt" },
];
export const GENERATE_VIDEO_OUTPUTS: SocketSpec[] = [{ id: "video", type: "video", label: "Video" }];

export interface GenerateVideoNodeProps extends ShellProps {
  title?: string;
  video?: { src: string; poster?: string; width: number; height: number; duration?: number } | null;
  /** Plays while true (gate on the demo being active). */
  playing?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  history?: { index: number; count: number; onPrev?: () => void; onNext?: () => void };
  provider?: ProviderId;
  modelLabel?: string;
  fields?: ReactNode;
  defaultExpanded?: boolean;
}

/** Generate Video: the clip at its proportions, the scrub row (with a compact carousel) and "fal · Seedance 2.0…". */
export function GenerateVideoNode({
  title,
  video,
  playing = false,
  videoRef,
  history,
  provider = "fal",
  modelLabel = "Seedance 2.0 Fast Image to Video",
  fields,
  defaultExpanded = false,
  running = false,
  inputs = GENERATE_VIDEO_INPUTS,
  outputs = GENERATE_VIDEO_OUTPUTS,
  ...shell
}: GenerateVideoNodeProps) {
  const [ownRef] = useState<RefObject<HTMLVideoElement | null>>(() => ({ current: null }));
  const ref = videoRef ?? ownRef;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const carousel = history && history.count > 1 ? <CarouselControls compact noun="video" {...history} /> : undefined;
  return (
    <NodeCard
      {...shell}
      title={title ?? modelLabel}
      provider={shell.titleIcon ? undefined : provider}
      running={running}
      inputs={inputs}
      outputs={outputs}
      media={{ aspect: video ? video.width / video.height : 16 / 9 }}
      gap={video ? <ScrubRow videoRef={ref} src={video.src} duration={video.duration} trailing={carousel} /> : undefined}
      controls={
        <ControlsCard
          summary={{ icon: <ProviderBadge provider={provider} />, title: modelLabel }}
          expanded={expanded}
          onToggle={fields ? () => setExpanded((e) => !e) : undefined}
        >
          {fields}
        </ControlsCard>
      }
    >
      {video ? (
        <>
          <NodeVideo ref={ref} src={video.src} poster={video.poster} playing={playing} />
          {running && <LoadingOverlay />}
        </>
      ) : running ? (
        <div className={cn("absolute inset-0 flex items-center justify-center bg-neutral-900/40")}>
          <LoaderCircle size={16} strokeWidth={3} className="animate-spin text-neutral-400" aria-label="Loading" />
        </div>
      ) : (
        <EmptyState message="Run to generate" hint="Connect inputs and run" />
      )}
    </NodeCard>
  );
}
