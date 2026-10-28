"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { Film, LibraryBig, MessagesSquare } from "lucide-react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import { LIBRARY_ASSETS } from "@/lib/node-banana/assets";

import { AppWindow, NbRoot, ViewToggle } from "./kit";

import { AssetsView } from "./assets/assets-view";
import { ARRIVALS, ASSETS_BY_ID, LibraryProvider, useLibrary } from "./assets/library";
import { WorkflowCanvas } from "./assets/workflow-canvas";
import "./assets/assets.css";

// Node Banana 2.0's Assets view: everything the app generates or edits is
// saved as it is made and indexed here. Filter it, star and tag it, select
// in bulk, open an asset to see the run that made it, and jump to that
// workflow. While it plays untouched, fresh generations land at the top.

const WORKFLOW_NAMES = Object.fromEntries(LIBRARY_ASSETS.map((asset) => [asset.workflow.id, asset.workflow.name]));
const FIRST_ARRIVAL_MS = 2600;
const NEXT_ARRIVAL_MS = 4200;

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest("input, textarea, select"));
}

/** A control other than a tile has focus: Enter and Space are its own. */
function isOtherControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest("button, a, [role='checkbox']") && !target.closest("[data-asset-tile]");
}

/** The strip's Chat and Edit video entries, drawn as the app draws them at rest. */
function RestToggle({ icon }: { icon: ReactNode }) {
  return (
    <span aria-hidden className="flex h-[30px] w-[34px] shrink-0 items-center justify-center rounded-t-lg text-neutral-400">
      {icon}
    </span>
  );
}

function AssetsWindow({ rootRef, active, inView }: { rootRef: RefObject<HTMLDivElement | null>; active: boolean; inView: boolean }) {
  const { state, actions, grid, reducedMotion } = useLibrary();
  const [touched, setTouched] = useState(false);
  const onCanvas = state.appView === "canvas";

  // Fresh generations land at the top while the demo plays untouched; under
  // reduced motion they are simply already there
  const pending = ARRIVALS.filter((asset) => !state.landed.includes(asset.id) && !state.waiting.includes(asset.id));
  const next = pending[0]?.id;
  const landedCount = state.landed.length + state.waiting.length;
  useEffect(() => {
    if (reducedMotion) {
      if (next) actions.landAll();
      return;
    }
    if (!active || touched || !next || onCanvas) return;
    const timer = setTimeout(
      () => {
        const scroller = rootRef.current?.querySelector<HTMLElement>("[data-asset-scroller]");
        actions.arrive(next, !scroller || scroller.scrollTop < 8);
      },
      landedCount === 0 ? FIRST_ARRIVAL_MS : NEXT_ARRIVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [reducedMotion, active, touched, next, onCanvas, landedCount, actions, rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || touched) return;
    const touch = () => setTouched(true);
    root.addEventListener("pointerdown", touch);
    root.addEventListener("keydown", touch);
    return () => {
      root.removeEventListener("pointerdown", touch);
      root.removeEventListener("keydown", touch);
    };
  }, [rootRef, touched]);

  /**
   * The view's keys, as the app's handleAssetsKey has them, while focus is in
   * the demo: Esc closes the detail, then clears the selection; arrows move
   * through the grid (←/→ step through the detail); Enter opens, Space
   * selects, ⌘A selects all, Delete trashes, ⌘Z undoes, F is fullscreen in the
   * detail, and A switches between the library and the canvas.
   */
  const onKeyDown = (event: ReactKeyboardEvent) => {
    const key = event.key;
    const lower = key.toLowerCase();
    const mod = event.metaKey || event.ctrlKey;
    const own = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (isTypingTarget(event.target)) {
      if (key === "Escape") {
        own();
        (event.target as HTMLElement).blur();
      }
      return;
    }
    if (lower === "a" && !mod && !event.shiftKey && !event.altKey) {
      own();
      if (event.repeat) return;
      if (onCanvas) actions.showAssets();
      else actions.openCanvas(state.canvas.workflowId, state.canvas.assetId);
      return;
    }
    if (onCanvas) return;
    if (state.popover) {
      if (key === "Escape") {
        own();
        actions.closePopover();
      }
      return;
    }
    if (key === "Escape") {
      if (state.detailId) actions.closeDetail();
      else if (state.railOpen) actions.setRailOpen(false);
      else if (state.selection.length > 0) actions.clearSelection();
      else if (state.selectMode) actions.setSelectMode(false);
      else return;
      own();
      return;
    }
    if (mod) {
      if (lower === "z" && !event.shiftKey) {
        own();
        actions.undo();
      } else if (lower === "a" && !state.detailId) {
        own();
        actions.selectAll();
      }
      return;
    }
    if (event.altKey) return;

    if (state.detailId) {
      if ((key === "ArrowLeft" || key === "ArrowRight") && !(event.target instanceof HTMLMediaElement)) {
        own();
        actions.stepDetail(key === "ArrowLeft" ? -1 : 1);
      } else if (lower === "f" && !event.shiftKey) {
        own();
        const detail = rootRef.current?.querySelector<HTMLElement>("[data-asset-detail]");
        if (document.fullscreenElement) void document.exitFullscreen?.();
        else void detail?.requestFullscreen?.().catch(() => {});
      } else if ((key === "Delete" || key === "Backspace") && state.filters.view !== "trash") {
        own();
        actions.bulk([state.detailId], { action: "trash" });
      }
      return;
    }

    const arrows = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const;
    if (key in arrows) {
      own();
      grid.navigate(arrows[key as keyof typeof arrows]);
      return;
    }
    if (key === "Enter" && state.focusedId && !isOtherControl(event.target)) {
      own();
      actions.openDetail(state.focusedId);
      return;
    }
    if (key === " " && state.focusedId && !isOtherControl(event.target)) {
      own();
      actions.toggleSelect(state.focusedId);
      return;
    }
    if ((key === "Delete" || key === "Backspace") && state.filters.view !== "trash") {
      const ids = state.selection.length > 0 ? state.selection : state.focusedId ? [state.focusedId] : [];
      if (!ids.length) return;
      own();
      actions.bulk(ids, { action: "trash" });
    }
  };

  const canvasAsset = ASSETS_BY_ID[state.canvas.assetId];

  return (
    <div className="contents" onKeyDown={onKeyDown}>
      <AppWindow
        framed={false}
        tabs={state.tabs.map((id) => ({ id, label: WORKFLOW_NAMES[id] }))}
        activeTab={onCanvas ? state.canvas.workflowId : undefined}
        onTabChange={(id) => actions.openCanvas(id)}
        toggles={
          <>
            <RestToggle icon={<MessagesSquare size={16} strokeWidth={1.75} />} />
            <ViewToggle
              label="Assets"
              icon={<LibraryBig size={16} strokeWidth={1.75} />}
              shown={!onCanvas}
              onToggle={() => (onCanvas ? actions.showAssets() : actions.openCanvas(state.canvas.workflowId, state.canvas.assetId))}
            />
            <RestToggle icon={<Film size={16} strokeWidth={1.75} />} />
          </>
        }
      >
        <AssetsView inView={inView} hint={!touched} hidden={onCanvas} />
        {onCanvas && (
          <div className="absolute inset-0">
            <WorkflowCanvas key={canvasAsset.id} asset={canvasAsset} active={active} reducedMotion={reducedMotion} />
          </div>
        )}
      </AppWindow>
    </div>
  );
}

export function NodeBananaAssetsDemo() {
  const root = useRef<HTMLDivElement | null>(null);
  const { active, inView, reducedMotion } = useDemoActive(root);
  return (
    <NbRoot ref={root} role="group" aria-label="Node Banana asset library: every image, video and audio file the app made, with the run behind each one">
      <p className="sr-only">
        Filter the library from the rail, star or select tiles, and open an asset to see the prompt, model and settings that made it, then open its
        workflow. Press A to switch between the library and the canvas.
      </p>
      <LibraryProvider reducedMotion={reducedMotion}>
        <AssetsWindow rootRef={root} active={active} inView={inView} />
      </LibraryProvider>
    </NbRoot>
  );
}
