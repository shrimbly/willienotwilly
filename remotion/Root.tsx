import React from "react";
import { Composition, registerRoot, staticFile } from "remotion";
import { RockBenchCompilation } from "./rock-bench/RockBenchCompilation";
import { getBaseSegments, RockBenchSegment } from "./rock-bench/data";
import { END_PAUSE_FRAMES } from "./rock-bench/RockBenchScene";
import { getVideoMetadata } from "@remotion/media-utils";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const GPT_MINI_RUNS_VIDEOS = [
  staticFile("videos/gptmini_evolution_2.mp4"),
  staticFile("videos/gptmini_evolution_3.mp4"),
  staticFile("videos/gptmini_evolution_4.mp4"),
  staticFile("videos/gptmini_evolution_5.mp4"),
];

type RockBenchCompilationProps = {
  segments: RockBenchSegment[];
  gptMiniRunsDurationInFrames: number;
  gptMiniVideoDurationInFrames: number;
};

const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="rock-bench-compilation"
      component={RockBenchCompilation}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={FPS * 10}
      defaultProps={{
        segments: [],
        gptMiniRunsDurationInFrames: FPS * 10,
        gptMiniVideoDurationInFrames: FPS * 10,
      } as RockBenchCompilationProps}
      calculateMetadata={async () => {
        const baseSegments = getBaseSegments();

        const SPEED_UP_THRESHOLD_SECONDS = 5;
        const SPEED_UP_THRESHOLD_FRAMES = SPEED_UP_THRESHOLD_SECONDS * FPS;
        const SPEED_UP_RATE = 3;

        const segments: RockBenchSegment[] = await Promise.all(
          baseSegments.map(async (segment) => {
            try {
              console.log(`Parsing duration for ${segment.videoSrc}...`);
              const { durationInSeconds } = await getVideoMetadata(segment.videoSrc);
              console.log(`Got duration ${durationInSeconds}s for ${segment.videoSrc}`);
              
              const fullDurationInFrames = Math.max(
                1,
                Math.round(durationInSeconds * FPS)
              );

              // For GPT-Image1, calculate effective duration with speed-up
              if (segment.modelKey === "gpt") {
                const remainingFrames = fullDurationInFrames - SPEED_UP_THRESHOLD_FRAMES;
                const effectiveDuration = SPEED_UP_THRESHOLD_FRAMES + remainingFrames / SPEED_UP_RATE;
                return {
                  ...segment,
                  durationInFrames: Math.max(1, Math.round(effectiveDuration)) + END_PAUSE_FRAMES,
                  originalDurationInFrames: fullDurationInFrames,
                };
              }

              return {
                ...segment,
                durationInFrames: fullDurationInFrames + END_PAUSE_FRAMES,
              };
            } catch (error) {
              console.warn(
                `Failed to read duration for ${segment.videoSrc}, defaulting to 10s`,
                error
              );
              const defaultDuration = FPS * 10;
              // Apply speed-up logic for GPT-Image1 even with default duration
              if (segment.modelKey === "gpt") {
                const remainingFrames = defaultDuration - SPEED_UP_THRESHOLD_FRAMES;
                const effectiveDuration = SPEED_UP_THRESHOLD_FRAMES + remainingFrames / SPEED_UP_RATE;
                return {
                  ...segment,
                  durationInFrames: Math.max(1, Math.round(effectiveDuration)) + END_PAUSE_FRAMES,
                  originalDurationInFrames: defaultDuration,
                };
              }
              return {
                ...segment,
                durationInFrames: defaultDuration + END_PAUSE_FRAMES,
              };
            }
          })
        );

        // Calculate duration for GPT-mini runs sequence (use longest video)
        const gptMiniRunsDurations = await Promise.all(
          GPT_MINI_RUNS_VIDEOS.map(async (videoSrc) => {
            try {
              console.log(`Parsing duration for ${videoSrc}...`);
              const { durationInSeconds } = await getVideoMetadata(videoSrc);
              console.log(`Got duration ${durationInSeconds}s for ${videoSrc}`);
              return Math.max(1, Math.round(durationInSeconds * FPS));
            } catch (error) {
              console.warn(
                `Failed to read duration for ${videoSrc}, defaulting to 10s`,
                error
              );
              return FPS * 10;
            }
          })
        );

        const gptMiniVideoDurationInFrames = Math.max(...gptMiniRunsDurations);
        const gptMiniRunsDurationInFrames = gptMiniVideoDurationInFrames + END_PAUSE_FRAMES;

        const segmentsDuration = segments.reduce(
          (total, segment) => total + segment.durationInFrames,
          0
        );

        const totalDurationInFrames =
          segmentsDuration + gptMiniRunsDurationInFrames;

        console.log(`Total duration calculated: ${totalDurationInFrames} frames`);
        console.log(`Segments duration: ${segmentsDuration} frames`);
        console.log(`GPT-mini runs duration: ${gptMiniRunsDurationInFrames} frames`);

        return {
          durationInFrames: totalDurationInFrames,
          props: {
            segments,
            gptMiniRunsDurationInFrames,
            gptMiniVideoDurationInFrames,
          },
        };
      }}
    />
  </>
);

registerRoot(RemotionRoot);
