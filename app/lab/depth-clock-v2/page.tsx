import type { Metadata } from "next";
import { DepthClockLab } from "@/components/lab/depth-clock";

export const metadata: Metadata = {
  title: "Depth Point-Cloud Clock V2",
  description:
    "A depth-map point cloud clock with fog bands, chromatic depth, and a particle-embossed clock.",
  openGraph: {
    title: "Depth Point-Cloud Clock V2",
    description:
      "A depth-map point cloud clock with fog bands, chromatic depth, and a particle-embossed clock.",
    images: [
      {
        url: "/lab/depth-clock/depth-clock-v2-og.png",
        width: 1200,
        height: 630,
        alt: "Depth point-cloud clock with cinematic particle depth and blue clock numerals",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Depth Point-Cloud Clock V2",
    description:
      "A depth-map point cloud clock with fog bands, chromatic depth, and a particle-embossed clock.",
    images: ["/lab/depth-clock/depth-clock-v2-og.png"],
  },
  robots: { index: false, follow: false },
};

export default function DepthClockV2Page() {
  return <DepthClockLab startControlsHidden />;
}
