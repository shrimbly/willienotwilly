#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Upload portfolio media (encoded videos, posters, supporting images) to R2.
 *
 * Mirrors the same .env.local + @aws-sdk/client-s3 pattern as upload-bills-supra.js.
 *
 * Usage:
 *   node scripts/upload-portfolio.js
 *   DRY_RUN=1 node scripts/upload-portfolio.js
 *
 * Required env (loaded from .env.local if present):
 *   R2_BUCKET
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_ACCOUNT_ID   (or R2_ENDPOINT)
 */

const fs = require("fs");
const path = require("path");

// --- env loader (matches upload-bills-supra.js) ---
const envPath = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_REGION = process.env.R2_REGION || "auto";
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const DRY_RUN = process.env.DRY_RUN === "1";

if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error(
    "Missing R2 env. Need R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID (or R2_ENDPOINT).",
  );
  process.exit(1);
}

const s3 = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const CACHE_CONTROL = "public, max-age=31536000, immutable";

const EXCLUDE_DIRS = new Set(["_originals", "encoded"]);
const EXCLUDE_NAMES = new Set([".DS_Store", "_report.txt"]);

const MIME = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      if (EXCLUDE_NAMES.has(entry.name)) continue;
      yield path.join(dir, entry.name);
    }
  }
}

async function uploadFile(absPath, key) {
  const ext = path.extname(absPath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const body = fs.readFileSync(absPath);
  const sizeKb = (body.length / 1024).toFixed(1);

  if (DRY_RUN) {
    console.log(`[dry] ${key}  (${sizeKb}kb, ${contentType})`);
    return body.length;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
    }),
  );
  console.log(`✓ ${key}  (${sizeKb}kb)`);
  return body.length;
}

// Mapping of local source root → R2 key prefix
const ROOTS = [
  {
    src: path.resolve(__dirname, "..", "public", "videos", "portfolio"),
    prefix: "videos/portfolio",
  },
  {
    src: path.resolve(__dirname, "..", "public", "images", "portfolio"),
    prefix: "images/portfolio",
  },
  {
    src: path.resolve(__dirname, "..", "public", "images", "contact-sheet"),
    prefix: "images/contact-sheet",
  },
];

(async () => {
  console.log(`Bucket: ${R2_BUCKET}   Endpoint: ${R2_ENDPOINT}`);
  console.log(`Mode:   ${DRY_RUN ? "DRY RUN" : "live upload"}\n`);

  let totalBytes = 0;
  let totalFiles = 0;

  for (const { src, prefix } of ROOTS) {
    if (!fs.existsSync(src)) {
      console.log(`(skip) ${src} not found`);
      continue;
    }
    console.log(`— ${src}  →  r2:${R2_BUCKET}/${prefix}/`);
    for (const abs of walk(src)) {
      const rel = path.relative(src, abs).split(path.sep).join("/");
      const key = `${prefix}/${rel}`;
      const bytes = await uploadFile(abs, key);
      totalBytes += bytes;
      totalFiles += 1;
    }
    console.log("");
  }

  console.log(
    `${DRY_RUN ? "Would upload" : "Uploaded"} ${totalFiles} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB total.`,
  );
  console.log("\nVerify with:");
  console.log(
    "  curl -I https://assets.willienotwilly.com/videos/portfolio/banana.mp4",
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
