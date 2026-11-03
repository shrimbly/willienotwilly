"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";

import type { FinalizeTile } from "@/lib/comfy-commerce/finalize";
import { cn } from "@/lib/utils";

import { X } from "../kit/icons";
import { TouchClaim, touchClaim } from "../kit/interact";
import { easeSoft } from "../kit/motion";

// GalleryStrip, ported from web/src/features/review/GalleryStrip.tsx: one
// listing's gallery as a drag-to-reorder strip (motion's Reorder.Group,
// axis "x"), the live media and the staged results in the order they would
// publish. Staged tiles are outlined in ink with a "New" band and a reject
// button on hover, class for class. Ported differences: the tiles are sized
// by the frame (finalize-demo.css) rather than a fixed size-20; a finger only
// takes a tile once it moves sideways, so a vertical swipe scrolls the page;
// on a touch screen, where there is no hover, a tap on a new tile shows its
// reject button (and only then can a finger hit it: a phone's touch target
// adjustment would otherwise send a tap near the corner to it); a lifted
// tile casts the product's shadow-lift; and the strip has a keyboard
// path (the product's has none): arrows move between tiles, Space picks one
// up and puts it down, Delete rejects a new one.

/** Motion's own layout transition, which the product's Reorder.Item uses unset. */
const LAYOUT_TRANSITION = { duration: 0.45, ease: [0.4, 0, 0.1, 1] as const };
const LIFT_TRANSITION = { duration: 0.2, ease: easeSoft };
/** The "New" band slides away as a result goes live. */
const BAND_TRANSITION = { duration: 0.35, ease: easeSoft };

export type StripMoveSource = "pointer" | "keyboard";

/** "Image 1 of 5, the featured image": where a tile sits, as the strip announces it. */
export function positionText(index: number, count: number) {
  return `position ${index + 1} of ${count}${index === 0 ? ", the featured image" : ""}`;
}

function StripTile({
  tile,
  index,
  count,
  live,
  locked,
  lifted,
  grabbed,
  armed,
  tabStop,
  describedBy,
  groupRef,
  tileRef,
  onTap,
  onDragStart,
  onDragEnd,
  onKeyDown,
  onFocus,
  onBlur,
  onReject,
}: {
  tile: FinalizeTile;
  index: number;
  count: number;
  /** The listing is published: staged results are now live media. */
  live: boolean;
  /** No reordering or rejecting (publishing, published). */
  locked: boolean;
  lifted: boolean;
  grabbed: boolean;
  /** Tapped on a touch screen: its reject button shows and takes taps. */
  armed: boolean;
  tabStop: boolean;
  describedBy?: string;
  groupRef: RefObject<HTMLUListElement | null>;
  tileRef: (el: HTMLLIElement | null) => void;
  /** A finger's tap (its click). */
  onTap: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => void;
  onFocus: () => void;
  onBlur: (event: FocusEvent<HTMLLIElement>) => void;
  onReject: () => void;
}) {
  const controls = useDragControls();
  // A finger's press, held until it shows which way it is going.
  const press = useRef<{ id: number; claim: TouchClaim } | null>(null);
  /** What the last press was, for the click that follows it. */
  const pointerType = useRef("");
  const isNew = tile.staged && !live;

  const onPointerDown = (event: PointerEvent<HTMLLIElement>) => {
    press.current = null;
    pointerType.current = event.pointerType;
    if (locked) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const claim = touchClaim(event);
    if (!claim) {
      // A mouse press on the reject button is its own click (the tile would follow the pointer and take the click with it).
      if (!(event.target as Element).closest("button")) controls.start(event);
      return;
    }
    press.current = { id: event.pointerId, claim };
  };

  const onPointerMove = (event: PointerEvent<HTMLLIElement>) => {
    const p = press.current;
    if (!p || p.id !== event.pointerId || !p.claim.move(event.clientX, event.clientY)) return;
    press.current = null;
    controls.start(event);
  };

  // A finger's tap arms the tile on its click, not its pointerup: the click is
  // hit-tested after the pointerup, and an armed reject button would take it.
  const onClick = (event: MouseEvent<HTMLLIElement>) => {
    if (pointerType.current !== "touch" || locked || (event.target as Element).closest("button")) return;
    onTap();
  };

  const endPress = () => {
    press.current = null;
  };

  const status = isNew ? "new result" : live && tile.staged ? "now live" : "live";

  return (
    <Reorder.Item
      value={tile.id}
      ref={tileRef}
      drag={locked ? false : "x"}
      dragListener={false}
      dragControls={controls}
      dragConstraints={groupRef}
      dragElastic={0.08}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      animate={{ scale: lifted || grabbed ? 1.04 : 1 }}
      transition={{ layout: LAYOUT_TRANSITION, scale: LIFT_TRANSITION }}
      tabIndex={tabStop ? 0 : -1}
      aria-roledescription="sortable image"
      aria-label={`${tile.label}, ${status}, ${positionText(index, count)}`}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onClick={onClick}
      className={cn(
        "ccf-tile group/tile relative shrink-0 touch-pan-y overflow-hidden border bg-(--surface-2) select-none",
        "transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none",
        locked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isNew ? "border-(--ink)" : "border-(--line)",
        (lifted || grabbed) && "shadow-(--shadow-lift)",
        grabbed && "ring-2 ring-(--ink) ring-offset-2 ring-offset-(--surface)",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local product media, cropped square by its tile */}
      <img
        src={tile.image.src}
        alt=""
        draggable={false}
        decoding="async"
        className="pointer-events-none h-full w-full object-cover"
      />
      <AnimatePresence initial={false}>
        {isNew && (
          <motion.span
            key="new"
            aria-hidden
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={BAND_TRANSITION}
            className="ccf-new pointer-events-none absolute inset-x-0 bottom-0 bg-(--ink)/55 text-center font-medium text-(--surface)"
          >
            New
          </motion.span>
        )}
      </AnimatePresence>
      {isNew && !locked && (
        // Out of the tab order: a keyboard rejects with Delete on the tile (the sr-only instructions say so).
        <button
          type="button"
          tabIndex={-1}
          onClick={onReject}
          aria-label={`Reject ${tile.label}`}
          title="Reject"
          className={cn(
            "ccf-reject absolute flex cursor-pointer items-center justify-center rounded-md bg-(--surface)/90 text-(--ink) opacity-0 shadow-(--shadow-soft)",
            "transition-opacity motion-reduce:transition-none hover:bg-(--danger-soft) hover:text-(--danger)",
            "group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100",
            armed ? "opacity-100" : "[@media(hover:none)]:pointer-events-none",
          )}
        >
          <X size="65%" />
        </button>
      )}
    </Reorder.Item>
  );
}

/**
 * One listing's gallery strip. The owner holds the order and what happens to
 * it (as the product's FinalizePage does); the strip holds the keyboard
 * pick-up and the roving tab stop, and reports each move and rejection so the
 * demo can announce it.
 */
export function GalleryStrip({
  order,
  tiles,
  live,
  locked,
  lifted,
  label,
  describedBy,
  onReorder,
  onReject,
  onAnnounce,
  onDragging,
}: {
  order: string[];
  tiles: Map<string, FinalizeTile>;
  live: boolean;
  locked: boolean;
  /** A tile the demo is lifting (its scripted first move). */
  lifted: string | null;
  label: string;
  describedBy?: string;
  onReorder: (next: string[], source: StripMoveSource) => void;
  onReject: (id: string, source: StripMoveSource) => void;
  onAnnounce: (message: string) => void;
  /** A pointer drag starts (the tile's id) or ends (null). */
  onDragging: (id: string | null) => void;
}) {
  const groupRef = useRef<HTMLUListElement>(null);
  const els = useRef(new Map<string, HTMLLIElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [grab, setGrab] = useState<{ id: string; origin: string[] } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const dragFrom = useRef(-1);
  // A keyboard move re-orders the DOM, which can blur the moved tile; focus goes back to it after.
  const refocus = useRef<string | null>(null);

  const count = order.length;
  const stop = focusId && order.includes(focusId) ? focusId : order[0];
  const nameOf = (id: string) => tiles.get(id)?.label ?? "Image";

  const tileRef = useCallback(
    (id: string) => (el: HTMLLIElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    [],
  );

  useLayoutEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    const el = els.current.get(id);
    if (el && document.activeElement !== el) el.focus({ preventScroll: true });
  }, [order]);

  // Publishing locks the strip: a tile held from the keyboard is put down where it is.
  if (grab && locked) setGrab(null);
  if (armed && (locked || !order.includes(armed))) setArmed(null);

  // A tapped tile keeps its reject button until the next press lands somewhere else.
  useEffect(() => {
    if (!armed) return;
    const disarm = (event: globalThis.PointerEvent) => {
      if (!els.current.get(armed)?.contains(event.target as Node)) setArmed(null);
    };
    document.addEventListener("pointerdown", disarm, true);
    return () => document.removeEventListener("pointerdown", disarm, true);
  }, [armed]);

  const move = (id: string, to: number) => {
    const from = order.indexOf(id);
    if (from < 0 || to === from) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    refocus.current = id;
    onReorder(next, "keyboard");
    onAnnounce(`${nameOf(id)}, ${positionText(to, count)}.`);
  };

  const focusAt = (index: number) => {
    const id = order[Math.max(0, Math.min(count - 1, index))];
    if (id) els.current.get(id)?.focus({ preventScroll: true });
  };

  const onTileKeyDown = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (event.target !== event.currentTarget || event.altKey || event.metaKey || event.ctrlKey) return;
    const index = order.indexOf(id);
    const last = count - 1;
    const step: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: last };

    if (grab?.id === id) {
      if (event.key in step) {
        event.preventDefault();
        event.stopPropagation();
        move(id, Math.max(0, Math.min(last, step[event.key])));
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        setGrab(null);
        onAnnounce(`Dropped ${nameOf(id)} at ${positionText(index, count)}.`);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setGrab(null);
        refocus.current = id;
        onReorder(grab.origin, "keyboard");
        onAnnounce(`Cancelled. ${nameOf(id)} is back at ${positionText(grab.origin.indexOf(id), count)}.`);
      } else if (event.key === "Tab") {
        // Tabbing away puts the tile down where it is.
        setGrab(null);
        onAnnounce(`Dropped ${nameOf(id)} at ${positionText(index, count)}.`);
      }
      return;
    }

    if (event.key in step) {
      event.preventDefault();
      event.stopPropagation();
      focusAt(step[event.key]);
    } else if ((event.key === " " || event.key === "Enter") && !locked) {
      event.preventDefault();
      event.stopPropagation();
      setGrab({ id, origin: order });
      onAnnounce(
        `Picked up ${nameOf(id)}, ${positionText(index, count)}. Use the left and right arrow keys to move it, Space to put it down, or Escape to cancel.`,
      );
    } else if ((event.key === "Delete" || event.key === "Backspace") && tiles.get(id)?.staged && !live && !locked) {
      event.preventDefault();
      event.stopPropagation();
      const neighbour = order[index + 1] ?? order[index - 1] ?? null;
      refocus.current = neighbour;
      if (neighbour) setFocusId(neighbour);
      onReject(id, "keyboard");
    }
  };

  const onTileBlur = (event: FocusEvent<HTMLLIElement>, id: string) => {
    // Focus leaving the strip (not a re-order's own blur) puts a held tile down.
    if (grab?.id !== id || refocus.current === id) return;
    if (event.relatedTarget && groupRef.current?.contains(event.relatedTarget as Node)) return;
    setGrab(null);
  };

  return (
    <Reorder.Group
      ref={groupRef}
      axis="x"
      values={order}
      onReorder={(next: string[]) => onReorder(next, "pointer")}
      role="list"
      aria-label={label}
      className="flex flex-wrap gap-(--ccf-gap) px-(--ccf-px) py-(--ccf-py)"
    >
      {order.map((id, index) => {
        const tile = tiles.get(id);
        if (!tile) return null;
        return (
          <StripTile
            key={id}
            tile={tile}
            index={index}
            count={count}
            live={live}
            locked={locked}
            lifted={lifted === id || dragging === id}
            grabbed={grab?.id === id}
            armed={armed === id}
            tabStop={stop === id}
            describedBy={describedBy}
            groupRef={groupRef}
            tileRef={tileRef(id)}
            onTap={() => setArmed((current) => (current === id || !tile.staged ? null : id))}
            onDragStart={() => {
              setGrab(null);
              setArmed(null);
              setDragging(id);
              dragFrom.current = order.indexOf(id);
              onDragging(id);
            }}
            onDragEnd={() => {
              setDragging(null);
              onDragging(null);
              const to = order.indexOf(id);
              if (to !== dragFrom.current) onAnnounce(`${tile.label} moved to ${positionText(to, count)}.`);
            }}
            onKeyDown={(event) => onTileKeyDown(event, id)}
            onFocus={() => setFocusId(id)}
            onBlur={(event) => onTileBlur(event, id)}
            onReject={() => onReject(id, "pointer")}
          />
        );
      })}
    </Reorder.Group>
  );
}
