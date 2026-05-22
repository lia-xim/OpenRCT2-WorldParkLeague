import {
  buildPrestigeProgress,
  getPrestigeHeadline,
  getNextPrestigeGoal,
  getPrestigeRewardSummary,
} from "../domain/prestige";
import { readPlayerSnapshot } from "../domain/player";
import { formatCompactMoney } from "../domain/currency";
import { buildYearlyRecap } from "../domain/progression";
import {
  buildAnalystInsight,
  formatHeadToHeadLine,
  getActiveChallengeSummary,
  getPrimaryRivalSummary,
} from "../domain/rivalry";
import { getLocalMarketSummary } from "../domain/watchlist";
import { readState } from "../state/repository";
import { PLUGIN_NAME } from "../config";
import { drawStatCard, drawTextPanel, type StatCardModel, type TextPanelModel } from "./statCard";
import type { PlayerSnapshot, WorldParkLeagueState } from "../types";

const PRESTIGE_WINDOW_CLASSIFICATION = "world-park-league.prestige";
const PRESTIGE_WINDOW_TITLE = `${PLUGIN_NAME} | Prestige`;

let selectedAchievementKey: string | null = null;
let selectedGoalKey: string | null = null;
let summaryCard: StatCardModel = { rows: [] };
let recordsPanel: TextPanelModel = { rows: [] };
let rivalryPanel: TextPanelModel = { rows: [] };

export function openPrestigeWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  const state = readState(snapshot);
  const existing = ui.getWindow(PRESTIGE_WINDOW_CLASSIFICATION);
  if (existing) {
    existing.bringToFront();
    updatePrestigeContents(state, snapshot);
    return;
  }

  ui.openWindow({
    classification: PRESTIGE_WINDOW_CLASSIFICATION,
    title: PRESTIGE_WINDOW_TITLE,
    width: 620,
    height: 664,
    minWidth: 620,
    minHeight: 664,
    maxWidth: 620,
    maxHeight: 664,
    onClose: () => {
      selectedAchievementKey = null;
      selectedGoalKey = null;
    },
    widgets: [
      { type: "groupbox", x: 8, y: 18, width: 604, height: 104, text: "Prestige Overview" },
      {
        type: "custom",
        name: "prestige-card",
        x: 18,
        y: 34,
        width: 584,
        height: 78,
        onDraw(g) {
          drawStatCard(this, g, summaryCard);
        },
      },

      { type: "groupbox", x: 8, y: 128, width: 604, height: 188, text: "Unlocked Achievements" },
      {
        type: "listview",
        name: "achievement-list",
        x: 18,
        y: 146,
        width: 584,
        height: 104,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: true,
        columns: [
          { header: "Achievement", width: 194 },
          { header: "When", width: 82 },
          { header: "Story", width: 288 },
        ],
        items: [],
        onClick: (item) => {
          const stateNow = readState(readPlayerSnapshot());
          const achievement = stateNow.player.prestige.unlockedAchievements[item];
          if (!achievement) {
            return;
          }

          selectedAchievementKey = achievement.key;
          updatePrestigeContents(stateNow, readPlayerSnapshot());
        },
      },
      { type: "label", name: "achievement-detail", x: 18, y: 256, width: 584, height: 50, text: "" },

      { type: "groupbox", x: 8, y: 322, width: 604, height: 158, text: "Active Goals" },
      {
        type: "listview",
        name: "goal-list",
        x: 18,
        y: 340,
        width: 584,
        height: 88,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: true,
        columns: [
          { header: "Goal", width: 166 },
          { header: "Progress", width: 88 },
          { header: "Reward", width: 198 },
          { header: "Type", width: 112 },
        ],
        items: [],
        onClick: (item) => {
          const progress = buildPrestigeProgress(readState(readPlayerSnapshot()), readPlayerSnapshot())
            .filter((goal) => !goal.completed)[item];
          if (!progress) {
            return;
          }

          selectedGoalKey = progress.key;
          updatePrestigeContents(readState(readPlayerSnapshot()), readPlayerSnapshot());
        },
      },
      { type: "label", name: "goal-detail", x: 18, y: 434, width: 584, height: 36, text: "" },

      { type: "groupbox", x: 8, y: 486, width: 290, height: 170, text: "Lifetime Records" },
      {
        type: "custom",
        name: "records-panel",
        x: 18,
        y: 504,
        width: 270,
        height: 142,
        onDraw(g) {
          drawTextPanel(this, g, recordsPanel);
        },
      },

      { type: "groupbox", x: 306, y: 486, width: 306, height: 170, text: "Rival Story" },
      {
        type: "custom",
        name: "rivalry-panel",
        x: 316,
        y: 504,
        width: 286,
        height: 142,
        onDraw(g) {
          drawTextPanel(this, g, rivalryPanel);
        },
      },
    ],
  });

  updatePrestigeContents(state, snapshot);
}

export function refreshPrestigeWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(PRESTIGE_WINDOW_CLASSIFICATION);
  if (!window || context.mode !== "normal") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  updatePrestigeContents(readState(snapshot), snapshot);
}

export function closePrestigeWindowIfOpen(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(PRESTIGE_WINDOW_CLASSIFICATION);
  if (window) {
    window.close();
  }

  selectedAchievementKey = null;
  selectedGoalKey = null;
}

function updatePrestigeContents(state: WorldParkLeagueState, snapshot: PlayerSnapshot): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(PRESTIGE_WINDOW_CLASSIFICATION);
  if (!window) {
    return;
  }

  const unlocked = state.player.prestige.unlockedAchievements;
  const activeGoals = buildPrestigeProgress(state, snapshot).filter((goal) => !goal.completed);
  const nextGoal = getNextPrestigeGoal(state, snapshot);
  const localMarketSummary = getLocalMarketSummary(state);
  const comparisonEntry =
    state.world.leaderboard.find((entry) => !entry.isPlayer && entry.rank === Math.max(1, (state.player.currentRank ?? 2) - 1)) ??
    state.world.leaderboard.find((entry) => !entry.isPlayer) ??
    null;
  const rivalrySummary = getPrimaryRivalSummary(state, comparisonEntry?.parkId ?? null);
  const analystInsight = buildAnalystInsight(state, snapshot, rivalrySummary);
  const recap = buildYearlyRecap(state, comparisonEntry);
  const records = state.player.prestige.records;

  if (!selectedAchievementKey && unlocked[0]) {
    selectedAchievementKey = unlocked[0].key;
  }
  if (!selectedGoalKey && activeGoals[0]) {
    selectedGoalKey = activeGoals[0].key;
  }

  const selectedAchievement =
    unlocked.find((achievement) => achievement.key === selectedAchievementKey) ?? unlocked[0] ?? null;
  const selectedGoal =
    activeGoals.find((goal) => goal.key === selectedGoalKey) ?? activeGoals[0] ?? null;

  summaryCard = {
    rows: [
      {
        left: { label: "Prestige", value: state.player.prestige.prestigeScore.toString() },
        right: { label: "Achievements", value: getPrestigeHeadline(state) },
      },
      {
        left: { label: "Best rank", value: records.bestRank ? `#${records.bestRank}` : "n/a" },
        right: { label: "Peak score", value: records.peakScore.toFixed(1) },
      },
      {
        left: { label: "Peak crowd", value: snapshot.guests > records.peakGuests ? formatCount(snapshot.guests) : formatCount(records.peakGuests) },
        right: { label: "Peak share", value: `${(records.peakPeopleShare * 100).toFixed(1)}%` },
      },
      {
        left: { label: "Peak equity", value: formatCompactMoney(records.peakEquityValue) },
        right: { label: "Peak profit", value: formatCompactMoney(records.peakMonthlyProfit) },
      },
      {
        left: { label: "Next unlock", value: trimText(nextGoal?.title ?? "All cleared", 20) },
        right: {
          label: "Next reward",
          value: trimText(nextGoal?.rewardPreview ?? "No pending rewards", 22),
        },
      },
      {
        left: { label: "Active rewards", value: getPrestigeRewardSummary(state) },
        right: { label: "Latest reward", value: trimText(state.player.prestige.lastRewardSummary ?? "None", 22) },
      },
    ],
  };

  const achievementList = window.findWidget("achievement-list") as ListViewWidget | null;
  if (achievementList) {
    achievementList.items =
      unlocked.length > 0
        ? unlocked.map((achievement) => [
            achievement.title,
            formatWhen(achievement.unlockedAtMonth, achievement.unlockedAtDayIndex),
            trimText(`${achievement.summary} | ${achievement.rewardSummary}`, 44),
          ])
        : [["No achievements unlocked yet.", "", "Keep the league running and your park growing."]];
  }

  const goalList = window.findWidget("goal-list") as ListViewWidget | null;
  if (goalList) {
    goalList.items =
      activeGoals.length > 0
        ? activeGoals.map((goal) => [
            goal.title,
            goal.progressLabel,
            trimText(goal.rewardPreview, 28),
            goal.category,
          ])
        : [["All current goals cleared.", "", "", "You have swept the current prestige ladder."]];
  }

  recordsPanel = {
    rows: [
      `Peak owner cash ${formatCompactMoney(records.peakMoney)} | Peak park ${formatCompactMoney(records.peakParkValue)}`,
      `Best guest boost x${records.bestGuestCapModifier.toFixed(2)} | Longest Top 10 ${records.longestTopTenStreak}m`,
      `Top spot streak ${records.longestRankOneStreak}m | Holdings peak ${records.peakPortfolioHoldings}`,
      `Spotlights ${records.totalSpotlightWins} | Featured ${records.totalFeaturedWins} | Buzz ${records.totalBuzzWins}`,
      `Yearly crowns ${records.totalYearlyAwards} | Mergers seen ${records.totalMergersWitnessed} | Bankruptcies ${records.totalBankruptciesWitnessed}`,
      `Portfolio peak ${formatCompactMoney(records.peakPortfolioValue)}`,
      `Rewards active ${state.player.prestige.activeRewards.length} | ${trimText(state.player.prestige.lastRewardSummary ?? "No recent reward", 32)}`,
    ],
  };

  rivalryPanel = {
    rows: [
      rivalrySummary
        ? `Head-to-head: ${trimText(formatHeadToHeadLine(rivalrySummary), 44)}`
        : "Head-to-head: still forming",
      localMarketSummary
        ? localMarketSummary.playerLeads
          ? `Local race: you lead the circuit with ${(localMarketSummary.playerShareOfCircuit * 100).toFixed(0)}% of circuit share.`
          : `Local race: ${localMarketSummary.leaderName} leads by ${(localMarketSummary.shareGapToLeader * 100).toFixed(1)}% people share.`
        : "Local race: the nearby circuit is still forming.",
      `Challenge: ${trimText(getActiveChallengeSummary(state), 44)}`,
      `Analyst: ${trimText(`${analystInsight.title} | ${analystInsight.summary}`, 44)}`,
      recap
        ? `Year recap ${recap.windowLabel}: winner ${trimText(recap.biggestWinner, 20)} | loser ${trimText(recap.biggestLoser, 20)}`
        : "Year recap: keep playing for a fuller season story.",
      recap
        ? `Best month ${trimText(recap.bestMonth, 22)} | Biggest jump ${trimText(recap.biggestJump, 22)}`
        : "Best month and jump will appear after more history has accumulated.",
      state.player.prestige.lastUnlockSummary
        ? `Latest unlock: ${trimText(state.player.prestige.lastUnlockSummary, 44)}`
        : "Latest unlock: none yet. Your first prestige beat is still ahead.",
    ],
  };

  setLabel(
    window,
    "achievement-detail",
    selectedAchievement
      ? `${selectedAchievement.title}: ${selectedAchievement.summary} Reward: ${selectedAchievement.rewardSummary} Unlocked ${formatWhen(selectedAchievement.unlockedAtMonth, selectedAchievement.unlockedAtDayIndex)}.`
      : "Achievements turn long league play into a visible story of everything your park has actually accomplished."
  );
  setLabel(
    window,
    "goal-detail",
    selectedGoal
      ? `${selectedGoal.title}: ${selectedGoal.description} Progress ${selectedGoal.progressLabel}. Reward: ${selectedGoal.rewardPreview}.`
      : "Active goals show the next clear prestige targets for your park."
  );
}

function setLabel(window: Window, name: string, text: string): void {
  const widget = window.findWidget(name) as LabelWidget | null;
  if (widget) {
    widget.text = text;
  }
}

function formatWhen(month: number, dayIndex: number): string {
  const day = (dayIndex % 31) + 1;
  return `M${month + 1} D${day}`;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
