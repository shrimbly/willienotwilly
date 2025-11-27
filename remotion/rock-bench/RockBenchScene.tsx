import {
  AbsoluteFill,
  Freeze,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
} from "remotion";
import type { RockBenchSegment } from "./data";

type RockBenchSceneProps = {
  segment: RockBenchSegment;
  accentColor: string;
};

type ChartDimensions = {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

const CHART_DIMENSIONS: ChartDimensions = {
  width: 880,
  height: 840, // Reduced from 920 to make room for TNTR indicator
  marginTop: 80,
  marginRight: 40,
  marginBottom: 120, // Increased from 80 to make room for TNTR indicator
  marginLeft: 80,
};

const FPS = 30;
const SPEED_UP_THRESHOLD_SECONDS = 5;
const SPEED_UP_THRESHOLD_FRAMES = SPEED_UP_THRESHOLD_SECONDS * FPS;
const SPEED_UP_RATE = 3; // 3x speed after threshold
const END_PAUSE_SECONDS = 2;
export const END_PAUSE_FRAMES = END_PAUSE_SECONDS * FPS;

/**
 * Calculate the video frame that should be displayed at a given sequence frame
 * For GPT-Image1: first 5 seconds at 1x, then 3x speed
 * Accounts for the end pause where we hold on the last frame
 */
function getVideoFrameForSequenceFrame(
  sequenceFrame: number,
  isGptImage1: boolean,
  videoDurationInFrames: number,
  segmentDurationInFrames: number
): number {
  // During the end pause, always show the last frame
  const videoPortion = segmentDurationInFrames - END_PAUSE_FRAMES;
  if (sequenceFrame >= videoPortion) {
    return videoDurationInFrames - 1;
  }

  if (!isGptImage1) {
    return Math.min(sequenceFrame, videoDurationInFrames - 1);
  }

  let videoFrame: number;
  if (sequenceFrame <= SPEED_UP_THRESHOLD_FRAMES) {
    // First 5 seconds: 1:1 mapping
    videoFrame = sequenceFrame;
  } else {
    // After threshold: each sequence frame advances 3 video frames
    const framesAfterThreshold = sequenceFrame - SPEED_UP_THRESHOLD_FRAMES;
    videoFrame =
      SPEED_UP_THRESHOLD_FRAMES + framesAfterThreshold * SPEED_UP_RATE;
  }

  return Math.min(videoFrame, videoDurationInFrames - 1);
}

export function RockBenchScene({ segment, accentColor }: RockBenchSceneProps) {
  const frame = useCurrentFrame();

  // Check if this is GPT-Image1 and calculate speed-up logic
  const isGptImage1 = segment.modelKey === "gpt";

  // Use original video duration for chart progress (not the effective duration)
  const videoDurationInFrames =
    segment.originalDurationInFrames ?? segment.durationInFrames;

  // Calculate which video frame should be shown at this sequence frame
  const currentVideoFrame = getVideoFrameForSequenceFrame(
    frame,
    isGptImage1,
    videoDurationInFrames,
    segment.durationInFrames
  );

  // Calculate chart progress based on video frame position
  const progress = Math.min(
    1,
    currentVideoFrame / Math.max(1, videoDurationInFrames)
  );

  // Calculate the remaining frames after threshold for GPT-Image1
  const framesAfterThreshold = videoDurationInFrames - SPEED_UP_THRESHOLD_FRAMES;
  // Duration of the sped-up portion (in sequence frames)
  const speedUpSequenceDuration = Math.ceil(framesAfterThreshold / SPEED_UP_RATE);
  
  // Calculate where the video portion ends (before the pause)
  const videoPortion = segment.durationInFrames - END_PAUSE_FRAMES;
  // For non-GPT models, this is just the video duration
  const normalVideoDuration = Math.min(videoDurationInFrames, videoPortion);

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
        {segment.displayName}
      </div>

      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          padding: "140px 72px 72px",
          gap: 32,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            background: "black",
            position: "relative",
          }}
        >
          {isGptImage1 ? (
            <>
              {/* First 5 seconds: normal speed */}
              <Sequence durationInFrames={SPEED_UP_THRESHOLD_FRAMES}>
                <OffthreadVideo
                  src={segment.videoSrc}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </Sequence>
              {/* After 5 seconds: 3x speed */}
              <Sequence
                from={SPEED_UP_THRESHOLD_FRAMES}
                durationInFrames={speedUpSequenceDuration}
              >
                <OffthreadVideo
                  src={segment.videoSrc}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                  startFrom={SPEED_UP_THRESHOLD_FRAMES}
                  playbackRate={SPEED_UP_RATE}
                />
              </Sequence>
              {/* End pause: hold last frame */}
              <Sequence
                from={videoPortion}
                durationInFrames={END_PAUSE_FRAMES}
              >
                <Freeze frame={videoDurationInFrames - 1}>
                  <OffthreadVideo
                    src={segment.videoSrc}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </Freeze>
              </Sequence>
            </>
          ) : (
            <>
              {/* Normal video playback */}
              <Sequence durationInFrames={normalVideoDuration}>
                <OffthreadVideo
                  src={segment.videoSrc}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </Sequence>
              {/* End pause: hold last frame */}
              <Sequence
                from={normalVideoDuration}
                durationInFrames={END_PAUSE_FRAMES}
              >
                <Freeze frame={videoDurationInFrames - 1}>
                  <OffthreadVideo
                    src={segment.videoSrc}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </Freeze>
              </Sequence>
            </>
          )}
        </div>

        <div
          style={{
            flex: 1,
            padding: "24px 24px 12px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AnimatedChart
            accentColor={accentColor}
            progress={progress}
            points={segment.points}
            dimensions={CHART_DIMENSIONS}
            tntrScore={segment.tntrScore}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}

type AnimatedChartProps = {
  accentColor: string;
  progress: number;
  points: RockBenchSegment["points"];
  dimensions: ChartDimensions;
  tntrScore?: number;
};

function AnimatedChart({
  accentColor,
  progress,
  points,
  dimensions,
  tntrScore,
}: AnimatedChartProps) {
  if (!points.length) return null;

  const { width, height, marginBottom, marginLeft, marginRight, marginTop } =
    dimensions;

  const minX = points[0].imageNumber;
  const maxX = points[points.length - 1].imageNumber;
  const minY = 0;
  const maxY = 1;

  const chartWidth = width - marginLeft - marginRight;
  const chartHeight = height - marginTop - marginBottom;

  const xFor = (x: number) =>
    marginLeft + ((x - minX) / Math.max(1, maxX - minX)) * chartWidth;
  const yFor = (y: number) =>
    marginTop + (1 - (y - minY) / Math.max(1, maxY - minY)) * chartHeight;

  const target = progress * Math.max(1, points.length - 1);
  const baseIndex = Math.floor(target);
  const leftover = target - baseIndex;

  // Calculate current image number based on progress
  const currentImageNumber =
    baseIndex < points.length - 1
      ? Math.round(
          points[baseIndex].imageNumber +
            (points[baseIndex + 1].imageNumber -
              points[baseIndex].imageNumber) *
              leftover
        )
      : points[points.length - 1].imageNumber;

  // Determine if it's still The Rock (imageNumber < tntrScore)
  const isTheRock =
    tntrScore !== undefined ? currentImageNumber < tntrScore : true;

  const visible: { x: number; y: number }[] = [];

  points.forEach((point, index) => {
    if (index < baseIndex) {
      visible.push({ x: point.imageNumber, y: point.ssim });
      return;
    }
    if (index === baseIndex) {
      visible.push({ x: point.imageNumber, y: point.ssim });
      if (index < points.length - 1) {
        const next = points[index + 1];
        visible.push({
          x:
            point.imageNumber +
            (next.imageNumber - point.imageNumber) * leftover,
          y: point.ssim + (next.ssim - point.ssim) * leftover,
        });
      }
    }
  });

  const pathD = visible
    .map((point, index) => {
      const prefix = index === 0 ? "M" : "L";
      return `${prefix} ${xFor(point.x).toFixed(2)} ${yFor(point.y).toFixed(
        2
      )}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
      <defs>
        <linearGradient id="gridGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
        </linearGradient>
      </defs>

      <text
        x={width / 2}
        y={32}
        textAnchor="middle"
        fontSize={24}
        fill="rgba(0,0,0,0.85)"
        fontWeight={600}
        letterSpacing={0.5}
      >
        Structural similarity across 100 generations
      </text>

      <rect
        x={marginLeft}
        y={marginTop}
        width={chartWidth}
        height={chartHeight}
        fill="url(#gridGradient)"
        stroke="rgba(0,0,0,0.08)"
        rx={16}
      />

      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => {
        const y = yFor(tick);
        return (
          <g key={`y-${tick}`}>
            <line
              x1={marginLeft}
              x2={marginLeft + chartWidth}
              y1={y}
              y2={y}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={1}
            />
            <text
              x={marginLeft - 12}
              y={y + 4}
              textAnchor="end"
              fontSize={18}
              fill="rgba(0,0,0,0.6)"
            >
              {tick.toFixed(1)}
            </text>
          </g>
        );
      })}

      {[minX, Math.round((minX + maxX) / 2), maxX].map((tick) => {
        const x = xFor(tick);
        return (
          <g key={`x-${tick}`}>
            <line
              x1={x}
              x2={x}
              y1={marginTop}
              y2={marginTop + chartHeight}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={marginTop + chartHeight + 24}
              textAnchor="middle"
              fontSize={18}
              fill="rgba(0,0,0,0.6)"
            >
              {tick}
            </text>
          </g>
        );
      })}

      <text
        x={marginLeft + chartWidth / 2}
        y={marginTop + chartHeight + 48}
        textAnchor="middle"
        fontSize={20}
        fill="rgba(0,0,0,0.75)"
        fontWeight={600}
      >
        Image Number (Recursion)
      </text>

      <text
        x={marginLeft - 64}
        y={marginTop + chartHeight / 2}
        textAnchor="middle"
        fontSize={20}
        fill="rgba(0,0,0,0.75)"
        fontWeight={600}
        transform={`rotate(-90 ${marginLeft - 64} ${marginTop + chartHeight / 2})`}
      >
        SSIM
      </text>

      {/* Vertical line at TNTR score - only show after reaching Not The Rock */}
      {tntrScore !== undefined &&
        tntrScore >= minX &&
        tntrScore <= maxX &&
        !isTheRock && (
          <line
            x1={xFor(tntrScore)}
            x2={xFor(tntrScore)}
            y1={marginTop}
            y2={marginTop + chartHeight}
            stroke="rgba(239, 68, 68, 0.6)"
            strokeWidth={3}
            strokeDasharray="8 4"
          />
        )}

      <path
        d={pathD}
        fill="none"
        stroke={accentColor}
        strokeWidth={8}
        strokeLinecap="round"
        style={{
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))",
        }}
      />

      {visible.map((point, index) => (
        <circle
          key={`${point.x}-${index}`}
          cx={xFor(point.x)}
          cy={yFor(point.y)}
          r={10}
          fill={accentColor}
          opacity={index === visible.length - 1 ? 1 : 0.7}
        />
      ))}

      {/* TNTR Indicator */}
      {tntrScore !== undefined && (
        <text
          x={marginLeft}
          y={height}
          textAnchor="start"
          fontSize={28}
          fill="rgba(0,0,0,0.9)"
          fontWeight={700}
          letterSpacing={0.5}
        >
          {isTheRock ? "The Rock ✅" : "Not The Rock ❌"}
        </text>
      )}
    </svg>
  );
}
