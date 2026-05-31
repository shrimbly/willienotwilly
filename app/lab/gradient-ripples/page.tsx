import type { Metadata } from "next";
import { GradientRipplesLab } from "@/components/lab/gradient-ripples";

export const metadata: Metadata = {
  title: "Gradient Ripples",
  robots: { index: false, follow: false },
};

export default function GradientRipplesPage() {
  return <GradientRipplesLab />;
}
