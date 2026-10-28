/**
 * Touch presses on a scrolling page. The canvas, the nodes and the resize
 * strips are `touch-action: pan-y`: the browser takes a mostly vertical swipe
 * for the page and sends a pointercancel once the finger passes its own slop
 * (16px in desktop Chrome, nearer 40px on phones), after it has already
 * delivered a few pointermoves. A press only becomes the demo's when it is
 * clearly sideways, so a swipe that scrolls past a tile never drags or pans
 * anything on the way; anything that moved anyway is put back on the cancel.
 */

/** Below this the direction of a finger's movement is still jitter. */
const DIRECTION_MIN = 12;

/** Whether the page may take a vertical pan that starts on `el` (no `touch-action` on the way up rules it out). */
function pageCanPanY(el: Element | null): boolean {
  for (let n = el; n; n = n.parentElement) {
    const action = getComputedStyle(n).touchAction;
    if (action === "auto" || action === "manipulation") continue;
    if (!/pan-y|pan-up|pan-down/.test(action)) return false;
  }
  return true;
}

export class TouchClaim {
  private readonly x0: number;
  private readonly y0: number;
  /** The page cannot scroll from here (touch-action: none on the way up): every movement is the demo's. */
  private readonly ours: boolean;
  /** True once the press belongs to the demo. */
  claimed = false;

  constructor(x: number, y: number, pageCanPan = true) {
    this.x0 = x;
    this.y0 = y;
    this.ours = !pageCanPan;
  }

  /**
   * Feed every pointermove past your own slop; returns whether the press is
   * the demo's yet. A mostly horizontal movement is (pan-y never scrolls
   * sideways); a vertical one never is, since the page takes it.
   */
  move(x: number, y: number): boolean {
    if (this.claimed) return true;
    const dx = x - this.x0;
    const dy = y - this.y0;
    if (this.ours || (Math.hypot(dx, dy) >= DIRECTION_MIN && Math.abs(dx) > Math.abs(dy))) this.claimed = true;
    return this.claimed;
  }
}

/** A TouchClaim for a touch press; null (always the demo's) for a mouse or a pen. */
export function touchClaim(event: { pointerType: string; clientX: number; clientY: number; target: EventTarget | null }): TouchClaim | null {
  if (event.pointerType !== "touch") return null;
  return new TouchClaim(event.clientX, event.clientY, pageCanPanY(event.target instanceof Element ? event.target : null));
}
