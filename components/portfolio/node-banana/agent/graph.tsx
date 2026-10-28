"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronRight, SlidersHorizontal, Split } from "lucide-react";
import { animate } from "motion/react";

import { AGENT_NODES, LOCATION_LINES, type AgentNodeData } from "@/lib/node-banana/agent-script";
import { cn } from "@/lib/utils";

import {
  ControlsCard,
  EmptyState,
  GENERATE_IMAGE_INPUTS,
  GENERATE_IMAGE_OUTPUTS,
  GenerateImageNode,
  NodeCard,
  NoodleLayer,
  PROMPT_INPUTS,
  PROMPT_OUTPUTS,
  PanelButton,
  PromptNode,
  SelectWell,
  ellipsisClass,
  type GraphEdgeSpec,
  type GraphNodeSpec,
  type NodeGraph,
  type SocketSpec,
} from "../kit";

// The workflow the agent builds: the site's nine nodes in four columns, as the
// app draws them (PromptNode, GenerateImageNode, ArrayNode, OutputGalleryNode).

const ARRAY_INPUTS: SocketSpec[] = [{ id: "text", type: "text", label: "Text" }];
const ARRAY_OUTPUTS: SocketSpec[] = [{ id: "text", type: "text", label: "Items" }];
const GALLERY_INPUTS: SocketSpec[] = [
  { id: "image", type: "image", label: "Image" },
  { id: "video", type: "video", label: "Video" },
];

const SOCKETS: Record<AgentNodeData["kind"], { inputs: SocketSpec[]; outputs: SocketSpec[] }> = {
  prompt: { inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS },
  generate: { inputs: GENERATE_IMAGE_INPUTS, outputs: GENERATE_IMAGE_OUTPUTS },
  array: { inputs: ARRAY_INPUTS, outputs: ARRAY_OUTPUTS },
  gallery: { inputs: GALLERY_INPUTS, outputs: [] },
};

export const GRAPH_NODES: GraphNodeSpec[] = AGENT_NODES.map((node) => ({
  id: node.id,
  x: node.x,
  y: node.y,
  width: node.width,
  ...SOCKETS[node.kind],
}));

const SPLIT_OPTIONS = [
  { value: "delimiter", label: "By delimiter" },
  { value: "newline", label: "By line" },
  { value: "regex", label: "By regex" },
];

/** ArrayNode (batch off): split by line, the items, Batch, "Make 4 Prompts". */
function ArrayBody() {
  const [mode, setMode] = useState("newline");
  const [openItem, setOpenItem] = useState<number | null>(null);
  return (
    <div className="flex flex-col pb-1" style={{ paddingTop: 4 }}>
      <div className="flex h-[30px] min-w-0 shrink-0 items-center gap-1.5 px-2">
        <SelectWell className="nodrag w-[104px] shrink-0" value={mode} options={SPLIT_OPTIONS} onChange={setMode} aria-label="Split mode" />
        <span className="flex-1" />
        <span className="nb-text-node shrink-0 font-medium text-neutral-200 tabular-nums">4 items</span>
        <span
          aria-hidden
          className="nb-rounded-well nb-squircle nb-bg-well nb-shadow-well flex h-[22px] w-[22px] shrink-0 items-center justify-center text-neutral-400"
        >
          <SlidersHorizontal size={12} strokeWidth={2} />
        </span>
      </div>
      <div className="flex flex-col gap-1 px-2">
        <div className="nb-rounded-well nb-squircle nb-bg-well nb-shadow-well relative">
          <div className="py-1">
            {LOCATION_LINES.map((item, index) => {
              const open = openItem === index;
              return (
                <button
                  key={item}
                  type="button"
                  aria-expanded={open}
                  title={open ? "Collapse" : "Show the full text"}
                  onClick={() => setOpenItem(open ? null : index)}
                  className={cn(
                    "nodrag nb-squircle nb-text-node mx-1 my-0.5 flex w-[calc(100%-0.5rem)] gap-1.5 rounded-[6px] pr-1 pl-1.5 text-left transition-colors",
                    open ? "items-start bg-neutral-700/60 py-[4px] text-neutral-100" : "h-[22px] items-center bg-neutral-800/60 text-neutral-300 hover:bg-neutral-700/60",
                  )}
                >
                  <span className="w-3 shrink-0 text-right text-neutral-500 tabular-nums">{index + 1}</span>
                  <span className={cn("min-w-0 flex-1", open ? "break-words whitespace-pre-wrap" : ellipsisClass)}>{item}</span>
                  <span className={cn("mx-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nb-handle-text)]", open && "mt-[4px]")} title="On 1 connection" />
                  <ChevronRight size={12} strokeWidth={2} aria-hidden className={cn("shrink-0 text-neutral-500 transition-transform", open && "mt-px rotate-90")} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 border-t border-white/[0.06] pt-1.5">
          <span aria-hidden className="relative h-3.5 w-7 rounded-full bg-neutral-600">
            <span className="absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="nb-text-node text-neutral-400">Batch</span>
          <span className="flex-1" />
          <PanelButton tabIndex={-1} aria-hidden className="pointer-events-none flex items-center gap-1">
            <Split size={12} strokeWidth={2} className="rotate-90" />
            Make 4 Prompts
          </PanelButton>
        </div>
        <div className="nb-text-node pb-1 text-neutral-500">Each connection carries one item.</div>
      </div>
    </div>
  );
}

const CONCEPT_IDS = ["ag-c0", "ag-c1", "ag-c2", "ag-c3"];
const NO_DRAW: string[] = [];

export interface AgentGraphProps {
  graph: NodeGraph;
  edges: GraphEdgeSpec[];
  built: number;
  /** The noodles draw on (while they are being wired). */
  drawing: boolean;
  tidy: boolean;
  shimmer: boolean;
  running: readonly string[];
  outputs: Readonly<Record<string, number>>;
  /** Nodes rise in as they land (not on the server's finished render). */
  animateEntry: boolean;
  reducedMotion: boolean;
  active: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

/** The world layer's content: noodles, then the nodes that have landed. */
export const AgentGraph = memo(function AgentGraph({
  graph,
  edges,
  built,
  drawing,
  tidy,
  shimmer,
  running,
  outputs,
  animateEntry,
  reducedMotion,
  active,
  selected,
  onSelect,
}: AgentGraphProps) {
  const wasBuilt = useRef(built);
  const wasTidy = useRef(tidy);
  const draw = drawing && animateEntry && !reducedMotion ? edges.map((e) => e.id) : NO_DRAW;

  // Create workflow drops the nodes near their places; Tidy layout moves them into columns.
  useEffect(() => {
    const landing = built > 0 && wasBuilt.current === 0;
    wasBuilt.current = built;
    if (landing && !tidy) {
      for (const node of AGENT_NODES) graph.moveTo(node.id, node.x + node.rough.dx, node.y + node.rough.dy);
    }
    if (built === 0) for (const node of AGENT_NODES) graph.moveTo(node.id, node.x, node.y);
  }, [built, tidy, graph]);

  useEffect(() => {
    const tidying = tidy && !wasTidy.current;
    wasTidy.current = tidy;
    if (!tidying) return;
    const controls = AGENT_NODES.flatMap((node) => {
      const n = graph.node(node.id);
      if (!n) return [];
      if (reducedMotion) {
        graph.moveTo(node.id, node.x, node.y);
        return [];
      }
      const opts = { duration: 0.62, ease: [0.2, 0.8, 0.2, 1] as const };
      return [animate(n.x, node.x, opts), animate(n.y, node.y, opts)];
    });
    return () => controls.forEach((c) => c.stop());
  }, [tidy, graph, reducedMotion]);

  const shell = (node: AgentNodeData, index: number) => ({
    key: node.id,
    graph,
    id: node.id,
    selected: selected === node.id,
    onSelect: () => onSelect(node.id),
    shimmer,
    enterIndex: animateEntry ? index : undefined,
    "aria-label": `${node.title} node`,
  });

  const concepts = CONCEPT_IDS.filter((id) => (outputs[id] ?? 0) > 0);

  return (
    <>
      <NoodleLayer
        graph={graph}
        selected={selected ? [selected] : []}
        running={running}
        draw={draw}
        drawStagger={40}
        paused={!active}
        still={reducedMotion}
      />
      {AGENT_NODES.slice(0, built).map((node, index) => {
        const { key, ...props } = shell(node, index);
        if (node.kind === "prompt") return <PromptNode key={key} {...props} title={node.title} value={node.text ?? ""} height={node.height} />;
        if (node.kind === "generate") {
          const count = outputs[node.id] ?? 0;
          return (
            <GenerateImageNode
              key={key}
              {...props}
              title={node.title}
              settings={{ model: node.model, aspectRatio: "16:9", resolution: "1K" }}
              image={count > 0 && node.output ? { ...node.output, alt: node.title } : null}
              history={count > 1 ? { index: count - 1, count } : undefined}
              running={running.includes(node.id)}
            />
          );
        }
        if (node.kind === "array") {
          return (
            <NodeCard key={key} {...props} title={node.title} media="auto" cardClassName="nb-rounded-controls" mediaClassName="overflow-visible">
              <ArrayBody />
            </NodeCard>
          );
        }
        return (
          <NodeCard
            key={key}
            {...props}
            title={node.title}
            media={{ height: concepts.length ? 240 : 150 }}
            controls={concepts.length ? <ControlsCard summary={{ title: `${concepts.length} ${concepts.length === 1 ? "item" : "items"}` }} /> : undefined}
          >
            {concepts.length === 0 ? (
              <EmptyState message="Connect image or video nodes to view gallery" />
            ) : (
              <div className="absolute inset-0 overflow-hidden bg-neutral-900/40">
                <div className="grid grid-cols-3 gap-1 p-1 pb-4">
                  {concepts.map((id) => {
                    const data = AGENT_NODES.find((n) => n.id === id)!;
                    return (
                      <span key={id} className="nb-squircle relative aspect-square overflow-hidden rounded-[6px] border border-neutral-700">
                        <Image src={data.output!.src} alt="" width={640} height={357} unoptimized draggable={false} className="h-full w-full object-cover" />
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </NodeCard>
        );
      })}
    </>
  );
});
