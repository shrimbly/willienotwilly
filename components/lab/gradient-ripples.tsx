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
uniform float uGlassRadius;
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

float glassRefractionCurve(float x) {
  float a = 0.992;
  float b = 2.332;
  float c = 4.544;
  float d = 6.923;
  return 1.0 - b * pow(c * 2.718281828459045, -d * x - a);
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

const LIQUID_GLASS_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uGlassRadius;

varying vec2 vUv;

float roundedRectSDF(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + vec2(radius);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float glassRefractionCurve(float x) {
  float a = 0.992;
  float b = 2.332;
  float c = 4.544;
  float d = 6.923;
  return 1.0 - b * pow(c * 2.718281828459045, -d * x - a);
}

void main() {
  vec2 uv = vUv;
  vec4 base = texture2D(uScene, uv);
  float glassInset = 0.0;
  vec2 halfSize = uResolution * 0.5 - vec2(glassInset);
  vec2 p = (uv - 0.5) * uResolution;
  float dist = roundedRectSDF(p, halfSize, max(uGlassRadius - glassInset, 0.0));

  if (dist > 0.0) {
    gl_FragColor = base;
    return;
  }

  float depthPx = max(-dist, 0.0);
  float depth = depthPx / max(min(halfSize.x, halfSize.y), 1.0);
  float edgeBand = 1.0 - smoothstep(0.0, 150.0, depthPx);

  if (edgeBand <= 0.001) {
    gl_FragColor = base;
    return;
  }

  float falloff = pow(max(glassRefractionCurve(depth), 0.0), 1.779);
  vec2 sampleP = p * falloff;
  vec2 sampleUv = sampleP / uResolution + 0.5;
  vec3 refracted = texture2D(uScene, clamp(sampleUv, vec2(0.0), vec2(1.0))).rgb;
  float edge = 1.0 - smoothstep(0.0, 42.0, depthPx);
  float innerShadow = smoothstep(0.0, 80.0, depthPx) * (1.0 - smoothstep(80.0, 150.0, depthPx));
  vec3 color = mix(base.rgb, refracted, edgeBand);
  color *= 1.0 - innerShadow * 0.045;
  color += vec3(edge * 0.018);

  gl_FragColor = vec4(color, 1.0);
}
`;

type GradientVariant = "v1" | "v2" | "v3";

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
  v3: {
    ripple: 0.36,
    depth: 0.08,
    speed: 1.08,
    thickness: 0.5,
    speedField: 0.52,
    rippleCount: 2,
    chromatic: 1.15,
    nestedMode: 1,
    title: "Chromatic clock",
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
    uGlassRadius: { value: number };
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
  const [controlsHidden, setControlsHidden] = useState(variant === "v3");
  const [fps, setFps] = useState(0);

  const colorVectors = useMemo(() => getColorArray(colors), [colors]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
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
      uGlassRadius: { value: 36 * renderer.getPixelRatio() },
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

    const postScene = new THREE.Scene();
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    renderTarget.texture.minFilter = THREE.LinearFilter;
    renderTarget.texture.magFilter = THREE.LinearFilter;
    renderTarget.texture.generateMipmaps = false;

    const postUniforms = {
      uScene: { value: renderTarget.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uGlassRadius: { value: 36 * renderer.getPixelRatio() },
    };
    const postMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: LIQUID_GLASS_FRAGMENT_SHADER,
      uniforms: postUniforms,
    });
    const postMesh = new THREE.Mesh(geometry, postMaterial);
    postScene.add(postMesh);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      const pixelRatio = renderer.getPixelRatio();
      renderer.setSize(clientWidth, clientHeight, false);
      const width = clientWidth * pixelRatio;
      const height = clientHeight * pixelRatio;
      uniforms.uResolution.value.set(width, height);
      postUniforms.uResolution.value.set(width, height);
      uniforms.uGlassRadius.value = (clientWidth >= 640 ? 36 : 28) * pixelRatio;
      postUniforms.uGlassRadius.value = uniforms.uGlassRadius.value;
      renderTarget.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationFrame = 0;
    const startedAt = performance.now();
    let frameCount = 0;
    let lastFpsAt = startedAt;
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
      const now = performance.now();
      uniforms.uTime.value = (now - startedAt) / 1000;
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, camera);
      frameCount += 1;
      if (now - lastFpsAt >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsAt)));
        frameCount = 0;
        lastFpsAt = now;
      }
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", addClickRipple);
      scene.remove(mesh);
      postScene.remove(postMesh);
      geometry.dispose();
      material.dispose();
      postMaterial.dispose();
      renderTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      uniformsRef.current = null;
    };
  }, [defaults, variant]);

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

  const isClockVariant = variant === "v3";
  const frameClassName = isClockVariant
    ? "absolute inset-8 overflow-hidden rounded-[2.75rem] bg-[#f5f5f5] shadow-[0_30px_110px_rgba(16,34,20,0.26),0_8px_30px_rgba(16,34,20,0.16)] sm:inset-10 sm:rounded-[3.5rem] lg:inset-14 lg:rounded-[4.25rem]"
    : "absolute inset-4 overflow-hidden rounded-[2.25rem] bg-[#f5f5f5] shadow-[0_24px_90px_rgba(16,34,20,0.22),0_6px_24px_rgba(16,34,20,0.14)] sm:inset-6 sm:rounded-[3rem] lg:inset-8 lg:rounded-[3.5rem]";
  const titleClassName = isClockVariant
    ? "pointer-events-none absolute inset-x-8 top-8 z-10 flex justify-center px-6 pt-6 sm:inset-x-10 sm:top-10 sm:justify-start sm:px-9 lg:inset-x-14 lg:top-14"
    : "pointer-events-none absolute inset-x-4 top-4 z-10 flex justify-center px-6 pt-6 sm:inset-x-6 sm:top-6 sm:justify-start sm:px-8 lg:inset-x-8 lg:top-8";
  const fpsClassName = isClockVariant
    ? "pointer-events-none absolute right-12 top-12 z-20 rounded-full border border-white/45 bg-white/55 px-3 py-1.5 font-mono text-[0.68rem] tabular-nums text-[#102214]/70 shadow-lg shadow-[#102214]/10 backdrop-blur-xl sm:right-16 sm:top-16 lg:right-20 lg:top-20"
    : "pointer-events-none absolute right-8 top-8 z-20 rounded-full border border-white/45 bg-white/55 px-3 py-1.5 font-mono text-[0.68rem] tabular-nums text-[#102214]/70 shadow-lg shadow-[#102214]/10 backdrop-blur-xl sm:right-12 sm:top-12 lg:right-14 lg:top-14";
  const showControlsClassName = isClockVariant
    ? "absolute bottom-12 left-12 z-20 grid size-11 place-items-center rounded-full border border-white/45 bg-white/58 text-[#102214] shadow-2xl shadow-[#102214]/15 backdrop-blur-xl transition hover:bg-white/75 sm:bottom-16 sm:left-16 lg:bottom-20 lg:left-20"
    : "absolute bottom-8 left-8 z-20 grid size-11 place-items-center rounded-full border border-white/45 bg-white/58 text-[#102214] shadow-2xl shadow-[#102214]/15 backdrop-blur-xl transition hover:bg-white/75 sm:bottom-12 sm:left-12 lg:bottom-14 lg:left-14";
  const controlsClassName = isClockVariant
    ? "absolute inset-x-12 bottom-12 z-20 rounded-[1.35rem] border border-white/45 bg-white/58 p-3 text-[#102214] shadow-[0_18px_50px_rgba(16,34,20,0.18)] backdrop-blur-xl sm:inset-x-auto sm:bottom-16 sm:left-16 sm:w-[22rem] lg:bottom-20 lg:left-20"
    : "absolute inset-x-8 bottom-8 z-20 rounded-[1.35rem] border border-white/45 bg-white/58 p-3 text-[#102214] shadow-[0_18px_50px_rgba(16,34,20,0.18)] backdrop-blur-xl sm:inset-x-auto sm:bottom-12 sm:left-12 sm:w-[22rem] lg:bottom-14 lg:left-14";
  const stageClassName = [
    "absolute inset-0",
    isClockVariant ? "gradient-landscape-stage" : "",
  ].join(" ");

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#f5f5f5] text-[#102214]">
      {isClockVariant ? (
        <style>{`
          @media (orientation: portrait) and (max-width: 767px) {
            .gradient-landscape-stage {
              width: 100dvh;
              height: 100dvw;
              min-width: 100dvh;
              min-height: 100dvw;
              transform: rotate(90deg) translateY(-100%);
              transform-origin: top left;
            }
          }
        `}</style>
      ) : null}
      <div className={stageClassName}>
        <div className={frameClassName}>
          <div ref={mountRef} className="absolute inset-0" />
          <LiquidGlassLayer />
          {isClockVariant ? <GlassInfoTile /> : null}
        </div>

        <div className={fpsClassName}>
          {fps} fps
        </div>

        <div className={titleClassName}>
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
            className={showControlsClassName}
            aria-label="Show gradient controls"
          >
            <SlidersHorizontal size={17} strokeWidth={2} />
          </button>
        ) : (
          <section
            aria-label="Gradient controls"
            className={controlsClassName}
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
      </div>
    </main>
  );
}

function LiquidGlassLayer() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5] rounded-[inherit]"
    >
      <LiquidGlassSurface />
    </div>
  );
}

function LiquidGlassSurface({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span
        className="absolute inset-0 rounded-[inherit]"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.01) 38%, rgba(27,53,39,0.04) 68%, rgba(255,255,255,0.035))",
          boxShadow: compact
            ? "inset 0 0 0 1px rgba(255,255,255,0.2), inset 0 0 24px rgba(255,255,255,0.08), inset 0 0 36px rgba(12,28,20,0.08)"
            : "inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 0 90px rgba(255,255,255,0.055), inset 0 0 150px rgba(12,28,20,0.08)",
        }}
      />
      <span
        className="absolute inset-0 rounded-[inherit] opacity-70"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.26), transparent 34%), radial-gradient(circle at 82% 92%, rgba(15,38,29,0.14), transparent 38%)",
          mixBlendMode: "soft-light",
        }}
      />
      <span
        className="absolute inset-0 rounded-[inherit] opacity-80"
        style={{
          background:
            "linear-gradient(100deg, transparent 7%, rgba(255,255,255,0.18) 16%, transparent 28%, transparent 70%, rgba(16,34,20,0.12) 84%, transparent 94%)",
          mixBlendMode: "overlay",
        }}
      />
      <span
        className="absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow: compact
            ? "inset 0 5px 16px rgba(255,255,255,0.16), inset 0 -8px 18px rgba(16,34,20,0.1), inset 8px 0 20px rgba(255,255,255,0.08), inset -8px 0 20px rgba(16,34,20,0.08)"
            : "inset 0 12px 42px rgba(255,255,255,0.14), inset 0 -18px 54px rgba(16,34,20,0.1), inset 20px 0 70px rgba(255,255,255,0.08), inset -20px 0 70px rgba(16,34,20,0.08)",
        }}
      />
    </>
  );
}

function GlassInfoTile() {
  const [now, setNow] = useState<Date | null>(null);
  const [temperature, setTemperature] = useState("18°");

  useEffect(() => {
    const update = () => {
      setNow(new Date());
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-36.8485&longitude=174.7633&current=temperature_2m&temperature_unit=celsius",
      { signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const value = data?.current?.temperature_2m;
        if (typeof value === "number") {
          setTemperature(`${Math.round(value)}°`);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const time = now
    ? new Intl.DateTimeFormat("en-NZ", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      }).format(now)
    : "--:--";
  const date = now
    ? new Intl.DateTimeFormat("en-NZ", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(now)
    : "Today";

  return (
    <section className="pointer-events-none absolute bottom-5 right-5 z-20 flex h-1/2 w-1/2 flex-col justify-between overflow-hidden rounded-[1.6rem] border border-white/30 bg-white/[0.13] p-5 text-[#102214] shadow-[0_10px_24px_rgba(16,34,20,0.12)] backdrop-blur-2xl sm:bottom-7 sm:right-7 sm:rounded-[2rem] sm:p-6 lg:bottom-8 lg:right-8">
      <div className="flex items-start justify-between gap-4 font-[var(--font-geist-mono)] text-[clamp(0.6rem,1vw,0.85rem)] uppercase tracking-[0.16em] text-[#102214]/70">
        <span>{date}</span>
        <span>{temperature}</span>
      </div>
      <div className="font-[var(--font-geist-mono)] text-[clamp(2rem,8vw,7.5rem)] font-medium leading-none tracking-[-0.08em] text-[#102214]/82">
        {time}
      </div>
    </section>
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
