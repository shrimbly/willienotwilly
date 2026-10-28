import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/utils";

import { socketCenter, type SocketSpec } from "./geometry";
import { SOCKET_H, SOCKET_HOLE_R, SOCKET_RING_W, SOCKET_W, socketColor } from "./tokens";

// Ported from src/components/nodes/ui/Socket.tsx and HandleLabel.tsx.

/**
 * The swell: three tangent arcs from the card border out into a bump and
 * back, in an 18×28 box whose x=14.5 is the centre of the card's 1px border.
 */
export const SOCKET_SWELL = "M14.5,-2 L14.5,0 A5,5 0 0 1 9.5,5 A9,9 0 0 0 9.5,23 A5,5 0 0 1 14.5,28 L14.5,30";
const SOCKET_ARCS = "M14.5,0 A5,5 0 0 1 9.5,5 A9,9 0 0 0 9.5,23 A5,5 0 0 1 14.5,28";
const SOCKET_FILL = `${SOCKET_SWELL} L${SOCKET_W},30 L${SOCKET_W},-2 Z`;
const HOLE_CX = 9.5;
const HOLE_CY = 14;

/** The media card's outline state, so the swell can continue it. */
export type SocketOutline = "none" | "selected" | "running" | "error";

const OUTLINE: Record<Exclude<SocketOutline, "none">, { color: string; ring: number; ringOpacity: number }> = {
  selected: { color: "var(--nb-selection)", ring: 2, ringOpacity: 0.4 },
  running: { color: "var(--nb-running)", ring: 1, ringOpacity: 0.2 },
  error: { color: "var(--nb-error)", ring: 0, ringOpacity: 0 },
};

/** The 18×28 box a socket fills against the media card's border, mirrored on the right. */
export function socketBoxStyle(side: "left" | "right", row: number): CSSProperties {
  return {
    top: socketCenter(row) - SOCKET_H / 2,
    [side]: -(SOCKET_W - 3),
    width: SOCKET_W,
    height: SOCKET_H,
    transform: side === "right" ? "scaleX(-1)" : "none",
  };
}

/** The swell, its ring and the hole, in currentColor (the socket's type colour). */
export function SocketGlyph({ connected = false, outline = "none" }: { connected?: boolean; outline?: SocketOutline }) {
  const edge = outline === "none" ? null : OUTLINE[outline];
  return (
    <svg width={SOCKET_W} height={SOCKET_H} viewBox={`0 0 ${SOCKET_W} ${SOCKET_H}`} overflow="visible" aria-hidden>
      {/* The card's ring continued around the swell: a wide stroke behind the
          fill, painted opaque in the colour the translucent ring resolves to. */}
      {edge && edge.ring > 0 && (
        <path
          d={SOCKET_ARCS}
          fill="none"
          stroke={`color-mix(in srgb, ${edge.color} ${Math.round(edge.ringOpacity * 100)}%, var(--nb-canvas))`}
          strokeWidth={1 + edge.ring * 2}
        />
      )}
      <path d={SOCKET_FILL} fill="var(--nb-card)" />
      <path
        d={SOCKET_SWELL}
        fill="none"
        stroke={edge ? edge.color : "var(--nb-card-border)"}
        strokeWidth={1}
        style={{ transition: "stroke 150ms cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
      <circle
        className="nb-socket__hole"
        cx={HOLE_CX}
        cy={HOLE_CY}
        r={SOCKET_HOLE_R}
        fill={connected ? "currentColor" : "var(--nb-canvas)"}
        stroke="currentColor"
        strokeWidth={SOCKET_RING_W}
        strokeOpacity={connected ? 1 : 0.6}
      />
    </svg>
  );
}

export interface HandleLabelProps {
  label: string;
  side: "left" | "right";
  color: string;
  /** CSS top in px, from the media card's padding edge. */
  top: number;
  /** Distance from the card edge; sockets stick out, so they use 22px. */
  offset?: number;
  visible: boolean;
  opacity?: number;
}

/** The socket's type name beside the card, faded in while the node is selected. */
export function HandleLabel({ label, side, color, top, offset = 22, visible, opacity }: HandleLabelProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute text-[10px] leading-normal font-medium whitespace-nowrap",
        side === "left" && "text-right",
      )}
      style={{
        ...(side === "left" ? { right: `calc(100% + ${offset}px)` } : { left: `calc(100% + ${offset}px)` }),
        top,
        color,
        zIndex: 10,
        opacity: visible ? (opacity ?? 1) : 0,
        transition: "opacity 150ms ease-in-out",
      }}
    >
      {label}
    </div>
  );
}

export interface SocketProps {
  side: "left" | "right";
  row: number;
  spec: SocketSpec;
  showLabel?: boolean;
  outline?: SocketOutline;
  /** Fills the hole as a valid connection drags over it. */
  highlight?: boolean;
  /** Makes the socket a drag source for connecting (crosshair, 30×34 hit area). */
  onPointerDown?: (event: ReactPointerEvent<HTMLSpanElement>, spec: SocketSpec) => void;
  nodeId?: string;
}

/** One socket set into the media card's border, with its label. */
export function Socket({ side, row, spec, showLabel = false, outline = "none", highlight, onPointerDown, nodeId }: SocketProps) {
  if (spec.hidden) return null;
  const color = socketColor(spec.type);
  return (
    <>
      <span
        className="nb-socket"
        data-nb-socket=""
        data-node={nodeId}
        data-handle={spec.id}
        data-side={side === "left" ? "in" : "out"}
        data-handletype={spec.type}
        data-connected={spec.connected ? "" : undefined}
        data-highlight={highlight ? "" : undefined}
        data-interactive={onPointerDown ? "" : undefined}
        title={spec.title}
        style={{ ...socketBoxStyle(side, row), color, ...(spec.placeholder ? { opacity: 0.3 } : null) }}
        onPointerDown={onPointerDown ? (event) => onPointerDown(event, spec) : undefined}
      >
        <SocketGlyph connected={spec.connected} outline={outline} />
      </span>
      {spec.label && (
        <HandleLabel
          label={spec.label}
          side={side}
          color={color}
          top={socketCenter(row) - 18}
          visible={showLabel}
          opacity={spec.placeholder ? 0.5 : undefined}
        />
      )}
    </>
  );
}
