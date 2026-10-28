"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Layers, Scissors, Upload } from "lucide-react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import { cn } from "@/lib/utils";

import { EpeBlurFade } from "./kit/epe-blur-fade";
import { EpeRoot } from "./kit/epe-root";
import { LightRays } from "./kit/light-rays";
import { SegmentedControl, segmentedControlItemClassName } from "./kit/segmented-control";
import {
  LANDING_MODE_COPY,
  landingModeVariants,
  landingNotice,
  type LandingMode,
  type LandingNotice,
} from "./wordmark/landing-mode";
import { PressureWordmark } from "./wordmark/pressure-wordmark";
import "./wordmark/wordmark.css";

// The drop zone's width tracks the wordmark size the way the product's
// max-w-2xl column tracks its text-7xl title, with a floor for narrow tiles.
const DROP_ZONE_WIDTH = "w-[min(100%,max(20rem,calc(var(--epe-wm-type)*8.9)))]";
const ROW_GAP = "mt-[clamp(8px,2.6cqh,16px)]";
// The product's lime focus ring vanishes on the lime pressed segment; a dark
// ring keeps keyboard focus visible there.
const MODE_BUTTON = cn(
  segmentedControlItemClassName,
  "aria-pressed:focus-visible:ring-(color:--primary-foreground)/60",
);

/**
 * The Easy Peasy Ease landing screen (app/page.tsx, upload state): LightRays,
 * the TextPressure wordmark, the Stitch / Split segmented control and the
 * drop zone. Nothing uploads: dropping or picking files shows the product's
 * validation message, or a note on where the app would go next.
 */
export function EasyPeasyEaseWordmarkDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { active, inView, reducedMotion } = useDemoActive(rootRef, 0.5);
  const revealed = useInView(rootRef, { once: true, amount: 0.35 });
  const [mode, setMode] = useState<LandingMode>("stitch");
  const [isDropZoneHovered, setIsDropZoneHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [notice, setNotice] = useState<LandingNotice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reveal = revealed ? "visible" : "hidden";
  const modeDirection = mode === "split" ? 1 : -1;
  const copy = LANDING_MODE_COPY[mode];
  const variants = landingModeVariants(reducedMotion);

  const chooseMode = (next: LandingMode) => {
    setMode(next);
    setNotice(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    setIsDropZoneHovered(false);
    setNotice(landingNotice(mode, Array.from(event.dataTransfer.files), "drop"));
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) setNotice(landingNotice(mode, files, "picker"));
  };

  // Anything dropped on the tile outside the drop zone is refused, so the
  // browser never navigates away to open the file.
  const refuseStrayDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
  };

  return (
    <EpeRoot
      ref={rootRef}
      role="group"
      aria-label="Easy Peasy Ease landing screen, interactive replica"
      onDragOver={refuseStrayDrag}
      onDrop={(event) => event.preventDefault()}
    >
      <p className="sr-only">
        Move the pointer, or drag a finger, across the EasyPeasyEase wordmark to thin its letters.
        Switch between Stitch clips and Split one video, then drop a video on the drop zone or press
        it to choose one. Nothing is uploaded.
      </p>
      <div className="epe-wm-frame absolute inset-0 flex flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
          <LightRays
            aria-hidden="true"
            className="absolute inset-0 z-0"
            color="oklch(0.889 0.027 234 / 0.15)"
            count={7}
            speed={14}
            // The product's rays are 70vh, 630px on a 900px desktop. The type
            // here is product size, so the rays are too. The seed spreads them
            // across the width, a few starting early, so light shows soon after
            // the tile scrolls in.
            length="135%"
            seed={4673}
            interactive={isDropZoneHovered || isDragOver}
            active={active}
          />
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4 py-[clamp(14px,6cqh,44px)] [--epe-wm-type:clamp(26px,min(9cqw,13.5cqh),72px)]">
            <div className="flex w-full flex-col items-center gap-[clamp(2px,1.2cqh,12px)] text-center">
              <EpeBlurFade delay={0} duration={0.55} offset={8} animate={reveal} className="w-full">
                <PressureWordmark
                  text="EasyPeasyEase"
                  sweep={active && revealed}
                  follow={inView}
                  reducedMotion={reducedMotion}
                  initialAnimationDelay={700}
                  className="mx-auto max-w-4xl text-(length:--epe-wm-type) font-bold tracking-tight text-foreground"
                />
              </EpeBlurFade>
              <EpeBlurFade
                delay={0.08}
                duration={0.55}
                offset={8}
                animate={reveal}
                className="epe-wm-intro flex flex-col items-center gap-[clamp(2px,1cqh,8px)] px-4"
              >
                <p className="max-w-lg text-[clamp(13px,3.2cqh,16px)] font-normal text-pretty text-(color:--body-muted-foreground)">
                  Free tool to stitch and apply ease curves to short videos.
                </p>
                <p className="epe-wm-version text-xs text-muted-foreground/50">v0.1.3</p>
              </EpeBlurFade>
            </div>

            <EpeBlurFade
              delay={0.16}
              duration={0.55}
              offset={8}
              animate={reveal}
              className="mt-[clamp(10px,5cqh,40px)] flex justify-center"
            >
              <SegmentedControl
                activeIndex={mode === "stitch" ? 0 : 1}
                indicatorClassName="bg-(color:--brand-strong)"
                role="group"
                aria-label="Choose how to start"
                className="tracking-[-0.005em]"
              >
                <button
                  type="button"
                  aria-pressed={mode === "stitch"}
                  onClick={() => chooseMode("stitch")}
                  className={MODE_BUTTON}
                >
                  <Layers className="h-4 w-4" />
                  <span className="text-sm font-medium">Stitch clips</span>
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "split"}
                  onClick={() => chooseMode("split")}
                  className={MODE_BUTTON}
                >
                  <Scissors className="h-4 w-4" />
                  <span className="text-sm font-medium">Split one video</span>
                </button>
              </SegmentedControl>
            </EpeBlurFade>

            <EpeBlurFade
              delay={0.24}
              duration={0.6}
              offset={10}
              blur="8px"
              animate={reveal}
              className={cn(ROW_GAP, DROP_ZONE_WIDTH, "flex max-h-[300px] min-h-[84px] flex-1")}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={copy.title}
                data-drag-over={isDragOver ? "" : undefined}
                className="epe-landing-drop-zone group flex w-full cursor-pointer items-center justify-center rounded-[16px] border-2 border-dashed border-muted-foreground/30 p-[clamp(8px,3cqh,48px)] text-center outline-none hover:border-primary/45 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/25 data-drag-over:border-primary/45"
                onPointerEnter={() => setIsDropZoneHovered(true)}
                onPointerMove={() => {
                  if (!isDropZoneHovered) setIsDropZoneHovered(true);
                }}
                onPointerLeave={() => setIsDropZoneHovered(false)}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "copy";
                  if (!isDragOver) setIsDragOver(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsDragOver(false);
                  }
                }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="grid place-items-center">
                  <AnimatePresence initial={false} mode="sync" custom={modeDirection}>
                    <motion.div
                      key={mode}
                      custom={modeDirection}
                      variants={variants.group}
                      exit="exit"
                      className="col-start-1 row-start-1 flex flex-col items-center justify-center gap-[clamp(6px,2.4cqh,16px)]"
                    >
                      <EpeBlurFade duration={0.34} variant={variants.reveal} custom={modeDirection} exit="exit">
                        {mode === "split" ? (
                          <Scissors className="epe-motion-icon epe-upload-motion-icon size-[clamp(24px,7.5cqh,40px)] text-muted-foreground" />
                        ) : (
                          <Upload className="epe-motion-icon epe-upload-motion-icon size-[clamp(24px,7.5cqh,40px)] text-muted-foreground" />
                        )}
                      </EpeBlurFade>
                      <div className="flex flex-col items-center gap-[clamp(2px,1cqh,8px)]">
                        <EpeBlurFade
                          delay={0.045}
                          duration={0.34}
                          variant={variants.reveal}
                          custom={modeDirection}
                          exit="exit"
                        >
                          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
                        </EpeBlurFade>
                        <EpeBlurFade
                          delay={0.09}
                          duration={0.34}
                          variant={variants.reveal}
                          custom={modeDirection}
                          exit="exit"
                        >
                          <p className="text-xs text-(color:--body-muted-foreground)">{copy.detail}</p>
                        </EpeBlurFade>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </EpeBlurFade>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple={mode === "stitch"}
              tabIndex={-1}
              aria-hidden="true"
              onChange={handlePick}
              className="hidden"
            />

            {/* The product puts the upload error above this line; sharing the
                line keeps the drop zone from resizing when one appears. */}
            <div
              aria-live="polite"
              className={cn(ROW_GAP, "grid min-h-5 w-[min(100%,40rem)] place-items-center")}
            >
              <AnimatePresence initial={false} mode="sync" custom={modeDirection}>
                {notice ? (
                  <motion.p
                    key={notice.text}
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    className={cn(
                      "col-start-1 row-start-1 text-center text-pretty",
                      notice.tone === "error"
                        ? "text-sm text-(color:--danger-foreground)"
                        : "text-xs text-(color:--success-foreground)",
                    )}
                  >
                    {notice.text}
                  </motion.p>
                ) : (
                  <EpeBlurFade
                    key={mode}
                    delay={0.135}
                    duration={0.34}
                    variant={variants.reveal}
                    custom={modeDirection}
                    exit="exit"
                    className="col-start-1 row-start-1 text-center text-xs text-pretty text-(color:--body-muted-foreground)"
                  >
                    {copy.description}
                  </EpeBlurFade>
                )}
              </AnimatePresence>
              <p
                aria-hidden="true"
                className="invisible col-start-1 row-start-1 text-center text-xs text-pretty"
              >
                {LANDING_MODE_COPY.split.description}
              </p>
            </div>
          </div>
        </div>

        <footer className="epe-wm-footer shrink-0 border-t border-border/50 px-6 py-4 font-mono text-[11px] tracking-wide text-muted-foreground">
          By Willie —{" "}
          <a
            href="https://github.com/shrimbly/easy-peasy-ease"
            aria-label="code on GitHub"
            className="epe-landing-footer-link inline-block underline transition-[color,transform] duration-150 hover:text-foreground focus-visible:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            code
          </a>{" "}
          —{" "}
          <a
            href="https://x.com/ReflctWillie"
            aria-label="x, Willie on X"
            className="epe-landing-footer-link inline-block underline transition-[color,transform] duration-150 hover:text-foreground focus-visible:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            x
          </a>
        </footer>
      </div>
    </EpeRoot>
  );
}
