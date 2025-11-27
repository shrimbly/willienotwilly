import { staticFile } from "remotion";
import rockBenchData from "./rockBenchData.json";

type ModelKey =
  | "gpt"
  | "gptMini"
  | "nanoBananaPro"
  | "seedream"
  | "qwen"
  | "nanoBanana"
  | "flux";

export type RockBenchPoint = {
  imageNumber: number;
  ssim: number;
};

export type RockBenchSegment = {
  modelKey: ModelKey;
  displayName: string;
  videoSrc: string;
  points: RockBenchPoint[];
  durationInFrames: number;
  originalDurationInFrames?: number; // Original video duration (for chart calculations)
  tntrScore?: number; // TNTR (That's Not The Rock) score - generation where it stops being The Rock
};

type ModelInfo = {
  key: ModelKey;
  displayName: string;
};

const MODELS: ModelInfo[] = [
  { key: "gptMini", displayName: "GPT-Image1-mini" },
  { key: "nanoBananaPro", displayName: "Nano Banana Pro" },
  { key: "seedream", displayName: "SeeDream 4" },
  { key: "qwen", displayName: "Qwen Image Edit" },
  { key: "nanoBanana", displayName: "Nano Banana" },
  { key: "flux", displayName: "Flux Kontext Pro" },
  { key: "gpt", displayName: "GPT-Image1" },
];

// Use normalized 1024x1024 videos from the remotion subfolder
const VIDEO_FILES: Record<ModelKey, string> = {
  gpt: "remotion/gpt_evolution.mp4",
  gptMini: "remotion/gptmini_evolution.mp4",
  nanoBananaPro: "remotion/nano_banana_pro_evolution.mp4",
  seedream: "remotion/seedream_evolution.mp4",
  qwen: "remotion/qwen_evolution.mp4",
  nanoBanana: "remotion/nanobana_evolution.mp4",
  flux: "remotion/flux_evolution.mp4",
};

// TNTR (That's Not The Rock) scores - generation where it stops being The Rock
const TNTR_SCORES: Record<ModelKey, number> = {
  gpt: 6,
  gptMini: 1,
  nanoBananaPro: 26,
  seedream: 11,
  qwen: 25,
  nanoBanana: 21,
  flux: 33,
};

export function getBaseSegments(): Omit<RockBenchSegment, "durationInFrames">[] {
  return MODELS.map((model) => {
    const fileName = VIDEO_FILES[model.key];
    return {
      modelKey: model.key,
      displayName: model.displayName,
      videoSrc: staticFile(`videos/${fileName}`),
      points: rockBenchData
        .filter(
          (point) =>
            typeof point[model.key as keyof typeof point] === "number"
        )
        .map((point) => ({
          imageNumber: point.imageNumber,
          ssim: (point[model.key as keyof typeof point] as number) ?? 0,
        })),
      tntrScore: TNTR_SCORES[model.key],
    };
  });
}
