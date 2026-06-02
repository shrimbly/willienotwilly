import type { Metadata } from "next";
import { DepthClockLab } from "@/components/lab/depth-clock";

export const metadata: Metadata = {
  title: "Depth Point-Cloud Clock",
  description: "A depth-map point cloud clock experiment.",
  robots: { index: false, follow: false },
};

export default function DepthClockPage() {
  return <DepthClockLab />;
}
