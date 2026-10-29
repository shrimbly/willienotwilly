"use client";

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import {
  BEATS_128,
  BEATS_128_SRC,
  alignOffsetToBeatGrid,
  quantizeOffsetToNearestBeat,
  snapDurationsToBeatGrid,
  type BeatSubdivision,
} from "@/lib/easy-peasy-ease/beat-sync";
import { CAR_CLIPS } from "@/lib/easy-peasy-ease/car-clips";
import {
  EASING_PRESETS,
  findPresetForBezier,
  getPresetBezier,
  type Bezier,
} from "@/lib/easy-peasy-ease/easing-presets";
import { cn } from "@/lib/utils";

import { AudioWaveformVisualization } from "./beat-sync/audio-waveform-visualization";
import { useSyncedAudio } from "./beat-sync/use-synced-audio";
import { AudioUploadBox } from "./kit/audio-upload-box";
import { CubicBezierEditor } from "./kit/cubic-bezier-editor";
import { EasingCurvePicker } from "./kit/easing-curve-picker";
import { EpeButton } from "./kit/epe-button";
import { EpeRoot } from "./kit/epe-root";
import { FieldLabel } from "./kit/field-label";
import { RetimedVideo } from "./kit/retimed-video";
import { ScrubbableNumberField } from "./kit/scrubbable-number-field";
import {
  SegmentedControlIndicator,
  inspectorTabClassName,
  inspectorTabsListClassName,
} from "./kit/segmented-control";
import { useRetimedPlayback, type RetimeClip } from "./kit/use-retimed-playback";
import { VideoPlaybackControls } from "./kit/video-playback-controls";
import { TimelineZoomSlider, VideoTimeline, type TimelineSegment } from "./kit/video-timeline";

/** The visitor's own clip lengths before snapping: uneven, so each grid snaps them differently. */
const BASE_DURATIONS = [1.5, 1.2, 1.9, 1.5, 1.1, 1.7];
const BASE_PRESETS = ["In Out Quad", "In Out Cubic", "In Out Quad", "In Out Quart", "In Out Cubic", "In Out Quad"];
const BEATS = BEATS_128.beats;
const AUDIO_FILE_NAME = "beats-128.mp3";
const CUSTOM_CURVE = "Custom";
/** Untouched, the demo engages "every 2nd beat" once, a moment after it starts playing. */
const AUTO_SNAP_DELAY_MS = 2200;
/** Stands in for the product's re-render behind the ⟳ / Update buttons. */
const UPDATE_DELAY_MS = 500;

/**
 * The product's disabled look for the update buttons while one runs. They are
 * aria-disabled, not disabled: a disabled button drops the focus that pressed it.
 */
const BUSY_CLASS_NAME = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

/** Which button started the stand-in re-render ("clip" replays from that clip). */
type UpdateScope = "clip" | "all";

interface ClipCurve {
  preset: string;
  bezier: Bezier;
}

const INITIAL_CURVES: ClipCurve[] = BASE_PRESETS.map((preset) => ({ preset, bezier: getPresetBezier(preset) }));

/**
 * FinalVideoEditor's beat-snap state: durations and the audio offset, plus
 * the pre-snap baseline that switching 1 → 2 → 4 re-snaps from and that
 * toggling off restores.
 */
interface SyncState {
  durations: number[];
  offset: number;
  subdivision: BeatSubdivision | 0;
  baseline: { durations: number[]; offset: number } | null;
}

type SyncAction =
  | { type: "subdivision"; value: BeatSubdivision | 0 }
  | { type: "offset"; value: number }
  | { type: "duration"; index: number; value: number }
  | { type: "dropSnap" }
  | { type: "resetOffset" };

const INITIAL_SYNC: SyncState = { durations: BASE_DURATIONS, offset: 0, subdivision: 0, baseline: null };

function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case "subdivision": {
      if (!BEATS) return state;
      if (action.value === 0) {
        const { baseline } = state;
        return baseline
          ? { durations: baseline.durations, offset: baseline.offset, subdivision: 0, baseline: null }
          : { ...state, subdivision: 0 };
      }
      const baseline = state.baseline ?? { durations: state.durations, offset: state.offset };
      return {
        durations: snapDurationsToBeatGrid(baseline.durations, BEATS.bpm, action.value),
        offset: alignOffsetToBeatGrid(baseline.offset, BEATS),
        subdivision: action.value,
        baseline,
      };
    }
    case "offset": {
      // While snapping, a free drag would pull the beats off the cuts, so the
      // drag is magnetic: it commits to the nearest beat and moves the baseline.
      if (state.subdivision !== 0 && BEATS) {
        const offset = quantizeOffsetToNearestBeat(action.value, BEATS);
        return { ...state, offset, baseline: state.baseline ? { ...state.baseline, offset } : null };
      }
      return { ...state, offset: action.value };
    }
    case "duration":
      // A manual edit diverges from the suggestion: the edit stands, the snap ends.
      return {
        ...state,
        durations: state.durations.map((d, i) => (i === action.index ? action.value : d)),
        subdivision: 0,
        baseline: null,
      };
    case "dropSnap":
      return { ...state, subdivision: 0, baseline: null };
    case "resetOffset":
      return { ...state, offset: 0 };
  }
}

export function EasyPeasyEaseBeatSyncDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const autoSnapDoneRef = useRef(false);
  const updateTimerRef = useRef(0);
  const audioLaneRef = useRef<HTMLDivElement>(null);
  const refocusLaneRef = useRef(false);
  const fieldId = useId();
  const { active, inView, reducedMotion } = useDemoActive(rootRef);

  const [sync, dispatch] = useReducer(syncReducer, INITIAL_SYNC);
  const [curves, setCurves] = useState(INITIAL_CURVES);
  const [selectedClip, setSelectedClip] = useState(0);
  // The product's inspector opens on Video (segments): the curve editor fills it.
  const [tab, setTab] = useState<0 | 1>(0);
  const [zoom, setZoom] = useState(0);
  const [hasAudio, setHasAudio] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [updateScope, setUpdateScope] = useState<UpdateScope | null>(null);
  const [fadeIn, setFadeIn] = useState(0.5);
  const [fadeOut, setFadeOut] = useState(0.5);
  const [quality, setQuality] = useState("preview");

  const clips = useMemo<RetimeClip[]>(
    () =>
      CAR_CLIPS.map((clip, i) => ({
        id: clip.id,
        src: clip.src,
        poster: clip.poster,
        sourceDuration: clip.duration,
        fps: clip.fps,
        frameCount: clip.frameCount,
        duration: sync.durations[i],
        easing: curves[i].bezier,
      })),
    [sync.durations, curves],
  );

  const segments = useMemo<TimelineSegment[]>(
    () =>
      CAR_CLIPS.map((clip, i) => ({
        id: clip.id,
        name: clip.name,
        duration: sync.durations[i],
        thumbnail: { strip: clip.filmstrip, index: 0 },
      })),
    [sync.durations],
  );

  const playback = useRetimedPlayback({ clips, enabled: inView, autoPlay: active, initialTime: 0.6 });
  const { play, seek } = playback;

  const { unlock: unlockSound } = useSyncedAudio({
    src: BEATS_128_SRC,
    time: playback.time,
    playing: playback.isPlaying,
    enabled: soundOn && hasAudio && inView,
    offset: sync.offset,
    totalDuration: playback.totalDuration,
    fadeIn,
    fadeOut,
  });

  // The one scripted beat: engage "every 2nd beat" shortly after the demo
  // starts, unless the visitor got there first. Reduced motion rests on that
  // end state from the start.
  useEffect(() => {
    if (autoSnapDoneRef.current) return;
    if (reducedMotion) {
      autoSnapDoneRef.current = true;
      dispatch({ type: "subdivision", value: 2 });
      return;
    }
    if (!active) return;
    const timer = window.setTimeout(() => {
      if (autoSnapDoneRef.current) return;
      autoSnapDoneRef.current = true;
      dispatch({ type: "subdivision", value: 2 });
    }, AUTO_SNAP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, reducedMotion]);

  useEffect(() => () => window.clearTimeout(updateTimerRef.current), []);

  const markTouched = useCallback(() => {
    autoSnapDoneRef.current = true;
  }, []);

  const runUpdate = useCallback(
    (scope: UpdateScope, from: number) => {
      setUpdateScope(scope);
      window.clearTimeout(updateTimerRef.current);
      updateTimerRef.current = window.setTimeout(() => {
        setUpdateScope(null);
        seek(from);
        play();
      }, UPDATE_DELAY_MS);
    },
    [play, seek],
  );
  const applyUpdate = useCallback(() => runUpdate("all", 0), [runUpdate]);
  const updating = updateScope !== null;

  const toggleSound = () => {
    if (soundOn) {
      setSoundOn(false);
      return;
    }
    // Nothing loads until this click; the audio context must start inside it.
    unlockSound();
    setSoundOn(true);
    if (!playback.isPlaying) play();
  };

  // Removing or adding the track swaps the lane, taking the pressed button
  // with it: focus moves to what replaced it (the add box, or the track).
  const keepLaneFocus = () => {
    refocusLaneRef.current = audioLaneRef.current?.contains(document.activeElement) ?? false;
  };

  useEffect(() => {
    if (!refocusLaneRef.current) return;
    refocusLaneRef.current = false;
    audioLaneRef.current
      ?.querySelector<HTMLElement>(hasAudio ? '[role="slider"]' : "button")
      ?.focus({ preventScroll: true });
  }, [hasAudio]);

  const handleRemoveAudio = () => {
    keepLaneFocus();
    setHasAudio(false);
    setSoundOn(false);
    dispatch({ type: "dropSnap" });
    if (tab === 1) setTab(0);
  };

  const handleAddAudio = () => {
    keepLaneFocus();
    dispatch({ type: "resetOffset" });
    setHasAudio(true);
    setTab(1);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === "ArrowLeft" || event.key === "ArrowRight"
        ? tab === 0
          ? 1
          : 0
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? 1
            : null;
    if (next === null) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus({ preventScroll: true });
  };

  const selectedCurve = curves[selectedClip];
  const updateSelectedCurve = (curve: ClipCurve) =>
    setCurves((current) => current.map((c, i) => (i === selectedClip ? curve : c)));

  const durationId = `${fieldId}-duration`;
  const curveId = `${fieldId}-curve`;
  const fadeInId = `${fieldId}-fade-in`;
  const fadeOutId = `${fieldId}-fade-out`;
  const qualityId = `${fieldId}-quality`;
  const panelId = `${fieldId}-panel`;

  const selectedClipStart = sync.durations.slice(0, selectedClip).reduce((sum, d) => sum + d, 0);

  const segmentSettings = (
    <div className="flex h-full flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <p className="shrink-0 text-lg font-semibold text-foreground">Clip {selectedClip + 1}</p>
        <p
          className="ml-auto min-w-0 truncate text-right text-xs text-muted-foreground"
          title={CAR_CLIPS[selectedClip].name}
        >
          {CAR_CLIPS[selectedClip].name}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* The picker gets the larger share (the product's w-32 field leaves the
            320px inspector's trigger too narrow for "In Out Cubic"); 3.5rem
            still holds the four-character readout. */}
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor={durationId}>Seconds</FieldLabel>
            <ScrubbableNumberField
              key={selectedClip}
              id={durationId}
              label="Clip duration"
              min={0.3}
              max={4}
              step={0.01}
              scrubStep={0.01}
              precision={2}
              unit="seconds"
              value={sync.durations[selectedClip]}
              onChange={(value) => dispatch({ type: "duration", index: selectedClip, value })}
              className="w-full grid-cols-[2rem_minmax(3.5rem,1fr)_2rem]"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <FieldLabel htmlFor={curveId}>Curve</FieldLabel>
            <EasingCurvePicker
              id={curveId}
              value={selectedCurve.preset}
              label={selectedCurve.preset === CUSTOM_CURVE ? CUSTOM_CURVE : undefined}
              bezier={selectedCurve.bezier}
              options={EASING_PRESETS}
              onChange={(preset) => updateSelectedCurve({ preset, bezier: getPresetBezier(preset) })}
              popoverClassName="max-h-[260px]"
              fullWidth
            />
          </div>
        </div>
        {/* The plot takes the largest square the panel has left above the
            product's two update buttons, so the inspector never scrolls (a
            scrolling panel would catch the wheel). The 1rem above the buttons
            keeps them clear of the handles' 40px hit areas; the 0.25rem below
            holds the buttons' own hit areas inside the panel. */}
        <div className="min-h-0 flex-1 [container-type:size]">
          <CubicBezierEditor
            value={selectedCurve.bezier}
            onChange={(bezier) =>
              updateSelectedCurve({ preset: findPresetForBezier(bezier) ?? CUSTOM_CURVE, bezier })
            }
            progress={playback.activeIndex === selectedClip ? playback.clipProgress : undefined}
            readout={false}
            className="mx-auto w-[min(100cqw,100cqh-3.25rem)] min-w-0"
          />
          <div className="mt-4 flex gap-2">
            <EpeButton
              size="sm"
              variant="outline"
              onClick={updating ? undefined : () => runUpdate("clip", selectedClipStart)}
              aria-disabled={updating || undefined}
              className={cn("min-w-0 flex-1 gap-2", BUSY_CLASS_NAME)}
            >
              {updateScope === "clip" && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Clip
            </EpeButton>
            <EpeButton
              size="sm"
              onClick={updating ? undefined : applyUpdate}
              aria-disabled={updating || undefined}
              className={cn(
                "min-w-0 flex-1 gap-2 bg-(color:--brand-strong) hover:bg-(color:--brand-strong)/90",
                BUSY_CLASS_NAME,
              )}
            >
              {updateScope === "all" && <Loader2 className="h-4 w-4 animate-spin" />}
              Update All Clips
            </EpeButton>
          </div>
        </div>
      </div>
    </div>
  );

  const audioSettings = hasAudio ? (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-foreground">Audio Settings</p>
        <p className="hidden text-xs text-(color:--body-muted-foreground) @min-[640px]/epe:block">
          Shape fade envelopes and looping for the background track.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1.5">
          <FieldLabel htmlFor={fadeInId}>Fade in</FieldLabel>
          <ScrubbableNumberField
            id={fadeInId}
            label="Audio fade in"
            min={0}
            max={10}
            step={0.1}
            scrubStep={0.05}
            precision={1}
            unit="seconds"
            value={fadeIn}
            onChange={setFadeIn}
            className="w-full"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <FieldLabel htmlFor={fadeOutId}>Fade out</FieldLabel>
          <ScrubbableNumberField
            id={fadeOutId}
            label="Audio fade out"
            min={0}
            max={10}
            step={0.1}
            scrubStep={0.05}
            precision={1}
            unit="seconds"
            value={fadeOut}
            onChange={setFadeOut}
            className="w-full"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={qualityId}>Quality</FieldLabel>
        <select
          id={qualityId}
          value={quality}
          onChange={(event) => setQuality(event.target.value)}
          className="h-9 w-full rounded-[8px] border border-(color:--control-border) bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <option value="full">Full Quality</option>
          <option value="preview">Preview (720p)</option>
        </select>
      </div>
      <EpeButton
        size="sm"
        onClick={updating ? undefined : applyUpdate}
        aria-disabled={updating || undefined}
        className={cn("w-full gap-2", BUSY_CLASS_NAME)}
      >
        {updating && <Loader2 className="h-4 w-4 animate-spin" />}
        {updating ? "Updating." : "Update Video"}
      </EpeButton>
    </div>
  ) : (
    <div className="flex h-full flex-col items-center justify-center text-center text-sm text-(color:--body-muted-foreground)">
      <p>Upload an audio track in the timeline to configure audio settings.</p>
    </div>
  );

  return (
    <EpeRoot
      ref={rootRef}
      role="group"
      aria-label="Easy Peasy Ease beat sync: six car clips cut to a 128 BPM track"
      className="p-2"
      onClickCapture={markTouched}
      onKeyDownCapture={markTouched}
    >
      <p className="sr-only">
        Pick 1, 2 or 4 in the BPM pill to snap every cut to the beat, drag the waveform to shift the
        track, and turn on Sound to hear the cuts land.
      </p>

      <div className="flex h-full w-full gap-2">
        {/* Preview, controls bar and timeline as one connected card. It is the
            kit's epe container, so beside the inspector the timeline takes its
            compact rows from the column's width and leaves the preview room. */}
        <div className="@container/epe flex min-h-0 min-w-0 flex-1 flex-col shadow-xl">
          <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-t-[12px] border border-border bg-black">
            <RetimedVideo playback={playback} />
          </div>

          <div className="border-x border-border bg-secondary px-3 py-2">
            <VideoPlaybackControls
              isPlaying={playback.isPlaying}
              currentTime={playback.time}
              duration={playback.totalDuration}
              onPlayPause={playback.toggle}
              actions={
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase @min-[768px]/epe:gap-4">
                  <button
                    type="button"
                    aria-pressed={soundOn}
                    disabled={!hasAudio}
                    onClick={toggleSound}
                    className="flex items-center gap-1.5 rounded-[8px] px-1.5 py-1 uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 aria-pressed:text-foreground"
                  >
                    {soundOn ? (
                      <Volume2 aria-hidden className="size-4 text-primary" />
                    ) : (
                      <VolumeX aria-hidden className="size-4" />
                    )}
                    <span>Sound</span>
                  </button>
                  <div className="flex items-center gap-2 @min-[768px]/epe:gap-4">
                    <span className="hidden @min-[768px]/epe:inline">Zoom</span>
                    <TimelineZoomSlider value={zoom} onValueChange={setZoom} />
                  </div>
                </div>
              }
            />
          </div>

          <VideoTimeline
            segments={segments}
            currentTime={playback.time}
            selectedSegmentId={CAR_CLIPS[selectedClip].id}
            onSeek={seek}
            onSegmentSelect={(id) => {
              setSelectedClip(Math.max(0, CAR_CLIPS.findIndex((clip) => clip.id === id)));
              setTab(0);
            }}
            zoomValue={zoom}
            onZoomChange={setZoom}
            viewportClassName="rounded-t-none rounded-b-[12px]"
            renderAudioTrack={({ trackWidth, pixelsPerSecond, totalDuration }) => (
              <div ref={audioLaneRef} className="space-y-1">
                {hasAudio ? (
                  <AudioWaveformVisualization
                    waveformData={BEATS_128}
                    fileName={AUDIO_FILE_NAME}
                    onRemove={handleRemoveAudio}
                    currentTime={playback.time}
                    timelineDuration={totalDuration}
                    onSelect={() => setTab(1)}
                    isSelected={tab === 1}
                    trackWidth={trackWidth}
                    pixelsPerSecond={pixelsPerSecond}
                    offset={sync.offset}
                    onOffsetChange={(value) => dispatch({ type: "offset", value })}
                    beatSubdivision={sync.subdivision}
                    onBeatSubdivisionChange={(value) => dispatch({ type: "subdivision", value })}
                    onBeatApply={applyUpdate}
                    isBeatUpdating={updating}
                    isPlaying={playback.isPlaying && inView}
                    pulseActive={active}
                  />
                ) : (
                  <AudioUploadBox onActivate={handleAddAudio} />
                )}
              </div>
            )}
          />
        </div>

        {/* Inspector, as on the product's lg layout; only on wide tiles. */}
        <div className="hidden w-[320px] shrink-0 @min-[860px]/epe:relative @min-[860px]/epe:block @min-[1100px]/epe:w-[340px]">
          <div className="absolute inset-0 flex flex-col rounded-[12px] border border-border bg-secondary p-4">
            <div
              role="tablist"
              aria-label="Inspector"
              className={inspectorTabsListClassName}
              onKeyDown={handleTabKeyDown}
            >
              <SegmentedControlIndicator activeIndex={tab} className="bg-accent" />
              {(["Video", "Audio"] as const).map((name, i) => (
                <button
                  key={name}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  id={`${fieldId}-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === i}
                  aria-controls={panelId}
                  tabIndex={tab === i ? 0 : -1}
                  data-state={tab === i ? "active" : "inactive"}
                  onClick={() => setTab(i as 0 | 1)}
                  className={inspectorTabClassName}
                >
                  {name}
                </button>
              ))}
            </div>
            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={`${fieldId}-tab-${tab}`}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {tab === 0 ? segmentSettings : audioSettings}
            </div>
          </div>
        </div>
      </div>
    </EpeRoot>
  );
}
