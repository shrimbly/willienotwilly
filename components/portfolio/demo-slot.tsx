"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";

import type { DemoId } from "@/lib/portfolio";

// Each demo is its own chunk, so a project page only loads the demos it shows.
const demos: Record<DemoId, ComponentType> = {
  "node-banana-canvas": dynamic(() =>
    import("./node-banana/canvas-demo").then((m) => m.NodeBananaCanvasDemo),
  ),
  "node-banana-agent": dynamic(() =>
    import("./node-banana/agent-demo").then((m) => m.NodeBananaAgentDemo),
  ),
  "node-banana-node-anatomy": dynamic(() =>
    import("./node-banana/node-anatomy-demo").then((m) => m.NodeBananaNodeAnatomyDemo),
  ),
  "node-banana-edit-video": dynamic(() =>
    import("./node-banana/edit-video-demo").then((m) => m.NodeBananaEditVideoDemo),
  ),
  "node-banana-assets": dynamic(() =>
    import("./node-banana/assets-demo").then((m) => m.NodeBananaAssetsDemo),
  ),
  "node-banana-comfy-node": dynamic(() =>
    import("./node-banana/comfy-node-demo").then((m) => m.NodeBananaComfyNodeDemo),
  ),
  "easy-peasy-ease-editor": dynamic(() =>
    import("./easy-peasy-ease/editor-demo").then((m) => m.EasyPeasyEaseEditorDemo),
  ),
  "easy-peasy-ease-split": dynamic(() =>
    import("./easy-peasy-ease/split-demo").then((m) => m.EasyPeasyEaseSplitDemo),
  ),
  "easy-peasy-ease-beat-sync": dynamic(() =>
    import("./easy-peasy-ease/beat-sync-demo").then((m) => m.EasyPeasyEaseBeatSyncDemo),
  ),
  "easy-peasy-ease-curves": dynamic(() =>
    import("./easy-peasy-ease/curves-demo").then((m) => m.EasyPeasyEaseCurvesDemo),
  ),
  "easy-peasy-ease-wordmark": dynamic(() =>
    import("./easy-peasy-ease/wordmark-demo").then((m) => m.EasyPeasyEaseWordmarkDemo),
  ),
};

/**
 * Renders a demo once its frame comes within a screen or so of the viewport,
 * so a page doesn't download and boot every demo up front. `eager` mounts
 * straight away (and on the server), for a hero.
 */
export function DemoSlot({ id, eager = false }: { id: DemoId; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);

  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: "1000px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  if (!near) return <div ref={ref} className="absolute inset-0" aria-hidden="true" />;
  const Demo = demos[id];
  return <Demo />;
}
