"use client";

import { useEffect } from "react";
import { CircleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { CHROME_SURFACE } from "../kit";

import { useLibrary } from "./library";
import { ring } from "./ui";

// The last asset action's result, with Undo (src/components/assets/AssetNotice.tsx);
// errors and undoable results stay a little longer.

export function AssetNotice() {
  const { state, actions } = useLibrary();
  const { notice } = state;
  const canUndo = state.undo.length > 0;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(actions.dismissNotice, notice.undo || notice.tone === "error" ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [notice, actions]);

  if (!notice) return null;
  return (
    <div
      key={notice.id}
      role={notice.tone === "error" ? "alert" : "status"}
      className={cn(
        CHROME_SURFACE,
        "nb-drop-in pointer-events-auto flex min-h-10 max-w-[min(520px,calc(100%-24px))] items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-3 text-xs text-neutral-200 motion-reduce:animate-none",
      )}
    >
      {notice.tone === "error" && <CircleAlert size={14} strokeWidth={1.75} className="shrink-0 text-red-400" />}
      <span className="min-w-0 flex-1">{notice.message}</span>
      {notice.undo && canUndo && (
        <button
          type="button"
          onClick={() => {
            actions.dismissNotice();
            actions.undo();
          }}
          className={cn("h-7 shrink-0 rounded-md px-2 font-medium text-neutral-100 transition-colors hover:bg-white/[0.08]", ring)}
        >
          Undo
        </button>
      )}
      <button
        type="button"
        onClick={actions.dismissNotice}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white/[0.08] hover:text-neutral-100"
      >
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
