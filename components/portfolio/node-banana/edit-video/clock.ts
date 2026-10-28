// The live playhead (the app's livePlayhead/subscribeLivePlayhead): written every frame while the preview plays,
// read by the playhead line, the time readout and the preview through subscriptions, never through a render.

export type ClockListener = (t: number) => void;

export interface PlayheadClock {
  get: () => number;
  set: (t: number) => void;
  subscribe: (fn: ClockListener) => () => void;
}

export function createClock(initial: number): PlayheadClock {
  let t = initial;
  const listeners = new Set<ClockListener>();
  return {
    get: () => t,
    set: (next) => {
      if (next === t) return;
      t = next;
      listeners.forEach((fn) => fn(t));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
