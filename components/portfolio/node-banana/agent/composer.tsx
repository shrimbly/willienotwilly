"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import { ArrowUp, ChevronDown, Clock, Loader2, Square, X } from "lucide-react";

import { AGENT_EFFORT_LABELS, AGENT_EFFORTS } from "@/lib/node-banana/agent-script";
import { cn } from "@/lib/utils";

import { MENU_ROW, Menu, MenuSectionLabel, RowCheck } from "./chrome";
import type { Attachment } from "./script";

// AgentComposer.tsx: the message box (window and page variants), pasted and
// dropped pictures as thumbnails above the text, the effort picker, the ink
// send circle (a stop square while a turn runs) and the queued-message flap.

/** A picture's square thumbnail (AgentRunMedia AttachmentThumb): dimmed under a spinner while it saves. */
export function AttachmentThumb({ attachment, className }: { attachment: Attachment; className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden rounded-lg nb-bg-well", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a local blob or a 640px still, at thumbnail size */}
      <img src={attachment.src} alt={attachment.name} draggable={false} decoding="async" className="size-full object-cover" />
      {attachment.pending && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-black/40 text-white/85">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={2} />
        </span>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
    </span>
  );
}

export interface ComposerProps {
  page?: boolean;
  busy: boolean;
  /** The scripted message is typing itself in: the box is read-only. */
  typing: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onAttachFiles: (files: File[]) => void;
  effort: string;
  onEffortChange: (effort: string) => void;
  onSend: () => void;
  onStop: () => void;
  queued: Array<{ id: string; text: string }>;
  onRemoveQueued: (id: string) => void;
  /** Where menus portal to (the window or the page). */
  host: RefObject<HTMLElement | null>;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));
}

export function Composer({
  page = false,
  busy,
  typing,
  draft,
  onDraftChange,
  attachments,
  onRemoveAttachment,
  onAttachFiles,
  effort,
  onEffortChange,
  onSend,
  onStop,
  queued,
  onRemoveQueued,
  host,
  textareaRef,
}: ComposerProps) {
  const [dropping, setDropping] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const effortRef = useRef<HTMLButtonElement | null>(null);
  const empty = !draft.trim() && attachments.length === 0;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Keys typed here are for the chat, never the canvas.
    event.stopPropagation();
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!typing && !empty) onSend();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = imageFiles(event.clipboardData?.files);
    if (!files.length || event.clipboardData.getData("text")) return;
    event.preventDefault();
    onAttachFiles(files);
  };

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropping(true);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDropping(false);
    const files = imageFiles(event.dataTransfer.files);
    if (files.length) onAttachFiles(files);
  };

  const placeholder = busy
    ? "Queue a message…"
    : attachments.length > 0
      ? "Ask about what you attached, or say what to change…"
      : "Describe a workflow, or a change to this one…";

  return (
    <div className={cn("relative shrink-0", page ? "pb-3" : "p-2")}>
      {queued.length > 0 && (
        <section
          aria-label={`Queued messages (${queued.length})`}
          className={cn(
            "nb-squircle relative z-0 border border-b-0 border-white/6 bg-black/15",
            page ? "-mb-6 rounded-t-[20px] pt-1.5 pb-7 text-[13px] leading-5" : "-mb-2.5 rounded-t-[10px] pt-1 pb-3.5 text-[12px] leading-4",
          )}
        >
          <ul>
            {queued.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  "group/queued nb-squircle flex items-center gap-1 rounded-md text-neutral-400 transition-colors duration-[120ms] focus-within:bg-white/5 hover:bg-white/5",
                  page ? "mx-2 h-8 pr-1 pl-2" : "mx-1 h-7 pr-0.5 pl-2",
                )}
              >
                <span className="min-w-0 flex-1 truncate" title={entry.text}>
                  {entry.text}
                </span>
                <span aria-hidden className="flex w-6 shrink-0 justify-center text-neutral-600 group-focus-within/queued:hidden group-hover/queued:hidden">
                  <Clock className="size-3" strokeWidth={1.75} />
                </span>
                <button
                  type="button"
                  aria-label={`Remove queued message: ${entry.text}`}
                  onClick={() => onRemoveQueued(entry.id)}
                  className="nb-squircle hidden size-6 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors duration-[120ms] group-focus-within/queued:flex group-hover/queued:flex hover:bg-white/10 hover:text-neutral-200"
                >
                  <X className="size-3.5" strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div
        onDragOver={onDragOver}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
        }}
        onDrop={onDrop}
        className={cn(
          "nb-squircle relative z-[1] flex flex-col",
          page
            ? "nb-bg-card rounded-[24px] border border-white/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_12px_32px_-12px_rgba(0,0,0,0.5)] transition-[border-color] duration-[120ms] has-[textarea:focus-visible]:border-white/[0.12]"
            : "nb-bg-well nb-shadow-well rounded-[10px] has-[textarea:focus-visible]:ring-1 has-[textarea:focus-visible]:ring-white/15",
          dropping && (page ? "border-white/25" : "ring-1 ring-white/30"),
        )}
      >
        {attachments.length > 0 && (
          <div className={page ? "px-4 pt-3.5" : "px-3 pt-2.5"}>
            <ul aria-label={`Attached to the message (${attachments.length})`} className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  title={attachment.pending ? `${attachment.name} · saving…` : attachment.name}
                  aria-busy={attachment.pending || undefined}
                  className="group/attachment relative"
                >
                  <AttachmentThumb attachment={attachment} className={page ? "size-14" : "size-11"} />
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name}`}
                    onClick={() => onRemoveAttachment(attachment.id)}
                    className={cn(
                      "absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-neutral-700 text-neutral-200 opacity-0 transition-opacity duration-[120ms] group-hover/attachment:opacity-100 hover:bg-neutral-600 hover:text-white focus-visible:opacity-100 pointer-coarse:opacity-100",
                      page ? "shadow-[0_0_0_2px_var(--nb-card)]" : "shadow-[0_0_0_2px_var(--nb-well)]",
                    )}
                  >
                    <X className="size-3" strokeWidth={2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={draft}
          readOnly={typing}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          aria-label="Message the agent"
          rows={1}
          className={cn(
            "block w-full resize-none border-0 bg-transparent text-neutral-100 outline-none [field-sizing:content] placeholder:text-neutral-500 focus-visible:outline-none",
            page ? "max-h-[200px] min-h-[52px] px-4 pt-3.5 pb-1 text-[15px] leading-6" : "max-h-40 min-h-11 px-3 pt-2.5 pb-1 text-[13px] leading-5",
          )}
        />
        <div className={cn("flex items-center gap-2", page ? "pt-1 pr-2.5 pb-2.5 pl-4" : "pr-2 pb-2 pl-3")}>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" />
          <button
            ref={effortRef}
            type="button"
            disabled={busy}
            aria-haspopup="menu"
            aria-expanded={effortOpen}
            aria-label={`Thinking effort: ${AGENT_EFFORT_LABELS[effort]}`}
            onClick={() => setEffortOpen((o) => !o)}
            className={cn(
              "nb-squircle flex shrink-0 items-center gap-1 self-end rounded-lg text-neutral-400 outline-none",
              page ? "h-8 px-2.5 text-[13px] leading-4" : "h-7 px-2 text-[12px] leading-4",
              "transition-colors duration-[120ms] hover:bg-white/[0.06] hover:text-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent",
              effortOpen && "bg-white/[0.08] text-neutral-200",
            )}
          >
            {AGENT_EFFORT_LABELS[effort]}
            <ChevronDown className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
          <Menu open={effortOpen} onClose={() => setEffortOpen(false)} anchor={effortRef} host={host} align="end" side="top" label="Thinking effort" className="w-48">
            <MenuSectionLabel className="px-2.5 pt-1.5 pb-1">Thinking effort</MenuSectionLabel>
            {AGENT_EFFORTS.map((level) => (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                aria-checked={level === effort}
                className={MENU_ROW}
                onClick={() => {
                  onEffortChange(level);
                  setEffortOpen(false);
                }}
              >
                <span className="flex-1">{AGENT_EFFORT_LABELS[level]}</span>
                {level === "high" && <span className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 text-[10px] uppercase">Default</span>}
                <RowCheck checked={level === effort} />
              </button>
            ))}
          </Menu>
          <button
            type="button"
            onClick={busy ? onStop : onSend}
            disabled={!busy && (empty || typing)}
            aria-label={busy ? "Stop" : "Send"}
            className={cn(
              "flex shrink-0 items-center justify-center self-end rounded-full bg-neutral-200 text-neutral-900 transition-[background-color,color,transform] duration-[120ms] hover:bg-white active:scale-[0.96] disabled:bg-white/8 disabled:text-neutral-500 disabled:active:scale-100",
              page ? "size-8" : "size-[30px]",
            )}
          >
            {busy ? (
              <Square className="size-3 fill-current" strokeWidth={0} aria-hidden />
            ) : (
              <ArrowUp className="size-4" strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
