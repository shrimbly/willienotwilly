import type { Metadata, Viewport } from "next";
import { LifeClockLab } from "@/components/lab/life-clock/life-clock";

// cover: the HUD's env(safe-area-inset-*) values are 0 without it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Life Clock",
  description:
    "A zoomable instrument that renders your day, week, year, and life as elapsed pixels — what's left, in orange.",
  robots: { index: false, follow: false },
};

export default function LifeClockPage() {
  return <LifeClockLab />;
}
