"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDemoActive } from "@/components/portfolio/use-demo-active";
import { cn } from "@/lib/utils";

import { CarsWorkflow } from "./canvas/cars-workflow";
import { MannequinWorkflow } from "./canvas/mannequin-workflow";
import type { WorkflowEnv } from "./canvas/use-workflow";
import { WorkflowCanvas } from "./canvas/workflow-canvas";
import { AgentPill, AppWindow, DemoHint, NbRoot, useCanvasView, type AppTab } from "./kit";

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
  const refocus = useRef(false);
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
    refocus.current = true;
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

  // A closed tab takes its close button with it: hand focus to the tab shown next.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, [tabs, shown]);

  const env = (id: string): WorkflowEnv => ({
    active: active && id === shown,
    entered,
    reducedMotion,
    onInteract: touch,
  });

  return (
    <NbRoot
      ref={root}
      role="group"
      aria-label="Node Banana desktop app with two workflows open on the canvas"
      onPointerDownCapture={touch}
    >
      <p className="sr-only">
        Drag nodes or the canvas, hold Control or Command and scroll to zoom, and switch workflows with the tabs. A focused node moves with the arrow keys and
        Enter selects it. The Agent button jumps to the agent panel demo further down the page.
      </p>
      <AppWindow
        tabs={tabs}
        activeTab={shown}
        onTabChange={show}
        onTabClose={closeTab}
        onNewTab={newTab}
        framed={false}
        className={cn(
          // Concentric with the page tile's squircle corners (32px, 40px from sm), 5px inside them.
          "[&_.nb-app\_\_frame]:rounded-b-[27px] [&_.nb-app\_\_frame]:[corner-shape:squircle] sm:[&_.nb-app\_\_frame]:rounded-b-[35px]",
          // Phone tiles still fit both workflow tabs (the shown one truncates first); only "+" goes.
          "@max-[479px]:[&_[data-rest]]:flex",
        )}
        frameOverlay={
          <>
            <AgentPill className="absolute top-3 right-4 z-10" onClick={openAgentDemo} />
            {/* Every layout keeps the canvas's top band clear for it. */}
            <DemoHint corner="top-left" hidden={touched}>
              Drag a node
            </DemoHint>
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

/**
 * The pill opens the agent; on this page that is the agent panel demo further
 * down, so it works like a skip link: scroll there and move focus with it, so
 * Tab carries on from the agent demo rather than jumping back up here.
 */
function openAgentDemo() {
  const target = document.querySelector<HTMLElement>('[data-demo="node-banana-agent"]');
  if (!target) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
}
