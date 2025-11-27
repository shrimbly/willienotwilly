import { AbsoluteFill, Series } from "remotion";
import type { RockBenchSegment } from "./data";
import { RockBenchScene } from "./RockBenchScene";
import { GptMiniRunsScene } from "./GptMiniRunsScene";

const ACCENT_COLORS = [
  "oklch(0.70 0.18 230.00)",
  "oklch(0.74 0.20 55.00)",
  "oklch(0.72 0.24 332.00)",
  "oklch(0.73 0.17 160.00)",
  "oklch(0.69 0.22 25.00)",
  "oklch(0.72 0.16 280.00)",
  "oklch(0.82 0.16 95.00)",
];

type RockBenchCompilationProps = {
  segments: RockBenchSegment[];
  gptMiniRunsDurationInFrames: number;
  gptMiniVideoDurationInFrames: number;
};

export function RockBenchCompilation({
  segments,
  gptMiniRunsDurationInFrames,
  gptMiniVideoDurationInFrames,
}: RockBenchCompilationProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#02040a" }}>
      <Series>
        {segments.map((segment, index) => (
          <Series.Sequence
            key={segment.modelKey}
            durationInFrames={segment.durationInFrames}
          >
            <RockBenchScene
              segment={segment}
              accentColor={ACCENT_COLORS[index % ACCENT_COLORS.length]}
            />
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={gptMiniRunsDurationInFrames}>
          <GptMiniRunsScene
            durationInFrames={gptMiniRunsDurationInFrames}
            videoDurationInFrames={gptMiniVideoDurationInFrames}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}
