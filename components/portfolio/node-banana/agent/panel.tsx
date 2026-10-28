"use client";

import { useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ChevronDown, History, Maximize2, SquarePen, X } from "lucide-react";

import {
  AGENT_BILLING,
  AGENT_HARNESSES,
  AGENT_SUGGESTIONS_EMPTY,
  AGENT_SUGGESTIONS_WITH_NODES,
  AGENT_WORKFLOW_NAME,
  type AgentHarness,
} from "@/lib/node-banana/agent-script";
import { cn } from "@/lib/utils";

import { CHROME_SURFACE } from "../kit";
import { HarnessIcon, MENU_ROW, Menu, MenuSectionLabel, PanelIconButton, RowCheck } from "./chrome";
import { Composer, type ComposerProps } from "./composer";
import { Conversation, EmptyState, HistoryList, type ChatActions } from "./conversation";
import type { DemoState } from "./script";

// AgentPanel.tsx + AgentPanelHeader.tsx: the floating agent window over the
// canvas, and the harness/model menu its header shares with the chat view.

export interface PanelActions extends ChatActions {
  setHarness: (harness: AgentHarness) => void;
  setModel: (model: string) => void;
  newChat: () => void;
  openChat: (id: string) => void;
  deleteChat: (id: string) => void;
}

/** Which harness answers, on which model: the trigger and its menu. */
export function ModelMenu({
  state,
  actions,
  host,
  align = "start",
  page = false,
}: {
  state: DemoState;
  actions: PanelActions;
  host: RefObject<HTMLElement | null>;
  align?: "start" | "end";
  page?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const harness = AGENT_HARNESSES[state.harness];
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${harness.label}, ${state.model}. Change agent or model`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "nb-squircle flex min-w-0 items-center gap-1.5 rounded-lg text-[13px] leading-4 outline-none transition-colors duration-[120ms] hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-blue-500",
          page ? "h-8 px-2" : "h-7 px-1.5",
          open && "bg-white/[0.08]",
        )}
      >
        <HarnessIcon harness={state.harness} />
        <span className="shrink-0 font-semibold text-neutral-100">{harness.label}</span>
        <span className="truncate text-neutral-400">{state.model}</span>
        <ChevronDown className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} aria-hidden />
      </button>
      <Menu open={open} onClose={() => setOpen(false)} anchor={trigger} host={host} align={align} label="Agent and model" className="w-64">
        <MenuSectionLabel className="px-2.5 pt-1.5 pb-1">Run with</MenuSectionLabel>
        {(Object.keys(AGENT_HARNESSES) as AgentHarness[]).map((id) => {
          const locked = state.busy && id !== state.harness;
          return (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={id === state.harness}
              aria-label={AGENT_HARNESSES[id].label}
              disabled={locked}
              className={MENU_ROW}
              onClick={() => {
                actions.setHarness(id);
                setOpen(false);
              }}
            >
              <HarnessIcon harness={id} className="size-3.5" />
              <span className="flex-1 truncate">{AGENT_HARNESSES[id].label}</span>
              <span className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 text-[10px] uppercase">{locked ? "Stop the reply first" : AGENT_HARNESSES[id].plan}</span>
              <RowCheck checked={id === state.harness} />
            </button>
          );
        })}
        <div className="my-1 border-t border-white/[0.08]" role="separator" />
        <MenuSectionLabel className="px-2.5 pt-1 pb-1">Model</MenuSectionLabel>
        {harness.models.map((model) => (
          <button
            key={model}
            type="button"
            role="menuitemradio"
            aria-checked={model === state.model}
            disabled={state.busy}
            className={MENU_ROW}
            onClick={() => {
              actions.setModel(model);
              setOpen(false);
            }}
          >
            <span className="flex-1 truncate">{model}</span>
            <RowCheck checked={model === state.model} />
          </button>
        ))}
      </Menu>
    </>
  );
}

export function historyChats(state: DemoState) {
  const current = state.messages.length ? [{ id: state.chatId, title: state.chatTitle, messages: state.messages }] : [];
  return [...current, ...state.history];
}

export function historyMeta(state: DemoState) {
  return `Just now · ${AGENT_WORKFLOW_NAME} · ${AGENT_HARNESSES[state.harness].label}`;
}

export function AgentWindow({
  state,
  actions,
  composer,
  open,
  entering = false,
  openAtTurn = false,
  onClose,
  onExpand,
  className,
}: {
  state: DemoState;
  actions: PanelActions;
  composer: Omit<ComposerProps, "host" | "page">;
  open: boolean;
  /** Opened by the visitor: it fades up, as the app's does. */
  entering?: boolean;
  /** The turn is shown finished, not played: the transcript opens on its message (Conversation). */
  openAtTurn?: boolean;
  onClose: () => void;
  onExpand: () => void;
  className?: string;
}) {
  const host = useRef<HTMLElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasMessages = state.messages.length > 0;
  const suggestions = state.built > 0 ? AGENT_SUGGESTIONS_WITH_NODES : AGENT_SUGGESTIONS_EMPTY;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Keys typed here are for the chat, never the canvas or the page.
    event.stopPropagation();
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  };

  let body;
  if (historyOpen) {
    body = (
      <HistoryList
        chats={historyChats(state)}
        currentId={state.chatId}
        locked={state.busy}
        meta={historyMeta(state)}
        onOpen={(id) => {
          actions.openChat(id);
          setHistoryOpen(false);
        }}
        onDelete={actions.deleteChat}
      />
    );
  } else if (hasMessages) {
    body = <Conversation state={state} page={false} host={host} actions={actions} openAtTurn={openAtTurn} />;
  } else {
    body = (
      <div className="nb-agent-scroll flex min-h-0 flex-1 flex-col">
        <EmptyState suggestions={suggestions} onSuggestion={actions.suggest} />
      </div>
    );
  }

  return (
    <section
      ref={host}
      role="dialog"
      aria-modal="false"
      aria-label="Agent"
      aria-busy={state.busy}
      hidden={!open}
      data-entering={entering ? "" : undefined}
      onKeyDown={onKeyDown}
      className={cn(
        CHROME_SURFACE,
        "nb-agent-window flex-col overflow-hidden rounded-xl text-[13px] leading-5 text-neutral-200 outline-none",
        open ? "flex" : "hidden",
        className,
      )}
    >
      <div className="nb-fade-rule flex h-10 shrink-0 items-center gap-2 border-b px-1.5">
        <ModelMenu state={state} actions={actions} host={host} />
        <div className="ml-auto flex items-center gap-0.5">
          <PanelIconButton label="Open the full chat" shortcut="C" onClick={onExpand}>
            <Maximize2 strokeWidth={1.75} aria-hidden />
          </PanelIconButton>
          <PanelIconButton label={historyOpen ? "Back to chat" : "History"} open={historyOpen} onClick={() => setHistoryOpen((o) => !o)}>
            <History strokeWidth={1.75} aria-hidden />
          </PanelIconButton>
          <PanelIconButton
            label="New chat"
            disabled={!hasMessages || state.busy}
            onClick={() => {
              actions.newChat();
              setHistoryOpen(false);
            }}
          >
            <SquarePen strokeWidth={1.75} aria-hidden />
          </PanelIconButton>
          <PanelIconButton label="Close" tooltipAlign="end" onClick={onClose}>
            <X strokeWidth={1.75} aria-hidden />
          </PanelIconButton>
        </div>
      </div>
      {body}
      {!historyOpen && !hasMessages && (
        <p className="nb-agent-billing nb-text-ink-3 m-0 shrink-0 px-4 pt-1 pb-2.5 text-[11px] leading-4">{AGENT_BILLING[state.harness]}</p>
      )}
      {!historyOpen && <Composer {...composer} host={host} />}
    </section>
  );
}
