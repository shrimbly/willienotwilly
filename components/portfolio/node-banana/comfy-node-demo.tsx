"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { animate, type AnimationPlaybackControls } from "motion/react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import { cn } from "@/lib/utils";

import { ComfyAppNode, type ComfyRunView } from "./comfy-node/comfy-app-node";
import { nextSeed, type SeedMode } from "./comfy-node/comfy-parameters";
import {
  COMFY_MAX_W,
  EARLIER_RUNS,
  EDGES,
  FIT_PADDING,
  FIT_SET,
  INITIAL_PARAMS,
  LAYOUTS,
  NODES,
  PROMPT,
  PROMPT_HEIGHT,
  REFERENCE,
  REFERENCE_FILENAME,
  RUN_CYCLE,
  RUN_HISTORY_LIMIT,
  nodeHeight,
  tierFor,
  type ComfyParams,
  type ComfyRun,
  type NodeId,
  type Still,
  type Tier,
} from "./comfy-node/data";
import { OutputNode } from "./comfy-node/output-node";
import { useComfyRun } from "./comfy-node/use-comfy-run";
import {
  CHROME_SURFACE,
  Canvas,
  DemoHint,
  ImageInputNode,
  NbRoot,
  NoodleLayer,
  PromptNode,
  RunSplitButton,
  graphBounds,
  useCanvasView,
  useNodeGraph,
} from "./kit";

// "Your ComfyUI workflows, as nodes": the landing site's Comfy node, working,
// on a small canvas. A reference photo and a prompt feed its App Mode
// sockets; its image goes on to an Output node. Run it and the result lands
// in the node's run history, which the gap row pages through.

/** The seed the tile's own first run leaves behind, so its resting state is the same every time. */
const INTRO_NEXT_SEED = 1209457316;
/** The run bar's height plus its margin, kept clear when the settings or a dropdown open. */
const RUN_BAR_SPACE = 72;
const SPRING_BACK = { duration: 0.42, ease: [0.33, 1, 0.68, 1] as const };

export function NodeBananaComfyNodeDemo() {
  const root = useRef<HTMLDivElement | null>(null);
  const { active, reducedMotion } = useDemoActive(root);
  const graph = useNodeGraph({ nodes: NODES, edges: EDGES });

  const view = useCanvasView({
    fit: () => {
      const ids = FIT_SET[tierFor(view.width)];
      return graphBounds(
        ids.map((id) => {
          const node = graph.node(id)!;
          const width = node.width.get();
          return { x: node.x.get(), y: node.y.get(), width, height: nodeHeight(id, width) };
        }),
      );
    },
    // Read at fit time, so the room follows the tile's size.
    padding: {
      get top() {
        return FIT_PADDING[tierFor(view.width)].top;
      },
      get right() {
        return FIT_PADDING[tierFor(view.width)].right;
      },
      get bottom() {
        return FIT_PADDING[tierFor(view.width)].bottom;
      },
      get left() {
        return FIT_PADDING[tierFor(view.width)].left;
      },
    },
    minZoom: 0.2,
    fitMaxZoom: 1,
  });

  const [tier, setTier] = useState<Tier>("l");
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [history, setHistory] = useState<ComfyRun[]>(EARLIER_RUNS);
  const [index, setIndex] = useState(0);
  const [outputStill, setOutputStill] = useState<Still>(EARLIER_RUNS[0].still);
  const [params, setParams] = useState<ComfyParams>(INITIAL_PARAMS);
  const [seedMode, setSeedMode] = useState<SeedMode>("random");
  const [expanded, setExpanded] = useState(false);
  const [controlsWidth, setControlsWidth] = useState<number | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  const cycle = useRef(0);
  const nextId = useRef(EARLIER_RUNS[0].id + 1);
  const introDone = useRef(false);

  const land = useCallback((job: ComfyRun) => {
    setHistory((h) => [job, ...h].slice(0, RUN_HISTORY_LIMIT));
    setIndex(0);
  }, []);
  const { run, start, stop } = useComfyRun({ active, onRendered: land, onDone: (job) => setOutputStill(job.still) });

  const queueRun = (seedAfter?: number) => {
    if (run) return;
    const still = RUN_CYCLE[cycle.current % RUN_CYCLE.length];
    cycle.current += 1;
    const job: ComfyRun = { id: nextId.current, still, seed: params.seed };
    nextId.current += 1;
    // As in ComfyUI, the seed moves on as soon as the run is queued.
    setParams((p) => ({ ...p, seed: seedAfter ?? nextSeed(p.seed, seedMode) }));
    if (reducedMotion) {
      land(job);
      setOutputStill(job.still);
    } else {
      start(job, params.steps);
    }
  };
  const queueRunRef = useRef(queueRun);
  useEffect(() => {
    queueRunRef.current = queueRun;
  });

  // The tile runs the workflow once when it first comes into view (at once, without motion, for reduced motion).
  useEffect(() => {
    if (introDone.current || touched || (!active && !reducedMotion)) return;
    const timer = setTimeout(
      () => {
        introDone.current = true;
        queueRunRef.current(seedMode === "random" ? INTRO_NEXT_SEED : undefined);
      },
      reducedMotion ? 0 : 1100,
    );
    return () => clearTimeout(timer);
  }, [active, reducedMotion, touched, seedMode]);

  /* ---------------------------------------------- layout, fit and spring-back */

  const seats = useRef(new Map<NodeId, { x: number; y: number }>());
  const springs = useRef(new Map<NodeId, AnimationPlaybackControls[]>());
  const resized = useRef(false);
  const placing = useRef(false);
  /** How far opening the settings panned the camera up, to undo on close. */
  const revealed = useRef(0);

  // Phones get a narrower Comfy node and see it alone; wider tiles add its inputs, then the whole graph.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const place = (t: Tier) => {
      placing.current = true;
      for (const [id, p] of Object.entries(LAYOUTS[t]) as [NodeId, { x: number; y: number; width: number }][]) {
        graph.moveTo(id, p.x, p.y);
        graph.setWidth(id, p.width);
        seats.current.set(id, { x: p.x, y: p.y });
      }
      placing.current = false;
    };
    let current = tierFor(el.clientWidth);
    place(current);
    const ro = new ResizeObserver(([entry]) => {
      // The canvas refits on resize, which already drops the settings' reveal pan.
      if (!view.interacted) revealed.current = 0;
      const next = tierFor(entry.contentRect.width);
      setTier(next);
      if (next === current) return;
      current = next;
      if (!resized.current) place(next);
      if (!view.interacted) view.fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [graph, view]);

  // A width the visitor drags is theirs: a later change of tier no longer resets the layout.
  useEffect(
    () =>
      graph.node("comfy")?.width.on("change", () => {
        if (!placing.current) resized.current = true;
      }),
    [graph],
  );

  // A drag that starts mid-spring catches the node where it is and keeps the seat it was returning
  // to; otherwise wherever it rests now (moved by the keys, or resized from the left) is its seat.
  // Held when the drag starts, not on select: a finger selects only when it lifts.
  const holdSeat = (id: NodeId) => {
    const moving = springs.current.get(id);
    if (moving) {
      moving.forEach((a) => a.stop());
      springs.current.delete(id);
    } else {
      const p = graph.position(id);
      if (p) seats.current.set(id, p);
    }
  };

  // Let go and the node springs back to where it sat (the site's 420ms ease-out), its controls card trailing.
  const springBack = (id: NodeId) => {
    const node = graph.node(id);
    const seat = seats.current.get(id);
    if (!node || !seat) return;
    if (node.x.get() === seat.x && node.y.get() === seat.y) return;
    if (reducedMotion) {
      graph.moveTo(id, seat.x, seat.y);
      return;
    }
    const controls: AnimationPlaybackControls[] = [];
    let left = 2;
    const onComplete = () => {
      if (--left === 0 && springs.current.get(id) === controls) springs.current.delete(id);
    };
    controls.push(animate(node.x, seat.x, { ...SPRING_BACK, onComplete }), animate(node.y, seat.y, { ...SPRING_BACK, onComplete }));
    springs.current.set(id, controls);
  };

  const shell = (id: NodeId) => ({
    graph,
    selected: selected === id,
    onSelect: () => setSelected(id),
    onDragStart: () => holdSeat(id),
    onDragEnd: () => springBack(id),
  });

  // Opening the settings on a short tile pans just enough to show them above the run bar; closing pans back.
  useEffect(() => {
    const timer = setTimeout(() => {
      const canvas = view.element;
      const card = root.current?.querySelector<HTMLElement>('[data-node-id="comfy"] [data-controls-card]');
      if (!canvas || !card) return;
      const pan = (to: number) => animate(view.y, to, { duration: reducedMotion ? 0 : 0.32, ease: [0.2, 0.8, 0.2, 1] });
      if (!expanded) {
        if (revealed.current) pan(view.y.get() + revealed.current);
        revealed.current = 0;
        return;
      }
      const c = canvas.getBoundingClientRect();
      const r = card.getBoundingClientRect();
      const over = r.bottom - (c.bottom - RUN_BAR_SPACE);
      // The settings win over the picture: the media may leave the top, the summary row may not.
      const headroom = r.top - (c.top + 12);
      const shift = Math.max(0, Math.min(over, headroom));
      if (shift < 1) return;
      revealed.current = shift;
      pan(view.y.get() - shift);
    }, 170);
    return () => clearTimeout(timer);
  }, [expanded, view, reducedMotion]);

  /* ------------------------------------------------------------------ render */

  const current = history[index] ?? history[0];
  const runView: ComfyRunView | null = run
    ? { status: run.status, preview: run.frame >= 0 ? { still: run.still, progress: (run.frame + 1) / run.frames, frame: run.frame } : null }
    : null;
  const page = (step: 1 | -1) => setIndex((i) => (i + step + history.length) % history.length);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented && selected) setSelected(null);
  };

  return (
    <NbRoot
      ref={root}
      role="group"
      aria-label="Node Banana: a ComfyUI workflow running as a node"
      // A finger that lands on the tile to scroll the page is not playing with it: a
      // touch counts once it ends without the browser taking it over (pointercancel).
      onPointerDownCapture={(event) => event.pointerType !== "touch" && setTouched(true)}
      onPointerUpCapture={() => setTouched(true)}
      onKeyDownCapture={() => setTouched(true)}
      onKeyDown={onKeyDown}
      // Dropdowns in the settings open upward rather than under the run bar.
      style={{ "--nb-list-inset-bottom": RUN_BAR_SPACE } as CSSProperties}
    >
      <p className="sr-only">
        Select the ComfyUI node to resize it from either edge or drag it; open its settings, press Run, then page back through earlier runs.
      </p>
      <p className="sr-only" aria-live="polite">
        {run ? "Running the workflow" : `Run ${current.id}, ${index + 1} of ${history.length}: ${current.still.alt}`}
      </p>
      <Canvas
        view={view}
        gridZoom={false}
        onPaneClick={() => setSelected(null)}
        overlay={
          <div
            className={cn(
              CHROME_SURFACE,
              "absolute left-1/2 z-10 flex h-12 -translate-x-1/2 items-center rounded-xl px-1.5",
              tier === "s" ? "bottom-3" : "bottom-4",
            )}
          >
            <RunSplitButton onRun={run ? stop : () => queueRun()} running={run !== null} />
          </div>
        }
      >
        <NoodleLayer
          graph={graph}
          selected={selected ? [selected] : []}
          running={run ? [run.status === "output" ? "output" : "comfy"] : []}
          paused={!active}
          still={reducedMotion}
        />
        <ImageInputNode id="reference" {...shell("reference")} image={REFERENCE} filename={REFERENCE_FILENAME} />
        <PromptNode id="prompt" {...shell("prompt")} value={PROMPT} height={PROMPT_HEIGHT} />
        <ComfyAppNode
          {...shell("comfy")}
          onPress={() => setSelected("comfy")}
          maxWidth={COMFY_MAX_W[tier]}
          defaultWidth={LAYOUTS[tier].comfy.width}
          run={runView}
          onRun={() => queueRun()}
          history={history}
          index={index}
          onPrev={() => page(-1)}
          onNext={() => page(1)}
          params={params}
          onParamsChange={(patch) => setParams((p) => ({ ...p, ...patch }))}
          seedMode={seedMode}
          onSeedModeChange={setSeedMode}
          expanded={expanded}
          onExpandedChange={setExpanded}
          controlsWidth={controlsWidth}
          onControlsWidthChange={setControlsWidth}
        />
        <OutputNode {...shell("output")} still={outputStill} running={run !== null} />
      </Canvas>
      {/* Beside the run bar, never under it; it waits out a run, while the button reads Stop. */}
      <DemoHint hidden={touched || run !== null}>Press Run</DemoHint>
    </NbRoot>
  );
}
