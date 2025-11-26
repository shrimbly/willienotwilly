interface LocalVideoProps {
  src: string;
  poster?: string;
  className?: string;
  caption?: string;
}

export function LocalVideo({
  src,
  poster,
  caption,
  className = "w-full rounded-lg shadow-lg",
}: LocalVideoProps) {
  return (
    <figure className="my-8 space-y-2 text-center">
      <video
        controls
        playsInline
        poster={poster}
        className={className}
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {caption ? (
        <figcaption className="mx-auto max-w-2xl text-base italic leading-relaxed text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
