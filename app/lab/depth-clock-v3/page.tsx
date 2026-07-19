import type { Metadata } from "next";
import { DepthClockUploadLab } from "@/components/lab/depth-clock-upload";

export const metadata: Metadata = {
  title: "Depth Clock Upload",
  description:
    "Upload an image and generate a Depth Anything V2 map through Comfy Cloud for the depth point-cloud clock.",
  robots: { index: false, follow: false },
};

export default function DepthClockV3Page() {
  return <DepthClockUploadLab />;
}
