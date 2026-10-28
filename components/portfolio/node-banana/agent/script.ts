import {
  AGENT_DEMO_REPLY,
  AGENT_HARNESSES,
  AGENT_OPENING_STATUS,
  AGENT_PASTED_IMAGE,
  AGENT_REPLY,
  AGENT_RUN_OFFER,
  AGENT_RUN_PLAN,
  AGENT_USER_TEXT,
  AGENT_WORKFLOW_NAME,
  type AgentHarness,
} from "@/lib/node-banana/agent-script";

// The demo's whole state as one value, and the scripted turn as a list of pure
// steps over it: the site's timings (site.js §5b), so the server can render the
// finished turn by applying every step, and a runner can play them one by one.

export interface Attachment {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  /** Still being saved to the library: dimmed under a spinner. */
  pending?: boolean;
}

export type ToolCallState = "running" | "done";

export type Part =
  | { kind: "reasoning"; streaming: boolean }
  | { kind: "tools"; calls: Array<{ id: string; state: ToolCallState }> }
  | { kind: "text"; text: string; words: number; streaming: boolean }
  | { kind: "run-offer" };

export type Message =
  | { id: string; role: "user"; text: string; attachments: Attachment[] }
  | { id: string; role: "assistant"; parts: Part[]; stopped?: boolean };

export interface RunOutput {
  nodeId: string;
  batch: number;
}

export interface RunRecord {
  status: "running" | "done" | "stopped";
  label: string;
  nodeIds: string[];
  runs: number;
  /** The run of the batch in progress (from 1). */
  index: number;
  outputs: RunOutput[];
  elapsed: number;
}

export interface SavedChat {
  id: string;
  title: string;
  messages: Message[];
  run: RunRecord | null;
}

export interface DemoState {
  harness: AgentHarness;
  model: string;
  effort: string;
  /** The message box. */
  draft: string;
  draftAttachments: Attachment[];
  /** The scripted message is typing into the box. */
  typing: boolean;
  chatId: string;
  chatTitle: string;
  messages: Message[];
  /** The shimmering progress line under a running turn. */
  status: string | null;
  busy: boolean;
  history: SavedChat[];
  /** Messages typed while a turn ran. */
  queued: Array<{ id: string; text: string; attachments: Attachment[] }>;
  /** Canvas: how many of AGENT_NODES have landed, wired, caught the light, tidied. */
  built: number;
  wired: boolean;
  /** The noodles are drawing on. */
  drawing: boolean;
  shimmer: boolean;
  tidy: boolean;
  /** Nodes running now (comets travel into them). */
  running: string[];
  /** Outputs per node (its history count). */
  outputs: Record<string, number>;
  run: RunRecord | null;
  /** The card's run count. */
  runs: number;
  /** The scripted press on the Run button. */
  pressing: boolean;
  seq: number;
}

export interface Step {
  delay: number;
  apply: (state: DemoState) => DemoState;
}

export const INITIAL_STATE: DemoState = {
  harness: "claude",
  model: AGENT_HARNESSES.claude.model,
  effort: "high",
  draft: "",
  draftAttachments: [],
  typing: false,
  chatId: "lookbook",
  chatTitle: AGENT_WORKFLOW_NAME,
  messages: [],
  status: null,
  busy: false,
  history: [],
  queued: [],
  built: 0,
  wired: false,
  drawing: false,
  shimmer: false,
  tidy: false,
  running: [],
  outputs: {},
  run: null,
  runs: 1,
  pressing: false,
  seq: 0,
};

const step = (delay: number, apply: Step["apply"]): Step => ({ delay, apply });

/** Change the last assistant message's parts. */
function withReply(state: DemoState, fn: (parts: Part[]) => Part[]): DemoState {
  const messages = [...state.messages];
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return state;
  messages[messages.length - 1] = { ...last, parts: fn(last.parts) };
  return { ...state, messages };
}

function setTool(parts: Part[], id: string, value: ToolCallState): Part[] {
  return parts.map((part) =>
    part.kind === "tools" ? { ...part, calls: part.calls.map((call) => (call.id === id ? { ...call, state: value } : call)) } : part,
  );
}

function addTool(parts: Part[], id: string): Part[] {
  const group = parts.find((part) => part.kind === "tools");
  if (!group) return [...parts, { kind: "tools", calls: [{ id, state: "running" }] }];
  return parts.map((part) => (part.kind === "tools" ? { ...part, calls: [...part.calls, { id, state: "running" }] } : part));
}

const wordCount = (text: string) => text.split(" ").length;

/** A reply streaming in word by word (45ms a word, as the site streams it). */
function streamSteps(text: string, first: number): Step[] {
  const steps: Step[] = [
    step(first, (s) => withReply(s, (parts) => [...parts, { kind: "text", text, words: 1, streaming: true }])),
  ];
  for (let n = 2; n <= wordCount(text); n++) {
    steps.push(step(45, (s) => withReply(s, (parts) => parts.map((part) => (part.kind === "text" ? { ...part, words: n } : part)))));
  }
  return steps;
}

/** The scripted turn: paste, type, send, think, three tools build the graph, the reply streams, the Run card. */
export function turnSteps(): Step[] {
  const steps: Step[] = [
    step(300, (s) => ({ ...s, draftAttachments: [{ ...AGENT_PASTED_IMAGE, pending: true }] })),
    step(520, (s) => ({ ...s, draftAttachments: s.draftAttachments.map((a) => ({ ...a, pending: false })), typing: true })),
  ];
  for (let n = 1; n <= AGENT_USER_TEXT.length; n++) {
    steps.push(step(18, (s) => ({ ...s, draft: AGENT_USER_TEXT.slice(0, n) })));
  }
  steps.push(
    step(380, (s) => ({
      ...s,
      typing: false,
      draft: "",
      draftAttachments: [],
      busy: true,
      status: AGENT_OPENING_STATUS,
      messages: [
        ...s.messages,
        { id: "m-user", role: "user", text: AGENT_USER_TEXT, attachments: [{ ...AGENT_PASTED_IMAGE }] },
      ],
    })),
    step(1100, (s) => ({
      ...s,
      status: null,
      messages: [...s.messages, { id: "m-agent", role: "assistant", parts: [{ kind: "reasoning", streaming: true }] }],
    })),
    step(700, (s) =>
      withReply(s, (parts) => addTool(parts.map((part) => (part.kind === "reasoning" ? { ...part, streaming: false } : part)), "search")),
    ),
    // Create workflow: the nodes land, one after another, near where they go.
    step(900, (s) => ({ ...withReply(s, (parts) => addTool(setTool(parts, "search", "done"), "create")), built: 9 })),
    step(1100, (s) => ({ ...s, wired: true, drawing: true })),
    // Tidy layout: they move into four columns, then catch the light together.
    step(700, (s) => ({ ...withReply(s, (parts) => addTool(setTool(parts, "create", "done"), "tidy")), tidy: true })),
    step(800, (s) => ({ ...withReply(s, (parts) => setTool(parts, "tidy", "done")), shimmer: true, drawing: false })),
    ...streamSteps(AGENT_REPLY, 500),
    step(60, (s) => ({
      ...withReply(s, (parts) => [...parts.map((part) => (part.kind === "text" ? { ...part, streaming: false } : part)), { kind: "run-offer" }]),
      busy: false,
    })),
  );
  return steps;
}

/** The autoplay: the turn, a beat, then Run is pressed. */
export function autoplaySteps(): Step[] {
  return [
    ...turnSteps(),
    step(1500, (s) => ({ ...s, pressing: true })),
    step(160, (s) => ({ ...s, pressing: false })),
    ...runSteps(1, AGENT_RUN_OFFER.nodeIds, 0),
  ];
}

/**
 * A run of the offer, `runs` times over: the base look first, then the four
 * concepts together, each landing in its own time. A second-per-tick clock.
 */
export function runSteps(runs: number, nodeIds: readonly string[], firstDelay = 0): Step[] {
  const label = nodeIds.length === 1 ? AGENT_RUN_OFFER.alternative.label : AGENT_RUN_OFFER.label;
  const events: Array<{ t: number; apply: Step["apply"] }> = [];
  const concepts = AGENT_RUN_PLAN.concepts.filter((c) => nodeIds.includes(c.id));
  const land = (id: string, batch: number) => (s: DemoState): DemoState => ({
    ...s,
    running: s.running.filter((r) => r !== id),
    outputs: { ...s.outputs, [id]: (s.outputs[id] ?? 0) + 1 },
    run: s.run ? { ...s.run, outputs: [...s.run.outputs, { nodeId: id, batch }] } : s.run,
  });
  let t = 0;
  events.push({
    t: 0,
    apply: (s) => ({
      ...s,
      run: { status: "running", label, nodeIds: [...nodeIds], runs, index: 1, outputs: [], elapsed: 0 },
    }),
  });
  for (let batch = 0; batch < runs; batch++) {
    const start = t;
    events.push({
      t: start,
      apply: (s) => ({ ...s, running: [AGENT_RUN_PLAN.base.id], run: s.run ? { ...s.run, index: batch + 1 } : s.run }),
    });
    t += AGENT_RUN_PLAN.base.ms;
    events.push({ t, apply: land(AGENT_RUN_PLAN.base.id, batch) });
    if (concepts.length) {
      const ids = concepts.map((c) => c.id);
      events.push({ t, apply: (s) => ({ ...s, running: ids }) });
      for (const concept of concepts) events.push({ t: t + concept.ms, apply: land(concept.id, batch) });
      t += Math.max(...concepts.map((c) => c.ms));
    }
    t += 200;
  }
  const end = t;
  for (let second = 1000; second < end; second += 1000) {
    events.push({ t: second, apply: (s) => (s.run ? { ...s, run: { ...s.run, elapsed: s.run.elapsed + 1 } } : s) });
  }
  events.push({
    t: end,
    apply: (s) => ({
      ...s,
      running: [],
      run: s.run ? { ...s.run, status: "done", elapsed: Math.max(s.run.elapsed, Math.round(end / 1000)) } : s.run,
    }),
  });
  // Stable order: by time, then as added.
  const ordered = events.map((e, i) => ({ ...e, i })).sort((a, b) => a.t - b.t || a.i - b.i);
  let last = -firstDelay;
  return ordered.map((e) => {
    const delay = e.t - last;
    last = e.t;
    return step(delay, e.apply);
  });
}

let nextId = 0;
const uid = (prefix: string) => `${prefix}-${++nextId}`;

/** A visitor's own message: sent, the opening status, then an honest reply. */
export function visitorSteps(text: string, attachments: Attachment[], fromQueue = false): Step[] {
  const user = uid("m-user");
  const agent = uid("m-agent");
  return [
    step(0, (s) => ({
      ...s,
      ...(fromQueue ? {} : { draft: "", draftAttachments: [] }),
      queued: fromQueue ? s.queued.slice(1) : s.queued,
      busy: true,
      status: AGENT_OPENING_STATUS,
      messages: [...s.messages, { id: user, role: "user", text, attachments }],
    })),
    step(900, (s) => ({ ...s, status: null, messages: [...s.messages, { id: agent, role: "assistant", parts: [] }] })),
    ...streamSteps(AGENT_DEMO_REPLY, 0),
    step(60, (s) => ({
      ...withReply(s, (parts) => parts.map((part) => (part.kind === "text" ? { ...part, streaming: false } : part))),
      busy: false,
    })),
  ];
}

export function applySteps(state: DemoState, steps: readonly Step[]): DemoState {
  return steps.reduce((s, st) => st.apply(s), state);
}

/** The finished autoplay: what the server renders and reduced motion shows. */
export const FINAL_STATE: DemoState = applySteps(INITIAL_STATE, autoplaySteps());

/** Stop whatever runs: a turn ends where it is (marked Stopped), a run stops after what landed. */
export function stopState(state: DemoState): DemoState {
  let next: DemoState = { ...state, pressing: false, typing: false };
  if (state.busy) {
    const messages = [...state.messages];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      messages[messages.length - 1] = {
        ...last,
        stopped: true,
        parts: last.parts.map((part) =>
          part.kind === "tools"
            ? { ...part, calls: part.calls.map((call) => ({ ...call, state: "done" as const })) }
            : part.kind === "text" || part.kind === "reasoning"
              ? { ...part, streaming: false }
              : part,
        ),
      };
    }
    next = { ...next, messages, busy: false, status: null };
  }
  if (state.run?.status === "running") next = { ...next, running: [], run: { ...state.run, status: "stopped" } };
  return next;
}

/** A fresh chat; the one on screen goes into the history. */
export function newChatState(state: DemoState): DemoState {
  const history = state.messages.length
    ? [{ id: state.chatId, title: state.chatTitle, messages: state.messages, run: state.run }, ...state.history.filter((c) => c.id !== state.chatId)]
    : state.history;
  return { ...state, history, messages: [], run: null, chatId: uid("chat"), chatTitle: "", status: null, queued: [] };
}

export function openChatState(state: DemoState, id: string): DemoState {
  const chat = state.history.find((c) => c.id === id);
  if (!chat || chat.id === state.chatId) return state;
  const current = state.messages.length ? [{ id: state.chatId, title: state.chatTitle, messages: state.messages, run: state.run }] : [];
  return {
    ...state,
    history: [...current, ...state.history.filter((c) => c.id !== id)],
    chatId: chat.id,
    chatTitle: chat.title,
    messages: chat.messages,
    run: chat.run,
  };
}

/** The canvas and chat back to the start, keeping the harness and model picked. */
export function resetState(state: DemoState): DemoState {
  return { ...INITIAL_STATE, harness: state.harness, model: state.model, effort: state.effort, seq: state.seq + 1 };
}
