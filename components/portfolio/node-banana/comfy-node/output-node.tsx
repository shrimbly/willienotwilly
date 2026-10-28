"use client";

import Image from "next/image";

import { NodeCard, type NodeGraph } from "../kit";
import { COMFY_ASPECT, type Still } from "./data";

// OutputNode (src/components/nodes/OutputNode.tsx): Image, Video and Audio
// sockets in, no outputs, no controls card; it shows what the last run
// handed it, at its own proportions.

export function OutputNode({
  graph,
  still,
  running,
  selected,
  onSelect,
  onDragEnd,
}: {
  graph: NodeGraph;
  still: Still;
  /** The workflow is running (the app outlines it for the whole run). */
  running: boolean;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (moved: boolean) => void;
}) {
  return (
    <NodeCard
      graph={graph}
      id="output"
      title="Output"
      selected={selected}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
      running={running}
      media={{ aspect: COMFY_ASPECT }}
    >
      <Image
        key={still.src}
        src={still.src}
        alt={`Output: ${still.alt}`}
        width={still.width}
        height={still.height}
        unoptimized
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </NodeCard>
  );
}
