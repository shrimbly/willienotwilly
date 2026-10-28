"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Maximize2, Minimize2, RotateCcw, Star, Trash2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LibraryAsset } from "@/lib/node-banana/assets";

import { ProviderMark } from "../kit";

import { AssetNotice } from "./asset-notice";
import { AssetPlaceholder } from "./asset-tile";
import {
  assetEyebrow,
  assetTitle,
  formatBytes,
  formatCost,
  formatDateTime,
  formatDimensions,
  formatDuration,
  formatNumber,
  operationLabel,
  projectLabel,
} from "./format";
import { ASSETS_BY_ID, useLibrary } from "./library";
import { DialogButton, DialogEyebrow, ring } from "./ui";
import { TagInput } from "./tag-editor";

// One asset, full size, over the grid (src/components/assets/AssetDetail.tsx):
// the media on a dark stage with previous/next, and the panel with the run
// that made it. In a narrow tile it is a sheet: the stage above the panel.

/** "Open workflow", or for a project's asset "Open project" and "Open as it was when made". */
export function workflowActions(asset: LibraryAsset): { label: string; secondary?: boolean }[] {
  if (asset.origin === "uploaded") return [];
  if (asset.project) return [{ label: "Open project" }, { label: "Open as it was when made", secondary: true }];
  return [{ label: "Open workflow" }];
}

export async function copyPrompt(asset: LibraryAsset, notify: (message: string, tone?: "info" | "error") => void) {
  if (!asset.prompt) return;
  try {
    await navigator.clipboard.writeText(asset.prompt);
    notify("Prompt copied");
  } catch {
    notify("The prompt could not be copied.", "error");
  }
}

/**
 * The detail's player: a video plays on open as the app's does, while the
 * demo is on screen and motion is not reduced. Leaving the screen pauses
 * whatever plays, and only what the demo paused picks up again on return.
 */
function StagePlayer({ asset, onScreen, autoPlay }: { asset: LibraryAsset; onScreen: boolean; autoPlay: boolean }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const resume = useRef(asset.kind === "video");

  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    if (!onScreen) {
      if (!media.paused) {
        media.pause();
        resume.current = true;
      }
      return;
    }
    if (autoPlay && resume.current) {
      resume.current = false;
      void media.play().catch(() => {});
    }
  }, [onScreen, autoPlay]);

  if (asset.kind === "audio") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 @[700px]:gap-8 @[700px]:p-10">
        <AssetPlaceholder kind="audio" size={64} className="nb-rounded-card aspect-[2/1] h-auto max-h-[55%] w-auto max-w-[560px] min-w-0" />
        <audio ref={ref} src={asset.media} controls preload="none" className="w-full max-w-[560px]" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 @[700px]:p-10">
      <video
        ref={ref}
        src={asset.media}
        poster={asset.thumb?.src}
        controls
        muted
        loop
        playsInline
        preload="metadata"
        className="max-h-full max-w-full rounded-[2px] bg-black"
      />
    </div>
  );
}

function Stage({ asset, onScreen, autoPlay }: { asset: LibraryAsset; onScreen: boolean; autoPlay: boolean }) {
  if ((asset.kind === "video" || asset.kind === "audio") && asset.media) {
    return <StagePlayer key={asset.id} asset={asset} onScreen={onScreen} autoPlay={autoPlay} />;
  }
  return (
    <div role="img" aria-label={assetTitle(asset)} className="absolute inset-0 flex items-center justify-center p-4 select-none @[700px]:p-10">
      {asset.thumb && (
        <Image
          key={asset.id}
          src={asset.thumb.src}
          alt=""
          width={asset.thumb.width}
          height={asset.thumb.height}
          unoptimized
          draggable={false}
          className="h-auto max-h-full w-auto max-w-full rounded-[2px] object-contain"
        />
      )}
    </div>
  );
}

function PanelIconButton({
  icon: Icon,
  label,
  onClick,
  pressed,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100",
        ring,
        danger && "hover:text-red-300",
        pressed && "text-neutral-100",
      )}
    >
      <Icon size={16} strokeWidth={1.75} fill={pressed ? "currentColor" : "none"} />
    </button>
  );
}

function Section({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-t border-white/[0.06] px-4 py-4 @[700px]:px-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <DialogEyebrow>{label}</DialogEyebrow>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-white/[0.04] py-1.5 first:border-t-0">
      <dt className="nb-text-ink-3 shrink-0 text-xs">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] break-words text-neutral-200">{children}</dd>
    </div>
  );
}

function DetailPanel({ asset, showParameters, onToggleParameters }: { asset: LibraryAsset; showParameters: boolean; onToggleParameters: () => void }) {
  const { state, actions, facets } = useLibrary();
  const record = state.records[asset.id];
  const view = state.filters.view;
  const [primary, secondary] = workflowActions(asset);
  const parameters = Object.entries(asset.parameters ?? {});
  const node = asset.origin === "edited" && asset.producer.operation ? `${asset.producer.title} · ${operationLabel(asset.producer.operation)}` : asset.producer.title;
  const open = () => actions.openCanvas(asset.workflow.id, asset.id);

  return (
    <aside
      aria-label="Asset details"
      className="nb-bg-pane nb-assets-scroll nb-assets-scroll-touch flex min-h-0 w-full flex-1 flex-col @[700px]:w-[300px] @[700px]:flex-none @[960px]:w-[340px]"
    >
      <div className="px-4 pt-4 pb-4 @[700px]:px-6 @[700px]:pt-5">
        <DialogEyebrow className="block">{assetEyebrow(asset)}</DialogEyebrow>
        <h4
          className="nb-font-display mt-1.5 line-clamp-3 text-lg leading-6 font-semibold tracking-[-0.02em] text-neutral-100 select-text @[700px]:text-xl"
          title={asset.prompt ?? asset.filename}
        >
          {assetTitle(asset)}
        </h4>

        {view !== "trash" && primary && (
          <div className="mt-4 flex flex-col gap-1.5">
            <DialogButton variant="primary" size="md" onClick={open}>
              {primary.label}
            </DialogButton>
            {secondary && (
              <>
                <DialogButton variant="outline" onClick={open} className="mt-1">
                  {secondary.label}
                </DialogButton>
                <p className="nb-text-ink-3 text-xs leading-4">Opens a copy; your project isn&apos;t changed.</p>
              </>
            )}
          </div>
        )}

        <div className="mt-3 -ml-1.5 flex items-center gap-0.5">
          <a
            href={asset.media ?? asset.thumb?.src}
            download={asset.filename}
            aria-label="Download"
            title="Download"
            className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100", ring)}
          >
            <Download size={16} strokeWidth={1.75} />
          </a>
          {asset.prompt && <PanelIconButton icon={Copy} label="Copy prompt" onClick={() => void copyPrompt(asset, actions.notify)} />}
          <PanelIconButton
            icon={Star}
            label={record.favorite ? "Remove from Favorites" : "Add to Favorites"}
            pressed={record.favorite}
            onClick={() => actions.bulk([asset.id], { action: record.favorite ? "unfavorite" : "favorite" })}
          />
          {view === "trash" ? (
            <>
              <PanelIconButton icon={RotateCcw} label="Restore" onClick={() => actions.bulk([asset.id], { action: "restore" })} />
              <PanelIconButton icon={Trash2} label="Delete permanently…" danger onClick={() => actions.confirmDelete([asset.id])} />
            </>
          ) : (
            <PanelIconButton icon={Trash2} label="Trash" danger onClick={() => actions.bulk([asset.id], { action: "trash" })} />
          )}
        </div>
      </div>

      {asset.prompt && (
        <Section
          label="Prompt"
          action={
            <button
              type="button"
              onClick={() => void copyPrompt(asset, actions.notify)}
              aria-label="Copy prompt"
              title="Copy prompt"
              className={cn("flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-100", ring)}
            >
              <Copy size={13} strokeWidth={1.75} />
            </button>
          }
        >
          <p className="nb-assets-scroll text-[13px] leading-5 break-words whitespace-pre-wrap text-neutral-200 select-text @[700px]:max-h-60">{asset.prompt}</p>
        </Section>
      )}

      <Section label="Tags">
        <TagInput
          id={asset.id}
          tags={record.tags}
          suggestions={facets.tags.map((tag) => tag.value)}
          onAdd={(tag) => actions.bulk([asset.id], { action: "tag", tags: [tag] })}
          onRemove={(tag) => actions.bulk([asset.id], { action: "untag", tags: [tag] })}
        />
      </Section>

      <Section label="Details">
        <dl>
          <DetailRow label="Created">{formatDateTime(asset.at)}</DetailRow>
          <DetailRow label="Workflow">{asset.workflow.name}</DetailRow>
          <DetailRow label="Project">{projectLabel(asset.project)}</DetailRow>
          {asset.origin !== "uploaded" && <DetailRow label="Node">{node}</DetailRow>}
          {asset.model && (
            <DetailRow label="Model">
              <span className="inline-flex items-center gap-1.5">
                <ProviderMark provider={asset.model.provider} className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                {asset.model.displayName}
              </span>
            </DetailRow>
          )}
          <DetailRow label="Dimensions">{formatDimensions(asset.width, asset.height)}</DetailRow>
          <DetailRow label="Duration">{asset.durationSec ? formatDuration(asset.durationSec) : null}</DetailRow>
          <DetailRow label="Size">{formatBytes(asset.bytes)}</DetailRow>
          <DetailRow label="Format">{`${asset.ext.toUpperCase()} · ${asset.mime}`}</DetailRow>
          <DetailRow label="Cost">{asset.cost ? formatCost(asset.cost) : null}</DetailRow>
        </dl>
      </Section>

      {parameters.length > 0 && (
        <section className="border-t border-white/[0.06] px-4 py-4 @[700px]:px-6">
          <button type="button" aria-expanded={showParameters} onClick={onToggleParameters} className={cn("flex w-full items-center justify-between rounded", ring)}>
            <DialogEyebrow>Parameters · {parameters.length}</DialogEyebrow>
            <ChevronDown size={14} className={cn("text-neutral-500 transition-transform motion-reduce:transition-none", showParameters && "rotate-180")} />
          </button>
          {showParameters && (
            <dl className="mt-2">
              {parameters.map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-4 border-t border-white/[0.04] py-1.5 first:border-t-0">
                  <dt className="nb-font-mono nb-text-ink-3 shrink-0 text-[11px]">{key}</dt>
                  <dd className="nb-font-mono min-w-0 text-right text-[11px] break-words text-neutral-200 select-text">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      <Section label="File">
        <p className="nb-font-mono text-[11px] leading-4 break-all text-neutral-300 select-text">{asset.path}</p>
      </Section>
    </aside>
  );
}

export function AssetDetail() {
  const { state, actions, list, reducedMotion, onScreen } = useLibrary();
  const ref = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const detailId = state.detailId;
  const open = detailId !== null;

  // Focus comes in with the detail (the grid behind is inert)
  useEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!ref.current && document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Leaving the detail leaves fullscreen too
  useEffect(() => {
    if (!open && typeof document !== "undefined" && document.fullscreenElement && document.fullscreenElement === ref.current) {
      void document.exitFullscreen?.();
    }
  }, [open]);

  if (!detailId) return null;
  const asset = ASSETS_BY_ID[detailId];
  const index = list.findIndex((item) => item.id === detailId);
  const hasPrevious = index > 0;
  const hasNext = index !== -1 && index < list.length - 1;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void ref.current?.requestFullscreen?.().catch(() => {});
  };

  const stepButton = "absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-800/90 text-neutral-200 transition-colors hover:bg-neutral-700 @[700px]:h-10 @[700px]:w-10";

  return (
    <div
      ref={ref}
      data-asset-detail=""
      role="dialog"
      aria-modal="true"
      aria-label={assetTitle(asset)}
      tabIndex={-1}
      className="nb-drop-in nb-bg-canvas @container absolute inset-0 z-30 outline-none motion-reduce:animate-none"
    >
      <div className="flex h-full flex-col @[700px]:flex-row">
        <div className="relative flex h-[46%] min-h-0 shrink-0 flex-col bg-[#0f0f0f] @[700px]:h-auto @[700px]:min-w-0 @[700px]:flex-1">
          <div className="flex h-10 shrink-0 items-center gap-2 px-2 @[700px]:h-12 @[700px]:px-3">
            <button
              type="button"
              onClick={actions.closeDetail}
              className={cn(
                "nb-font-display flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-neutral-100",
                ring,
              )}
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
              Assets
            </button>
            {index !== -1 && (
              <DialogEyebrow className="ml-1 tabular-nums">
                {formatNumber(index + 1)} / {formatNumber(list.length)}
              </DialogEyebrow>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              title={fullscreen ? "Exit full screen (F)" : "Full screen (F)"}
              className={cn("ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100", ring)}
            >
              {fullscreen ? <Minimize2 size={16} strokeWidth={1.75} /> : <Maximize2 size={16} strokeWidth={1.75} />}
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <Stage asset={asset} onScreen={onScreen} autoPlay={!reducedMotion} />
            {hasPrevious && (
              <button type="button" onClick={() => actions.stepDetail(-1)} aria-label="Previous asset" title="Previous (←)" className={cn(stepButton, "left-2 @[700px]:left-3", ring)}>
                <ChevronLeft size={20} strokeWidth={1.75} />
              </button>
            )}
            {hasNext && (
              <button type="button" onClick={() => actions.stepDetail(1)} aria-label="Next asset" title="Next (→)" className={cn(stepButton, "right-2 @[700px]:right-3", ring)}>
                <ChevronRight size={20} strokeWidth={1.75} />
              </button>
            )}
            {fullscreen && (
              <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center">
                <AssetNotice />
              </div>
            )}
          </div>
        </div>

        <DetailPanel asset={asset} showParameters={showParameters} onToggleParameters={() => setShowParameters(!showParameters)} />
      </div>
    </div>
  );
}
