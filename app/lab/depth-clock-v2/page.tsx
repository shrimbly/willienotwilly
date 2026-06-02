import type { Metadata } from "next";
import { DepthClockLab } from "@/components/lab/depth-clock";

export const metadata: Metadata = {
  title: "Depth Point-Cloud Clock V2",
  description:
    "A depth-map point cloud clock with fog bands, chromatic depth, and a particle-embossed clock.",
  robots: { index: false, follow: false },
};

export default function DepthClockV2Page() {
  return <DepthClockLab startControlsHidden />;
}
