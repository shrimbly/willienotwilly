// The Finalize demo's listing: Hologram Tee — Black as the real store had it
// when its T-Shirt Shoot: x3 results came through (staging_items in
// comfy-shopify/server/data/comfy-commerce.sqlite: three `add-new` rows,
// 19d5835b standing, 337b2915 seated, 77267f3d close-up). Its two seeded
// flat-lays are the listing's live media; the three results are staged.
//
// The results are drawn as gallery tiles (size-20 in the product, scaled up
// here), so they get their own small copies: 450×336 WebP q80 from the
// broker's 1200×896 originals, in public/images/portfolio/demos/comfy-commerce/finalize/.
// The flat-lays reuse the shared 480×320 set.

import { productBySlug, SHOOT_HOLOGRAM_BLACK, STORE, type CcImage } from "./media";

const ROOT = "/images/portfolio/demos/comfy-commerce/finalize";

/** One tile in the gallery strip: a live image (`m:`) or a staged result (`s:`), as galleryOrder.ts keys them. */
export interface FinalizeTile {
  id: string;
  /** What a screen reader calls it ("Flat-lay 1", "Standing"). */
  label: string;
  image: CcImage;
  /** A staged result (outlined in ink with a "New" footer until it is published). */
  staged: boolean;
}

const product = productBySlug("hologram-tee-black");

/** The listing the strip arranges (its title is verbatim from seed-products.ts). */
export const FINALIZE_LISTING = {
  title: product.title,
  storeName: STORE.shopName,
} as const;

const thumbs: Record<string, CcImage> = {
  standing: {
    src: `${ROOT}/hologram-tee-black-standing.webp`,
    width: 450,
    height: 336,
    alt: SHOOT_HOLOGRAM_BLACK.results[0].image.alt,
  },
  seated: {
    src: `${ROOT}/hologram-tee-black-seated.webp`,
    width: 450,
    height: 336,
    alt: SHOOT_HOLOGRAM_BLACK.results[1].image.alt,
  },
  "close-up": {
    src: `${ROOT}/hologram-tee-black-closeup.webp`,
    width: 450,
    height: 336,
    alt: SHOOT_HOLOGRAM_BLACK.results[2].image.alt,
  },
};

/**
 * Every tile, keyed by its strip id. The live flat-lays first, then the
 * results in the order the workflow staged them (standing, seated, close-up).
 */
export const FINALIZE_TILES: FinalizeTile[] = [
  ...product.media.map((image, i) => ({ id: `m:flat-${i + 1}`, label: `Flat-lay ${i + 1}`, image, staged: false })),
  ...SHOOT_HOLOGRAM_BLACK.results.map((r) => ({ id: `s:${r.shot}`, label: r.label, image: thumbs[r.shot], staged: true })),
];

/**
 * The strip's first order, as buildInitialOrder (features/review/galleryOrder.ts)
 * lays out a listing with only `add-new` results: the live media in position
 * order, then the additions appended in staging order.
 */
export const FINALIZE_INITIAL_ORDER: string[] = FINALIZE_TILES.map((t) => t.id);

/** The strip is sized for the full set, so tiles keep their size as results are dropped. */
export const FINALIZE_SLOTS = FINALIZE_TILES.length;
