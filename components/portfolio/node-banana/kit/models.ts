// Image model settings, ported from Node Banana's src/types/models.ts and
// src/utils/costCalculator.ts: what each Gemini image model offers, and what
// a run costs (the empty state's "~$0.13").

export type AspectRatio =
  | "1:1"
  | "1:4"
  | "1:8"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:1"
  | "4:3"
  | "4:5"
  | "5:4"
  | "8:1"
  | "9:16"
  | "16:9"
  | "21:9";

export type Resolution = "512" | "1K" | "2K" | "4K";

export type GeminiImageModel = "nano-banana" | "nano-banana-pro" | "nano-banana-2" | "nano-banana-2.1" | "nano-banana-2-lite";

export const MODEL_DISPLAY_NAMES: Record<GeminiImageModel, string> = {
  "nano-banana": "Nano Banana",
  "nano-banana-pro": "Nano Banana Pro",
  "nano-banana-2": "Nano Banana 2",
  "nano-banana-2.1": "Nano Banana 2.1",
  "nano-banana-2-lite": "Nano Banana 2 Lite",
};

/** The Model dropdown, in the app's order. */
export const GEMINI_IMAGE_MODELS: ReadonlyArray<{ value: GeminiImageModel; label: string }> = [
  { value: "nano-banana", label: MODEL_DISPLAY_NAMES["nano-banana"] },
  { value: "nano-banana-2", label: MODEL_DISPLAY_NAMES["nano-banana-2"] },
  { value: "nano-banana-2.1", label: MODEL_DISPLAY_NAMES["nano-banana-2.1"] },
  { value: "nano-banana-2-lite", label: MODEL_DISPLAY_NAMES["nano-banana-2-lite"] },
  { value: "nano-banana-pro", label: MODEL_DISPLAY_NAMES["nano-banana-pro"] },
];

export const BASE_ASPECT_RATIOS: readonly AspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
export const EXTENDED_ASPECT_RATIOS: readonly AspectRatio[] = [
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
];

export interface GeminiImageOptions {
  aspectRatios: readonly AspectRatio[];
  /** Empty: the model has no Resolution field (it makes 1K). */
  resolutions: readonly Resolution[];
  googleSearch: boolean;
  imageSearch: boolean;
}

/** Which fields the settings panel shows for each model. */
export const GEMINI_IMAGE_OPTIONS: Record<GeminiImageModel, GeminiImageOptions> = {
  "nano-banana": { aspectRatios: BASE_ASPECT_RATIOS, resolutions: [], googleSearch: false, imageSearch: false },
  "nano-banana-2": { aspectRatios: EXTENDED_ASPECT_RATIOS, resolutions: ["512", "1K", "2K", "4K"], googleSearch: true, imageSearch: true },
  "nano-banana-2.1": { aspectRatios: EXTENDED_ASPECT_RATIOS, resolutions: ["1K", "2K", "4K"], googleSearch: true, imageSearch: true },
  "nano-banana-2-lite": { aspectRatios: BASE_ASPECT_RATIOS, resolutions: [], googleSearch: false, imageSearch: false },
  "nano-banana-pro": { aspectRatios: BASE_ASPECT_RATIOS, resolutions: ["1K", "2K", "4K"], googleSearch: true, imageSearch: false },
};

/** USD per image on the Gemini API. */
export const IMAGE_PRICING: Record<GeminiImageModel, Record<Resolution, number>> = {
  "nano-banana": { "512": 0.039, "1K": 0.039, "2K": 0.039, "4K": 0.039 },
  "nano-banana-pro": { "512": 0.134, "1K": 0.134, "2K": 0.134, "4K": 0.24 },
  "nano-banana-2": { "512": 0.045, "1K": 0.067, "2K": 0.101, "4K": 0.151 },
  "nano-banana-2.1": { "512": 0.0336, "1K": 0.0336, "2K": 0.0504, "4K": 0.113 },
  "nano-banana-2-lite": { "512": 0.034, "1K": 0.034, "2K": 0.034, "4K": 0.034 },
};

export function imageCost(model: GeminiImageModel, resolution: Resolution): number {
  if (model === "nano-banana" || model === "nano-banana-2-lite") return IMAGE_PRICING[model]["1K"];
  return IMAGE_PRICING[model][resolution];
}

/** "$0.13", "<$0.01" */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

/** "16:9" → 1.777…; anything unparseable is square. */
export function parseAspectRatio(ratio: string): number {
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}
