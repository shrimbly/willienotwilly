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
    src: "/images/Sudden-jumps/Flux%20SWG.png",
    alt: "Flux sudden jump example",
  },
  {
    src: "/images/Sudden-jumps/Seedream%20SWG1.png",
    alt: "SeeDream sudden jump example 1",
  },
  {
    src: "/images/Sudden-jumps/Seedream%20SWG2.png",
    alt: "SeeDream sudden jump example 2",
  },
  {
    src: "/images/Sudden-jumps/Seedream%20SWG3.png",
    alt: "SeeDream sudden jump example 3",
  },
];

export function SuddenJumpsGallery() {
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
                  <div className="relative block aspect-[16/10] w-full">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="rounded-none object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 70vw, 60vw"
                      priority={false}
                    />
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-6 sm:-left-10" />
        <CarouselNext className="-right-6 sm:-right-10" />
      </Carousel>
    </div>
  );
}
