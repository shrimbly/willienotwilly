import { MIX_STANDARD, type Mix } from "@/lib/booth/mix";
import { glyphMode, type BoothScreen, type GlyphMode } from "@/lib/booth/popover-logic";

// The hero's state: the app's AppModel and PopoverLogic reduced to what one file on a desktop
// needs (studiovoice/app/Sources/Booth/Model/AppModel.swift: open, close, closeDone, add,
// holdFinishedJob; BoothCore/PopoverLogic.swift: viewOnOpen, glyphMode).

export type DesktopFile = "original" | "enhanced";

export interface Scene {
  open: boolean;
  /** The screen asked for; it persists while the popover is closed, as `AppModel.screen` does. */
  screen: BoothScreen;
  /** A dragged file is over the menu bar icon. */
  iconTarget: boolean;
  /** A dragged file is over the popover. */
  dropHover: boolean;
  job: "none" | "working" | "done";
  /** The job finished while the popover was closed: the lamp shows done until it is seen. */
  unseen: boolean;
  /** The icon's 150 ms pulse as a file is accepted. */
  pulse: boolean;
  /** Bumped each time the popover opens, which plays the signature's reveal; 0 plays none. */
  revealKey: number;
  /** `interview-take3-enhanced.wav` has appeared beside the original. */
  enhanced: boolean;
  selected: DesktopFile | null;
  mixOpen: boolean;
  mix: Mix;
  savedMix: Mix;
  saving: boolean;
}

/**
 * The resting frame, and the server's: the Done screen open under a lit icon with the enhanced
 * copy beside the original, the way the link-preview card shows Booth.
 */
export const REST_SCENE: Scene = {
  open: true,
  screen: "done",
  iconTarget: false,
  dropHover: false,
  job: "done",
  unseen: false,
  pulse: false,
  revealKey: 0,
  enhanced: true,
  selected: "original",
  mixOpen: false,
  mix: MIX_STANDARD,
  savedMix: MIX_STANDARD,
  saving: false,
};

export type SceneAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "iconTarget"; on: boolean }
  | { type: "dropHover"; on: boolean }
  | { type: "drop" }
  | { type: "pulseEnd" }
  | { type: "finish" }
  | { type: "cancel" }
  | { type: "closeDone" }
  | { type: "select"; file: DesktopFile | null }
  | { type: "reveal" }
  | { type: "loop" }
  | { type: "mixToggle" }
  | { type: "mix"; mix: Mix }
  | { type: "revert" }
  | { type: "saving" }
  | { type: "saved" };

export function sceneReducer(state: Scene, action: SceneAction): Scene {
  switch (action.type) {
    case "open": {
      if (state.open) return state;
      // viewOnOpen: the job in the booth, else a finished one not yet seen, else the Done screen
      // that was showing, else the drop zone.
      const screen: BoothScreen =
        state.job === "working" ? "working" : state.unseen || (state.job === "done" && state.screen === "done") ? "done" : "idle";
      return { ...state, open: true, unseen: false, screen, revealKey: state.revealKey + 1 };
    }
    case "close":
      if (!state.open) return state;
      return { ...state, open: false, dropHover: false };
    case "iconTarget":
      return state.iconTarget === action.on ? state : { ...state, iconTarget: action.on };
    case "dropHover":
      return state.dropHover === action.on ? state : { ...state, dropHover: action.on };
    case "drop":
      // A file already in the booth keeps the bar; the app would queue the new one.
      return {
        ...state,
        iconTarget: false,
        dropHover: false,
        pulse: true,
        job: "working",
        screen: state.open ? "working" : state.screen,
        selected: "original",
      };
    case "pulseEnd":
      return { ...state, pulse: false };
    case "finish":
      // Working holds the full bar a beat, then Done takes over; closed, the lamp waits to be seen.
      return {
        ...state,
        job: "done",
        enhanced: true,
        screen: state.screen === "working" ? "done" : state.screen,
        unseen: !state.open,
        mixOpen: false,
        mix: state.savedMix,
      };
    case "cancel":
      // Working's ×: the job stops and the popover goes back to the drop zone.
      return { ...state, job: "none", screen: "idle", unseen: false, revealKey: 0 };
    case "closeDone":
      return { ...state, screen: "idle", revealKey: 0 };
    case "select":
      return { ...state, selected: action.file };
    case "reveal":
      return { ...state, revealKey: state.revealKey + 1 };
    case "loop":
      // The storyline starts again from the drop zone, the enhanced copy still on the desktop.
      return { ...REST_SCENE, open: false, screen: "idle", job: "none", revealKey: state.revealKey, mix: state.savedMix, savedMix: state.savedMix };
    case "mixToggle":
      return { ...state, mixOpen: !state.mixOpen };
    case "mix":
      return { ...state, mix: action.mix };
    case "revert":
      return { ...state, mix: state.savedMix };
    case "saving":
      return { ...state, saving: true };
    case "saved":
      return { ...state, saving: false, savedMix: state.mix };
  }
}

/**
 * The icon's state. As in the site's demo video (DemoRenderer.swift), the lamp shows done while
 * the Done screen is up; in the app it does so for a file finished unseen.
 */
export function sceneGlyph(state: Scene): GlyphMode {
  return glyphMode({
    iconTarget: state.iconTarget,
    working: state.job === "working",
    unseen: state.unseen || (state.open && state.screen === "done" && state.job === "done"),
  });
}
