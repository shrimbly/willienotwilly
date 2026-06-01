import type { Metadata } from "next";
import { GradientRipplesLab } from "@/components/lab/gradient-ripples";

export const metadata: Metadata = {
  title: "Chromatic Clock",
  robots: { index: false, follow: false },
};

export default function GradientRipplesV3Page() {
  return <GradientRipplesLab variant="v3" />;
}
