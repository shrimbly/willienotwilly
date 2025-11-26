"use client";

import * as React from "react";
import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

const images = [
  {
    src: "/images/gpt-mini-results/image_100.png",
    alt: "GPT-Image1-mini recursion 100 - primary run",
    video: "/videos/gptmini_evolution.mp4",
  },
  {
    src: "/images/gpt-mini-results/image_100-2.png",
    alt: "GPT-Image1-mini recursion 100 - variation 2",
    video: "/videos/gptmini_evolution_2.mp4",
  },
  {
    src: "/images/gpt-mini-results/image_100-3.png",
    alt: "GPT-Image1-mini recursion 100 - variation 3",
    video: "/videos/gptmini_evolution_3.mp4",
  },
  {
    src: "/images/gpt-mini-results/image_100-4.png",
    alt: "GPT-Image1-mini recursion 100 - variation 4",
    video: "/videos/gptmini_evolution_4.mp4",
  },
  {
    src: "/images/gpt-mini-results/image_100-5.png",
    alt: "GPT-Image1-mini recursion 100 - variation 5",
    video: "/videos/gptmini_evolution_5.mp4",
  },
];

export function GptMiniGallery() {
  const [activeVideo, setActiveVideo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveVideo(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="not-prose w-full">
      <Carousel className="w-full" opts={{ align: "start", loop: true }}>
        <CarouselContent>
          {images.map((image) => (
            <CarouselItem
              key={image.src}
              className="sm:basis-3/4 md:basis-2/3"
            >
              <Card className="h-full overflow-hidden rounded-xl border bg-card p-0 shadow-sm gap-0">
                <CardContent className="relative h-full p-0 px-0">
                  <button
                    type="button"
                    className="relative block aspect-[4/5] w-full cursor-pointer"
                    onClick={() => setActiveVideo(image.video)}
                    aria-label="Show progression video"
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="rounded-none object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 70vw, 60vw"
                      priority={false}
                    />
                  </button>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-6 sm:-left-10" />
        <CarouselNext className="-right-6 sm:-right-10" />
      </Carousel>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Click image to show progression video
      </p>
      {activeVideo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              onClick={() => setActiveVideo(null)}
              aria-label="Close lightbox"
            >
              X
            </button>
            <video
              src={activeVideo}
              controls
              autoPlay
              className="h-full w-full rounded-2xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
