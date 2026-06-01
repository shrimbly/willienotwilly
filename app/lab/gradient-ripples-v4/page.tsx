import type { Metadata } from "next";
import { GradientRipplesLab } from "@/components/lab/gradient-ripples";

export const metadata: Metadata = {
  title: "Chromatic Clock V4",
  description: "A clean glass clock over a slow sage chromatic field.",
  openGraph: {
    title: "Chromatic Clock V4",
    description: "A clean glass clock over a slow sage chromatic field.",
    images: [
      {
        url: "/lab/gradient-ripples-v4-og.jpg",
        width: 1200,
        height: 630,
        alt: "Chromatic Clock V4 glass clock over a sage gradient field",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chromatic Clock V4",
    description: "A clean glass clock over a slow sage chromatic field.",
    images: ["/lab/gradient-ripples-v4-og.jpg"],
  },
  robots: { index: false, follow: false },
};

export default function GradientRipplesV4Page() {
  return <GradientRipplesLab variant="v4" />;
}
