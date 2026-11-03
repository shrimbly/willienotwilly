// Comfy Commerce's real product media, sized for the web. Sources:
//  - the store's flat-lays, ~/Downloads/comfymerch/*.png (what
//    comfy-shopify/server/scripts/seed-products.ts uploaded, in its order),
//  - results the T-Shirt Shoot: x3 workflow staged for review, from the
//    broker's server/data/assets/<uuid>.png (mapped through staging_items in
//    server/data/comfy-commerce.sqlite; uuid prefixes noted below),
//  - the built-in workflows' card thumbnails, web/public/builtins/.
// Product titles are verbatim from seed-products.ts, em dashes and all.
//
// All WebP (q82 flat-lays and thumbnails, q86 for the large compare images),
// in public/images/portfolio/demos/comfy-commerce/{flat,source,result,workflows}/.
// Paths are root-relative, without assetUrl(). Each entry records its size.

const ROOT = "/images/portfolio/demos/comfy-commerce";

export interface CcImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

const img = (path: string, width: number, height: number, alt: string): CcImage => ({
  src: `${ROOT}/${path}`,
  width,
  height,
  alt,
});

/* ------------------------------------------------------------------ store */

/**
 * The connected store the demos show: the test store's shop name (stores table). Its own myshopify domain is
 * not public, so any demo that shows a domain uses a reserved .example name (RFC 2606) that no store can own.
 * The store's favicon is remote, so demos draw StoreAvatar's fallback.
 */
export const STORE = {
  domain: "comfortable-apparel.example",
  shopName: "Comfortable Apparel",
} as const;

/* --------------------------------------------------------------- products */

export type ProductSlug =
  | "we-tee-black"
  | "we-tee-bone"
  | "spaghetti-tee-black"
  | "spaghetti-tee-grape"
  | "hologram-tee-black"
  | "voxel-tee-black"
  | "voxel-tee-grape"
  | "artists-tool-tee-chrome"
  | "artists-tool-tee-postcard"
  | "artists-tool-tee-floral"
  | "artists-tool-tee-botanical"
  | "artists-tool-tee-camo"
  | "artists-tool-tee-sunset"
  | "artists-tool-tee-brushstroke";

export interface CcProduct {
  slug: ProductSlug;
  /** Verbatim from seed-products.ts. */
  title: string;
  /** The listing's gallery, featured first, as seeded: 480px-wide flat-lays (flat/). */
  media: CcImage[];
}

const flat = (slug: string, title: string, file: string, portrait = false, n?: number) =>
  img(`flat/${slug}.webp`, 480, portrait ? 600 : 320, `${title}, flat-lay${n ? ` ${n}` : ""} (${file})`);

/**
 * The store's fourteen tees in seed order. The two Workflow Engine flat-lays
 * are portrait (480×600, from 2610×3261); the rest landscape (480×320, from
 * 4500×3000) on a light grey sweep. Four listings have a second image.
 */
export const PRODUCTS: CcProduct[] = [
  { slug: "we-tee-black", title: "Workflow Engine Tee — Black", media: [flat("we-tee-black", "Workflow Engine Tee — Black", "-.png", true)] },
  { slug: "we-tee-bone", title: "Workflow Engine Tee — Bone", media: [flat("we-tee-bone", "Workflow Engine Tee — Bone", "--1.png", true)] },
  { slug: "spaghetti-tee-black", title: "Spaghetti Tee — Black", media: [flat("spaghetti-tee-black", "Spaghetti Tee — Black", "Back.png")] },
  {
    slug: "spaghetti-tee-grape",
    title: "Spaghetti Tee — Grape",
    media: [
      flat("spaghetti-tee-grape", "Spaghetti Tee — Grape", "Purple.png"),
      flat("spaghetti-tee-grape-2", "Spaghetti Tee — Grape", "Purple-2.png", false, 2),
    ],
  },
  {
    slug: "hologram-tee-black",
    title: "Hologram Tee — Black",
    media: [
      flat("hologram-tee-black", "Hologram Tee — Black", "Back-1.png"),
      flat("hologram-tee-black-2", "Hologram Tee — Black", "Back-2.png", false, 2),
    ],
  },
  {
    slug: "voxel-tee-black",
    title: "Voxel Tee — Black",
    media: [
      flat("voxel-tee-black", "Voxel Tee — Black", "Back-4.png"),
      flat("voxel-tee-black-2", "Voxel Tee — Black", "Back-3.png", false, 2),
    ],
  },
  { slug: "voxel-tee-grape", title: "Voxel Tee — Grape", media: [flat("voxel-tee-grape", "Voxel Tee — Grape", "Purple-1.png")] },
  { slug: "artists-tool-tee-chrome", title: "Artists' Tool Tee — Chrome", media: [flat("artists-tool-tee-chrome", "Artists' Tool Tee — Chrome", "Back1.png")] },
  { slug: "artists-tool-tee-postcard", title: "Artists' Tool Tee — Postcard", media: [flat("artists-tool-tee-postcard", "Artists' Tool Tee — Postcard", "Back-11.png")] },
  { slug: "artists-tool-tee-floral", title: "Artists' Tool Tee — Floral", media: [flat("artists-tool-tee-floral", "Artists' Tool Tee — Floral", "Back-21.png")] },
  { slug: "artists-tool-tee-botanical", title: "Artists' Tool Tee — Botanical", media: [flat("artists-tool-tee-botanical", "Artists' Tool Tee — Botanical", "Back-31.png")] },
  { slug: "artists-tool-tee-camo", title: "Artists' Tool Tee — Camo", media: [flat("artists-tool-tee-camo", "Artists' Tool Tee — Camo", "Back-41.png")] },
  { slug: "artists-tool-tee-sunset", title: "Artists' Tool Tee — Sunset", media: [flat("artists-tool-tee-sunset", "Artists' Tool Tee — Sunset", "Back-51.png")] },
  {
    slug: "artists-tool-tee-brushstroke",
    title: "Artists' Tool Tee — Brushstroke",
    media: [flat("artists-tool-tee-brushstroke", "Artists' Tool Tee — Brushstroke", "Back-61.png")],
  },
];

export function productBySlug(slug: ProductSlug): CcProduct {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) throw new Error(`Unknown Comfy Commerce product: ${slug}`);
  return product;
}

/* ------------------------------------------------- large sources (source/) */

/** Flat-lays at compare size (1100px on the long side), for the products that have results. */
export const SOURCES = {
  "we-tee-black": img("source/we-tee-black.webp", 880, 1100, "Workflow Engine Tee — Black, flat-lay on a warm grey ground"),
  "we-tee-bone": img("source/we-tee-bone.webp", 880, 1100, "Workflow Engine Tee — Bone, flat-lay"),
  "spaghetti-tee-black": img("source/spaghetti-tee-black.webp", 1100, 733, "Spaghetti Tee — Black, flat-lay: a black tee with looping yellow and violet lines"),
  "spaghetti-tee-grape": img("source/spaghetti-tee-grape.webp", 1100, 733, "Spaghetti Tee — Grape, flat-lay"),
  "hologram-tee-black": img("source/hologram-tee-black.webp", 1100, 733, "Hologram Tee — Black, flat-lay: an iridescent Comfy mark"),
  "artists-tool-tee-floral": img("source/artists-tool-tee-floral.webp", 1100, 733, "Artists' Tool Tee — Floral, flat-lay"),
  "artists-tool-tee-chrome": img("source/artists-tool-tee-chrome.webp", 1100, 733, "Artists' Tool Tee — Chrome, flat-lay"),
} satisfies Partial<Record<ProductSlug, CcImage>>;

/* ------------------------------------------------------ results (result/) */

/**
 * Workflow results at compare size. The T-Shirt Shoot: x3 outputs are
 * 1100×821 (from 1200×896): the same model in a high-rise loft, standing,
 * seated in a lounge chair, and a close-up of the print. The Workflow Engine
 * Tee — Black on-model shots are 941×1100 (from 944×1104), an earlier
 * single-image run (the ones in the product's own lightbox screenshots).
 */
export const RESULTS = {
  /** d378b712: on a model, warm grey studio wall (the result in .e2e-shots/34, 35). */
  "we-tee-black-model": img("result/we-tee-black-model.webp", 941, 1100, "A model wearing the Workflow Engine Tee — Black against a warm grey wall"),
  /** ad93de2f: the same, on a white wall. */
  "we-tee-black-model-white": img("result/we-tee-black-model-white.webp", 941, 1100, "A model wearing the Workflow Engine Tee — Black against a white wall"),
  /** c2820712 (T-Shirt Shoot, standing). */
  "we-tee-bone-standing": img("result/we-tee-bone-standing.webp", 1100, 821, "A model standing in a loft in the Workflow Engine Tee — Bone"),
  /** 377f92ab (T-Shirt Shoot, standing). */
  "spaghetti-tee-black-standing": img("result/spaghetti-tee-black-standing.webp", 1100, 821, "A model standing by the windows of a high-rise loft in the Spaghetti Tee — Black"),
  /** d4742359 (T-Shirt Shoot, seated). */
  "spaghetti-tee-black-seated": img("result/spaghetti-tee-black-seated.webp", 1100, 821, "The same model seated in a leather lounge chair in the Spaghetti Tee — Black"),
  /** 2bb12f7d (T-Shirt Shoot, close-up). */
  "spaghetti-tee-black-closeup": img("result/spaghetti-tee-black-closeup.webp", 1100, 821, "A close-up of the Spaghetti Tee's looping yellow and violet print"),
  /** 2be091de (T-Shirt Shoot, seated; still pending in the real queue). */
  "spaghetti-tee-grape-seated": img("result/spaghetti-tee-grape-seated.webp", 1100, 821, "A model seated in a lounge chair in the Spaghetti Tee — Grape"),
  /** 19d5835b (T-Shirt Shoot, standing). */
  "hologram-tee-black-standing": img("result/hologram-tee-black-standing.webp", 1100, 821, "A model standing in a loft in the Hologram Tee — Black"),
  /** 337b2915 (T-Shirt Shoot, seated). */
  "hologram-tee-black-seated": img("result/hologram-tee-black-seated.webp", 1100, 821, "A model seated in a lounge chair in the Hologram Tee — Black"),
  /** 77267f3d (T-Shirt Shoot, close-up). */
  "hologram-tee-black-closeup": img("result/hologram-tee-black-closeup.webp", 1100, 821, "A close-up of the Hologram Tee's iridescent print"),
  /** 979cef48 (T-Shirt Shoot, seated, with a coffee). */
  "artists-tool-tee-floral-seated": img("result/artists-tool-tee-floral-seated.webp", 1100, 821, "A model seated with a coffee in the Artists' Tool Tee — Floral"),
  /** 400f60e2 (T-Shirt Shoot, standing). */
  "artists-tool-tee-chrome-standing": img("result/artists-tool-tee-chrome-standing.webp", 1100, 821, "A model standing in a loft in the Artists' Tool Tee — Chrome"),
} satisfies Record<string, CcImage>;

export type ResultKey = keyof typeof RESULTS;

/* ----------------------------------------------------------- review pairs */

export interface ReviewPair {
  id: string;
  product: ProductSlug;
  productTitle: string;
  /** The workflow that made the result, as the staging row records it (recipe_id); null where the row is gone. */
  workflow: string | null;
  /** The live image (or the source, for an add) and the staged result. */
  source: CcImage;
  result: CcImage;
}

const pair = (id: string, product: keyof typeof SOURCES, result: ResultKey, workflow: string | null = "T-Shirt Shoot: x3"): ReviewPair => ({
  id,
  product,
  productTitle: productBySlug(product).title,
  workflow,
  source: SOURCES[product],
  result: RESULTS[result],
});

/**
 * Source/result pairs of the same tee, checked by eye: each result wears the
 * print its source shows. Landscape sources (1100×733) pair with landscape
 * results; the two Workflow Engine pairs are portrait.
 */
export const REVIEW_PAIRS: ReviewPair[] = [
  pair("spaghetti-black-standing", "spaghetti-tee-black", "spaghetti-tee-black-standing"),
  // An early single-image run (2026-06-11); its run and staging rows no longer exist.
  pair("we-black-model", "we-tee-black", "we-tee-black-model", null),
  pair("hologram-black-standing", "hologram-tee-black", "hologram-tee-black-standing"),
  pair("floral-seated", "artists-tool-tee-floral", "artists-tool-tee-floral-seated"),
  pair("grape-seated", "spaghetti-tee-grape", "spaghetti-tee-grape-seated"),
  pair("chrome-standing", "artists-tool-tee-chrome", "artists-tool-tee-chrome-standing"),
  pair("we-bone-standing", "we-tee-bone", "we-tee-bone-standing"),
];

/* ------------------------------------------------------- one shirt, three shots */

/**
 * One T-Shirt Shoot: x3 run on the Spaghetti Tee — Black (published in the
 * real store): the flat-lay in, three results out, in the order the
 * workflow's description lists them.
 */
export const SHOOT_SPAGHETTI_BLACK = {
  product: "spaghetti-tee-black" as const,
  productTitle: "Spaghetti Tee — Black",
  workflow: "T-Shirt Shoot: x3",
  source: SOURCES["spaghetti-tee-black"],
  /** Also the 480px flat-lay, for grids and strips. */
  sourceThumb: productBySlug("spaghetti-tee-black").media[0],
  results: [
    { shot: "standing" as const, label: "Standing", image: RESULTS["spaghetti-tee-black-standing"] },
    { shot: "seated" as const, label: "Seated", image: RESULTS["spaghetti-tee-black-seated"] },
    { shot: "close-up" as const, label: "Close-up", image: RESULTS["spaghetti-tee-black-closeup"] },
  ],
};

/** The same set for the Hologram Tee — Black, should a demo need a second run. */
export const SHOOT_HOLOGRAM_BLACK = {
  product: "hologram-tee-black" as const,
  productTitle: "Hologram Tee — Black",
  workflow: "T-Shirt Shoot: x3",
  source: SOURCES["hologram-tee-black"],
  sourceThumb: productBySlug("hologram-tee-black").media[0],
  results: [
    { shot: "standing" as const, label: "Standing", image: RESULTS["hologram-tee-black-standing"] },
    { shot: "seated" as const, label: "Seated", image: RESULTS["hologram-tee-black-seated"] },
    { shot: "close-up" as const, label: "Close-up", image: RESULTS["hologram-tee-black-closeup"] },
  ],
};

/* ------------------------------------------------------ built-in workflows */

export interface BuiltinWorkflow {
  id: string;
  name: string;
  /** Verbatim from server/src/workflows/builtin-graphs.ts. */
  description: string;
  /** The card's thumbnail (768px wide); null draws gradientFor(id). */
  image: CcImage | null;
  /** HoverWipe's comparison image, or null for a plain thumbnail. */
  compare: CcImage | null;
  /** The Tripo card's looping clip (768×520, 24 fps, 177 frames, 7.4 s, H.264, no audio). */
  video?: { src: string; poster: string; width: number; height: number };
}

/**
 * The nine built-ins in the product's display order (builtins.ts
 * DISPLAY_ORDER), with its pre-downscaled card thumbnails. As shipped,
 * subtle-grade.png and nano-banana-2-generic-compare.png are the same file.
 */
export const BUILTIN_WORKFLOWS: BuiltinWorkflow[] = [
  {
    id: "builtin:subtle-grade",
    name: "Subtle Grade",
    description:
      "A gentle color grade that deepens the shadows and softens the highlights for a richer, more editorial look. Subtle by design, so the product stays true to life while feeling a little more polished.",
    image: img("workflows/subtle-grade.webp", 768, 428, "Subtle Grade: a model in a bone tee in a sunlit loft"),
    compare: img("workflows/subtle-grade-compare.webp", 768, 428, "Subtle Grade: the same shot, graded"),
  },
  {
    id: "builtin:t-shirt-shoot-x3",
    name: "T-Shirt Shoot: x3",
    description:
      "Turns a flat shirt or packshot into a three-image editorial set: a model wearing it standing, the same model seated, and a close-up of the print detail. Each shot's prompt is editable, so you can tune the model, setting, and styling.",
    image: img("workflows/t-shirt-shoot-x3.webp", 768, 428, "T-Shirt Shoot: x3: seated, standing and close-up shots of a bone tee"),
    compare: null,
  },
  {
    id: "builtin:relighting",
    name: "Relighting",
    description:
      "Re-lights the product using a choice of lighting presets — trade flat or harsh light for something warmer and more directional. A quick way to give catalog shots a consistent, intentional look.",
    image: img("workflows/relighting.webp", 768, 573, "Relighting: a model in a bone tee by tall windows"),
    compare: null,
  },
  {
    id: "builtin:change-aspect-ratio",
    name: "Change Aspect Ratio",
    description:
      "Outpaints the image to a new aspect ratio you pick, inventing scene around the original instead of cropping it. Great for turning a square packshot into a wide banner or a tall story format without losing the product.",
    image: img("workflows/change-aspect-ratio.webp", 768, 581, "Change Aspect Ratio: the loft shot widened"),
    compare: img("workflows/change-aspect-ratio-compare.webp", 768, 577, "Change Aspect Ratio: the original, with green where the scene is added"),
  },
  {
    id: "builtin:fit-to-768px",
    name: "Resize",
    description:
      "Scale images to a target width you choose — the height follows to keep the original aspect ratio. Handy for bringing oversized product shots down to a consistent size before editing or publishing.",
    image: img("workflows/fit-to-768px.webp", 768, 512, "Resize: the Hologram Tee flat-lay"),
    compare: null,
  },
  {
    id: "builtin:nano-banana-2-generic",
    name: "Nano Banana 2 Generic",
    description:
      "A general-purpose image edit powered by Google's Nano Banana 2 model. Describe the change you want in the prompt and it re-renders the shot to match — best for quick, freeform edits that don't fit a more specific workflow.",
    image: img("workflows/nano-banana-2-generic.webp", 768, 581, "Nano Banana 2 Generic: the bone tee flat-lay"),
    compare: img("workflows/nano-banana-2-generic-compare.webp", 768, 428, "Nano Banana 2 Generic: the tee on a model in a loft"),
  },
  {
    id: "builtin:gpt-image-2-generic",
    name: "GPT Image 2 Generic",
    description:
      "A general-purpose image edit powered by OpenAI's GPT Image 2 model. Describe the change you want in the prompt and it re-renders the shot to match — best for quick, freeform edits that don't fit a more specific workflow.",
    image: img("workflows/gpt-image-2-generic.webp", 768, 512, "GPT Image 2 Generic: a model in a concrete room"),
    compare: null,
  },
  {
    id: "builtin:amazon-spec-product-image",
    name: "Amazon spec product image",
    description:
      "Prepares a shot to Amazon's main-image spec: removes the background, centers the product on pure white, and leaves about a 15% margin around it. Drop in a packshot and get a marketplace-ready image.",
    image: img("workflows/amazon-spec-product-image.webp", 768, 576, "Amazon spec product image: the Hologram Tee on pure white"),
    compare: null,
  },
  {
    id: "builtin:tripo-p1-image-to-3d",
    name: "Tripo P1 Image to 3D",
    description:
      "Generates a 3D model from a single product photo using Tripo. Produces a rotatable GLB you can preview right in the app — useful for turning a flat hero shot into an interactive 3D asset.",
    image: null,
    compare: null,
    video: {
      src: "/videos/portfolio/demos/comfy-commerce/tripo-p1-image-to-3d.mp4",
      poster: `${ROOT}/workflows/tripo-p1-image-to-3d-poster.webp`,
      width: 768,
      height: 520,
    },
  },
];
