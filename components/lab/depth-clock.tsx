"use client";

import * as THREE from "three";
import {
  EyeOff,
  Maximize2,
  Minimize2,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEPTH_IMAGE_SRC = "/lab/depth-clock/bladerunner-depth.png";
const ORIGINAL_IMAGE_SRC = "/lab/depth-clock/bladerunner-original.webp";
const SMALL_VIEWPORT_SAMPLE_STRIDE = 4;
const MEDIUM_VIEWPORT_SAMPLE_STRIDE = 3;
const LARGE_VIEWPORT_SAMPLE_STRIDE = 2;
const MEDIUM_DENSITY_MIN_SIDE = 680;
const LARGE_DENSITY_MIN_SIDE = 980;
const CLOUD_WIDTH = 5.8;
const DEPTH_RANGE = 2.35;
const DEPTH_CONTRAST = 1.28;
const CLOUD_COVERAGE = 1.18;
const CLOUD_OFFSET_X = 0;
const CLOUD_OFFSET_Y = 0;
const BASE_POINT_SIZE = 1.85;
const NEAR_POINT_BOOST = 2.6;
const POINT_RANDOM_SIZE = 0.75;
const POINT_SCALE_BASELINE = 760;
const MIN_VIEWPORT_POINT_SCALE = 0.5;
const MAX_VIEWPORT_POINT_SCALE = 1.25;
const MIN_ALPHA = 0.16;
const MAX_ALPHA = 0.88;
const ORIGINAL_COLOR_BLEND = 0.92;
const DEPTH_COLOR_LIFT = 0.08;
const CAMERA_DISTANCE = 6.4;
const CAMERA_FOV = 38;
const CLOCK_BACKDROP_MAX_HEIGHT = 0.46;
const CLOCK_BACKDROP_Y = 0;
const CLOCK_TEXTURE_WIDTH = 2048;
const CLOCK_TEXTURE_HEIGHT = 512;
const CURSOR_CAMERA_X = 0.42;
const CURSOR_CAMERA_Y = 0.26;
const CURSOR_LOOK_X = 0.22;
const CURSOR_LOOK_Y = 0.14;
const CURSOR_TARGET_EASE = 0.018;
const CURSOR_CAMERA_EASE = 0.008;
const IDLE_CAMERA_DRIFT_X = 0.08;
const IDLE_CAMERA_DRIFT_Y = 0.04;

type TuningControls = {
  depthScale: number;
  pointOpacity: number;
  farDetail: number;
  maxBrightness: number;
  baseColorBlend: number;
  rippleColorBlend: number;
  rippleLift: number;
  cursorTilt: number;
  clockOpacity: number;
  clockDepth: number;
  clockX: number;
  clockY: number;
  clockAngle: number;
  clockGlow: number;
  clockHue: number;
  clockSize: number;
  canvasBlur: number;
};

const DEFAULT_TUNING: TuningControls = {
  depthScale: 0.64,
  pointOpacity: 0.49,
  farDetail: 0.42,
  maxBrightness: 0.35,
  baseColorBlend: 1,
  rippleColorBlend: 1.8,
  rippleLift: 0.12,
  cursorTilt: 1.69,
  clockOpacity: 0.48,
  clockDepth: -2.84,
  clockX: 0,
  clockY: 0,
  clockAngle: 0,
  clockGlow: 0.2,
  clockHue: 194,
  clockSize: 0.52,
  canvasBlur: 1.13,
};

const VERTEX_SHADER = `
attribute float aAlpha;
attribute float aSize;
attribute float aPhase;
attribute float aDepth;
attribute vec3 aPhotoColor;

uniform float uTime;
uniform float uPixelRatio;
uniform float uViewportPointScale;
uniform float uDepthScale;
uniform float uRippleLift;

varying vec3 vColor;
varying vec3 vPhotoColor;
varying vec2 vFieldPosition;
varying float vDepth;
varying float vAlpha;

float colorRipple(vec2 center, float offset, vec2 fieldPosition) {
  float cycle = 7.4;
  float travel = mod(uTime * 0.18 + offset, cycle);
  float distanceToCenter = length(fieldPosition - center);
  float ring = 1.0 - smoothstep(0.0, 1.28, abs(distanceToCenter - travel));
  float fadeIn = smoothstep(0.0, 0.95, travel);
  float fadeOut = 1.0 - smoothstep(cycle - 1.35, cycle, travel);

  return ring * fadeIn * fadeOut;
}

void main() {
  vColor = color;
  vPhotoColor = aPhotoColor;
  vFieldPosition = position.xy;
  vDepth = aDepth;
  vAlpha = aAlpha;

  vec3 displaced = position;
  float zLift = max(
    colorRipple(vec2(-2.45, -1.08), 0.0, position.xy),
    max(
      colorRipple(vec2(1.75, 0.95), 2.4, position.xy),
      colorRipple(vec2(-0.25, 0.18), 4.85, position.xy)
    )
  );
  zLift = smoothstep(0.04, 0.92, zLift);
  displaced.x += sin(uTime * 0.34 + aPhase) * 0.007;
  displaced.y += cos(uTime * 0.27 + aPhase * 0.83) * 0.006;
  displaced.z *= uDepthScale;
  displaced.z += zLift * uRippleLift;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * uViewportPointScale * uPixelRatio * (4.8 / max(-mvPosition.z, 0.1));
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uPointOpacity;
uniform float uFarDetail;
uniform float uMaxBrightness;
uniform float uBaseColorBlend;
uniform float uRippleColorBlend;

varying vec3 vColor;
varying vec3 vPhotoColor;
varying vec2 vFieldPosition;
varying float vDepth;
varying float vAlpha;

float colorRipple(vec2 center, float offset) {
  float cycle = 7.4;
  float travel = mod(uTime * 0.18 + offset, cycle);
  float distanceToCenter = length(vFieldPosition - center);
  float ring = 1.0 - smoothstep(0.0, 1.28, abs(distanceToCenter - travel));
  float fadeIn = smoothstep(0.0, 0.95, travel);
  float fadeOut = 1.0 - smoothstep(cycle - 1.35, cycle, travel);

  return ring * fadeIn * fadeOut;
}

void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p);
  float disk = 1.0 - smoothstep(0.34, 0.5, d);
  float core = 1.0 - smoothstep(0.0, 0.36, d);
  float colorReveal = max(
    colorRipple(vec2(-2.45, -1.08), 0.0),
    max(
      colorRipple(vec2(1.75, 0.95), 2.4),
      colorRipple(vec2(-0.25, 0.18), 4.85)
    )
  );
  colorReveal = smoothstep(0.04, 0.92, colorReveal);
  float farMask = pow(1.0 - clamp(vDepth, 0.0, 1.0), 1.35);
  colorReveal = uBaseColorBlend + colorReveal * uRippleColorBlend;
  colorReveal += farMask * uFarDetail * 0.48;
  colorReveal = clamp(colorReveal, 0.0, 1.0);
  vec3 color = mix(vColor, vPhotoColor, colorReveal) + core * vec3(0.06, 0.075, 0.08);
  color += vec3(0.055, 0.07, 0.085) * farMask * uFarDetail;
  float peak = max(max(color.r, color.g), color.b);
  if (peak > uMaxBrightness) {
    color *= uMaxBrightness / peak;
  }

  gl_FragColor = vec4(color, vAlpha * (1.0 + farMask * uFarDetail * 1.35) * uPointOpacity * disk);
}
`;

type ParticleCloud = {
  geometry: THREE.BufferGeometry;
  sourceAspect: number;
};

type DepthClockProps = {
  depthImageSrc?: string;
  originalImageSrc?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hash2(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    image.src = src;
  });
}

function imageDataFrom(
  image: HTMLImageElement,
  targetWidth = image.naturalWidth,
  targetHeight = image.naturalHeight,
) {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

async function buildParticleCloud(
  depthImageSrc: string,
  originalImageSrc?: string,
  sampleStride = SMALL_VIEWPORT_SAMPLE_STRIDE,
): Promise<ParticleCloud> {
  const [depthImage, originalImage] = await Promise.all([
    loadImage(depthImageSrc),
    originalImageSrc ? loadImage(originalImageSrc) : Promise.resolve(null),
  ]);
  const depthData = imageDataFrom(depthImage);
  const { width, height, data } = depthData;
  const colorData = originalImage ? imageDataFrom(originalImage, width, height) : null;
  const sourceAspect = width / Math.max(height, 1);
  const cloudHeight = CLOUD_WIDTH / sourceAspect;
  const positions: number[] = [];
  const colors: number[] = [];
  const photoColors: number[] = [];
  const depths: number[] = [];
  const alphas: number[] = [];
  const sizes: number[] = [];
  const phases: number[] = [];

  for (let y = 0; y < height; y += sampleStride) {
    for (let x = 0; x < width; x += sampleStride) {
      const pixel = (y * width + x) * 4;
      const luminance =
        (data[pixel] * 0.299 + data[pixel + 1] * 0.587 + data[pixel + 2] * 0.114) /
        255;
      const depth = Math.pow(clamp(luminance, 0, 1), DEPTH_CONTRAST);
      const random = hash2(x, y);
      const edgeFade =
        smoothstep(0, width * 0.08, x) *
        smoothstep(0, width * 0.08, width - x) *
        smoothstep(0, height * 0.08, y) *
        smoothstep(0, height * 0.08, height - y);

      const px = (x / Math.max(width - 1, 1) - 0.5) * CLOUD_WIDTH;
      const py = (0.5 - y / Math.max(height - 1, 1)) * cloudHeight;
      const pz = (depth - 0.5) * DEPTH_RANGE + (random - 0.5) * 0.04;

      positions.push(
        px + (random - 0.5) * 0.012,
        py + (hash2(y, x) - 0.5) * 0.012,
        pz,
      );

      const depthRed = mix(0.22, 0.98, depth);
      const depthGreen = mix(0.27, 0.97, depth);
      const depthBlue = mix(0.32, 1, depth);
      colors.push(depthRed, depthGreen, depthBlue);
      depths.push(depth);

      if (colorData) {
        const source = colorData.data;
        photoColors.push(
          clamp(
            mix(depthRed, source[pixel] / 255, ORIGINAL_COLOR_BLEND) +
              DEPTH_COLOR_LIFT * depth,
            0,
            1,
          ),
          clamp(
            mix(depthGreen, source[pixel + 1] / 255, ORIGINAL_COLOR_BLEND) +
              DEPTH_COLOR_LIFT * depth,
            0,
            1,
          ),
          clamp(
            mix(depthBlue, source[pixel + 2] / 255, ORIGINAL_COLOR_BLEND) +
              DEPTH_COLOR_LIFT * depth,
            0,
            1,
          ),
        );
      } else {
        photoColors.push(depthRed, depthGreen, depthBlue);
      }

      alphas.push(mix(MIN_ALPHA, MAX_ALPHA, depth) * mix(0.52, 1, edgeFade));
      sizes.push(BASE_POINT_SIZE + depth * NEAR_POINT_BOOST + random * POINT_RANDOM_SIZE);
      phases.push(random * Math.PI * 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute(
    "aPhotoColor",
    new THREE.Float32BufferAttribute(photoColors, 3),
  );
  geometry.setAttribute("aDepth", new THREE.Float32BufferAttribute(depths, 1));
  geometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  geometry.computeBoundingSphere();

  return { geometry, sourceAspect };
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1);
  return t * t * (3 - 2 * t);
}

function sampleStrideForViewport(width: number, height: number) {
  const minSide = Math.min(width, height);

  if (minSide >= LARGE_DENSITY_MIN_SIDE) {
    return LARGE_VIEWPORT_SAMPLE_STRIDE;
  }

  if (minSide >= MEDIUM_DENSITY_MIN_SIDE) {
    return MEDIUM_VIEWPORT_SAMPLE_STRIDE;
  }

  return SMALL_VIEWPORT_SAMPLE_STRIDE;
}

function formatClockTime(date: Date) {
  return new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function paintClockTexture(
  context: CanvasRenderingContext2D,
  time: string,
  glow: number,
  hue: number,
) {
  const { canvas } = context;
  const glowStrength = clamp(glow, 0, 1.5);
  const tint = `hsl(${hue.toFixed(1)} 92% 72%)`;
  const softTint = `hsla(${hue.toFixed(1)}, 92%, 72%, ${0.16 + glowStrength * 0.18})`;
  const bodyTint = `hsla(${hue.toFixed(1)}, 92%, 78%, ${0.28 + glowStrength * 0.28})`;
  const edgeTint = `hsla(${hue.toFixed(1)}, 96%, 82%, ${0.3 + glowStrength * 0.42})`;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font =
    '500 360px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  context.globalCompositeOperation = "lighter";
  context.shadowColor = tint;
  context.shadowBlur = 150 + glowStrength * 150;
  context.fillStyle = softTint;
  context.fillText(time, canvas.width / 2, canvas.height / 2 + 18);

  context.shadowBlur = 52 + glowStrength * 78;
  context.fillStyle = bodyTint;
  context.fillText(time, canvas.width / 2, canvas.height / 2 + 18);

  context.globalCompositeOperation = "source-over";
  context.shadowColor = tint;
  context.shadowBlur = 72 + glowStrength * 96;
  context.fillStyle = "rgba(244, 252, 255, 0.82)";
  context.fillText(time, canvas.width / 2, canvas.height / 2 + 18);
  context.shadowBlur = 0;
  context.strokeStyle = edgeTint;
  context.lineWidth = 6;
  context.strokeText(time, canvas.width / 2, canvas.height / 2 + 18);
  context.restore();
}

export function DepthClockLab({
  depthImageSrc = DEPTH_IMAGE_SRC,
  originalImageSrc = ORIGINAL_IMAGE_SRC,
}: DepthClockProps) {
  const mainRef = useRef<HTMLElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const tuningRef = useRef(DEFAULT_TUNING);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [tuning, setTuning] = useState<TuningControls>(DEFAULT_TUNING);

  useEffect(() => {
    tuningRef.current = tuning;
  }, [tuning]);

  useEffect(() => {
    const updateFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === mainRef.current);
    };

    document.addEventListener("fullscreenchange", updateFullscreen);
    updateFullscreen();

    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let animationFrame = 0;
    let points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null =
      null;
    let clockText = "";
    let activeClockGlow = Number.NaN;
    let activeClockHue = Number.NaN;
    let sourceAspect = 1;
    let activeSampleStride = 0;
    let buildVersion = 0;
    let activeCanvasBlur = tuningRef.current.canvasBlur;
    const cursorTarget = new THREE.Vector2(0, 0);
    const cursorLagTarget = new THREE.Vector2(0, 0);
    const cursorCurrent = new THREE.Vector2(0, 0);
    const cameraLookTarget = new THREE.Vector3(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x080a0d, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.filter = `blur(${activeCanvasBlur}px)`;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x080a0d, CAMERA_DISTANCE - 0.8, CAMERA_DISTANCE + 4.6);

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      1,
      0.1,
      CAMERA_DISTANCE + 10,
    );
    camera.position.set(0, 0.05, CAMERA_DISTANCE);

    const uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uViewportPointScale: { value: 1 },
      uDepthScale: { value: tuningRef.current.depthScale },
      uRippleLift: { value: tuningRef.current.rippleLift },
      uPointOpacity: { value: tuningRef.current.pointOpacity },
      uFarDetail: { value: tuningRef.current.farDetail },
      uMaxBrightness: { value: tuningRef.current.maxBrightness },
      uBaseColorBlend: { value: tuningRef.current.baseColorBlend },
      uRippleColorBlend: { value: tuningRef.current.rippleColorBlend },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      vertexColors: true,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const clockCanvas = document.createElement("canvas");
    clockCanvas.width = CLOCK_TEXTURE_WIDTH;
    clockCanvas.height = CLOCK_TEXTURE_HEIGHT;
    const clockContext = clockCanvas.getContext("2d");
    const clockTexture = new THREE.CanvasTexture(clockCanvas);
    clockTexture.colorSpace = THREE.SRGBColorSpace;
    clockTexture.minFilter = THREE.LinearFilter;
    clockTexture.magFilter = THREE.LinearFilter;
    clockTexture.generateMipmaps = false;
    const clockMaterial = new THREE.MeshBasicMaterial({
      map: clockTexture,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const clockMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      clockMaterial,
    );
    clockMesh.position.z = tuningRef.current.clockDepth;
    clockMesh.renderOrder = -10;
    scene.add(clockMesh);

    const updateClockTexture = () => {
      if (!clockContext) return;

      const nextClockText = formatClockTime(new Date());
      const nextClockGlow = tuningRef.current.clockGlow;
      const nextClockHue = tuningRef.current.clockHue;
      if (
        nextClockText === clockText &&
        nextClockGlow === activeClockGlow &&
        nextClockHue === activeClockHue
      ) {
        return;
      }

      clockText = nextClockText;
      activeClockGlow = nextClockGlow;
      activeClockHue = nextClockHue;
      paintClockTexture(clockContext, clockText, activeClockGlow, activeClockHue);
      clockTexture.needsUpdate = true;
    };

    const fitClockToViewport = () => {
      const controls = tuningRef.current;
      const distanceToClock = CAMERA_DISTANCE - controls.clockDepth;
      const visibleHeight =
        2 *
        Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2) *
        distanceToClock;
      const visibleWidth = visibleHeight * camera.aspect;
      const textureAspect = CLOCK_TEXTURE_WIDTH / CLOCK_TEXTURE_HEIGHT;
      const width = visibleWidth * controls.clockSize;
      const height = Math.min(
        width / textureAspect,
        visibleHeight * CLOCK_BACKDROP_MAX_HEIGHT,
      );

      clockMesh.scale.set(height * textureAspect, height, 1);
      clockMesh.position.set(
        visibleWidth * controls.clockX,
        visibleHeight * (CLOCK_BACKDROP_Y + controls.clockY),
        controls.clockDepth,
      );
    };

    const rebuildPointCloud = (sampleStride: number) => {
      activeSampleStride = sampleStride;
      buildVersion += 1;
      const version = buildVersion;

      buildParticleCloud(depthImageSrc, originalImageSrc, sampleStride)
        .then(({ geometry, sourceAspect: loadedSourceAspect }) => {
          if (disposed || version !== buildVersion) {
            geometry.dispose();
            return;
          }

          if (points) {
            scene.remove(points);
            points.geometry.dispose();
          }

          sourceAspect = loadedSourceAspect;
          points = new THREE.Points(geometry, material);
          points.rotation.x = -0.05;
          scene.add(points);
          fitCloudToViewport();
        })
        .catch((error) => {
          console.error(error);
        });
    };

    const fitCloudToViewport = () => {
      if (!points) return;

      const controls = tuningRef.current;
      const nearestDepthDistance =
        CAMERA_DISTANCE - DEPTH_RANGE * 0.5 * controls.depthScale;
      const visibleHeight =
        2 *
        Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2) *
        nearestDepthDistance;
      const visibleWidth = visibleHeight * camera.aspect;
      const cloudHeight = CLOUD_WIDTH / Math.max(sourceAspect, 0.0001);
      const scale = Math.max(
        (visibleWidth * CLOUD_COVERAGE) / CLOUD_WIDTH,
        (visibleHeight * CLOUD_COVERAGE) / cloudHeight,
      );

      points.scale.setScalar(scale);
      points.position.set(
        visibleWidth * CLOUD_OFFSET_X,
        visibleHeight * CLOUD_OFFSET_Y,
        0,
      );
    };

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      uniforms.uPixelRatio.value = renderer.getPixelRatio();
      uniforms.uViewportPointScale.value = clamp(
        Math.min(width, height) / POINT_SCALE_BASELINE,
        MIN_VIEWPORT_POINT_SCALE,
        MAX_VIEWPORT_POINT_SCALE,
      );
      fitClockToViewport();
      fitCloudToViewport();

      const nextSampleStride = sampleStrideForViewport(width, height);
      if (nextSampleStride !== activeSampleStride) {
        rebuildPointCloud(nextSampleStride);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    updateClockTexture();
    resize();

    const updateCursorTarget = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1);

      cursorTarget.set(
        clamp(x, 0, 1) * 2 - 1,
        (clamp(y, 0, 1) * 2 - 1) * -1,
      );
    };
    const resetCursorTarget = () => {
      cursorTarget.set(0, 0);
    };
    mount.addEventListener("pointermove", updateCursorTarget);
    mount.addEventListener("pointerleave", resetCursorTarget);

    const startedAt = performance.now();
    const render = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const controls = tuningRef.current;
      uniforms.uTime.value = elapsed;
      uniforms.uDepthScale.value = controls.depthScale;
      uniforms.uRippleLift.value = controls.rippleLift;
      uniforms.uPointOpacity.value = controls.pointOpacity;
      uniforms.uFarDetail.value = controls.farDetail;
      uniforms.uMaxBrightness.value = controls.maxBrightness;
      uniforms.uBaseColorBlend.value = controls.baseColorBlend;
      uniforms.uRippleColorBlend.value = controls.rippleColorBlend;
      clockMaterial.opacity = controls.clockOpacity;
      if (activeCanvasBlur !== controls.canvasBlur) {
        activeCanvasBlur = controls.canvasBlur;
        renderer.domElement.style.filter = `blur(${activeCanvasBlur}px)`;
      }
      updateClockTexture();
      cursorLagTarget.lerp(cursorTarget, CURSOR_TARGET_EASE);
      cursorCurrent.lerp(cursorLagTarget, CURSOR_CAMERA_EASE);
      camera.position.x =
        cursorCurrent.x * CURSOR_CAMERA_X * controls.cursorTilt +
        Math.sin(elapsed * 0.18) * IDLE_CAMERA_DRIFT_X;
      camera.position.y =
        0.04 +
        cursorCurrent.y * CURSOR_CAMERA_Y * controls.cursorTilt +
        Math.cos(elapsed * 0.13) * IDLE_CAMERA_DRIFT_Y;
      cameraLookTarget.set(
        cursorCurrent.x * CURSOR_LOOK_X * controls.cursorTilt,
        cursorCurrent.y * CURSOR_LOOK_Y * controls.cursorTilt,
        0,
      );
      camera.lookAt(cameraLookTarget);
      fitClockToViewport();

      if (points) {
        points.rotation.y = Math.sin(elapsed * 0.12) * 0.09;
        points.rotation.x = -0.055 + Math.cos(elapsed * 0.1) * 0.025;
      }

      clockMesh.lookAt(camera.position);
      clockMesh.rotateZ(THREE.MathUtils.degToRad(controls.clockAngle));

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mount.removeEventListener("pointermove", updateCursorTarget);
      mount.removeEventListener("pointerleave", resetCursorTarget);
      if (points) {
        scene.remove(points);
        points.geometry.dispose();
      }
      material.dispose();
      scene.remove(clockMesh);
      clockMesh.geometry.dispose();
      clockMaterial.dispose();
      clockTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [depthImageSrc, originalImageSrc]);

  const toggleFullscreen = async () => {
    if (!mainRef.current) return;
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      orientation.unlock?.();
      return;
    }

    await mainRef.current.requestFullscreen?.().catch(() => undefined);
    await orientation.lock?.("landscape").catch(() => undefined);
  };

  return (
    <main
      ref={mainRef}
      className="relative min-h-[100dvh] overflow-hidden bg-[#07090c] text-[#edf5f8]"
    >
      <style>{`
        @media (orientation: portrait) and (max-width: 767px) {
          .depth-clock-landscape-stage {
            width: 100dvh;
            height: 100dvw;
            min-width: 100dvh;
            min-height: 100dvw;
            transform: rotate(90deg) translateY(-100%);
            transform-origin: top left;
          }
        }
      `}</style>
      <div className="depth-clock-landscape-stage absolute inset-0">
        <div className="absolute inset-8 overflow-hidden rounded-[2.75rem] bg-[#080a0d] shadow-[0_30px_120px_rgba(0,0,0,0.55),0_8px_32px_rgba(151,196,213,0.1)] sm:inset-10 sm:rounded-[3.5rem] lg:inset-14 lg:rounded-[4.25rem]">
          <div ref={mountRef} className="absolute inset-0" />
          <DepthAtmosphere />
        </div>
        {controlsHidden ? (
          <button
            type="button"
            onClick={() => setControlsHidden(false)}
            className="absolute left-12 top-12 z-40 grid size-10 place-items-center rounded-full border border-white/15 bg-[#111a20]/35 text-white/80 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:bg-[#162531]/55 sm:left-16 sm:top-16 lg:left-20 lg:top-20"
            aria-label="Show depth clock controls"
          >
            <SlidersHorizontal size={16} strokeWidth={2} />
          </button>
        ) : (
          <DepthClockControls
            tuning={tuning}
            onChange={(key, value) =>
              setTuning((current) => ({ ...current, [key]: value }))
            }
            onHide={() => setControlsHidden(true)}
            onReset={() => setTuning(DEFAULT_TUNING)}
          />
        )}
      </div>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute bottom-3 left-4 z-40 grid size-10 place-items-center rounded-full border border-white/20 bg-white/12 text-white shadow-xl shadow-black/25 backdrop-blur-xl transition hover:bg-white/20 sm:hidden"
        aria-label={isFullscreen ? "Exit fullscreen clock" : "Open fullscreen clock"}
      >
        {isFullscreen ? (
          <Minimize2 size={16} strokeWidth={2} />
        ) : (
          <Maximize2 size={16} strokeWidth={2} />
        )}
      </button>
    </main>
  );
}

function DepthClockControls({
  tuning,
  onChange,
  onHide,
  onReset,
}: {
  tuning: TuningControls;
  onChange: (key: keyof TuningControls, value: number) => void;
  onHide: () => void;
  onReset: () => void;
}) {
  const sliders: {
    key: keyof TuningControls;
    label: string;
    min: number;
    max: number;
    step: number;
    format?: (value: number) => string;
  }[] = [
    {
      key: "depthScale",
      label: "Depth",
      min: 0.2,
      max: 2.4,
      step: 0.01,
    },
    {
      key: "pointOpacity",
      label: "Points",
      min: 0.05,
      max: 1.4,
      step: 0.01,
    },
    {
      key: "farDetail",
      label: "Far detail",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: "maxBrightness",
      label: "Max bright",
      min: 0.25,
      max: 1.5,
      step: 0.01,
    },
    {
      key: "baseColorBlend",
      label: "Base color",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: "rippleColorBlend",
      label: "Ripple color",
      min: 0,
      max: 1.8,
      step: 0.01,
    },
    {
      key: "rippleLift",
      label: "Ripple lift",
      min: 0,
      max: 0.6,
      step: 0.01,
    },
    {
      key: "cursorTilt",
      label: "Cursor tilt",
      min: 0,
      max: 2,
      step: 0.01,
    },
    {
      key: "clockOpacity",
      label: "Clock",
      min: 0,
      max: 1.4,
      step: 0.01,
    },
    {
      key: "clockDepth",
      label: "Clock z",
      min: -5.5,
      max: -0.6,
      step: 0.01,
    },
    {
      key: "clockX",
      label: "Clock x",
      min: -0.6,
      max: 0.6,
      step: 0.01,
    },
    {
      key: "clockY",
      label: "Clock y",
      min: -0.6,
      max: 0.6,
      step: 0.01,
    },
    {
      key: "clockAngle",
      label: "Clock angle",
      min: -35,
      max: 35,
      step: 0.1,
      format: (value) => `${value.toFixed(1)}deg`,
    },
    {
      key: "clockGlow",
      label: "Clock glow",
      min: 0,
      max: 1.5,
      step: 0.01,
    },
    {
      key: "clockHue",
      label: "Clock hue",
      min: 0,
      max: 360,
      step: 1,
      format: (value) => `${value.toFixed(0)}deg`,
    },
    {
      key: "clockSize",
      label: "Clock size",
      min: 0.35,
      max: 1.3,
      step: 0.01,
    },
    {
      key: "canvasBlur",
      label: "Blur",
      min: 0,
      max: 2.4,
      step: 0.01,
      format: (value) => `${value.toFixed(2)}px`,
    },
  ];

  return (
    <section
      aria-label="Depth clock controls"
      className="absolute left-12 top-12 z-40 w-[min(22rem,calc(100vw-6rem))] rounded-[1.25rem] border border-white/14 bg-[#0b1117]/54 p-3 text-white/88 shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:left-16 sm:top-16 lg:left-20 lg:top-20"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Depth clock</h2>
          <p className="mt-0.5 font-[var(--font-geist-mono)] text-[0.62rem] uppercase tracking-[0.16em] text-white/45">
            Live scene tuning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="grid size-9 place-items-center rounded-full border border-white/12 bg-white/[0.06] text-white/75 transition hover:bg-white/[0.12]"
            aria-label="Reset depth clock controls"
          >
            <RotateCcw size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onHide}
            className="grid size-9 place-items-center rounded-full border border-white/12 bg-white/[0.06] text-white/75 transition hover:bg-white/[0.12]"
            aria-label="Hide depth clock controls"
          >
            <EyeOff size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {sliders.map((slider) => (
          <TuningSlider
            key={slider.key}
            label={slider.label}
            value={tuning[slider.key]}
            min={slider.min}
            max={slider.max}
            step={slider.step}
            format={slider.format}
            onChange={(value) => onChange(slider.key, value)}
          />
        ))}
      </div>
    </section>
  );
}

function TuningSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[5.25rem_1fr_3.3rem] items-center gap-3 text-xs">
      <span className="font-medium text-white/76">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white"
      />
      <span className="text-right font-[var(--font-geist-mono)] text-[0.62rem] text-white/48">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </label>
  );
}

function DepthAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
    >
      <span
        className="absolute inset-0 rounded-[inherit]"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, transparent 0 42%, rgba(1,3,6,0.32) 76%, rgba(1,3,6,0.76) 100%)",
        }}
      />
      <span
        className="absolute inset-0 rounded-[inherit] opacity-80"
        style={{
          background:
            "linear-gradient(100deg, rgba(255,255,255,0.08), transparent 18%, transparent 72%, rgba(104,144,158,0.16))",
          mixBlendMode: "screen",
        }}
      />
      <span
        className="absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 18px 60px rgba(255,255,255,0.055), inset 0 -24px 72px rgba(0,0,0,0.34)",
        }}
      />
    </div>
  );
}
