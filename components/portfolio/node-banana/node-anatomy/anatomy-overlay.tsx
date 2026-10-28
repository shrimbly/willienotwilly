"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import type { CanvasView, NodeGraph } from "../kit";
import { COMPACT_MAX_H, LABEL_MARGIN, LABEL_MAX, LEAD, isNarrow } from "./framing";
import { PARTS, type PartId } from "./parts";
import "./node-anatomy.css";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

interface PartGeometry {
  /** Corner brackets (or rings, for sockets) drawn round the part when it is highlighted. */
  mark: string;
  /** Where a callout's leader starts (wide tiles). */
  anchor: Point;
  /** Where the numbered marker sits (narrow tiles). */
  marker: Point;
}

/** Space between callouts in the column (tighter on short tiles). */
const LABEL_GAP = 14;
const LABEL_GAP_COMPACT = 10;
/** Keep laying out for a while after the last change: CSS transitions and the trailing controls card settle on their own. */
const SETTLE_MS = 450;
/** Space the hint keeps from the node. */
const HINT_AIR = 4;

export interface AnatomyOverlayProps {
  rootRef: RefObject<HTMLDivElement | null>;
  view: CanvasView;
  graph: NodeGraph;
  nodeId: string;
  /** The part highlighted now. */
  active: PartId | null;
  /** The part the visitor pinned by pressing its callout. */
  pinned: PartId | null;
  /** A callout or marker is pointed at or focused (null when it is left). */
  onHover: (part: PartId | null) => void;
  /** A callout or marker is pressed: pin (or unpin) its part. */
  onPick: (part: PartId) => void;
}

/**
 * Callouts in screen space over the canvas: on wide tiles a column of mono
 * eyebrows beside the node with thin leaders to each part; on narrow tiles
 * numbered markers on the node and a legend under it. Positions follow the
 * node's DOM every frame anything moves, written straight to the elements.
 */
export function AnatomyOverlay({ rootRef, view, graph, nodeId, active, pinned, onHover, onPick }: AnatomyOverlayProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const els = useRef(new Map<string, HTMLElement | SVGElement>());
  const bind = (key: string) => (el: HTMLElement | SVGElement | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };

  useEffect(() => {
    const root = rootRef.current;
    const layer = layerRef.current;
    if (!root || !layer) return;
    const get = (key: string) => els.current.get(key);
    const widths = new Map<string, number>();
    let frame = 0;
    let until = 0;
    let disposed = false;
    let listInset = -1;
    let hintCrowded = false;

    const layout = (): boolean => {
      const node = root.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
      const W = root.clientWidth;
      const H = root.clientHeight;
      if (!node || W <= 0 || view.width <= 0) return false;
      const geometry = measure(root, node, view.zoom.get());
      if (!geometry) return false;
      const { parts, cardRight, extent } = geometry;
      const narrow = isNarrow(W, H);
      // The node's dropdowns open upward rather than under the phone legend (SelectWell reads this inset).
      const inset = narrow ? (layer.querySelector<HTMLElement>("[data-anat-legend]")?.offsetHeight ?? 0) : 0;
      if (inset !== listInset) {
        listInset = inset;
        root.style.setProperty("--nb-list-inset-bottom", String(inset));
      }
      // The framing keeps the hint's corner clear, except where the node is too tall for the tile and
      // its top runs into it: the hint then steps aside (node-anatomy.css).
      const hint = root.querySelector("[data-demo-hint]")?.getBoundingClientRect();
      const R = root.getBoundingClientRect();
      const crowded =
        hint !== undefined &&
        hint.right - R.left + HINT_AIR > extent.left &&
        hint.bottom - R.top + HINT_AIR > extent.top &&
        hint.top - R.top - HINT_AIR < extent.bottom;
      if (crowded !== hintCrowded) {
        hintCrowded = crowded;
        root.toggleAttribute("data-anat-crowded", crowded);
      }

      for (const p of PARTS) {
        const g = parts[p.id];
        get(`mark-${p.id}`)?.setAttribute("d", g.mark);
        if (narrow) {
          const m = get(`marker-${p.id}`);
          const x = Math.min(W - 12, Math.max(12, g.marker.x));
          if (m) m.style.transform = `translate(${x.toFixed(1)}px, ${g.marker.y.toFixed(1)}px)`;
        }
      }
      if (narrow) return true;

      // Wide: one column right of the node, labels kept apart, leaders bent to reach them.
      const colX = cardRight + LEAD;
      const colW = Math.max(120, Math.min(LABEL_MAX, W - colX - LABEL_MARGIN));
      const gap = H < COMPACT_MAX_H ? LABEL_GAP_COMPACT : LABEL_GAP;
      const items = PARTS.map((p) => {
        const label = get(`label-${p.id}`) as HTMLElement | undefined;
        if (label && widths.get(p.id) !== colW) {
          label.style.width = `${colW}px`;
          widths.set(p.id, colW);
        }
        // The leader meets the eyebrow's centre line.
        const mid = ((label?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 16) / 2;
        return { id: p.id, anchor: parts[p.id].anchor, h: label?.offsetHeight ?? 0, mid, top: 0 };
      }).sort((a, b) => a.anchor.y - b.anchor.y);

      items.forEach((it, i) => {
        it.top = it.anchor.y - it.mid;
        if (i > 0) it.top = Math.max(it.top, items[i - 1].top + items[i - 1].h + gap);
      });
      let limit = H - 14;
      for (let i = items.length - 1; i >= 0; i--) {
        items[i].top = Math.min(items[i].top, limit - items[i].h);
        limit = items[i].top - gap;
      }
      let floor = 14;
      for (const it of items) {
        it.top = Math.max(it.top, floor);
        floor = it.top + it.h + gap;
      }

      const knee = colX - 18;
      for (const it of items) {
        const ly = it.top + it.mid;
        const label = get(`label-${it.id}`);
        if (label) label.style.transform = `translate(${colX.toFixed(1)}px, ${it.top.toFixed(1)}px)`;
        const { x, y } = it.anchor;
        get(`leader-${it.id}`)?.setAttribute("d", `M${x.toFixed(1)},${y.toFixed(1)}H${Math.max(x, knee).toFixed(1)}L${(colX - 6).toFixed(1)},${ly.toFixed(1)}`);
        const dot = get(`dot-${it.id}`);
        dot?.setAttribute("cx", x.toFixed(1));
        dot?.setAttribute("cy", y.toFixed(1));
      }
      return true;
    };

    const tick = (now: number) => {
      frame = 0;
      if (layout()) layer.dataset.ready = "";
      if (now < until) frame = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (disposed) return;
      until = performance.now() + SETTLE_MS;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    schedule();
    const offs = [view.x.on("change", schedule), view.y.on("change", schedule), view.zoom.on("change", schedule), graph.watch([nodeId], schedule)];
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    const node = root.querySelector(`[data-node-id="${nodeId}"]`);
    if (node) ro.observe(node);
    els.current.forEach((el, key) => key.startsWith("label-") && ro.observe(el));
    void document.fonts?.ready.then(schedule);
    // The trailing card and menus move without telling anyone; any pointer
    // activity over the tile keeps the layout fresh for a moment.
    root.addEventListener("pointermove", schedule, { passive: true });
    root.addEventListener("pointerup", schedule);
    root.addEventListener("transitionrun", schedule);
    return () => {
      disposed = true;
      offs.forEach((off) => off());
      ro.disconnect();
      root.removeEventListener("pointermove", schedule);
      root.removeEventListener("pointerup", schedule);
      root.removeEventListener("transitionrun", schedule);
      root.style.removeProperty("--nb-list-inset-bottom");
      root.removeAttribute("data-anat-crowded");
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootRef, view, graph, nodeId]);

  const handlers = (id: PartId) => ({
    onPointerEnter: (e: ReactPointerEvent) => e.pointerType === "mouse" && onHover(id),
    onPointerLeave: (e: ReactPointerEvent) => e.pointerType === "mouse" && onHover(null),
    onFocus: () => onHover(id),
    onBlur: () => onHover(null),
    onClick: () => onPick(id),
  });
  const activePart = PARTS.find((p) => p.id === active);

  return (
    <div ref={layerRef} className="nb-anat" data-has-active={active ? "" : undefined}>
      <svg className="nb-anat__svg" aria-hidden>
        {PARTS.map((p) => (
          <g key={p.id} className="nb-anat__part" data-active={active === p.id ? "" : undefined}>
            <path ref={bind(`leader-${p.id}`)} className="nb-anat__leader" />
            <path ref={bind(`mark-${p.id}`)} className="nb-anat__mark" />
            <circle ref={bind(`dot-${p.id}`)} className="nb-anat__dot" r={2.5} />
          </g>
        ))}
      </svg>

      {PARTS.map((p) => (
        <button
          key={p.id}
          ref={bind(`label-${p.id}`)}
          type="button"
          className="nb-anat__label"
          data-active={active === p.id ? "" : undefined}
          aria-label={`${p.name}: ${p.text}`}
          aria-pressed={pinned === p.id}
          {...handlers(p.id)}
        >
          <span className="nb-anat__eyebrow">{p.name}</span>
          <span className="nb-anat__text">{p.text}</span>
        </button>
      ))}

      {/* Tap targets on the node; the legend's chips are the same controls for keyboards and screen readers. */}
      {PARTS.map((p, i) => (
        <button
          key={p.id}
          ref={bind(`marker-${p.id}`)}
          type="button"
          tabIndex={-1}
          aria-hidden
          className="nb-anat__marker"
          data-active={active === p.id ? "" : undefined}
          {...handlers(p.id)}
        >
          {i + 1}
        </button>
      ))}

      <div className="nb-anat__legend" data-anat-legend>
        <ol className="nb-anat__chips">
          {PARTS.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className="nb-anat__chip"
                data-active={active === p.id ? "" : undefined}
                aria-label={`${p.name}: ${p.text}`}
                aria-pressed={pinned === p.id}
                {...handlers(p.id)}
              >
                <span className="nb-anat__chip-num" aria-hidden>
                  {i + 1}
                </span>
                {p.name}
              </button>
            </li>
          ))}
        </ol>
        <p className="nb-anat__legend-text" aria-hidden>
          {activePart ? activePart.text : "Every node is built from these five parts."}
        </p>
      </div>
    </div>
  );
}

/** Screen-space boxes (relative to the root) of the node's parts, and where each callout attaches. */
function measure(
  root: HTMLElement,
  node: HTMLElement,
  zoom: number,
): { parts: Record<PartId, PartGeometry>; cardRight: number; extent: { top: number; bottom: number; left: number } } | null {
  const R = root.getBoundingClientRect();
  const box = (el: Element | null | undefined): Box | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height };
  };
  const header = box(node.querySelector("[data-node-header]"));
  const card = box(node.querySelector("[data-media-card]"));
  const controls = box(node.querySelector("[data-controls-card]"));
  const gapRow = node.querySelector("[data-gap-row]");
  const carousel = box(gapRow?.firstElementChild ?? gapRow);
  if (!header || !card || !controls || !carousel) return null;
  // The title text, not the provider badge (which carries a title attribute too).
  const title = box(node.querySelector("[data-node-header] span.truncate[title]"));

  const sockets = [...node.querySelectorAll<HTMLElement>("[data-nb-socket]")].map((el) => {
    const b = box(el)!;
    const out = el.dataset.side === "out";
    // The hole sits 9.5 into the 18px box from its outer side (the right column is mirrored).
    return { out, cx: out ? b.x + b.w - 9.5 * zoom : b.x + 9.5 * zoom, cy: b.y + 14 * zoom, tip: out ? b.x + b.w : b.x };
  });
  const inputs = sockets.filter((s) => !s.out);
  const output = sockets.find((s) => s.out);

  const cardRight = card.x + card.w;
  // The header's own box overlaps the card's top edge; trace only the band above it.
  const headerBand: Box = { x: header.x, y: header.y, w: header.w, h: Math.max(8, card.y - header.y - 3) };
  const headerMid = headerBand.y + headerBand.h / 2;
  const ring = 9 * zoom + 4;
  const summaryMid = controls.y + 14 * zoom;

  const parts: Record<PartId, PartGeometry> = {
    header: {
      mark: brackets(headerBand, 3, 10),
      anchor: { x: cardRight, y: headerMid },
      marker: { x: (title ? title.x + title.w : header.x + header.w * 0.55) + 14, y: headerMid },
    },
    media: {
      mark: brackets(card, 6, 14),
      anchor: { x: cardRight, y: card.y + card.h * 0.62 },
      marker: { x: cardRight - 18, y: card.y + 18 },
    },
    sockets: {
      mark: sockets.map((s) => circle(s.cx, s.cy, ring)).join(""),
      anchor: output ? { x: output.tip, y: output.cy } : { x: cardRight, y: card.y + 25 * zoom },
      marker: inputs.length
        ? { x: Math.min(...inputs.map((s) => s.tip)) - 12, y: inputs.reduce((sum, s) => sum + s.cy, 0) / inputs.length }
        : { x: card.x - 12, y: card.y + 25 * zoom },
    },
    history: {
      mark: brackets(carousel, 4, 8),
      anchor: { x: carousel.x + carousel.w + 6, y: carousel.y + carousel.h / 2 },
      marker: { x: carousel.x + carousel.w + 14, y: carousel.y + carousel.h / 2 },
    },
    controls: {
      mark: brackets(controls, 5, 12),
      anchor: { x: controls.x + controls.w, y: summaryMid },
      marker: { x: controls.x + controls.w + 14, y: summaryMid },
    },
  };
  // The node's outer edges on the hint's side: header top, controls card bottom, input socket tips.
  const left = inputs.length ? Math.min(...inputs.map((s) => s.tip)) : card.x;
  const extent = { top: header.y, bottom: controls.y + controls.h, left };
  return { parts, cardRight: output ? Math.max(cardRight, output.tip) : cardRight, extent };
}

/** Four corner brackets `offset` outside a box, arms up to `arm` long. */
function brackets(b: Box, offset: number, arm: number): string {
  const x0 = b.x - offset;
  const y0 = b.y - offset;
  const x1 = b.x + b.w + offset;
  const y1 = b.y + b.h + offset;
  const a = Math.min(arm, (x1 - x0) / 3, (y1 - y0) / 3);
  const f = (n: number) => n.toFixed(1);
  return (
    `M${f(x0)},${f(y0 + a)}V${f(y0)}H${f(x0 + a)}` +
    `M${f(x1 - a)},${f(y0)}H${f(x1)}V${f(y0 + a)}` +
    `M${f(x1)},${f(y1 - a)}V${f(y1)}H${f(x1 - a)}` +
    `M${f(x0 + a)},${f(y1)}H${f(x0)}V${f(y1 - a)}`
  );
}

function circle(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  return `M${f(cx - r)},${f(cy)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0`;
}
