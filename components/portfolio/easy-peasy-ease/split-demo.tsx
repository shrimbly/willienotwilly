"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent } from "motion/react";
import { Pause, Play, Scissors } from "lucide-react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import {
  DEFAULT_SECTION_LENGTH,
  MAX_SECTIONS,
  canInsertSplit,
  computeEvenSplitTimes,
  deriveSections,
  insertSplit,
} from "@/lib/easy-peasy-ease/chunking";
import { DEFAULT_EASING, DEFAULT_OUTPUT_DURATION } from "@/lib/easy-peasy-ease/speed-curve-config";
import { formatTime } from "@/lib/easy-peasy-ease/timeline-utils";

import { EpeButton } from "./kit/epe-button";
import { EpeRoot } from "./kit/epe-root";
import { RetimedVideo } from "./kit/retimed-video";
import { SectionChips } from "./split/section-chips";
import { SplitAside, SplitPhoneBar, clipsLabel } from "./split/split-aside";
import { SplitAtPlayheadButton, SplitTrack } from "./split/split-track";
import { useVirtualPlayback } from "./split/use-virtual-playback";
import {
  EDIT_MAP,
  SOURCE_DURATION,
  SOURCE_RESOLUTION,
  createSequenceMap,
} from "./split/virtual-source";

type Mode = "edit" | "sequence";

/** Resting frame (and reduced-motion still): the front three-quarter view, inside clip 2. */
const INITIAL_TIME = 6;
const INITIAL_SPLITS = computeEvenSplitTimes(SOURCE_DURATION, DEFAULT_SECTION_LENGTH);

// The product's mode-swap reveal (page.tsx modeRevealVariant through BlurFade), for the track header.
const headerReveal = {
  hidden: (dir: number) => ({ x: dir * -4, opacity: 0, filter: "blur(4px)" }),
  visible: { x: 0, opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } },
  exit: (dir: number) => ({
    x: dir * 4,
    opacity: 0,
    filter: "blur(4px)",
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const },
  }),
};
const headerRevealTransition = { delay: 0.04, duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

/**
 * Easy Peasy Ease's "Split a video" editor (VideoSplitEditor + SplitTrack)
 * over one 15 s source. Editing plays the source straight through; "Create
 * N clips" swaps the preview to the eased sequence (every section squeezed
 * into the clip duration through the chosen curve, back to back) where the
 * product would render, and Back returns to the split points.
 */
export function EasyPeasyEaseSplitDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const resumeAfterScrubRef = useRef(false);
  const { active, inView, reducedMotion } = useDemoActive(rootRef);

  const [mode, setMode] = useState<Mode>("edit");
  const [splitTimes, setSplitTimes] = useState(INITIAL_SPLITS);
  const [selectedSplit, setSelectedSplit] = useState<number | null>(null);
  const [sectionLength, setSectionLength] = useState(DEFAULT_SECTION_LENGTH);
  const [outputDuration, setOutputDuration] = useState(DEFAULT_OUTPUT_DURATION);
  const [preset, setPreset] = useState(DEFAULT_EASING);

  const sections = useMemo(() => deriveSections(SOURCE_DURATION, splitTimes), [splitTimes]);
  const map = useMemo(
    () => (mode === "edit" ? EDIT_MAP : createSequenceMap(splitTimes, outputDuration, preset)),
    [mode, splitTimes, outputDuration, preset],
  );
  const playback = useVirtualPlayback({ map, enabled: inView, autoPlay: active, initialTime: INITIAL_TIME });
  const { sourceTime, setMap, seek, seekSource, play, pause } = playback;

  const [activeSection, setActiveSection] = useState(0);
  useMotionValueEvent(playback.section, "change", setActiveSection);

  const [canAddAtPlayhead, setCanAddAtPlayhead] = useState(() =>
    canInsertSplit(INITIAL_SPLITS, INITIAL_TIME, SOURCE_DURATION),
  );
  useMotionValueEvent(sourceTime, "change", (v) =>
    setCanAddAtPlayhead(canInsertSplit(splitTimes, v, SOURCE_DURATION)),
  );

  // MM:SS readout, written in place (it ticks with the clock, not with React).
  useEffect(() => {
    const node = timeRef.current;
    if (!node) return;
    let last = "";
    const apply = (t: number) => {
      const next = formatTime(t);
      if (next === last) return;
      last = next;
      if (node.firstChild) node.firstChild.nodeValue = next;
      else node.textContent = next;
    };
    apply(playback.time.get());
    return playback.time.on("change", apply);
  }, [playback.time]);

  const updateSplits = useCallback(
    (next: number[]) => {
      setSplitTimes(next);
      setCanAddAtPlayhead(canInsertSplit(next, sourceTime.get(), SOURCE_DURATION));
      // The sequence follows edits live; swap the map now so a seek in the
      // same gesture lands on the new section boundaries.
      if (mode === "sequence") setMap(createSequenceMap(next, outputDuration, preset));
    },
    [mode, outputDuration, preset, setMap, sourceTime],
  );

  const handleScrubbing = useCallback(
    (scrubbing: boolean) => {
      if (scrubbing) {
        resumeAfterScrubRef.current = playback.isPlaying;
        if (playback.isPlaying) pause();
      } else if (resumeAfterScrubRef.current) {
        resumeAfterScrubRef.current = false;
        play();
      }
    },
    [pause, play, playback.isPlaying],
  );

  const addSplitAtPlayhead = () => {
    const t = sourceTime.get();
    if (!canInsertSplit(splitTimes, t, SOURCE_DURATION)) return;
    setSelectedSplit(null);
    updateSplits(insertSplit(splitTimes, t, SOURCE_DURATION));
  };

  const splitEvenly = () => {
    setSelectedSplit(null);
    updateSplits(computeEvenSplitTimes(SOURCE_DURATION, sectionLength));
  };
  const clearSplits = () => {
    setSelectedSplit(null);
    updateSplits([]);
  };

  const create = () => {
    setMode("sequence");
    setSelectedSplit(null);
    setMap(createSequenceMap(splitTimes, outputDuration, preset));
    seek(0);
    play();
  };

  const back = () => {
    const v = sourceTime.get();
    setMode("edit");
    setMap(EDIT_MAP);
    seek(v);
  };

  const playSection = (index: number) => {
    seek(index * outputDuration);
    play();
  };

  const sequencing = mode === "sequence";
  const atSectionCap = sections.length >= MAX_SECTIONS;
  const avgSection = sections.length > 0 ? SOURCE_DURATION / sections.length : 0;
  const revealDir = sequencing ? 1 : -1;

  return (
    <EpeRoot
      ref={rootRef}
      role="group"
      aria-label="Easy Peasy Ease split editor: one 15 second video cut into sections that each play back through an ease curve"
      className="p-2"
    >
      <p className="sr-only">
        Drag a diamond marker to move a cut, or focus it and use the arrow keys; Delete removes it. Double-click the
        track or use Split at playhead to add one, then press Create clips to play every section back to back
        through the chosen curve.
      </p>

      {/* A size container, so phone vs landscape follows the tile's shape, not its width. */}
      <div className="h-full w-full [container-name:epe-split] [container-type:size]">
        <div className="flex h-full min-h-0 flex-col gap-2 [@container_epe-split_(orientation:landscape)]:flex-row">
          {/* Preview + track */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 @min-[880px]/epe:gap-3 @min-[1100px]/epe:gap-4">
            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[12px] border border-border bg-black shadow-xl">
              <RetimedVideo playback={playback} />
            </div>

            {/* Playback row */}
            <div className="flex h-9 shrink-0 items-center gap-3 px-1">
              <EpeButton
                type="button"
                variant="secondary"
                size="icon"
                onClick={playback.toggle}
                aria-label={playback.isPlaying ? "Pause" : "Play"}
              >
                {playback.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </EpeButton>
              <span className="whitespace-nowrap font-mono text-sm tabular-nums text-muted-foreground">
                <span ref={timeRef}>{formatTime(INITIAL_TIME)}</span> / {formatTime(playback.totalDuration)}
              </span>
              <span className="ml-auto hidden text-xs text-muted-foreground @min-[880px]/epe:inline">
                {SOURCE_RESOLUTION}
              </span>
              {sequencing ? (
                <span className="ml-auto truncate text-xs text-muted-foreground [@container_epe-split_(orientation:landscape)]:hidden">
                  {clipsLabel(sections.length)} · avg {avgSection.toFixed(1)}s
                </span>
              ) : (
                <SplitAtPlayheadButton
                  enabled={canAddAtPlayhead}
                  atSectionCap={atSectionCap}
                  maxSections={MAX_SECTIONS}
                  onClick={addSplitAtPlayhead}
                  className="ml-auto @min-[880px]/epe:hidden"
                />
              )}
            </div>

            {/* The split track */}
            <div className="shrink-0 space-y-2 px-1 @min-[880px]/epe:space-y-3">
              <div className="relative flex h-6 items-center @min-[880px]/epe:h-8">
                {/* Under reduced motion BlurFade skips the reveal and the exit: an instant swap. */}
                <AnimatePresence initial={false} mode="popLayout" custom={revealDir}>
                  <motion.div
                    key={mode}
                    custom={revealDir}
                    variants={headerReveal}
                    initial={reducedMotion ? false : "hidden"}
                    animate="visible"
                    exit={reducedMotion ? undefined : "exit"}
                    transition={reducedMotion ? { duration: 0 } : headerRevealTransition}
                    className="flex h-full min-w-0 flex-1 items-center justify-between gap-2"
                  >
                    {sequencing ? (
                      <SectionChips
                        count={sections.length}
                        active={activeSection}
                        progress={playback.sectionProgress}
                        onSelect={playSection}
                        className="h-full flex-1"
                      />
                    ) : (
                      <>
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                          <Scissors className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {clipsLabel(sections.length)} · drag to move, tap to remove
                          </span>
                        </div>
                        <SplitAtPlayheadButton
                          enabled={canAddAtPlayhead}
                          atSectionCap={atSectionCap}
                          maxSections={MAX_SECTIONS}
                          onClick={addSplitAtPlayhead}
                          className="hidden @min-[880px]/epe:inline-flex"
                        />
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
              <SplitTrack
                duration={SOURCE_DURATION}
                currentTime={sourceTime}
                initialTime={INITIAL_TIME}
                splitTimes={splitTimes}
                onSplitTimesChange={updateSplits}
                onSeek={seekSource}
                selectedSplit={selectedSplit}
                onSelectedSplitChange={setSelectedSplit}
                onScrubbingChange={handleScrubbing}
                activeSection={sequencing ? activeSection : null}
              />
            </div>
          </div>

          <SplitAside
            mode={mode}
            sections={sections}
            splitCount={splitTimes.length}
            sectionLength={sectionLength}
            onSectionLengthChange={setSectionLength}
            outputDuration={outputDuration}
            onOutputDurationChange={setOutputDuration}
            preset={preset}
            onPresetChange={setPreset}
            onSplitEvenly={splitEvenly}
            onClearSplits={clearSplits}
            onBack={back}
            onCreate={create}
            boundsRef={rootRef}
            className="hidden [@container_epe-split_(orientation:landscape)]:flex"
          />
          <SplitPhoneBar
            mode={mode}
            sectionCount={sections.length}
            preset={preset}
            onPresetChange={setPreset}
            onBack={back}
            onCreate={create}
            boundsRef={rootRef}
            className="[@container_epe-split_(orientation:landscape)]:hidden"
          />
        </div>
      </div>
    </EpeRoot>
  );
}
