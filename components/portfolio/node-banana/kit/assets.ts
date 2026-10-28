// Media made with Node Banana, copied from the landing site (site/public/assets).
// Paths are root-relative; sizes are the files' own pixels.

const IMG = "/images/portfolio/node-banana/demo";
const VID = "/videos/portfolio/node-banana/demo";

export const NB_ASSETS = {
  /** The "Invisible Mannequin" workflow: input photo → generated jacket → turntable video. */
  mannequin: {
    input: { src: `${IMG}/im-input.jpg`, width: 825, height: 1100 },
    jacket: { src: `${IMG}/im-jacket.jpg`, width: 585, height: 780 },
    // The poster is 600×800, the same 3:4 as the clip.
    video: { src: `${VID}/im-video.mp4`, poster: `${IMG}/im-video-poster.jpg`, width: 406, height: 540, duration: 5 },
  },
  /** The "Cars" contact-sheet workflow. */
  cars: {
    input: { src: `${IMG}/cars-input.jpg`, width: 800, height: 533 },
    grid: { src: `${IMG}/cars-grid.jpg`, width: 1200, height: 805 },
    grid2x2: { src: `${IMG}/cars-grid-2x2.jpg`, width: 800, height: 536 },
    cell1: { src: `${IMG}/cars-cell-1.jpg`, width: 600, height: 402 },
    cell3: { src: `${IMG}/cars-cell-3.jpg`, width: 600, height: 402 },
    cell7: { src: `${IMG}/cars-cell-7.jpg`, width: 400, height: 268 },
    cell9: { src: `${IMG}/cars-cell-9.jpg`, width: 400, height: 268 },
    upscale1: { src: `${IMG}/cars-upscale-1.jpg`, width: 900, height: 603 },
    upscale3: { src: `${IMG}/cars-upscale-3.jpg`, width: 900, height: 603 },
    video: { src: `${VID}/cars-video.mp4`, poster: `${IMG}/cars-video-poster.jpg`, width: 716, height: 480, duration: 5 },
    eased: { src: `${VID}/cars-eased.mp4`, poster: `${IMG}/cars-eased-poster.jpg`, width: 716, height: 480, duration: 1.5 },
  },
  /** Agent-run stills ("Camel coat lookbook" and the assets library), all 640×357. dress and knit are spares no site partial used. */
  agent: Object.fromEntries(
    [
      "base",
      "brutalist",
      "coastal",
      "dress",
      "greenhouse",
      "knit",
      "neon",
      "palace",
      "paris",
      "salt-aerial",
      "salt-close",
      "salt-low",
      "salt-walk",
      "saltflat",
      "spotlight",
      "subway",
      "suit",
      "trench",
    ].map((name) => [name, { src: `${IMG}/ag-${name}.jpg`, width: 640, height: 357 }]),
  ) as Record<
    | "base"
    | "brutalist"
    | "coastal"
    | "dress"
    | "greenhouse"
    | "knit"
    | "neon"
    | "palace"
    | "paris"
    | "salt-aerial"
    | "salt-close"
    | "salt-low"
    | "salt-walk"
    | "saltflat"
    | "spotlight"
    | "subway"
    | "suit"
    | "trench",
    { src: string; width: number; height: number }
  >,
  /** The Comfy app node's output. */
  comfyParis: { src: `${IMG}/comfy-paris.jpg`, width: 720, height: 402 },
  banana: { src: `${IMG}/banana.png`, width: 512, height: 512 },
  kie: { src: `${IMG}/kie.png`, width: 160, height: 160 },
  codexMark: { src: `${IMG}/codex-mark.png`, width: 96, height: 96 },
} as const;
