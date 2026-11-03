"use client";

import { cn } from "@/lib/utils";

import { BoothChipButton, BoothCompareLine, BoothFrame, BoothIcon, BoothPlayButton, BoothWaveform, type BoothIconName } from "../kit";

// The popover on its Done screen, for an audio file (no Video chip): studiovoice/app/Sources/
// Booth/UI/Screens/DoneScreen.swift, put together from the kit's pieces rather than the kit's
// BoothDoneScreen so each control can say what it does here. Title 15/20 w500; "Hold ⌥ to
// compare" 2 pt under it; play and the 56 bars 12 pt under that; the chips 10 pt lower. The
// glass is the panel's (6 pt inside a 0.5 pt hairline) round the 307 pt frame.

/** Mix lives in the next demo down: the chip takes the visitor there (as the agent pill does on Node Banana's canvas). */
function openMixDemo() {
  const target = document.querySelector<HTMLElement>('[data-demo="booth-mix"]');
  if (!target) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
}

/**
 * Open (in Finder) and Done, drawn as the app draws them but still: there is no Finder to show
 * the file in, and nowhere for Done to go back to. Kept so the screen is the app's, not a cut-down one.
 */
function StillChip({ icon, title }: { icon?: BoothIconName; title: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 shrink-0 items-center gap-[5px] rounded-full px-[9px] text-[12px] leading-4 whitespace-nowrap text-(color:--booth-text2) shadow-[inset_0_0_0_1px_var(--booth-sep)] select-none"
    >
      {icon && <BoothIcon name={icon} size={13} />}
      {title}
    </span>
  );
}

export interface CompareDonePanelProps {
  title: string;
  comparing: boolean;
  onComparingChange: (comparing: boolean) => void;
  playing: boolean;
  /** The tracks are being fetched and decoded: the play button breathes. */
  loading: boolean;
  onPlayToggle: () => void;
  /** A mouse or pen over Play, or the keyboard on it: the moment to start fetching the tracks. */
  onPlayIntent?: () => void;
  levels: readonly number[];
  played: number;
  playhead: number;
  onSeek: (fraction: number) => void;
  reducedMotion: boolean;
}

/** The 320 pt popover showing the Done screen, live. */
export function CompareDonePanel({
  title,
  comparing,
  onComparingChange,
  playing,
  loading,
  onPlayToggle,
  onPlayIntent,
  levels,
  played,
  playhead,
  onSeek,
  reducedMotion,
}: CompareDonePanelProps) {
  return (
    <div className="booth-glass w-80 shrink-0 p-[6px]">
      <BoothFrame screen="done" reducedMotion={reducedMotion}>
        {/* The app's ScreenTitle, as text: the file name is not a heading in the page's outline. */}
        <p className="truncate text-[15px] leading-5 font-medium text-(color:--booth-text)">{title}</p>
        <BoothCompareLine comparing={comparing} onComparingChange={onComparingChange} className="mt-0.5" />
        <div className="mt-3 flex items-center gap-2">
          {/* 26 pt as in the app, with a 42 pt target round it for a finger. */}
          <BoothPlayButton
            playing={playing}
            onClick={onPlayToggle}
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") onPlayIntent?.();
            }}
            onFocus={onPlayIntent}
            className={cn("relative after:absolute after:-inset-2 after:rounded-full", loading && "booth-cmp-waiting")}
          />
          <BoothWaveform levels={levels} played={played} comparing={comparing} playhead={playhead} onSeek={onSeek} />
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <BoothChipButton icon="sliders" title="Mix" label="Mix, in the next demo" onClick={openMixDemo} />
          <span className="min-w-0 flex-1" />
          <StillChip icon="finder" title="Open" />
          <StillChip title="Done" />
        </div>
      </BoothFrame>
    </div>
  );
}
