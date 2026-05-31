import type { Metadata } from "next";
import { FaceWallArLab } from "@/components/lab/face-wall-ar-lab";

export const metadata: Metadata = {
  title: "Face Wall AR",
  robots: { index: false, follow: false },
};

export default function FaceWallArPage() {
  return <FaceWallArLab />;
}
