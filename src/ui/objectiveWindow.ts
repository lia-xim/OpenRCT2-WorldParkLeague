import {
  buildActiveObjectiveDetailRows,
  getActiveObjectiveSummary,
} from "../domain/objectives";
import { readPlayerSnapshot } from "../domain/player";
import { readState } from "../state/repository";
import { PLUGIN_NAME } from "../config";
import type { PlayerSnapshot, WorldParkLeagueState } from "../types";
import { drawTextPanel, type TextPanelModel } from "./statCard";
import { openPrestigeWindow } from "./prestigeWindow";

const OBJECTIVE_WINDOW_CLASSIFICATION = "world-park-league.objectives";
const OBJECTIVE_WINDOW_TITLE = `${PLUGIN_NAME} | Tasks`;

let objectivePanelModel: TextPanelModel = { rows: [] };
let lastAutoOpenedObjectiveId: string | null = null;

export function openObjectiveWindow(
  state?: WorldParkLeagueState,
  snapshot?: PlayerSnapshot
): void {
  if (typeof ui === "undefined") {
    return;
  }

  const context = resolveObjectiveContext(state, snapshot);
  const existing = ui.getWindow(OBJECTIVE_WINDOW_CLASSIFICATION);
  if (existing) {
    existing.bringToFront();
    updateObjectiveWindowContents(context.state, context.snapshot);
    return;
  }

  ui.openWindow({
    classification: OBJECTIVE_WINDOW_CLASSIFICATION,
    title: OBJECTIVE_WINDOW_TITLE,
    width: 520,
    height: 248,
    minWidth: 520,
    minHeight: 248,
    maxWidth: 520,
    maxHeight: 248,
    widgets: [
      { type: "groupbox", x: 8, y: 18, width: 504, height: 174, text: "Current league task" },
      {
        type: "custom",
        name: "objective-panel",
        x: 18,
        y: 36,
        width: 484,
        height: 146,
        onDraw(g) {
          drawTextPanel(this, g, objectivePanelModel);
        },
      },
      {
        type: "button",
        x: 250,
        y: 208,
        width: 78,
        height: 18,
        text: "Refresh",
        onClick: () => {
          const freshSnapshot = readPlayerSnapshot();
          updateObjectiveWindowContents(readState(freshSnapshot), freshSnapshot);
        },
      },
      {
        type: "button",
        x: 334,
        y: 208,
        width: 78,
        height: 18,
        text: "Prestige",
        onClick: () => {
          openPrestigeWindow();
        },
      },
      {
        type: "button",
        x: 418,
        y: 208,
        width: 78,
        height: 18,
        text: "Close",
        onClick: () => {
          closeObjectiveWindowIfOpen();
        },
      },
    ],
  });

  updateObjectiveWindowContents(context.state, context.snapshot);
}

export function refreshObjectiveWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(OBJECTIVE_WINDOW_CLASSIFICATION);
  if (!window) {
    return;
  }

  const snapshot = readPlayerSnapshot();
  updateObjectiveWindowContents(readState(snapshot), snapshot);
}

export function closeObjectiveWindowIfOpen(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(OBJECTIVE_WINDOW_CLASSIFICATION);
  if (window) {
    window.close();
  }
}

export function maybeOpenObjectiveWindowForActiveTask(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): void {
  if (typeof ui === "undefined") {
    return;
  }

  const objective = state.player.objectives.activeObjective;
  if (!objective || objective.id === lastAutoOpenedObjectiveId) {
    return;
  }

  lastAutoOpenedObjectiveId = objective.id;
  openObjectiveWindow(state, snapshot);
}

function updateObjectiveWindowContents(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): void {
  objectivePanelModel = {
    caption: getActiveObjectiveSummary(state, snapshot.currentDayIndex),
    rows: buildActiveObjectiveDetailRows(state, snapshot),
  };
}

function resolveObjectiveContext(
  state?: WorldParkLeagueState,
  snapshot?: PlayerSnapshot
): { state: WorldParkLeagueState; snapshot: PlayerSnapshot } {
  const resolvedSnapshot = snapshot ?? readPlayerSnapshot();
  return {
    snapshot: resolvedSnapshot,
    state: state ?? readState(resolvedSnapshot),
  };
}
