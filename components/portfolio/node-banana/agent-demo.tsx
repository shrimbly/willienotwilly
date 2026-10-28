"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { animate } from "motion/react";
import { MessagesSquare, RotateCcw, Workflow } from "lucide-react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import {
  AGENT_EDGES,
  AGENT_GRAPH_BOUNDS,
  AGENT_HARNESSES,
  AGENT_NODES,
  AGENT_WORKFLOW_NAME,
  type AgentHarness,
} from "@/lib/node-banana/agent-script";
import { cn } from "@/lib/utils";

import "./agent/agent.css";
import { ChatView } from "./agent/chat-view";
import { outputAttachment, previewItems, type ChatActions } from "./agent/conversation";
import { AgentGraph, GRAPH_NODES } from "./agent/graph";
import { AgentWindow, type PanelActions } from "./agent/panel";
import {
  FINAL_STATE,
  applySteps,
  autoplaySteps,
  newChatState,
  openChatState,
  resetState,
  runSteps,
  stopState,
  visitorSteps,
  type Attachment,
  type DemoState,
  type Step,
} from "./agent/script";
import { useRunner } from "./agent/use-runner";
import { MediaViewer, type ViewerItem } from "./agent/viewer";
import {
  AgentPill,
  AppWindow,
  CHROME_ICON_BUTTON,
  CHROME_SURFACE,
  Canvas,
  NbRoot,
  ViewToggle,
  useCanvasView,
  useNodeGraph,
  type Bounds,
  type CanvasView,
  type GraphEdgeSpec,
} from "./kit";

// The agent panel: the app's floating agent window over the canvas, playing
// the landing site's "Camel coat lookbook" turn once (a pasted picture and a
// message, three tools build nine nodes, the reply, the Run card) and pressing
// Run, so the results land on the canvas and in the chat. Everything stays
// live: the tool calls open, the composer takes text and pictures, the header
// switches harness and opens the full-page chat.

const EDGES: GraphEdgeSpec[] = AGENT_EDGES;
const NO_EDGES: GraphEdgeSpec[] = [];
/** A portrait tile's canvas strip above the window, as a share of its height (agent.css: top 22%). */
const PORTRAIT_STRIP = 0.22;
/** Further out the nodes read as thumbnails: the camera stays this close and lets the graph run past the edges. */
const MIN_FIT_ZOOM = 0.35;

interface CameraTiming {
  delay: number;
  duration: number;
  ease: readonly [number, number, number, number];
}
const SETTLE: CameraTiming = { delay: 0, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] };
/** The pan along a graph too wide to fit, keeping up with the nodes as they land (nb-enter: 90ms apart, 480ms each). */
const BUILD_PAN: CameraTiming = { delay: 0.3, duration: 1.2, ease: [0.45, 0, 0.25, 1] };

interface CameraLayout {
  portrait: boolean;
  panel: boolean;
  /** The agent has built the graph: one too wide to fit shows its newest end, the columns its run fills. */
  built: boolean;
}

/** The right end of the nodes reaching above world y `bottom`: the newest a band that tall can show. */
function newestEnd(bottom: number) {
  return AGENT_NODES.filter((node) => node.y < bottom).reduce((end, node) => Math.max(end, node.x + node.width), -Infinity);
}

/**
 * Where the camera sits to show `bounds` clear of the agent window (its frame from AgentPanel's layout). It zooms no
 * further out than MIN_FIT_ZOOM: past that the graph runs off the tile's left edge or under the window, from its start
 * until the agent has built it, then from its newest end.
 */
function cameraFor(width: number, height: number, layout: CameraLayout, bounds: Bounds, maxZoom = 0.9) {
  /** The camera's x for the graph between screen x `left` and `right`, with world x `newest` in view once built. */
  const along = (left: number, right: number, zoom: number, newest: number) => {
    const room = right - left;
    if (bounds.width * zoom <= room) return left + (room - bounds.width * zoom) / 2 - bounds.x * zoom;
    const startAtLeft = left - bounds.x * zoom;
    const endAtRight = right - (bounds.x + bounds.width) * zoom;
    return layout.built ? Math.min(startAtLeft, Math.max(endAtRight, right - newest * zoom)) : startAtLeft;
  };
  if (layout.portrait && layout.panel) {
    // The canvas is a strip above the sheet: fit the width, sit at the top, run on behind the window.
    const zoom = Math.min(maxZoom, Math.max(MIN_FIT_ZOOM, (width - 24) / bounds.width));
    const strip = height * PORTRAIT_STRIP - 8;
    const top = bounds.height * zoom < strip ? (strip - bounds.height * zoom) / 2 + 6 : 10;
    return { zoom, x: along(12, width - 12, zoom, newestEnd(bounds.y + (strip - top) / zoom)), y: top - bounds.y * zoom };
  }
  const panelWidth = Math.min(400, Math.max(300, width * 0.5));
  const inset = width >= 900 ? 16 : 12;
  const pad = layout.portrait
    ? { t: 60, r: 16, b: 16, l: 16 }
    : layout.panel
      ? { t: 28, r: panelWidth + inset + 24, b: 28, l: 24 }
      : { t: 64, r: 24, b: 24, l: 24 };
  const availW = Math.max(1, width - pad.l - pad.r);
  const availH = Math.max(1, height - pad.t - pad.b);
  const zoom = Math.min(maxZoom, Math.max(MIN_FIT_ZOOM, Math.min(availW / bounds.width, availH / bounds.height)));
  return {
    zoom,
    x: along(pad.l, pad.l + availW, zoom, bounds.x + bounds.width),
    y: pad.t + (availH - bounds.height * zoom) / 2 - bounds.y * zoom,
  };
}

/** Bounds that make the kit's padding-free fit land exactly on `camera`. */
function boundsFor(view: CanvasView, camera: { x: number; y: number; zoom: number }): Bounds {
  return { x: -camera.x / camera.zoom, y: -camera.y / camera.zoom, width: view.width / camera.zoom, height: view.height / camera.zoom };
}

function animateCamera(view: CanvasView, to: { x: number; y: number; zoom: number }, instant: boolean, timing = SETTLE) {
  if (instant) {
    view.setView(to);
    return;
  }
  animate(view.x, to.x, timing);
  animate(view.y, to.y, timing);
  animate(view.zoom, to.zoom, timing);
}

let pastedCount = 0;

export function NodeBananaAgentDemo() {
  const root = useRef<HTMLDivElement | null>(null);
  const { active, reducedMotion } = useDemoActive(root);
  const [state, setState] = useState<DemoState>(FINAL_STATE);
  const [armed, setArmed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [entering, setEntering] = useState(false);
  const [page, setPage] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const blobs = useRef(new Set<string>());
  const { runner, idle } = useRunner(setState, active);

  const graph = useNodeGraph({ nodes: GRAPH_NODES, edges: state.wired ? EDGES : NO_EDGES });
  const layout = useRef<CameraLayout>({ portrait: false, panel: true, built: FINAL_STATE.built > 0 });
  const viewRef = useRef<CanvasView | null>(null);
  const view = useCanvasView({
    fit: () => {
      const v = viewRef.current;
      if (!v || v.width <= 0) return null;
      layout.current.portrait = v.height > v.width;
      return boundsFor(v, cameraFor(v.width, v.height, layout.current, AGENT_GRAPH_BOUNDS));
    },
    padding: 0,
    minZoom: 0.08,
    maxZoom: 1.5,
    fitMinZoom: 0.01,
    fitMaxZoom: 2,
  });
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Arm on the client unless motion is unwelcome: the finished turn gives way to the empty start before paint.
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setState((s) => resetState(s));
    setArmed(true);
  }, []);

  // The turn plays once, the first time the tile is on screen.
  useEffect(() => {
    if (!armed || !active || started) return;
    setStarted(true);
    runner.start(autoplaySteps());
  }, [armed, active, started, runner]);

  // Reduced motion arriving mid-play: finish at once.
  useEffect(() => {
    if (reducedMotion) runner.flush();
  }, [reducedMotion, runner]);

  useEffect(() => {
    const urls = blobs.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // A press anywhere outside the demo hands the wheel and swipes back to the page.
  useEffect(() => {
    if (!engaged) return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setEngaged(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [engaged]);

  /** When the control holding focus goes away (a closed window, the chat view), focus the message box or the Agent pill. */
  const keepFocus = useCallback(() => {
    const el = root.current;
    const from = document.activeElement;
    if (!el || !(from instanceof HTMLElement) || !el.contains(from)) return;
    requestAnimationFrame(() => {
      if (from.isConnected && from.offsetParent !== null) return;
      const target =
        el.querySelector<HTMLElement>(".nb-agent-chat textarea") ??
        el.querySelector<HTMLElement>(".nb-agent-window:not([hidden]) textarea") ??
        el.querySelector<HTMLElement>(".nb-agent-window:not([hidden]) button") ??
        el.querySelector<HTMLElement>(".nb-agent-pill button");
      target?.focus({ preventScroll: true });
    });
  }, []);

  /** Play steps, or apply them at once under reduced motion. Queued after anything running. */
  const play = useCallback(
    (steps: Step[]) => {
      if (reducedMotion) {
        runner.flush();
        setState((s) => applySteps(s, steps));
      } else runner.enqueue(steps);
    },
    [reducedMotion, runner],
  );

  const refit = useCallback(
    (instant = false, timing?: CameraTiming) => {
      if (view.interacted || view.width <= 0) return;
      const to = cameraFor(view.width, view.height, layout.current, AGENT_GRAPH_BOUNDS);
      animateCamera(view, to, instant || reducedMotion, timing);
    },
    [view, reducedMotion],
  );

  // As the nodes land, a graph too wide for the tile pans along with them to its newest end.
  const built = state.built > 0;
  useEffect(() => {
    if (layout.current.built === built) return;
    layout.current.built = built;
    refit(!built, BUILD_PAN);
  }, [built, refit]);

  const setPanel = useCallback(
    (open: boolean) => {
      keepFocus();
      setPanelOpen(open);
      setEntering(open);
      layout.current.panel = open;
      refit();
    },
    [refit, keepFocus],
  );

  const showOnCanvas = useCallback(
    (ids: string[]) => {
      setPage(false);
      setViewer(null);
      requestAnimationFrame(() => {
        const bounds = graph.measure(ids);
        if (!bounds || view.width <= 0) return;
        view.markInteracted();
        setSelected(ids.length === 1 ? ids[0] : null);
        animateCamera(view, cameraFor(view.width, view.height, layout.current, bounds, 1), reducedMotion);
      });
    },
    [graph, view, reducedMotion],
  );

  const send = useCallback(() => {
    const text = state.draft.trim();
    const attachments = state.draftAttachments;
    if (!text && !attachments.length) return;
    if (state.busy || !idle) {
      const id = `q-${Date.now()}`;
      setState((s) => ({ ...s, draft: "", draftAttachments: [], queued: [...s.queued, { id, text, attachments }] }));
      play(visitorSteps(text, attachments, true));
      return;
    }
    play(visitorSteps(text, attachments));
  }, [state.draft, state.draftAttachments, state.busy, idle, play]);

  const stop = useCallback(() => {
    runner.cancel();
    setState((s) => ({ ...stopState(s), queued: [] }));
  }, [runner]);

  const replay = useCallback(() => {
    runner.cancel();
    setPage(false);
    setViewer(null);
    setSelected(null);
    setPanelOpen(true);
    layout.current.panel = true;
    layout.current.built = false;
    view.reset();
    refit(true);
    setState((s) => resetState(s));
    runner.start(autoplaySteps());
  }, [runner, view, refit]);

  const attachFiles = useCallback((files: File[]) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const added: Attachment[] = files.slice(0, 6).map((file) => {
      const src = URL.createObjectURL(file);
      blobs.current.add(src);
      const pasted = !file.name || file.name === "image.png";
      return { id: `file-${++pastedCount}`, name: pasted ? `Pasted image ${time}` : file.name, src, width: 1, height: 1 };
    });
    setState((s) => ({ ...s, draftAttachments: [...s.draftAttachments, ...added].slice(0, 6) }));
  }, []);

  const attached = useMemo(() => new Set(state.draftAttachments.map((a) => a.id)), [state.draftAttachments]);

  const actions: PanelActions = useMemo<ChatActions & Omit<PanelActions, keyof ChatActions>>(
    () => ({
      run: (nodeIds) => {
        if (!idle) return;
        setViewer(null);
        play(runSteps(state.runs, nodeIds));
      },
      stop,
      setRuns: (runs) => setState((s) => ({ ...s, runs: Math.max(1, Math.min(4, runs)) })),
      showOnCanvas,
      openViewer: (key) => {
        if (!state.run) return;
        const items = previewItems(state.run).filter((item) => !item.pending);
        const index = items.findIndex((item) => item.key === key);
        if (index >= 0) setViewer(index);
      },
      toggleAttach: (attachment) =>
        setState((s) => ({
          ...s,
          draftAttachments: s.draftAttachments.some((a) => a.id === attachment.id)
            ? s.draftAttachments.filter((a) => a.id !== attachment.id)
            : [...s.draftAttachments, attachment].slice(0, 6),
        })),
      attached,
      suggest: (text) => {
        if (state.busy || !idle) {
          setState((s) => ({ ...s, queued: [...s.queued, { id: `q-${text}`, text, attachments: [] }] }));
          play(visitorSteps(text, [], true));
        } else play(visitorSteps(text, []));
      },
      setHarness: (harness: AgentHarness) => setState((s) => ({ ...s, harness, model: AGENT_HARNESSES[harness].model })),
      setModel: (model) => setState((s) => ({ ...s, model })),
      newChat: () => setState((s) => newChatState(s)),
      openChat: (id) => setState((s) => openChatState(s, id)),
      deleteChat: (id) => setState((s) => ({ ...s, history: s.history.filter((c) => c.id !== id) })),
    }),
    [idle, play, state.runs, state.run, state.busy, stop, showOnCanvas, attached],
  );

  const composer = {
    busy: state.busy,
    typing: state.typing,
    draft: state.draft,
    onDraftChange: (draft: string) => setState((s) => ({ ...s, draft })),
    attachments: state.draftAttachments,
    onRemoveAttachment: (id: string) => setState((s) => ({ ...s, draftAttachments: s.draftAttachments.filter((a) => a.id !== id) })),
    onAttachFiles: attachFiles,
    effort: state.effort,
    onEffortChange: (effort: string) => setState((s) => ({ ...s, effort })),
    onSend: send,
    onStop: stop,
    queued: state.queued,
    onRemoveQueued: (id: string) => setState((s) => ({ ...s, queued: s.queued.filter((q) => q.id !== id) })),
  };

  const viewerItems: ViewerItem[] = state.run ? previewItems(state.run).filter((item) => !item.pending) : [];
  const finished = armed && started && idle && !state.busy && state.run?.status !== "running";

  const togglePage = (next: boolean) => {
    keepFocus();
    setPage(next);
    setViewer(null);
  };

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.metaKey || event.ctrlKey || event.altKey || target.closest("input,textarea,[role=menu],[role=dialog]")) return;
    if (event.key === "c" || event.key === "C") {
      event.preventDefault();
      togglePage(!page);
    }
  };

  const onSelect = useCallback((id: string | null) => setSelected(id), []);

  const onRootClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(".nb-agent-window, .nb-agent-chat")) setEngaged(true);
  };
  const onRootPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") setEngaged(false);
  };

  return (
    <NbRoot
      ref={root}
      role="group"
      aria-label="Node Banana's agent panel building a camel coat lookbook workflow"
      data-engaged={engaged || undefined}
      data-paused={(!active && !reducedMotion) || undefined}
      onKeyDown={onRootKeyDown}
      onClick={onRootClick}
      onPointerLeave={onRootPointerLeave}
    >
      <p className="sr-only">
        The agent window plays one turn over the canvas. Open its tool calls, type or paste a picture into the message box, press Run, or open the full chat.
      </p>
      <AppWindow
        className="nb-agent-demo"
        framed={false}
        tabs={[{ id: "lookbook", label: AGENT_WORKFLOW_NAME }]}
        activeTab={page ? undefined : "lookbook"}
        onTabChange={() => togglePage(false)}
        toggles={<ViewToggle label="Chat" icon={<MessagesSquare size={16} strokeWidth={1.75} />} shown={page} onToggle={() => togglePage(!page)} />}
        frameOverlay={
          page ? (
            <ChatView state={state} actions={actions} composer={composer} onCanvas={() => togglePage(false)} openAtTurn={!armed} />
          ) : null
        }
      >
        {/* The window and its chrome sit over the canvas, not in it: no panning, grab cursor or pan-y from the canvas. */}
        <AgentWindow
          state={state}
          actions={actions}
          composer={composer}
          open={panelOpen && !page}
          entering={entering}
          openAtTurn={!armed}
          onClose={() => setPanel(false)}
          onExpand={() => togglePage(true)}
        />
        {!panelOpen && !page && <AgentPill busy={state.busy} onClick={() => setPanel(true)} className="nb-agent-pill absolute top-3 right-3 z-10" />}
        {finished && !reducedMotion && !page && (
          <div className={cn(CHROME_SURFACE, "nb-agent-replay nb-agent-fade-in flex h-10 items-center rounded-xl px-1")}>
            <button type="button" onClick={replay} className={cn(CHROME_ICON_BUTTON, "h-8 gap-2 pr-3 pl-2.5 text-xs font-medium text-neutral-200")}>
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
              Replay
            </button>
          </div>
        )}
        <Canvas
          view={view}
          gridZoom={false}
          onPaneClick={() => setSelected(null)}
          aria-hidden={page || undefined}
          overlay={
            <div aria-hidden data-hidden={state.built > 0 || undefined} data-full={!panelOpen || undefined} className="nb-agent-hint">
              <span className="nb-agent-hint__mark size-11 items-center justify-center rounded-full bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                <Workflow className="size-[22px] text-neutral-400" strokeWidth={1.75} />
              </span>
              <p className="nb-font-display nb-text-ink-3 m-0 text-[15px] leading-6 font-medium text-balance">Describe it and the agent builds it</p>
            </div>
          }
        >
          <AgentGraph
            graph={graph}
            edges={EDGES}
            built={state.built}
            drawing={state.drawing}
            tidy={state.tidy}
            shimmer={state.shimmer}
            running={state.running}
            outputs={state.outputs}
            animateEntry={armed && !reducedMotion}
            reducedMotion={reducedMotion}
            active={active}
            selected={selected}
            onSelect={onSelect}
          />
        </Canvas>
      </AppWindow>
      {viewer !== null && viewerItems.length > 0 && (
        <MediaViewer
          items={viewerItems}
          index={Math.min(viewer, viewerItems.length - 1)}
          runs={state.run?.runs ?? 1}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
          attached={(item) => attached.has(`out:${item.nodeId}:${item.batch}`)}
          onToggleAttach={(item) => {
            const attachment = outputAttachment(item.nodeId, item.batch);
            if (attachment) actions.toggleAttach(attachment);
          }}
          onShowOnCanvas={(item) => showOnCanvas([item.nodeId])}
        />
      )}
    </NbRoot>
  );
}
