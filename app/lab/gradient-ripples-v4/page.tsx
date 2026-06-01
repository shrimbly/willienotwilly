import type { Metadata } from "next";
import { GradientRipplesLab } from "@/components/lab/gradient-ripples";

export const metadata: Metadata = {
  title: "Chromatic Clock V4",
  robots: { index: false, follow: false },
};

export default function GradientRipplesV4Page() {
  return <GradientRipplesLab variant="v4" />;
}
