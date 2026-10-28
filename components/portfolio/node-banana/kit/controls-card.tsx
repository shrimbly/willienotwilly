"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// Ported from src/components/nodes/ui/ControlsCard.tsx.

/** Single-line ellipsis that does not clip descenders (Field.tsx ellipsisClass). */
export const ellipsisClass = "whitespace-nowrap text-ellipsis overflow-clip [overflow-clip-margin:4px]";

export interface SummaryRowProps {
  /** 16px provider icon or similar. */
  icon?: ReactNode;
  /** Model name or the node's headline. Truncates with an ellipsis. */
  title: ReactNode;
  /** Right-aligned values, usually <SummaryValues items={["16:9", "2K"]} />. */
  values?: ReactNode;
  className?: string;
}

/** Right-aligned summary values, separated by middle dots ("16:9 · 2K"). */
export function SummaryValues({ items, className }: { items: ReadonlyArray<ReactNode>; className?: string }) {
  const shown = items.filter((v) => v !== undefined && v !== null && v !== "");
  if (shown.length === 0) return null;
  return (
    <span className={cn("nb-text-node flex items-center gap-1 whitespace-nowrap text-neutral-500 tabular-nums", className)}>
      {shown.map((v, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>·</span>}
          <span>{v}</span>
        </Fragment>
      ))}
    </span>
  );
}

export interface ControlsCardProps {
  summary: SummaryRowProps;
  /** Settings panel content. Without it the card is just the summary row. */
  children?: ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
  panelClassName?: string;
  /** An explicit card width in px (the app's dragged width); default follows the node. */
  width?: number;
  style?: CSSProperties;
  /** Id for the settings panel (wires the chevron's aria-controls). */
  panelId?: string;
}

/**
 * The detached controls card beneath the media: a 28px summary row, and a
 * settings panel that opens under it (grid rows 0fr → 1fr, 150ms).
 */
export function ControlsCard({ summary, children, expanded = false, onToggle, className, panelClassName, width, style, panelId }: ControlsCardProps) {
  const toggleable = Boolean(children && onToggle);

  return (
    <div
      className={cn("nb-controls-card", className)}
      style={{ ...(width !== undefined ? { width, maxWidth: "none" } : null), ...style }}
      data-controls-card
    >
      <div
        className={cn(
          "grid h-[28px] min-w-0 items-center gap-1.5 px-2",
          summary.icon ? "grid-cols-[16px_minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto_auto]",
          toggleable && "cursor-pointer",
          summary.className,
        )}
        onClick={toggleable ? onToggle : undefined}
      >
        {summary.icon && <span className="flex h-4 w-4 items-center justify-center text-neutral-500">{summary.icon}</span>}
        <span className={cn("nb-text-node min-w-0 text-neutral-200", ellipsisClass)}>{summary.title}</span>
        <span className="flex min-w-0 items-center">{summary.values}</span>
        {toggleable ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className="nodrag flex h-4 w-4 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-300"
            aria-label={expanded ? "Collapse settings" : "Expand settings"}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            <ChevronDown
              size={12}
              strokeWidth={2}
              className="transition-transform duration-200"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        ) : (
          <span className="w-0" />
        )}
      </div>

      {children && (
        <div
          className="grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
          aria-hidden={!expanded}
          inert={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <div id={panelId} className={cn("nodrag nb-bg-panel flex flex-col gap-1 px-2 pt-1.5 pb-2", panelClassName)}>
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
