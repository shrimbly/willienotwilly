/**
 * The demo footage: six MGB GT V8 shots generated in Node Banana (the clips
 * behind the original Easy Peasy Ease video), plus one more shot from the same
 * generated sequence. Each is 960x642, 24 fps, 122 frames (5.083 s), H.264
 * with a keyframe every 6 frames, no audio.
 */

export interface Filmstrip {
  /** One-row sprite of evenly spaced frames. */
  src: string;
  /** Number of tiles in the row. */
  frames: number;
  /** Tile width / height. */
  aspect: number;
}

export interface CarClip {
  id: string;
  /** File-style name, as the product's timeline labels clips. */
  name: string;
  src: string;
  poster: string;
  filmstrip: Filmstrip;
  fps: number;
  frameCount: number;
  /** Source duration, seconds. */
  duration: number;
  width: number;
  height: number;
}

const CAR_FPS = 24;
const CAR_FRAMES = 122;

export const CAR_CLIPS: CarClip[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `car-${n}`,
  name: `car-${n}.mp4`,
  src: `/videos/portfolio/demos/cars/car-${n}.mp4`,
  poster: `/images/portfolio/demos/cars/car-${n}.jpg`,
  filmstrip: { src: `/images/portfolio/demos/cars/car-${n}-strip.jpg`, frames: 8, aspect: 160 / 108 },
  fps: CAR_FPS,
  frameCount: CAR_FRAMES,
  duration: CAR_FRAMES / CAR_FPS,
  width: 960,
  height: 642,
}));

/**
 * The generated shot between car-5 and car-6 (left out of the six), encoded
 * the same way: from the front wheel (car-5's last frame) round past the
 * headlamp to the grille badge (car-6's first frame).
 */
export const CAR_GRILLE: CarClip = {
  id: "car-grille",
  name: "car-grille.mp4",
  src: "/videos/portfolio/demos/cars/car-grille.mp4",
  poster: "/images/portfolio/demos/cars/car-grille.jpg",
  filmstrip: { src: "/images/portfolio/demos/cars/car-grille-strip.jpg", frames: 8, aspect: 160 / 108 },
  fps: CAR_FPS,
  frameCount: CAR_FRAMES,
  duration: CAR_FRAMES / CAR_FPS,
  width: 960,
  height: 642,
};

/** Filmstrip tile showing source time `t` of a clip `duration` seconds long. */
export function filmstripTileAt(strip: Filmstrip, t: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(strip.frames - 1, Math.max(0, Math.floor((t / duration) * strip.frames)));
}
