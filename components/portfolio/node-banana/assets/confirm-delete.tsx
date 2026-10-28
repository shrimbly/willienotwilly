"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { formatCount } from "./format";
import { ASSETS_BY_ID, useLibrary } from "./library";
import { DialogButton } from "./ui";

// Asks before the one action Undo cannot reverse: deleting assets for good
// from the Trash (src/components/assets/ConfirmDelete.tsx). Files in project
// folders are named as kept, unless the box is ticked.

export function ConfirmDelete() {
  const { state, actions } = useLibrary();
  const ids = state.confirm;
  if (!ids) return null;
  return <ConfirmDeleteDialog key={ids.join()} ids={ids} onClose={() => actions.confirmDelete(null)} onDelete={() => actions.bulk(ids, { action: "delete" })} />;
}

function ConfirmDeleteDialog({ ids, onClose, onDelete }: { ids: string[]; onClose: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [deleteProjectFiles, setDeleteProjectFiles] = useState(false);
  const count = formatCount(ids.length);
  const projectCount = ids.filter((id) => ASSETS_BY_ID[id]?.project).length;
  const titleId = "nb-assets-confirm-title";

  // Whatever had focus when the dialog was asked for, before the view behind turns inert
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));

  // Cancel takes focus; on close it goes back to the opener, or to the view
  // when that went with the deletion, a frame later, once the view is live again
  useLayoutEffect(() => {
    const view = ref.current?.closest<HTMLElement>("[data-assets-layer]");
    ref.current?.querySelector<HTMLElement>("[data-cancel]")?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => (opener?.isConnected ? opener : view)?.focus({ preventScroll: true }));
    };
  }, [opener]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const stops = Array.from(ref.current?.querySelectorAll<HTMLElement>("button, input") ?? []);
    const index = stops.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey ? (index <= 0 ? stops.length - 1 : index - 1) : (index + 1) % stops.length;
    event.preventDefault();
    stops[next]?.focus();
  };

  return (
    <div
      className="nb-drop-in absolute inset-0 z-[60] flex items-center justify-center bg-[var(--nb-scrim)] px-4 motion-reduce:animate-none"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="nb-bg-card nb-border-chrome nb-rounded-card nb-shadow-dialog flex w-[400px] max-w-full flex-col overflow-clip border"
      >
        <div className="px-5 pt-3.5 pb-2.5">
          <h4 id={titleId} className="truncate text-base leading-6 font-semibold text-neutral-100">
            Delete {count} permanently?
          </h4>
        </div>
        <div className="flex flex-col gap-3 px-5 py-3">
          <p className="text-[13px] leading-5 text-neutral-400">
            Library files go to the Trash. They leave Node Banana for good: this cannot be undone here.
          </p>
          {projectCount > 0 && (
            <label className="nb-border-card flex items-start gap-2.5 rounded-lg border p-3 text-[13px] leading-5 text-neutral-300">
              <input
                type="checkbox"
                checked={deleteProjectFiles}
                onChange={(event) => setDeleteProjectFiles(event.target.checked)}
                className="mt-1 accent-neutral-200"
              />
              <span>
                Also delete the {formatCount(projectCount, "file")} in project folders.
                <span className="nb-text-ink-3 block text-xs">Unticked, they stay in their projects, which still use them.</span>
              </span>
            </label>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <DialogButton variant="ghost" data-cancel="" onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton variant="danger" onClick={onDelete}>
            Delete permanently
          </DialogButton>
        </div>
      </div>
    </div>
  );
}
