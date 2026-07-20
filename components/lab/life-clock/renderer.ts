// Three.js renderer for the Life Clock: two instanced-quad cell layers plus a
// line layer (frame, corner ticks, slot marker, crosshair, expectancy marker).
// Event markers render as DOM icons (marker-icons.tsx); the renderer keeps only
// their resolved cell ranges, to lift the hover span on the LIFE grid. Per-frame
// work is uniform updates and one small line-buffer rewrite. No React.

import * as THREE from "three";

import type {
  EventMarker,
  EventTone,
  LayerTransform,
  MorphFrame,
  Rect,
  ViewLayout,
} from "./types";
import { TOKENS, TONE_COLOR, VIEW_LIFE } from "./types";

const CELL_CAPACITY = 18_432;
const LINE_CAPACITY = 64; // segments
const COMMIT_FLASH_S = 0.3;

/**
 * Raw sRGB components. These shaders write gl_FragColor directly with no
 * output-encoding chunk, so colors must bypass three's conversion into the
 * linear working space — otherwise every token renders far darker than spec.
 */
function rawColor(hex: string): THREE.Color {
  return new THREE.Color().setHex(
    Number.parseInt(hex.slice(1), 16),
    THREE.NoColorSpace,
  );
}

// setClearColor round-trips through the renderer's output color space, so the
// background is the one color that stays a normally-managed THREE.Color.
const COLOR_BG = new THREE.Color(TOKENS.bg);
const COLOR_EMPTY = rawColor(TOKENS.cellEmpty);
const COLOR_EMPTY_OPEN = rawColor(TOKENS.cellEmptyOpen);
const COLOR_FILLED = rawColor(TOKENS.cellFilled);
const COLOR_LIVE = rawColor(TOKENS.live);
const COLOR_TEXT = rawColor(TOKENS.text);
const COLOR_EVENT = rawColor(TOKENS.event);

// Per-tone accent colours, resolved once (records warm, predictions cool,
// crossroads violet). Keyed by EventTone for O(1) marker + hover-range lookup.
const TONE_RGB: Record<EventTone, THREE.Color> = {
  record: rawColor(TONE_COLOR.record),
  predict: rawColor(TONE_COLOR.predict),
  crossroad: rawColor(TONE_COLOR.crossroad),
};

const HAIRLINE_A = 0.09;
const HAIRLINE_STRONG_A = 0.22;
const CROSSHAIR_A = 0.22;
const CROSSHAIR_TICK_A = 0.6;
const CORNER_TICK_PX = 10;
const CROSSHAIR_GAP_PX = 3;
const CROSSHAIR_FRAME_TICK_PX = 6;

const CELL_VERT = /* glsl */ `
  uniform vec2 uViewport;
  uniform vec2 uOffset;
  uniform vec2 uScale;
  uniform float uGap;
  attribute vec4 aRect;
  attribute float aCellIndex;
  attribute float aInSlot;
  attribute vec4 aPlaceTint;
  varying float vCellIndex;
  varying float vInSlot;
  varying float vLocalX;
  varying vec4 vPlace;
  void main() {
    vCellIndex = aCellIndex;
    vInSlot = aInSlot;
    vLocalX = position.x;
    vPlace = aPlaceTint;
    vec2 inner = max(aRect.zw - vec2(uGap), aRect.zw * 0.2);
    vec2 p = aRect.xy + (aRect.zw - inner) * 0.5 + position.xy * inner;
    vec2 screen = uOffset + uScale * p;
    gl_Position = vec4(
      screen.x / uViewport.x * 2.0 - 1.0,
      1.0 - screen.y / uViewport.y * 2.0,
      0.0,
      1.0
    );
  }
`;

const CELL_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uEmpty;
  uniform vec3 uFilled;
  uniform vec3 uLive;
  uniform float uLiveIndex;
  uniform float uLiveFrac;
  uniform float uPulse;
  uniform float uCommitAge;
  uniform float uLayerOpacity;
  uniform float uSlotOpacity;
  uniform vec3 uEvent;
  uniform float uRangeStart;
  uniform float uRangeEnd;
  uniform float uRangeAmount;
  uniform float uPlaceAmount;
  varying float vCellIndex;
  varying float vInSlot;
  varying float vLocalX;
  varying vec4 vPlace;

  float hash01(float i) {
    return fract(sin(i * 12.9898) * 43758.5453);
  }

  void main() {
    float d = vCellIndex - uLiveIndex;
    vec3 color;
    if (d < -0.5) {
      color = uFilled * (0.96 + 0.08 * hash01(vCellIndex));
      if (d > -1.5 && uCommitAge >= 0.0) {
        float t = clamp(uCommitAge / ${COMMIT_FLASH_S.toFixed(2)}, 0.0, 1.0);
        color = mix(uLive, color, 1.0 - pow(1.0 - t, 3.0));
      }
    } else if (d < 0.5) {
      color = vLocalX < uLiveFrac ? mix(uEmpty, uLive, uPulse) : uEmpty;
    } else {
      color = uEmpty;
    }
    // Places overlay: tint the cell toward its location band. A moderate mix
    // plus a small additive term so lived (bright) and unlived (dark) cells
    // both take the hue while staying distinguishable. Under the hover range.
    float pa = vPlace.a * clamp(uPlaceAmount, 0.0, 1.0);
    color = mix(color, vPlace.rgb, 0.30 * pa) + vPlace.rgb * 0.06 * pa;
    // Range highlight: accent lift, tint plus a small additive term so the dark
    // unlived cells rise as much as the bright lived ones.
    float inRange =
      step(uRangeStart - 0.5, vCellIndex) * step(vCellIndex, uRangeEnd + 0.5);
    float lift = inRange * uRangeAmount;
    color = mix(color, uEvent, 0.22 * lift) + uEvent * 0.07 * lift;
    float alpha = mix(uLayerOpacity, uSlotOpacity, vInSlot);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

const LINE_VERT = /* glsl */ `
  uniform vec2 uViewport;
  attribute vec4 aColor;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    gl_Position = vec4(
      position.x / uViewport.x * 2.0 - 1.0,
      1.0 - position.y / uViewport.y * 2.0,
      0.0,
      1.0
    );
  }
`;

const LINE_FRAG = /* glsl */ `
  precision highp float;
  varying vec4 vColor;
  void main() {
    if (vColor.a < 0.003) discard;
    gl_FragColor = vColor;
  }
`;

interface CellLayer {
  mesh: THREE.Mesh;
  geometry: THREE.InstancedBufferGeometry;
  material: THREE.ShaderMaterial;
  rects: THREE.InstancedBufferAttribute;
  indices: THREE.InstancedBufferAttribute;
  inSlot: THREE.InstancedBufferAttribute;
  /** Per-cell place-band tint (rgb + membership in .a); PLACES overlay. */
  placeTints: THREE.InstancedBufferAttribute;
  layout: ViewLayout | null;
}

function quadGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0],
      3,
    ),
  );
  g.setIndex([0, 2, 1, 2, 3, 1]);
  return g;
}

export class LifeClockRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private child: CellLayer;
  private parent: CellLayer;
  private lineMesh: THREE.LineSegments;
  private lineGeometry: THREE.BufferGeometry;
  private linePositions: THREE.BufferAttribute;
  private lineColors: THREE.BufferAttribute;
  private lineMaterial: THREE.ShaderMaterial;
  // Markers render as DOM icons; the renderer keeps only their resolved cell
  // ranges, so a hover can lift the matching span on the LIFE grid.
  private markerById = new Map<string, EventMarker>();
  // Per-cell place tint for the LIFE grid, index-aligned to the LIFE layout.
  // Owned by the caller (life-clock.tsx), replayed into whichever cell layer
  // currently holds LIFE on every setLayer / setLifePlaceTints.
  private lifePlaceTints: Float32Array | null = null;
  private quad = quadGeometry();
  private frameRect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private width = 1;
  private height = 1;
  private dpr = 1;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(COLOR_BG, 1);

    this.parent = this.makeCellLayer(0);
    this.child = this.makeCellLayer(1);

    this.lineGeometry = new THREE.BufferGeometry();
    this.linePositions = new THREE.BufferAttribute(
      new Float32Array(LINE_CAPACITY * 2 * 3),
      3,
    );
    this.lineColors = new THREE.BufferAttribute(
      new Float32Array(LINE_CAPACITY * 2 * 4),
      4,
    );
    this.linePositions.setUsage(THREE.DynamicDrawUsage);
    this.lineColors.setUsage(THREE.DynamicDrawUsage);
    this.lineGeometry.setAttribute("position", this.linePositions);
    this.lineGeometry.setAttribute("aColor", this.lineColors);
    this.lineMaterial = new THREE.ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: { uViewport: { value: new THREE.Vector2(1, 1) } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.lineMesh = new THREE.LineSegments(this.lineGeometry, this.lineMaterial);
    this.lineMesh.frustumCulled = false;
    this.lineMesh.renderOrder = 2;
    this.scene.add(this.lineMesh);
  }

  private makeCellLayer(renderOrder: number): CellLayer {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = this.quad.index;
    geometry.setAttribute("position", this.quad.getAttribute("position"));
    const rects = new THREE.InstancedBufferAttribute(
      new Float32Array(CELL_CAPACITY * 4),
      4,
    );
    const indices = new THREE.InstancedBufferAttribute(
      new Float32Array(CELL_CAPACITY),
      1,
    );
    const inSlot = new THREE.InstancedBufferAttribute(
      new Float32Array(CELL_CAPACITY),
      1,
    );
    const placeTints = new THREE.InstancedBufferAttribute(
      new Float32Array(CELL_CAPACITY * 4),
      4,
    );
    rects.setUsage(THREE.DynamicDrawUsage);
    indices.setUsage(THREE.DynamicDrawUsage);
    inSlot.setUsage(THREE.DynamicDrawUsage);
    placeTints.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aRect", rects);
    geometry.setAttribute("aCellIndex", indices);
    geometry.setAttribute("aInSlot", inSlot);
    geometry.setAttribute("aPlaceTint", placeTints);
    geometry.instanceCount = 0;

    const material = new THREE.ShaderMaterial({
      vertexShader: CELL_VERT,
      fragmentShader: CELL_FRAG,
      uniforms: {
        uViewport: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uScale: { value: new THREE.Vector2(1, 1) },
        uGap: { value: 1 },
        uEmpty: { value: COLOR_EMPTY },
        uFilled: { value: COLOR_FILLED },
        uLive: { value: COLOR_LIVE },
        uLiveIndex: { value: -1 },
        uLiveFrac: { value: 0 },
        uPulse: { value: 0.65 },
        uCommitAge: { value: -1 },
        uLayerOpacity: { value: 1 },
        uSlotOpacity: { value: 1 },
        uEvent: { value: COLOR_EVENT.clone() },
        uRangeStart: { value: -1 },
        uRangeEnd: { value: -1 },
        uRangeAmount: { value: 0 },
        uPlaceAmount: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = renderOrder;
    mesh.visible = false;
    this.scene.add(mesh);
    return {
      mesh,
      geometry,
      material,
      rects,
      indices,
      inSlot,
      placeTints,
      layout: null,
    };
  }

  setViewport(w: number, h: number, dpr: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    const vp = new THREE.Vector2(this.width, this.height);
    this.child.material.uniforms.uViewport.value = vp;
    this.parent.material.uniforms.uViewport.value = vp;
    this.lineMaterial.uniforms.uViewport.value = vp;
  }

  setFrameRect(rect: Rect): void {
    this.frameRect = rect;
  }

  /** Rebuild one layer's instance buffers from a layout (or hide it). */
  setLayer(slot: "child" | "parent", layout: ViewLayout | null): void {
    const layer = slot === "child" ? this.child : this.parent;
    layer.layout = layout;
    if (!layout) {
      layer.mesh.visible = false;
      layer.geometry.instanceCount = 0;
      return;
    }
    const n = Math.min(layout.cellCount, CELL_CAPACITY);
    const dpr = this.dpr;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    const rects = layer.rects.array as Float32Array;
    const indices = layer.indices.array as Float32Array;
    const inSlotArr = layer.inSlot.array as Float32Array;
    const slotRect = layout.slotRect;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const x = layout.cells[o];
      const y = layout.cells[o + 1];
      const x1 = snap(x + layout.cells[o + 2]);
      const y1 = snap(y + layout.cells[o + 3]);
      const xs = snap(x);
      const ys = snap(y);
      rects[o] = xs;
      rects[o + 1] = ys;
      rects[o + 2] = x1 - xs;
      rects[o + 3] = y1 - ys;
      indices[i] = i;
      if (slotRect) {
        const cx = x + layout.cells[o + 2] / 2;
        const cy = y + layout.cells[o + 3] / 2;
        inSlotArr[i] =
          cx >= slotRect.x &&
          cx <= slotRect.x + slotRect.w &&
          cy >= slotRect.y &&
          cy <= slotRect.y + slotRect.h
            ? 1
            : 0;
      } else {
        inSlotArr[i] = 0;
      }
    }
    layer.rects.needsUpdate = true;
    layer.indices.needsUpdate = true;
    layer.inSlot.needsUpdate = true;
    layer.geometry.instanceCount = n;
    this.applyPlaceTints(layer);

    // Gap: pitch/10, whole device pixels, min 1 device px; 0 when cells are
    // too small for a gap to read (boundaries carried by grain instead).
    const pitch = Math.min(layout.cellW, layout.cellH);
    let gap = 0;
    if (pitch * dpr >= 3) {
      gap = Math.max(1 / dpr, Math.round((pitch / 10) * dpr) / dpr);
    }
    layer.material.uniforms.uGap.value = gap;
    layer.material.uniforms.uEmpty.value =
      layout.view === VIEW_LIFE ? COLOR_EMPTY_OPEN : COLOR_EMPTY;
  }

  getLayerLayout(slot: "child" | "parent"): ViewLayout | null {
    return (slot === "child" ? this.child : this.parent).layout;
  }

  /**
   * Store the event markers' resolved cell ranges by id. The dots themselves
   * render as DOM icons; the renderer keeps this only so a hover can lift the
   * matching span (and tint it in the marker's own accent).
   */
  setEventMarkers(markers: EventMarker[]): void {
    this.markerById.clear();
    for (const m of markers) this.markerById.set(m.id, m);
  }

  /**
   * Store the per-cell LIFE place tint (rgb + membership, index-aligned to the
   * LIFE layout) and replay it into whichever cell layer currently holds LIFE.
   * null clears the overlay. The 0..1 fade is a separate per-frame uniform.
   */
  setLifePlaceTints(tints: Float32Array | null): void {
    this.lifePlaceTints = tints;
    if (this.child.layout?.view === VIEW_LIFE) this.applyPlaceTints(this.child);
    if (this.parent.layout?.view === VIEW_LIFE) this.applyPlaceTints(this.parent);
  }

  private applyPlaceTints(layer: CellLayer): void {
    const layout = layer.layout;
    const n = layout ? Math.min(layout.cellCount, CELL_CAPACITY) : 0;
    const arr = layer.placeTints.array as Float32Array;
    const tints = this.lifePlaceTints;
    if (layout && layout.view === VIEW_LIFE && tints && tints.length >= n * 4) {
      arr.set(tints.subarray(0, n * 4));
    } else if (n > 0) {
      arr.fill(0, 0, n * 4);
    }
    layer.placeTints.needsUpdate = true;
  }


  drawFrame(frame: MorphFrame): void {
    if (this.disposed) return;
    const cx = this.frameRect.x + this.frameRect.w / 2;
    const cy = this.frameRect.y + this.frameRect.h / 2;
    const rubber = frame.rubberScale;

    const ev = frame.events;
    let rangeStart = -1;
    let rangeEnd = -1;
    let rangeAmount = 0;
    // The hover range takes the hovered marker's own accent, so highlighting a
    // prediction glows azure, a record amber, a crossroad violet.
    let hoverColor = COLOR_EVENT;
    if (ev && ev.hoveredId) {
      const m = this.markerById.get(ev.hoveredId);
      if (m) hoverColor = TONE_RGB[m.tone];
      if (m && m.rangeStart >= 0 && m.rangeEnd >= m.rangeStart) {
        rangeStart = m.rangeStart;
        rangeEnd = m.rangeEnd;
        rangeAmount = Math.max(0, Math.min(1, ev.hoverAmount));
      }
    }
    const placesAmount = Math.max(0, Math.min(1, frame.placesAmount));

    const applyLayer = (
      layer: CellLayer,
      data: {
        transform: LayerTransform;
        opacity: number;
        live: { index: number; frac: number };
      } | null,
      slotOpacity: number | null,
    ): void => {
      if (!data || !layer.layout || layer.geometry.instanceCount === 0) {
        layer.mesh.visible = false;
        return;
      }
      layer.mesh.visible = data.opacity > 0.003 || (slotOpacity ?? 0) > 0.003;
      const u = layer.material.uniforms;
      // Rubber-band: uniform scale about the stage center.
      const sx = data.transform.scaleX * rubber;
      const sy = data.transform.scaleY * rubber;
      u.uScale.value.set(sx, sy);
      u.uOffset.value.set(
        cx * (1 - rubber) + rubber * data.transform.offsetX,
        cy * (1 - rubber) + rubber * data.transform.offsetY,
      );
      u.uLiveIndex.value = data.live.index;
      u.uLiveFrac.value = data.live.frac;
      u.uPulse.value = frame.pulseAlpha;
      u.uCommitAge.value = frame.reducedMotion ? -1 : frame.commitAge;
      u.uLayerOpacity.value = data.opacity;
      u.uSlotOpacity.value = slotOpacity ?? data.opacity;
      const isLife = layer.layout.view === VIEW_LIFE;
      u.uRangeStart.value = isLife ? rangeStart : -1;
      u.uRangeEnd.value = isLife ? rangeEnd : -1;
      u.uRangeAmount.value = isLife ? rangeAmount : 0;
      (u.uEvent.value as THREE.Color).copy(hoverColor);
      // Non-LIFE cells carry aPlaceTint.a = 0, so this is a no-op off the LIFE
      // grid — safe to set unconditionally.
      u.uPlaceAmount.value = placesAmount;
    };

    applyLayer(this.child, frame.child, null);
    applyLayer(
      this.parent,
      frame.parent,
      frame.parent ? frame.parent.slotInteriorOpacity : null,
    );

    this.writeLines(frame, rubber, cx, cy);
    this.renderer.render(this.scene, this.camera);
  }

  // -- line layer ------------------------------------------------------------

  private lineCount = 0;

  private pushLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: THREE.Color,
    alpha: number,
  ): void {
    if (this.lineCount >= LINE_CAPACITY || alpha <= 0.003) return;
    const i = this.lineCount * 2;
    const pos = this.linePositions.array as Float32Array;
    const col = this.lineColors.array as Float32Array;
    pos[i * 3] = x0;
    pos[i * 3 + 1] = y0;
    pos[i * 3 + 2] = 0;
    pos[i * 3 + 3] = x1;
    pos[i * 3 + 4] = y1;
    pos[i * 3 + 5] = 0;
    for (let v = 0; v < 2; v++) {
      col[(i + v) * 4] = color.r;
      col[(i + v) * 4 + 1] = color.g;
      col[(i + v) * 4 + 2] = color.b;
      col[(i + v) * 4 + 3] = alpha;
    }
    this.lineCount++;
  }

  private pushRect(r: Rect, color: THREE.Color, alpha: number): void {
    this.pushLine(r.x, r.y, r.x + r.w, r.y, color, alpha);
    this.pushLine(r.x + r.w, r.y, r.x + r.w, r.y + r.h, color, alpha);
    this.pushLine(r.x + r.w, r.y + r.h, r.x, r.y + r.h, color, alpha);
    this.pushLine(r.x, r.y + r.h, r.x, r.y, color, alpha);
  }

  private transformedRect(t: LayerTransform, r: Rect, rubber: number, cx: number, cy: number): Rect {
    const sx = t.scaleX * rubber;
    const sy = t.scaleY * rubber;
    const ox = cx * (1 - rubber) + rubber * t.offsetX;
    const oy = cy * (1 - rubber) + rubber * t.offsetY;
    return { x: ox + sx * r.x, y: oy + sy * r.y, w: sx * r.w, h: sy * r.h };
  }

  private writeLines(
    frame: MorphFrame,
    rubber: number,
    cx: number,
    cy: number,
  ): void {
    this.lineCount = 0;
    const f = this.frameRect;

    // Stage frame + registration corner ticks.
    this.pushRect(f, COLOR_TEXT, HAIRLINE_A);
    const t = CORNER_TICK_PX;
    const corners: [number, number, number, number][] = [
      [f.x, f.y, 1, 1],
      [f.x + f.w, f.y, -1, 1],
      [f.x, f.y + f.h, 1, -1],
      [f.x + f.w, f.y + f.h, -1, -1],
    ];
    for (const [px, py, dx, dy] of corners) {
      this.pushLine(px, py, px + dx * t, py, COLOR_TEXT, HAIRLINE_STRONG_A);
      this.pushLine(px, py, px, py + dy * t, COLOR_TEXT, HAIRLINE_STRONG_A);
    }

    // Slot geometry. During a morph the outline tracks the parent transform;
    // at rest the active layer's own slotRect is the standing marker.
    if (frame.parent && this.parent.layout?.slotRect) {
      const r = this.transformedRect(
        frame.parent.transform,
        this.parent.layout.slotRect,
        rubber,
        cx,
        cy,
      );
      this.pushRect(r, COLOR_TEXT, frame.slotOutlineOpacity * 0.6);
    } else if (frame.child && this.child.layout?.slotRect) {
      const r = this.transformedRect(
        frame.child.transform,
        this.child.layout.slotRect,
        rubber,
        cx,
        cy,
      );
      this.pushRect(r, COLOR_TEXT, HAIRLINE_STRONG_A * frame.child.opacity);
    }

    // Crosshair through the live cell of the dominant layer.
    const childDominant =
      frame.child && (!frame.parent || frame.child.opacity >= 0.5);
    const dom = childDominant ? frame.child : frame.parent;
    const domLayer = childDominant ? this.child : this.parent;
    if (dom && domLayer.layout && dom.opacity > 0.05 && dom.live.index >= 0) {
      const cell = this.transformedRect(
        dom.transform,
        domLayer.layout.cellRect(dom.live.index),
        rubber,
        cx,
        cy,
      );
      const mx = cell.x + cell.w / 2;
      const my = cell.y + cell.h / 2;
      const g = CROSSHAIR_GAP_PX;
      const a = CROSSHAIR_A * dom.opacity;
      if (my > f.y && my < f.y + f.h) {
        this.pushLine(f.x, my, Math.max(f.x, cell.x - g), my, COLOR_LIVE, a);
        this.pushLine(
          Math.min(f.x + f.w, cell.x + cell.w + g),
          my,
          f.x + f.w,
          my,
          COLOR_LIVE,
          a,
        );
        const ft = CROSSHAIR_FRAME_TICK_PX;
        const ta = CROSSHAIR_TICK_A * dom.opacity;
        this.pushLine(f.x, my, f.x + ft, my, COLOR_LIVE, ta);
        this.pushLine(f.x + f.w - ft, my, f.x + f.w, my, COLOR_LIVE, ta);
      }
      if (mx > f.x && mx < f.x + f.w) {
        this.pushLine(mx, f.y, mx, Math.max(f.y, cell.y - g), COLOR_LIVE, a);
        this.pushLine(
          mx,
          Math.min(f.y + f.h, cell.y + cell.h + g),
          mx,
          f.y + f.h,
          COLOR_LIVE,
          a,
        );
        const ft = CROSSHAIR_FRAME_TICK_PX;
        const ta = CROSSHAIR_TICK_A * dom.opacity;
        this.pushLine(mx, f.y, mx, f.y + ft, COLOR_LIVE, ta);
        this.pushLine(mx, f.y + f.h - ft, mx, f.y + f.h, COLOR_LIVE, ta);
      }
    }

    // Expectancy marker: end-of-range graduation on any visible LIFE layer.
    for (const [layer, data] of [
      [this.child, frame.child],
      [this.parent, frame.parent],
    ] as const) {
      if (
        data &&
        layer.layout &&
        layer.layout.view === VIEW_LIFE &&
        layer.layout.expectancyIndex >= 0 &&
        data.opacity > 0.05
      ) {
        const r = this.transformedRect(
          data.transform,
          layer.layout.cellRect(layer.layout.expectancyIndex),
          rubber,
          cx,
          cy,
        );
        this.pushRect(r, COLOR_TEXT, 0.9 * data.opacity);
      }
    }

    this.linePositions.needsUpdate = true;
    this.lineColors.needsUpdate = true;
    this.lineGeometry.setDrawRange(0, this.lineCount * 2);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.child.geometry.dispose();
    this.child.material.dispose();
    this.parent.geometry.dispose();
    this.parent.material.dispose();
    this.lineGeometry.dispose();
    this.lineMaterial.dispose();
    this.quad.dispose();
    this.renderer.dispose();
  }
}
