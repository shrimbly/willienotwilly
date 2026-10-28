// The agent panel demo's script and workflow: the landing site's "Camel coat
// lookbook" turn (site/src/partials/agent-built.html, site.js §5b) as data,
// with the app's own copy (src/lib/agent/client/*, src/components/agent/*).

const IMG = "/images/portfolio/node-banana/demo";

export interface AgentStill {
  src: string;
  width: number;
  height: number;
}

const still = (name: string): AgentStill => ({ src: `${IMG}/ag-${name}.jpg`, width: 640, height: 357 });

export const AGENT_WORKFLOW_NAME = "Camel coat lookbook";

/** The user's turn: a pasted reference picture and the site's message. */
export const AGENT_USER_TEXT =
  "A lookbook for a camel coat: generate one base look in the studio, then experiment with different locations and styles.";
export const AGENT_PASTED_IMAGE = { id: "pasted-1", name: "Pasted image 14:02", ...still("salt-close") };

/** The opening status line (AGENT_OPENING_STATUS in src/lib/agent/types.ts). */
export const AGENT_OPENING_STATUS = "Fallooning…";

export const AGENT_REASONING_SECONDS = 7;
export const AGENT_REASONING =
  "The picture is the coat to dress: a long camel wool coat over a black mock-neck, on a model with a jaw-length bob. One studio base look on Nano Banana Pro first, written from the picture. Then four locations, one per line, split by an Array so each concept gets one line, on Nano Banana 2 Lite with the base look wired in as the image reference. An Output Gallery at the end to compare them.";

export interface AgentToolCall {
  id: string;
  title: string;
  summary: string;
  input: string;
}

export const AGENT_TOOLS: AgentToolCall[] = [
  {
    id: "search",
    title: "Search models",
    summary: "Nano Banana Pro for the base look, Nano Banana 2 Lite for the locations",
    input: JSON.stringify({ nodeType: "nanoBanana", capability: "image-to-image" }, null, 2),
  },
  {
    id: "create",
    title: "Create workflow",
    summary: "Added 9 nodes and 14 connections",
    input: JSON.stringify(
      {
        nodes: [
          { ref: "prompt", type: "prompt" },
          { ref: "base", type: "nanoBanana", title: "Base look - Nano Banana Pro", settings: { model: "nano-banana-pro", aspectRatio: "16:9", resolution: "1K" } },
          { ref: "lines", type: "prompt" },
          { ref: "array", type: "array", settings: { splitMode: "newline" } },
          { ref: "c1", type: "nanoBanana", title: "Concept 1 – Coastal golden hour - Nano Banana 2 Lite" },
          { ref: "c2", type: "nanoBanana", title: "Concept 2 – Neon street - Nano Banana 2 Lite" },
          { ref: "c3", type: "nanoBanana", title: "Concept 3 – Brutalist flash - Nano Banana 2 Lite" },
          { ref: "c4", type: "nanoBanana", title: "Concept 4 – Parisian window light - Nano Banana 2 Lite" },
          { ref: "gallery", type: "outputGallery", title: "Concepts - Output Gallery" },
        ],
        connections: [
          { from: "prompt", to: "base" },
          { from: "lines", to: "array" },
          { from: "base", to: "c1" },
          { from: "array", to: "c1", arrayItemIndex: 0 },
          { from: "c1", to: "gallery" },
        ],
      },
      null,
      2,
    ),
  },
  {
    id: "tidy",
    title: "Tidy layout",
    summary: "Aligned 9 nodes in 4 columns",
    input: JSON.stringify({}, null, 2),
  },
];

/** The folded line once the calls are done (toolGroupSummary: two edits → the nodes they touched). */
export const AGENT_TOOLS_RESULT = "changed 9 nodes";

export const AGENT_REPLY =
  "Done. The base prompt describes the coat in your picture. The base look runs first; the Array splits your four locations, and each concept takes the base look as its reference. Press Run when you're ready.";

/** What a visitor's own message gets back: honest about where it is. */
export const AGENT_DEMO_REPLY =
  "This window is a demo, so I can't change the canvas from here. In Node Banana I'd read this workflow and make that change for you, on your own Claude Code or Codex plan.";

/** agentSuggestions(canvasHasNodes) in src/lib/agent/client/messages.ts. */
export const AGENT_SUGGESTIONS_EMPTY = [
  "Build a text-to-image workflow",
  "Make a workflow that turns an image into a video",
  "Have an LLM write the prompt for an image model",
  "Compare two image models on the same prompt",
];
export const AGENT_SUGGESTIONS_WITH_NODES = [
  "Explain what this workflow does",
  "Add an output node after every generator",
  "Switch every image node to Nano Banana Pro",
  "Make the prompt more cinematic",
];

/** HARNESS_BILLING_COPY footers. */
export const AGENT_BILLING = {
  claude:
    "Runs on your paid Claude subscription's usage limits through Claude Code. Stops at the limit instead of using extra usage.",
  codex: "Runs on your ChatGPT plan's Codex limits through Codex. Stops at the limit instead of spending credits.",
} as const;

export const AGENT_HARNESSES = {
  claude: { label: "Claude Code", plan: "Max", models: ["Opus 5.5", "Sonnet 5.5", "Haiku (latest)"], model: "Opus 5.5" },
  codex: { label: "Codex", plan: "Plus", models: ["GPT-5.6 Luna"], model: "GPT-5.6 Luna" },
} as const;
export type AgentHarness = keyof typeof AGENT_HARNESSES;

export const AGENT_EFFORTS = ["low", "medium", "high", "max"] as const;
export const AGENT_EFFORT_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", max: "Max" };

/* ------------------------------------------------------------------ workflow */

export const BASE_PROMPT =
  "Full-length editorial fashion portrait of a tall androgynous model with a blunt jaw-length bob and scattered freckles, wearing a long oversized camel wool coat over a fine black mock-neck knit and pleated wide-leg charcoal trousers, against a seamless pale stone studio backdrop.";

export const LOCATION_LINES = [
  "Rugged coastal headland at golden hour, 35mm at f/2.8, sun flaring behind the model",
  "Wet Tokyo backstreet glowing with neon, 85mm at f/1.4, cyan and pink grade",
  "Raw concrete brutalist staircase after dark, harsh on-camera flash from a 24mm",
  "Airy Parisian apartment with tall French windows, gentle morning window light",
];

export type AgentNodeKind = "prompt" | "generate" | "array" | "gallery";

export interface AgentNodeData {
  id: string;
  kind: AgentNodeKind;
  title: string;
  /** World position of the media card (the header floats 26px above), as the site lays it out. */
  x: number;
  y: number;
  width: number;
  /** Where Create workflow first drops it; Tidy layout moves it to (x, y). */
  rough: { dx: number; dy: number };
  /** Generators: the model and what a run makes. */
  model?: "nano-banana-pro" | "nano-banana-2-lite";
  output?: AgentStill;
  /** Prompt nodes: text and surface height. */
  text?: string;
  height?: number;
}

export const AGENT_NODES: AgentNodeData[] = [
  { id: "ag-prompt", kind: "prompt", title: "Prompt", x: 0, y: 26, width: 320, rough: { dx: -18, dy: 22 }, text: BASE_PROMPT, height: 196 },
  {
    id: "ag-base",
    kind: "generate",
    title: "Base look - Nano Banana Pro",
    x: 380,
    y: 26,
    width: 300,
    rough: { dx: 26, dy: -14 },
    model: "nano-banana-pro",
    output: still("base"),
  },
  { id: "ag-lines", kind: "prompt", title: "Prompt", x: 0, y: 330, width: 320, rough: { dx: -10, dy: 46 }, text: LOCATION_LINES.join("\n"), height: 168 },
  { id: "ag-array", kind: "array", title: "Array", x: 380, y: 300, width: 340, rough: { dx: 30, dy: 28 } },
  {
    id: "ag-c0",
    kind: "generate",
    title: "Concept 1 – Coastal golden hour - Nano Banana 2 Lite",
    x: 790,
    y: 26,
    width: 300,
    rough: { dx: -26, dy: 12 },
    model: "nano-banana-2-lite",
    output: still("coastal"),
  },
  {
    id: "ag-c1",
    kind: "generate",
    title: "Concept 2 – Neon street - Nano Banana 2 Lite",
    x: 790,
    y: 276,
    width: 300,
    rough: { dx: 34, dy: -18 },
    model: "nano-banana-2-lite",
    output: still("neon"),
  },
  {
    id: "ag-c2",
    kind: "generate",
    title: "Concept 3 – Brutalist flash - Nano Banana 2 Lite",
    x: 790,
    y: 526,
    width: 300,
    rough: { dx: -20, dy: 30 },
    model: "nano-banana-2-lite",
    output: still("brutalist"),
  },
  {
    id: "ag-c3",
    kind: "generate",
    title: "Concept 4 – Parisian window light - Nano Banana 2 Lite",
    x: 790,
    y: 776,
    width: 300,
    rough: { dx: 28, dy: 40 },
    model: "nano-banana-2-lite",
    output: still("paris"),
  },
  { id: "ag-gallery", kind: "gallery", title: "Concepts - Output Gallery", x: 1160, y: 330, width: 320, rough: { dx: 48, dy: -30 } },
];

export interface AgentEdgeData {
  id: string;
  from: string;
  fromHandle: string;
  to: string;
  toHandle: string;
}

const CONCEPTS = ["ag-c0", "ag-c1", "ag-c2", "ag-c3"];

/** The 14 connections, in the site's order. */
export const AGENT_EDGES: AgentEdgeData[] = [
  { id: "e-prompt-base", from: "ag-prompt", fromHandle: "text", to: "ag-base", toHandle: "text" },
  { id: "e-lines-array", from: "ag-lines", fromHandle: "text", to: "ag-array", toHandle: "text" },
  ...CONCEPTS.flatMap((id) => [
    { id: `e-base-${id}`, from: "ag-base", fromHandle: "image", to: id, toHandle: "image" },
    { id: `e-array-${id}`, from: "ag-array", fromHandle: "text", to: id, toHandle: "text" },
    { id: `e-${id}-gallery`, from: id, fromHandle: "image", to: "ag-gallery", toHandle: "image" },
  ]),
];

/** The graph's world bounds, headers and socket tips included (fits before anything is measured). */
export const AGENT_GRAPH_BOUNDS = { x: -14, y: 0, width: 1508, height: 990 };

/** The run: the base look first, then the four concepts together, landing in this order (ms after each starts). */
export const AGENT_RUN_PLAN = {
  base: { id: "ag-base", ms: 2300 },
  concepts: [
    { id: "ag-c1", ms: 1900 },
    { id: "ag-c0", ms: 2300 },
    { id: "ag-c3", ms: 2700 },
    { id: "ag-c2", ms: 3200 },
  ],
} as const;

/** The run card's offer: what Run runs, and the other way the agent offered. */
export const AGENT_RUN_OFFER = {
  label: "Run workflow",
  nodeIds: ["ag-base", "ag-c0", "ag-c1", "ag-c2", "ag-c3"],
  alternative: { label: "Run the base look", nodeIds: ["ag-base"] },
};
