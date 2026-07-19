import type { Metadata } from "next";
import { DepthClockLab } from "@/components/lab/depth-clock";

export const metadata: Metadata = {
  title: "Depth Dither Clock",
  description:
    "A depth-map clock experiment that renders the point cloud as animated ordered dither cells.",
  robots: { index: false, follow: false },
};

export default function DepthClockV4Page() {
  return <DepthClockLab cloudRenderMode="dither" startControlsHidden />;
}
