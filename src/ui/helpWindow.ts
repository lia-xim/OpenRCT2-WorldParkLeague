import { getDifficultyRecommendationLine } from "../domain/difficulty";
import { readPlayerSnapshot } from "../domain/player";
import { getActiveObjectiveSummary } from "../domain/objectives";
import { getActiveChallengeSummary } from "../domain/rivalry";
import { readState } from "../state/repository";
import { PLUGIN_NAME } from "../config";

const HELP_WINDOW_CLASSIFICATION = "world-park-league.help";
const HELP_WINDOW_TITLE = `${PLUGIN_NAME} | Help`;

export function openHelpWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const existing = ui.getWindow(HELP_WINDOW_CLASSIFICATION);
  if (existing) {
    existing.bringToFront();
    return;
  }

  const snapshot = readPlayerSnapshot();
  const state = readState(snapshot);
  const objective = getActiveObjectiveSummary(state, snapshot.currentDayIndex);
  const challenge = getActiveChallengeSummary(state);
  const difficultyLine = getDifficultyRecommendationLine(state, snapshot);

  ui.openWindow({
    classification: HELP_WINDOW_CLASSIFICATION,
    title: HELP_WINDOW_TITLE,
    width: 520,
    height: 324,
    minWidth: 520,
    minHeight: 324,
    maxWidth: 520,
    maxHeight: 324,
    widgets: [
      { type: "groupbox", x: 8, y: 18, width: 504, height: 122, text: "What matters first" },
      { type: "label", x: 20, y: 38, width: 480, height: 14, text: "Rank: your league position. Higher rank brings more attention and pressure." },
      { type: "label", x: 20, y: 56, width: 480, height: 14, text: "Score: built from real park data: rating, guests, value, ride quality and depth." },
      { type: "label", x: 20, y: 74, width: 480, height: 14, text: "People share: how much of the global visitor pool chooses your park." },
      { type: "label", x: 20, y: 92, width: 480, height: 14, text: "Park cash: all trades, rewards and penalties affect your real building budget." },
      { type: "label", x: 20, y: 110, width: 480, height: 14, text: "Simple mode shows the play signal. Advanced mode shows the full economy." },

      { type: "groupbox", x: 8, y: 148, width: 504, height: 94, text: "What to do now" },
      { type: "label", x: 20, y: 168, width: 480, height: 14, text: trimText(`Task: ${objective}`, 82) },
      { type: "label", x: 20, y: 186, width: 480, height: 14, text: trimText(`Rival challenge: ${challenge}`, 82) },
      { type: "label", x: 20, y: 204, width: 480, height: 14, text: trimText(difficultyLine, 82) },
      { type: "label", x: 20, y: 222, width: 480, height: 14, text: "Use Tasks for active assignments; Money for actions and Rivals for alerts." },

      { type: "groupbox", x: 8, y: 250, width: 504, height: 38, text: "Counterplay" },
      { type: "label", x: 20, y: 270, width: 480, height: 14, text: "After rival pressure, launch Counter Campaign or Local Push from Money > Actions." },
      {
        type: "button",
        x: 412,
        y: 296,
        width: 90,
        height: 18,
        text: "Close",
        onClick: () => {
          const window = ui.getWindow(HELP_WINDOW_CLASSIFICATION);
          if (window) {
            window.close();
          }
        },
      },
    ],
  });
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
