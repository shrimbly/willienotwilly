#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Upload a video file to Cloudflare R2.
 *
 * Usage: node scripts/upload-video.js <local-path> [r2-key]
 * Example: node scripts/upload-video.js public/videos/contact-sheet/tim-cooked2_aac.mp4
 *          -> uploads to videos/contact-sheet/tim-cooked2_aac.mp4
 *
 * Environment:
 *  - R2_BUCKET (required)
 *  - R2_ACCESS_KEY_ID (required)
 *  - R2_SECRET_ACCESS_KEY (required)
 *  - R2_ACCOUNT_ID or R2_ENDPOINT (required)
 *  - R2_REGION (optional, defaults to "auto")
 */

const fs = require("fs");
const path = require("path");
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

if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error(
    "Missing required R2 configuration. Please set R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ACCOUNT_ID or R2_ENDPOINT."
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

const MIME_TYPES = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

async function uploadVideo(localPath, r2Key) {
  const ext = path.extname(localPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "video/mp4";

  const fileBuffer = fs.readFileSync(localPath);
  const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

  console.log(`Uploading ${localPath} (${fileSizeMB}MB) to ${r2Key}...`);

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  const publicUrl = `https://assets.willienotwilly.com/${r2Key}`;
  console.log(`\nUploaded successfully!`);
  console.log(`Public URL: ${publicUrl}`);
  console.log(`\nUse in MDX: <LocalVideo src="${publicUrl}" />`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("Usage: node scripts/upload-video.js <local-path> [r2-key]");
    console.log(
      "Example: node scripts/upload-video.js public/videos/contact-sheet/video.mp4"
    );
    process.exit(1);
  }

  const localPath = args[0];

  if (!fs.existsSync(localPath)) {
    console.error(`File not found: ${localPath}`);
    process.exit(1);
  }

  // Default key: strip "public/" prefix if present
  let r2Key = args[1];
  if (!r2Key) {
    r2Key = localPath.replace(/^public[\\/]/, "").replace(/\\/g, "/");
  }

  await uploadVideo(localPath, r2Key);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
