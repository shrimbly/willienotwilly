#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Convert rock-bench recursion images to 1000px WebP and upload to Cloudflare R2.
 *
 * Environment:
 *  - ROCK_BENCH_SOURCE (optional): path containing output_* folders (defaults to ../rock-bench)
 *  - R2_BUCKET (required)
 *  - R2_ACCESS_KEY_ID (required)
 *  - R2_SECRET_ACCESS_KEY (required)
 *  - R2_ACCOUNT_ID or R2_ENDPOINT (required: endpoint will be derived from account id if not provided)
 *  - R2_REGION (optional, defaults to "auto")
 *  - ROCK_BENCH_WIDTH (optional, default 1000)
 *  - ROCK_BENCH_QUALITY (optional, default 80)
 *  - DRY_RUN=1 to skip uploads
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Swallow EPIPE when output is piped/closed mid-run
process.stdout.on("error", (err) => {
  if (err && err.code !== "EPIPE") {
    throw err;
  }
});

const SOURCE_ROOT =
  process.env.ROCK_BENCH_SOURCE ||
  path.resolve(process.cwd(), "..", "rock-bench");
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_REGION = process.env.R2_REGION || "auto";
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const TARGET_WIDTH = Number(process.env.ROCK_BENCH_WIDTH || 1000);
const WEBP_QUALITY = Number(process.env.ROCK_BENCH_QUALITY || 80);
const DRY_RUN = process.env.DRY_RUN === "1";
const PUBLIC_PREFIX = "rock-bench";

if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error(
    "Missing required R2 configuration. Please set R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ACCOUNT_ID or R2_ENDPOINT."
  );
  process.exit(1);
}

const MODEL_KEY_MAP = {
  gpt: "gpt",
  gptmini: "gptMini",
  flux: "flux",
  seedream: "seedream",
  qwen: "qwen",
  nanobana: "nanoBanana",
  nano_banana_pro: "nanoBananaPro",
};

const s3 = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function padIndex(index) {
  return String(index).padStart(3, "0");
}

function sortByImageNumber(files) {
  return [...files].sort((a, b) => {
    const aNum = Number(a.match(/(\d+)/)?.[0] || 0);
    const bNum = Number(b.match(/(\d+)/)?.[0] || 0);
    return aNum - bNum;
  });
}

async function toWebpBuffer(filePath) {
  return sharp(filePath)
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

async function uploadImage(buffer, key) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${key} (${(buffer.length / 1024).toFixed(1)}kb)`);
    return;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "image/webp",
    })
  );
  console.log(`Uploaded ${key}`);
}

async function processFolder(dirent) {
  const modelFolder = dirent.name;
  const rawModel = modelFolder.replace(/^output_/, "");
  const modelKey = MODEL_KEY_MAP[rawModel];

  if (!modelKey) {
    console.warn(`Skipping unrecognized folder: ${modelFolder}`);
    return;
  }

  const folderPath = path.join(SOURCE_ROOT, modelFolder);
  const files = fs
    .readdirSync(folderPath)
    .filter((file) => /\.(png|jpe?g|webp)$/i.test(file));

  const sortedFiles = sortByImageNumber(files);
  console.log(
    `Processing ${modelFolder} (${sortedFiles.length} images) as ${modelKey}`
  );

  for (const file of sortedFiles) {
    const match = file.match(/(\d+)/);
    const imageIndex = Number(match?.[0] || 0);
    const sourcePath = path.join(folderPath, file);
    const buffer = await toWebpBuffer(sourcePath);
    const key = `${PUBLIC_PREFIX}/${modelKey}/image_${padIndex(imageIndex)}.webp`;
    await uploadImage(buffer, key);
  }
}

async function main() {
  const entries = fs
    .readdirSync(SOURCE_ROOT, { withFileTypes: true })
    .filter(
      (dirent) =>
        dirent.isDirectory() &&
        dirent.name.startsWith("output_") &&
        dirent.name !== "output_gptmini_tall"
    );

  if (!entries.length) {
    console.error(
      `No output_* folders found in ${SOURCE_ROOT}. Set ROCK_BENCH_SOURCE if needed.`
    );
    process.exit(1);
  }

  for (const dirent of entries) {
    // Sequential to avoid spiking memory/egress
    await processFolder(dirent);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
