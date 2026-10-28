"use client";

import { useEffect, useRef, useState } from "react";

import { MANNEQUIN_ORBIT_PROMPT, MANNEQUIN_PROMPT } from "@/lib/node-banana/canvas-workflows";

import {
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
  useCanvasView,
  useNodeGraph,
  type Bounds,
  type GraphEdgeSpec,
  type GraphNodeSpec,
  type SocketSpec,
} from "../kit";
import { IMAGE_MODEL_INPUTS, IMAGE_MODEL_OUTPUTS, PromptConstructorNode, SchemaFields, TEXT_SOCKETS, VIDEO_OUTPUTS, type ParamSpec } from "./nodes";
import { downloadFile, driftTimeline, fitZoom, framedBounds, useWorkflowState, type Insets, type WorkflowEnv } from "./use-workflow";
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
  { id: "nanoBanana-3", x: 539, y: 369, width: 387, inputs: IMAGE_MODEL_INPUTS, outputs: IMAGE_MODEL_OUTPUTS },
  { id: "promptConstructor-13", x: 1080, y: 514, width: 340, inputs: TEXT_SOCKETS, outputs: TEXT_SOCKETS },
  { id: "generateVideo-17", x: 1522, y: 393, width: 300, inputs: SEEDANCE_INPUTS, outputs: VIDEO_OUTPUTS },
];

/** The site's phone layout (site.js PHONE_LAYOUTS.mannequin): two columns. */
const PHONE_LAYOUT: Record<string, [number, number]> = {
  "imageInput-22": [0, 0],
  "prompt-23": [0, 680],
  "nanoBanana-3": [520, 0],
  "promptConstructor-13": [520, 640],
  "generateVideo-17": [520, 900],
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

const WIDE_PAD: Insets = { top: 64, right: 28, bottom: 36, left: 28 };
const PHONE_PAD: Insets = { top: 60, right: 8, bottom: 12, left: 8 };
/** Phones: hold at the top, ease down to the far end, hold, ease back (site.js's drift, top-anchored). */
const DRIFT = [
  [0, 1800],
  [1, 7000],
  [1, 2400],
  [0, 7000],
] as const;

export function MannequinWorkflow({ env }: { env: WorkflowEnv }) {
  const graph = useNodeGraph({ nodes: NODES, edges: EDGES });
  const layout = useRef<"wide" | "phone">("wide");
  const [phone, setPhone] = useState(false);
  const [frame, setFrame] = useState("");
  const view = useCanvasView({
    fit: () => fitBounds(),
    padding: 0,
    minZoom: 0.1,
    fitMinZoom: 0.05,
    fitMaxZoom: 2,
  });

  // Called by the canvas on every resize until the visitor pans or zooms: a
  // portrait tile takes the site's two-column phone layout, top-aligned.
  function fitBounds(): Bounds | null {
    if (view.width <= 0 || view.height <= 0) return null;
    const compact = view.height > view.width * 0.9;
    const want = compact ? "phone" : "wide";
    if (layout.current !== want) {
      layout.current = want;
      for (const n of NODES) {
        const [x, y] = compact ? PHONE_LAYOUT[n.id] : [n.x, n.y];
        graph.moveTo(n.id, x, y);
      }
      setPhone(compact);
    }
    setFrame(`${Math.round(view.width)}x${Math.round(view.height)}`);
    const b = graph.measure();
    if (!b) return null;
    if (compact) return framedBounds(view, b, Math.min(0.6, (view.width - PHONE_PAD.left - PHONE_PAD.right) / b.width), PHONE_PAD, "top");
    return framedBounds(view, b, fitZoom(view, b, WIDE_PAD), WIDE_PAD);
  }

  // The phone drift: down the two columns and back, until the visitor touches the tile.
  const elapsed = useRef(0);
  const drifting = phone && env.active && !env.touched && !view.interacted;
  useEffect(() => {
    if (!drifting || !view.fit()) return;
    const b = graph.measure();
    if (!b) return;
    const z = view.zoom.get();
    const y0 = view.y.get();
    const reach = Math.min(0, view.height - 12 - (y0 + (b.y + b.height) * z));
    if (reach === 0) return;
    const at = driftTimeline(DRIFT);
    const origin = performance.now() - elapsed.current;
    const { width, height } = view;
    view.y.set(y0 + reach * at(elapsed.current));
    let raf = requestAnimationFrame(function step(now) {
      // A resize refits (and may leave the phone layout) before React restarts
      // this effect: stop rather than write a stale offset over the new fit.
      if (layout.current !== "phone" || view.width !== width || view.height !== height || view.interacted) return;
      elapsed.current = now - origin;
      view.y.set(y0 + reach * at(elapsed.current));
      raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [drifting, frame, graph, view]);

  const { selected, setSelected, running, run } = useWorkflowState();
  const [cleared, setCleared] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [videoIndex, setVideoIndex] = useState(0);
  const [promptHeight, setPromptHeight] = useState(253);
  const [orbitHeight, setOrbitHeight] = useState(160);
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
        outputs={IMAGE_MODEL_OUTPUTS}
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
        outputs={VIDEO_OUTPUTS}
        video={mannequin.video}
        playing={env.active}
        history={{ index: videoIndex, count: 12, onPrev: () => setVideoIndex((i) => (i + 11) % 12), onNext: () => setVideoIndex((i) => (i + 1) % 12) }}
        fields={<SchemaFields params={SEEDANCE_PARAMS} />}
        onRun={() => run("generateVideo-17", 3200)}
      />
    </WorkflowCanvas>
  );
}
