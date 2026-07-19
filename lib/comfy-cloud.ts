export type ComfyImageRef = {
  filename: string;
  subfolder?: string;
  type?: string;
};

const DEFAULT_COMFY_BASE_URL = "https://cloud.comfy.org";

export function getComfyBaseUrl() {
  return (process.env.COMFY_CLOUD_BASE_URL || DEFAULT_COMFY_BASE_URL).replace(
    /\/$/,
    "",
  );
}

export function getComfyApiKey() {
  return process.env.COMFY_CLOUD_API_KEY || process.env.COMFY_API_KEY || "";
}

export function comfyHeaders(contentType?: string) {
  const apiKey = getComfyApiKey();
  const headers: Record<string, string> = {};

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-Key"] = apiKey;
  }

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return headers;
}

export function requireComfyConfig() {
  if (!getComfyApiKey()) {
    throw new Error("COMFY_CLOUD_API_KEY or COMFY_API_KEY is not configured.");
  }
}

export function extractJobId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.job_id,
    record.jobId,
    record.prompt_id,
    record.promptId,
    record.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) {
      return candidate;
    }
  }

  const data = record.data;
  if (data && typeof data === "object") {
    return extractJobId(data);
  }

  return null;
}

export function extractStatus(payload: unknown) {
  if (!payload || typeof payload !== "object") return "generating";

  const record = payload as Record<string, unknown>;
  const rawStatus =
    record.status ||
    record.state ||
    record.job_status ||
    record.prompt_status ||
    (record.data as Record<string, unknown> | undefined)?.status ||
    (record.data as Record<string, unknown> | undefined)?.state;

  if (typeof rawStatus !== "string") return "generating";

  const status = rawStatus.toLowerCase();
  if (["completed", "complete", "success", "succeeded", "finished"].includes(status)) {
    return "completed";
  }
  if (["failed", "failure", "error", "cancelled", "canceled"].includes(status)) {
    return "failed";
  }

  return "generating";
}

export function extractFirstImageRef(payload: unknown): ComfyImageRef | null {
  const visited = new Set<unknown>();

  const visit = (value: unknown): ComfyImageRef | null => {
    if (!value || typeof value !== "object" || visited.has(value)) {
      return null;
    }

    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    if (typeof record.filename === "string") {
      return {
        filename: record.filename,
        subfolder: typeof record.subfolder === "string" ? record.subfolder : "",
        type: typeof record.type === "string" ? record.type : "output",
      };
    }

    for (const child of Object.values(record)) {
      const found = visit(child);
      if (found) return found;
    }

    return null;
  };

  return visit(payload);
}
