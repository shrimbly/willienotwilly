"use client";

import type { ReactNode } from "react";
import { VolumeOff } from "lucide-react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";

import type { Mix } from "@/lib/booth/mix";
import { cn } from "@/lib/utils";

import {
  BoothChipButton,
  BoothCompareLine,
  BoothIcon,
  BoothMixSlider,
  BoothPlayButton,
  BoothTitle,
  BoothToggleChip,
  BoothWaveform,
  MIX_ROWS,
  swapMotion,
} from "../kit";

// The Done screen of studiovoice/app/Sources/Booth/UI/Screens/DoneScreen.swift for an audio file
// with music (the `doneMix` fixture, less its Video chip), built from the kit's pieces rather than
// BoothDoneScreen so this demo owns the row of actions: DoneActions' Open and Done, or Revert and
// Save while the mix differs from the saved one. Spacing is DoneScreen's: compare 2 pt under the
// title, play 12 pt under that, the chips 10 pt under, the sliders 6 pt under the chips.

/** Off-chip look for a chip that only draws (kit `CHIP_CLASS` with `BoothChipButton`'s off state). */
const STILL_CHIP =
  "inline-flex h-6 shrink-0 items-center gap-[5px] rounded-full px-[9px] text-[12px] leading-4 whitespace-nowrap text-(color:--booth-text2) shadow-[inset_0_0_0_1px_var(--booth-sep)] select-none";

export interface MixDoneScreenProps {
  title: string;
  comparing: boolean;
  onComparingChange: (comparing: boolean) => void;
  playing: boolean;
  onPlayToggle: () => void;
  levels: readonly number[];
  played: number;
  playhead: number;
  onSeek: (fraction: number) => void;
  mixOpen: boolean;
  onMixToggle: () => void;
  mix: Mix;
  onMixChange: (mix: Mix) => void;
  dirty: boolean;
  saving: boolean;
  onRevert: () => void;
  onSave: () => void;
  reducedMotion: boolean;
}

/**
 * Title, "Hold ⌥ to compare", play and the 56 bars, then Mix beside the file's actions, then the
 * Speech, Background and Music sliders while Mix is on. Play moves the playhead without sound, as
 * Booth's demo mode does (no stems are published), so while it plays the compare line's row says
 * so: the hero's and the compare demo's play buttons, which look the same, do play sound. The actions trade places with the app's
 * swap (PopoverMotion.swift `AnyTransition.swap`, at the corner button's blur of 2): the app swaps
 * them at once, as setMix isn't animated, but here a drag across the saved value would otherwise
 * flicker. Open and Done only draw: this page has no Finder, and Done would leave the mix.
 */
export function MixDoneScreen({
  title,
  comparing,
  onComparingChange,
  playing,
  onPlayToggle,
  levels,
  played,
  playhead,
  onSeek,
  mixOpen,
  onMixToggle,
  mix,
  onMixChange,
  dirty,
  saving,
  onRevert,
  onSave,
  reducedMotion,
}: MixDoneScreenProps) {
  return (
    <div className="relative flex flex-col">
      <BoothTitle>{title}</BoothTitle>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <BoothCompareLine comparing={comparing} onComparingChange={onComparingChange} />
        {/* Read out by the demo's live region; here only for the eye. */}
        <span
          aria-hidden
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-[12px] leading-4 whitespace-nowrap text-(color:--booth-text2) transition-opacity duration-200 ease-(--booth-ease-out) motion-reduce:transition-none",
            !playing && "opacity-0",
          )}
        >
          <VolumeOff size={13} strokeWidth={2.2} aria-hidden />
          No sound in this demo
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <BoothPlayButton playing={playing} onClick={onPlayToggle} />
        <BoothWaveform levels={levels} played={played} comparing={comparing} playhead={playhead} onSeek={onSeek} />
      </div>
      <div className="relative mt-2.5 flex items-center gap-1.5">
        <span data-mix-chip className="contents">
          <BoothToggleChip icon="sliders" title="Mix" on={mixOpen} label={mixOpen ? "Hide mix" : "Show mix"} onClick={onMixToggle} />
        </span>
        <span className="min-w-0 flex-1" />
        <AnimatePresence mode="popLayout" initial={false}>
          {dirty ? (
            <Actions key="dirty" reducedMotion={reducedMotion}>
              <BoothChipButton title="Revert" onClick={onRevert} disabled={saving} />
              <BoothChipButton title={saving ? "Saving…" : "Save"} onClick={onSave} disabled={saving} />
            </Actions>
          ) : (
            <Actions key="saved" reducedMotion={reducedMotion} still>
              <span className={STILL_CHIP}>
                <BoothIcon name="finder" size={13} />
                Open
              </span>
              <span className={STILL_CHIP}>Done</span>
            </Actions>
          )}
        </AnimatePresence>
      </div>
      {/* The sliders open like a section: at once, settling from 98%; closing, they go soft first. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {mixOpen && (
          <motion.div key="mix" className="mt-1.5 origin-top" {...swapMotion({ reducedMotion, scale: 0.98, delay: 0 })}>
            {MIX_ROWS.map((row) => (
              <BoothMixSlider
                key={row.stem}
                label={row.label}
                value={mix[row.stem]}
                onChange={(value) => onMixChange({ ...mix, [row.stem]: value })}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One side of the actions' swap. Leaving, it takes no presses; the still pair is hidden from assistive tech. */
function Actions({ children, reducedMotion, still = false }: { children: ReactNode; reducedMotion: boolean; still?: boolean }) {
  const present = useIsPresent();
  return (
    <motion.div
      data-mix-actions
      aria-hidden={still || undefined}
      inert={!present || undefined}
      className={cn("flex items-center gap-1.5", still && "pointer-events-none")}
      {...swapMotion({ reducedMotion, blur: 2 })}
    >
      {children}
    </motion.div>
  );
}
