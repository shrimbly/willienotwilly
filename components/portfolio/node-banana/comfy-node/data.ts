import {
  IMAGE_INPUT_INPUTS,
  IMAGE_INPUT_OUTPUTS,
  NB_ASSETS,
  PROMPT_INPUTS,
  PROMPT_OUTPUTS,
  nodeLayout,
  type GraphEdgeSpec,
  type GraphNodeSpec,
  type SelectOption,
  type SocketSpec,
} from "../kit";

// The demo's workflow: a reference photo and a prompt wired into a ComfyUI
// app node ("Z-Image and upscale", the landing site's), whose image goes on
// to an Output node. Stills are agent-run outputs copied from the site.

export interface Still {
  src: string;
  width: number;
  height: number;
  alt: string;
}

const { agent, comfyParis } = NB_ASSETS;

export const STILLS = {
  balcony: { ...comfyParis, alt: "The model in a camel coat at a wrought-iron balcony in Paris" },
  apartment: { ...agent.paris, alt: "The model in a camel coat by the tall windows of a Paris apartment" },
  palace: { ...agent.palace, alt: "The model in a camel coat in a gilded hall of mirrors" },
  greenhouse: { ...agent.greenhouse, alt: "The model in a camel coat among the palms of a glasshouse" },
  metro: { ...agent.subway, alt: "The model in a camel coat in a green-lit Métro carriage" },
} satisfies Record<string, Still>;

export const REFERENCE: Still = { ...agent.base, alt: "Studio photo of the model in an oversized camel coat" };
export const REFERENCE_FILENAME = "camel-coat-studio.jpg";

export const PROMPT =
  "The model from the reference, same camel coat and black roll-neck, somewhere in Paris. Soft morning light, 35mm film, muted palette.";

/** One finished run, as the node keeps it in its history. */
export interface ComfyRun {
  id: number;
  still: Still;
  seed: number;
}

/** Runs already in the node's history, newest first (the app's order: the newest is "1 / n"). */
export const EARLIER_RUNS: ComfyRun[] = [
  { id: 2, still: STILLS.palace, seed: 1771093318 },
  { id: 1, still: STILLS.apartment, seed: 402315877 },
];

/** What each new run renders, in turn; the first is the one the tile plays when it comes into view. */
export const RUN_CYCLE: Still[] = [STILLS.balcony, STILLS.greenhouse, STILLS.metro, STILLS.apartment, STILLS.palace];

/** The app keeps the last 50 runs (comfyAppExecutor RUN_HISTORY_LIMIT). */
export const RUN_HISTORY_LIMIT = 50;

/* ------------------------------------------------------------- Parameters */

/** The App Mode widgets the workflow exposes (the site's set), with the values the node opens on. */
export interface ComfyParams {
  sampler: string;
  upscale: string;
  seed: number;
  steps: number;
  denoise: number;
}

export const INITIAL_PARAMS: ComfyParams = { sampler: "res_multistep", upscale: "2x", seed: 84213, steps: 8, denoise: 0.35 };

/** An enum widget's options, led by the app's "Default (…)" row for leaving it unset. */
export const SAMPLER_OPTIONS: SelectOption[] = [
  { value: "", label: "Default (res_multistep)" },
  ...["euler", "euler_ancestral", "dpmpp_2m", "res_multistep"].map((v) => ({ value: v, label: v })),
];
export const UPSCALE_OPTIONS: SelectOption[] = [
  { value: "", label: "Default (2x)" },
  ...["1.5x", "2x", "4x"].map((v) => ({ value: v, label: v })),
];

export const WORKFLOW_NODE_COUNT = 34;

/* ------------------------------------------------------------------ Graph */

export type NodeId = "reference" | "prompt" | "comfy" | "output";

export const COMFY_INPUTS: SocketSpec[] = [
  { id: "image-0", type: "image", label: "Image" },
  { id: "text-0", type: "text", label: "Prompt" },
];
export const COMFY_OUTPUTS: SocketSpec[] = [{ id: "image", type: "image", label: "Image" }];

/** OutputNode's sockets: Image, Video and Audio in. */
export const OUTPUT_INPUTS: SocketSpec[] = [
  { id: "image", type: "image", label: "Image" },
  { id: "video", type: "video", label: "Video" },
  { id: "audio", type: "audio", label: "Audio" },
];

export const PROMPT_HEIGHT = 132;
export const COMFY_ASPECT = comfyParis.width / comfyParis.height;
export const COMFY_MIN_W = 260;

/** Tile sizes: a phone shows the Comfy node alone, a tablet adds its inputs, a desktop the whole graph. */
export type Tier = "s" | "m" | "l";

export function tierFor(width: number): Tier {
  return width < 560 ? "s" : width < 900 ? "m" : "l";
}

type Placement = Record<NodeId, { x: number; y: number; width: number }>;

const WIDE: Placement = {
  reference: { x: -330, y: -40, width: 220 },
  prompt: { x: -330, y: 168, width: 220 },
  comfy: { x: 0, y: 0, width: 400 },
  output: { x: 530, y: 44, width: 260 },
};

export const LAYOUTS: Record<Tier, Placement> = {
  s: {
    reference: { x: -300, y: -40, width: 220 },
    prompt: { x: -300, y: 150, width: 220 },
    comfy: { x: 0, y: 0, width: 300 },
    output: { x: 420, y: 34, width: 260 },
  },
  m: WIDE,
  l: WIDE,
};

/** Which nodes the camera fits on each tier. */
export const FIT_SET: Record<Tier, NodeId[]> = {
  s: ["comfy"],
  m: ["reference", "prompt", "comfy"],
  l: ["reference", "prompt", "comfy", "output"],
};

/** Room around the fitted nodes: the run bar sits under them, the hint above the Comfy node. */
export const FIT_PADDING: Record<Tier, { top: number; right: number; bottom: number; left: number }> = {
  s: { top: 18, right: 14, bottom: 70, left: 14 },
  m: { top: 28, right: 24, bottom: 76, left: 24 },
  l: { top: 32, right: 32, bottom: 150, left: 32 },
};

/** Widest the Comfy node may be dragged, so it stops short of its neighbours. */
export const COMFY_MAX_W: Record<Tier, number> = { s: 420, m: 520, l: 520 };

/** Collapsed height of each node at a width, computed as NodeCard lays it out (no DOM needed). */
export function nodeHeight(id: NodeId, width: number): number {
  switch (id) {
    case "reference":
      return nodeLayout({ width, media: { aspect: REFERENCE.width / REFERENCE.height }, rows: 1 }).height;
    case "prompt":
      return nodeLayout({ width, media: { height: PROMPT_HEIGHT }, rows: 1 }).height;
    case "comfy":
      return nodeLayout({ width, media: { aspect: COMFY_ASPECT }, rows: 2, gap: true }).height;
    case "output":
      return nodeLayout({ width, media: { aspect: COMFY_ASPECT }, rows: 3, controls: false }).height;
  }
}

export const NODES: GraphNodeSpec[] = [
  { id: "reference", ...WIDE.reference, inputs: IMAGE_INPUT_INPUTS, outputs: IMAGE_INPUT_OUTPUTS },
  { id: "prompt", ...WIDE.prompt, inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS },
  { id: "comfy", ...WIDE.comfy, inputs: COMFY_INPUTS, outputs: COMFY_OUTPUTS },
  { id: "output", ...WIDE.output, inputs: OUTPUT_INPUTS, outputs: [] },
];

export const EDGES: GraphEdgeSpec[] = [
  { id: "reference-comfy", from: "reference", fromHandle: "image", to: "comfy", toHandle: "image-0" },
  { id: "prompt-comfy", from: "prompt", fromHandle: "text", to: "comfy", toHandle: "text-0" },
  { id: "comfy-output", from: "comfy", fromHandle: "image", to: "output", toHandle: "image" },
];

/* ---------------------------------------------------------------- Run timing */

/** A run's beats in ms: queued, the first latent preview, the last sampler step, the Output node filled. */
export const RUN_TIMING = { queued: 450, preview: 950, rendered: 3300, done: 4750 } as const;
