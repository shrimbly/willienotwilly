"use client";

import { createContext, useContext, useEffect, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionValue } from "motion/react";

import { cn } from "@/lib/utils";

import { noodlePath, type Point } from "./geometry";
import { useGraphVersion, type GraphEdgeSpec, type NodeGraph } from "./graph";
import { EDGE_COLORS, NOODLE_FADED_OPACITY, NOODLE_WIDTH, edgeHighlightColor, type EdgeColorKey } from "./tokens";

// Noodles (src/components/edges/EditableEdge.tsx + SharedEdgeGradients.tsx):
// a curvature-0.25 bezier between socket tips, 3px, stroked with a gradient
// that is bright at both ends and softer in the middle, and a comet that
// travels into a running node.

/** Stop opacities along a noodle: [1, .55, 1] when it touches the selection, [f, .4f, f] otherwise. */
export function gradientOpacities(active: boolean, faded = NOODLE_FADED_OPACITY): [number, number, number] {
  return active ? [1, 0.55, 1] : [faded, faded * 0.4, faded];
}

interface LayerContext {
  prefix: string;
  width: number;
  paused: boolean;
  still: boolean;
}

const NoodleContext = createContext<LayerContext>({ prefix: "nb-edge", width: NOODLE_WIDTH.regular, paused: false, still: false });

export interface NoodleLayerProps {
  /** Prefix for the gradient ids; defaults to a hash of the edges. Set it when two layers draw the same edges. */
  id?: string;
  /** Draws every edge of the graph (or `edges`) as a Noodle. */
  graph?: NodeGraph;
  edges?: ReadonlyArray<GraphEdgeSpec>;
  /** Selected node ids: noodles touching them use the bright gradient. */
  selected?: ReadonlyArray<string>;
  /** Running node ids: a comet travels each noodle into them. */
  running?: ReadonlyArray<string>;
  /** Edge ids not to draw. */
  hidden?: ReadonlyArray<string>;
  /** Edge ids to draw on (560ms, staggered by `drawStagger`). */
  draw?: ReadonlyArray<string>;
  drawStagger?: number;
  thickness?: keyof typeof NOODLE_WIDTH;
  /** Strength of noodles away from the selection (the app's edgeAppearance.fadedOpacity, default 0.25); 1 = never dimmed. */
  fadedOpacity?: number;
  /** Holds the comets in place (the demo is off screen). */
  paused?: boolean;
  /** The comets' still frame: a static highlight along the whole noodle (reduced motion). */
  still?: boolean;
  /** Called with the edge id when a noodle is clicked. */
  onNoodleClick?: (edgeId: string) => void;
  /** Extra <Noodle>s (manual endpoints). */
  children?: ReactNode;
  className?: string;
}

/**
 * The SVG layer under the nodes: shared gradients (one per colour × active /
 * dimmed, ids from the edges so two demos never clash) and one Noodle per edge.
 */
export function NoodleLayer({
  id,
  graph,
  edges,
  selected = [],
  running = [],
  hidden = [],
  draw = [],
  drawStagger = 80,
  thickness = "regular",
  fadedOpacity = NOODLE_FADED_OPACITY,
  paused = false,
  still = false,
  onNoodleClick,
  children,
  className,
}: NoodleLayerProps) {
  useGraphVersion(graph);
  const list = edges ?? graph?.edges ?? [];
  // Not useId: ids must match between the server render and hydration, and the
  // demo slot's lazy wrapper shifts useId between the two.
  const prefix = `nb-edge-${id ?? hashKey(`${fadedOpacity}|${list.map((e) => `${e.id}:${e.from}.${e.fromHandle}>${e.to}.${e.toHandle}`).join("|")}`)}`;
  const width = NOODLE_WIDTH[thickness];

  return (
    <NoodleContext.Provider value={{ prefix, width, paused, still }}>
      <svg className={cn("nb-noodles", className)} aria-hidden>
        <defs>
          {Object.entries(EDGE_COLORS).flatMap(([key, color]) =>
            (["active", "dimmed"] as const).map((state) => {
              const [a, b, c] = gradientOpacities(state === "active", fadedOpacity);
              return (
                <linearGradient key={`${key}-${state}`} id={`${prefix}-${key}-${state}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={color} stopOpacity={a} />
                  <stop offset="50%" stopColor={color} stopOpacity={b} />
                  <stop offset="100%" stopColor={color} stopOpacity={c} />
                </linearGradient>
              );
            }),
          )}
        </defs>
        {graph &&
          list
            .filter((e) => !hidden.includes(e.id))
            .map((e) => (
              <Noodle
                key={e.id}
                graph={graph}
                edge={e}
                active={selected.includes(e.from) || selected.includes(e.to)}
                running={running.includes(e.to)}
                draw={draw.includes(e.id)}
                drawDelay={Math.max(0, draw.indexOf(e.id)) * drawStagger}
                onClick={onNoodleClick ? () => onNoodleClick(e.id) : undefined}
              />
            ))}
        {children}
      </svg>
    </NoodleContext.Provider>
  );
}

/** A short, stable hash (djb2, base 36) for ids derived from content. */
function hashKey(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export interface NoodleProps {
  /** Follow an edge of a graph... */
  graph?: NodeGraph;
  edge?: GraphEdgeSpec;
  /** ...or draw between two fixed points (world px). */
  source?: Point;
  target?: Point;
  /** Colour key (default: the edge's, else the source socket's type). */
  color?: EdgeColorKey;
  /** Touches the selection: the bright gradient. */
  active?: boolean;
  /** The target is running: a comet travels the noodle. */
  running?: boolean;
  /** Draw on once, after `drawDelay` ms. */
  draw?: boolean;
  drawDelay?: number;
  /** Selected noodle: the active stroke, as on hover. */
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/** One noodle. Inside a NoodleLayer (for the gradients). Its path follows the nodes without re-rendering. */
export function Noodle({ graph, edge, source, target, color, active = false, running = false, draw = false, drawDelay = 0, selected = false, onClick, className }: NoodleProps) {
  const { prefix, width, paused, still } = useContext(NoodleContext);
  const initial = edge && graph ? (graph.route(edge)?.d ?? "") : source && target ? noodlePath(source, target) : "";
  const d = useMotionValue(initial);

  useEffect(() => {
    if (graph && edge) {
      const update = () => d.set(graph.route(edge)?.d ?? "");
      update();
      return graph.watch([edge.from, edge.to], update);
    }
    if (source && target) d.set(noodlePath(source, target));
  }, [graph, edge, source, target, d]);

  const key: EdgeColorKey = color ?? (graph && edge ? graph.colorKey(edge) : "default");
  const hex = EDGE_COLORS[key];
  const groupStyle = { ["--nb-noodle-active" as string]: `url(#${prefix}-${key}-active)` } as CSSProperties;

  return (
    <g className={cn("nb-noodle-group", className)} data-selected={selected ? "" : undefined} data-edge-id={edge?.id} style={groupStyle}>
      <motion.path
        d={d}
        className={cn("nb-noodle", draw && "nb-noodle--draw")}
        pathLength={draw ? 1 : undefined}
        stroke={`url(#${prefix}-${key}-${active ? "active" : "dimmed"})`}
        strokeWidth={width}
        style={draw ? ({ ["--nb-draw-delay" as string]: `${drawDelay}ms` } as CSSProperties) : undefined}
      />
      {running && (
        <g className="nb-noodle-running" data-paused={paused ? "" : undefined} data-static={still ? "" : undefined}>
          <motion.path d={d} pathLength={100} className="nb-noodle-running__tail" stroke={hex} strokeWidth={width + 3} />
          <motion.path d={d} pathLength={100} className="nb-noodle-running__head" stroke={edgeHighlightColor(hex)} strokeWidth={width} />
        </g>
      )}
      <motion.path d={d} className="nb-noodle-hit" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined} />
    </g>
  );
}
