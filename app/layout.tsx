import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://willienotwilly.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Willie Falloon",
    template: "%s | Willie Falloon",
  },
  description:
    "Personal projects and experiments in AI, image models, radiance fields, and large language models.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Willie Falloon",
    title: "Willie Falloon",
    description:
      "Personal projects and experiments in AI, image models, radiance fields, and large language models.",
    images: [
      {
        url: "/willienotwilly-og.jpg",
        width: 1200,
        height: 630,
        alt: "Willie Not Willy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Willie Falloon",
    description:
      "Personal projects and experiments in AI, image models, radiance fields, and large language models.",
    images: ["/willienotwilly-og.jpg"],
    creator: "@ReflctWillie",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
