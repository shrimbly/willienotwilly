"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { motionValue, type MotionValue } from "motion/react";

import {
  graphBounds,
  noodleRoute,
  socketPoint,
  socketRowOf,
  type Bounds,
  type NoodleRoute,
  type Point,
  type SocketSide,
  type SocketSpec,
} from "./geometry";
import { EDGE_COLORS, type EdgeColorKey } from "./tokens";

export interface GraphNodeSpec {
  id: string;
  /** World position of the media card's outer top-left (the header floats 26px above). */
  x: number;
  y: number;
  /** Node width; the app's defaults are in NODE_DEFAULT_W. */
  width: number;
  inputs?: SocketSpec[];
  outputs?: SocketSpec[];
}

export interface GraphEdgeSpec {
  id: string;
  from: string;
  fromHandle: string;
  to: string;
  toHandle: string;
  /** Colour key; defaults to the source socket's type. */
  color?: EdgeColorKey;
}

export interface GraphNode {
  id: string;
  x: MotionValue<number>;
  y: MotionValue<number>;
  width: MotionValue<number>;
  inputs: SocketSpec[];
  outputs: SocketSpec[];
}

type Listener = () => void;

/**
 * A workflow on the canvas: node positions and widths as motion values (so
 * drags never re-render React), the sockets of each node and the edges
 * between them. Noodles and nodes subscribe to it.
 */
export class NodeGraph {
  private nodeMap = new Map<string, GraphNode>();
  private elements = new Map<string, HTMLElement>();
  private edgeList: GraphEdgeSpec[] = [];
  private structureListeners = new Set<Listener>();
  private version = 0;

  constructor(nodes: ReadonlyArray<GraphNodeSpec>, edges: ReadonlyArray<GraphEdgeSpec> = []) {
    nodes.forEach((spec) => this.add(spec));
    this.edgeList = [...edges];
  }

  private add(spec: GraphNodeSpec): GraphNode {
    const node: GraphNode = {
      id: spec.id,
      x: motionValue(spec.x),
      y: motionValue(spec.y),
      width: motionValue(spec.width),
      inputs: spec.inputs ?? [],
      outputs: spec.outputs ?? [],
    };
    this.nodeMap.set(spec.id, node);
    return node;
  }

  /** The node, created from `spec` if it is not in the graph yet. */
  ensure(spec: GraphNodeSpec): GraphNode {
    return this.nodeMap.get(spec.id) ?? this.add(spec);
  }

  node(id: string): GraphNode | undefined {
    return this.nodeMap.get(id);
  }

  get ids(): string[] {
    return [...this.nodeMap.keys()];
  }

  get edges(): ReadonlyArray<GraphEdgeSpec> {
    return this.edgeList;
  }

  /**
   * Take new specs: sockets and edges replace the old ones, unknown nodes are
   * added, positions of known nodes are left alone (move them with moveTo).
   */
  sync(nodes: ReadonlyArray<GraphNodeSpec>, edges?: ReadonlyArray<GraphEdgeSpec>) {
    let changed = false;
    for (const spec of nodes) {
      const node = this.nodeMap.get(spec.id);
      if (!node) {
        this.add(spec);
        changed = true;
        continue;
      }
      const inputs = spec.inputs ?? [];
      const outputs = spec.outputs ?? [];
      if (!sameSockets(node.inputs, inputs) || !sameSockets(node.outputs, outputs)) {
        node.inputs = inputs;
        node.outputs = outputs;
        changed = true;
      }
    }
    if (edges && !sameEdges(this.edgeList, edges)) {
      this.edgeList = [...edges];
      changed = true;
    }
    if (changed) this.bump();
  }

  /** Replace one node's sockets (a node that grows inputs as it is wired). */
  setSockets(id: string, inputs: SocketSpec[], outputs: SocketSpec[]) {
    const node = this.nodeMap.get(id);
    if (!node || (sameSockets(node.inputs, inputs) && sameSockets(node.outputs, outputs))) return;
    node.inputs = inputs;
    node.outputs = outputs;
    this.bump();
  }

  setEdges(edges: ReadonlyArray<GraphEdgeSpec>) {
    if (sameEdges(this.edgeList, edges)) return;
    this.edgeList = [...edges];
    this.bump();
  }

  moveTo(id: string, x: number, y: number) {
    const node = this.nodeMap.get(id);
    if (!node) return;
    node.x.set(x);
    node.y.set(y);
  }

  setWidth(id: string, width: number) {
    this.nodeMap.get(id)?.width.set(width);
  }

  position(id: string): Point | null {
    const node = this.nodeMap.get(id);
    return node ? { x: node.x.get(), y: node.y.get() } : null;
  }

  /** Whether any edge ends on this socket. */
  isConnected(id: string, side: SocketSide, handle: string): boolean {
    return this.edgeList.some((e) => (side === "in" ? e.to === id && e.toHandle === handle : e.from === id && e.fromHandle === handle));
  }

  /** Where a noodle meets socket `handle` of node `id`, in world px. */
  point(id: string, side: SocketSide, handle: string): Point | null {
    const node = this.nodeMap.get(id);
    if (!node) return null;
    const row = socketRowOf(side === "in" ? node.inputs : node.outputs, handle);
    if (row < 0) return null;
    return socketPoint({ x: node.x.get(), y: node.y.get(), width: node.width.get() }, side, row);
  }

  route(edge: GraphEdgeSpec): NoodleRoute | null {
    const a = this.point(edge.from, "out", edge.fromHandle);
    const b = this.point(edge.to, "in", edge.toHandle);
    return a && b ? noodleRoute(a, b) : null;
  }

  /** The noodle's colour key: its own, else the source socket's type. */
  colorKey(edge: GraphEdgeSpec): EdgeColorKey {
    if (edge.color) return edge.color;
    const type = this.nodeMap.get(edge.from)?.outputs.find((s) => s.id === edge.fromHandle)?.type;
    return type && type in EDGE_COLORS ? type : "default";
  }

  /** Calls `fn` whenever any of these nodes moves or resizes, or the structure changes. */
  watch(ids: ReadonlyArray<string>, fn: Listener): () => void {
    const offs: Array<() => void> = [];
    for (const id of new Set(ids)) {
      const node = this.nodeMap.get(id);
      if (!node) continue;
      offs.push(node.x.on("change", fn), node.y.on("change", fn), node.width.on("change", fn));
    }
    offs.push(this.subscribe(fn));
    return () => offs.forEach((off) => off());
  }

  subscribe = (fn: Listener): (() => void) => {
    this.structureListeners.add(fn);
    return () => this.structureListeners.delete(fn);
  };

  getVersion = () => this.version;

  private bump() {
    this.version++;
    this.structureListeners.forEach((fn) => fn());
  }

  /** NodeCard registers its element so the graph can be measured for fitting. */
  registerElement(id: string, el: HTMLElement | null) {
    if (el) this.elements.set(id, el);
    else this.elements.delete(id);
  }

  /** World bounds of the rendered nodes (headers and sockets included), or null before mount. */
  measure(ids?: ReadonlyArray<string>): Bounds | null {
    const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (const id of ids ?? this.ids) {
      const node = this.nodeMap.get(id);
      const el = this.elements.get(id);
      if (!node || !el) continue;
      boxes.push({ x: node.x.get(), y: node.y.get(), width: node.width.get(), height: el.offsetHeight });
    }
    return boxes.length ? graphBounds(boxes) : null;
  }
}

function sameSockets(a: ReadonlyArray<SocketSpec>, b: ReadonlyArray<SocketSpec>): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((s, i) => {
    const t = b[i];
    return (
      s.id === t.id &&
      s.type === t.type &&
      s.label === t.label &&
      s.connected === t.connected &&
      s.placeholder === t.placeholder &&
      s.hidden === t.hidden &&
      s.row === t.row
    );
  });
}

function sameEdges(a: ReadonlyArray<GraphEdgeSpec>, b: ReadonlyArray<GraphEdgeSpec>): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((e, i) => {
    const f = b[i];
    return e.id === f.id && e.from === f.from && e.fromHandle === f.fromHandle && e.to === f.to && e.toHandle === f.toHandle && e.color === f.color;
  });
}

/**
 * One graph for the component's lifetime. Positions in `nodes` are the
 * starting layout; later changes to sockets and edges are synced in.
 */
export function useNodeGraph({ nodes, edges = [] }: { nodes: ReadonlyArray<GraphNodeSpec>; edges?: ReadonlyArray<GraphEdgeSpec> }): NodeGraph {
  const [graph] = useState(() => new NodeGraph(nodes, edges));
  useEffect(() => {
    graph.sync(nodes, edges);
  }, [graph, nodes, edges]);
  return graph;
}

/** Re-renders when the graph's sockets or edges change (not on moves). */
export function useGraphVersion(graph: NodeGraph | null | undefined): number {
  return useSyncExternalStore(
    graph ? graph.subscribe : noopSubscribe,
    graph ? graph.getVersion : zero,
    graph ? graph.getVersion : zero,
  );
}

const noopSubscribe = () => () => {};
const zero = () => 0;
