"use client";

import { useEffect, useId, useRef } from "react";

const EXPERIENCE_SCRIPT = String.raw`
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js";
const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";
const VISION_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const mount = document.querySelector("[data-face-wall-lab]");
const root = mount?.querySelector("[data-face-wall-root]");
const canvas = mount?.querySelector("[data-preview-canvas]");
const video = mount?.querySelector("[data-preview-video]");
const captureButton = mount?.querySelector("[data-capture-face]");
const enterButton = mount?.querySelector("[data-enter-ar]");
const statusEl = mount?.querySelector("[data-status]");
const placementEl = mount?.querySelector("[data-placement]");
const supportEl = mount?.querySelector("[data-support]");

if (!root || !canvas || !video || !captureButton || !enterButton || !statusEl || !placementEl || !supportEl) {
  throw new Error("Face Wall AR mount is missing required elements.");
}

let THREE;
let FaceLandmarker;
let FilesetResolver;
let faceLandmarker;
let renderer;
let scene;
let camera;
let controller;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let faceTexture;
let faceDisplacementTexture;
let reliefMesh;
let reliefMaterial;
let capturedFaceData = null;
let previewStream = null;
let placed = false;
let arSupported = false;
let faceCaptured = false;

const setStatus = (message) => {
  statusEl.textContent = message;
};

const setPlacement = (message) => {
  placementEl.textContent = message;
};

function updateStartButton() {
  enterButton.disabled = !(arSupported && faceCaptured);
}

function drawFallbackFaceTexture() {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#d8d0c3");
  gradient.addColorStop(1, "#7e7568");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(30, 24, 20, 0.55)";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.48, w * 0.24, h * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(w * 0.42, h * 0.42, w * 0.035, h * 0.022, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.58, h * 0.42, w * 0.035, h * 0.022, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.44);
  ctx.quadraticCurveTo(w * 0.53, h * 0.54, w * 0.48, h * 0.58);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.66, w * 0.085, h * 0.026, 0, 0, Math.PI);
  ctx.stroke();
}

function makeDisplacementTexture(landmarks) {
  const size = 256;
  const displacement = document.createElement("canvas");
  displacement.width = size;
  displacement.height = size;
  const ctx = displacement.getContext("2d");
  const radial = ctx.createRadialGradient(size / 2, size * 0.48, 8, size / 2, size * 0.48, size * 0.42);
  radial.addColorStop(0, "rgba(255,255,255,0.98)");
  radial.addColorStop(0.28, "rgba(222,222,222,0.92)");
  radial.addColorStop(0.58, "rgba(104,104,104,0.48)");
  radial.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.5, size * 0.29, size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  if (landmarks?.length) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (const point of landmarks) {
      const x = point.x * size;
      const y = point.y * size;
      ctx.beginPath();
      ctx.arc(x, y, point.z < -0.04 ? 4 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return displacement;
}

function updateReliefTextures() {
  if (!THREE || !reliefMaterial) return;
  if (faceTexture) faceTexture.dispose();
  if (faceDisplacementTexture) faceDisplacementTexture.dispose();
  faceTexture = new THREE.CanvasTexture(canvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.needsUpdate = true;
  faceDisplacementTexture = new THREE.CanvasTexture(capturedFaceData.displacement);
  faceDisplacementTexture.needsUpdate = true;
  reliefMaterial.map = faceTexture;
  reliefMaterial.displacementMap = faceDisplacementTexture;
  reliefMaterial.needsUpdate = true;
}

async function loadModules() {
  if (THREE) return;
  try {
    const [threeModule, visionModule] = await Promise.all([
      import(THREE_URL),
      import(VISION_URL),
    ]);
    THREE = threeModule;
    FaceLandmarker = visionModule.FaceLandmarker;
    FilesetResolver = visionModule.FilesetResolver;
  } catch (error) {
    console.error(error);
    setStatus("AR modules failed to load. Check connection and refresh.");
    throw error;
  }
}

async function setupFaceCapture() {
  try {
    await loadModules();
  } catch {
    captureButton.disabled = true;
    enterButton.disabled = true;
    return;
  }
  const fileset = await FilesetResolver.forVisionTasks(VISION_WASM);
  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: FACE_MODEL,
      delegate: "GPU",
    },
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: "IMAGE",
    numFaces: 1,
  });

  try {
    previewStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 720, height: 720 },
      audio: false,
    });
    video.srcObject = previewStream;
    await video.play();
    setStatus("Center your face, then capture the relief.");
  } catch (error) {
    console.warn(error);
    drawFallbackFaceTexture();
    capturedFaceData = { displacement: makeDisplacementTexture(null) };
    captureButton.disabled = true;
    faceCaptured = true;
    updateStartButton();
    setStatus("Camera preview was blocked. Using a placeholder relief.");
  }
}

function captureFace() {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -size, 0, size, size);
  ctx.restore();

  let landmarks = null;
  try {
    const results = faceLandmarker.detect(canvas);
    landmarks = results.faceLandmarks?.[0] ?? null;
  } catch (error) {
    console.warn(error);
  }

  capturedFaceData = { displacement: makeDisplacementTexture(landmarks) };
  video.style.opacity = "0";
  canvas.style.opacity = "1";
  faceCaptured = true;
  updateReliefTextures();
  updateStartButton();
  setStatus(landmarks ? "Face captured. Start AR and tap a wall or flat surface." : "Captured. Face landmarks were faint, but the relief is ready.");
}

function createReticle() {
  const geometry = new THREE.RingGeometry(0.08, 0.092, 48).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.86,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return mesh;
}

function createReliefMesh() {
  const geometry = new THREE.PlaneGeometry(0.72, 0.72, 96, 96);
  reliefMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9d2c7,
    roughness: 0.84,
    metalness: 0,
    displacementScale: 0.18,
    displacementBias: -0.012,
    side: THREE.DoubleSide,
  });
  reliefMesh = new THREE.Mesh(geometry, reliefMaterial);
  reliefMesh.visible = false;
  reliefMesh.castShadow = false;
  reliefMesh.receiveShadow = true;
  scene.add(reliefMesh);
  if (!capturedFaceData) {
    drawFallbackFaceTexture();
    capturedFaceData = { displacement: makeDisplacementTexture(null) };
  }
  updateReliefTextures();
}

function onSelect() {
  if (!reticle.visible || !reliefMesh) return;
  reliefMesh.visible = true;
  reliefMesh.matrix.copy(reticle.matrix);
  reliefMesh.matrix.decompose(reliefMesh.position, reliefMesh.quaternion, reliefMesh.scale);
  reliefMesh.rotateX(-Math.PI / 2);
  reliefMesh.updateMatrixWorld(true);
  placed = true;
  setPlacement("Relief placed. Move around it; tap again to move it.");
}

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x787878, 2.4);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 2.2);
  directional.position.set(0.2, 1, 0.45);
  scene.add(directional);

  reticle = createReticle();
  scene.add(reticle);
  createReliefMesh();

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop((_, frame) => {
    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      if (!hitTestSourceRequested) {
        session.requestReferenceSpace("viewer").then((viewerSpace) => {
          session.requestHitTestSource({ space: viewerSpace }).then((source) => {
            hitTestSource = source;
          });
        });
        session.addEventListener("end", () => {
          hitTestSourceRequested = false;
          hitTestSource = null;
          reticle.visible = false;
          setPlacement("AR session ended.");
        });
        hitTestSourceRequested = true;
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(referenceSpace);
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
          if (!placed) setPlacement("Surface found. Tap to pin the face relief.");
        } else {
          reticle.visible = false;
          if (!placed) setPlacement("Move slowly until a surface is found.");
        }
      }
    }

    renderer.render(scene, camera);
  });
}

async function enterAR() {
  if (!navigator.xr) {
    setStatus("WebXR is not available in this browser.");
    return;
  }
  if (!arSupported) {
    setStatus("Immersive AR is not supported here. Try Chrome on an ARCore Android phone over HTTPS.");
    return;
  }
  if (!THREE) {
    setStatus("Loading AR modules...");
    try {
      await loadModules();
    } catch {
      return;
    }
  }
  if (!renderer) initThree();
  if (previewStream) {
    previewStream.getTracks().forEach((track) => track.stop());
    previewStream = null;
  }
  try {
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "anchors", "light-estimation"],
      domOverlay: { root: document.body },
    });
    await renderer.xr.setSession(session);
    setStatus("AR running. Find a wall or flat surface.");
  } catch (error) {
    console.warn(error);
    setStatus("AR did not start. Check Chrome permissions and make sure AR services are enabled.");
  }
}

async function checkSupport() {
  if (!navigator.xr) {
    supportEl.textContent = "WebXR unavailable";
    arSupported = false;
    updateStartButton();
    return;
  }
  const supported = await navigator.xr.isSessionSupported("immersive-ar");
  arSupported = supported;
  supportEl.textContent = supported ? "AR ready" : "AR unsupported";
  updateStartButton();
}

captureButton.addEventListener("click", captureFace);
enterButton.addEventListener("click", enterAR);

drawFallbackFaceTexture();
setStatus("Loading face capture...");
setPlacement("Capture your face first, then start AR.");
checkSupport();
setupFaceCapture();
`;

export function FaceWallArLab() {
  const mountId = useId();
  const mountRef = useRef<HTMLDivElement>(null);
  const scriptReadyRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || scriptReadyRef.current) return;
    scriptReadyRef.current = true;
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = EXPERIENCE_SCRIPT;
    mount.appendChild(script);
  }, []);

  return (
    <main
      ref={mountRef}
      id={mountId}
      data-face-wall-lab
      className="relative min-h-[100dvh] overflow-hidden bg-black text-white"
    >
      <div data-face-wall-root className="fixed inset-0" />
      <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.14),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.20),rgba(0,0,0,0.72))]" />

      <section className="fixed inset-x-0 top-0 z-20 px-5 pt-5">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/54">
              Lab / Android AR
            </p>
            <span
              data-support
              className="rounded-full border border-white/12 bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white/70 backdrop-blur-md"
            >
              Checking AR
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Face in the wall
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/66">
            Capture a face relief, then tap a wall or flat surface to pin it in
            AR.
          </p>
        </div>
      </section>

      <section className="fixed inset-x-0 bottom-0 z-20 px-5 pb-5">
        <div className="mx-auto max-w-md rounded-[8px] border border-white/12 bg-black/54 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <div className="relative aspect-square overflow-hidden rounded-[8px] bg-white/8">
              <video
                data-preview-video
                className="absolute inset-0 z-10 h-full w-full scale-x-[-1] object-cover opacity-100 transition-opacity"
                playsInline
                muted
              />
              <canvas
                data-preview-canvas
                width={512}
                height={512}
                className="h-full w-full object-cover opacity-100 transition-opacity"
              />
            </div>
            <div className="min-w-0">
              <p data-status className="text-sm font-medium text-white">
                Preparing...
              </p>
              <p
                data-placement
                className="mt-1 text-xs leading-relaxed text-white/58"
              >
                Capture your face first.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  data-capture-face
                  type="button"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition active:scale-95"
                >
                  Capture face
                </button>
                <button
                  data-enter-ar
                  type="button"
                  disabled
                  className="rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm font-medium text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Start AR
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
