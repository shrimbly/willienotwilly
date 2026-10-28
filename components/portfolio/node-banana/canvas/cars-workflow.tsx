"use client";

import { useState } from "react";

import {
  CARS_BOOM_PROMPT,
  CARS_CONTACT_SHEET_PROMPT,
  CARS_LLM_OUTPUT,
  CARS_UPSCALE_PROMPT,
} from "@/lib/node-banana/canvas-workflows";

import {
  GENERATE_IMAGE_OUTPUTS,
  GENERATE_VIDEO_OUTPUTS,
  GenerateImageNode,
  GenerateVideoNode,
  IMAGE_INPUT_INPUTS,
  IMAGE_INPUT_OUTPUTS,
  ImageInputNode,
  NB_ASSETS,
  NoodleLayer,
  PROMPT_INPUTS,
  PROMPT_OUTPUTS,
  PromptNode,
  useNodeGraph,
  type GraphEdgeSpec,
  type GraphNodeSpec,
  type NodeImage,
  type SocketSpec,
} from "../kit";
import {
  EASE_INPUTS,
  EASE_OUTPUTS,
  EaseCurveNode,
  IMAGE_MODEL_INPUTS,
  LLM_INPUTS,
  LlmGenerateNode,
  SPLIT_INPUTS,
  SPLIT_OUTPUTS,
  SchemaFields,
  SplitGridNode,
  TEXT_SOCKETS,
  type ParamSpec,
} from "./nodes";
import { downloadFile, saved, useWorkflowState, useWorkflowView, type PhoneLayout, type Placement, type WorkflowEnv } from "./use-workflow";
import { WorkflowCanvas } from "./workflow-canvas";

// "Cars": the landing site's second tab, a 14-node contact-sheet workflow
// (photo → LLM-written prompt → 3×3 sheet → split → two upscales → video →
// ease curve) in one 4000px row.

const KLING_INPUTS: SocketSpec[] = [
  { id: "image-0", type: "image", label: "Image" },
  { id: "image-1", type: "image", label: "Tail Image" },
  { id: "video", type: "video", label: "Video", placeholder: true },
  { id: "text-0", type: "text", label: "Prompt" },
  { id: "text-1", type: "text", label: "Negative Prompt" },
];

const NODES: GraphNodeSpec[] = [
  { id: "imageInput-6", x: 0, y: 0, width: 300, inputs: IMAGE_INPUT_INPUTS, outputs: IMAGE_INPUT_OUTPUTS },
  { id: "prompt-9", x: 0, y: 290, width: 320, inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS },
  { id: "llmGenerate-10", x: 420, y: 120, width: 320, inputs: LLM_INPUTS, outputs: TEXT_SOCKETS },
  { id: "nanoBanana-11", x: 840, y: 0, width: 620, inputs: IMAGE_MODEL_INPUTS, outputs: GENERATE_IMAGE_OUTPUTS },
  { id: "splitGrid-13", x: 1560, y: 60, width: 300, inputs: SPLIT_INPUTS, outputs: SPLIT_OUTPUTS },
  { id: "imageInput-41", x: 1960, y: 60, width: 300, inputs: IMAGE_INPUT_INPUTS, outputs: IMAGE_INPUT_OUTPUTS },
  { id: "prompt-43", x: 1960, y: 360, width: 320, inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS },
  { id: "nanoBanana-42", x: 2380, y: 120, width: 480, inputs: IMAGE_MODEL_INPUTS, outputs: GENERATE_IMAGE_OUTPUTS },
  { id: "imageInput-59", x: 1960, y: 620, width: 300, inputs: IMAGE_INPUT_INPUTS, outputs: IMAGE_INPUT_OUTPUTS },
  { id: "prompt-61", x: 1960, y: 920, width: 320, inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS },
  { id: "nanoBanana-60", x: 2380, y: 680, width: 480, inputs: IMAGE_MODEL_INPUTS, outputs: GENERATE_IMAGE_OUTPUTS },
  { id: "prompt-78", x: 2960, y: 500, width: 320, inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS },
  { id: "generateVideo-69", x: 2960, y: 60, width: 480, inputs: KLING_INPUTS, outputs: GENERATE_VIDEO_OUTPUTS },
  { id: "easeCurve-102", x: 3540, y: 60, width: 427, inputs: EASE_INPUTS, outputs: EASE_OUTPUTS },
];

const EDGES: GraphEdgeSpec[] = [
  { id: "c-photo-llm", from: "imageInput-6", fromHandle: "image", to: "llmGenerate-10", toHandle: "image" },
  { id: "c-sheet-llm", from: "prompt-9", fromHandle: "text", to: "llmGenerate-10", toHandle: "text" },
  { id: "c-photo-gen", from: "imageInput-6", fromHandle: "image", to: "nanoBanana-11", toHandle: "image-0" },
  { id: "c-llm-gen", from: "llmGenerate-10", fromHandle: "text", to: "nanoBanana-11", toHandle: "text-0" },
  { id: "c-gen-split", from: "nanoBanana-11", fromHandle: "image", to: "splitGrid-13", toHandle: "image" },
  { id: "c-split-cell1", from: "splitGrid-13", fromHandle: "reference", to: "imageInput-41", toHandle: "reference" },
  { id: "c-cell1-up", from: "imageInput-41", fromHandle: "image", to: "nanoBanana-42", toHandle: "image-0" },
  { id: "c-upp1-up", from: "prompt-43", fromHandle: "text", to: "nanoBanana-42", toHandle: "text-0" },
  { id: "c-split-cell3", from: "splitGrid-13", fromHandle: "reference", to: "imageInput-59", toHandle: "reference" },
  { id: "c-cell3-up", from: "imageInput-59", fromHandle: "image", to: "nanoBanana-60", toHandle: "image-0" },
  { id: "c-upp3-up", from: "prompt-61", fromHandle: "text", to: "nanoBanana-60", toHandle: "text-0" },
  { id: "c-up1-video", from: "nanoBanana-42", fromHandle: "image", to: "generateVideo-69", toHandle: "image-0" },
  { id: "c-up3-video", from: "nanoBanana-60", fromHandle: "image", to: "generateVideo-69", toHandle: "image-1" },
  { id: "c-boom-video", from: "prompt-78", fromHandle: "text", to: "generateVideo-69", toHandle: "text-0" },
  { id: "c-video-ease", from: "generateVideo-69", fromHandle: "video", to: "easeCurve-102", toHandle: "video" },
];
const DRAW = EDGES.map((e) => e.id);
/** The opening view, as the site frames this tab: the photo through to the split grid. Pan for the rest. */
const OPENING = ["imageInput-6", "prompt-9", "llmGenerate-10", "nanoBanana-11", "splitGrid-13"];

/**
 * Portrait tiles (the site has none: its phones only show the first tab):
 * the photo and its prompt over the LLM and the contact sheet in two columns,
 * the right one lower to clear the Agent pill. The rest of the row follows to
 * the right, pulled in to meet them; pan sideways for it.
 */
const PHONE_LAYOUT: Record<string, Placement> = {
  "imageInput-6": [0, 0, 300],
  "prompt-9": [0, 303, 300],
  "llmGenerate-10": [400, 146, 320],
  "nanoBanana-11": [400, 456, 320],
};
const PHONE_SHIFT = -740;
const PHONE: PhoneLayout = {
  place: (id) => {
    const [x, y, width] = saved(NODES, id);
    return PHONE_LAYOUT[id] ?? [x + PHONE_SHIFT, y, width];
  },
  frame: { wide: OPENING, phone: Object.keys(PHONE_LAYOUT) },
};

const geminiProImage = (resolution: string): ParamSpec[] => [
  { kind: "select", label: "Aspect ratio", options: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], value: "3:2" },
  { kind: "select", label: "Resolution", options: ["1K", "2K", "4K"], value: resolution },
  { kind: "select", label: "Output format", options: ["jpeg", "png", "webp"], value: "png" },
  { kind: "range", label: "Num images", min: 1, max: 4, step: 1, value: 1 },
];
const SHEET_PARAMS = geminiProImage("2K");
const UPSCALE_PARAMS = geminiProImage("4K");
const KLING_PARAMS: ParamSpec[] = [
  { kind: "select", label: "Duration", options: ["5", "10"], value: "5" },
  { kind: "range", label: "CFG scale", min: 0, max: 1, step: 0.01, value: 0.5, decimals: 2 },
  { kind: "check", label: "Generate audio", value: false },
];

export function CarsWorkflow({ env }: { env: WorkflowEnv }) {
  const graph = useNodeGraph({ nodes: NODES, edges: EDGES });
  const view = useWorkflowView(graph, NODES, PHONE);
  const { selected, setSelected, running, run } = useWorkflowState();
  const [cleared, setCleared] = useState<string[]>([]);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const { cars } = NB_ASSETS;

  const shell = (id: string, enterIndex: number) => ({
    graph,
    id,
    enterIndex,
    selected: selected === id,
    onSelect: () => setSelected(id),
    running: running.includes(id),
    resizable: true,
  });
  const height = (id: string, fallback = 160) => ({
    height: heights[id] ?? fallback,
    onHeightChange: (h: number) => setHeights((all) => ({ ...all, [id]: h })),
  });
  const generated = (id: string, image: NodeImage, params: ParamSpec[], enterIndex: number) => (
    <GenerateImageNode
      {...shell(id, enterIndex)}
      title="Generate Image"
      provider="fal"
      modelLabel="Gemini 3 Pro Image Preview"
      inputs={IMAGE_MODEL_INPUTS}
      outputs={GENERATE_IMAGE_OUTPUTS}
      image={cleared.includes(id) ? null : image}
      settings={{ aspectRatio: "3:2" }}
      fields={<SchemaFields params={params} />}
      onRun={() => run(id, 2600, () => setCleared((c) => c.filter((x) => x !== id)))}
      onDownload={() => downloadFile(image.src, `${id}.jpg`)}
      onClear={() => setCleared((c) => [...c, id])}
    />
  );

  return (
    <WorkflowCanvas view={view} graph={graph} env={env} onPaneClick={() => setSelected(null)}>
      <NoodleLayer
        id="hero-cars"
        graph={graph}
        selected={selected ? [selected] : []}
        running={running}
        draw={DRAW}
        fadedOpacity={1}
        paused={!env.active}
        still={env.reducedMotion}
      />
      <ImageInputNode {...shell("imageInput-6", 1)} image={{ ...cars.input, alt: "A blue MGB GT V8 parked on a verge" }} filename="DSCF4258.JPG" dimensions={{ width: 2460, height: 1640 }} />
      <PromptNode {...shell("prompt-9", 2)} value={CARS_CONTACT_SHEET_PROMPT} {...height("prompt-9")} />
      <LlmGenerateNode {...shell("llmGenerate-10", 3)} output={CARS_LLM_OUTPUT} height={200} onRun={() => run("llmGenerate-10", 1800)} />
      {generated("nanoBanana-11", { ...cars.grid, alt: "A 3×3 contact sheet of the car in a dark studio" }, SHEET_PARAMS, 4)}
      <SplitGridNode {...shell("splitGrid-13", 5)} image={cars.grid} onRun={() => run("splitGrid-13", 1200)} />
      <ImageInputNode
        {...shell("imageInput-41", 6)}
        image={{ ...cars.cell1, alt: "Frame 1 of the contact sheet: the car from a low front three-quarter angle" }}
        filename="split-1-1.png"
        dimensions={{ width: 843, height: 565 }}
      />
      <PromptNode {...shell("prompt-43", 7)} value={CARS_UPSCALE_PROMPT} {...height("prompt-43")} />
      {generated("nanoBanana-42", { ...cars.upscale1, alt: "The low front three-quarter frame, upscaled" }, UPSCALE_PARAMS, 8)}
      <ImageInputNode
        {...shell("imageInput-59", 9)}
        image={{ ...cars.cell3, alt: "Frame 7 of the contact sheet: the car from directly overhead" }}
        filename="split-3-1.png"
        dimensions={{ width: 843, height: 565 }}
      />
      <PromptNode {...shell("prompt-61", 10)} value={CARS_UPSCALE_PROMPT} {...height("prompt-61")} />
      {generated("nanoBanana-60", { ...cars.upscale3, alt: "The overhead frame, upscaled" }, UPSCALE_PARAMS, 11)}
      <PromptNode {...shell("prompt-78", 12)} value={CARS_BOOM_PROMPT} {...height("prompt-78")} />
      <GenerateVideoNode
        {...shell("generateVideo-69", 13)}
        title="Generate Video"
        modelLabel="Kling Video v2.6 Image to Video"
        inputs={KLING_INPUTS}
        outputs={GENERATE_VIDEO_OUTPUTS}
        video={cars.video}
        playing={env.active}
        fields={<SchemaFields params={KLING_PARAMS} />}
        onRun={() => run("generateVideo-69", 3200)}
      />
      <EaseCurveNode {...shell("easeCurve-102", 14)} video={cars.eased} playing={env.active} onRun={() => run("easeCurve-102", 1500)} />
    </WorkflowCanvas>
  );
}
