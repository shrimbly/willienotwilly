"use client";

import { EyeOff, ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DepthClockLab } from "@/components/lab/depth-clock";

type UploadStatus = "idle" | "uploading" | "generating" | "ready" | "error";

type JobResponse = {
  status: "generating" | "completed" | "failed";
  depthImageUrl?: string;
  error?: string;
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const POLL_INTERVAL_MS = 1800;
const MAX_POLLS = 120;

export function DepthClockUploadLab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sceneOriginalSrc, setSceneOriginalSrc] = useState<string | undefined>();
  const [sceneDepthSrc, setSceneDepthSrc] = useState<string | undefined>();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadHidden, setUploadHidden] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const activeOriginalUrlRef = useRef<string | null>(null);
  const activeRequestRef = useRef(0);

  useEffect(() => {
    return () => {
      const urls = new Set([
        previewUrlRef.current,
        activeOriginalUrlRef.current,
      ]);
      urls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const handleFile = (file: File | null) => {
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Upload a PNG, JPEG, or WebP image.");
      setStatus("error");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    if (
      previewUrlRef.current &&
      previewUrlRef.current !== activeOriginalUrlRef.current
    ) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setSelectedFile(file);
    setStatus("idle");
    setError(null);
  };

  const pollJob = async (jobId: string, requestId: number) => {
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      if (activeRequestRef.current !== requestId) return null;

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const response = await fetch(`/api/depth-clock-v3/jobs/${jobId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as JobResponse;

      if (!response.ok || payload.status === "failed") {
        throw new Error(payload.error || "Depth generation failed.");
      }

      if (payload.status === "completed" && payload.depthImageUrl) {
        return `${payload.depthImageUrl}&t=${Date.now()}`;
      }
    }

    throw new Error("Depth generation is taking longer than expected.");
  };

  const generateDepth = async () => {
    if (!selectedFile || status === "uploading" || status === "generating") {
      return;
    }

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setError(null);
    setStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch("/api/depth-clock-v3/generate", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { jobId?: string; error?: string };

      if (!response.ok || !payload.jobId) {
        throw new Error(payload.error || "Unable to start depth generation.");
      }

      setStatus("generating");
      const depthImageUrl = await pollJob(payload.jobId, requestId);
      if (!depthImageUrl || !previewUrlRef.current) return;

      if (
        activeOriginalUrlRef.current &&
        activeOriginalUrlRef.current !== previewUrlRef.current
      ) {
        URL.revokeObjectURL(activeOriginalUrlRef.current);
      }

      activeOriginalUrlRef.current = previewUrlRef.current;
      setSceneOriginalSrc(previewUrlRef.current);
      setSceneDepthSrc(depthImageUrl);
      setStatus("ready");
    } catch (generationError) {
      console.error(generationError);
      if (activeRequestRef.current !== requestId) return;
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate depth map.",
      );
      setStatus("error");
    }
  };

  const isWorking = status === "uploading" || status === "generating";
  const statusText =
    status === "uploading"
      ? "Uploading image"
      : status === "generating"
        ? "Generating depth"
        : status === "ready"
          ? "Depth cloud ready"
          : "Upload source image";

  return (
    <DepthClockLab
      depthImageSrc={sceneDepthSrc}
      originalImageSrc={sceneOriginalSrc}
      startControlsHidden
      overlay={
        uploadHidden ? (
          <button
            type="button"
            onClick={() => setUploadHidden(false)}
            className="absolute right-12 top-12 z-40 grid size-10 place-items-center rounded-full border border-white/15 bg-[#111a20]/35 text-white/80 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:bg-[#162531]/55 sm:right-16 sm:top-16 lg:right-20 lg:top-20"
            aria-label="Show depth clock upload"
          >
            <ImagePlus size={16} strokeWidth={2} />
          </button>
        ) : (
          <section className="absolute right-5 top-5 z-40 w-[min(23rem,calc(100vw-2.5rem))] rounded-[1.65rem] border border-white/15 bg-[#071014]/78 p-4 text-white shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:right-8 sm:top-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-sm font-semibold tracking-tight">
                  Depth clock upload
                </h1>
                <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.28em] text-white/48">
                  Comfy Cloud Depth Anything V2
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUploadHidden(true)}
                  className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white"
                  aria-label="Hide depth clock upload"
                >
                  <EyeOff size={15} strokeWidth={2} />
                </button>
                <div className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/8 text-white/70">
                  {isWorking ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                </div>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/18 bg-white/[0.045] p-3 transition hover:border-white/35 hover:bg-white/[0.075]">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={isWorking}
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/30">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UploadCloud size={18} className="text-white/58" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white/88">
                  {selectedFile?.name || "Choose image"}
                </p>
                <p className="mt-1 text-[0.68rem] leading-relaxed text-white/45">
                  PNG, JPEG, or WebP. Max 10 MB.
                </p>
              </div>
            </label>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={generateDepth}
                disabled={!selectedFile || isWorking}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-white text-xs font-semibold text-[#071014] transition hover:bg-[#dceff5] disabled:cursor-not-allowed disabled:bg-white/18 disabled:text-white/38"
              >
                {isWorking ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Generate depth
              </button>
              <span className="min-w-28 text-right font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/45">
                {statusText}
              </span>
            </div>

            {error ? (
              <p className="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-100/82">
                {error}
              </p>
            ) : null}
          </section>
        )
      }
    />
  );
}
