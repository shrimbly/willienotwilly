import type { Metadata } from "next";
import { GradientRipplesLab } from "@/components/lab/gradient-ripples";

export const metadata: Metadata = {
  title: "Chromatic Field V2",
  robots: { index: false, follow: false },
};

export default function GradientRipplesV2Page() {
  return <GradientRipplesLab variant="v2" />;
}
