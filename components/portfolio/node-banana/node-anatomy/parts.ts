// The five parts every Node Banana node is built from, named as the 2.0
// changelog's "Node redesign" entry and docs/node-redesign.md describe them.

export type PartId = "header" | "media" | "sockets" | "history" | "controls";

export interface Part {
  id: PartId;
  name: string;
  text: string;
}

export const PARTS: ReadonlyArray<Part> = [
  {
    id: "header",
    name: "Header",
    text: "Floats above the card and stays quiet. Run and the kebab menu fade in on hover.",
  },
  {
    id: "media",
    name: "Media card",
    text: "Shows the output at its native proportions. Selection and run outlines live here only.",
  },
  {
    id: "sockets",
    name: "Sockets",
    text: "Swells in the card’s border at a fixed pitch. The hole fills in the type colour when connected.",
  },
  {
    id: "history",
    name: "History",
    text: "The gap row pages back through earlier runs, or scrubs a video.",
  },
  {
    id: "controls",
    name: "Controls card",
    text: "A summary row (provider, model, key values) that opens into one column of tight fields.",
  },
];

export const PART_ORDER: ReadonlyArray<PartId> = PARTS.map((p) => p.id);

/** Which part of a node an element belongs to (sockets first: they sit inside the media card). */
export function partAt(target: EventTarget | null): PartId | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("[data-nb-socket]")) return "sockets";
  if (target.closest("[data-node-header]")) return "header";
  if (target.closest("[data-gap-row]")) return "history";
  if (target.closest("[data-controls-card]")) return "controls";
  if (target.closest("[data-media-card]")) return "media";
  return null;
}
