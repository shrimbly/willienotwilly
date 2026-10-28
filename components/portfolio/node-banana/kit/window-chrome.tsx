"use client";

import type { ButtonHTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { ChevronDown, LoaderCircle, Play, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { ClaudeMark, CodexMark } from "./provider-badge";

// The desktop window around the canvas: macOS lights, the workflow tab strip
// (src/components/WorkflowTabs.tsx), the canvas frame, and the canvas chrome
// classes (src/components/chromeStyles.ts) with the Agent pill (AgentButton).

/** CHROME_SURFACE: floating glass for the canvas chrome (add a rounded-xl and a layout). */
export const CHROME_SURFACE = "nb-chrome-surface";
export const CHROME_ICON_BUTTON =
  "flex shrink-0 items-center justify-center rounded-lg nb-squircle text-neutral-300 " +
  "transition-[background-color,color,transform] duration-[120ms] ease-out " +
  "hover:bg-white/7 hover:text-white active:scale-[0.96] active:bg-white/12 active:text-white " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-40";
export const CHROME_ICON_BUTTON_SIZE = { sm: "h-7 w-7", md: "h-8 w-8", lg: "h-9 w-9" } as const;
export const CHROME_ICON_BUTTON_OPEN = "bg-white/10 text-white";
export const CHROME_DIVIDER = "mx-1 h-5 w-px shrink-0 bg-white/10";
export const CHROME_MENU_ITEM =
  "flex h-7 w-full items-center gap-2 rounded-md nb-squircle px-2 text-left text-[11px] font-medium text-neutral-200 hover:bg-white/7 hover:text-white";

/** A chrome icon button (32px by default) with an accessible name. */
export function ChromeButton({
  label,
  size = "md",
  open = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: keyof typeof CHROME_ICON_BUTTON_SIZE; open?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(CHROME_ICON_BUTTON, CHROME_ICON_BUTTON_SIZE[size], open && CHROME_ICON_BUTTON_OPEN, className)}
    >
      {children}
    </button>
  );
}

/** The macOS window controls, dimmed to 45% as the app draws them. Decorative. */
export function TrafficLights({ className }: { className?: string }) {
  return (
    <div className={cn("nb-app__lights", className)} aria-hidden>
      <span className="nb-app__light nb-app__light--close" />
      <span className="nb-app__light nb-app__light--minimize" />
      <span className="nb-app__light nb-app__light--fullscreen" />
    </div>
  );
}

function TabEar({ side, fill = "var(--nb-canvas)" }: { side: "left" | "right"; fill?: string }) {
  return (
    <svg viewBox="0 0 9 9" fill="none" aria-hidden className={cn("nb-tab__ear", side === "left" ? "nb-tab__ear--left" : "nb-tab__ear--right")}>
      <path d="M8.5 0 A8 8.5 0 0 1 0.5 8.5 L0.5 9 L9 9 L9 0 Z" fill={fill} />
      <path d="M8.5 0 A8 8.5 0 0 1 0.5 8.5" stroke="var(--nb-card-border)" strokeWidth={1} />
    </svg>
  );
}

export interface AppTab {
  id: string;
  /** Unset: an italic "Untitled". */
  label?: string;
  /** The red unsaved dot (the close button replaces it on hover). */
  unsaved?: boolean;
}

/** A leading view entry (Chat C, Assets A, Edit video E): icon-only until its view is up. */
export function ViewToggle({ label, icon, shown = false, onToggle }: { label: string; icon: ReactNode; shown?: boolean; onToggle?: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={shown}
      title={label}
      className={cn(
        "relative flex h-[30px] shrink-0 items-center gap-1.5 rounded-t-lg text-xs whitespace-nowrap focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
        shown ? "nb-bg-pane -mb-0.5 h-[32px] px-3 text-neutral-100" : "w-[34px] justify-center text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200",
      )}
    >
      {shown && (
        <>
          <TabEar side="left" fill="var(--nb-pane)" />
          <TabEar side="right" fill="var(--nb-pane)" />
        </>
      )}
      <span className="relative flex">{icon}</span>
      {shown && label}
    </button>
  );
}

export interface AppWindowProps {
  tabs: ReadonlyArray<AppTab>;
  activeTab?: string;
  onTabChange?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onNewTab?: () => void;
  /** macOS lights at the left of the strip (default true). */
  lights?: boolean;
  /** Leading ViewToggles (Chat, Assets, Edit video). */
  toggles?: ReactNode;
  /** The window's own border, corners and shadow (default true). */
  framed?: boolean;
  /** The landing site's fold: no bottom edge, fading out at the bottom. */
  fade?: boolean;
  className?: string;
  /** The canvas frame's content: usually a <Canvas>. */
  children?: ReactNode;
  /** Overlays inside the frame but above the canvas. */
  frameOverlay?: ReactNode;
}

/**
 * Arrow keys between the workflow tabs (WAI-ARIA tabs, automatic activation):
 * Left/Right wrap, Home/End jump; tabs hidden at the current width are skipped.
 */
function onTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, onTabChange?: (id: string) => void) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const list = event.currentTarget.closest('[role="tablist"]');
  if (!list) return;
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')].filter((tab) => tab.getClientRects().length > 0);
  const at = tabs.indexOf(event.currentTarget);
  if (at < 0 || tabs.length < 2) return;
  event.preventDefault();
  const n = tabs.length;
  const next = event.key === "Home" ? 0 : event.key === "End" ? n - 1 : (at + (event.key === "ArrowRight" ? 1 : -1) + n) % n;
  const tab = tabs[next];
  tab.focus();
  if (tab.dataset.tabId) onTabChange?.(tab.dataset.tabId);
}

/**
 * The Node Banana desktop window: lights, the tab strip (the shown tab flows
 * into the canvas frame through its ears) and the canvas frame. The tabs rove:
 * only the shown one is in the Tab order, the arrow keys move between them.
 */
export function AppWindow({
  tabs,
  activeTab,
  onTabChange,
  onTabClose,
  onNewTab,
  lights = true,
  toggles,
  framed = true,
  fade = false,
  className,
  children,
  frameOverlay,
}: AppWindowProps) {
  const shownIndex = tabs.findIndex((t) => t.id === activeTab);
  // With no tab shown (another view is up), the first takes the Tab stop.
  const stopIndex = Math.max(0, shownIndex);
  return (
    <div
      className={cn("nb-app absolute inset-0", className)}
      data-framed={framed ? "" : undefined}
      data-fade={fade ? "" : undefined}
      data-lights={lights ? "" : undefined}
    >
      {lights && <TrafficLights />}
      <div role="tablist" aria-label="Open workflows" className="nb-app__tabs nb-bg-window">
        {toggles}
        {tabs.map((tab, index) => {
          const shown = index === shownIndex;
          const hairline = index > 0 && !shown && index - 1 !== shownIndex;
          const name = tab.label ?? "Untitled";
          return (
            <div
              key={tab.id}
              data-rest={shown ? undefined : ""}
              className={cn(
                "group relative flex h-[30px] max-w-[220px] min-w-[72px] shrink items-center rounded-t-lg pr-2 pl-3 text-xs whitespace-nowrap",
                shown
                  ? "nb-bg-canvas -mb-0.5 h-[32px] text-neutral-100 shadow-[inset_1px_0_0_rgba(64,64,64,0.6),inset_-1px_0_0_rgba(64,64,64,0.6),inset_0_1px_0_rgba(64,64,64,0.6)]"
                  : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200 @max-[479px]:hidden",
              )}
            >
              {shown && (
                <>
                  <TabEar side="left" />
                  <TabEar side="right" />
                </>
              )}
              {hairline && <span aria-hidden className="absolute top-[7px] bottom-[7px] -left-px w-px bg-neutral-800" />}
              <button
                type="button"
                role="tab"
                aria-selected={shown}
                tabIndex={index === stopIndex ? 0 : -1}
                data-tab-id={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                onKeyDown={(event) => onTabKeyDown(event, onTabChange)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-sm pr-5 text-left focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
                  !tab.label && "text-neutral-500 italic",
                )}
              >
                {name}
              </button>
              <span className="absolute top-1/2 right-1.5 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
                {tab.unsaved && (
                  <span aria-label="Unsaved" className="h-2 w-2 rounded-full bg-red-500 group-focus-within:hidden group-hover:hidden" />
                )}
                {onTabClose && (
                  <button
                    type="button"
                    onClick={() => onTabClose(tab.id)}
                    aria-label={`Close ${name}`}
                    title="Close tab"
                    className={cn(
                      "h-4 w-4 items-center justify-center rounded text-neutral-500 hover:bg-neutral-700 hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
                      tab.unsaved || !shown ? "hidden group-focus-within:flex group-hover:flex" : "flex",
                    )}
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {onNewTab && (
          <button
            type="button"
            onClick={onNewTab}
            aria-label="New tab"
            title="New tab"
            data-new-tab=""
            className="mb-px ml-0.5 flex @max-[479px]:hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            <Plus size={14} strokeWidth={2.25} />
          </button>
        )}
      </div>
      <div className="nb-app__frame">
        {children}
        {frameOverlay}
      </div>
    </div>
  );
}

/** Claude's spark overlapped by Codex's cloud, as the Agent button shows them. */
export function HarnessMarks({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center", className)} aria-hidden>
      <ClaudeMark className="size-4" />
      {/* The cloud overlaps the spark; the shadow in the card's grey keeps them apart. */}
      <span className="-ml-1 flex [filter:drop-shadow(0_0_1.5px_#262626)_drop-shadow(0_0_1px_#262626)]">
        <CodexMark className="size-4" />
      </span>
    </span>
  );
}

/** The top-right "Agent" pill on the canvas (AgentButton). */
export function AgentPill({
  label = "Agent",
  busy = false,
  onClick,
  className,
  title,
  "aria-label": ariaLabel,
}: {
  label?: string;
  busy?: boolean;
  onClick?: () => void;
  className?: string;
  /** Hover text (the app sets none). */
  title?: string;
  /** The button's name; the app's are "Open agent" and, while busy, "Agent — working". */
  "aria-label"?: string;
}) {
  return (
    <div className={cn(CHROME_SURFACE, "flex h-10 items-center rounded-xl px-1", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? (busy ? "Agent — working" : "Open agent")}
        title={title}
        className={cn(CHROME_ICON_BUTTON, "h-8 gap-2 pr-[11px] pl-2.5 text-xs font-medium text-neutral-200")}
      >
        <span className="relative flex shrink-0 items-center">
          <HarnessMarks />
          {busy && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 size-[7px] rounded-full bg-[#D97757] shadow-[0_0_0_4px_rgba(217,119,87,0.2)] ring-2 ring-neutral-800 motion-safe:animate-pulse"
            />
          )}
        </span>
        <span>{busy ? "Working…" : label}</span>
      </button>
    </div>
  );
}

export interface RunSplitButtonProps {
  onRun?: () => void;
  /** The chevron half (run options); hidden while busy. */
  onMenu?: () => void;
  menuOpen?: boolean;
  /** Runs per press: "Run 3×". */
  runCount?: number;
  /** A batch in progress: "Stop 2 / 3" and the 2px progress line. */
  batch?: { index: number; count: number };
  /** A single run in progress: spinner + "Stop". */
  running?: boolean;
  disabled?: boolean;
  className?: string;
}

/** The ink Run split button at the end of the floating action bar. */
export function RunSplitButton({ onRun, onMenu, menuOpen = false, runCount = 1, batch, running = false, disabled = false, className }: RunSplitButtonProps) {
  const busy = Boolean(batch) || running;
  return (
    <div
      className={cn(
        "nb-squircle relative flex h-9 items-stretch overflow-hidden rounded-lg transition-[background-color,box-shadow,transform] duration-[120ms] ease-out",
        // The app's split button draws no focus of its own; the portfolio's keyboard visitors need one.
        "has-[[data-run]:focus-visible]:outline-2 has-[[data-run]:focus-visible]:outline-offset-2 has-[[data-run]:focus-visible]:outline-blue-500",
        disabled && !busy
          ? "bg-white/8 text-neutral-500"
          : "bg-neutral-50 text-neutral-900 hover:bg-white hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.3)] active:scale-[0.97] active:bg-neutral-200",
        className,
      )}
    >
      <button
        type="button"
        onClick={onRun}
        disabled={disabled && !busy}
        aria-label={batch ? `Stop, run ${batch.index} of ${batch.count}` : running ? "Stop" : runCount > 1 ? `Run ${runCount} times` : "Run"}
        data-run=""
        className="flex items-center gap-1.5 pr-3.5 pl-3 text-[13px] font-semibold whitespace-nowrap focus-visible:outline-none disabled:cursor-not-allowed"
      >
        {busy ? <LoaderCircle size={16} strokeWidth={3} className="animate-spin" /> : <Play size={18} strokeWidth={0} fill="currentColor" />}
        <span>{busy ? "Stop" : "Run"}</span>
        {batch && (
          <span className="nb-font-mono text-[11px] font-medium text-neutral-500 tabular-nums">
            {batch.index} / {batch.count}
          </span>
        )}
        {!busy && runCount > 1 && <span className="-ml-0.5 text-neutral-500 tabular-nums">{runCount}×</span>}
      </button>
      {!busy && !disabled && onMenu && (
        <button
          type="button"
          onClick={onMenu}
          aria-expanded={menuOpen}
          aria-label="Run options"
          title="Run options"
          className={cn(
            "flex w-7 items-center justify-center border-l border-black/10 transition-colors duration-[120ms] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none focus-visible:ring-inset",
            menuOpen && "bg-neutral-200",
          )}
        >
          <ChevronDown size={12} strokeWidth={2.5} className={cn("transition-transform duration-[120ms]", menuOpen && "rotate-180")} />
        </button>
      )}
      {batch && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-black/8">
          <span className="block h-full bg-neutral-900 transition-[width] duration-300 ease-out" style={{ width: `${((batch.index - 1) / batch.count) * 100}%` }} />
        </span>
      )}
    </div>
  );
}
