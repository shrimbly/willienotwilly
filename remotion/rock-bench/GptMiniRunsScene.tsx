import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile } from "remotion";
import { END_PAUSE_FRAMES } from "./RockBenchScene";

const VIDEO_SOURCES = [
  staticFile("videos/gptmini_evolution_2.mp4"),
  staticFile("videos/gptmini_evolution_3.mp4"),
  staticFile("videos/gptmini_evolution_4.mp4"),
  staticFile("videos/gptmini_evolution_5.mp4"),
];

type GptMiniRunsSceneProps = {
  durationInFrames: number;
  videoDurationInFrames: number;
};

export function GptMiniRunsScene({
  durationInFrames,
  videoDurationInFrames,
}: GptMiniRunsSceneProps) {
  const videoPortion = durationInFrames - END_PAUSE_FRAMES;

  return (
    <AbsoluteFill
      style={{
        background: "#ffffff",
        color: "#1a1a1a",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 32,
          left: 0,
          right: 0,
          textAlign: "center",
          fontWeight: 700,
          fontSize: 56,
          letterSpacing: -0.5,
          textShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        Other GPT-mini runs
      </div>

      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          padding: "140px 72px 72px",
          gap: 16,
          boxSizing: "border-box",
        }}
      >
        {VIDEO_SOURCES.map((videoSrc, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              aspectRatio: "1 / 1",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              background: "black",
              position: "relative",
            }}
          >
            <AbsoluteFill
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Normal video playback */}
              <Sequence durationInFrames={videoPortion}>
                <OffthreadVideo
                  src={videoSrc}
                  startFrom={0}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              </Sequence>
              {/* End pause: hold last frame */}
              <Sequence from={videoPortion} durationInFrames={END_PAUSE_FRAMES}>
                <Freeze frame={videoDurationInFrames - 1}>
                  <OffthreadVideo
                    src={videoSrc}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                    }}
                  />
                </Freeze>
              </Sequence>
            </AbsoluteFill>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

