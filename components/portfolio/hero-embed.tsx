"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface HeroEmbedProps {
  src: string;
  title: string;
}

export function HeroEmbed({ src, title }: HeroEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleAudio = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const func = muted ? "unMute" : "mute";
    win.postMessage(
      JSON.stringify({ event: "command", func, args: "" }),
      "*",
    );
    setMuted((prev) => !prev);
  };

  return (
    <>
      <iframe
        ref={iframeRef}
        className="absolute inset-0 h-full w-full"
        src={src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
      <button
        type="button"
        onClick={toggleAudio}
        aria-label={muted ? "Unmute video" : "Mute video"}
        aria-pressed={!muted}
        className="absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur-sm transition-colors hover:bg-background sm:right-6 sm:top-6"
      >
        {muted ? (
          <VolumeX className="size-4" />
        ) : (
          <Volume2 className="size-4" />
        )}
      </button>
    </>
  );
}
