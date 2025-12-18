#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Upload Bills Supra blog images to Cloudflare R2.
 *
 * Usage: node scripts/upload-bills-supra.js
 *
 * Environment:
 *  - R2_BUCKET (required)
 *  - R2_ACCESS_KEY_ID (required)
 *  - R2_SECRET_ACCESS_KEY (required)
 *  - R2_ACCOUNT_ID or R2_ENDPOINT (required)
 *  - R2_REGION (optional, defaults to "auto")
 *  - DRY_RUN=1 to skip uploads
 */

const fs = require("fs");
const path = require("path");

// Load .env.local if it exists
const envPath = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        let value = trimmed.slice(eqIndex + 1);
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

process.stdout.on("error", (err) => {
  if (err && err.code !== "EPIPE") {
    throw err;
  }
});

const SOURCE_DIR = String.raw`C:\Users\Admin\Desktop\test-files\node banana\fash\ballmer\out\blog`;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_REGION = process.env.R2_REGION || "auto";
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const TARGET_WIDTH = 1500;
const WEBP_QUALITY = 85;
const DRY_RUN = process.env.DRY_RUN === "1";
const PUBLIC_PREFIX = "images/bills-supra";

if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error(
    "Missing required R2 configuration. Please set R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ACCOUNT_ID or R2_ENDPOINT."
  );
  process.exit(1);
}

// Map source filenames to destination names
const FILE_MAP = {
  "bill.png": "style-setting.webp",
  "contact-sheet-1.png": "contact-sheet-1.webp",
  "chillBill.jpg": "chill-bill.webp",
  "ballmer.png": "ballmer-cameo.webp",
  "billremoval.png": "bill-removal.webp",
  "contact sheet 2.png": "contact-sheet-2.webp",
  "type.png": "typography.webp",
};

// Additional files from other locations
const EXTRA_FILES = [
  {
    source: String.raw`C:\Users\Admin\Downloads\Bills-Supra OG.jpg`,
    dest: "og.webp",
  },
];

const s3 = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

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

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SOURCE_DIR);
  console.log(`Found ${files.length} files in source directory`);

  for (const [sourceFile, destFile] of Object.entries(FILE_MAP)) {
    const sourcePath = path.join(SOURCE_DIR, sourceFile);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`Warning: Source file not found: ${sourceFile}`);
      continue;
    }

    console.log(`Processing ${sourceFile} -> ${destFile}`);
    const buffer = await toWebpBuffer(sourcePath);
    const key = `${PUBLIC_PREFIX}/${destFile}`;
    await uploadImage(buffer, key);
  }

  // Upload extra files from other locations
  for (const { source, dest } of EXTRA_FILES) {
    if (!fs.existsSync(source)) {
      console.warn(`Warning: Extra file not found: ${source}`);
      continue;
    }

    console.log(`Processing ${path.basename(source)} -> ${dest}`);
    const buffer = await toWebpBuffer(source);
    const key = `${PUBLIC_PREFIX}/${dest}`;
    await uploadImage(buffer, key);
  }

  console.log("\nDone. Update your MDX file to use these URLs:");
  console.log("https://assets.willienotwilly.com/images/bills-supra/<filename>.webp");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
