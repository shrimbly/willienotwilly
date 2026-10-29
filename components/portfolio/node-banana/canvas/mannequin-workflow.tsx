"use client";

import { useRef, useState } from "react";

import { MANNEQUIN_ORBIT_PROMPT, MANNEQUIN_PROMPT } from "@/lib/node-banana/canvas-workflows";

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
  type SocketSpec,
} from "../kit";
import { IMAGE_MODEL_INPUTS, PromptConstructorNode, SchemaFields, TEXT_SOCKETS, type ParamSpec } from "./nodes";
import { downloadFile, saved, useOnScreen, useWorkflowState, useWorkflowView, type Placement, type WorkflowEnv, type WorkflowLayout } from "./use-workflow";
import { WorkflowCanvas } from "./workflow-canvas";

// "Invisible Mannequin": the landing site's first tab (app-window.html), at
// the workflow's own world coordinates.

const SEEDANCE_INPUTS: SocketSpec[] = [
  { id: "image-0", type: "image", label: "First Frame" },
  { id: "image-1", type: "image", label: "Last Frame" },
  { id: "video", type: "video", label: "Video", placeholder: true },
  { id: "text-0", type: "text", label: "Prompt" },
];

const NODES: GraphNodeSpec[] = [
  { id: "imageInput-22", x: -375, y: 362, width: 444, inputs: IMAGE_INPUT_INPUTS, outputs: IMAGE_INPUT_OUTPUTS },
  { id: "prompt-23", x: 170, y: 447, width: 320, inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS },
  { id: "nanoBanana-3", x: 539, y: 369, width: 387, inputs: IMAGE_MODEL_INPUTS, outputs: GENERATE_IMAGE_OUTPUTS },
  { id: "promptConstructor-13", x: 1080, y: 514, width: 340, inputs: TEXT_SOCKETS, outputs: TEXT_SOCKETS },
  { id: "generateVideo-17", x: 1522, y: 393, width: 300, inputs: SEEDANCE_INPUTS, outputs: GENERATE_VIDEO_OUTPUTS },
];

/** The photo and its prompt into Generate Image: what smaller tiles frame, the rest running off the edge. */
const FIRST_STEP = ["imageInput-22", "prompt-23", "nanoBanana-3"];
/** The photo beside the jacket made from it: all a phone-width tile holds at a readable zoom. */
const PAIR = ["imageInput-22", "nanoBanana-3"];

/**
 * Portrait tiles: the site's two columns (site.js PHONE_LAYOUTS.mannequin)
 * at near-default widths, the constructor under the prompt and the right
 * column started lower so the Agent pill sits over empty canvas. The tile
 * frames the first step; the video side runs off the bottom. [x, y, width].
 */
const PHONE_LAYOUT: Record<string, Placement> = {
  "imageInput-22": [0, 0, 300],
  "prompt-23": [0, 497, 300],
  "promptConstructor-13": [0, 860, 300],
  "nanoBanana-3": [380, 151, 280],
  "generateVideo-17": [380, 641, 280],
};

/**
 * Phone-width tiles: the same columns, close enough for the photo and its
 * jacket to sit side by side at a readable zoom down to a 375px phone, the
 * prompt and the video side stacked below them. The jacket's column keeps the
 * app's minimum node width, which "Generate Image" needs untruncated; the
 * photo's goes a little under it.
 */
const NARROW_LAYOUT: Record<string, Placement> = {
  "imageInput-22": [0, 0, 180],
  "prompt-23": [0, 316, 180],
  "promptConstructor-13": [0, 657, 180],
  "nanoBanana-3": [220, 60, 200],
  "generateVideo-17": [220, 422, 200],
};

/**
 * Mid-size tiles: the same row pulled together, the image nodes narrowed so
 * the first step fits a 16:9 tile at a readable zoom and the video side runs
 * off to the right.
 */
const MID_LAYOUT: Record<string, Placement> = {
  "imageInput-22": [-375, 362, 245],
  "prompt-23": [-50, 420, 280],
  "nanoBanana-3": [280, 362, 230],
  "promptConstructor-13": [680, 470, 340],
  "generateVideo-17": [1110, 393, 300],
};

const LAYOUT: WorkflowLayout = {
  phone: (id) => PHONE_LAYOUT[id] ?? saved(NODES, id),
  narrow: (id) => NARROW_LAYOUT[id] ?? saved(NODES, id),
  mid: (id) => MID_LAYOUT[id] ?? saved(NODES, id),
  frames: { mid: [FIRST_STEP], phone: [FIRST_STEP], narrow: [PAIR] },
};

const EDGES: GraphEdgeSpec[] = [
  { id: "m-input-gen", from: "imageInput-22", fromHandle: "image", to: "nanoBanana-3", toHandle: "image-0" },
  { id: "m-prompt-gen", from: "prompt-23", fromHandle: "text", to: "nanoBanana-3", toHandle: "text-0" },
  { id: "m-gen-first", from: "nanoBanana-3", fromHandle: "image", to: "generateVideo-17", toHandle: "image-0" },
  { id: "m-gen-last", from: "nanoBanana-3", fromHandle: "image", to: "generateVideo-17", toHandle: "image-1" },
  { id: "m-orbit-video", from: "promptConstructor-13", fromHandle: "text", to: "generateVideo-17", toHandle: "text-0" },
];
const DRAW = EDGES.map((e) => e.id);

const GPT_IMAGE_PARAMS: ParamSpec[] = [
  {
    kind: "select",
    label: "Size",
    options: ["auto", "1024x1024", "1536x1024", "1024x1536", "1536x864", "864x1536", "2048x1152", "1152x2048", "2048x2048", "3840x2160", "2160x3840"],
    value: "auto",
  },
  { kind: "select", label: "Quality", options: ["auto", "low", "medium", "high", "xhigh", "max"], value: "high" },
  { kind: "select", label: "Background", options: ["auto", "opaque", "transparent"], value: "auto" },
  { kind: "select", label: "Output format", options: ["png", "jpeg", "webp"], value: "png" },
];
const SEEDANCE_PARAMS: ParamSpec[] = [
  { kind: "select", label: "Resolution", options: ["480p", "720p"], value: "720p" },
  { kind: "select", label: "Duration", options: ["4", "5", "6", "8", "10", "12"], value: "5" },
  { kind: "select", label: "Aspect ratio", options: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], value: "3:4" },
  { kind: "check", label: "Camera fixed", value: false },
];

export function MannequinWorkflow({ env }: { env: WorkflowEnv }) {
  const graph = useNodeGraph({ nodes: NODES, edges: EDGES });
  const view = useWorkflowView(graph, NODES, LAYOUT);
  const { selected, setSelected, running, run } = useWorkflowState();
  const [cleared, setCleared] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [videoIndex, setVideoIndex] = useState(0);
  const [promptHeight, setPromptHeight] = useState(253);
  const [orbitHeight, setOrbitHeight] = useState(160);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoOnScreen = useOnScreen(videoRef);
  const { mannequin } = NB_ASSETS;

  const shell = (id: string, enterIndex: number) => ({
    graph,
    id,
    enterIndex,
    selected: selected === id,
    onSelect: () => setSelected(id),
    running: running.includes(id),
    resizable: true,
  });

  return (
    <WorkflowCanvas view={view} env={env} onPaneClick={() => setSelected(null)}>
      <NoodleLayer
        id="hero-mannequin"
        graph={graph}
        selected={selected ? [selected] : []}
        running={running}
        draw={DRAW}
        fadedOpacity={1}
        paused={!env.active}
        still={env.reducedMotion}
      />
      <ImageInputNode
        {...shell("imageInput-22", 1)}
        image={{ ...mannequin.input, alt: "Photo of a man in a light denim jacket" }}
        filename="image-1789315934377.png"
        dimensions={{ width: 1086, height: 1448 }}
        priority
      />
      <PromptNode {...shell("prompt-23", 2)} value={MANNEQUIN_PROMPT} height={promptHeight} onHeightChange={setPromptHeight} />
      <GenerateImageNode
        {...shell("nanoBanana-3", 3)}
        title="Generate Image"
        provider="openai"
        modelLabel="GPT Image 2.5 Flare"
        inputs={IMAGE_MODEL_INPUTS}
        outputs={GENERATE_IMAGE_OUTPUTS}
        image={cleared ? null : { ...mannequin.jacket, alt: "The denim jacket, floating on white as if worn" }}
        settings={{ aspectRatio: "3:4" }}
        history={{ index: imageIndex, count: 7, onPrev: () => setImageIndex((i) => (i + 6) % 7), onNext: () => setImageIndex((i) => (i + 1) % 7) }}
        fields={<SchemaFields params={GPT_IMAGE_PARAMS} />}
        priority
        onRun={() => run("nanoBanana-3", 2600, () => setCleared(false))}
        onDownload={() => downloadFile(mannequin.jacket.src, "nanoBanana-3.jpg")}
        onClear={() => setCleared(true)}
      />
      <PromptConstructorNode {...shell("promptConstructor-13", 4)} value={MANNEQUIN_ORBIT_PROMPT} height={orbitHeight} onHeightChange={setOrbitHeight} />
      <GenerateVideoNode
        {...shell("generateVideo-17", 5)}
        title="Generate Video"
        modelLabel="Seedance 2.0 Fast Image to Video"
        inputs={SEEDANCE_INPUTS}
        outputs={GENERATE_VIDEO_OUTPUTS}
        video={mannequin.video}
        videoRef={videoRef}
        playing={env.active && videoOnScreen}
        history={{ index: videoIndex, count: 12, onPrev: () => setVideoIndex((i) => (i + 11) % 12), onNext: () => setVideoIndex((i) => (i + 1) % 12) }}
        fields={<SchemaFields params={SEEDANCE_PARAMS} />}
        onRun={() => run("generateVideo-17", 3200)}
      />
    </WorkflowCanvas>
  );
}
