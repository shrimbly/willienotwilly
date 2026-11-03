import type { CSSProperties } from "react";

// Ported verbatim from web/src/lib/gradient.ts.

/*
 * Generated placeholder gradients, deterministic per seed. All seeds draw
 * from one shared family (a blue -> violet -> pink aurora band, hues ~235–305)
 * so a grid of placeholders reads as a set; the seed varies the exact hue,
 * blob positions and accent within the band. OKLCH keeps lightness
 * perceptually even: L 0.84–0.94, chroma ≤ 0.11.
 */

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const oklch = (l: number, c: number, h: number) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${(((h % 360) + 360) % 360).toFixed(1)})`;

/**
 * The product's stand-in for a missing thumbnail (a workflow with no image, a
 * product with no media): a pastel mesh unique to `seed`. Pure, so it renders
 * the same on the server and the client. Spread it into `style`.
 */
export function gradientFor(seed: string): CSSProperties {
  const rand = mulberry32(hash32(seed));
  const base = 235 + rand() * 70;
  const spread = 18 + rand() * 10;
  // Accent leans pink-ward but never leaves the family.
  const accent = base + 45 + rand() * 25;

  // Blobs anchor to alternating corners (jittered), so no two pile into one corner.
  const jitter = (v: number) => v + rand() * 24 - 12;
  const blob = (x: number, y: number, l: number, c: number, h: number, stop: number) =>
    `radial-gradient(at ${jitter(x).toFixed(1)}% ${jitter(y).toFixed(1)}%, ${oklch(l, c, h)} 0%, transparent ${stop}%)`;

  return {
    backgroundImage: [
      blob(16, 22, 0.87, 0.09, base, 58),
      blob(84, 24, 0.84, 0.08, base + spread, 56),
      blob(22, 82, 0.9, 0.07, base - spread - 16, 62),
      blob(82, 80, 0.86, 0.11, accent, 48),
      `linear-gradient(${Math.round(rand() * 360)}deg, ${oklch(0.93, 0.04, base)}, ${oklch(0.89, 0.05, base + spread)})`,
    ].join(", "),
  };
}
