import { NextRequest, NextResponse } from "next/server";
import {
  comfyHeaders,
  getComfyBaseUrl,
  requireComfyConfig,
} from "@/lib/comfy-cloud";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    requireComfyConfig();

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const subfolder = searchParams.get("subfolder") || "";
    const type = searchParams.get("type") || "output";

    if (!filename) {
      return NextResponse.json({ error: "Filename is required." }, { status: 400 });
    }

    const params = new URLSearchParams({ filename, subfolder, type });
    const response = await fetch(`${getComfyBaseUrl()}/api/view?${params.toString()}`, {
      headers: comfyHeaders(),
    });

    if (!response.ok || !response.body) {
      const payload = await response.text().catch(() => "");
      console.error("Comfy result proxy failed:", payload);
      return NextResponse.json(
        { error: "Unable to load depth image." },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") || "image/png";

    return new NextResponse(response.body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Depth clock result proxy error:", error);
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
      { error: "Unable to load depth image." },
      { status: 500 },
    );
  }
}
