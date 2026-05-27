import type { Metadata } from "next";
import { BrandColorGame } from "@/components/lab/brand-color-game";

export const metadata: Metadata = {
  title: "Brand Color Game",
  robots: { index: false, follow: false },
};

export default function BrandColorGamePage() {
  return <BrandColorGame />;
}
