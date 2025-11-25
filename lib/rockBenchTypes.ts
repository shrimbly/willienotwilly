export interface ChartDataPoint {
  imageNumber: number;
  flux?: number;
  gpt?: number;
  gptMini?: number;
  nanoBananaPro?: number;
  nanoBanana?: number;
  qwen?: number;
  seedream?: number;
}

export interface ModelInfo {
  key: keyof Omit<ChartDataPoint, "imageNumber">;
  csvName: string;
  displayName: string;
  description: string;
}

export const MODELS: ModelInfo[] = [
  {
    key: "nanoBananaPro",
    csvName: "Nano-Banana-Pro",
    displayName: "Nano Banana Pro",
    description:
      "Currently the touted SOTA of image editing models, how does it degrade?",
  },
  {
    key: "seedream",
    csvName: "SeeDream",
    displayName: "SeeDream 4",
    description:
      "Currently the runner-up to Nano Banana Pro in the leaderboards, the model typically performs quite well with photographic edits.",
  },
  {
    key: "gpt",
    csvName: "GPT",
    displayName: "GPT-Image1",
    description:
      "The original reddit post was 7 months prior to writing this, lets start with a check in, how have things changed.",
  },
  {
    key: "gptMini",
    csvName: "GPT-Mini",
    displayName: "GPT-Image1-mini",
    description: "What about GPT's little bro?",
  },
  {
    key: "qwen",
    csvName: "Qwen",
    displayName: "Qwen Image Edit",
    description:
      "Highly trainable model which has recently been gaining popularity on the release of a few nice fine tunes.",
  },
  {
    key: "nanoBanana",
    csvName: "Nano-Banana",
    displayName: "Nano Banana",
    description:
      "A fantastic model, only recently overshadowed by the pro upgrade.",
  },
  {
    key: "flux",
    csvName: "FLUX",
    displayName: "Flux Kontext Pro",
    description:
      "The model that proved the usefulness of editing models, it is over a year old now.",
  },
];
