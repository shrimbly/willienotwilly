"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { animate } from "motion/react";
import { LifeBuoy, Play } from "lucide-react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";

import {
  Canvas,
  GenerateImageNode,
  ImageInputNode,
  MenuDivider,
  MenuRow,
  NbRoot,
  NoodleLayer,
  PromptNode,
  useNodeGraph,
  type GenerateImageSettings,
} from "./kit";
import { AnatomyOverlay } from "./node-anatomy/anatomy-overlay";
import { EDGES, GENERATE_ID, GENERATE_W, INPUT_PHOTO, NODES, PROMPT, RESULTS, START_HISTORY, START_SETTINGS } from "./node-anatomy/data";
import { NARROW_MAX, useFraming } from "./node-anatomy/framing";
import { PART_ORDER, partAt, type PartId } from "./node-anatomy/parts";

/** How far the node gives under a drag before it springs home (world px). */
const GIVE = 36;
const CYCLE_MS = 2800;
const RUN_MS = 3000;

const RESIZE_EDGE = "[role='separator'][aria-label^='Resize node']";
const SUMMARY_ROW = "[data-controls-card] > div:first-child";

interface History {
  /** Indexes into RESULTS, newest first. */
  items: number[];
  index: number;
  runs: number;
}

export function NodeBananaNodeAnatomyDemo() {
  const root = useRef<HTMLDivElement | null>(null);
  const { active, inView, reducedMotion } = useDemoActive(root);
  const graph = useNodeGraph({ nodes: NODES, edges: EDGES });

  const [selected, setSelected] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [settings, setSettings] = useState<GenerateImageSettings>(START_SETTINGS);
  const [history, setHistory] = useState<History>({ items: START_HISTORY, index: 0, runs: 0 });
  const [running, setRunning] = useState(false);
  const [fallback, setFallback] = useState(false);

  const [labelHover, setLabelHover] = useState<PartId | null>(null);
  const [nodeHover, setNodeHover] = useState<PartId | null>(null);
  const [pinned, setPinned] = useState<PartId | null>(null);
  const [cycle, setCycle] = useState<number | null>(null);
  const [interacted, setInteracted] = useState(false);

  const { view, hold } = useFraming({ rootRef: root, graph, nodeId: GENERATE_ID, expanded, reducedMotion });

  // Phones start with the settings closed: the node has to fit above the legend.
  useLayoutEffect(() => {
    if (root.current && root.current.clientWidth < NARROW_MAX) setExpanded(false);
  }, []);

  // Before the first interaction, step the highlight through the parts.
  const cycling = active && !interacted;
  useEffect(() => {
    if (!cycling) return;
    let step = 0;
    const first = setTimeout(() => setCycle(0), 700);
    const timer = setInterval(() => setCycle(++step % PART_ORDER.length), CYCLE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [cycling]);

  const highlight: PartId | null = labelHover ?? nodeHover ?? pinned ?? (interacted || cycle === null ? null : PART_ORDER[cycle]);

  const touch = useCallback(() => setInteracted(true), []);

  // A run: comets into the node, the spinner over the media, then the new
  // result lands first in the history.
  const run = useCallback(() => {
    setRunning(true);
    touch();
  }, [touch]);
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(
      () => {
        setRunning(false);
        setHistory((h) => {
          const next = (START_HISTORY.length + h.runs) % RESULTS.length;
          return { items: [next, ...h.items].slice(0, 9), index: 0, runs: h.runs + 1 };
        });
      },
      reducedMotion ? 900 : RUN_MS,
    );
    return () => clearTimeout(t);
  }, [running, reducedMotion]);

  // Warm the other results so paging and runs swap instantly.
  useEffect(() => {
    if (!inView) return;
    RESULTS.forEach((r) => {
      const img = new window.Image();
      img.src = r.src;
    });
  }, [inView]);

  const page = (dir: 1 | -1) => {
    touch();
    setHistory((h) => ({ ...h, index: (h.index + dir + h.items.length) % h.items.length }));
  };

  // Dragging: the node gives a little, then springs back to its place (the
  // controls card trails it both ways).
  const rest = useRef({ x: 0, y: 0 });
  const constrain = useCallback((x: number, y: number) => {
    const r = rest.current;
    return { x: r.x + GIVE * Math.tanh((x - r.x) / GIVE), y: r.y + GIVE * Math.tanh((y - r.y) / GIVE) };
  }, []);
  const onDragStart = () => {
    rest.current = graph.position(GENERATE_ID) ?? rest.current;
  };
  const onDragEnd = (moved: boolean) => {
    const node = graph.node(GENERATE_ID);
    if (!moved || !node) return;
    if (reducedMotion) graph.moveTo(GENERATE_ID, rest.current.x, rest.current.y);
    else {
      const spring = { type: "spring", stiffness: 420, damping: 30 } as const;
      animate(node.x, rest.current.x, spring);
      animate(node.y, rest.current.y, spring);
    }
  };

  // Root-level wiring: which part the pointer is over, the resize edges'
  // double-click (back to the default width) and holding the camera while one is dragged.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Element;
      // The kit's node drag captures the pointer on press, which sends the
      // click to the node instead of the summary row, so the row never
      // toggles. Select here and keep the drag from starting on the row.
      if (target.closest(SUMMARY_ROW) && !target.closest("button") && target.closest(`[data-node-id="${GENERATE_ID}"]`)) {
        e.stopPropagation();
        setSelected(true);
        return;
      }
      if (target.closest(RESIZE_EDGE)) {
        hold(true);
        const up = () => {
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          const node = graph.node(GENERATE_ID);
          if (node) rest.current = { x: node.x.get(), y: node.y.get() };
          hold(false);
        };
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      }
    };
    const onDouble = (e: MouseEvent) => {
      if (!(e.target as Element).closest(RESIZE_EDGE)) return;
      graph.setWidth(GENERATE_ID, GENERATE_W);
    };
    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("dblclick", onDouble);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("dblclick", onDouble);
    };
  }, [graph, hold]);

  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const inNode = (e.target as Element).closest(`[data-node-id="${GENERATE_ID}"]`);
    const part = inNode ? partAt(e.target) : null;
    setNodeHover(part);
    if (part) touch();
  };
  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    touch();
    // Touch has no hover: tapping a part of the node traces it.
    if (e.pointerType !== "mouse" && (e.target as Element).closest(`[data-node-id="${GENERATE_ID}"]`)) {
      const part = partAt(e.target);
      if (part) setPinned(part);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    touch();
    if (e.key === "Escape") {
      setSelected(false);
      setPinned(null);
    } else if (e.key === "Enter" && e.altKey && selected && !running) {
      e.preventDefault();
      run();
    }
  };

  const image = RESULTS[history.items[history.index]];

  return (
    <NbRoot
      ref={root}
      role="group"
      aria-label="Anatomy of a Node Banana node: a Generate Image node with its parts labelled"
      onPointerOver={onPointerOver}
      onPointerLeave={() => setNodeHover(null)}
      onPointerDownCapture={onPointerDownCapture}
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">
        Point at or focus a label to trace that part of the node. Select the node to show its socket names and resize edges, page
        back through earlier results under the image, open the settings from the summary row, or run the node from its header.
      </p>
      <Canvas
        view={view}
        pannable={false}
        zoomable={false}
        onPaneClick={() => {
          setSelected(false);
          setPinned(null);
        }}
      >
        <NoodleLayer
          graph={graph}
          selected={selected || highlight === "sockets" ? [GENERATE_ID] : []}
          running={running ? [GENERATE_ID] : []}
          paused={!active}
          still={reducedMotion}
        />
        <ImageInputNode
          graph={graph}
          id="photo"
          draggable={false}
          image={INPUT_PHOTO}
          filename="DSCF4258.JPG"
          dimensions={{ width: 2460, height: 1640 }}
          className="pointer-events-none opacity-40"
        />
        <PromptNode graph={graph} id="prompt" draggable={false} value={PROMPT} height={130} className="pointer-events-none opacity-40" />
        <GenerateImageNode
          graph={graph}
          id={GENERATE_ID}
          title="Generate Image"
          aria-label="Generate Image node"
          image={image}
          history={{ index: history.index, count: history.items.length, onPrev: () => page(-1), onNext: () => page(1) }}
          settings={settings}
          onSettingsChange={(s) => {
            touch();
            setSettings(s);
          }}
          expanded={expanded}
          onExpandedChange={(open) => {
            touch();
            setExpanded(open);
          }}
          selected={selected}
          onSelect={() => setSelected(true)}
          running={running}
          onRun={run}
          menu={
            <>
              <MenuRow icon={<Play size={11} strokeWidth={0} fill="currentColor" />} keys={["⌥", "↵"]} disabled={running} onClick={run}>
                Run node
              </MenuRow>
              <MenuDivider />
              <MenuRow icon={<LifeBuoy size={11} strokeWidth={1.75} />} set={fallback} onClick={() => setFallback((f) => !f)}>
                {fallback ? "Fallback: Nano Banana Pro" : "Set fallback model…"}
              </MenuRow>
            </>
          }
          menuBadge={fallback}
          headerControls={highlight === "header" ? "always" : "auto"}
          resizable={{ min: 200, max: 480 }}
          constrain={constrain}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </Canvas>
      <div className="nb-anat-fade" aria-hidden />
      <AnatomyOverlay
        rootRef={root}
        view={view}
        graph={graph}
        nodeId={GENERATE_ID}
        active={highlight}
        pinned={pinned}
        onHover={(part) => {
          setLabelHover(part);
          if (part) touch();
        }}
        onPick={(part) => {
          touch();
          setPinned((p) => (p === part ? null : part));
        }}
        hint={!interacted}
      />
    </NbRoot>
  );
}
