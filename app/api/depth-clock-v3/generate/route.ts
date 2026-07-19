import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  comfyHeaders,
  extractJobId,
  getComfyBaseUrl,
  requireComfyConfig,
} from "@/lib/comfy-cloud";
import { createDepthClockV3Workflow } from "@/lib/depth-clock-v3-workflow";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 24_000_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const current = rateLimit.get(ip);

  if (!current || current.resetAt <= now) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  current.count += 1;
  return true;
}

async function uploadImageToComfy(file: File) {
  const formData = new FormData();
  formData.append("image", file, file.name || "depth-clock-upload.png");
  formData.append("overwrite", "true");

  const response = await fetch(`${getComfyBaseUrl()}/api/upload/image`, {
    method: "POST",
    headers: comfyHeaders(),
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Comfy image upload failed:", payload);
    throw new Error("Image upload failed.");
  }

  const filename =
    typeof payload?.name === "string"
      ? payload.name
      : typeof payload?.filename === "string"
        ? payload.filename
        : file.name;

  if (!filename) {
    console.error("Comfy image upload returned no filename:", payload);
    throw new Error("Image upload failed.");
  }

  return filename;
}

async function submitDepthWorkflow(imageName: string) {
  const workflow = createDepthClockV3Workflow(imageName);
  const response = await fetch(`${getComfyBaseUrl()}/api/prompt`, {
    method: "POST",
    headers: comfyHeaders("application/json"),
    body: JSON.stringify({ prompt: workflow }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Comfy prompt submit failed:", payload);
    throw new Error("Depth workflow failed.");
  }

  const jobId = extractJobId(payload);
  if (!jobId) {
    console.error("Comfy prompt response returned no job id:", payload);
    throw new Error("Depth workflow failed.");
  }

  return jobId;
}

export async function POST(request: NextRequest) {
  try {
    requireComfyConfig();

    if (!checkRateLimit(getClientIp(request))) {
      return NextResponse.json(
        { error: "Too many depth requests. Please try again later." },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image is required." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(image.type)) {
      return NextResponse.json(
        { error: "Upload a PNG, JPEG, or WebP image." },
        { status: 400 },
      );
    }

    if (image.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image must be 10 MB or smaller." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);

    if (!metadata.width || !metadata.height || pixels > MAX_IMAGE_PIXELS) {
      return NextResponse.json(
        { error: "Image dimensions are too large for this experiment." },
        { status: 400 },
      );
    }

    const uploadFile = new File([buffer], image.name || "depth-clock-upload", {
      type: image.type,
    });
    const imageName = await uploadImageToComfy(uploadFile);
    const jobId = await submitDepthWorkflow(imageName);

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error("Depth clock generation error:", error);
    if (
      error instanceof Error &&
      error.message.includes("COMFY_CLOUD_API_KEY")
    ) {
      return NextResponse.json(
        { error: "Comfy Cloud API key is not configured." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Unable to start depth generation." },
      { status: 500 },
    );
  }
}
