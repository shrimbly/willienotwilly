/**
 * Node anatomy constants and colours, ported from Node Banana
 * (src/components/nodes/ui/tokens.ts, src/lib/edges/colors.ts). Everything
 * that has to be computed reads from here; everything only painted uses the
 * --nb-* custom properties in node-banana.css.
 */

/** Padding between the media card's border and the media clip. */
export const CARD_PAD = 4;
/** Card padding plus its 1px border: where the media clip starts. */
export const CARD_EDGE = 5;

/** Centre of the first socket, measured from the media card's top edge (inside the border). */
export const SOCKET_TOP = 24;
/** Distance between consecutive socket centres on one side. */
export const SOCKET_PITCH = 30;
/** Socket swell box. */
export const SOCKET_W = 18;
export const SOCKET_H = 28;
export const SOCKET_HOLE_R = 3;
export const SOCKET_RING_W = 1.5;
/** Noodles end on the socket box's outer edge, this far outside the card's outer edge. */
export const SOCKET_REACH = 14;

/** The floating header sits this far above the media card. */
export const HEADER_OFFSET = 26;
/** Row between the media card and the controls card (history nav / scrubber). */
export const GAP_ROW_H = 28;
/** Spacing between the cards when the gap row has nothing to show. */
export const CONTROLS_GAP = 8;
/** Collapsed controls card: the summary row. */
export const SUMMARY_ROW_H = 28;
/** Controls card is `node width − CONTROLS_INSET`, capped at CONTROLS_MAX_W. */
export const CONTROLS_INSET = 24;
export const CONTROLS_MAX_W = 360;

export const FIELD_ROW_H = 22;
export const FIELD_GAP = 4;
export const FIELD_LABEL_W = 72;

export const NODE_MIN_W = 200;
export const NODE_MAX_W = 500;

/** The app's default widths per node type (src/store/utils/nodeDefaults.ts). */
export const NODE_DEFAULT_W = {
  imageInput: 300,
  prompt: 320,
  promptConstructor: 340,
  generateImage: 300,
  generateVideo: 300,
  llmGenerate: 320,
  editVideo: 400,
  easeCurve: 340,
  splitGrid: 300,
  router: 200,
  switch: 220,
  output: 320,
} as const;

/** Noodle stroke widths by the thickness setting; regular is the default. */
export const NOODLE_WIDTH = { thin: 2, regular: 3, thick: 5 } as const;
/** Curvature handed to the bezier route (React Flow getBezierPath). */
export const NOODLE_CURVATURE = 0.25;
/** Opacity of noodles not attached to the selection (edgeAppearance.fadedOpacity). */
export const NOODLE_FADED_OPACITY = 0.25;

/** Controls card trailing: share of the remaining distance closed per 16.7ms, and the most it may lag. */
export const TRAIL_EASE = 0.4;
export const TRAIL_MAX = 18;

export const SOCKET_TYPES = ["image", "text", "video", "audio", "3d", "easeCurve", "reference"] as const;
export type SocketType = (typeof SOCKET_TYPES)[number];

/** One hue per data type, shared by the sockets and the noodles. */
export const HANDLE_COLORS: Record<SocketType, string> = {
  image: "#10b981",
  text: "#3b82f6",
  video: "#ec4899",
  audio: "#a855f7",
  "3d": "#f97316",
  easeCurve: "#bef264",
  reference: "#6b7280",
};

/** Every colour a noodle can take: the data types plus the edge-only states. */
export const EDGE_COLORS = {
  ...HANDLE_COLORS,
  default: "#64748b",
  pause: "#ea580c",
  loop: "#d946ef",
} as const;
export type EdgeColorKey = keyof typeof EDGE_COLORS;

/** Node colours in the minimap and the agent's workflow preview. */
export const MINIMAP_COLORS = {
  imageInput: "#3b82f6",
  prompt: "#f97316",
  promptConstructor: "#f472b6",
  generateImage: "#22c55e",
  generateVideo: "#9333ea",
  llmGenerate: "#06b6d4",
  editVideo: "#f97316",
  easeCurve: "#bef264",
  output: "#ef4444",
  router: "#6b7280",
  switch: "#8b5cf6",
  default: "#94a3b8",
} as const;

/** A `#rrggbb` colour 40% of the way to white: the head of a running noodle's comet. */
export function edgeHighlightColor(hex: string): string {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${channels.map((c) => Math.round(c * 0.6 + 255 * 0.4).toString(16).padStart(2, "0")).join("")}`;
}

/** The CSS colour of a socket type, as a custom property on the .nb root. */
export function socketColor(type: SocketType): string {
  return `var(--nb-handle-${type})`;
}
