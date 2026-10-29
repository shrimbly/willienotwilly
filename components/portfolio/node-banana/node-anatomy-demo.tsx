"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { animate, type AnimationPlaybackControls } from "motion/react";
import { LifeBuoy, Play } from "lucide-react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";

import {
  Canvas,
  DemoHint,
  GenerateImageNode,
  ImageInputNode,
  MenuDivider,
  MenuRow,
  NbRoot,
  NoodleLayer,
  PromptNode,
  useInteractOnRelease,
  useNodeGraph,
  type GenerateImageSettings,
} from "./kit";
import { AnatomyOverlay } from "./node-anatomy/anatomy-overlay";
import { EDGES, GENERATE_ID, GENERATE_W, INPUT_IDS, INPUT_PHOTO, NODES, PROMPT, RESULTS, START_HISTORY, START_SETTINGS } from "./node-anatomy/data";
import { isNarrow, useFraming, useInputDock } from "./node-anatomy/framing";
import { PART_ORDER, partAt, type PartId } from "./node-anatomy/parts";

/** How far the node gives under a drag before it springs home (world px). */
const GIVE = 36;
const CYCLE_MS = 2800;
const RUN_MS = 3000;
/** The docked inputs: faded, inert, and without the controls card (only its edge would show). */
const INPUT_CLASS = "pointer-events-none opacity-50 [&_[data-trailing]]:invisible";

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
  const [nodeFocus, setNodeFocus] = useState<PartId | null>(null);
  const [pinned, setPinned] = useState<PartId | null>(null);
  const [cycle, setCycle] = useState<number | null>(null);
  const [interacted, setInteracted] = useState(false);

  const { view, hold, startsOpen } = useFraming({ rootRef: root, graph, nodeId: GENERATE_ID, expanded, reducedMotion });
  useInputDock(view, graph, GENERATE_ID, INPUT_IDS);

  // Phones and short tiles start with the settings closed, so the node fits at a readable size.
  useLayoutEffect(() => {
    if (!startsOpen()) setExpanded(false);
  }, [startsOpen]);

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

  const highlight: PartId | null = labelHover ?? nodeHover ?? nodeFocus ?? pinned ?? (interacted || cycle === null ? null : PART_ORDER[cycle]);

  const touch = useCallback(() => setInteracted(true), []);
  const interact = useInteractOnRelease(touch);

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

  // Dragging (or nudging with the arrow keys): the node gives a little, then
  // springs back home (the controls card trails it both ways). Home starts at
  // the world origin and only moves when a left-edge resize moves the node.
  const home = useRef({ x: 0, y: 0 });
  const springs = useRef<AnimationPlaybackControls[]>([]);
  const constrain = useCallback((x: number, y: number) => {
    const h = home.current;
    return { x: h.x + GIVE * Math.tanh((x - h.x) / GIVE), y: h.y + GIVE * Math.tanh((y - h.y) / GIVE) };
  }, []);
  const stopSprings = useCallback(() => {
    springs.current.forEach((a) => a.stop());
    springs.current = [];
  }, []);
  const springHome = useCallback(() => {
    const node = graph.node(GENERATE_ID);
    if (!node) return;
    stopSprings();
    const { x, y } = home.current;
    if (reducedMotion) graph.moveTo(GENERATE_ID, x, y);
    else {
      const spring = { type: "spring", stiffness: 420, damping: 30 } as const;
      springs.current = [animate(node.x, x, spring), animate(node.y, y, spring)];
    }
  }, [graph, reducedMotion, stopSprings]);
  useEffect(() => stopSprings, [stopSprings]);

  // An arrow-key nudge of the node springs back once the keys rest.
  const nudge = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(nudge.current), []);

  // Hold the camera while an edge resizes the node, and keep home in step
  // with a left-edge resize (it moves the node).
  const resizable = {
    min: 200,
    max: 480,
    defaultWidth: GENERATE_W,
    onResizeStart: () => hold(true),
    onResizeEnd: () => {
      const p = graph.position(GENERATE_ID);
      if (p) home.current = p;
      hold(false);
    },
  };

  // The tile's layout (callout column, or markers and a legend) decides where the hint fits.
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setNarrow(isNarrow(el.clientWidth, el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const inNode = (e.target as Element).closest(`[data-node-id="${GENERATE_ID}"]`);
    const part = inNode ? partAt(e.target) : null;
    setNodeHover(part);
    if (part) touch();
  };
  // Keyboard parity with hover: a control inside the node focused from the
  // keyboard traces its part (a click's focus does not, or it would stick).
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    setNodeFocus(target.closest(`[data-node-id="${GENERATE_ID}"]`) && target.matches(":focus-visible") ? partAt(target) : null);
  };
  // Touch has no hover: tapping a part of the node traces it. A finger counts
  // (and pins) only on release, so one that lands here to scroll the page past
  // the tile ends in a pointercancel and leaves the tour running.
  const pressed = useRef<PartId | null>(null);
  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    interact.onPointerDownCapture(e);
    const inNode = (e.target as Element).closest(`[data-node-id="${GENERATE_ID}"]`);
    pressed.current = e.pointerType !== "mouse" && inNode ? partAt(e.target) : null;
    if (e.pointerType !== "touch" && pressed.current) setPinned(pressed.current);
  };
  const onPointerUpCapture = (e: PointerEvent<HTMLDivElement>) => {
    interact.onPointerUpCapture(e);
    if (e.pointerType === "touch" && pressed.current) setPinned(pressed.current);
    pressed.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    touch();
    if (e.key.startsWith("Arrow") && e.target instanceof Element && e.target.matches(`[data-node-id="${GENERATE_ID}"]`)) {
      stopSprings();
      clearTimeout(nudge.current);
      nudge.current = setTimeout(springHome, 400);
    } else if (e.key === "Escape") {
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
      onPointerUpCapture={onPointerUpCapture}
      onFocus={onFocus}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setNodeFocus(null)}
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">
        Point at or focus a label to trace that part of the node. Select the node (click it, or press Enter on it) to show its socket
        names, resize edges and header actions. Page back through earlier results under the image, open the settings from the
        summary row, and run the node from its header or with Alt+Enter.
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
        {/* Context only: slivers docked at the tile's edge, their noodles running into the node. */}
        <div aria-hidden>
          <ImageInputNode graph={graph} id="photo" draggable={false} image={INPUT_PHOTO} className={INPUT_CLASS} />
          <PromptNode graph={graph} id="prompt" draggable={false} value={PROMPT} height={100} className={INPUT_CLASS} />
        </div>
        <GenerateImageNode
          graph={graph}
          id={GENERATE_ID}
          title="Generate Image"
          aria-label="Generate Image node"
          image={image}
          // The demo mounts only near the viewport, so its main image may as well load eagerly.
          priority
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
          resizable={resizable}
          constrain={constrain}
          onDragStart={stopSprings}
          // A drag the page took over puts the node back where the press found it, which may be mid-spring.
          onDragEnd={(moved, cancelled) => (moved || cancelled) && springHome()}
        />
      </Canvas>
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
      />
      {/* Wide tiles keep the bottom-left corner clear, phones the top band above the node. */}
      <DemoHint corner={narrow ? "top-left" : "bottom-left"} hidden={interacted}>
        <span className="nb-anat__hint-hover">Hover a part</span>
        <span className="nb-anat__hint-touch">Tap a part</span>
      </DemoHint>
    </NbRoot>
  );
}
