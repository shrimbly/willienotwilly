"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, ChevronDown, Search, SquarePen, Trash2, Waypoints, Workflow } from "lucide-react";

import {
  AGENT_BILLING,
  AGENT_HARNESSES,
  AGENT_SUGGESTIONS_EMPTY,
  AGENT_SUGGESTIONS_WITH_NODES,
  AGENT_WORKFLOW_NAME,
} from "@/lib/node-banana/agent-script";
import { cn } from "@/lib/utils";

import { AGENT_ICON, HarnessIcon, MENU_ROW, Menu, MenuSectionLabel, RowCheck, Tooltip } from "./chrome";
import { Composer, type ComposerProps } from "./composer";
import { Conversation, PAGE_COLUMN, chatLabel } from "./conversation";
import { ModelMenu, historyChats, type PanelActions } from "./panel";
import type { DemoState } from "./script";

// AgentChatView.tsx: the same session as a page in place of the canvas: the
// Chats sidebar, the header (workflow, harness and model, back to Canvas), the
// reading column and the page composer.

export function ChatView({
  state,
  actions,
  composer,
  onCanvas,
  openAtTurn = false,
}: {
  state: DemoState;
  actions: PanelActions;
  composer: Omit<ComposerProps, "host" | "page">;
  onCanvas: () => void;
  /** The turn is shown finished, not played: the transcript opens on its message (Conversation). */
  openAtTurn?: boolean;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcher = useRef<HTMLButtonElement | null>(null);
  const hasMessages = state.messages.length > 0;
  const harness = AGENT_HARNESSES[state.harness];
  const chats = historyChats(state).filter((chat) => chatLabel(chat).toLowerCase().includes(query.trim().toLowerCase()));
  const suggestions = state.built > 0 ? AGENT_SUGGESTIONS_WITH_NODES : AGENT_SUGGESTIONS_EMPTY;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    if ((event.key === "c" || event.key === "C") && !event.metaKey && !event.ctrlKey && !event.altKey && !target.closest("input,textarea,[role=menu]")) {
      event.preventDefault();
      onCanvas();
    }
  };

  return (
    <div
      ref={host}
      role="region"
      aria-label="Chat"
      aria-busy={state.busy}
      onKeyDown={onKeyDown}
      className="nb-agent-chat nb-bg-canvas nb-agent-fade-in absolute inset-0 z-30 flex text-[13px] leading-5 text-neutral-200"
    >
      <nav aria-label="Chats" className="nb-bg-pane hidden min-h-0 w-[264px] shrink-0 flex-col border-r border-white/[0.06] @[820px]:flex">
        <div className="flex h-[52px] shrink-0 items-center gap-2 pr-2.5 pl-5">
          <HarnessIcon harness={state.harness} />
          <h2 className="nb-font-display m-0 text-[15px] leading-5 font-semibold tracking-[-0.01em] text-neutral-100">Chats</h2>
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-2.5 pb-2">
          <button
            type="button"
            onClick={actions.newChat}
            disabled={!hasMessages || state.busy}
            title={hasMessages ? undefined : "This chat is already empty"}
            className="nb-squircle flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium text-neutral-200 transition-colors duration-[120ms] hover:bg-white/[0.05] hover:text-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
          >
            <SquarePen className="size-4 shrink-0" {...AGENT_ICON} />
            New chat
          </button>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute top-2 left-[11px] h-4 w-4 text-neutral-500" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              aria-label="Search chats"
              placeholder="Search chats"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="nb-bg-canvas h-8 w-full rounded-lg border border-[#404040] pr-3 pl-[34px] text-[13px] text-neutral-200 outline-none placeholder:text-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-500"
            />
          </div>
        </div>
        <div className="nb-agent-scroll flex min-h-0 flex-1 flex-col px-2.5 pb-3">
          {chats.length === 0 ? (
            <div className="px-2.5 py-8 text-center">
              <p className="m-0 text-[13px] leading-5 text-neutral-300">{query ? "No matches" : "No chats yet"}</p>
              <p className="nb-text-ink-3 m-0 mt-1 text-xs leading-4">
                {query ? `No chat or workflow matches “${query.trim()}”.` : "Your conversations with the agent show up here."}
              </p>
            </div>
          ) : (
            <div role="group" aria-label="Today" className="pt-2">
              <p aria-hidden className="nb-font-mono nb-tracking-eyebrow nb-text-ink-3 m-0 px-2.5 pb-1 text-[10px] leading-[14px] uppercase">
                Today
              </p>
              <ul className="m-0 flex list-none flex-col gap-px p-0">
                {chats.map((chat) => {
                  const current = chat.id === state.chatId;
                  const label = chatLabel(chat);
                  return (
                    <li key={chat.id} className="group/row relative">
                      <button
                        type="button"
                        aria-current={current || undefined}
                        aria-disabled={(state.busy && !current) || undefined}
                        onClick={() => !(state.busy && !current) && actions.openChat(chat.id)}
                        className={cn(
                          "nb-squircle flex w-full flex-col rounded-lg py-1.5 pr-9 pl-2.5 text-left transition-colors duration-[120ms]",
                          current ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                          "aria-disabled:cursor-not-allowed aria-disabled:opacity-40",
                        )}
                      >
                        <span className={cn("truncate text-[13px] leading-5", current ? "text-neutral-100" : "text-neutral-300")}>{label}</span>
                        <span className="nb-text-ink-3 truncate text-[11px] leading-4">{AGENT_WORKFLOW_NAME} · Just now</span>
                      </button>
                      {!current && (
                        <button
                          type="button"
                          aria-label={`Delete “${label}”`}
                          onClick={() => actions.deleteChat(chat.id)}
                          className="nb-squircle absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 opacity-0 transition-[opacity,background-color,color] duration-[120ms] group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-white/10 hover:text-neutral-200 focus-visible:opacity-100 pointer-coarse:opacity-100"
                        >
                          <Trash2 className="size-3.5" {...AGENT_ICON} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2.5 border-t border-white/[0.06] py-3 pr-4 pl-5">
          <HarnessIcon harness={state.harness} className="size-5" />
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[13px] leading-5 font-medium text-neutral-200">{harness.label}</p>
            <p className="nb-text-ink-3 m-0 truncate text-[11px] leading-4">
              {harness.plan} · {state.model}
            </p>
          </div>
        </div>
      </nav>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="relative z-[2] flex h-[52px] shrink-0 items-center gap-2 border-b border-transparent pr-3 pl-3">
          <button
            ref={switcher}
            type="button"
            aria-haspopup="menu"
            aria-expanded={switcherOpen}
            aria-label={`${AGENT_WORKFLOW_NAME}. Switch workflow`}
            onClick={() => setSwitcherOpen((o) => !o)}
            className={cn(
              "nb-squircle flex h-8 max-w-[320px] min-w-0 items-center gap-2 rounded-lg pr-2 pl-2.5 text-[13px] leading-4 outline-none transition-colors duration-[120ms] hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-blue-500",
              switcherOpen && "bg-white/[0.08]",
            )}
          >
            <Workflow className="size-4 shrink-0 text-neutral-400" {...AGENT_ICON} />
            <span className="truncate font-medium text-neutral-100">{AGENT_WORKFLOW_NAME}</span>
            <ChevronDown className="size-4 shrink-0 text-neutral-400" {...AGENT_ICON} />
          </button>
          <Menu open={switcherOpen} onClose={() => setSwitcherOpen(false)} anchor={switcher} host={host} label="Open workflows" className="w-72">
            <MenuSectionLabel className="px-2.5 pt-1.5 pb-1">Open workflows</MenuSectionLabel>
            <button type="button" role="menuitemradio" aria-checked className={cn(MENU_ROW, "py-1.5")} onClick={() => setSwitcherOpen(false)}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] leading-5 text-neutral-100">{AGENT_WORKFLOW_NAME}</span>
                <span className="nb-text-ink-3 truncate text-[11px] leading-4">{state.built} nodes · this tab</span>
              </span>
              <RowCheck checked />
            </button>
          </Menu>
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <ModelMenu state={state} actions={actions} host={host} align="end" page />
            <span aria-hidden className="mx-1 hidden h-[18px] w-px shrink-0 bg-white/[0.08] @md:block" />
            <div className="group/tip relative flex shrink-0">
              <button
                type="button"
                aria-label="Open canvas"
                onClick={onCanvas}
                className="nb-squircle nb-font-display flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] pr-3 pl-2.5 text-[13px] font-medium tracking-[-0.01em] text-neutral-300 transition-[border-color,color,transform] duration-[120ms] ease-out hover:border-white/[0.18] hover:text-neutral-100 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                <Waypoints className="size-4 shrink-0" {...AGENT_ICON} />
                <span className="hidden @md:inline">Canvas</span>
              </button>
              <Tooltip label="Show this workflow's canvas" shortcut="C" align="end" />
            </div>
          </div>
        </header>

        <div className={cn("flex min-h-0 flex-1 flex-col", !hasMessages && "nb-agent-scroll")}>
          {hasMessages ? (
            <Conversation state={state} page host={host} actions={actions} openAtTurn={openAtTurn} />
          ) : (
            <div className="flex flex-1 flex-col justify-end">
              <div className={cn(PAGE_COLUMN, "pt-10 pb-8")}>
                <div className="flex flex-col items-center text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                    <HarnessIcon harness={state.harness} className="size-[22px]" />
                  </span>
                  <h2 className="nb-font-display nb-tracking-display m-0 mt-5 text-[30px] leading-9 font-bold text-balance text-neutral-100">What should we make?</h2>
                  <p className="nb-font-display nb-text-ink-3 m-0 mt-2 max-w-full truncate text-[15px] leading-6 font-medium">
                    {state.built > 0 ? (
                      <>
                        Working in <span className="text-neutral-300">{AGENT_WORKFLOW_NAME}</span> · {state.built} nodes
                      </>
                    ) : (
                      "Describe a workflow and the agent builds it"
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className={cn(PAGE_COLUMN, "relative z-[1] shrink-0")}>
            <Composer {...composer} host={host} page />
          </div>
          {!hasMessages && (
            <div className={cn(PAGE_COLUMN, "flex-1 pt-6 pb-6")}>
              <div className="@container">
                <div className="grid grid-cols-1 gap-2.5 @md:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => actions.suggest(suggestion)}
                      className="group nb-squircle flex min-h-16 items-start gap-3 rounded-[14px] border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left text-[13px] leading-5 text-neutral-300 transition-[background-color,border-color,color] duration-[120ms] hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-neutral-100"
                    >
                      <span className="min-w-0 flex-1">{suggestion}</span>
                      <ArrowRight aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-neutral-600 transition-colors duration-[120ms] group-hover:text-neutral-300" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!hasMessages && <p className={cn(PAGE_COLUMN, "nb-text-ink-3 m-0 shrink-0 pt-2.5 pb-3 text-center text-[11px] leading-4")}>{AGENT_BILLING[state.harness]}</p>}
        </div>
      </main>
    </div>
  );
}
