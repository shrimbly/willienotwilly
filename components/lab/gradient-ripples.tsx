"use client";

import * as THREE from "three";
import { EyeOff, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_COLORS = ["#33673B", "#69B574", "#ADD7B4", "#F1F8F2", "#F5F5F5"];
const COLOR_PALETTES = {
  sage: {
    label: "Sage",
    colors: DEFAULT_COLORS,
  },
  chrome: {
    label: "Chrome",
    colors: ["#07080B", "#394351", "#A8B0B5", "#D9DDD8", "#F6F7F4"],
  },
} as const;

type PaletteId = keyof typeof COLOR_PALETTES;

const VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColors[5];
uniform float uNoiseIntensity;
uniform float uNoiseStyle;
uniform float uRipple;
uniform float uDepth;
uniform float uSpeed;
uniform float uThickness;
uniform float uSpeedField;
uniform float uRippleCount;
uniform float uChromatic;
uniform float uNestedMode;
uniform vec4 uClickRipples[6];

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 rotate = mat2(0.82, -0.57, 0.57, 0.82);

  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = rotate * p * 2.03 + 13.7;
    amplitude *= 0.52;
  }

  return value;
}

vec3 palette(float t) {
  t = clamp(t, 0.0, 0.999);
  float scaled = t * 4.0;
  int index = int(floor(scaled));
  float blend = smoothstep(0.08, 0.92, fract(scaled));

  if (index == 0) return mix(uColors[0], uColors[1], blend);
  if (index == 1) return mix(uColors[1], uColors[2], blend);
  if (index == 2) return mix(uColors[2], uColors[3], blend);
  return mix(uColors[3], uColors[4], blend);
}

float roundedRectSDF(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + vec2(radius);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec2 roundedRectNormal(vec2 p, vec2 halfSize, float radius) {
  vec2 eps = vec2(1.0 / max(min(uResolution.x, uResolution.y), 1.0));
  float dx = roundedRectSDF(p + vec2(eps.x, 0.0), halfSize, radius) -
    roundedRectSDF(p - vec2(eps.x, 0.0), halfSize, radius);
  float dy = roundedRectSDF(p + vec2(0.0, eps.y), halfSize, radius) -
    roundedRectSDF(p - vec2(0.0, eps.y), halfSize, radius);
  vec2 normal = vec2(dx, dy);

  if (length(normal) < 0.0001) {
    return vec2(0.0, 1.0);
  }

  return normalize(normal);
}

vec2 randomCenter(float seed) {
  return vec2(
    mix(-0.82, 0.82, hash(vec2(seed, seed + 19.7))),
    mix(-0.62, 0.62, hash(vec2(seed + 41.2, seed + 3.4)))
  );
}

float surfaceRidge(vec2 p) {
  float fieldTime = uTime * 0.12 * mix(0.4, 1.35, clamp(uSpeedField, 0.0, 1.8));
  float curve =
    0.18 * sin(p.x * 2.1 - 0.5 + fieldTime) +
    0.1 * sin(p.x * 4.8 + 1.4 - fieldTime * 0.73) +
    0.045 * sin((p.x + p.y) * 6.2 + fieldTime * 1.18);
  float ridgeDistance = abs(p.y - curve);
  float ridgeWidth = mix(0.3, 0.18, 0.5 + 0.5 * sin(fieldTime * 0.83));
  float ridge = 1.0 - smoothstep(0.018, ridgeWidth, ridgeDistance);
  float shoulder = 1.0 - smoothstep(0.1, ridgeWidth + 0.32, ridgeDistance);

  return clamp(ridge * 0.72 + shoulder * 0.28, 0.0, 1.0);
}

float surfaceSpeed(vec2 p) {
  float ridge = surfaceRidge(p);
  float sideBias = smoothstep(-0.24, 0.36, p.y - p.x * 0.1);
  float shapedField = clamp(uSpeedField, 0.0, 1.8);
  float ridgeSpeed = mix(1.0, 1.78, ridge) * mix(1.0, 1.18, sideBias);
  float slowPocket = mix(1.0, 0.56, 1.0 - ridge) * mix(1.0, 0.84, 1.0 - sideBias);

  return mix(1.0, ridgeSpeed * slowPocket, shapedField);
}

vec2 viscousWave(vec2 p, float seed, float offset, float cycle, float baseRate, float width) {
  float clock = uTime * uSpeed + offset;
  float generation = floor(clock / cycle);
  float age = mod(clock, cycle);
  float seeded = seed + generation * 23.71;
  float localSpeed = surfaceSpeed(p);
  float ridge = surfaceRidge(p);
  float radius = age * baseRate * mix(0.68, 1.36, hash(vec2(seeded, 9.4))) * localSpeed;
  float envelope = smoothstep(0.0, cycle * 0.16, age) * (1.0 - smoothstep(cycle * 0.66, cycle, age));
  vec2 center = randomCenter(seeded);
  vec2 stretch = vec2(
    mix(0.68, 1.58, hash(vec2(seeded + 2.0, 11.7))),
    mix(0.68, 1.72, hash(vec2(seeded + 8.0, 17.3)))
  );
  float spin = mix(-0.85, 0.85, hash(vec2(seeded + 4.0, 31.6)));
  mat2 rotate = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
  float drift = fbm(p * 1.7 + center * 2.0 + age * 0.015 * localSpeed);
  vec2 pulled = p - center;
  pulled += 0.08 * vec2(
    fbm(p * 2.1 + age * 0.025 * localSpeed),
    fbm(p * 1.8 - age * 0.018 * localSpeed)
  );
  pulled += ridge * 0.035 * vec2(sin(p.y * 8.0 + seeded), cos(p.x * 7.0 - seeded));

  float distanceField = length((rotate * pulled) * stretch) + (drift - 0.5) * 0.16;
  float thickWidth = width * uThickness;
  float ring = 1.0 - smoothstep(thickWidth * 0.75, thickWidth * 2.7, abs(distanceField - radius));
  float interiorDistance = max(radius - distanceField, 0.0);
  float wake = smoothstep(0.0, thickWidth * 4.8, interiorDistance);
  wake *= 1.0 - smoothstep(max(radius * 0.24, thickWidth * 3.2), max(radius * 1.12, thickWidth * 5.2), interiorDistance);
  wake *= 1.0 - smoothstep(cycle * 0.48, cycle * 0.88, age);
  wake *= 0.82 + 0.18 * fbm(p * 2.1 + vec2(seeded));

  return vec2(ring * envelope, wake * envelope);
}

vec2 nestedWaveFamily(vec2 p, float seed, float offset, float cycle, float baseRate, float width) {
  vec2 outer = viscousWave(p, seed, offset, cycle, baseRate, width);
  vec2 middle = viscousWave(p, seed, offset + cycle * 0.12, cycle, baseRate * 0.98, width * 0.72);
  vec2 inner = viscousWave(p, seed, offset + cycle * 0.24, cycle, baseRate * 0.96, width * 0.5);

  return outer + middle * 0.62 + inner * 0.36;
}

vec2 clickWave(vec2 p, vec4 ripple) {
  float age = max(uTime - ripple.z, 0.0);
  float alive = step(0.0, ripple.z) * (1.0 - smoothstep(3.2, 5.4, age));
  float localSpeed = surfaceSpeed(p);
  float seeded = ripple.w;
  float baseWidth = mix(0.11, 0.18, hash(vec2(seeded, 14.6))) * uThickness;
  float radius = age * uSpeed * mix(0.032, 0.052, hash(vec2(seeded + 5.0, 38.2))) * localSpeed;
  float drift = fbm(p * 1.9 + vec2(seeded) + age * 0.02);
  vec2 pulled = p - ripple.xy;
  pulled += 0.05 * vec2(
    fbm(p * 2.4 + age * 0.03 + seeded),
    fbm(p * 2.0 - age * 0.025 + seeded)
  );
  float distanceField = length(pulled) + (drift - 0.5) * 0.12;
  float ring = 1.0 - smoothstep(baseWidth * 0.55, baseWidth * 2.5, abs(distanceField - radius));
  float interiorDistance = max(radius - distanceField, 0.0);
  float wake = smoothstep(0.0, baseWidth * 3.2, interiorDistance);
  wake *= 1.0 - smoothstep(max(radius * 0.26, baseWidth * 2.4), max(radius * 1.08, baseWidth * 4.2), interiorDistance);

  return vec2(ring, wake) * alive;
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  p.x *= uResolution.x / max(uResolution.y, 1.0);

  float t = uTime * uSpeed;
  float ridge = surfaceRidge(p);
  float localSpeed = surfaceSpeed(p);
  float localT = t * localSpeed;

  float low = fbm(p * 0.95 + vec2(localT * 0.018, -localT * 0.014));
  float mid = fbm(p * 2.0 + vec2(-localT * 0.026, localT * 0.018));
  float pull = fbm(p * 3.4 + vec2(low, mid) * 0.38 + localT * 0.012);

  vec2 waveA = mix(
    viscousWave(p, 11.2, 0.0, 28.0, 0.046, 0.16),
    nestedWaveFamily(p, 11.2, 0.0, 34.0, 0.037, 0.18),
    uNestedMode
  );
  vec2 waveB = mix(
    viscousWave(p, 47.8, 14.0, 36.0, 0.038, 0.2),
    nestedWaveFamily(p, 47.8, 17.0, 43.0, 0.032, 0.22),
    uNestedMode
  );
  vec2 waveC = viscousWave(p, 93.4, 22.0, 42.0, 0.033, 0.18) * (1.0 - uNestedMode);
  vec2 waveD = viscousWave(p, 129.6, 31.0, 46.0, 0.03, 0.22) * (1.0 - uNestedMode);
  float cWeight = smoothstep(2.0, 3.0, uRippleCount);
  float dWeight = smoothstep(3.0, 4.0, uRippleCount);
  float waves = waveA.x + waveB.x + waveC.x * cWeight + waveD.x * dWeight;
  float wake = waveA.y + waveB.y + waveC.y * cWeight + waveD.y * dWeight;

  for (int i = 0; i < 6; i++) {
    vec2 clicked = clickWave(p, uClickRipples[i]);
    waves += clicked.x;
    wake += clicked.y;
  }

  float depth = 0.84;
  depth += (low - 0.5) * 0.12;
  depth += (mid - 0.5) * 0.08;
  depth += (pull - 0.5) * 0.14 * uDepth;
  depth -= ridge * 0.04 * uDepth;
  depth += wake * 0.18 * uDepth;
  depth -= waves * 0.42 * uRipple;
  depth = smoothstep(0.18, 1.0, depth);

  vec3 baseGradient = mix(uColors[4], uColors[3], smoothstep(-0.2, 1.05, uv.y + low * 0.24));
  baseGradient = mix(baseGradient, uColors[2], smoothstep(0.15, 1.12, uv.x + mid * 0.18) * 0.26);
  vec3 color = mix(baseGradient, palette(depth), 0.74);

  float meniscus = smoothstep(0.18, 0.82, waves) * (1.0 - smoothstep(0.72, 1.0, waves));
  color = mix(color, palette(clamp(depth - 0.18, 0.0, 1.0)), meniscus * 0.36);

  float edgeMask = smoothstep(0.06, 0.62, waves) * (1.0 - smoothstep(0.58, 1.0, waves));
  float organicSplit = fbm(p * 3.1 + vec2(low, mid) * 0.8 + uTime * 0.018);
  float edgeAberration = edgeMask * (0.72 + 0.28 * organicSplit) * uChromatic;
  float depthSplit = 0.045 * edgeAberration;
  vec3 redShift = mix(baseGradient, palette(clamp(depth - depthSplit, 0.0, 1.0)), 0.74);
  vec3 blueShift = mix(baseGradient, palette(clamp(depth + depthSplit, 0.0, 1.0)), 0.74);
  vec3 refracted = vec3(redShift.r, color.g, blueShift.b);
  float fringeDrift = 0.5 + 0.5 * sin(
    p.x * 2.4 - p.y * 1.7 + organicSplit * 6.283 + uTime * 0.045
  );
  vec3 warmFringe = vec3(0.018, -0.002, -0.014);
  vec3 coolFringe = vec3(-0.012, 0.001, 0.018);
  color = mix(color, refracted, min(edgeAberration * 0.72, 0.82));
  color += mix(coolFringe, warmFringe, fringeDrift) * edgeAberration * 0.42;

  float minResolution = max(min(uResolution.x, uResolution.y), 1.0);
  vec2 glassP = (uv - 0.5) * uResolution / minResolution;
  vec2 glassHalfSize = uResolution / minResolution * 0.5;
  float glassRadius = 0.055;
  float glassSDF = roundedRectSDF(glassP, glassHalfSize, glassRadius);
  float edgeDistance = max(-glassSDF, 0.0);
  vec2 edgeNormal = roundedRectNormal(glassP, glassHalfSize, glassRadius);

  float glassEdge = smoothstep(0.24, 0.0, edgeDistance);
  float glassBevel = pow(1.0 - smoothstep(0.0, 0.15, edgeDistance), 1.05);
  float roundedRim = 1.0 - smoothstep(0.012, 0.086, abs(edgeDistance - 0.04));
  float innerRim = 1.0 - smoothstep(0.0, 0.16, abs(edgeDistance - 0.115));
  float liquidWarp = fbm(p * 5.0 + edgeNormal * 1.7 + uTime * 0.03);
  float lensAmount = glassEdge * 0.026 + glassBevel * (0.13 + liquidWarp * 0.075);
  vec2 edgeTangent = vec2(-edgeNormal.y, edgeNormal.x);
  vec2 glassWarpP = p - edgeNormal * lensAmount;
  glassWarpP += edgeTangent * (liquidWarp - 0.5) * glassBevel * 0.16;
  vec2 glassWarpUv = vec2(glassWarpP.x / (uResolution.x / max(uResolution.y, 1.0)), glassWarpP.y) + 0.5;
  float warpedLow = fbm(glassWarpP * 0.95 + vec2(localT * 0.018, -localT * 0.014));
  float warpedMid = fbm(glassWarpP * 2.0 + vec2(-localT * 0.026, localT * 0.018));
  float warpedPull = fbm(glassWarpP * 3.4 + vec2(warpedLow, warpedMid) * 0.38 + localT * 0.012);
  float edgeDepth = 0.84;
  edgeDepth += (warpedLow - 0.5) * 0.12;
  edgeDepth += (warpedMid - 0.5) * 0.08;
  edgeDepth += (warpedPull - 0.5) * 0.14 * uDepth;
  edgeDepth -= surfaceRidge(glassWarpP) * 0.04 * uDepth;
  edgeDepth += wake * 0.18 * uDepth;
  edgeDepth -= waves * 0.42 * uRipple;
  edgeDepth = smoothstep(0.18, 1.0, edgeDepth);
  edgeDepth += lensAmount * dot(edgeNormal, normalize(vec2(0.7, -0.45)));
  edgeDepth -= innerRim * 0.035;
  vec3 edgeBaseGradient = mix(uColors[4], uColors[3], smoothstep(-0.2, 1.05, glassWarpUv.y + warpedLow * 0.24));
  edgeBaseGradient = mix(edgeBaseGradient, uColors[2], smoothstep(0.15, 1.12, glassWarpUv.x + warpedMid * 0.18) * 0.26);
  vec3 edgeRefraction = mix(
    edgeBaseGradient,
    palette(clamp(edgeDepth, 0.0, 1.0)),
    0.82
  );
  vec3 edgeShadow = vec3(0.02, 0.04, 0.045) * glassBevel * 0.11;
  float edgeChromatic = glassBevel * (0.36 + roundedRim * 0.64) * uChromatic;
  edgeRefraction.r += edgeChromatic * 0.022;
  edgeRefraction.b += edgeChromatic * 0.017;
  edgeRefraction.g -= edgeChromatic * 0.005;
  float glassMix = max(glassEdge * 0.28, glassBevel * 0.78);
  color = mix(color, edgeRefraction - edgeShadow, glassMix);

  float grain = hash(gl_FragCoord.xy);
  float fine = hash(gl_FragCoord.xy * 1.37 + 8.4);
  float soft = noise(gl_FragCoord.xy * 0.42);
  float speckle = smoothstep(0.74, 1.0, hash(gl_FragCoord.xy * 0.83 + vec2(71.2)));
  float film = mix(grain, soft, smoothstep(0.5, 1.5, uNoiseStyle));
  film = mix(film, max(fine, speckle), smoothstep(1.5, 2.0, uNoiseStyle));
  color += (film - 0.5) * uNoiseIntensity;
  color *= 1.0 - soft * uNoiseIntensity * 0.12;

  float vignette = smoothstep(1.08, 0.18, length(p));
  color = mix(color * 0.94, color, vignette);

  gl_FragColor = vec4(color, 1.0);
}
`;

function hexToVector(hex: string) {
  return new THREE.Color(hex);
}

function getColorArray(colors: string[]) {
  return colors.map((color) => hexToVector(color));
}

type GradientVariant = "v1" | "v2";

const VARIANT_DEFAULTS = {
  v1: {
    ripple: 0.25,
    depth: 0.06,
    speed: 1.27,
    thickness: 0.42,
    speedField: 0.6,
    rippleCount: 4,
    chromatic: 1,
    nestedMode: 0,
    title: "Chromatic field",
  },
  v2: {
    ripple: 0.36,
    depth: 0.08,
    speed: 1.08,
    thickness: 0.5,
    speedField: 0.52,
    rippleCount: 2,
    chromatic: 1.15,
    nestedMode: 1,
    title: "Chromatic field v2",
  },
} satisfies Record<
  GradientVariant,
  {
    ripple: number;
    depth: number;
    speed: number;
    thickness: number;
    speedField: number;
    rippleCount: number;
    chromatic: number;
    nestedMode: number;
    title: string;
  }
>;

export function GradientRipplesLab({
  variant = "v1",
}: {
  variant?: GradientVariant;
}) {
  const defaults = VARIANT_DEFAULTS[variant];
  const mountRef = useRef<HTMLDivElement | null>(null);
  const uniformsRef = useRef<{
    uColors: { value: THREE.Color[] };
    uNoiseIntensity: { value: number };
    uNoiseStyle: { value: number };
    uRipple: { value: number };
    uDepth: { value: number };
    uSpeed: { value: number };
    uThickness: { value: number };
    uSpeedField: { value: number };
    uRippleCount: { value: number };
    uChromatic: { value: number };
    uNestedMode: { value: number };
    uClickRipples: { value: THREE.Vector4[] };
  } | null>(null);

  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [activePalette, setActivePalette] = useState<PaletteId | "custom">(
    "sage",
  );
  const [noiseIntensity, setNoiseIntensity] = useState(0.06);
  const [noiseStyle, setNoiseStyle] = useState(0);
  const [ripple, setRipple] = useState(defaults.ripple);
  const [depth, setDepth] = useState(defaults.depth);
  const [speed, setSpeed] = useState(defaults.speed);
  const [thickness, setThickness] = useState(defaults.thickness);
  const [speedField, setSpeedField] = useState(defaults.speedField);
  const [rippleCount, setRippleCount] = useState(defaults.rippleCount);
  const [chromatic, setChromatic] = useState(defaults.chromatic);
  const [controlsHidden, setControlsHidden] = useState(false);

  const colorVectors = useMemo(() => getColorArray(colors), [colors]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf5f5f5, 1);
    mount.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    const clickRipples = Array.from(
      { length: 6 },
      () => new THREE.Vector4(0, 0, -100, 0),
    );
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColors: { value: getColorArray(DEFAULT_COLORS) },
      uNoiseIntensity: { value: 0.06 },
      uNoiseStyle: { value: 0 },
      uRipple: { value: defaults.ripple },
      uDepth: { value: defaults.depth },
      uSpeed: { value: defaults.speed },
      uThickness: { value: defaults.thickness },
      uSpeedField: { value: defaults.speedField },
      uRippleCount: { value: defaults.rippleCount },
      uChromatic: { value: defaults.chromatic },
      uNestedMode: { value: defaults.nestedMode },
      uClickRipples: { value: clickRipples },
    };
    uniformsRef.current = uniforms;

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight, false);
      uniforms.uResolution.value.set(
        clientWidth * renderer.getPixelRatio(),
        clientHeight * renderer.getPixelRatio(),
      );
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationFrame = 0;
    const startedAt = performance.now();
    let clickRippleIndex = 0;
    const addClickRipple = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const rect = mount.getBoundingClientRect();
      const aspect = rect.width / Math.max(rect.height, 1);
      const x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * aspect;
      const y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      clickRipples[clickRippleIndex].set(
        x,
        y,
        uniforms.uTime.value,
        performance.now() * 0.001 + clickRippleIndex * 19.17,
      );
      clickRippleIndex = (clickRippleIndex + 1) % clickRipples.length;
    };
    mount.addEventListener("pointerdown", addClickRipple);

    const render = () => {
      uniforms.uTime.value = (performance.now() - startedAt) / 1000;
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", addClickRipple);
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      uniformsRef.current = null;
    };
  }, [defaults]);

  useEffect(() => {
    if (!uniformsRef.current) return;
    uniformsRef.current.uColors.value = colorVectors;
  }, [colorVectors]);

  useEffect(() => {
    if (!uniformsRef.current) return;
    uniformsRef.current.uNoiseIntensity.value = noiseIntensity;
    uniformsRef.current.uNoiseStyle.value = noiseStyle;
    uniformsRef.current.uRipple.value = ripple;
    uniformsRef.current.uDepth.value = depth;
    uniformsRef.current.uSpeed.value = speed;
    uniformsRef.current.uThickness.value = thickness;
    uniformsRef.current.uSpeedField.value = speedField;
    uniformsRef.current.uRippleCount.value = rippleCount;
    uniformsRef.current.uChromatic.value = chromatic;
    uniformsRef.current.uNestedMode.value = defaults.nestedMode;
  }, [
    chromatic,
    defaults.nestedMode,
    depth,
    noiseIntensity,
    noiseStyle,
    ripple,
    rippleCount,
    speed,
    speedField,
    thickness,
  ]);

  const reset = () => {
    const palette =
      activePalette === "custom" ? COLOR_PALETTES.sage : COLOR_PALETTES[activePalette];
    setColors([...palette.colors]);
    setNoiseIntensity(0.06);
    setNoiseStyle(0);
    setRipple(defaults.ripple);
    setDepth(defaults.depth);
    setSpeed(defaults.speed);
    setThickness(defaults.thickness);
    setSpeedField(defaults.speedField);
    setRippleCount(defaults.rippleCount);
    setChromatic(defaults.chromatic);
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#f5f5f5] text-[#102214]">
      <div className="absolute inset-2 overflow-hidden rounded-[1.75rem] bg-[#f5f5f5] sm:inset-3 sm:rounded-[2.25rem]">
        <div ref={mountRef} className="absolute inset-0" />
        <LiquidGlassEdges />
      </div>

      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex justify-center px-5 pt-5 sm:inset-x-3 sm:top-3 sm:justify-start sm:px-7">
        <div className="max-w-[22rem]">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-[#102214]/65">
            Lab / gradient animation
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-[#102214] sm:text-5xl">
            {defaults.title}
          </h1>
        </div>
      </div>

      {controlsHidden ? (
        <button
          type="button"
          onClick={() => setControlsHidden(false)}
          className="absolute bottom-5 left-5 z-20 grid size-11 place-items-center rounded-full border border-white/45 bg-white/58 text-[#102214] shadow-2xl shadow-[#102214]/15 backdrop-blur-xl transition hover:bg-white/75 sm:bottom-8 sm:left-8"
          aria-label="Show gradient controls"
        >
          <SlidersHorizontal size={17} strokeWidth={2} />
        </button>
      ) : (
        <section
          aria-label="Gradient controls"
          className="absolute inset-x-5 bottom-5 z-20 rounded-lg border border-white/45 bg-white/58 p-3 text-[#102214] shadow-2xl shadow-[#102214]/15 backdrop-blur-xl sm:inset-x-auto sm:bottom-8 sm:left-8 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Custom palette
              </h2>
              <p className="mt-0.5 text-xs text-[#102214]/60">
                Static grain, slow viscous depth waves.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setControlsHidden(true)}
                className="grid size-9 place-items-center rounded-full border border-[#102214]/15 bg-white/40 text-[#102214] transition hover:bg-white/75"
                aria-label="Hide gradient controls"
              >
                <EyeOff size={15} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={reset}
                className="grid size-9 place-items-center rounded-full border border-[#102214]/15 bg-white/40 text-[#102214] transition hover:bg-white/75"
                aria-label="Reset gradient controls"
              >
                <RotateCcw size={15} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {colors.map((color, index) => (
              <label
                key={`${index}-${color}`}
                className="group relative block aspect-square overflow-hidden rounded-md border border-[#102214]/15 shadow-inner"
                style={{ backgroundColor: color }}
                aria-label={`Color ${index + 1}`}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(event) => {
                    const next = [...colors];
                    next[index] = event.target.value;
                    setActivePalette("custom");
                    setColors(next);
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/35 py-1 text-center font-mono text-[0.55rem] uppercase leading-none text-white opacity-0 transition group-hover:opacity-100">
                  {index + 1}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(Object.keys(COLOR_PALETTES) as PaletteId[]).map((paletteId) => (
              <button
                key={paletteId}
                type="button"
                onClick={() => {
                  setActivePalette(paletteId);
                  setColors([...COLOR_PALETTES[paletteId].colors]);
                }}
                className={[
                  "rounded-md border px-3 py-2 text-xs font-medium transition",
                  activePalette === paletteId
                    ? "border-[#102214]/35 bg-[#102214] text-white"
                    : "border-[#102214]/15 bg-white/35 text-[#102214]/75 hover:bg-white/65",
                ].join(" ")}
              >
                {COLOR_PALETTES[paletteId].label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            <Control
              label="Grain"
              value={noiseIntensity}
              min={0}
              max={0.34}
              step={0.01}
              onChange={setNoiseIntensity}
            />
            <Control
              label="Texture"
              value={noiseStyle}
              min={0}
              max={2}
              step={1}
              onChange={setNoiseStyle}
              formatValue={(value) =>
                ["film", "soft", "grit"][value] ?? "film"
              }
            />
            <Control
              label="Ripple"
              value={ripple}
              min={0}
              max={1.4}
              step={0.01}
              onChange={setRipple}
            />
            <Control
              label="Count"
              value={rippleCount}
              min={variant === "v2" ? 1 : 2}
              max={4}
              step={1}
              onChange={setRippleCount}
              formatValue={(value) => value.toFixed(0)}
            />
            <Control
              label="Thickness"
              value={thickness}
              min={0.25}
              max={2.4}
              step={0.01}
              onChange={setThickness}
            />
            <Control
              label="Depth"
              value={depth}
              min={0.05}
              max={1.3}
              step={0.01}
              onChange={setDepth}
            />
            <Control
              label="Chromatic"
              value={chromatic}
              min={0}
              max={2.5}
              step={0.01}
              onChange={setChromatic}
            />
            <Control
              label="Travel"
              value={speed}
              min={0.12}
              max={2.4}
              step={0.01}
              onChange={setSpeed}
            />
            <Control
              label="Speed field"
              value={speedField}
              min={0}
              max={1.8}
              step={0.01}
              onChange={setSpeedField}
            />
          </div>
        </section>
      )}
    </main>
  );
}

function LiquidGlassEdges() {
  const glassStyle = {
    backdropFilter: "blur(28px) saturate(1.45) contrast(1.08)",
    WebkitBackdropFilter:
      "blur(28px) saturate(1.45) contrast(1.08)",
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
    >
      <div
        className="absolute inset-x-0 top-0 h-60 opacity-[0.92]"
        style={{
          ...glassStyle,
          background:
            "linear-gradient(to bottom, rgba(18,36,28,0.16), rgba(255,255,255,0.12) 40%, rgba(170,205,213,0.08) 66%, rgba(255,255,255,0))",
          boxShadow:
            "inset 0 -72px 120px rgba(255,255,255,0.12), inset 0 -18px 54px rgba(25,40,45,0.06)",
          maskImage: "linear-gradient(to bottom, #000 0%, #000 28%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-52 opacity-[0.82]"
        style={{
          ...glassStyle,
          background:
            "linear-gradient(to top, rgba(18,36,28,0.13), rgba(255,255,255,0.1) 48%, rgba(170,205,213,0.07) 68%, rgba(255,255,255,0))",
          boxShadow:
            "inset 0 64px 110px rgba(255,255,255,0.1), inset 0 16px 48px rgba(25,40,45,0.05)",
          maskImage: "linear-gradient(to top, #000 0%, #000 26%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-y-0 left-0 w-48 opacity-80"
        style={{
          ...glassStyle,
          background:
            "linear-gradient(to right, rgba(18,36,28,0.13), rgba(255,255,255,0.09) 46%, rgba(170,205,213,0.07) 68%, rgba(255,255,255,0))",
          boxShadow:
            "inset -66px 0 112px rgba(255,255,255,0.1), inset -18px 0 48px rgba(25,40,45,0.05)",
          maskImage: "linear-gradient(to right, #000 0%, #000 26%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-48 opacity-80"
        style={{
          ...glassStyle,
          background:
            "linear-gradient(to left, rgba(18,36,28,0.13), rgba(255,255,255,0.09) 46%, rgba(170,205,213,0.07) 68%, rgba(255,255,255,0))",
          boxShadow:
            "inset 66px 0 112px rgba(255,255,255,0.1), inset 18px 0 48px rgba(25,40,45,0.05)",
          maskImage: "linear-gradient(to left, #000 0%, #000 26%, transparent 100%)",
        }}
      />
      <div
        className="absolute -left-28 top-8 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 64% 42%, rgba(255,255,255,1), rgba(255,255,255,0.36) 46%, rgba(183,220,230,0.18) 62%, rgba(255,255,255,0) 78%)",
          mixBlendMode: "screen",
        }}
      />
      <div
        className="absolute -right-28 bottom-4 h-80 w-80 rounded-full opacity-18 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 36% 58%, rgba(255,255,255,0.98), rgba(255,255,255,0.32) 48%, rgba(183,220,230,0.16) 64%, rgba(255,255,255,0) 78%)",
          mixBlendMode: "screen",
        }}
      />
      <div
        className="absolute left-1/2 top-0 h-36 w-[46rem] -translate-x-1/2 rounded-b-[60%] opacity-18 blur-xl"
        style={{
          background:
            "linear-gradient(100deg, rgba(255,255,255,0), rgba(255,255,255,0.85) 42%, rgba(189,219,226,0.45) 58%, rgba(255,255,255,0))",
          mixBlendMode: "screen",
        }}
      />
      <div
        className="absolute inset-0 rounded-[inherit] opacity-22"
        style={{
          boxShadow:
            "inset 0 0 110px rgba(20,35,40,0.12)",
        }}
      />
    </div>
  );
}

function Control({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  return (
    <label className="grid grid-cols-[4.5rem_1fr_2.6rem] items-center gap-3 text-xs">
      <span className="font-medium text-[#102214]/78">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 accent-[#33673B]"
      />
      <span className="text-right font-mono text-[0.65rem] text-[#102214]/55">
        {formatValue ? formatValue(value) : value.toFixed(2)}
      </span>
    </label>
  );
}
