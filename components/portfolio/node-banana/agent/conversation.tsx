"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  FastForward,
  LoaderCircle,
  LocateFixed,
  Maximize2,
  MessageSquarePlus,
  Minus,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Square,
  Trash2,
  Wrench,
} from "lucide-react";

import {
  AGENT_NODES,
  AGENT_REASONING,
  AGENT_REASONING_SECONDS,
  AGENT_RUN_OFFER,
  AGENT_TOOLS,
  AGENT_TOOLS_RESULT,
} from "@/lib/node-banana/agent-script";
import { cn } from "@/lib/utils";

import { formatCost, imageCost } from "../kit";
import { AGENT_ICON, MENU_ROW, Menu, PingDot, Shimmer } from "./chrome";
import { AttachmentThumb } from "./composer";
import type { Attachment, DemoState, Message, Part, RunRecord, SavedChat } from "./script";

// AgentConversation.tsx, AgentMessage.tsx, ai-elements/{message,reasoning,tool}.tsx,
// AgentRunCard.tsx, AgentRunResults.tsx (RunHeaderLine, useRunSummary) and
// AgentRunMedia.tsx (RunPreviewRow), as a scripted transcript.

export interface ChatActions {
  run: (nodeIds: string[]) => void;
  stop: () => void;
  setRuns: (runs: number) => void;
  showOnCanvas: (nodeIds: string[]) => void;
  openViewer: (key: string) => void;
  /** Add a result to the unsent message, or take it out. */
  toggleAttach: (attachment: Attachment) => void;
  attached: ReadonlySet<string>;
  suggest: (text: string) => void;
}

const NODE_BY_ID = new Map(AGENT_NODES.map((node) => [node.id, node]));
const TOOL_BY_ID = new Map(AGENT_TOOLS.map((tool) => [tool.id, tool]));

/** The chat view's reading column. */
export const PAGE_COLUMN = "mx-auto w-full max-w-[768px] px-6";

/* ------------------------------------------------------------- transcript */

export function Conversation({
  state,
  page,
  host,
  actions,
  openAtTurn = false,
}: {
  state: DemoState;
  page: boolean;
  host: RefObject<HTMLElement | null>;
  actions: ChatActions;
  /**
   * The turn is shown finished, never played (reduced motion): open on the last message sent, so its words and the
   * start of the reply show, not only the reply's end.
   */
  openAtTurn?: boolean;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(!openAtTurn);
  const seen = useRef(state.messages.length);
  const [atBottom, setAtBottom] = useState(true);

  useLayoutEffect(() => {
    const el = scroller.current;
    const sent = Array.from(content.current?.querySelectorAll<HTMLElement>(":scope > .is-user") ?? []).pop();
    if (!openAtTurn || !el || !sent) return;
    const pad = page ? 24 : 16;
    const at = (node: Element) => node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    // From the message's top; in a short window, down until the reply's first line shows, but never past its words
    const replyStart = sent.nextElementSibling?.querySelector(":scope > div > :first-child");
    const shown = replyStart ? at(replyStart) + replyStart.getBoundingClientRect().height + pad - el.clientHeight : 0;
    const words = sent.lastElementChild ? at(sent.lastElementChild) - 8 : 0;
    el.scrollTop = Math.max(0, at(sent) - pad, Math.min(shown, words));
    // Already at the end (a short turn): stick to it as usual
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    // Mount only: later turns follow the newest line
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stick to the newest line while pinned there, as use-stick-to-bottom does,
  // and jump back down when a message is sent (ScrollToSentMessage).
  useLayoutEffect(() => {
    const el = scroller.current;
    const count = state.messages.length;
    if (count > seen.current && state.messages[count - 1]?.role === "user") pinned.current = true;
    seen.current = count;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  });
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(inner);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    pinned.current = bottom;
    setAtBottom(bottom);
  };

  return (
    <div className={cn("relative min-h-0 flex-1", page && "@container")}>
      <div
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-live="off"
        aria-label="Conversation"
        tabIndex={0}
        className="nb-agent-scroll absolute inset-0 focus-visible:outline-offset-[-2px]"
      >
        <div ref={content} className={cn("flex flex-col", page ? `${PAGE_COLUMN} gap-7 pt-6 pb-10` : "gap-5 px-4 py-4")}>
          {state.messages.map((message, index) => (
            <Fragment key={message.id}>
              {message.role === "user" ? (
                <UserMessage message={message} page={page} />
              ) : (
                <AssistantMessage
                  message={message}
                  page={page}
                  streaming={state.busy && index === state.messages.length - 1}
                  state={state}
                  host={host}
                  actions={actions}
                />
              )}
              {message.role === "assistant" && message.stopped && (
                <p className={cn("nb-font-mono nb-tracking-eyebrow nb-text-ink-3 text-[10px] leading-4 uppercase", page ? "-mt-5" : "-mt-3")}>Stopped</p>
              )}
            </Fragment>
          ))}
          {state.status && (
            <div role="status" aria-live="polite">
              <Shimmer duration={1.6} className={page ? "text-[15px] leading-[26px]" : "text-[13px] leading-5"}>
                {state.status}
              </Shimmer>
            </div>
          )}
        </div>
      </div>
      {page && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-8 max-w-[768px] bg-linear-to-b from-transparent to-[#171717]" />}
      {!atBottom && (
        <button
          type="button"
          aria-label="Scroll to the latest message"
          onClick={() => {
            const el = scroller.current;
            if (!el) return;
            pinned.current = true;
            el.scrollTo({ top: el.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          }}
          className="nb-squircle absolute bottom-3 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-lg border border-white/8 bg-neutral-800/92 text-neutral-300 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_20px_-6px_rgba(0,0,0,0.5)] backdrop-blur-md transition-colors duration-[120ms] hover:bg-neutral-700 hover:text-white"
        >
          <ArrowDown className="size-4" {...AGENT_ICON} />
        </button>
      )}
    </div>
  );
}

function UserMessage({ message, page }: { message: Extract<Message, { role: "user" }>; page: boolean }) {
  return (
    <div className={cn("group is-user ml-auto flex w-full flex-col justify-end gap-2", page ? "max-w-[80%]" : "max-w-[85%]")}>
      {message.attachments.length > 0 && (
        <ul aria-label={`Attached (${message.attachments.length})`} className="ml-auto flex flex-wrap justify-end gap-1.5">
          {message.attachments.map((attachment) => (
            <li key={attachment.id} title={attachment.name}>
              <AttachmentThumb attachment={attachment} className={page ? "size-20 rounded-[12px]" : "size-14"} />
            </li>
          ))}
        </ul>
      )}
      {message.text.trim() && (
        <div
          className={cn(
            "nb-squircle ml-auto flex w-fit max-w-full min-w-0 flex-col overflow-hidden bg-white/7 break-words whitespace-pre-wrap text-neutral-100",
            page ? "rounded-[20px] px-4 py-2.5 text-[15px] leading-[26px]" : "nb-rounded-controls px-3 py-2 text-[13px] leading-5",
          )}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

function AssistantMessage({
  message,
  page,
  streaming,
  state,
  host,
  actions,
}: {
  message: Extract<Message, { role: "assistant" }>;
  page: boolean;
  streaming: boolean;
  state: DemoState;
  host: RefObject<HTMLElement | null>;
  actions: ChatActions;
}) {
  const blocks: ReactNode[] = [];
  const made: ReactNode[] = [];
  message.parts.forEach((part: Part, index) => {
    const key = `${message.id}-${index}`;
    if (part.kind === "reasoning") blocks.push(<Reasoning key={key} streaming={streaming && part.streaming} />);
    else if (part.kind === "tools") blocks.push(<ToolGroup key={key} calls={part.calls} streaming={streaming} />);
    else if (part.kind === "text") {
      const text = part.text.split(" ").slice(0, part.words).join(" ");
      blocks.push(
        <div key={key} className={cn("size-full", page ? "space-y-4" : "space-y-2.5")}>
          <p className="m-0">{text}</p>
        </div>,
      );
    } else if (part.kind === "run-offer") made.push(<RunCard key={key} state={state} page={page} host={host} actions={actions} />);
  });
  return (
    <div className="group is-assistant flex w-full max-w-full flex-col gap-2">
      <div className={cn("flex w-full min-w-0 flex-col overflow-visible text-neutral-200", page ? "gap-4 text-[15px] leading-[26px]" : "gap-3 text-[13px] leading-5")}>
        {blocks}
        {made}
      </div>
    </div>
  );
}

/** "Thinking…" while it streams, then "Thought for 7 seconds", opening to the working notes. */
function Reasoning({ streaming }: { streaming: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="not-prose">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="nb-text-ink-3 flex w-fit items-center gap-1 rounded text-xs leading-5 transition-colors hover:text-neutral-200"
      >
        {streaming ? <Shimmer>Thinking…</Shimmer> : <span>Thought for {AGENT_REASONING_SECONDS} seconds</span>}
        <ChevronRight aria-hidden strokeWidth={1.75} className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")} />
      </button>
      {open && (
        <div className="nb-agent-fade-in nb-text-ink-3 mt-2 border-l border-white/10 pl-3 text-xs leading-[18px]">
          <p className="m-0">{AGENT_REASONING}</p>
        </div>
      )}
    </div>
  );
}

/** A turn's tool calls folded under one line; open, a line per call on a hairline rail. */
function ToolGroup({ calls, streaming }: { calls: Array<{ id: string; state: "running" | "done" }>; streaming: boolean }) {
  const [open, setOpen] = useState(false);
  const runningCall = streaming ? [...calls].reverse().find((call) => call.state === "running") : undefined;
  const running = runningCall ? `${TOOL_BY_ID.get(runningCall.id)?.title}…` : null;
  const label = `Used ${calls.length} tool${calls.length === 1 ? "" : "s"}`;
  const allDone = calls.length === AGENT_TOOLS.length && calls.every((call) => call.state === "done");
  const result = running ? null : allDone ? AGENT_TOOLS_RESULT : null;
  return (
    <div data-agent-tool-group="" className="group/tools not-prose flex w-full flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="nb-squircle nb-text-ink-3 -mx-1.5 flex min-h-7 w-fit max-w-[calc(100%+12px)] items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] leading-[18px] transition-colors duration-[120ms] hover:bg-white/5"
      >
        <Wrench aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
        <span className="shrink-0">{running ? <Shimmer>{running}</Shimmer> : label}</span>
        {result && <span className="min-w-0 truncate text-neutral-500">· {result}</span>}
        <ChevronRight aria-hidden strokeWidth={1.75} className={cn("size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")} />
      </button>
      {open && (
        <div className="nb-agent-fade-in mt-0.5 ml-1.5 flex flex-col border-l border-white/[0.08] pl-[13px]">
          {calls.map((call) => (
            <ToolRow key={call.id} id={call.id} running={streaming && call.state === "running"} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolRow({ id, running }: { id: string; running: boolean }) {
  const [open, setOpen] = useState(false);
  const tool = TOOL_BY_ID.get(id);
  if (!tool) return null;
  return (
    <div data-agent-tool="" className="group/tool not-prose w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="nb-squircle -mx-1.5 flex min-h-7 w-[calc(100%+12px)] items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] leading-[18px] transition-colors duration-[120ms] hover:bg-white/5"
      >
        <span className="max-w-full shrink-0 truncate font-medium text-neutral-300">{tool.title}</span>
        {!running && <span className="nb-text-ink-3 min-w-0 truncate">{tool.summary}</span>}
        <span className="ml-0.5 inline-flex shrink-0 items-center">
          {running && <PingDot />}
          <span className="sr-only">{running ? "Running" : "Done"}</span>
        </span>
        <ChevronRight
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            "size-3.5 shrink-0 text-neutral-500 opacity-0 transition-[opacity,transform] duration-150 group-hover/tool:opacity-100 motion-reduce:transition-none",
            open && "rotate-90 opacity-100",
          )}
        />
      </button>
      {open && (
        <div className="nb-agent-fade-in space-y-3 pb-3 pl-2">
          <div className="space-y-1.5">
            <div className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 text-[10px] leading-4 uppercase">Input</div>
            <pre
              tabIndex={0}
              className="nb-agent-scroll nb-rounded-well nb-bg-well nb-shadow-well nb-font-mono max-h-56 overflow-x-auto p-3 text-[11px] leading-4 whitespace-pre text-neutral-300"
            >
              {tool.input}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- run card */

const ink = "nb-font-display text-[13px] font-semibold tracking-[-0.01em]";
const SPLIT_HALF = "flex items-center transition-colors duration-[120ms] hover:bg-[#ededed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500";
const QUIET_HALF =
  "flex items-center transition-colors duration-[120ms] hover:bg-white/[0.09] hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500";

function TypeDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full bg-[var(--nb-handle-image)]", className)} />;
}

function runCost(nodeIds: readonly string[], runs: number): string {
  const cost = nodeIds.reduce((sum, id) => {
    const node = NODE_BY_ID.get(id);
    return sum + (node?.model ? imageCost(node.model, "1K") : 0);
  }, 0);
  return `≈ ${formatCost(cost * runs)}`;
}

/** "Running · 2 of 5 · 4s", "5 images · 6s" (useRunSummary). */
function runSummary(record: RunRecord): string {
  const running = record.status === "running";
  const made = record.outputs.length;
  const expected = running ? record.nodeIds.length * record.index - made : 0;
  const { index, runs } = record;
  return [
    record.status === "done" ? null : record.status === "running" ? "Running" : "Stopped",
    runs > 1 ? (running || index < runs ? `Run ${index} of ${runs}` : `${runs} runs`) : null,
    running ? (made + expected > 0 ? `${made} of ${made + expected}` : null) : made > 0 ? `${made} image${made === 1 ? "" : "s"}` : null,
    `${record.elapsed}s`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function RunStatusIcon({ status }: { status: RunRecord["status"] }) {
  return (
    <span role="img" aria-label={status === "running" ? "Running" : status === "done" ? "Done" : "Stopped"} className="flex size-4 shrink-0 items-center justify-center">
      {status === "running" ? (
        <LoaderCircle className="size-3.5 animate-spin text-neutral-300 motion-reduce:animate-none" strokeWidth={2} aria-hidden />
      ) : status === "done" ? (
        <Check className="size-4 text-neutral-300" strokeWidth={2} aria-hidden />
      ) : (
        <Square className="size-3.5 text-neutral-400" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  );
}

function RunCard({ state, page, host, actions }: { state: DemoState; page: boolean; host: RefObject<HTMLElement | null>; actions: ChatActions }) {
  const record = state.run;
  const [menuOpen, setMenuOpen] = useState(false);
  const chevron = useRef<HTMLButtonElement | null>(null);
  const runningHere = record?.status === "running";
  const current = record?.nodeIds.length === 1 ? AGENT_RUN_OFFER.alternative : AGENT_RUN_OFFER;
  const other = current === AGENT_RUN_OFFER ? AGENT_RUN_OFFER.alternative : AGENT_RUN_OFFER;
  const held = !record && state.busy;
  const times = state.runs > 1 ? ` ×${state.runs}` : "";
  const buttonText = runningHere ? "Stop" : `${record ? "Run again" : "Run"}${times}`;
  const nodes = current.nodeIds.map((id) => NODE_BY_ID.get(id)!);
  const inkStyle = !record;

  const summary = record ? (
    runSummary(record)
  ) : (
    <span title={nodes.map((n) => n.title).join(", ")}>
      {nodes.map((node, i) => (
        <Fragment key={node.id}>
          {i > 0 && " · "}
          <TypeDot className="mr-1.5 mb-px align-middle" />
          {node.title}
        </Fragment>
      ))}
    </span>
  );

  return (
    <section role="group" aria-label={current.label} data-run-offer="" className="flex flex-col gap-2.5">
      <div className="flex min-h-8 items-center gap-2">
        {record && <RunStatusIcon status={record.status} />}
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[13px] leading-[18px]">
          <h3 className="m-0 max-w-full shrink-0 truncate font-medium text-neutral-100">{current.label}</h3>
          <span aria-live="off" className="nb-text-ink-3 min-w-0 truncate tabular-nums">
            · {summary}
          </span>
          {!record && <span className="nb-text-ink-3 shrink-0 tabular-nums">{runCost(current.nodeIds, state.runs)}</span>}
        </div>
        <div
          className={cn(
            "flex h-7 min-w-0 shrink-0 items-stretch overflow-hidden rounded-[7px] text-xs",
            inkStyle ? cn(ink, held ? "bg-white/8 text-neutral-500" : "bg-neutral-200 text-neutral-900") : "bg-white/[0.05] text-neutral-300",
          )}
        >
          <button
            type="button"
            aria-label={runningHere ? "Stop" : `${buttonText}${state.runs > 1 ? `, ${state.runs} runs` : ""}`}
            aria-disabled={held || undefined}
            onClick={runningHere ? actions.stop : held ? undefined : () => actions.run(current.nodeIds)}
            className={cn(
              inkStyle ? SPLIT_HALF : QUIET_HALF,
              "min-w-0 gap-1.5 pr-2.5 pl-2.5 transition-[background-color,transform] duration-[120ms]",
              held && "cursor-not-allowed hover:bg-transparent",
              state.pressing && "scale-[0.96] bg-[#e0e0e0]",
            )}
          >
            {runningHere ? (
              <Square aria-hidden strokeWidth={0} fill="currentColor" className="size-3 shrink-0" />
            ) : record ? (
              <RotateCcw aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
            ) : (
              <Play aria-hidden strokeWidth={0} fill="currentColor" className="size-3 shrink-0" />
            )}
            <span className="truncate">{buttonText}</span>
          </button>
          <button
            ref={chevron}
            type="button"
            aria-label="Run options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              inkStyle ? SPLIT_HALF : QUIET_HALF,
              "w-7 shrink-0 justify-center border-l",
              inkStyle ? (held ? "border-white/10 hover:bg-white/10" : "border-black/10") : "border-white/[0.06]",
              menuOpen && (inkStyle ? "bg-[#e0e0e0]" : "bg-white/[0.1]"),
            )}
          >
            <ChevronDown aria-hidden strokeWidth={2} className="size-3.5" />
          </button>
        </div>
      </div>
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchor={chevron} host={host} align="end" label="Run options" className="w-auto max-w-[min(20rem,calc(100%-2rem))] min-w-[220px] px-0">
        <button
          type="button"
          role="menuitem"
          disabled={state.busy || runningHere}
          className={cn(MENU_ROW, "rounded-none")}
          onClick={() => {
            setMenuOpen(false);
            actions.run(other.nodeIds);
          }}
        >
          {other.nodeIds.length === 1 ? <FastForward aria-hidden strokeWidth={2} className="size-3.5" /> : <Play aria-hidden strokeWidth={2} className="size-3.5" />}
          <span className="min-w-0 truncate">{other.label}</span>
          <span className="ml-auto shrink-0 pl-3 text-neutral-500 tabular-nums">
            {other.nodeIds.length} node{other.nodeIds.length === 1 ? "" : "s"}
          </span>
        </button>
        {record && (
          <button
            type="button"
            role="menuitem"
            className={cn(MENU_ROW, "rounded-none")}
            onClick={() => {
              setMenuOpen(false);
              actions.showOnCanvas(record.nodeIds);
            }}
          >
            <LocateFixed aria-hidden strokeWidth={2} className="size-3.5" />
            Show on canvas
          </button>
        )}
        <div className="nb-border-chrome my-1 border-t" role="separator" />
        <div className="flex min-h-7 items-center gap-2 px-2.5 py-1 text-xs text-neutral-300">
          <Repeat aria-hidden strokeWidth={2} className="size-3.5 shrink-0" />
          <span>Runs</span>
          <span role="group" aria-label="Runs" className="nb-bg-well nb-shadow-well ml-auto inline-flex h-[22px] items-center rounded-[6px]">
            <button
              type="button"
              role="menuitem"
              aria-label="Fewer runs"
              disabled={state.runs <= 1 || runningHere}
              onClick={() => actions.setRuns(state.runs - 1)}
              className="flex size-[22px] items-center justify-center rounded-[6px] text-neutral-400 outline-none hover:bg-white/8 hover:text-neutral-100 focus-visible:bg-white/8 focus-visible:text-neutral-100 disabled:pointer-events-none disabled:opacity-30"
            >
              <Minus aria-hidden strokeWidth={2} className="size-3" />
            </button>
            <output aria-live="polite" className="nb-font-mono min-w-7 text-center text-[11px] text-neutral-100 tabular-nums">
              {state.runs}
            </output>
            <button
              type="button"
              role="menuitem"
              aria-label="More runs"
              disabled={state.runs >= 4 || runningHere}
              onClick={() => actions.setRuns(state.runs + 1)}
              className="flex size-[22px] items-center justify-center rounded-[6px] text-neutral-400 outline-none hover:bg-white/8 hover:text-neutral-100 focus-visible:bg-white/8 focus-visible:text-neutral-100 disabled:pointer-events-none disabled:opacity-30"
            >
              <Plus aria-hidden strokeWidth={2} className="size-3" />
            </button>
          </span>
        </div>
      </Menu>
      {record && <PreviewRow record={record} page={page} actions={actions} />}
    </section>
  );
}

/* ------------------------------------------------------------ preview row */

const PREVIEW_HEIGHT = { page: 200, window: 120 };
const PREVIEW_GAP = 6;
const ASPECT = 640 / 357;

function frameWidthOf(height: number, width: number) {
  return Math.min(Math.round(height * ASPECT), Math.max(1, Math.floor(width)));
}

/** How many previews fit side by side (fitPreviews): always at least one. */
function fitPreviews(count: number, height: number, width: number) {
  let used = 0;
  for (let i = 0; i < count; i++) {
    const next = used + (i > 0 ? PREVIEW_GAP : 0) + frameWidthOf(height, width);
    if (next > width && i > 0) return i;
    used = next;
  }
  return count;
}

export interface PreviewItem {
  key: string;
  nodeId: string;
  batch: number;
  pending: boolean;
}

/** The run's previews in workflow order, by run, with skeletons for what is still coming. */
export function previewItems(record: RunRecord): PreviewItem[] {
  const items: PreviewItem[] = [];
  const runs = record.status === "running" ? record.index : Math.max(1, ...record.outputs.map((o) => o.batch + 1));
  for (let batch = 0; batch < runs; batch++) {
    for (const nodeId of record.nodeIds) {
      const made = record.outputs.some((o) => o.nodeId === nodeId && o.batch === batch);
      if (made) items.push({ key: `${nodeId}:${batch}`, nodeId, batch, pending: false });
      else if (record.status === "running" && batch === record.index - 1) items.push({ key: `pending:${nodeId}:${batch}`, nodeId, batch, pending: true });
    }
  }
  return items;
}

/** A result as a message attachment. */
export function outputAttachment(nodeId: string, batch: number): Attachment | null {
  const node = NODE_BY_ID.get(nodeId);
  if (!node?.output) return null;
  return { id: `out:${nodeId}:${batch}`, name: node.title, ...node.output };
}

function PreviewRow({ record, page, actions }: { record: RunRecord; page: boolean; actions: ChatActions }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    setWidth(row.clientWidth);
    const ro = new ResizeObserver(() => setWidth(row.clientWidth));
    ro.observe(row);
    return () => ro.disconnect();
  }, []);
  const items = previewItems(record);
  if (!items.length) return null;
  const height = page ? PREVIEW_HEIGHT.page : PREVIEW_HEIGHT.window;
  const rowWidth = width || (page ? 1084 : 388);
  const fit = fitPreviews(items.length, height, rowWidth);
  const more = items.length - fit;
  const firstHidden = items.slice(fit).find((item) => !item.pending);
  const batched = record.runs > 1;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`${items.length} ${items.length === 1 ? "preview" : "previews"}`}
      data-run-media="row"
      className={cn("flex", page ? "relative left-1/2 w-[min(1084px,calc(100cqw-48px))] -translate-x-1/2 justify-center" : "-mx-2.5 w-[calc(100%+20px)]")}
      style={{ gap: PREVIEW_GAP }}
    >
      {items.slice(0, fit).map((item, index) => {
        const frameWidth = frameWidthOf(height, rowWidth);
        const overflow = more > 0 && index === fit - 1;
        const node = NODE_BY_ID.get(item.nodeId)!;
        const attachment = !overflow && !item.pending ? outputAttachment(item.nodeId, item.batch) : null;
        const attached = attachment ? actions.attached.has(attachment.id) : false;
        return (
          <figure key={item.key} className="m-0 flex shrink-0 flex-col gap-[7px]" style={{ width: frameWidth }}>
            <div className="group/frame nb-bg-well relative overflow-hidden rounded-[10px]" style={{ width: frameWidth, height }}>
              {item.pending ? (
                <div aria-hidden className="absolute inset-0 bg-white/[0.04] motion-safe:animate-pulse" />
              ) : (
                <button
                  type="button"
                  aria-label={`Open ${node.title}'s image`}
                  onClick={() => actions.openViewer(item.key)}
                  className="group/tile nb-bg-well relative block size-full overflow-hidden rounded-[10px] text-left focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none focus-visible:ring-inset"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a 640px still at preview size */}
                  <img src={node.output!.src} alt="" draggable={false} decoding="async" className="nb-agent-fade-in pointer-events-none size-full object-cover" />
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity duration-150 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100 motion-reduce:transition-none"
                  >
                    <Maximize2 size={13} strokeWidth={2} />
                  </span>
                </button>
              )}
              {attachment && (
                <>
                  {attached && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px] shadow-[inset_0_0_0_2px_#3b82f6]" />}
                  <button
                    type="button"
                    aria-label={`Add ${node.title}'s image to the chat`}
                    aria-pressed={attached}
                    title={attached ? "Added to the chat · remove" : "Add to the chat"}
                    onClick={() => actions.toggleAttach(attachment)}
                    className={cn(
                      "absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-md text-white transition-[opacity,background-color] duration-150 focus-visible:opacity-100 motion-reduce:transition-none",
                      attached ? "bg-[#3b82f6] opacity-100 hover:bg-[#2f6fdc]" : "bg-black/55 opacity-0 group-hover/frame:opacity-100 hover:bg-black/75 pointer-coarse:opacity-100",
                    )}
                  >
                    {attached ? <Check size={14} strokeWidth={2.25} aria-hidden /> : <MessageSquarePlus size={13} strokeWidth={2} aria-hidden />}
                  </button>
                </>
              )}
              {overflow && (
                <button
                  type="button"
                  aria-label={`Show all ${items.length}`}
                  disabled={!firstHidden}
                  onClick={firstHidden ? () => actions.openViewer(firstHidden.key) : undefined}
                  className={cn(
                    "nb-font-display absolute inset-0 flex items-center justify-center bg-black/60 font-semibold tracking-[-0.02em] text-white transition-colors duration-150 enabled:hover:bg-black/50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none focus-visible:ring-inset",
                    page ? "text-[26px]" : "text-lg",
                  )}
                >
                  +{more}
                </button>
              )}
            </div>
            <figcaption className="flex min-w-0 items-baseline gap-1.5 px-0.5 text-[11px] leading-[14px]">
              <span className="min-w-0 truncate text-neutral-400">{overflow ? `${more} more` : node.title}</span>
              {batched && !overflow && <span className="nb-font-mono shrink-0 text-[10px] text-neutral-600">R{item.batch + 1}</span>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- empty and history */

export function EmptyState({ suggestions, onSuggestion }: { suggestions: readonly string[]; onSuggestion: (text: string) => void }) {
  return (
    <div className="nb-agent-empty flex w-full flex-col px-4">
      <div>
        <h3 className="nb-agent-empty__title nb-font-display nb-tracking-display m-0 font-bold text-neutral-100">What should we build?</h3>
        <p className="nb-agent-empty__lead nb-font-display nb-text-ink-3 m-0 mt-1 text-[13px] leading-5 font-medium">
          Describe a workflow, or ask for a change to the one on the canvas.
        </p>
      </div>
      <div className="nb-agent-rows flex flex-col">
        {suggestions.map((suggestion) => (
          <div key={suggestion} className="py-0.5">
            <button
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="group nb-squircle flex w-full items-center gap-3 rounded-md px-1.5 py-2 text-left text-[13px] leading-5 text-neutral-200 transition-colors duration-[120ms] hover:bg-white/7 hover:text-white"
            >
              <span className="min-w-0 flex-1">{suggestion}</span>
              <ArrowRight aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-neutral-500 transition-colors group-hover:text-neutral-200" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function chatLabel(chat: Pick<SavedChat, "title" | "messages">): string {
  if (chat.title) return chat.title;
  const first = chat.messages.find((m) => m.role === "user");
  return first?.role === "user" && first.text ? first.text : "New chat";
}

export function HistoryList({
  chats,
  currentId,
  locked,
  onOpen,
  onDelete,
  meta,
}: {
  chats: Array<Pick<SavedChat, "id" | "title" | "messages">>;
  currentId: string;
  locked: boolean;
  /** "Just now · Camel coat lookbook · Claude Code". */
  meta: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!chats.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="m-0 text-[13px] text-neutral-300">No conversations yet</p>
        <p className="nb-text-ink-3 m-0 text-xs">Your chats with the agent will show up here.</p>
      </div>
    );
  }
  return (
    <div className="nb-agent-scroll flex min-h-0 flex-1 flex-col px-2 py-2" role="list" aria-label="Conversations">
      <p className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 m-0 px-2 pt-1 pb-1.5 text-[10px] leading-[14px] uppercase">History</p>
      {chats.map((chat) => {
        const current = chat.id === currentId;
        const label = chatLabel(chat);
        const waits = locked && !current;
        return (
          <div key={chat.id} role="listitem" className="group relative">
            <button
              type="button"
              aria-current={current || undefined}
              aria-disabled={waits || undefined}
              onClick={() => !waits && onOpen(chat.id)}
              className={cn(
                "nb-squircle flex w-full flex-col gap-0.5 rounded-lg py-2 pr-9 pl-2.5 text-left transition-colors duration-[120ms] hover:bg-white/[0.06]",
                "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent",
                current && "bg-white/[0.07]",
              )}
            >
              <span className="truncate text-[13px] leading-5 text-neutral-100">{label}</span>
              <span className="nb-text-ink-3 truncate text-xs leading-4">{meta}</span>
            </button>
            {!current && (
              <button
                type="button"
                aria-label={`Delete “${label}”`}
                onClick={() => onDelete(chat.id)}
                className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 opacity-0 transition-[opacity,background-color,color] group-hover:opacity-100 hover:bg-white/10 hover:text-neutral-200 focus-visible:opacity-100 pointer-coarse:opacity-100"
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
