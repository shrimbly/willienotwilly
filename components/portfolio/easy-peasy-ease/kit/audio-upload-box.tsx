"use client";

import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Port of easy-peasy-ease/components/AudioUploadBox.tsx: the 72px dashed
 * "Add Audio Track" row under the timeline. There is no file input in the
 * portfolio; `onActivate` decides what a click does (e.g. load the demo beat).
 */
export function AudioUploadBox({
  onActivate,
  disabled = false,
  label = "Add Audio Track",
  className,
}: {
  onActivate?: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={onActivate}
        className={cn(
          "w-full rounded-[8px] border-2 border-dashed border-muted-foreground/30 px-3 py-1 text-center transition-colors",
          "flex h-[72px] cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
          !disabled && "hover:border-muted-foreground/50",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="flex items-center justify-center gap-2">
          <Plus className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </span>
      </button>
    </div>
  );
}
