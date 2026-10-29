"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMotionValueEvent } from "motion/react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import { getPresetBezier, type Bezier } from "@/lib/easy-peasy-ease/easing-presets";

import {
  INITIAL_CLIPS,
  LOOP_OPTIONS,
  estimateRenderBytes,
  syncClipsToLoopCount,
  type EditorClip,
} from "./editor/editor-clips";
import { EditorInspector } from "./editor/editor-inspector";
import { useClipHold } from "./editor/use-clip-hold";
import { EpeRoot } from "./kit/epe-root";
import { RetimedVideo } from "./kit/retimed-video";
import { useRetimedPlayback, type RetimeClip } from "./kit/use-retimed-playback";
import { VideoPlaybackControls } from "./kit/video-playback-controls";
import { TimelineZoomSlider, VideoTimeline, type TimelineSegment } from "./kit/video-timeline";
import "./editor/editor-demo.css";

// Halfway through clip 2: the resting frame under reduced motion.
const INITIAL_TIME = 2.25;

/**
 * Hero: a mini FinalVideoEditor. Three car clips are stitched and retimed
 * live by their ease curves (the product re-renders on "Update"; here every
 * edit plays back immediately), with a dot riding the selected curve.
 */
export function EasyPeasyEaseEditorDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const { active, inView } = useDemoActive(rootRef);
  const [clips, setClips] = useState<EditorClip[]>(INITIAL_CLIPS);
  const [loopCount, setLoopCount] = useState(1);
  const [zoom, setZoom] = useState(0);
  const [tab, setTab] = useState<0 | 1>(0);
  const [showHint, setShowHint] = useState(true);
  const [portrait, setPortrait] = useState(false);

  const retimeClips = useMemo<RetimeClip[]>(
    () =>
      clips.map((clip) => ({
        id: clip.id,
        src: clip.source.src,
        poster: clip.source.poster,
        sourceDuration: clip.source.duration,
        fps: clip.source.fps,
        frameCount: clip.source.frameCount,
        duration: clip.duration,
        easing: clip.bezier,
      })),
    [clips],
  );

  const segments = useMemo<TimelineSegment[]>(
    () =>
      clips.map((clip) => ({
        id: clip.id,
        name: clip.source.name,
        duration: clip.duration,
        loopIteration: clip.loopIteration,
        thumbnail: clip.source.poster,
      })),
    [clips],
  );

  const playback = useRetimedPlayback({
    clips: retimeClips,
    enabled: inView,
    autoPlay: active,
    initialTime: INITIAL_TIME,
  });

  // The clip the clock is in; the product's inspector follows it while playing.
  const [followIndex, setFollowIndex] = useState(() => playback.map.sourceAt(INITIAL_TIME).index);
  useMotionValueEvent(playback.clipIndex, "change", setFollowIndex);

  const hold = useClipHold({ followIndex, playback });
  const selected = Math.min(hold.holdIndex ?? followIndex, clips.length - 1);
  const current = clips[selected];

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setPortrait(entry.contentRect.height > entry.contentRect.width);
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  const { map, seek, play } = playback;
  const { retarget, holdSegment, releaseSegment } = hold;

  const handleSeek = useCallback(
    (time: number) => {
      retarget(map.sourceAt(time, { loop: false }).index);
      seek(time);
    },
    [map, retarget, seek],
  );

  const handleSegmentSelect = useCallback(
    (id: string | number) => {
      const index = clips.findIndex((clip) => clip.id === id);
      if (index < 0) return;
      holdSegment(index);
      setTab(0);
    },
    [clips, holdSegment],
  );

  const updateSelected = useCallback(
    (patch: Partial<EditorClip>) => {
      setShowHint(false);
      setClips((states) => states.map((clip, i) => (i === selected ? { ...clip, ...patch } : clip)));
    },
    [selected],
  );
  const handleDurationChange = useCallback(
    (duration: number) => updateSelected({ duration }),
    [updateSelected],
  );
  const handlePresetChange = useCallback(
    (preset: string) => updateSelected({ preset, bezier: getPresetBezier(preset) }),
    [updateSelected],
  );
  const handleBezierChange = useCallback(
    (bezier: Bezier) => updateSelected({ bezier }),
    [updateSelected],
  );

  const handleUpdateClip = useCallback(() => {
    seek(map.starts[selected] ?? 0);
    play();
  }, [map, play, seek, selected]);

  // The product clones the selected clip's duration and curve onto every clip.
  const handleUpdateAll = useCallback(() => {
    setClips((states) => {
      const source = states[selected];
      return states.map((clip) => ({
        ...clip,
        duration: source.duration,
        preset: source.preset,
        bezier: [...source.bezier] as Bezier,
      }));
    });
    play();
  }, [play, selected]);

  const handleLoopChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = Number(event.target.value);
    if (next === loopCount) return;
    const synced = syncClipsToLoopCount(clips, next);
    setLoopCount(next);
    setClips(synced);
    retarget(Math.min(selected, synced.length - 1));
  };

  return (
    <EpeRoot
      ref={rootRef}
      role="group"
      aria-label="Easy Peasy Ease editor: three car clips stitched and retimed live by their ease curves"
    >
      <p className="sr-only">
        Drag the curve handles, pick a preset or change the seconds to retime the selected clip as it plays.
        Select a clip in the timeline to edit its curve.
      </p>
      <div ref={shellRef} className="epe-editor-shell h-full w-full">
        <div className="epe-editor-layout h-full w-full">
          {/* Preview, controls bar and timeline as one connected card */}
          <div className="epe-editor-stage flex min-h-0 min-w-0 flex-1 flex-col shadow-xl">
            <div
              onPointerDown={releaseSegment}
              className="epe-editor-preview relative min-h-0 w-full flex-1 overflow-hidden rounded-t-[12px] border border-border bg-black"
            >
              <RetimedVideo playback={playback} />
            </div>

            <div onPointerDown={releaseSegment} className="epe-editor-controls border-x border-border bg-secondary px-3 py-2">
              <VideoPlaybackControls
                isPlaying={playback.isPlaying}
                currentTime={playback.time}
                duration={playback.totalDuration}
                onPlayPause={playback.toggle}
                videoSize={estimateRenderBytes(playback.totalDuration)}
                actions={
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground @min-[400px]/epe:flex-wrap @min-[768px]/epe:gap-4">
                    <label className="hidden items-center gap-1 @min-[340px]/epe:flex @min-[400px]/epe:gap-1.5 @min-[768px]/epe:gap-2">
                      <span>Loops</span>
                      <select
                        value={loopCount}
                        onChange={handleLoopChange}
                        className="rounded-[8px] border border-(color:--control-border) bg-background py-1 pl-1 pr-4 text-[10px] font-semibold uppercase tracking-widest text-foreground @min-[768px]/epe:pl-2 @min-[768px]/epe:pr-6 @min-[768px]/epe:text-[11px]"
                      >
                        {LOOP_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            x{option}
                          </option>
                        ))}
                      </select>
                    </label>
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
              selectedSegmentId={current.id}
              onSeek={handleSeek}
              onSegmentSelect={handleSegmentSelect}
              zoomValue={zoom}
              onZoomChange={setZoom}
              thumbnailLoading="eager"
              viewportClassName="rounded-t-none rounded-b-[12px] pb-2 @min-[768px]/epe:pb-3"
              className="epe-editor-timeline"
            />
          </div>

          <div className="epe-editor-inspector-cell">
            <EditorInspector
              {...hold.inspectorProps}
              clip={current}
              clipIndex={selected}
              tab={tab}
              onTabChange={setTab}
              onSecondsChange={handleDurationChange}
              onPresetChange={handlePresetChange}
              onBezierChange={handleBezierChange}
              onUpdateClip={handleUpdateClip}
              onUpdateAll={handleUpdateAll}
              progress={selected === followIndex ? playback.clipProgress : undefined}
              pickerSide={portrait ? "top" : "bottom"}
              boundsRef={shellRef}
              showHint={showHint}
            />
          </div>
        </div>
      </div>
    </EpeRoot>
  );
}
