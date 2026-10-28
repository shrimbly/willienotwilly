"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

import { CHROME_SURFACE } from "../kit";

import { AssetDetail } from "./asset-detail";
import { AssetGrid } from "./asset-grid";
import { AssetNotice } from "./asset-notice";
import { EASE_OUT } from "./asset-tile";
import { AssetsHeader, AssetsSortMenu } from "./assets-header";
import { AssetsRail, RAIL_WIDTH } from "./assets-rail";
import { BulkBar } from "./bulk-bar";
import { AssetContextMenu } from "./context-menu";
import { useLibrary } from "./library";
import { BulkTagEditor } from "./tag-editor";

// The Assets view (src/components/assets/AssetsView.tsx): the rail, the
// header and the masonry, the detail over them, the bulk bar and notices
// bottom-centre. Below the docked rail's width the rail is a drawer.

function Popovers({ layer }: { layer: HTMLElement | null }) {
  const { state } = useLibrary();
  const popover = state.popover;
  if (!popover) return null;
  if (popover.kind === "menu") return <AssetContextMenu x={popover.x} y={popover.y} anchorId={popover.anchorId} ids={popover.ids} layer={layer} />;
  if (popover.kind === "sort") return <AssetsSortMenu x={popover.x} y={popover.y} layer={layer} />;
  return <BulkTagEditor ids={popover.ids} x={popover.x} y={popover.y} above={popover.above} layer={layer} />;
}

export function AssetsView({ inView, hint, hidden }: { inView: boolean; hint: boolean; hidden: boolean }) {
  const { state, actions, reducedMotion } = useLibrary();
  // A callback ref, so popovers get the layer as a value rather than reading a ref while rendering
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const detailOpen = state.detailId !== null;
  const quiet = !state.notice && state.selection.length === 0 && !detailOpen;

  return (
    <div
      ref={setLayer}
      data-assets-layer=""
      role="region"
      aria-label="Assets"
      inert={hidden}
      className={cn("nb-bg-canvas absolute inset-0 flex", hidden && "invisible")}
    >
      <div className="hidden min-h-0 @[840px]:flex" inert={detailOpen}>
        <AssetsRail />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col" inert={detailOpen}>
        <AssetsHeader layer={layer} />
        <AssetGrid inView={inView} />
      </div>

      <AnimatePresence>
        {state.railOpen && (
          <motion.div
            key="drawer"
            className="absolute inset-0 z-20 @[840px]:hidden"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              actions.setRailOpen(false);
            }}
          >
            <div aria-hidden className="absolute inset-0 bg-black/50" onClick={() => actions.setRailOpen(false)} />
            <motion.div
              role="dialog"
              aria-label="Filters"
              className="absolute inset-y-0 left-0 flex max-w-[85%]"
              style={{ width: RAIL_WIDTH }}
              initial={reducedMotion ? false : { x: -24 }}
              animate={{ x: 0 }}
              exit={reducedMotion ? undefined : { x: -24 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              <AssetsRail drawer onClose={() => actions.setRailOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AssetDetail />

      {/* Bulk bar, notices and the one hint, centred over the grid or the detail's stage */}
      <div
        className={cn(
          "pointer-events-none absolute right-0 bottom-4 left-0 z-40 flex flex-col items-center gap-2 px-3 @[560px]:bottom-5",
          detailOpen ? "@[700px]:right-[300px] @[960px]:right-[340px]" : "@[840px]:left-[232px]",
        )}
      >
        <AssetNotice />
        {!detailOpen && <BulkBar layer={layer} />}
        <AnimatePresence>
          {hint && quiet && (
            <motion.span
              key="hint"
              aria-hidden
              className={cn(CHROME_SURFACE, "nb-font-mono nb-tracking-eyebrow flex h-7 items-center rounded-full px-3 text-[10px] text-neutral-400 uppercase")}
              // The same first frame on the server and the client; reduced motion only drops the fade
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.25 } }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.4, delay: 1.2, ease: EASE_OUT }}
            >
              Open an asset to see its run
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <Popovers layer={layer} />
    </div>
  );
}
