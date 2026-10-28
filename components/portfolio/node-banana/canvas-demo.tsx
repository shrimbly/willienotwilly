"use client";

import { useCallback, useRef, useState } from "react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import { cn } from "@/lib/utils";

import { CarsWorkflow } from "./canvas/cars-workflow";
import { MannequinWorkflow } from "./canvas/mannequin-workflow";
import type { WorkflowEnv } from "./canvas/use-workflow";
import { WorkflowCanvas } from "./canvas/workflow-canvas";
import { AgentPill, AppWindow, NbRoot, useCanvasView, type AppTab } from "./kit";

// The hero: the Node Banana desktop window as the landing site draws it
// (site/src/partials/app-window.html), live. Two workflow tabs at their saved
// world coordinates, "+" for an empty one, the Agent pill, the dotted canvas.

const START_TABS: AppTab[] = [
  { id: "mannequin", label: "Invisible Mannequin" },
  { id: "cars", label: "Cars" },
];

export function NodeBananaCanvasDemo() {
  const root = useRef<HTMLDivElement | null>(null);
  const { active, inView, reducedMotion } = useDemoActive(root);
  const [tabs, setTabs] = useState<AppTab[]>(START_TABS);
  const [shown, setShown] = useState("mannequin");
  // Tabs mount when first opened and stay mounted (display:none) so drags survive a switch.
  const [opened, setOpened] = useState<string[]>(["mannequin"]);
  const untitled = useRef(0);
  const [entered, setEntered] = useState(false);
  const [touched, setTouched] = useState(false);
  if (inView && !entered) setEntered(true);

  const show = (id: string) => {
    setShown(id);
    setOpened((o) => (o.includes(id) ? o : [...o, id]));
  };
  const newTab = () => {
    untitled.current += 1;
    const id = `untitled-${untitled.current}`;
    setTabs((t) => [...t, { id }]);
    show(id);
  };
  const closeTab = (id: string) => {
    const index = tabs.findIndex((t) => t.id === id);
    const rest = tabs.filter((t) => t.id !== id);
    setOpened((o) => o.filter((x) => x !== id));
    if (rest.length === 0) {
      untitled.current += 1;
      const fresh = `untitled-${untitled.current}`;
      setTabs([{ id: fresh }]);
      show(fresh);
      return;
    }
    setTabs(rest);
    if (id === shown) show(rest[Math.min(index, rest.length - 1)].id);
  };
  const touch = useCallback(() => setTouched(true), []);

  const env = (id: string): WorkflowEnv => ({
    active: active && id === shown,
    entered,
    reducedMotion,
    touched,
    onInteract: touch,
  });

  return (
    <NbRoot
      ref={root}
      role="group"
      aria-label="Node Banana desktop app with two workflows open on the canvas"
      onPointerDownCapture={touch}
    >
      <p className="sr-only">Drag nodes or the canvas, hold Control or Command and scroll to zoom, and switch workflows with the tabs.</p>
      <AppWindow
        tabs={tabs}
        activeTab={shown}
        onTabChange={show}
        onTabClose={closeTab}
        onNewTab={newTab}
        framed={false}
        className="[&_.nb-app\_\_frame]:rounded-b-[24px]"
        frameOverlay={
          <>
            <AgentPill className="absolute top-3 right-4 z-10" onClick={openAgentDemo} />
            <span
              aria-hidden
              className={cn(
                "nb-font-mono nb-tracking-eyebrow nb-text-ink-3 pointer-events-none absolute top-4 left-5 z-10 text-[10px] uppercase transition-opacity duration-500 @max-md:hidden",
                touched && "opacity-0",
              )}
            >
              Drag a node
            </span>
          </>
        }
      >
        {tabs.map((tab) =>
          opened.includes(tab.id) ? (
            <div key={tab.id} className={tab.id === shown ? "absolute inset-0" : "hidden"}>
              {tab.id === "mannequin" ? (
                <MannequinWorkflow env={env(tab.id)} />
              ) : tab.id === "cars" ? (
                <CarsWorkflow env={env(tab.id)} />
              ) : (
                <EmptyWorkflow env={env(tab.id)} />
              )}
            </div>
          ) : null,
        )}
      </AppWindow>
    </NbRoot>
  );
}

/** A new tab: the empty dotted canvas. */
function EmptyWorkflow({ env }: { env: WorkflowEnv }) {
  const view = useCanvasView();
  return <WorkflowCanvas view={view} env={env} />;
}

/** The pill opens the agent; on this page that is the agent panel demo further down. */
function openAgentDemo() {
  const target = document.querySelector('[data-demo="node-banana-agent"]');
  if (!target) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
}
