"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import { ChevronDown, EllipsisVertical, Maximize2, Play } from "lucide-react";

import { cn } from "@/lib/utils";

import { socketMinHeight, socketRowCount, assignSocketRows, type SocketSpec } from "./geometry";
import { useCanvas } from "./canvas";
import { useGraphVersion, type NodeGraph } from "./graph";
import { ProviderBadge, type ProviderId } from "./provider-badge";
import { Socket, type SocketOutline } from "./socket";
import { CONTROLS_GAP, GAP_ROW_H, NODE_MIN_W } from "./tokens";
import { touchClaim, type TouchClaim } from "./touch";
import { useNodeDrag, useTrailingOffset } from "./use-node-drag";

// The node anatomy every node type is built from (src/components/nodes/
// NodeShell.tsx + FloatingNodeHeader.tsx): a floating header, a media card
// carrying the sockets and the outline, a gap row and a detached controls card.

/** How tall the media clip is: from the width and an aspect (w/h), a fixed height, or its content. */
export type NodeMedia = { aspect: number } | { height: number } | "auto";

export interface NodeResize {
  min?: number;
  max?: number;
  /** Double-clicking a resize edge restores this width, as the app restores its type's default. */
  defaultWidth?: number;
  /** Double-clicking a resize edge calls this instead (it wins over defaultWidth). */
  onReset?: () => void;
  /**
   * A resize begins: a press on an edge (a finger once its drag is sideways),
   * an arrow-key step, or a double-click reset. Hold a camera or a spring here.
   */
  onResizeStart?: (side: "left" | "right") => void;
  /** It ends (release, a step applied, the reset done); the node's width and position are final. */
  onResizeEnd?: (side: "left" | "right") => void;
}

export interface NodeCardProps {
  /** Place the node on a canvas graph: position, width and sockets come from it. */
  graph?: NodeGraph;
  /** The node's id in the graph. */
  id?: string;
  /** Width when not on a graph (default 300). */
  width?: number;
  /** Drag by pointer and arrow keys (default true on a graph). */
  draggable?: boolean;
  /** Pressed (React Flow selects on press) or Enter/Space when focused. */
  onSelect?: () => void;
  onDragStart?: () => void;
  onDragEnd?: (moved: boolean) => void;
  constrain?: (x: number, y: number) => { x: number; y: number };

  selected?: boolean;
  running?: boolean;
  error?: boolean;
  /** The agent's edit sweep across the cards (one 1.4s pass when it turns on). */
  shimmer?: boolean;
  /** Controls card trails the media card when the node moves (default true). */
  trailing?: boolean;
  /** Width-only resize from either edge while selected (on a graph), as NodeResizeControl. */
  resizable?: boolean | NodeResize;

  /** Header title (uppercase in the header). */
  title: string;
  provider?: ProviderId;
  /** Replaces the provider badge (a LetterMark, a lucide icon). */
  titleIcon?: ReactNode;
  /** Stands in for the title text (the ComfyWordmark); `title` stays the accessible name. */
  titleLogo?: ReactNode;
  /** Text after a titleLogo, in normal case ("Z-Image and upscale"). */
  subtitle?: string;
  /** Present: the title is the model picker (button with a chevron). */
  onBrowse?: () => void;
  /** Amber readiness pill that never fades ("needs a prompt"). */
  hint?: string;
  onRun?: () => void;
  onExpand?: () => void;
  /** Kebab menu content (MenuRow items). The kebab shows when this is set. */
  menu?: ReactNode;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  /** Blue dot on the kebab (a fallback model is set). */
  menuBadge?: boolean;
  /** Run / expand / kebab: shown on hover or selection (auto), or always. */
  headerControls?: "auto" | "always" | "never";

  media?: NodeMedia;
  inputs?: SocketSpec[];
  outputs?: SocketSpec[];
  /** Socket labels (default: while selected). */
  showLabels?: boolean;
  /** Gap row content (CarouselControls, ScrubRow). */
  gap?: ReactNode;
  /** Usually a ControlsCard. */
  controls?: ReactNode;
  /** Media content, rendered inside the rounded clip. */
  children?: ReactNode;
  /** Clip the media to the rounded rect (default true). */
  clip?: boolean;
  /** Inside the media card but outside the clip (popups, chips that overhang). */
  cardChildren?: ReactNode;
  /** Staggered entry (the site's node-in): the index sets the delay. */
  enterIndex?: number;
  className?: string;
  mediaClassName?: string;
  cardClassName?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

/** A Node Banana node: on a graph it is positioned and draggable; alone it sits in flow. */
export function NodeCard(props: NodeCardProps) {
  const {
    graph,
    id,
    width = 300,
    draggable = Boolean(graph),
    onSelect,
    onDragStart,
    onDragEnd,
    constrain,
    selected = false,
    running = false,
    error = false,
    shimmer = false,
    trailing = true,
    resizable = false,
    title,
    media = { aspect: 1 },
    showLabels,
    gap,
    controls,
    children,
    clip = true,
    cardChildren,
    enterIndex,
    className,
    mediaClassName,
    cardClassName,
    style,
  } = props;
  useGraphVersion(graph);
  const node = graph && id ? graph.node(id) : undefined;
  const inputs = withConnections(props.inputs ?? node?.inputs ?? [], graph, id, "in");
  const outputs = withConnections(props.outputs ?? node?.outputs ?? [], graph, id, "out");
  const [hovered, setHovered] = useState(false);
  const { dragging, handlers } = useNodeDrag(graph, id, { disabled: !draggable, onSelect, onDragStart, onDragEnd, constrain });
  const trailingRef = useTrailingOffset(node?.x, node?.y, trailing);

  // Sockets passed as props win over the graph's; keep the graph in step so noodles find them.
  useEffect(() => {
    if (graph && id && (props.inputs || props.outputs)) {
      graph.setSockets(id, props.inputs ?? node?.inputs ?? [], props.outputs ?? node?.outputs ?? []);
    }
  }, [graph, id, node, props.inputs, props.outputs]);

  const rows = Math.max(socketRowCount(inputs), socketRowCount(outputs));
  const outline: SocketOutline = error ? "error" : selected ? "selected" : running ? "running" : "none";
  const labels = showLabels ?? selected;
  const mediaStyle: CSSProperties =
    media === "auto" ? {} : "aspect" in media ? { aspectRatio: String(media.aspect > 0 ? media.aspect : 1) } : { height: media.height };
  const hasTrailing = (gap !== undefined && gap !== null) || Boolean(controls);

  const resize = resizable && selected && graph && id ? (typeof resizable === "object" ? resizable : {}) : null;

  const body = (
    <>
      {resize && graph && id && (
        <>
          <ResizeEdge side="left" graph={graph} id={id} {...resize} />
          <ResizeEdge side="right" graph={graph} id={id} {...resize} />
        </>
      )}
      <NodeHeader {...props} showControls={props.headerControls === "always" || (props.headerControls !== "never" && (hovered || selected))} />
      <div
        className={cn("nb-media-card", cardClassName)}
        data-media-card
        data-selected={selected ? "" : undefined}
        data-running={running ? "" : undefined}
        data-error={error ? "" : undefined}
        style={{ minHeight: socketMinHeight(rows) }}
      >
        <div className={cn("nb-media-clip group/media", mediaClassName)} data-media-clip data-unclipped={clip ? undefined : ""} style={mediaStyle}>
          {children}
        </div>
        {cardChildren}
        <SocketColumn nodeId={id} side="left" sockets={inputs} showLabels={labels} outline={outline} />
        <SocketColumn nodeId={id} side="right" sockets={outputs} showLabels={labels} outline={outline} />
      </div>
      {hasTrailing && (
        <div ref={trailingRef} className="nb-trailing" data-trailing>
          <div className="nb-gap-row" data-gap-row style={{ height: gap !== undefined && gap !== null ? GAP_ROW_H : CONTROLS_GAP }}>
            {gap}
          </div>
          {controls}
        </div>
      )}
    </>
  );

  const shared = {
    "data-nb-node": "",
    "data-node-id": id,
    "data-draggable": draggable ? "" : undefined,
    "data-dragging": dragging ? "" : undefined,
    "data-selected": selected ? "" : undefined,
    "data-agent-shimmer": shimmer ? "" : undefined,
    role: "group",
    "aria-label": props["aria-label"] ?? `${title} node`,
    tabIndex: draggable || onSelect ? 0 : undefined,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    ...handlers,
  } as const;

  const inner = enterIndex !== undefined ? (
    <div className="nb-enter flex w-full flex-col items-center" style={{ ["--nb-i" as string]: enterIndex }}>
      {body}
    </div>
  ) : (
    body
  );

  if (node && graph && id) {
    return (
      <motion.div
        ref={(el: HTMLDivElement | null) => graph.registerElement(id, el)}
        {...shared}
        className={cn("nb-node", className)}
        style={{ ...style, x: node.x, y: node.y, width: node.width }}
      >
        {inner}
      </motion.div>
    );
  }
  return (
    <div {...shared} data-flow="" className={cn("nb-node", className)} style={{ width, ...style }}>
      {inner}
    </div>
  );
}

/**
 * An invisible 16px ew-resize strip centred on the node's edge (React Flow's
 * line resize control, as NodeShell uses it), with arrow keys for keyboards.
 * A double-click restores the default width, keeping the left edge put as
 * React Flow does. A finger resizes with a sideways drag; a vertical swipe on
 * the strip scrolls the page (touch-action: pan-y).
 */
function ResizeEdge({
  side,
  graph,
  id,
  min = NODE_MIN_W,
  max = 1200,
  defaultWidth,
  onReset,
  onResizeStart,
  onResizeEnd,
}: NodeResize & { side: "left" | "right"; graph: NodeGraph; id: string }) {
  const view = useCanvas();
  const start = useRef<{ px: number; w: number; x: number; y: number; z: number; touch: TouchClaim | null; resizing: boolean } | null>(null);
  const apply = (s: { w: number; x: number; y: number }, delta: number) => {
    const w = Math.round(Math.min(max, Math.max(min, side === "right" ? s.w + delta : s.w - delta)));
    graph.setWidth(id, w);
    if (side === "left") graph.moveTo(id, s.x + (s.w - w), s.y);
  };
  const reset = () => {
    onResizeStart?.(side);
    if (onReset) onReset();
    else if (defaultWidth !== undefined) graph.setWidth(id, Math.round(Math.min(max, Math.max(min, defaultWidth))));
    onResizeEnd?.(side);
  };
  const end = (cancelled: boolean) => {
    const s = start.current;
    start.current = null;
    if (!s?.resizing) return;
    // The page took a finger's swipe after the edge had started to follow: put the node back.
    if (cancelled && s.touch) {
      graph.setWidth(id, s.w);
      graph.moveTo(id, s.x, s.y);
    }
    onResizeEnd?.(side);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize node from the left" : "Resize node"}
      tabIndex={0}
      data-nodrag=""
      className={cn("absolute top-0 bottom-0 z-[3] w-4 cursor-ew-resize touch-pan-y", side === "left" ? "-left-2" : "-right-2")}
      onPointerDown={(e) => {
        const node = graph.node(id);
        if (!node || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const touch = touchClaim(e);
        start.current = { px: e.clientX, w: node.width.get(), x: node.x.get(), y: node.y.get(), z: view?.zoom.get() ?? 1, touch, resizing: !touch };
        if (!touch) onResizeStart?.(side);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        // A finger may still be the start of a page scroll.
        if (s.touch && !s.touch.move(e.clientX, e.clientY)) return;
        if (!s.resizing) {
          s.resizing = true;
          onResizeStart?.(side);
        }
        apply(s, (e.clientX - s.px) / s.z);
      }}
      onPointerUp={() => end(false)}
      onPointerCancel={() => end(true)}
      onDoubleClick={(e) => {
        if (!onReset && defaultWidth === undefined) return;
        e.stopPropagation();
        reset();
      }}
      onKeyDown={(e) => {
        const node = graph.node(id);
        const d = e.key === "ArrowRight" ? 10 : e.key === "ArrowLeft" ? -10 : 0;
        if (!node || !d) return;
        e.preventDefault();
        e.stopPropagation();
        onResizeStart?.(side);
        apply({ w: node.width.get(), x: node.x.get(), y: node.y.get() }, d);
        onResizeEnd?.(side);
      }}
    />
  );
}

function withConnections(sockets: SocketSpec[], graph: NodeGraph | undefined, id: string | undefined, side: "in" | "out"): SocketSpec[] {
  if (!graph || !id) return sockets;
  return sockets.map((s) => (s.connected !== undefined ? s : { ...s, connected: graph.isConnected(id, side, s.id) }));
}

function SocketColumn({
  nodeId,
  side,
  sockets,
  showLabels,
  outline,
}: {
  nodeId?: string;
  side: "left" | "right";
  sockets: ReadonlyArray<SocketSpec>;
  showLabels: boolean;
  outline: SocketOutline;
}) {
  const rows = assignSocketRows(sockets);
  return (
    <>
      {sockets.map((spec, i) => (
        <Socket key={`${side}-${spec.id}`} nodeId={nodeId} side={side} row={rows[i]} spec={spec} showLabel={showLabels} outline={outline} />
      ))}
    </>
  );
}

/** The header floating 26px above the media card: badge, title, and Run / kebab on hover. */
export function NodeHeader({
  title,
  provider,
  titleIcon,
  titleLogo,
  subtitle,
  onBrowse,
  hint,
  onRun,
  onExpand,
  menu,
  menuOpen: menuOpenProp,
  onMenuOpenChange,
  menuBadge,
  running,
  showControls,
}: Pick<
  NodeCardProps,
  | "title"
  | "provider"
  | "titleIcon"
  | "titleLogo"
  | "subtitle"
  | "onBrowse"
  | "hint"
  | "onRun"
  | "onExpand"
  | "menu"
  | "menuOpen"
  | "onMenuOpenChange"
  | "menuBadge"
  | "running"
> & { showControls: boolean }) {
  const [menuOpenState, setMenuOpenState] = useState(false);
  const menuOpen = menuOpenProp ?? menuOpenState;
  const setMenuOpen = (open: boolean) => {
    setMenuOpenState(open);
    onMenuOpenChange?.(open);
  };
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useRef(setMenuOpen);
  useEffect(() => {
    closeMenu.current = setMenuOpen;
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu.current(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeMenu.current(false);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const badge = titleIcon ?? (provider ? <ProviderBadge provider={provider} /> : null);
  const visible = showControls || menuOpen;

  return (
    <div className="nb-node__header" data-node-header>
      <div className="flex w-full cursor-grab items-center justify-between p-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-2">
          {badge}
          {onBrowse ? (
            <button
              type="button"
              onClick={onBrowse}
              title="Browse models"
              className="nodrag group/picker -ml-1.5 flex h-[22px] min-w-0 cursor-pointer items-center gap-1.5 rounded-[6px] pr-1.5 pl-1.5 text-xs font-semibold tracking-wide text-neutral-400 uppercase transition-colors hover:bg-white/8 hover:text-neutral-200"
            >
              <span className="truncate">{title}</span>
              <ChevronDown size={14} strokeWidth={2.25} className="shrink-0 text-neutral-400 group-hover/picker:text-neutral-200" />
            </button>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold tracking-wide text-neutral-400 uppercase" title={title}>
              {titleLogo}
              {/* Its own box: text-overflow never applies to a flex container's bare text. */}
              {titleLogo ? subtitle && <span className="truncate normal-case">{subtitle}</span> : <span className="truncate">{title}</span>}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 pr-1">
          {hint && (
            <span className="mr-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] leading-4 whitespace-nowrap text-amber-200/90">
              {hint}
            </span>
          )}
          {(onExpand || onRun || menu) && (
            <div
              className={cn(
                "flex shrink-0 items-center gap-0.5 transition-opacity duration-200",
                visible ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {onExpand && (
                <GhostButton label="Expand editor" onClick={onExpand}>
                  <Maximize2 size={12} strokeWidth={2} />
                </GhostButton>
              )}
              {onRun && (
                <button
                  type="button"
                  onClick={onRun}
                  disabled={running}
                  aria-label="Run node"
                  title="Run node"
                  tabIndex={visible ? undefined : -1}
                  className="nodrag mr-0.5 flex h-5 items-center gap-1 rounded-[5px] bg-white/8 pr-1.5 pl-1 text-[10px] leading-none font-semibold text-neutral-200 transition-colors hover:bg-white/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/8"
                >
                  <Play size={11} strokeWidth={0} fill="currentColor" />
                  Run
                </button>
              )}
              {menu && (
                <div className="relative shrink-0" ref={menuRef}>
                  <GhostButton
                    label="More"
                    onClick={() => setMenuOpen(!menuOpen)}
                    active={menuOpen}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    badge={menuBadge}
                    tabIndex={visible ? undefined : -1}
                  >
                    <EllipsisVertical size={12} strokeWidth={2} />
                  </GhostButton>
                  {menuOpen && (
                    <div
                      role="menu"
                      aria-label="Node actions"
                      className="nodrag nb-menu-surface nb-drop-in absolute top-full right-0 z-[60] mt-1 min-w-[168px] py-1"
                      onClick={(e) => {
                        if ((e.target as Element).closest("[role='menuitem']")) setMenuOpen(false);
                      }}
                    >
                      {menu}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 20px flat icon button with the chrome tooltip; the header's one button style. */
export function GhostButton({
  label,
  active = false,
  badge = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; badge?: boolean }) {
  return (
    <span className="group/ghost relative flex shrink-0">
      <button
        {...rest}
        type="button"
        aria-label={label}
        className={cn(
          "nodrag flex h-5 w-5 items-center justify-center rounded-[5px] transition-colors",
          "text-neutral-400 hover:bg-white/8 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
          active && "bg-white/10 text-neutral-100",
          className,
        )}
      >
        {children}
      </button>
      {badge && (
        <span className="pointer-events-none absolute -top-px -right-px h-[5px] w-[5px] rounded-full bg-blue-400 ring-[1.5px] ring-[#171717]" />
      )}
      {!active && (
        <span
          aria-hidden
          className="nb-squircle pointer-events-none absolute top-full left-1/2 z-10 mt-1.5 -translate-x-1/2 rounded-md border border-white/10 bg-neutral-950 px-2 py-1 text-[10px] leading-3 font-medium whitespace-nowrap text-neutral-200 opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-opacity delay-300 duration-[120ms] group-hover/ghost:opacity-100"
        >
          {label}
        </span>
      )}
    </span>
  );
}

/** Names worth drawing as their symbol (src/components/ui/Kbd.tsx). Modifier words the platforms differ on (Ctrl) stay words. */
const KEY_SYMBOLS: Record<string, string> = {
  shift: "⇧",
  cmd: "⌘",
  command: "⌘",
  meta: "⌘",
  alt: "⌥",
  option: "⌥",
  enter: "↵",
  return: "↵",
  backspace: "⌫",
  delete: "⌫",
  tab: "⇥",
  escape: "Esc",
  space: "Space",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

/** The symbols that can lead a compact shortcut like "⇧G" or "⌘↵". */
const MODIFIER_GLYPHS = "⌘⇧⌥⌃";
/** Glyphs that are each a whole key. */
const KEY_GLYPHS = MODIFIER_GLYPHS + "↑↓←→↵⏎⌫⇥⎋";

/**
 * One cap per key, as the app splits a shortcut: "⇧⌘Z" → ⇧ ⌘ Z, "⌘↵" → ⌘ ↵,
 * "↑↓" → ↑ ↓, "Ctrl+K" → Ctrl K. A label that is not a key ("Hold H") stays whole.
 */
export function splitKeys(input: string): string[] {
  const keys: string[] = [];
  for (const part of input.includes("+") ? input.split("+") : [input]) {
    let rest = part.trim();
    if (!rest) continue;
    if (rest.length > 1 && [...rest].every((char) => KEY_GLYPHS.includes(char))) {
      keys.push(...rest);
      continue;
    }
    while (rest.length > 1 && MODIFIER_GLYPHS.includes(rest[0])) {
      keys.push(rest[0]);
      rest = rest.slice(1);
    }
    if (rest) keys.push(rest);
  }
  return keys;
}

export type KbdSize = "xs" | "sm" | "md";

const KBD_SIZE: Record<KbdSize, string> = {
  xs: "h-4 min-w-4 rounded-[3px] px-[3px] text-[10px]",
  sm: "h-[18px] min-w-[18px] rounded px-1 text-[11px]",
  md: "h-[22px] min-w-[22px] rounded px-1.5 text-xs",
};

/**
 * A keycap (src/components/ui/Kbd.tsx): xs by default, in neutral-400 as the
 * header menu and hover labels draw it. Key names ("shift", "enter") become
 * their symbols. The face is the app's system stack, not the portfolio's sans.
 */
export function Kbd({ children, size = "xs", className }: { children: ReactNode; size?: KbdSize; className?: string }) {
  const label = typeof children === "string" ? (KEY_SYMBOLS[children.toLowerCase()] ?? children) : children;
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center border border-white/8 bg-white/8 font-[family-name:var(--nb-font-ui)] leading-none font-medium text-neutral-400 select-none",
        KBD_SIZE[size],
        className,
      )}
    >
      {label}
    </kbd>
  );
}

/**
 * The caps of one shortcut (KbdGroup): from a compact string ("⇧⌘Z",
 * "Ctrl+K") or a list. The 2px gap is the header menu's and hover label's;
 * `capClassName` goes on every cap.
 */
export function KbdGroup({
  keys,
  size = "xs",
  className,
  capClassName,
  children,
}: {
  keys: string | ReadonlyArray<string>;
  size?: KbdSize;
  className?: string;
  capClassName?: string;
  children?: ReactNode;
}) {
  const list = typeof keys === "string" ? splitKeys(keys) : keys;
  return (
    <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap", className)}>
      {list.map((key, index) => (
        <Kbd key={`${key}-${index}`} size={size} className={capClassName}>
          {key}
        </Kbd>
      ))}
      {children}
    </span>
  );
}

/** A row of the node's kebab menu: 22px, 10px type, meta in mono, keycaps or a set dot. */
export function MenuRow({
  icon,
  meta,
  keys,
  set = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; meta?: string; keys?: string[]; set?: boolean }) {
  return (
    <button
      {...rest}
      type="button"
      role="menuitem"
      className={cn(
        "nb-text-node flex h-[22px] w-full items-center gap-1.5 px-2 text-left whitespace-nowrap transition-colors",
        "text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 focus-visible:bg-neutral-700 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
        className,
      )}
    >
      <span className="flex w-[11px] shrink-0 items-center justify-center text-current">{icon}</span>
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis">{children}</span>
      {meta && <span className="nb-font-mono nb-text-ink-3 text-[9px]">{meta}</span>}
      {keys && <KbdGroup keys={keys} />}
      {set && <span className="h-[5px] w-[5px] rounded-full bg-blue-400" />}
    </button>
  );
}

/** The divider between menu groups. */
export function MenuDivider() {
  return <div className="nb-border-chrome my-1 border-t" role="separator" />;
}
