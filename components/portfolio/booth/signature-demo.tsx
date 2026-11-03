"use client";

import { useCallback, useRef, useState, useSyncExternalStore, type DragEvent, type FocusEvent } from "react";
import { RotateCcw } from "lucide-react";
import { useInView } from "motion/react";

import { useInteractOnRelease } from "@/components/portfolio/node-banana/kit/use-interact";
import { useDemoActive, useDemoThumbnail } from "@/components/portfolio/use-demo-active";
import { SIGNATURE_STATUS } from "@/lib/booth/signature-demo";

import { BoothGlyph, BoothHint, BoothRoot } from "./kit";
import { DropZone } from "./signature/drop-zone";
import { FocusName } from "./signature/focus-name";
import { SignatureChip } from "./signature/signature-chip";
import "./signature/signature-demo.css";

// "The signature": Booth's name as its website draws it (studiovoice/site/index.html `.name`),
// which ports the popover's SignatureView.swift: Geist Serif, semibold by a sideways smear, in
// 40% ink and a little soft, with two fields of cloud drifting through it. It sits in the drop
// zone's dotted frame, as it does in the popover. The pointer, a finger or the arrow keys bring
// the letters under them into focus; the chips replay the reveal and hold a file over it. The
// app only shows the name on the drop zone and the first-run screen (PopoverLogic.swift
// `showsSignature`), so the demo shows nothing of a job: the Working crest SignatureWave.swift
// can draw never reaches the screen.

/** The page tile's corner radius below and from `sm` (app/portfolio/[slug]/page.tsx). */
const TILE_RADIUS = { phone: 28, sm: 32 } as const;
/** The drop zone sits this far inside the tile, its corners concentric with the tile's. */
const ZONE_INSET = 10;
/** The reveal plays once this much of the tile is in view, so the name comes in as you arrive. */
const REVEAL_IN_VIEW = 0.5;

const SM = "(min-width: 640px)";
function subscribeSm(onChange: () => void) {
  const query = window.matchMedia(SM);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

export function BoothSignatureDemo() {
  const root = useRef<HTMLDivElement>(null);
  const { active, reducedMotion } = useDemoActive(root);
  const thumbnail = useDemoThumbnail();
  const revealView = useInView(root, { amount: REVEAL_IN_VIEW });
  const sm = useSyncExternalStore(
    subscribeSm,
    () => window.matchMedia(SM).matches,
    () => true,
  );

  const [reveal, setReveal] = useState(0);
  const [entered, setEntered] = useState(false);
  const [overChip, setOverChip] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("");
  const [touched, setTouched] = useState(false);
  const markTouched = useCallback(() => setTouched(true), []);
  const interact = useInteractOnRelease(markTouched);
  const dragDepth = useRef(0);

  // The name comes forward through fog the first time the tile is well in view, as the site's
  // does as the page opens. With reduced motion it is simply there, at rest.
  if (!entered && (reducedMotion || (revealView && active))) {
    setEntered(true);
    if (!reducedMotion) setReveal(1);
  }

  const over = overChip || dragging;

  const replay = () => {
    setEntered(true);
    setReveal((r) => r + 1);
    setStatus(SIGNATURE_STATUS.reveal);
  };
  const toggleOver = () => {
    setOverChip((on) => !on);
    setStatus(overChip ? SIGNATURE_STATUS.overGone : SIGNATURE_STATUS.over);
  };
  // A real file dragged in from the desktop is over the popover too. Dropping it only lets go of
  // it: nothing is read from it, and nothing leaves the page.
  const onDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    if (dragDepth.current === 1) {
      setDragging(true);
      setStatus(SIGNATURE_STATUS.over);
    }
  };
  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragging(false);
      setStatus(overChip ? SIGNATURE_STATUS.over : SIGNATURE_STATUS.overGone);
    }
  };
  const onDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    markTouched();
    setStatus(overChip ? SIGNATURE_STATUS.over : SIGNATURE_STATUS.dropped);
  };

  // Tabbing in from outside sends no key to the tile; the hint gives way to the focus ring.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if ((event.target as Element).matches(":focus-visible")) markTouched();
  };

  const tileRadius = sm ? TILE_RADIUS.sm : TILE_RADIUS.phone;

  return (
    <BoothRoot
      ref={root}
      role="group"
      aria-label="Booth's signature: its name, slightly out of focus, with mist drifting through it"
      paused={!active && !reducedMotion}
      {...interact}
      onKeyDownCapture={markTouched}
      onFocusCapture={onFocus}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <p className="sr-only">
        Move the pointer over the name, or drag a finger across it, to bring the letters under it into focus. From the
        keyboard, focus the name and use the arrow keys to move the focus letter by letter. Replay plays the name&apos;s
        reveal again. File over sharpens it as a file dragged over the popover does. A real file dragged over the tile
        works too; nothing is read or uploaded.
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      <DropZone over={over} radius={tileRadius - ZONE_INSET} className="pointer-events-none absolute inset-2.5 size-[calc(100%-20px)]" />

      {/* A little more room below than above, as on the site, which lifts the name off the chips. */}
      <div className="absolute inset-x-0 top-0 bottom-14 flex items-center justify-center">
        <FocusName
          over={over}
          reveal={reveal}
          hidden={!entered}
          onAim={markTouched}
        />
      </div>

      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-2">
        <SignatureChip icon={<RotateCcw size={13} strokeWidth={2.2} aria-hidden />} label="Replay the reveal" onClick={replay}>
          Replay
        </SignatureChip>
        <SignatureChip
          icon={<BoothGlyph mode={over ? "target" : "idle"} size={13} ink="currentColor" />}
          on={over}
          label="A file over the popover"
          onClick={toggleOver}
        >
          File over
        </SignatureChip>
      </div>

      <BoothHint corner="top-left" hidden={touched || thumbnail} className="top-6 left-6">
        <span className="[@media(hover:none)]:hidden">Move the pointer over the name</span>
        <span className="hidden [@media(hover:none)]:inline">Drag a finger across the name</span>
      </BoothHint>
    </BoothRoot>
  );
}
