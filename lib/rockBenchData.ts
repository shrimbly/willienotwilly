import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { cache } from "react";
import { ChartDataPoint, MODELS } from "./rockBenchTypes";

export type { ChartDataPoint, ModelInfo } from "./rockBenchTypes";
export { MODELS } from "./rockBenchTypes";

// Cache the parsed data to avoid re-parsing on every request
export const getRockBenchData = cache((): ChartDataPoint[] => {
  const csvPath = path.join(process.cwd(), "public/data/rock-bench.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");

  const parsed = Papa.parse<{
    model: string;
    image_number: string;
    image_filename: string;
    ssim: string;
    psnr: string;
  }>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  // Pivot data: transform from long format to wide format
  const pivoted: { [key: number]: ChartDataPoint } = {};

  parsed.data.forEach((row) => {
    const imageNum = parseInt(row.image_number);
    const ssim = parseFloat(row.ssim);

    if (!pivoted[imageNum]) {
      pivoted[imageNum] = { imageNumber: imageNum };
    }

    // Map CSV model names to chart keys
    const modelInfo = MODELS.find((m) => m.csvName === row.model);
    if (modelInfo) {
      pivoted[imageNum][modelInfo.key] = ssim;
    }
  });

  // Convert to array and sort by image number
  return Object.values(pivoted).sort((a, b) => a.imageNumber - b.imageNumber);
});
