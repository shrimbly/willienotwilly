"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { animate, type AnimationPlaybackControls } from "motion/react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import { CAR_CLIPS } from "@/lib/easy-peasy-ease/car-clips";
import {
  EASING_PRESETS,
  getPresetBezier,
  type Bezier,
  type EasingPresetName,
} from "@/lib/easy-peasy-ease/easing-presets";
import { DEFAULT_EASING } from "@/lib/easy-peasy-ease/speed-curve-config";
import { cn } from "@/lib/utils";

import { CurveGallery } from "./curves/curve-gallery";
import { CubicBezierEditor } from "./kit/cubic-bezier-editor";
import { EasingCurvePicker } from "./kit/easing-curve-picker";
import { EpeRoot } from "./kit/epe-root";
import { FieldLabel } from "./kit/field-label";
import { RetimedVideo } from "./kit/retimed-video";
import { ScrubbableNumberField } from "./kit/scrubbable-number-field";
import { useRetimedPlayback, type RetimeClip } from "./kit/use-retimed-playback";
import { VideoPlaybackControls } from "./kit/video-playback-controls";
import "./curves/curves.css";

// The overhead turn reads speed best: the slope of the curve is how fast it spins.
const SOURCE = CAR_CLIPS[2];
const INITIAL_PRESET = DEFAULT_EASING as EasingPresetName;
const INITIAL_DURATION = 2;
// Mid-clip, so the reduced-motion resting state shows every curve's halfway point.
const INITIAL_PROGRESS = 0.5;
// The portrait layout sizes the plot from what the clip leaves.
const LAYOUT_STYLE = {
  "--epe-curves-video-ratio": SOURCE.height / SOURCE.width,
} as CSSProperties;
const TWEEN_EASE: Bezier = [0.23, 1, 0.32, 1];
const TWEEN_DURATION = 0.32;

interface CommittedCurve {
  /** null once the handles have been dragged ("Custom"). */
  preset: EasingPresetName | null;
  bezier: Bezier;
}

const formatSpeed = (speed: number) => `${speed.toFixed(2)}×`;

function mixBezier(from: Bezier, to: Bezier, t: number): Bezier {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
    from[3] + (to[3] - from[3]) * t,
  ];
}

export function EasyPeasyEaseCurvesDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { active, inView, reducedMotion } = useDemoActive(rootRef);

  const [committed, setCommitted] = useState<CommittedCurve>(() => ({
    preset: INITIAL_PRESET,
    bezier: getPresetBezier(INITIAL_PRESET),
  }));
  // What the editor and the clip show: the committed curve, a hovered preset,
  // or a tween between them.
  const [shown, setShown] = useState<Bezier>(committed.bezier);
  const [duration, setDuration] = useState(INITIAL_DURATION);
  const [touched, setTouched] = useState(false);

  const shownRef = useRef(shown);
  const committedRef = useRef(committed);
  const tweenRef = useRef<AnimationPlaybackControls | null>(null);
  const reducedMotionRef = useRef(reducedMotion);

  useEffect(() => {
    committedRef.current = committed;
    reducedMotionRef.current = reducedMotion;
  }, [committed, reducedMotion]);

  useEffect(() => () => tweenRef.current?.stop(), []);

  const show = useCallback((value: Bezier) => {
    shownRef.current = value;
    setShown(value);
  }, []);

  const tweenTo = useCallback(
    (target: Bezier) => {
      tweenRef.current?.stop();
      tweenRef.current = null;
      const from = shownRef.current;
      if (reducedMotionRef.current || from.every((v, i) => v === target[i])) {
        show(target);
        return;
      }
      tweenRef.current = animate(0, 1, {
        duration: TWEEN_DURATION,
        ease: TWEEN_EASE,
        onUpdate: (t) => show(mixBezier(from, target, t)),
        onComplete: () => show(target),
      });
    },
    [show],
  );

  const selectPreset = useCallback(
    (preset: string) => {
      const name = preset as EasingPresetName;
      const bezier = getPresetBezier(name);
      committedRef.current = { preset: name, bezier };
      setCommitted(committedRef.current);
      setTouched(true);
      tweenTo(bezier);
    },
    [tweenTo],
  );

  const previewPreset = useCallback(
    (preset: EasingPresetName | null) => {
      tweenTo(preset ? getPresetBezier(preset) : committedRef.current.bezier);
    },
    [tweenTo],
  );

  const drawCurve = useCallback(
    (value: Bezier) => {
      tweenRef.current?.stop();
      tweenRef.current = null;
      show(value);
      committedRef.current = { preset: null, bezier: value };
      setCommitted(committedRef.current);
      setTouched(true);
    },
    [show],
  );

  const clips = useMemo<RetimeClip[]>(
    () => [
      {
        id: SOURCE.id,
        src: SOURCE.src,
        poster: SOURCE.poster,
        sourceDuration: SOURCE.duration,
        fps: SOURCE.fps,
        frameCount: SOURCE.frameCount,
        duration,
        easing: shown,
      },
    ],
    [duration, shown],
  );

  const playback = useRetimedPlayback({
    clips,
    enabled: inView,
    autoPlay: active,
    initialTime: INITIAL_DURATION * INITIAL_PROGRESS,
  });

  const speedRef = useRef<HTMLSpanElement>(null);
  // Server markup shows the resting speed; the motion value takes over after.
  const [initialSpeed] = useState(() => formatSpeed(playback.map.speedAt(0, INITIAL_PROGRESS)));
  useEffect(() => {
    const node = speedRef.current;
    if (!node) return;
    let last = "";
    const write = (speed: number) => {
      const next = formatSpeed(speed);
      if (next === last) return;
      last = next;
      if (node.firstChild) node.firstChild.nodeValue = next;
      else node.textContent = next;
    };
    write(playback.speed.get());
    return playback.speed.on("change", write);
  }, [playback.speed]);

  const isCustom = committed.preset === null;

  return (
    <EpeRoot
      ref={rootRef}
      role="group"
      aria-label="Easy Peasy Ease curve presets: twenty-five easing curves, a cubic-bezier editor and a car clip retimed by the chosen curve"
    >
      <p className="sr-only">
        Pick one of the twenty-five presets or drag the two curve handles to draw your own; the clip
        retimes as the curve changes.
      </p>
      <div className="epe-curves-frame absolute inset-0">
        <div className="epe-curves-layout" style={LAYOUT_STYLE}>
          <div className="epe-curves-preview flex min-h-0 min-w-0 flex-col shadow-xl">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-[12px] border border-border bg-black">
              <RetimedVideo playback={playback} />
            </div>
            <div className="rounded-b-[12px] border-x border-b border-border bg-secondary px-2 py-1 @min-[640px]/epe:px-3 @min-[640px]/epe:py-2">
              <VideoPlaybackControls
                isPlaying={playback.isPlaying}
                currentTime={playback.time}
                duration={playback.totalDuration}
                onPlayPause={playback.toggle}
                actions={
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground @min-[768px]/epe:gap-4">
                    {/* One line tall: whatever part of the hint the bar has no
                        room for wraps out of sight (past the empty first item)
                        instead of truncating. */}
                    <span
                      aria-hidden={touched}
                      className={cn(
                        "epe-curves-wide-only flex h-4 min-w-0 flex-1 flex-wrap justify-end overflow-hidden whitespace-nowrap font-normal normal-case tracking-normal text-(color:--body-muted-foreground) transition-opacity duration-500",
                        touched && "opacity-0",
                      )}
                    >
                      <span className="h-4 w-0" />
                      <span>Pick a curve</span>
                      <span className="pl-[0.3em]">or drag a handle</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 @min-[768px]/epe:gap-2">
                      <span>Speed</span>
                      <span
                        ref={speedRef}
                        className="min-w-[3.25rem] text-right font-mono text-xs font-medium normal-case tracking-normal tabular-nums text-foreground @min-[768px]/epe:text-sm"
                      >
                        {initialSpeed}
                      </span>
                    </span>
                  </div>
                }
              />
            </div>
          </div>

          <CurveGallery
            selected={committed.preset}
            progress={playback.clipProgress}
            initialProgress={INITIAL_PROGRESS}
            onPreview={previewPreset}
            onSelect={selectPreset}
            className="epe-curves-gallery"
          />

          <div className="epe-curves-aside">
            <div className="epe-curves-inspector-only epe-curves-header min-w-0 items-center gap-3">
              <h4 className="text-lg font-semibold text-foreground">Clip 1</h4>
              <p className="ml-auto min-w-0 truncate text-right text-xs text-muted-foreground">
                {SOURCE.name}
              </p>
            </div>
            <div className="epe-curves-inspector-only items-start gap-3">
              <div className="epe-curves-wide-only shrink-0 space-y-1.5">
                <FieldLabel htmlFor="epe-curves-duration">Seconds</FieldLabel>
                <ScrubbableNumberField
                  id="epe-curves-duration"
                  label="Clip duration"
                  min={0.3}
                  max={4}
                  step={0.01}
                  scrubStep={0.01}
                  precision={2}
                  unit="seconds"
                  value={duration}
                  onChange={setDuration}
                  className="w-32"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <FieldLabel htmlFor="epe-curves-preset">Curve</FieldLabel>
                <EasingCurvePicker
                  id="epe-curves-preset"
                  value={committed.preset ?? "Custom"}
                  label={isCustom ? "Custom" : undefined}
                  bezier={isCustom ? committed.bezier : undefined}
                  options={EASING_PRESETS}
                  onChange={selectPreset}
                  popoverClassName="max-h-[calc(100cqh-10rem)]"
                  fullWidth
                />
              </div>
            </div>
            <CubicBezierEditor
              value={shown}
              onChange={drawCurve}
              aspect="square"
              plotClassName="max-w-none"
              // The readout only shows from 640px; drop its gap with it.
              className="space-y-0 @min-[640px]/epe:space-y-3"
              progress={playback.clipProgress}
              progressGuides
            />
          </div>
        </div>
      </div>
    </EpeRoot>
  );
}
