import { NextRequest, NextResponse } from "next/server";
import {
  comfyHeaders,
  extractFirstImageRef,
  extractStatus,
  getComfyBaseUrl,
  requireComfyConfig,
} from "@/lib/comfy-cloud";

export const runtime = "nodejs";

async function fetchComfyJson(path: string) {
  const response = await fetch(`${getComfyBaseUrl()}${path}`, {
    headers: comfyHeaders(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`Comfy request failed for ${path}:`, payload);
    return null;
  }

  return payload;
}

function depthResultUrl(imageRef: {
  filename: string;
  subfolder?: string;
  type?: string;
}) {
  const params = new URLSearchParams({
    filename: imageRef.filename,
    subfolder: imageRef.subfolder || "",
    type: imageRef.type || "output",
  });

  return `/api/depth-clock-v3/result?${params.toString()}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    requireComfyConfig();

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: "Job id is required." }, { status: 400 });
    }

    const statusPayload = await fetchComfyJson(
      `/api/job/${encodeURIComponent(jobId)}/status`,
    );
    const status = extractStatus(statusPayload);

    if (status === "failed") {
      return NextResponse.json({ status: "failed" });
    }

    if (status !== "completed") {
      return NextResponse.json({ status: "generating" });
    }

    const jobPayload =
      (await fetchComfyJson(`/api/jobs/${encodeURIComponent(jobId)}`)) ||
      (await fetchComfyJson(`/api/history_v2/${encodeURIComponent(jobId)}`));
    const imageRef = extractFirstImageRef(jobPayload);

    if (!imageRef) {
      console.error("Comfy completed job returned no image output:", jobPayload);
      return NextResponse.json(
        { status: "failed", error: "Depth image was not found." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: "completed",
      depthImageUrl: depthResultUrl(imageRef),
    });
  } catch (error) {
    console.error("Depth clock job status error:", error);
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
      { error: "Unable to check depth generation." },
      { status: 500 },
    );
  }
}
