import type { Metadata } from "next";
import { DepthClockLab } from "@/components/lab/depth-clock";

export const metadata: Metadata = {
  title: "Depth Point-Cloud Clock V2",
  description: "A depth-map point cloud clock with a liquid glass surface.",
  robots: { index: false, follow: false },
};

export default function DepthClockV2Page() {
  return <DepthClockLab liquidGlass />;
}
