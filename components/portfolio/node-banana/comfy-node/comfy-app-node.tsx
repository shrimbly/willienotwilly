"use client";

import { type CSSProperties } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { ComfyWordmark, NodeCard, SummaryValues, dotWindow, type NodeGraph } from "../kit";
import { ComfyControlsCard } from "./comfy-controls-card";
import { ComfyParameters, type SeedMode } from "./comfy-parameters";
import { COMFY_ASPECT, COMFY_MIN_W, WORKFLOW_NODE_COUNT, type ComfyParams, type ComfyRun, type Still } from "./data";
import "./comfy-node.css";

// ComfyAppNode (src/components/nodes/ComfyAppNode.tsx) on the kit's node
// anatomy: the Comfy wordmark and the workflow's name in the header, its
// App Mode inputs as sockets, the output at its own proportions, the run
// history in the gap row, and "App workflow · 34 nodes" opening into the
// workflow's settings.

const WORKFLOW_NAME = "Z-Image and upscale";
const PANEL_ID = "nb-comfy-params";

/** Where a run is: queued (spinner), rendering (latent frames) or handing on to the Output node. */
export interface ComfyRunView {
  status: "queued" | "running" | "output";
  /** The still being sampled and how far the sampler has got (0–1); null before the first preview. */
  preview: { still: Still; progress: number; frame: number } | null;
}

export interface ComfyAppNodeProps {
  graph: NodeGraph;
  selected: boolean;
  /** A press that may become a drag (React Flow selects on press). */
  onSelect: () => void;
  /** A press on the gap row or the controls card, which never drag: select only. */
  onPress: () => void;
  onDragEnd: (moved: boolean) => void;
  maxWidth: number;
  /** Double-clicking a resize edge restores this width. */
  defaultWidth: number;
  run: ComfyRunView | null;
  onRun: () => void;
  history: ComfyRun[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  params: ComfyParams;
  onParamsChange: (patch: Partial<ComfyParams>) => void;
  seedMode: SeedMode;
  onSeedModeChange: (mode: SeedMode) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  controlsWidth?: number;
  onControlsWidthChange: (width: number | undefined) => void;
  /** The site's "play with me" note, beside the corner or above it; null hides it for good. */
  hint: "right" | "above" | null;
  hintHidden: boolean;
}

export function ComfyAppNode({
  graph,
  selected,
  onSelect,
  onPress,
  onDragEnd,
  maxWidth,
  defaultWidth,
  run,
  onRun,
  history,
  index,
  onPrev,
  onNext,
  params,
  onParamsChange,
  seedMode,
  onSeedModeChange,
  expanded,
  onExpandedChange,
  controlsWidth,
  onControlsWidthChange,
  hint,
  hintHidden,
}: ComfyAppNodeProps) {
  const running = run !== null && run.status !== "output";
  const current = history[Math.min(index, history.length - 1)];
  // Every still the history holds stays mounted and loads at once (the demo only
  // mounts near the viewport), so paging never waits on a load.
  const stills = [...new Map(history.map((r) => [r.still.src, r.still])).values()];
  const status = running ? run.status : null;

  return (
    <NodeCard
      graph={graph}
      id="comfy"
      selected={selected}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
      running={running}
      resizable={{ min: COMFY_MIN_W, max: maxWidth, defaultWidth }}
      title={WORKFLOW_NAME}
      titleLogo={<ComfyWordmark className="h-3 w-auto shrink-0" />}
      subtitle={WORKFLOW_NAME}
      onRun={onRun}
      aria-label={`ComfyUI app node: ${WORKFLOW_NAME}`}
      media={{ aspect: COMFY_ASPECT }}
      mediaClassName="bg-neutral-900/60"
      cardChildren={
        hint && (
          <span className="nb-comfy-hint" data-variant={hint} data-hidden={hintHidden ? "" : undefined} aria-hidden>
            <span className="nb-comfy-hint__text">play with me</span>
            <svg
              className="nb-comfy-hint__arrow"
              width="64"
              height="52"
              viewBox="0 0 64 52"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M44 10 C 30 8, 14 16, 8 40" />
              <path d="M3 32 L 8 41 L 14 34" />
            </svg>
          </span>
        )
      }
      gap={
        history.length > 1 ? (
          <RunCarousel index={index} count={history.length} onPrev={onPrev} onNext={onNext} loading={running} onPress={onPress} />
        ) : undefined
      }
      controls={
        <ComfyControlsCard
          title="App workflow"
          values={<SummaryValues items={[status ?? `${WORKFLOW_NODE_COUNT} nodes`]} />}
          expanded={expanded}
          onToggle={() => onExpandedChange(!expanded)}
          width={controlsWidth}
          onWidthChange={onControlsWidthChange}
          panelId={PANEL_ID}
          onPress={onPress}
        >
          <ComfyParameters values={params} onChange={onParamsChange} seedMode={seedMode} onSeedModeChange={onSeedModeChange} />
        </ComfyControlsCard>
      }
    >
      {stills.map((still) => (
        <Image
          key={still.src}
          src={still.src}
          alt={still.src === current.still.src ? `Run ${current.id}: ${still.alt}` : ""}
          width={still.width}
          height={still.height}
          unoptimized
          loading="eager"
          draggable={false}
          aria-hidden={still.src === current.still.src && !running ? undefined : true}
          className={cn("absolute inset-0 h-full w-full object-cover", (still.src !== current.still.src || running) && "invisible")}
        />
      ))}
      {running && (run.preview ? <LatentPreview {...run.preview} /> : <Rendering />)}
    </NodeCard>
  );
}

/** The first seconds of a run, before the engine sends a preview. */
function Rendering() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-neutral-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
        <span className="text-[10px]">Rendering…</span>
      </div>
    </div>
  );
}

/**
 * The latent as it forms: one frame per sampler step, each replacing the
 * last (a fade would cross-blend two states into something neither was).
 */
function LatentPreview({ still, progress, frame }: { still: Still; progress: number; frame: number }) {
  const left = 1 - progress;
  const style = {
    "--nb-comfy-blur": `${(0.5 + 13 * left ** 1.5).toFixed(2)}px`,
    "--nb-comfy-saturate": (1.35 - 0.35 * progress).toFixed(2),
    "--nb-comfy-contrast": (1.15 - 0.15 * progress).toFixed(2),
  } as CSSProperties;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image src={still.src} alt="" width={still.width} height={still.height} unoptimized loading="eager" draggable={false} className="nb-comfy-latent" style={style} />
      <div className="nb-comfy-noise" style={{ opacity: 0.05 + 0.9 * left ** 1.2, backgroundPosition: `${(frame * 37) % 180}px ${(frame * 23) % 100}px` }} />
      {/* Over the picture, not beside it: it has to stay legible on whatever the latent looks like. */}
      <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
        <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-neutral-500 border-t-blue-400" />
        <span className="text-[9px] text-neutral-200">Rendering…</span>
      </div>
    </div>
  );
}

/**
 * ‹ ••● 1 / 3 ›: the run history (ui/CarouselControls.tsx, noun "run"). The
 * newest run is first; "next" steps back to older ones, both ends wrap, and
 * the arrows rest while a run is in flight.
 */
function RunCarousel({
  index,
  count,
  onPrev,
  onNext,
  loading,
  onPress,
}: {
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
  onPress: () => void;
}) {
  const safe = Math.min(Math.max(index, 0), count - 1);
  return (
    <div className="nodrag flex h-full items-center justify-center gap-1.5 select-none" onPointerDownCapture={onPress}>
      <NavButton title="Previous run" onClick={onPrev} disabled={loading} dir="prev" />
      <div className="flex items-center gap-[3px]" aria-hidden>
        {dotWindow(safe, count).map((i) => (
          <span
            key={i}
            className={cn("block rounded-full transition-colors", i === safe ? "h-[5px] w-[5px] bg-neutral-300" : "h-1 w-1 bg-neutral-600")}
          />
        ))}
      </div>
      <span className="nb-text-node min-w-[32px] text-center text-neutral-400 tabular-nums">
        {`${safe + 1} / ${count}`}
      </span>
      <NavButton title="Next run" onClick={onNext} disabled={loading} dir="next" />
    </div>
  );
}

function NavButton({ title, onClick, disabled, dir }: { title: string; onClick: () => void; disabled: boolean; dir: "prev" | "next" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="nb-squircle flex h-5 w-5 items-center justify-center rounded-[6px] text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
    >
      {dir === "prev" ? <ChevronLeft size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
    </button>
  );
}
