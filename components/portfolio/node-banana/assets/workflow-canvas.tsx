"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

import type { LibraryAsset, RunImage } from "@/lib/node-banana/assets";

import {
  Canvas,
  ComfyWordmark,
  ControlsCard,
  GENERATE_IMAGE_INPUTS,
  GENERATE_IMAGE_OUTPUTS,
  GENERATE_VIDEO_INPUTS,
  GENERATE_VIDEO_OUTPUTS,
  GenerateImageNode,
  GenerateVideoNode,
  IMAGE_INPUT_INPUTS,
  IMAGE_INPUT_OUTPUTS,
  ImageInputNode,
  NodeCard,
  NodeVideo,
  NoodleLayer,
  PROMPT_INPUTS,
  PROMPT_OUTPUTS,
  PromptNode,
  ProviderBadge,
  SummaryValues,
  nodeLayout,
  useCanvasView,
  useNodeGraph,
  type Bounds,
  type GenerateImageSettings,
  type GraphEdgeSpec,
  type GraphNodeSpec,
  type NodeGraph,
  type SocketSpec,
} from "../kit";

// "Open workflow" lands here: the canvas with the nodes that made the asset,
// the maker selected. Built from the asset's recorded run.

const INPUT_W = 240;
const PROMPT_W = 300;
const PROMPT_H = 132;
const COLUMN_GAP = 110;
/** Below this the run is too small to read whole: the frame keeps the maker readable instead. */
const READABLE_ZOOM = 0.8;
/** Screen margins of the frame: around the whole run, and around the maker alone (wide enough for its socket labels). */
const FRAME = { x: 48, y: 56, makerX: 64, makerY: 28 };
const NARROW_FRAME = { x: 16, y: 40, makerX: 52, makerY: 20 };

const COMFY_INPUTS: SocketSpec[] = [
  { id: "image", type: "image", label: "Image" },
  { id: "text", type: "text", label: "Prompt" },
];
const SPLIT_INPUTS: SocketSpec[] = [{ id: "image", type: "image", label: "Image" }];
const SPLIT_OUTPUTS: SocketSpec[] = [{ id: "reference", type: "reference", label: "Ref" }];
const EASE_INPUTS: SocketSpec[] = [
  { id: "video", type: "video", label: "Video In" },
  { id: "easeCurve", type: "easeCurve", label: "Settings" },
];
const EASE_OUTPUTS: SocketSpec[] = [
  { id: "video", type: "video", label: "Video Out" },
  { id: "easeCurve", type: "easeCurve", label: "Settings" },
];

interface Plan {
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
}

function inputHeight(input: RunImage) {
  return nodeLayout({ width: INPUT_W, media: { aspect: input.width / input.height }, rows: 1 }).height;
}

/** Inputs in a column on the left (image above prompt), the maker to their right. */
function planFor(asset: LibraryAsset): Plan {
  const run = asset.run;
  if (!run) return { nodes: [], edges: [] };
  if (run.type === "splitGrid") {
    return {
      nodes: [
        { id: "maker", x: 0, y: 0, width: 360, inputs: SPLIT_INPUTS, outputs: SPLIT_OUTPUTS },
        { id: "cell", x: 360 + COLUMN_GAP, y: 30, width: INPUT_W, inputs: IMAGE_INPUT_INPUTS, outputs: IMAGE_INPUT_OUTPUTS },
      ],
      edges: [{ id: "ref", from: "maker", fromHandle: "reference", to: "cell", toHandle: "reference" }],
    };
  }
  if (run.type === "easeCurve") {
    return {
      nodes: [
        { id: "source", x: 0, y: 0, width: 300, inputs: GENERATE_VIDEO_INPUTS, outputs: GENERATE_VIDEO_OUTPUTS },
        { id: "maker", x: 300 + COLUMN_GAP, y: 0, width: 320, inputs: EASE_INPUTS, outputs: EASE_OUTPUTS },
      ],
      edges: [{ id: "video", from: "source", fromHandle: "video", to: "maker", toHandle: "video" }],
    };
  }

  const nodes: GraphNodeSpec[] = [];
  const edges: GraphEdgeSpec[] = [];
  const video = run.type === "generateVideo";
  const imageHandle = video ? "image-0" : "image";
  const textHandle = video ? "text-0" : "text";
  let columnBottom = 0;
  if (run.input) {
    nodes.push({ id: "input", x: PROMPT_W - INPUT_W, y: 0, width: INPUT_W, inputs: IMAGE_INPUT_INPUTS, outputs: IMAGE_INPUT_OUTPUTS });
    edges.push({ id: "image", from: "input", fromHandle: "image", to: "maker", toHandle: imageHandle });
    columnBottom = inputHeight(run.input) + 64;
  }
  if (asset.prompt) {
    nodes.push({ id: "prompt", x: 0, y: columnBottom, width: PROMPT_W, inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS });
    edges.push({ id: "text", from: "prompt", fromHandle: "text", to: "maker", toHandle: textHandle });
    columnBottom += PROMPT_H + 60;
  }
  const makerW = video ? 300 : 320;
  const aspect = (asset.thumb?.width ?? 16) / (asset.thumb?.height ?? 9);
  const makerH = nodeLayout({ width: makerW, media: { aspect }, rows: video ? 3 : 2, gap: video }).height;
  nodes.push({
    id: "maker",
    x: PROMPT_W + COLUMN_GAP,
    y: Math.max(0, (columnBottom - 60 - makerH) / 2),
    width: makerW,
    inputs: video ? GENERATE_VIDEO_INPUTS : run.type === "comfy" ? COMFY_INPUTS : GENERATE_IMAGE_INPUTS,
    outputs: video ? GENERATE_VIDEO_OUTPUTS : GENERATE_IMAGE_OUTPUTS,
  });
  return { nodes, edges };
}

/**
 * The world rectangle the canvas opens on: the whole run when it reads at
 * this size; otherwise the maker in full, as large as reads, with its
 * inputs' noodles running in from the left, a drag away.
 */
function frameRun(graph: NodeGraph, width: number, height: number): Bounds | null {
  const all = graph.measure();
  const maker = graph.measure(["maker"]);
  if (!all || !maker || width <= 0 || height <= 0) return all;
  const margin = width < 520 ? NARROW_FRAME : FRAME;
  const availW = width - margin.x * 2;
  const availH = height - margin.y * 2;
  const whole = Math.min(1, availW / all.width, availH / all.height);
  if (whole >= READABLE_ZOOM) {
    const w = width / whole;
    const h = height / whole;
    return { x: all.x + all.width / 2 - w / 2, y: all.y + all.height / 2 - h / 2, width: w, height: h };
  }
  const zoom = Math.min(READABLE_ZOOM, (width - margin.makerX * 2) / maker.width, (height - margin.makerY * 2) / maker.height);
  const w = width / zoom;
  const h = height / zoom;
  return { x: maker.x + maker.width / 2 - w / 2, y: maker.y + maker.height / 2 - h / 2, width: w, height: h };
}

function NodeImg({ image }: { image: { src: string; width: number; height: number } }) {
  return <Image src={image.src} alt="" width={image.width} height={image.height} unoptimized draggable={false} className="absolute inset-0 h-full w-full object-cover" />;
}

function gridLines(): ReactNode {
  return (
    <svg aria-hidden viewBox="0 0 3 3" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      {[1, 2].map((n) => (
        <g key={n} stroke="#3b82f6" strokeWidth={0.012} vectorEffect="non-scaling-stroke">
          <line x1={n} y1={0} x2={n} y2={3} />
          <line x1={0} y1={n} x2={3} y2={n} />
        </g>
      ))}
    </svg>
  );
}

export function WorkflowCanvas({ asset, active, reducedMotion }: { asset: LibraryAsset; active: boolean; reducedMotion: boolean }) {
  const [plan] = useState(() => planFor(asset));
  const graph = useNodeGraph(plan);
  // The frame is worked out in screen pixels, so the view adds no padding of its own
  const view = useCanvasView({ fit: () => frameRun(graph, view.width, view.height), padding: 0, minZoom: 0.1 });
  const [selected, setSelected] = useState<string | null>("maker");
  const shell = (id: string) => ({ graph, id, selected: selected === id, onSelect: () => setSelected(id) });
  const run = asset.run;
  const model = asset.model;

  let maker: ReactNode = null;
  if (run?.type === "generateVideo" && asset.thumb && asset.media) {
    maker = (
      <GenerateVideoNode
        {...shell("maker")}
        video={{ src: asset.media, poster: asset.thumb.src, width: asset.thumb.width, height: asset.thumb.height, duration: asset.durationSec }}
        playing={active}
        provider={model?.provider === "comfy" ? undefined : model?.provider}
        modelLabel={model?.displayName}
      />
    );
  } else if (run?.type === "comfy" && asset.thumb) {
    maker = (
      <NodeCard
        {...shell("maker")}
        title={`Comfy ${asset.producer.title}`}
        titleLogo={<ComfyWordmark />}
        subtitle={asset.producer.title}
        media={{ aspect: asset.thumb.width / asset.thumb.height }}
        inputs={COMFY_INPUTS}
        outputs={GENERATE_IMAGE_OUTPUTS}
        controls={<ControlsCard summary={{ icon: <ProviderBadge provider="comfy" />, title: "App workflow", values: <SummaryValues items={["34 nodes"]} /> }} />}
      >
        <NodeImg image={asset.thumb} />
      </NodeCard>
    );
  } else if (run?.type === "generateImage" && asset.thumb) {
    const gemini = model?.provider === "gemini";
    const params = asset.parameters ?? {};
    const settings: Partial<GenerateImageSettings> | undefined = gemini
      ? {
          model: model.id as GenerateImageSettings["model"],
          aspectRatio: params.aspectRatio as GenerateImageSettings["aspectRatio"],
          resolution: (params.resolution as GenerateImageSettings["resolution"]) ?? "1K",
          googleSearch: !!params.googleSearch,
        }
      : undefined;
    maker = (
      <GenerateImageNode
        {...shell("maker")}
        title={asset.producer.title === "Generate Image" ? undefined : asset.producer.title}
        image={asset.thumb}
        settings={settings}
        provider={model?.provider === "comfy" ? undefined : model?.provider}
        modelLabel={gemini ? undefined : model?.displayName}
      />
    );
  } else if (run?.type === "splitGrid") {
    maker = (
      <NodeCard
        {...shell("maker")}
        title="Split Grid"
        media={{ aspect: run.grid.width / run.grid.height }}
        inputs={SPLIT_INPUTS}
        outputs={SPLIT_OUTPUTS}
        controls={<ControlsCard summary={{ title: "3×3 grid" }} />}
      >
        <NodeImg image={run.grid} />
        {gridLines()}
      </NodeCard>
    );
  } else if (run?.type === "easeCurve" && asset.thumb && asset.media) {
    maker = (
      <NodeCard
        {...shell("maker")}
        title="Ease Curve"
        media={{ aspect: asset.thumb.width / asset.thumb.height }}
        inputs={EASE_INPUTS}
        outputs={EASE_OUTPUTS}
        controls={<ControlsCard summary={{ title: "Ease curve", values: <SummaryValues items={["easeInOutSine", "1.5s"]} /> }} />}
      >
        <NodeVideo src={asset.media} poster={asset.thumb.src} playing={active} />
      </NodeCard>
    );
  }

  return (
    <Canvas view={view} gridZoom={false} onPaneClick={() => setSelected(null)}>
      <NoodleLayer graph={graph} selected={selected ? [selected] : []} paused={!active} still={reducedMotion} />
      {run && "input" in run && run.input && (
        <ImageInputNode {...shell("input")} image={run.input} filename={run.input.filename} dimensions={run.input.dimensions} />
      )}
      {asset.prompt && run && run.type !== "splitGrid" && run.type !== "easeCurve" && (
        <PromptNode {...shell("prompt")} value={asset.prompt} height={PROMPT_H} />
      )}
      {run?.type === "splitGrid" && asset.thumb && (
        <ImageInputNode
          {...shell("cell")}
          image={asset.thumb}
          filename={asset.filename}
          dimensions={asset.width && asset.height ? { width: asset.width, height: asset.height } : undefined}
        />
      )}
      {run?.type === "easeCurve" && (
        <GenerateVideoNode {...shell("source")} video={run.source} playing={active} provider="fal" modelLabel="Kling Video v2.6 Image to Video" />
      )}
      {maker}
    </Canvas>
  );
}
