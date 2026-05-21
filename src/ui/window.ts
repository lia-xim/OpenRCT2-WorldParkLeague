import {
  getInvestmentForRival,
  getInvestmentInfluenceLabel,
  getPortfolioRows,
} from "../domain/investments";
import {
  calculatePlayerEquityValue,
  calculatePlayerScoreBreakdown,
  getGovernanceDetailLine,
  getGovernanceSummaryLine,
  readPlayerSnapshot,
} from "../domain/player";
import { getActionDefinition, getPlayerActionSummary } from "../domain/playerActions";
import {
  buildPrestigeMilestones,
  buildYearlyRecap,
  summarizeMilestones,
} from "../domain/progression";
import { getPrestigeRewardSummary } from "../domain/prestige";
import {
  getActiveChallengeSummary,
  buildAnalystInsight,
  formatHeadToHeadLine,
  getPrimaryRivalSummary,
} from "../domain/rivalry";
import {
  getHistoryMetricValue,
  getHistoryMarkers,
  getHistorySeries,
  summarizeHistoryMetric,
} from "../domain/history";
import { clamp } from "../domain/math";
import { getArchetypeLabel, getStrategyLabel } from "../domain/rivals";
import {
  getFocusRivalGapLabel,
  getLocalMarketSummary,
  isFocusRival,
  isWatchedRival,
} from "../domain/watchlist";
import {
  buyInvestmentForRival,
  readState,
  resetState,
  runManualSimulation,
  sellInvestmentForRival,
  triggerDebugBreakoutBoost,
  triggerDebugFeaturedBoost,
  triggerDebugSpotlight,
  toggleWatchlistRivalById,
} from "../state/repository";
import {
  BREAKOUT_TITLE,
  FEATURED_TITLE,
  PLAYER_PARK_ID,
  PLUGIN_NAME,
  SPOTLIGHT_GUEST_MULTIPLIER,
  SPOTLIGHT_TITLE,
  WINDOW_CLASSIFICATION,
} from "../config";
import { openCapitalDeskWindow, refreshCapitalDeskWindow } from "./capitalDesk";
import { openPrestigeWindow, refreshPrestigeWindow } from "./prestigeWindow";
import { openWatchlistWindow, refreshWatchlistWindow } from "./watchlistWindow";
import {
  drawStatCard,
  drawTextPanel,
  type StatCardModel,
  type TextPanelModel,
} from "./statCard";
import { drawTrendChart, type TrendChartModel } from "./trendChart";
import type {
  HistoryMetricKey,
  LeaderboardEntry,
  ParkHistoryMarker,
  ParkHistoryPoint,
  PlayerSnapshot,
  RivalPark,
  WorldParkLeagueState,
} from "../types";

const WINDOW_WIDTH = 980;
const WINDOW_HEIGHT = 720;

type LeaderboardSortMode =
  | "score"
  | "trend"
  | "people_share"
  | "profit"
  | "value"
  | "money";
type LeaderboardViewMode = "league" | "finance";
type UiComplexityMode = "simple" | "advanced";

const LEADERBOARD_SORT_OPTIONS = [
  "League score",
  "Live form",
  "Crowd share",
  "Monthly result",
  "Park size",
  "Money",
] as const;
const LEADERBOARD_VIEW_OPTIONS = ["Overview", "Business"] as const;
const UI_MODE_OPTIONS = ["Simple", "Advanced"] as const;
const TREND_METRIC_OPTIONS = [
  "Score",
  "Live form",
  "Crowd share",
  "Park size",
  "Money",
  "Monthly result",
  "Rank",
] as const;
const TREND_RANGE_OPTIONS = ["7d", "30d", "Season", "Year", "All"] as const;
const TREND_VIEW_OPTIONS = ["Absolute", "Indexed"] as const;

let selectedParkId: string | null = PLAYER_PARK_ID;
let leaderboardRowIds: string[] = [];
let portfolioRowIds: string[] = [];
let selectedNewsIndex = 0;
let playerSummaryCard: StatCardModel = { rows: [] };
let leagueSummaryCard: StatCardModel = { rows: [] };
let selectedPanelModel: TextPanelModel = { rows: [] };
let trendChartModel: TrendChartModel = {
  metricLabel: "Score",
  summaryRows: [],
  series: [],
};
let spotlightBannerText = "";
let leaderboardSortMode: LeaderboardSortMode = "score";
let leaderboardViewMode: LeaderboardViewMode = "league";
let trendMetricMode: HistoryMetricKey = "score";
let trendHistoryLimit = 30;
let trendValueMode: "absolute" | "indexed" = "absolute";
let uiComplexityMode: UiComplexityMode = "simple";

function resetWindowSelectionState(): void {
  selectedParkId = PLAYER_PARK_ID;
  leaderboardRowIds = [];
  portfolioRowIds = [];
  selectedNewsIndex = 0;
}

function runWindowAction(scope: string, action: () => void): void {
  try {
    action();
  } catch (error) {
    console.log(`[${PLUGIN_NAME}] ${scope} failed: ${String(error)}`);
  }
}

export function refreshMainWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(WINDOW_CLASSIFICATION);
  if (!window || context.mode !== "normal") {
    return;
  }

  try {
    const snapshot = readPlayerSnapshot();
    updateWindowContents(readState(snapshot), snapshot);
  } catch (error) {
    console.log(`[${PLUGIN_NAME}] refreshMainWindow failed: ${String(error)}`);
  }
}

export function closeMainWindowIfOpen(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(WINDOW_CLASSIFICATION);
  if (window) {
    window.close();
  }

  resetWindowSelectionState();
}

export function openMainWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  try {
    const snapshot = readPlayerSnapshot();
    const state = readState(snapshot);
    const existing = ui.getWindow(WINDOW_CLASSIFICATION);
    if (existing) {
      existing.bringToFront();
      updateWindowContents(state, snapshot);
      return;
    }

    ui.openWindow({
      classification: WINDOW_CLASSIFICATION,
      title: PLUGIN_NAME,
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      minWidth: WINDOW_WIDTH,
      minHeight: WINDOW_HEIGHT,
      maxWidth: WINDOW_WIDTH,
      maxHeight: WINDOW_HEIGHT,
      onClose: () => {
        resetWindowSelectionState();
      },
      widgets: [
        { type: "groupbox", x: 8, y: 18, width: 472, height: 104, text: "Your Park" },
        {
          type: "custom",
          name: "player-card",
          x: 18,
          y: 34,
          width: 452,
          height: 78,
          onDraw(g) {
            drawStatCard(this, g, playerSummaryCard);
          },
        },
        { type: "groupbox", x: 488, y: 18, width: 484, height: 104, text: "World Snapshot" },
        {
          type: "custom",
          name: "league-card",
          x: 498,
          y: 34,
          width: 280,
          height: 78,
          onDraw(g) {
            drawStatCard(this, g, leagueSummaryCard);
          },
        },
        {
          type: "button",
          name: "capital-desk",
          x: 786,
          y: 34,
          width: 84,
          height: 16,
          text: "Management",
          onClick: () => {
            runWindowAction("capital-desk.click", () => openCapitalDeskWindow());
          },
        },
        {
          type: "button",
          name: "watchlist-window",
          x: 878,
          y: 34,
          width: 84,
          height: 16,
          text: "Watchlist",
          onClick: () => {
            runWindowAction("watchlist-window.click", () => openWatchlistWindow());
          },
        },
        {
          type: "button",
          name: "prestige-window",
          x: 878,
          y: 54,
          width: 84,
          height: 16,
          text: "Prestige",
          onClick: () => {
            runWindowAction("prestige-window.click", () => openPrestigeWindow());
          },
        },
        {
          type: "button",
          name: "debug-sim-month",
          x: 786,
          y: 54,
          width: 84,
          height: 16,
          text: "+1 Month",
          onClick: () => {
            runWindowAction("debug-sim-month.click", () => handleDebugAction("simulate"));
          },
        },
        {
          type: "button",
          name: "debug-reset",
          x: 878,
          y: 74,
          width: 84,
          height: 16,
          text: "Debug Reset",
          onClick: () => {
            runWindowAction("debug-reset.click", () => handleDebugAction("reset"));
          },
        },
        {
          type: "button",
          name: "debug-spotlight",
          x: 786,
          y: 74,
          width: 84,
          height: 16,
          text: "Spotlight",
          onClick: () => {
            runWindowAction("debug-spotlight.click", () => handleDebugAction("spotlight"));
          },
        },
        {
          type: "button",
          name: "debug-featured",
          x: 786,
          y: 94,
          width: 84,
          height: 16,
          text: "Featured",
          onClick: () => {
            runWindowAction("debug-featured.click", () => handleDebugAction("featured"));
          },
        },
        {
          type: "button",
          name: "debug-breakout",
          x: 878,
          y: 94,
          width: 84,
          height: 16,
          text: "Buzz",
          onClick: () => {
            runWindowAction("debug-breakout.click", () => handleDebugAction("breakout"));
          },
        },

        { type: "groupbox", x: 8, y: 128, width: 564, height: 390, text: "Park Rankings" },
        { type: "label", x: 18, y: 146, width: 34, height: 14, text: "Sort:" },
        {
          type: "dropdown",
          name: "leaderboard-sort",
          x: 54,
          y: 144,
          width: 116,
          height: 14,
          items: [...LEADERBOARD_SORT_OPTIONS],
          selectedIndex: 0,
          onChange: (index) => {
            runWindowAction("leaderboard-sort.change", () => {
              leaderboardSortMode = sortModeFromIndex(index);
              const freshSnapshot = readPlayerSnapshot();
              updateWindowContents(readState(freshSnapshot), freshSnapshot);
            });
          },
        },
        { type: "label", x: 184, y: 146, width: 34, height: 14, text: "View:" },
        {
          type: "dropdown",
          name: "leaderboard-view",
          x: 220,
          y: 144,
          width: 104,
          height: 14,
          items: [...LEADERBOARD_VIEW_OPTIONS],
          selectedIndex: 0,
          onChange: (index) => {
            runWindowAction("leaderboard-view.change", () => {
              leaderboardViewMode = viewModeFromIndex(index);
              const freshSnapshot = readPlayerSnapshot();
              updateWindowContents(readState(freshSnapshot), freshSnapshot);
            });
          },
        },
        { type: "label", x: 338, y: 146, width: 38, height: 14, text: "Mode:" },
        {
          type: "dropdown",
          name: "ui-mode",
          x: 378,
          y: 144,
          width: 96,
          height: 14,
          items: [...UI_MODE_OPTIONS],
          selectedIndex: 0,
          onChange: (index) => {
            runWindowAction("ui-mode.change", () => {
              uiComplexityMode = uiModeFromIndex(index);
              const freshSnapshot = readPlayerSnapshot();
              updateWindowContents(readState(freshSnapshot), freshSnapshot);
            });
          },
        },
        { type: "label", x: 478, y: 146, width: 84, height: 14, text: "Top boost above" },
        {
          type: "custom",
          name: "spotlight-banner",
          x: 18,
          y: 162,
          width: 544,
          height: 18,
          onDraw(g) {
            drawSpotlightBanner(this, g, spotlightBannerText);
          },
        },
        {
          type: "listview",
          name: "leaderboard-list",
          x: 18,
          y: 184,
          width: 544,
          height: 324,
          scrollbars: "both",
          isStriped: true,
          showColumnHeaders: true,
          canSelect: true,
          columns: [
            { header: "#", width: 24 },
            { header: "Park", width: 152 },
            { header: "Score", width: 54 },
            { header: "Trend", width: 60 },
            { header: "People", width: 56 },
            { header: "Profit", width: 76 },
            { header: "Value", width: 76 },
            { header: "Money", width: 76 },
            { header: "Status", width: 62 },
          ],
          items: [],
          onClick: (item) => {
            runWindowAction("leaderboard.click", () => {
              const parkId = leaderboardRowIds[item];
              if (!parkId) {
                return;
              }

              selectedParkId = parkId;
              const snapshot = readPlayerSnapshot();
              updateWindowContents(readState(snapshot), snapshot);
            });
          },
        },

        { type: "groupbox", x: 580, y: 128, width: 392, height: 182, text: "Park Snapshot" },
        {
          type: "custom",
          name: "selected-panel",
          x: 590,
          y: 146,
          width: 372,
          height: 116,
          onDraw(g) {
            drawTextPanel(this, g, selectedPanelModel);
          },
        },
        {
          type: "button",
          name: "watch-toggle",
          x: 860,
          y: 244,
          width: 102,
          height: 16,
          text: "Track rival",
          onClick: () => {
            runWindowAction("watch-toggle.click", () => handleWatchToggle());
          },
        },
        {
          type: "button",
          name: "buy-5",
          x: 590,
          y: 264,
          width: 82,
          height: 16,
          text: "Buy 5%",
          onClick: () => {
            runWindowAction("buy-5.click", () => handleInvestmentAction("buy", 0.05));
          },
        },
        {
          type: "button",
          name: "buy-10",
          x: 680,
          y: 264,
          width: 82,
          height: 16,
          text: "Buy 10%",
          onClick: () => {
            runWindowAction("buy-10.click", () => handleInvestmentAction("buy", 0.1));
          },
        },
        {
          type: "button",
          name: "buy-15",
          x: 770,
          y: 264,
          width: 82,
          height: 16,
          text: "Buy 15%",
          onClick: () => {
            runWindowAction("buy-15.click", () => handleInvestmentAction("buy", 0.15));
          },
        },
        {
          type: "button",
          name: "sell-5",
          x: 590,
          y: 284,
          width: 82,
          height: 16,
          text: "Sell 5%",
          onClick: () => {
            runWindowAction("sell-5.click", () => handleInvestmentAction("sell", 0.05));
          },
        },
        {
          type: "button",
          name: "sell-10",
          x: 680,
          y: 284,
          width: 82,
          height: 16,
          text: "Sell 10%",
          onClick: () => {
            runWindowAction("sell-10.click", () => handleInvestmentAction("sell", 0.1));
          },
        },
        {
          type: "button",
          name: "sell-all",
          x: 770,
          y: 284,
          width: 82,
          height: 16,
          text: "Exit stake",
          onClick: () => {
            runWindowAction("sell-all.click", () => handleInvestmentAction("sell"));
          },
        },
        { type: "label", name: "trade-hint", x: 860, y: 264, width: 102, height: 36, text: "" },

        { type: "groupbox", x: 580, y: 316, width: 392, height: 232, text: "Progress" },
        { type: "label", x: 590, y: 334, width: 42, height: 14, text: "Metric:" },
        {
          type: "dropdown",
          name: "trend-metric",
          x: 634,
          y: 332,
          width: 118,
          height: 14,
          items: [...TREND_METRIC_OPTIONS],
          selectedIndex: 0,
          onChange: (index) => {
            runWindowAction("trend-metric.change", () => {
              trendMetricMode = trendMetricFromIndex(index);
              const freshSnapshot = readPlayerSnapshot();
              updateWindowContents(readState(freshSnapshot), freshSnapshot);
            });
          },
        },
        { type: "label", x: 760, y: 334, width: 38, height: 14, text: "Range:" },
        {
          type: "dropdown",
          name: "trend-range",
          x: 800,
          y: 332,
          width: 62,
          height: 14,
          items: [...TREND_RANGE_OPTIONS],
          selectedIndex: 1,
          onChange: (index) => {
            runWindowAction("trend-range.change", () => {
              trendHistoryLimit = trendRangeFromIndex(index);
              const freshSnapshot = readPlayerSnapshot();
              updateWindowContents(readState(freshSnapshot), freshSnapshot);
            });
          },
        },
        { type: "label", x: 872, y: 334, width: 34, height: 14, text: "Mode:" },
        {
          type: "dropdown",
          name: "trend-view",
          x: 908,
          y: 332,
          width: 54,
          height: 14,
          items: [...TREND_VIEW_OPTIONS],
          selectedIndex: 0,
          onChange: (index) => {
            runWindowAction("trend-view.change", () => {
              trendValueMode = trendViewFromIndex(index);
              const freshSnapshot = readPlayerSnapshot();
              updateWindowContents(readState(freshSnapshot), freshSnapshot);
            });
          },
        },
        {
          type: "custom",
          name: "trend-chart",
          x: 590,
          y: 352,
          width: 372,
          height: 186,
          onDraw(g) {
            drawTrendChart(this, g, trendChartModel);
          },
        },

        { type: "groupbox", x: 8, y: 554, width: 564, height: 156, text: "Your Holdings" },
        {
          type: "listview",
          name: "portfolio-list",
          x: 18,
          y: 572,
          width: 544,
          height: 128,
          scrollbars: "vertical",
          isStriped: true,
          showColumnHeaders: true,
          canSelect: true,
          columns: [
            { header: "Park", width: 144 },
            { header: "Stake", width: 46 },
            { header: "Role", width: 78 },
            { header: "Cost", width: 80 },
            { header: "Value", width: 80 },
            { header: "Div", width: 76 },
          ],
          items: [],
          onClick: (item) => {
            runWindowAction("portfolio.click", () => {
              const rivalId = portfolioRowIds[item];
              if (!rivalId) {
                return;
              }

              selectedParkId = rivalId;
              const snapshot = readPlayerSnapshot();
              updateWindowContents(readState(snapshot), snapshot);
            });
          },
        },

        { type: "groupbox", x: 580, y: 554, width: 392, height: 156, text: "League Headlines" },
        {
          type: "listview",
          name: "news-list",
          x: 590,
          y: 572,
          width: 372,
          height: 128,
          scrollbars: "vertical",
          isStriped: true,
          showColumnHeaders: false,
          canSelect: true,
          columns: [{ header: "Headline", width: 352 }],
          items: [],
          onClick: (item) => {
            selectedNewsIndex = item;
          },
        },
      ],
    });

    updateWindowContents(state, snapshot);
  } catch (error) {
    console.log(`[${PLUGIN_NAME}] openMainWindow failed: ${String(error)}`);
    closeMainWindowIfOpen();
    throw error;
  }
}

function updateWindowContents(state: WorldParkLeagueState, snapshot: PlayerSnapshot): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(WINDOW_CLASSIFICATION);
  if (!window) {
    return;
  }

  try {
    const playerBreakdown = calculatePlayerScoreBreakdown(snapshot);
    const selectedEntry = getSelectedEntry(state);
    const selectedRival = getSelectedRival(state, selectedEntry);
    const comparisonEntry = getComparisonEntry(state, selectedEntry);

    renderSummary(window, state, snapshot, comparisonEntry);
    renderLeaderboard(window, state, snapshot);
    renderSelectedPanel(window, state, snapshot, playerBreakdown, selectedEntry, selectedRival, comparisonEntry);
    renderTrendPanel(
      window,
      state,
      selectedEntry,
      comparisonEntry
    );
    renderPortfolio(window, state);
    renderNews(window, state);
    updateTradeButtons(window, state, selectedRival);
    refreshCapitalDeskWindow();
    refreshWatchlistWindow();
    refreshPrestigeWindow();
  } catch (error) {
    console.log(`[${PLUGIN_NAME}] updateWindowContents failed: ${String(error)}`);
  }
}

function renderSummary(
  _window: Window,
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  comparisonEntry: LeaderboardEntry | null
): void {
  spotlightBannerText = buildSpotlightBannerText(state);
  const rank = state.player.currentRank ?? state.world.leaderboard.length;
  const scoreGap = comparisonEntry
    ? Math.max(0, comparisonEntry.score - state.player.score)
    : 0;
  const playerEquityValue = calculatePlayerEquityValue(snapshot);
  const totalMarketCap = calculateLeagueMarketCapitalization(state, snapshot);
  const localMarketSummary = getLocalMarketSummary(state);
  const nowFocus = buildNowFocusSummary(state, snapshot, comparisonEntry, localMarketSummary);
  const milestones = buildPrestigeMilestones(state, snapshot, localMarketSummary);
  const milestoneSummary = summarizeMilestones(milestones);
  const activeBoostSummary = getPlayerActiveBoostSummary(state);
  const activePrestigeRewardSummary = getPrestigeRewardSummary(state);
  const combinedBoostSummary =
    activePrestigeRewardSummary !== "None"
      ? `${activeBoostSummary === "None" ? "" : `${activeBoostSummary} | `}${activePrestigeRewardSummary}`
      : activeBoostSummary;

  if (uiComplexityMode === "simple") {
    playerSummaryCard = {
      rows: [
        {
          left: { label: "Rank", value: `${rank}/${state.world.leaderboard.length}` },
          right: { label: "Next rival", value: comparisonEntry?.parkName ?? "Top spot" },
        },
        {
          left: { label: "Crowd share", value: formatPercentText(state.player.marketShare) },
          right: { label: "Guest boost", value: `x${state.player.guestCapModifier.toFixed(3)}` },
        },
        {
          left: { label: "Cash", value: formatCompactMoney(snapshot.cash) },
          right: { label: "Monthly result", value: formatCompactMoney(snapshot.lastMonthOperatingProfit) },
        },
        {
          left: { label: "Boost", value: combinedBoostSummary },
          right: { label: "Prestige", value: `${state.player.prestige.prestigeScore} pts` },
        },
      ],
    };

    leagueSummaryCard = {
      rows: [
        {
          left: { label: "Park field", value: `${state.world.leaderboard.length} parks` },
          right: { label: "Guests in play", value: formatCompactCount(state.world.globalDemand) },
        },
        {
          left: { label: "World mood", value: describeMarketMood(state.world.economyIndex, state.world.tourismIndex) },
          right: { label: "Competition", value: describeCompetitionHeat(state.world.competitionHeat) },
        },
        {
          left: { label: "Market growth", value: `x${state.world.structuralGrowthIndex.toFixed(2)}` },
          right: { label: "Story beats", value: `${state.config.liveEventIntervalDays}d` },
        },
        {
          left: { label: "Daily update", value: `${state.config.livePulseIntervalDays}d` },
          right: { label: "League size", value: formatCompactMoney(totalMarketCap) },
        },
      ],
    };
    return;
  }

  playerSummaryCard = {
    rows: [
      {
        left: { label: "Rank", value: `${rank}/${state.world.leaderboard.length}` },
        right: { label: "Next gap", value: `${scoreGap.toFixed(1)} score` },
      },
      {
        left: { label: "People share", value: formatPercentText(state.player.marketShare) },
        right: { label: "Guest cap", value: `x${state.player.guestCapModifier.toFixed(3)}` },
      },
      {
        left: { label: "Money", value: formatCompactMoney(snapshot.cash) },
        right: { label: "Equity value", value: formatCompactMoney(playerEquityValue) },
      },
      {
        left: { label: "Boost", value: combinedBoostSummary },
        right: {
          label: "Prestige",
          value: `${state.player.prestige.prestigeScore} | ${milestoneSummary.completed}/${milestoneSummary.total}`,
        },
      },
    ],
  };

  leagueSummaryCard = {
    rows: [
      {
        left: { label: "League value", value: formatCompactMoney(totalMarketCap) },
        right: { label: "Demand", value: formatCompactCount(state.world.globalDemand) },
      },
      {
        left: { label: "Growth", value: `x${state.world.structuralGrowthIndex.toFixed(2)}` },
        right: { label: "Economy", value: state.world.economyIndex.toFixed(2) },
      },
      {
        right: { label: "Competition", value: state.world.competitionHeat.toFixed(2) },
        left: { label: "Capital mood", value: state.world.capitalMarketMood.toFixed(2) },
      },
      {
        left: { label: "Pulse", value: `${state.config.livePulseIntervalDays}d live` },
        right: { label: "Events", value: `${state.config.liveEventIntervalDays}d cycle | ${nowFocus.tag}` },
      },
    ],
  };
}

function renderLeaderboard(
  window: Window,
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): void {
  const widget = window.findWidget("leaderboard-list") as ListViewWidget | null;
  if (!widget) {
    return;
  }

  syncLeaderboardControls(window);

  const entries = sortLeaderboardEntries(state.world.leaderboard, state, snapshot);
  const columns = getLeaderboardColumns(leaderboardViewMode);
  widget.columns = columns.map((definition) => ({
    canSort: false,
    sortOrder: "none",
    header: definition.header,
    headerTooltip: "",
    width: definition.width,
    ratioWidth: 0,
    minWidth: definition.width,
    maxWidth: definition.width,
  }));

  leaderboardRowIds = entries.map((entry) => entry.parkId);
  widget.items = entries.map((entry) => [
    formatLeaderboardRankLabel(entry),
    formatLeaderboardParkLabel(entry),
    ...createLeaderboardRow(entry, state, snapshot, leaderboardViewMode),
  ]);

  if (!selectedParkId || !state.world.leaderboard.some((entry) => entry.parkId === selectedParkId)) {
    selectedParkId = PLAYER_PARK_ID;
  }
}

function renderSelectedPanel(
  _window: Window,
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  playerBreakdown: ReturnType<typeof calculatePlayerScoreBreakdown>,
  selectedEntry: LeaderboardEntry | null,
  selectedRival: RivalPark | null,
  comparisonEntry: LeaderboardEntry | null
): void {
  if (!selectedEntry) {
    selectedPanelModel = {
      caption: "No park selected.",
      rows: ["No active league data available."],
    };
    return;
  }

  const selectedTitle = selectedEntry.isPlayer
    ? `Your park: ${snapshot.parkName}`
    : `${selectedEntry.rank}. ${selectedEntry.parkName}`;

  const lines = selectedEntry.isPlayer
    ? buildPlayerDetailLines(state, snapshot, playerBreakdown, comparisonEntry)
    : buildRivalDetailLines(state, selectedEntry, selectedRival);
  selectedPanelModel = {
    caption: selectedTitle,
    rows: lines,
  };
}

function renderTrendPanel(
  _window: Window,
  state: WorldParkLeagueState,
  selectedEntry: LeaderboardEntry | null,
  comparisonEntry: LeaderboardEntry | null
): void {
  if (!selectedEntry) {
    trendChartModel = {
      metricLabel: getTrendMetricLabel(trendMetricMode, trendValueMode),
      summaryRows: [],
      series: [],
      emptyText: "No trend data available yet.",
    };
    return;
  }

  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer) ?? null;
  const benchmarkEntry = selectedEntry.isPlayer ? comparisonEntry : playerEntry;
  const selectedSeries = getHistorySeries(state, selectedEntry.parkId, trendHistoryLimit);
  const benchmarkSeries = benchmarkEntry
    ? getHistorySeries(state, benchmarkEntry.parkId, trendHistoryLimit)
    : [];
  const minVisibleDayIndex = Math.min(
    selectedSeries[0]?.dayIndex ?? Number.MAX_SAFE_INTEGER,
    benchmarkSeries[0]?.dayIndex ?? Number.MAX_SAFE_INTEGER
  );
  const selectedMarkers = getHistoryMarkers(
    state,
    selectedEntry.parkId,
    Number.isFinite(minVisibleDayIndex) ? minVisibleDayIndex : 0
  );
  const selectedSummary = summarizeHistoryMetric(selectedSeries, trendMetricMode);
  const benchmarkSummary = benchmarkSeries.length > 0
    ? summarizeHistoryMetric(benchmarkSeries, trendMetricMode)
    : null;
  const selectedLabel = selectedEntry.isPlayer ? "You" : trimText(selectedEntry.parkName, 18);
  const benchmarkLabel = benchmarkEntry
    ? benchmarkEntry.isPlayer
      ? "You"
      : trimText(benchmarkEntry.parkName, 18)
    : null;
  const selectedValues = projectTrendValues(selectedSeries, trendMetricMode, trendValueMode);
  const benchmarkValues = projectTrendValues(benchmarkSeries, trendMetricMode, trendValueMode);
  const latestMarker = selectedMarkers[selectedMarkers.length - 1] ?? null;

  trendChartModel = {
    caption: selectedEntry.isPlayer
      ? uiComplexityMode === "simple"
        ? "Your climb vs next rival"
        : "Your development vs next target"
      : uiComplexityMode === "simple"
        ? `${trimText(selectedEntry.parkName, 20)} vs you`
        : `${trimText(selectedEntry.parkName, 20)} vs your park`,
    metricLabel: `${getTrendMetricLabel(trendMetricMode, trendValueMode)} | ${buildTrendSpanLabel(
      selectedSeries,
      benchmarkSeries
    )}`,
    lowerIsBetter: trendMetricMode === "rank",
    emptyText: "Trend data will appear after a few daily pulses.",
    series: [
      {
        label: selectedLabel,
        values: selectedValues,
      },
      ...(benchmarkLabel
        ? [
            {
              label: benchmarkLabel,
              values: benchmarkValues,
            },
          ]
        : []),
    ],
    markers: buildTrendMarkers(selectedSeries, selectedMarkers),
    summaryRows: buildTrendSummaryRows(
      trendMetricMode,
      selectedLabel,
      selectedSummary,
      benchmarkLabel,
      benchmarkSummary,
      selectedSeries.length,
      benchmarkSeries.length,
      selectedEntry,
      benchmarkEntry,
      latestMarker,
      state
    ),
  };
}

function syncLeaderboardControls(window: Window): void {
  const sortWidget = window.findWidget("leaderboard-sort") as DropdownWidget | null;
  if (sortWidget) {
    sortWidget.selectedIndex = sortModeToIndex(leaderboardSortMode);
  }

  const viewWidget = window.findWidget("leaderboard-view") as DropdownWidget | null;
  if (viewWidget) {
    viewWidget.selectedIndex = viewModeToIndex(leaderboardViewMode);
  }

  const modeWidget = window.findWidget("ui-mode") as DropdownWidget | null;
  if (modeWidget) {
    modeWidget.selectedIndex = uiModeToIndex(uiComplexityMode);
  }

  const trendWidget = window.findWidget("trend-metric") as DropdownWidget | null;
  if (trendWidget) {
    trendWidget.selectedIndex = trendMetricToIndex(trendMetricMode);
  }

  const trendRangeWidget = window.findWidget("trend-range") as DropdownWidget | null;
  if (trendRangeWidget) {
    trendRangeWidget.selectedIndex = trendRangeToIndex(trendHistoryLimit);
  }

  const trendViewWidget = window.findWidget("trend-view") as DropdownWidget | null;
  if (trendViewWidget) {
    trendViewWidget.selectedIndex = trendViewToIndex(trendValueMode);
  }
}

function createLeaderboardRow(
  entry: LeaderboardEntry,
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  viewMode: LeaderboardViewMode
): string[] {
  if (uiComplexityMode === "simple" && viewMode === "finance") {
    return [
      formatListSignedCompactMoney(entry.monthlyProfit),
      formatCompactMoney(getEntryMoney(state, entry, snapshot)),
      formatCompactMoney(entry.companyValue),
      `${(entry.debtRatio * 100).toFixed(0)}%`,
      `${(entry.marketShare * 100).toFixed(1)}%`,
      simplifyStatusLabel(entry.statusLabel),
      getBoostShortLabel(entry.statusLabel),
      entry.score.toFixed(1),
    ];
  }

  if (uiComplexityMode === "simple") {
    return [
      entry.score.toFixed(1),
      formatListTrend(entry),
      `${(entry.marketShare * 100).toFixed(1)}%`,
      simplifyStatusLabel(entry.statusLabel),
      buildSimpleGapLabel(entry, state),
      getBoostShortLabel(entry.statusLabel),
      formatCompactMoney(entry.monthlyProfit),
      formatCompactMoney(getEntryMoney(state, entry, snapshot)),
    ];
  }

  if (viewMode === "finance") {
    return [
      formatListSignedCompactMoney(entry.monthlyProfit),
      formatCompactMoney(entry.companyValue),
      formatCompactMoney(getEntryMoney(state, entry, snapshot)),
      `${(entry.debtRatio * 100).toFixed(0)}%`,
      `${(entry.marketShare * 100).toFixed(1)}%`,
      entry.score.toFixed(1),
      entry.statusLabel,
    ];
  }

  return [
    entry.score.toFixed(1),
    formatListTrend(entry),
    `${(entry.marketShare * 100).toFixed(1)}%`,
    formatListSignedCompactMoney(entry.monthlyProfit),
    formatCompactMoney(entry.companyValue),
    formatCompactMoney(getEntryMoney(state, entry, snapshot)),
    entry.statusLabel,
  ];
}

function formatLeaderboardRankLabel(entry: LeaderboardEntry): string {
  const boostPrefix = getBoostMarker(entry.statusLabel);
  const label = entry.rank.toString();
  const decorated = boostPrefix ? `${boostPrefix} ${label}` : label;
  return entry.isPlayer ? `{YELLOW}${decorated}` : decorated;
}

function formatLeaderboardParkLabel(entry: LeaderboardEntry): string {
  const selectedPrefix = selectedParkId === entry.parkId ? ">> " : "";
  const playerPrefix = entry.isPlayer ? "[YOU] " : "";
  const boostTag = getBoostTag(entry.statusLabel);
  const rawName = trimText(
    `${boostTag ? `${boostTag} ` : ""}${playerPrefix}${entry.parkName}`,
    entry.isPlayer ? 18 : 22
  );
  const label = `${selectedPrefix}${rawName}`;
  return entry.isPlayer ? `{YELLOW}${label}` : label;
}

function sortLeaderboardEntries(
  entries: LeaderboardEntry[],
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): LeaderboardEntry[] {
  const sorted = [...entries];
  sorted.sort((left, right) => {
    const metricDelta = getSortMetric(right, state, snapshot) - getSortMetric(left, state, snapshot);
    if (Math.abs(metricDelta) > 0.000001) {
      return metricDelta;
    }

    return left.rank - right.rank;
  });
  return sorted;
}

function getSortMetric(
  entry: LeaderboardEntry,
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): number {
  switch (leaderboardSortMode) {
    case "trend":
      return entry.scoreDelta;
    case "people_share":
      return entry.marketShare;
    case "profit":
      return entry.monthlyProfit;
    case "value":
      return entry.companyValue;
    case "money":
      return getEntryMoney(state, entry, snapshot);
    case "score":
    default:
      return entry.score;
  }
}

function getLeaderboardColumns(
  viewMode: LeaderboardViewMode
): Array<{ header: string; width: number }> {
  if (uiComplexityMode === "simple" && viewMode === "finance") {
    return [
      { header: "#", width: 24 },
      { header: "Park", width: 172 },
      { header: "Monthly", width: 84 },
      { header: "Cash", width: 80 },
      { header: "Value", width: 80 },
      { header: "Debt", width: 46 },
      { header: "Crowd", width: 54 },
      { header: "Note", width: 70 },
      { header: "Boost", width: 58 },
      { header: "Score", width: 52 },
    ];
  }

  if (uiComplexityMode === "simple") {
    return [
      { header: "#", width: 24 },
      { header: "Park", width: 174 },
      { header: "Score", width: 58 },
      { header: "Form", width: 68 },
      { header: "Crowd", width: 58 },
      { header: "Note", width: 82 },
      { header: "Gap", width: 70 },
      { header: "Boost", width: 58 },
      { header: "Profit", width: 70 },
      { header: "Cash", width: 70 },
    ];
  }

  if (viewMode === "finance") {
    return [
      { header: "#", width: 24 },
      { header: "Park", width: 152 },
      { header: "Profit", width: 78 },
      { header: "Value", width: 78 },
      { header: "Money", width: 78 },
      { header: "Debt", width: 52 },
      { header: "People", width: 60 },
      { header: "Score", width: 54 },
      { header: "Status", width: 62 },
    ];
  }

  return [
    { header: "#", width: 24 },
    { header: "Park", width: 152 },
    { header: "Score", width: 54 },
    { header: "Trend", width: 62 },
    { header: "People", width: 60 },
    { header: "Profit", width: 78 },
    { header: "Value", width: 78 },
    { header: "Money", width: 78 },
    { header: "Status", width: 62 },
  ];
}

function sortModeFromIndex(index: number): LeaderboardSortMode {
  switch (index) {
    case 1:
      return "trend";
    case 2:
      return "people_share";
    case 3:
      return "profit";
    case 4:
      return "value";
    case 5:
      return "money";
    case 0:
    default:
      return "score";
  }
}

function sortModeToIndex(mode: LeaderboardSortMode): number {
  switch (mode) {
    case "trend":
      return 1;
    case "people_share":
      return 2;
    case "profit":
      return 3;
    case "value":
      return 4;
    case "money":
      return 5;
    case "score":
    default:
      return 0;
  }
}

function viewModeFromIndex(index: number): LeaderboardViewMode {
  return index === 1 ? "finance" : "league";
}

function viewModeToIndex(mode: LeaderboardViewMode): number {
  return mode === "finance" ? 1 : 0;
}

function uiModeFromIndex(index: number): UiComplexityMode {
  return index === 1 ? "advanced" : "simple";
}

function uiModeToIndex(mode: UiComplexityMode): number {
  return mode === "advanced" ? 1 : 0;
}

function trendMetricFromIndex(index: number): HistoryMetricKey {
  switch (index) {
    case 1:
      return "momentum";
    case 2:
      return "marketShare";
    case 3:
      return "companyValue";
    case 4:
      return "money";
    case 5:
      return "monthlyProfit";
    case 6:
      return "rank";
    case 0:
    default:
      return "score";
  }
}

function trendMetricToIndex(metric: HistoryMetricKey): number {
  switch (metric) {
    case "momentum":
      return 1;
    case "marketShare":
      return 2;
    case "companyValue":
      return 3;
    case "money":
      return 4;
    case "monthlyProfit":
      return 5;
    case "rank":
      return 6;
    case "score":
    default:
      return 0;
  }
}

function trendRangeFromIndex(index: number): number {
  switch (index) {
    case 0:
      return 7;
    case 1:
      return 30;
    case 2:
      return 62;
    case 3:
      return 248;
    case 4:
      return 9_999;
    default:
      return 30;
  }
}

function trendRangeToIndex(value: number): number {
  switch (value) {
    case 7:
      return 0;
    case 30:
      return 1;
    case 62:
      return 2;
    case 248:
      return 3;
    case 9_999:
      return 4;
    default:
      return 1;
  }
}

function trendViewFromIndex(index: number): "absolute" | "indexed" {
  return index === 1 ? "indexed" : "absolute";
}

function trendViewToIndex(mode: "absolute" | "indexed"): number {
  return mode === "indexed" ? 1 : 0;
}

function renderPortfolio(window: Window, state: WorldParkLeagueState): void {
  const widget = window.findWidget("portfolio-list") as ListViewWidget | null;
  if (!widget) {
    return;
  }

  portfolioRowIds = state.player.investments.map((investment) => investment.rivalId);
  widget.items = getPortfolioRows(state).map((row, index) => [
    `${portfolioRowIds[index] === selectedParkId ? "> " : ""}${row[0] ?? ""}`,
    row[1] ?? "",
    row[2] ?? "",
    row[3] ?? "",
    row[4] ?? "",
    row[5] ?? "",
  ]);
}

function renderNews(window: Window, state: WorldParkLeagueState): void {
  const widget = window.findWidget("news-list") as ListViewWidget | null;
  if (!widget) {
    return;
  }

  const items = state.world.newsFeed.map((item) =>
    `M${item.month} | ${item.category.toUpperCase()} | ${trimText(item.headline, 44)}`
  );
  widget.items = items.length > 0 ? items : ["No league news yet."];
  selectedNewsIndex = Math.max(0, Math.min(selectedNewsIndex, items.length - 1));
}

function updateTradeButtons(
  window: Window,
  state: WorldParkLeagueState,
  selectedRival: RivalPark | null
): void {
  const investment = getInvestmentForRival(state, selectedRival?.id ?? null);
  const heldShare = investment?.share ?? 0;
  const canBuy = !!selectedRival?.status.active;

  setButtonDisabled(window, "buy-5", !canBuy || heldShare > 0.20);
  setButtonDisabled(window, "buy-10", !canBuy || heldShare > 0.15);
  setButtonDisabled(window, "buy-15", !canBuy || heldShare > 0.10);
  setButtonDisabled(window, "sell-5", !investment || heldShare < 0.05);
  setButtonDisabled(window, "sell-10", !investment || heldShare < 0.10);
  setButtonDisabled(window, "sell-all", !investment);
  setButtonDisabled(window, "watch-toggle", !selectedRival);

  if (!selectedRival) {
    setButtonText(window, "watch-toggle", "Track rival");
    setLabel(window, "trade-hint", "Select rival");
    return;
  }

  setButtonText(
    window,
    "watch-toggle",
    isWatchedRival(state, selectedRival.id) ? "Unwatch" : "Track rival"
  );

  setLabel(
    window,
    "trade-hint",
    `${isFocusRival(state, selectedRival.id) ? "Local rival" : "Global rival"} | ${
      investment
        ? `Held ${(investment.share * 100).toFixed(0)}%`
        : "No holding"
    }`
  );
}

function handleInvestmentAction(mode: "buy" | "sell", share?: number): void {
  if (typeof ui === "undefined") {
    return;
  }

  try {
    const rivalId = selectedParkId;
    if (!rivalId || rivalId === PLAYER_PARK_ID) {
      ui.showError(PLUGIN_NAME, "Select a rival first.");
      return;
    }

    const snapshot = readPlayerSnapshot();
    const result =
      mode === "buy"
        ? buyInvestmentForRival(rivalId, snapshot, share)
        : sellInvestmentForRival(rivalId, snapshot, share);

    if (!result.ok) {
      ui.showError(PLUGIN_NAME, result.message);
      return;
    }

    park.postMessage(`[World Park League] ${result.message}`);
    updateWindowContents(result.state, readPlayerSnapshot());
    refreshCapitalDeskWindow();
    refreshWatchlistWindow();
  } catch (error) {
    console.log(`[${PLUGIN_NAME}] handleInvestmentAction failed: ${String(error)}`);
    ui.showError(PLUGIN_NAME, "The trade could not be completed safely.");
  }
}

function handleWatchToggle(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const rivalId = selectedParkId;
  if (!rivalId || rivalId === PLAYER_PARK_ID) {
    ui.showError(PLUGIN_NAME, "Select a rival first.");
    return;
  }

  const snapshot = readPlayerSnapshot();
  const result = toggleWatchlistRivalById(rivalId, snapshot);
  if (!result.ok) {
    ui.showError(PLUGIN_NAME, result.message);
    return;
  }

  park.postMessage(`[World Park League] ${result.message}`);
  updateWindowContents(result.state, readPlayerSnapshot());
  refreshWatchlistWindow();
}

function handleDebugAction(
  mode: "simulate" | "reset" | "spotlight" | "featured" | "breakout"
): void {
  if (typeof ui === "undefined") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  if (mode === "spotlight") {
    const result = triggerDebugSpotlight(snapshot);
    park.postMessage(`[World Park League] ${result.message}`);
    updateWindowContents(result.state, readPlayerSnapshot());
    refreshCapitalDeskWindow();
    refreshWatchlistWindow();
    return;
  }

  if (mode === "featured") {
    const result = triggerDebugFeaturedBoost(snapshot);
    park.postMessage(`[World Park League] ${result.message}`);
    updateWindowContents(result.state, readPlayerSnapshot());
    refreshCapitalDeskWindow();
    refreshWatchlistWindow();
    return;
  }

  if (mode === "breakout") {
    const result = triggerDebugBreakoutBoost(snapshot);
    park.postMessage(`[World Park League] ${result.message}`);
    updateWindowContents(result.state, readPlayerSnapshot());
    refreshCapitalDeskWindow();
    refreshWatchlistWindow();
    return;
  }

  if (mode === "simulate") {
    const result = runManualSimulation(snapshot);
    park.postMessage(`[World Park League] Debug simulation advanced to month ${result.month}.`);
    updateWindowContents(result.nextState, readPlayerSnapshot());
    refreshCapitalDeskWindow();
    refreshWatchlistWindow();
    return;
  }

  const freshState = resetState(snapshot);
  selectedParkId = PLAYER_PARK_ID;
  park.postMessage("[World Park League] Debug reset cleared the league state.");
  updateWindowContents(freshState, readPlayerSnapshot());
  refreshCapitalDeskWindow();
  refreshWatchlistWindow();
}

function buildPlayerDetailLines(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  playerBreakdown: ReturnType<typeof calculatePlayerScoreBreakdown>,
  comparisonEntry: LeaderboardEntry | null
): string[] {
  const playerEquityValue = calculatePlayerEquityValue(snapshot);
  const localMarketSummary = getLocalMarketSummary(state);
  const rivalrySummary = getPrimaryRivalSummary(state, comparisonEntry?.parkId ?? null);
  const analystInsight = buildAnalystInsight(state, snapshot, rivalrySummary);
  const watchlistSummary =
    state.player.watchlist.lastAlertSummary ??
    `${state.player.watchlist.watchedRivalIds.length} tracked rival(s) active.`;
  const nowFocus = buildNowFocusSummary(state, snapshot, comparisonEntry, localMarketSummary);
  const scoreDrivers = buildScoreDriverSummary(playerBreakdown);
  const milestones = buildPrestigeMilestones(state, snapshot, localMarketSummary);
  const recap = buildYearlyRecap(state, comparisonEntry);
  const milestoneLine = buildMilestoneLine(milestones);
  const challengeLine = getActiveChallengeSummary(state);
  const explanationLine = buildPlayerExplanationLine(
    state,
    snapshot,
    comparisonEntry,
    playerBreakdown,
    localMarketSummary
  );
  const recapLine = recap
    ? `Recap ${recap.windowLabel}: Winner ${trimText(recap.biggestWinner, 18)} | Loser ${trimText(recap.biggestLoser, 18)} | Rival ${trimText(recap.mainRival, 16)} | Best ${trimText(recap.bestMonth, 14)} | Jump ${trimText(recap.biggestJump, 16)}`
    : "Recap: keep the league running for a fuller year to unlock a richer story summary.";

  if (uiComplexityMode === "simple") {
    return [
      `You are rank ${state.player.currentRank ?? "-"} of ${state.world.leaderboard.length}.${comparisonEntry ? ` Next target: ${comparisonEntry.parkName}.` : ""}`,
      `Crowd share: ${(state.player.marketShare * 100).toFixed(1)}%   Guest boost: x${state.player.guestCapModifier.toFixed(3)}   Form: ${describeMomentumBand(state.player.liveMomentum)}`,
      `Guests: ${snapshot.guests.toLocaleString("en-US")}   Park rating: ${snapshot.parkRating}   Open rides: ${snapshot.openRideCount}/${snapshot.totalRideCount}`,
      `Monthly result: ${formatSignedMoney(snapshot.lastMonthOperatingProfit)}   Cash: ${formatMoney(snapshot.cash)}   Equity: ${formatMoney(playerEquityValue)}`,
      `Why: ${trimText(explanationLine, 82)}`,
      `Goals: ${trimText(milestoneLine, 82)}`,
      `Rivalry: ${trimText(formatHeadToHeadLine(rivalrySummary), 82)}`,
      `Challenge: ${trimText(challengeLine, 82)}`,
      `Analyst: ${trimText(`${analystInsight.title} | ${analystInsight.summary}`, 82)}${watchlistSummary ? ` | ${trimText(watchlistSummary, 14)}` : ""}`,
    ];
  }

  return [
    `Rank: ${state.player.currentRank ?? "-"} of ${state.world.leaderboard.length}   Score: ${state.player.score.toFixed(1)} (${formatDecoratedCompactDelta(state.player.score - state.player.previousScore)})`,
    `Guests: ${snapshot.guests.toLocaleString("en-US")}   Rating: ${snapshot.parkRating}   Share: ${(state.player.marketShare * 100).toFixed(1)}%   Live form: ${describeMomentumBand(state.player.liveMomentum)}`,
    `Monthly profit/loss: ${formatSignedMoney(snapshot.lastMonthOperatingProfit)}   Revenue: ${formatMoney(snapshot.lastMonthRevenue)}   Money: ${formatMoney(snapshot.cash)}`,
    `Equity value: ${formatMoney(playerEquityValue)}   Loan: ${formatMoney(snapshot.bankLoan)}   Open rides: ${snapshot.openRideCount}/${snapshot.totalRideCount}`,
    `Why: ${trimText(explanationLine, 106)}`,
    `Milestones: ${trimText(milestoneLine, 58)}   Drivers: ${trimText(scoreDrivers, 34)}`,
    `Rivalry: ${trimText(formatHeadToHeadLine(rivalrySummary), 106)}`,
    `Challenge: ${trimText(challengeLine, 104)}`,
    `Analyst: ${trimText(`${analystInsight.title} | ${analystInsight.summary}`, 104)}`,
    `Yearly recap: ${trimText(recapLine, 42)}   Right now: ${trimText(nowFocus.tag, 14)}   Alert: ${trimText(watchlistSummary, 14)}`,
  ];
}

function buildRivalDetailLines(
  state: WorldParkLeagueState,
  selectedEntry: LeaderboardEntry,
  selectedRival: RivalPark | null
): string[] {
  if (!selectedRival) {
    return [
      "This park is not active in the current field.",
      `Status ${selectedEntry.statusLabel}`,
    ];
  }

  const region = state.world.regionMarkets[selectedRival.region];
  const investment = getInvestmentForRival(state, selectedRival.id);
  const watched = isWatchedRival(state, selectedRival.id);
  const localRival = isFocusRival(state, selectedRival.id);
  const rivalrySummary = getPrimaryRivalSummary(state, selectedRival.id);
  const activeChallenge = state.player.rivalry.activeChallenge;
  const challengeLine =
    activeChallenge && activeChallenge.rivalId === selectedRival.id
      ? `Live challenge: ${activeChallenge.title} | reward ${formatMoney(activeChallenge.rewardCash)}`
      : `Rival challenge: ${trimText(state.player.rivalry.lastChallengeSummary ?? "No direct duel right now.", 62)}`;

  if (uiComplexityMode === "simple") {
    return [
      `${localRival ? "Local rival" : watched ? "Tracked rival" : "Global rival"}   ${getArchetypeLabel(selectedRival.archetype)}   ${getStrategyLabel(selectedRival.status.strategyFocus)}`,
      `Rank ${selectedEntry.rank}   Score ${selectedEntry.score.toFixed(1)}   Form ${describeMomentumBand(selectedRival.momentum)}`,
      `Crowd share ${(selectedEntry.marketShare * 100).toFixed(1)}%   Guests ${selectedEntry.monthlyVisitors.toLocaleString("en-US")}   Risk ${selectedRival.risk.toFixed(0)}`,
      `Monthly result ${formatSignedMoney(selectedRival.finance.monthlyProfit)}   Cash ${formatMoney(selectedRival.finance.cashReserve)}`,
      investment
        ? `Your stake: ${(investment.share * 100).toFixed(0)}%   Role: ${getInvestmentInfluenceLabel(investment.share)}`
        : `Track: ${watched ? "On" : "Off"}   Local circuit: ${localRival ? getFocusRivalGapLabel(state, selectedRival.id) : "No"}`,
      `Head-to-head: ${trimText(formatHeadToHeadLine(rivalrySummary), 74)}`,
      challengeLine,
      `${selectedRival.status.lastHeadline ?? `${selectedRival.name} is competing in ${selectedEntry.regionLabel}.`}`,
    ];
  }

  return [
    `Rank: ${selectedEntry.rank}   Score: ${selectedEntry.score.toFixed(1)} (${formatDecoratedCompactDelta(selectedEntry.scoreDelta)})`,
    `People share: ${(selectedEntry.marketShare * 100).toFixed(1)}%   Status: ${selectedEntry.statusLabel}   Live form: ${describeMomentumBand(selectedRival.momentum)}`,
    `Monthly profit/loss: ${formatSignedMoney(selectedRival.finance.monthlyProfit)}   Revenue: ${formatMoney(selectedRival.finance.monthlyRevenue)}`,
    `Market cap: ${formatMoney(selectedRival.finance.companyValue)}   Money: ${formatMoney(selectedRival.finance.cashReserve)}   Visitors: ${selectedEntry.monthlyVisitors.toLocaleString("en-US")}`,
    `Identity: ${getArchetypeLabel(selectedRival.archetype)}   Strategy: ${getStrategyLabel(selectedRival.status.strategyFocus)}   Debt: ${(selectedEntry.debtRatio * 100).toFixed(1)}%`,
    `Head-to-head: ${trimText(formatHeadToHeadLine(rivalrySummary), 102)}`,
    `Challenge: ${trimText(challengeLine, 102)}`,
    investment
      ? `Local rival: ${localRival ? `Yes (${getFocusRivalGapLabel(state, selectedRival.id)})` : "No"}   Watch: ${watched ? "On" : "Off"}   Holding: ${(investment.share * 100).toFixed(0)}% ${getInvestmentInfluenceLabel(investment.share)}`
      : `Region: ${selectedEntry.regionLabel}   Local rival: ${localRival ? `Yes (${getFocusRivalGapLabel(state, selectedRival.id)})` : "No"}   Watch: ${watched ? "On" : "Off"}   Risk: ${selectedRival.risk.toFixed(0)}`,
  ];
}

function getSelectedEntry(state: WorldParkLeagueState): LeaderboardEntry | null {
  if (state.world.leaderboard.length === 0) {
    return null;
  }

  const selected = state.world.leaderboard.find((entry) => entry.parkId === selectedParkId);
  if (selected) {
    return selected;
  }

  const playerEntry = state.world.leaderboard.find((entry) => entry.parkId === PLAYER_PARK_ID) ?? null;
  selectedParkId = playerEntry?.parkId ?? state.world.leaderboard[0]?.parkId ?? null;
  return playerEntry ?? state.world.leaderboard[0] ?? null;
}

function getSelectedRival(
  state: WorldParkLeagueState,
  entry: LeaderboardEntry | null
): RivalPark | null {
  if (!entry || entry.isPlayer) {
    return null;
  }

  return state.world.rivals.find((rival) => rival.id === entry.parkId) ?? null;
}

function getComparisonEntry(
  state: WorldParkLeagueState,
  selectedEntry: LeaderboardEntry | null
): LeaderboardEntry | null {
  if (!selectedEntry) {
    return null;
  }

  if (!selectedEntry.isPlayer) {
    return selectedEntry;
  }

  const currentRank = state.player.currentRank ?? selectedEntry.rank;
  const nextHigher = state.world.leaderboard.find((entry) => !entry.isPlayer && entry.rank === currentRank - 1);
  if (nextHigher) {
    return nextHigher;
  }

  return state.world.leaderboard.find((entry) => !entry.isPlayer) ?? null;
}

function buildTrendSummaryRows(
  metric: HistoryMetricKey,
  selectedLabel: string,
  selectedSummary: ReturnType<typeof summarizeHistoryMetric>,
  benchmarkLabel: string | null,
  benchmarkSummary: ReturnType<typeof summarizeHistoryMetric>,
  selectedPoints: number,
  benchmarkPoints: number,
  selectedEntry: LeaderboardEntry,
  benchmarkEntry: LeaderboardEntry | null,
  latestMarker: { label: string; month: number } | null,
  state: WorldParkLeagueState
): string[] {
  const rows: string[] = [];

  if (selectedSummary) {
    rows.push(
      `${selectedLabel}: ${formatTrendMetric(metric, selectedSummary.current)} (${formatTrendDelta(
        metric,
        selectedSummary.delta
      )})`
    );
  }

  if (selectedSummary && benchmarkLabel && benchmarkSummary) {
    rows.push(
      `${benchmarkLabel}: ${formatTrendMetric(
        metric,
        benchmarkSummary.current
      )} (${formatTrendDelta(metric, benchmarkSummary.delta)})`
    );

    rows.push(
      buildActionableCompareLine(
        metric,
        selectedLabel,
        benchmarkLabel,
        selectedEntry,
        benchmarkEntry,
        selectedSummary,
        benchmarkSummary,
        state
      )
    );
    rows.push(
      buildTrendWindowStatsLine(
        metric,
        selectedLabel,
        selectedSummary,
        benchmarkLabel,
        benchmarkSummary,
        selectedPoints,
        benchmarkPoints,
        latestMarker
      )
    );
    return rows;
  }

  if (selectedSummary) {
    rows.push(
      `Range: ${formatTrendMetric(metric, selectedSummary.min)} to ${formatTrendMetric(
        metric,
        selectedSummary.max
      )}`
    );
    rows.push(`Window: ${selectedPoints} data points`);
    if (latestMarker) {
      rows.push(`Latest event: M${latestMarker.month + 1} | ${trimText(latestMarker.label, 44)}`);
    }
    return rows;
  }

  rows.push(`Window: ${Math.max(selectedPoints, benchmarkPoints)} data points`);
  rows.push("Trend data will fill in as the league keeps running.");
  return rows;
}

function buildTrendWindowStatsLine(
  metric: HistoryMetricKey,
  selectedLabel: string,
  selectedSummary: NonNullable<ReturnType<typeof summarizeHistoryMetric>>,
  benchmarkLabel: string | null,
  benchmarkSummary: NonNullable<ReturnType<typeof summarizeHistoryMetric>> | null,
  selectedPoints: number,
  benchmarkPoints: number,
  latestMarker: { label: string; month: number } | null
): string {
  const selectedPeak = `${selectedLabel} peak ${formatTrendMetric(metric, selectedSummary.max)}`;
  const benchmarkPeak =
    benchmarkLabel && benchmarkSummary
      ? `${benchmarkLabel} peak ${formatTrendMetric(metric, benchmarkSummary.max)}`
      : `Window ${Math.max(selectedPoints, benchmarkPoints)} pts`;

  if (latestMarker) {
    return `${selectedPeak} | ${benchmarkPeak} | Event M${latestMarker.month + 1}: ${trimText(
      latestMarker.label,
      24
    )}`;
  }

  return `${selectedPeak} | ${benchmarkPeak} | Window ${Math.max(
    selectedPoints,
    benchmarkPoints
  )} pts`;
}

function buildActionableCompareLine(
  metric: HistoryMetricKey,
  selectedLabel: string,
  benchmarkLabel: string,
  selectedEntry: LeaderboardEntry,
  benchmarkEntry: LeaderboardEntry | null,
  selectedSummary: NonNullable<ReturnType<typeof summarizeHistoryMetric>>,
  benchmarkSummary: NonNullable<ReturnType<typeof summarizeHistoryMetric>>,
  state: WorldParkLeagueState
): string {
  if (!benchmarkEntry) {
    return `Range: ${formatTrendMetric(metric, selectedSummary.min)} to ${formatTrendMetric(
      metric,
      selectedSummary.max
    )}`;
  }

  if (metric === "rank") {
    const rankGap = benchmarkSummary.current - selectedSummary.current;
    if (Math.abs(rankGap) < 0.5) {
      return "Rank gap: tied";
    }

    return rankGap > 0
      ? `Rank gap: ${Math.round(rankGap)} place(s) ahead`
      : `Rank gap: ${Math.round(Math.abs(rankGap))} place(s) behind`;
  }

  const gap = selectedSummary.current - benchmarkSummary.current;
  if (selectedEntry.isPlayer) {
    return `To catch ${benchmarkLabel}: ${buildCatchUpSuggestion(state, benchmarkEntry)} | ${formatTrendGap(
      metric,
      gap
    )} on this metric`;
  }

  return `${selectedLabel} vs ${benchmarkLabel}: ${formatTrendGap(metric, gap)} | ${describeScorePressure(
    state,
    selectedEntry
  )}`;
}

function getTrendMetricLabel(
  metric: HistoryMetricKey,
  viewMode: "absolute" | "indexed"
): string {
  const suffix = viewMode === "indexed" && metric !== "rank" ? " (start=100)" : "";
  switch (metric) {
    case "momentum":
      return `Live form${suffix}`;
    case "marketShare":
      return `People share${suffix}`;
    case "companyValue":
      return `Park value${suffix}`;
    case "monthlyProfit":
      return `Monthly profit${suffix}`;
    case "money":
      return `Money${suffix}`;
    case "rank":
      return "Rank";
    case "score":
    default:
      return `League score${suffix}`;
  }
}

function buildTrendSpanLabel(
  selectedSeries: Array<{ month: number; dayIndex: number }>,
  benchmarkSeries: Array<{ month: number; dayIndex: number }>
): string {
  const allPoints = [...selectedSeries, ...benchmarkSeries];
  if (allPoints.length === 0) {
    return "Waiting for data";
  }

  const dayIndexes = allPoints.map((point) => point.dayIndex);
  const daySpan = Math.max(...dayIndexes) - Math.min(...dayIndexes);
  if (daySpan <= 7) {
    return "7d view";
  }
  if (daySpan <= 31) {
    return "30d view";
  }
  if (daySpan <= 62) {
    return "Season view";
  }
  if (daySpan <= 248) {
    return "Year view";
  }

  const months = allPoints.map((point) => point.month);
  const first = Math.min(...months);
  const last = Math.max(...months);
  return first === last ? `Month ${first + 1}` : `Months ${first + 1}-${last + 1}`;
}

function projectTrendValues(
  series: ParkHistoryPoint[],
  metric: HistoryMetricKey,
  viewMode: "absolute" | "indexed"
): number[] {
  const values = series.map((point) => getHistoryMetricValue(point, metric));
  if (viewMode !== "indexed" || metric === "rank" || values.length === 0) {
    return values;
  }

  const base = values[0] ?? 0;
  const scaleBase =
    metric === "marketShare"
      ? Math.max(0.005, Math.abs(base))
      : metric === "score" || metric === "momentum"
        ? Math.max(1, Math.abs(base))
        : Math.max(10, Math.abs(base));
  return values.map((value) => 100 + ((value - base) / scaleBase) * 100);
}

function buildTrendMarkers(
  series: ParkHistoryPoint[],
  markers: ParkHistoryMarker[]
): Array<{ position: number; label: string; severity: "info" | "success" | "warning" }> {
  if (series.length <= 1) {
    return [];
  }

  const minDay = series[0]?.dayIndex ?? 0;
  const maxDay = series[series.length - 1]?.dayIndex ?? minDay;
  const dayRange = Math.max(1, maxDay - minDay);

  return markers
    .filter((marker) => marker.dayIndex >= minDay && marker.dayIndex <= maxDay)
    .slice(-8)
    .map((marker) => ({
      position: (marker.dayIndex - minDay) / dayRange,
      label: marker.label,
      severity: marker.severity,
    }));
}

function buildCatchUpSuggestion(
  state: WorldParkLeagueState,
  benchmarkEntry: LeaderboardEntry
): string {
  const scoreGap = Math.max(0, benchmarkEntry.score - state.player.score);
  const shareGap = Math.max(0, benchmarkEntry.marketShare - state.player.marketShare);
  const profitGap = Math.max(0, benchmarkEntry.monthlyProfit - (state.world.leaderboard.find((entry) => entry.isPlayer)?.monthlyProfit ?? 0));
  return `Need +${scoreGap.toFixed(1)} score | +${(shareGap * 100).toFixed(1)}% people | +${formatCompactMoney(
    profitGap
  )} profit`;
}

function describeScorePressure(
  state: WorldParkLeagueState,
  selectedEntry: LeaderboardEntry
): string {
  const scoreGap = selectedEntry.score - state.player.score;
  if (scoreGap > 0) {
    return `${selectedEntry.parkName} is ahead by ${scoreGap.toFixed(1)} score`;
  }

  return `You lead by ${Math.abs(scoreGap).toFixed(1)} score`;
}

function getSelectedQualityMetric(
  selectedEntry: LeaderboardEntry,
  selectedRival: RivalPark | null
): number {
  if (selectedEntry.isPlayer) {
    return 0;
  }

  if (!selectedRival) {
    return 0;
  }

  return clamp(selectedRival.stats.guestAppeal * 0.55 + selectedRival.stats.operations * 0.45, 0, 100);
}

function calculateLeagueMarketCapitalization(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): number {
  return Math.round(
    calculatePlayerEquityValue(snapshot) +
      state.world.rivals
        .filter((rival) => rival.status.active)
        .reduce((total, rival) => total + rival.finance.companyValue, 0)
  );
}

function getEntryMoney(
  state: WorldParkLeagueState,
  entry: LeaderboardEntry,
  snapshot: PlayerSnapshot
): number {
  if (entry.isPlayer) {
    return snapshot.cash;
  }

  return state.world.rivals.find((rival) => rival.id === entry.parkId)?.finance.cashReserve ?? 0;
}

function setLabel(window: Window, widgetName: string, text: string): void {
  const widget = window.findWidget(widgetName) as LabelWidget | null;
  if (widget) {
    widget.text = text;
  }
}

function setLabelSeries(
  window: Window,
  prefix: string,
  lines: string[],
  count: number
): void {
  for (let index = 0; index < count; index += 1) {
    setLabel(window, `${prefix}${index + 1}`, trimText(lines[index] ?? "", 58));
  }
}

function setButtonDisabled(window: Window, widgetName: string, isDisabled: boolean): void {
  const widget = window.findWidget(widgetName) as ButtonWidget | null;
  if (widget) {
    widget.isDisabled = isDisabled;
  }
}

function setButtonText(window: Window, widgetName: string, text: string): void {
  const widget = window.findWidget(widgetName) as ButtonWidget | null;
  if (widget) {
    widget.text = text;
  }
}

function formatTrendMetric(metric: HistoryMetricKey, value: number): string {
  switch (metric) {
    case "momentum":
      return value.toFixed(1);
    case "marketShare":
      return formatPercentText(value);
    case "companyValue":
    case "monthlyProfit":
    case "money":
      return formatCompactMoney(value);
    case "rank":
      return `#${Math.max(1, Math.round(value))}`;
    case "score":
    default:
      return value.toFixed(1);
  }
}

function formatTrendDelta(metric: HistoryMetricKey, value: number): string {
  if (metric === "momentum") {
    if (Math.abs(value) < 0.05) {
      return "flat";
    }

    return decorateDirectionalValue(
      value,
      `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}`
    );
  }

  if (metric === "rank") {
    if (Math.abs(value) < 0.5) {
      return "flat";
    }

    return value < 0
      ? `up ${Math.abs(Math.round(value))}`
      : `down ${Math.abs(Math.round(value))}`;
  }

  if (metric === "marketShare") {
    if (Math.abs(value) < 0.0005) {
      return "flat";
    }

    return decorateDirectionalValue(
      value,
      `${value >= 0 ? "+" : "-"}${Math.abs(value * 100).toFixed(1)}%`
    );
  }

  if (metric === "companyValue" || metric === "monthlyProfit" || metric === "money") {
    return formatSignedCompactMoney(value);
  }

  if (Math.abs(value) < 0.05) {
    return "flat";
  }

  return decorateDirectionalValue(
    value,
    `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}`
  );
}

function formatTrendGap(metric: HistoryMetricKey, value: number): string {
  if (metric === "momentum") {
    return decorateDirectionalValue(
      value,
      `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}`
    );
  }

  if (metric === "marketShare") {
    return decorateDirectionalValue(
      value,
      `${value >= 0 ? "+" : "-"}${Math.abs(value * 100).toFixed(1)}%`
    );
  }

  if (metric === "companyValue" || metric === "monthlyProfit" || metric === "money") {
    return formatSignedCompactMoney(value);
  }

  if (metric === "rank") {
    if (Math.abs(value) < 0.5) {
      return "even";
    }

    return value < 0
      ? `${Math.abs(Math.round(value))} behind`
      : `${Math.abs(Math.round(value))} ahead`;
  }

  return decorateDirectionalValue(
    value,
    `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}`
  );
}

function formatMetricNumber(value: number): string {
  return value.toFixed(1);
}

function formatNumericGap(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatPercentText(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPercentGap(value: number, lowerIsBetter: boolean = false): string {
  const adjusted = lowerIsBetter ? -value : value;
  const prefix = adjusted >= 0 ? "+" : "-";
  return `${prefix}${Math.abs(value * 100).toFixed(1)}%`;
}

function formatCompactCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatCompactMoney(value: number): string {
  const absValue = Math.abs(value);
  const prefix = value < 0 ? "-" : "";
  if (absValue >= 1_000_000) {
    return `${prefix}$${(absValue / 1_000_000).toFixed(1)}m`;
  }
  if (absValue >= 1_000) {
    return `${prefix}$${(absValue / 1_000).toFixed(0)}k`;
  }
  return `${prefix}$${Math.round(absValue)}`;
}

function formatCompactDelta(value: number): string {
  if (Math.abs(value) < 0.05) {
    return "0.0";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatSignedMoney(value: number): string {
  const prefix = value >= 0 ? "+" : "-";
  return decorateDirectionalValue(value, `${prefix}${formatMoney(Math.abs(value))}`);
}

function formatSignedCompactMoney(value: number): string {
  const prefix = value >= 0 ? "+" : "-";
  return decorateDirectionalValue(value, `${prefix}${formatCompactMoney(Math.abs(value))}`);
}

function formatDecoratedCompactDelta(value: number): string {
  if (Math.abs(value) < 0.05) {
    return "0.0";
  }

  return decorateDirectionalValue(value, `${value >= 0 ? "+" : ""}${value.toFixed(1)}`);
}

function decorateDirectionalValue(value: number, text: string): string {
  if (Math.abs(value) < 0.00001) {
    return text;
  }

  return value > 0 ? `{GREEN}${text}` : `{RED}${text}`;
}

function formatListTrend(entry: LeaderboardEntry): string {
  const text = `${entry.trendLabel}${formatCompactDelta(entry.scoreDelta)}`;
  if (Math.abs(entry.scoreDelta) < 0.05 || entry.trendLabel === "flat") {
    return text;
  }

  return decorateDirectionalValue(entry.scoreDelta, text);
}

function formatListSignedCompactMoney(value: number): string {
  const prefix = value >= 0 ? "+" : "-";
  const text = `${prefix}${formatCompactMoney(Math.abs(value))}`;
  return decorateDirectionalValue(value, text);
}

function formatSignedInteger(value: number): string {
  return `${value >= 0 ? "+" : ""}${Math.round(value)}`;
}

function buildSpotlightBannerText(state: WorldParkLeagueState): string {
  if (
    state.world.spotlightMonthsRemaining > 0 &&
    state.world.spotlightParkId === PLAYER_PARK_ID
  ) {
    const debugTag =
      state.world.spotlightDebugOverrideDaysRemaining > 0
        ? ` | DEBUG LOCK ${state.world.spotlightDebugOverrideDaysRemaining}D`
        : "";
    return `{YELLOW}HURRAY! ${SPOTLIGHT_TITLE.toUpperCase()} ACTIVE | YOU ARE THE BEST PARK OF THE MONTH | X${Math.round(
      state.world.spotlightGuestMultiplier || SPOTLIGHT_GUEST_MULTIPLIER
    )} GUEST SURGE LIVE${debugTag}`;
  }

  if (state.world.featuredDaysRemaining > 0 && state.world.featuredParkId === PLAYER_PARK_ID) {
    const debugTag =
      state.world.featuredDebugOverrideDaysRemaining > 0
        ? ` | DEBUG LOCK ${state.world.featuredDebugOverrideDaysRemaining}D`
        : "";
    return `{GREEN}${FEATURED_TITLE.toUpperCase()} ACTIVE | YOUR PARK GOT THE WEEKLY FEATURE PUSH | X${(
      state.world.featuredGuestMultiplier || 1
    ).toFixed(2)} VISIBILITY BOOST LIVE${debugTag}`;
  }

  if (state.world.breakoutDaysRemaining > 0 && state.world.breakoutParkId === PLAYER_PARK_ID) {
    const debugTag =
      state.world.breakoutDebugOverrideDaysRemaining > 0
        ? ` | DEBUG LOCK ${state.world.breakoutDebugOverrideDaysRemaining}D`
        : "";
    return `{GREEN}${BREAKOUT_TITLE.toUpperCase()} ACTIVE | YOUR PARK CAUGHT A MID-TABLE BUZZ WAVE | X${(
      state.world.breakoutGuestMultiplier || 1
    ).toFixed(2)} ATTENTION BOOST LIVE${debugTag}`;
  }

  return "";
}

function getPlayerActiveBoostSummary(state: WorldParkLeagueState): string {
  if (
    state.world.spotlightMonthsRemaining > 0 &&
    state.world.spotlightParkId === PLAYER_PARK_ID
  ) {
    return `Spotlight x${Math.round(state.world.spotlightGuestMultiplier || SPOTLIGHT_GUEST_MULTIPLIER)}`;
  }

  if (state.world.featuredDaysRemaining > 0 && state.world.featuredParkId === PLAYER_PARK_ID) {
    return `Featured x${(state.world.featuredGuestMultiplier || 1).toFixed(2)}`;
  }

  if (state.world.breakoutDaysRemaining > 0 && state.world.breakoutParkId === PLAYER_PARK_ID) {
    return `Buzz x${(state.world.breakoutGuestMultiplier || 1).toFixed(2)}`;
  }

  return "None";
}

function drawSpotlightBanner(
  widget: CustomWidget,
  graphics: GraphicsContext,
  text: string
): void {
  if (!text) {
    return;
  }

  graphics.colour = widget.window.colours[2] ?? widget.window.colours[1] ?? 2;
  graphics.well(0, 0, widget.width, widget.height);
  graphics.clip(2, 2, Math.max(0, widget.width - 4), Math.max(0, widget.height - 4));
  graphics.text(text, 6, 4);
}

function buildScoreDriverSummary(
  breakdown: ReturnType<typeof calculatePlayerScoreBreakdown>
): string {
  const drivers = [
    { label: "rating", weight: breakdown.ratingScore * 0.3 },
    { label: "ride quality", weight: breakdown.rideQualityScore * 0.22 },
    { label: "park value", weight: breakdown.valueScore * 0.22 },
    { label: "guests", weight: breakdown.guestScore * 0.18 },
    { label: "park depth", weight: breakdown.portfolioScore * 0.08 },
  ]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map((driver) => driver.label);

  const maturityNote = breakdown.maturityScore < 50 ? "still a young park" : "well-established";
  return `${drivers.join(", ")} | ${maturityNote}`;
}

function buildLocalRaceTag(
  summary: ReturnType<typeof getLocalMarketSummary>
): string {
  if (!summary) {
    return "Forming";
  }

  if (summary.playerLeads) {
    return `Lead ${summary.playerCircuitRank}/${summary.circuitSize}`;
  }

  return `${summary.playerCircuitRank}/${summary.circuitSize} | -${(summary.shareGapToLeader * 100).toFixed(1)}%`;
}

function buildLocalRaceLine(
  summary: ReturnType<typeof getLocalMarketSummary>
): string {
  if (!summary) {
    return "Local race is still forming around your park.";
  }

  if (summary.playerLeads) {
    return `You lead the ${summary.circuitSize}-park local circuit with ${(summary.playerShareOfCircuit * 100).toFixed(0)}% of its people flow.`;
  }

  return `You are ${summary.playerCircuitRank}/${summary.circuitSize} locally. ${summary.leaderName} leads by ${(summary.shareGapToLeader * 100).toFixed(1)}% people share.`;
}

function buildMilestoneLine(
  milestones: ReturnType<typeof buildPrestigeMilestones>
): string {
  const ordered = [...milestones].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    return left.title.localeCompare(right.title);
  });

  return ordered
    .slice(0, 3)
    .map((milestone) =>
      milestone.completed
        ? `${milestone.title} done`
        : `${milestone.title} ${milestone.progressLabel}`
    )
    .join(" | ");
}

function buildPlayerExplanationLine(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  comparisonEntry: LeaderboardEntry | null,
  playerBreakdown: ReturnType<typeof calculatePlayerScoreBreakdown>,
  localMarketSummary: ReturnType<typeof getLocalMarketSummary>
): string {
  const lines: string[] = [];

  if (comparisonEntry) {
    const scoreGap = Math.max(0, comparisonEntry.score - state.player.score);
    lines.push(`Need +${scoreGap.toFixed(1)} score for ${comparisonEntry.parkName}`);
  }

  if (localMarketSummary && !localMarketSummary.playerLeads) {
    lines.push(
      `Losing ${(localMarketSummary.shareGapToLeader * 100).toFixed(1)}% people to ${localMarketSummary.leaderName}`
    );
  }

  if (snapshot.lastMonthOperatingProfit < 0) {
    lines.push("Negative profit is slowing your climb");
  } else if (snapshot.lastMonthOperatingProfit < snapshot.lastMonthRevenue * 0.15) {
    lines.push("Thin profit is limiting your score pace");
  }

  if (playerBreakdown.guestScore < playerBreakdown.ratingScore - 12) {
    lines.push("Guest count is lagging behind your park quality");
  } else if (playerBreakdown.portfolioScore < 45) {
    lines.push("Park depth is still holding your score back");
  }

  if (lines.length === 0) {
    return "Your park is broadly balanced right now; keep compounding quality, guests and profit.";
  }

  return lines.slice(0, 3).join(" | ");
}

function buildNowFocusSummary(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  comparisonEntry: LeaderboardEntry | null,
  localMarketSummary: ReturnType<typeof getLocalMarketSummary>
): { tag: string; line: string } {
  if (
    state.world.spotlightMonthsRemaining > 0 &&
    state.world.spotlightParkId === PLAYER_PARK_ID
  ) {
    return {
      tag: "Spotlight live",
      line: `You are riding ${SPOTLIGHT_TITLE}. The x${Math.round(
        state.world.spotlightGuestMultiplier || SPOTLIGHT_GUEST_MULTIPLIER
      )} guest surge is active, so this is the moment to cash in hard.`,
    };
  }

  if (state.world.featuredDaysRemaining > 0 && state.world.featuredParkId === PLAYER_PARK_ID) {
    return {
      tag: "Featured push",
      line: `You landed the ${FEATURED_TITLE}. It is a lucky top-pack visibility boost, so ride the extra attention while it lasts.`,
    };
  }

  if (state.world.breakoutDaysRemaining > 0 && state.world.breakoutParkId === PLAYER_PARK_ID) {
    return {
      tag: "Breakout buzz",
      line: `You caught ${BREAKOUT_TITLE}. It is smaller than the main spotlight, but still a useful free guest pulse from the mid-table pack.`,
    };
  }

  const hasAction = (type: Parameters<typeof getActionDefinition>[0]): boolean =>
    state.player.actions.activeActions.some((action) => action.type === type);
  const definitionFor = (type: Parameters<typeof getActionDefinition>[0]) => getActionDefinition(type);
  const nextRankGap = comparisonEntry ? Math.max(0, comparisonEntry.score - state.player.score) : null;
  const safetyAction = definitionFor("safety_campaign");
  if (
    state.world.safetyScrutinyMonthsRemaining > 0 &&
    safetyAction &&
    !hasAction("safety_campaign") &&
    snapshot.cash >= safetyAction.upfrontCost
  ) {
    return {
      tag: "Safety first",
      line: `${safetyAction.title} fits now. The market is watching safety closely, so protection is worth more than usual.`,
    };
  }

  const efficiencyAction = definitionFor("efficiency_push");
  if (
    snapshot.lastMonthOperatingProfit < 0 &&
    efficiencyAction &&
    !hasAction("efficiency_push") &&
    snapshot.cash >= efficiencyAction.upfrontCost
  ) {
    return {
      tag: "Fix profit",
      line: `${efficiencyAction.title} is the cleanest next move. Your last month was negative, so steady the park before you buy more hype.`,
    };
  }

  if (snapshot.totalRideCount + snapshot.stallCount < 10 || state.player.score < 62) {
    return {
      tag: "Build depth",
      line: "Your park is still young. More ride depth, guests and park value will lift score more reliably than financial plays alone.",
    };
  }

  const prAction = definitionFor("pr_blitz");
  if (
    comparisonEntry &&
    nextRankGap !== null &&
    nextRankGap <= 4.5 &&
    prAction &&
    !hasAction("pr_blitz") &&
    snapshot.cash >= prAction.upfrontCost
  ) {
    return {
      tag: "Push next rank",
      line: `${prAction.title} is a strong play now. You are only ${nextRankGap.toFixed(1)} score behind ${comparisonEntry.parkName}, so a short media burst can swing the next spot.`,
    };
  }

  const festivalAction = definitionFor("guest_festival");
  if (
    localMarketSummary &&
    !localMarketSummary.playerLeads &&
    festivalAction &&
    !hasAction("guest_festival") &&
    snapshot.cash >= festivalAction.upfrontCost &&
    localMarketSummary.shareGapToLeader >= 0.012
  ) {
    return {
      tag: "Win local race",
      line: `${festivalAction.title} would pressure ${localMarketSummary.leaderName}. Your local people-share gap is ${(localMarketSummary.shareGapToLeader * 100).toFixed(1)}%, which is small enough to attack.`,
    };
  }

  if (state.player.watchlist.alerts[0]) {
    return {
      tag: "Check alerts",
      line: state.player.watchlist.alerts[0].detail,
    };
  }

  if (localMarketSummary?.playerLeads) {
    return {
      tag: "Defend lead",
      line: "You are leading your local circuit. Protect profit and react quickly if a nearby rival turns hot.",
    };
  }

  return {
    tag: "Keep building",
    line: "Keep compounding park quality, guests and operating strength. The league rewards steady improvement over noisy one-off moves.",
  };
}

function describeMomentumBand(momentum: number): string {
  if (momentum >= 6) {
    return "Surging";
  }
  if (momentum >= 2) {
    return "Hot";
  }
  if (momentum <= -6) {
    return "Sliding";
  }
  if (momentum <= -2) {
    return "Cooling";
  }
  return "Steady";
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function simplifyStatusLabel(statusLabel: string): string {
  if (/spotlight/i.test(statusLabel)) {
    return "Spotlight";
  }
  if (/featured/i.test(statusLabel)) {
    return "Featured";
  }
  if (/buzz/i.test(statusLabel)) {
    return "Buzz";
  }
  if (/distress|slump|warning/i.test(statusLabel)) {
    return "Struggling";
  }
  if (/expansion|growth|success/i.test(statusLabel)) {
    return "Pushing";
  }
  if (/scandal/i.test(statusLabel)) {
    return "Under fire";
  }
  if (/recovery/i.test(statusLabel)) {
    return "Recovering";
  }
  if (/player/i.test(statusLabel)) {
    return "You";
  }
  return "Stable";
}

function getBoostShortLabel(statusLabel: string): string {
  if (/spotlight/i.test(statusLabel)) {
    return "Spot";
  }
  if (/featured/i.test(statusLabel)) {
    return "Feat";
  }
  if (/buzz/i.test(statusLabel)) {
    return "Buzz";
  }

  return "-";
}

function buildSimpleGapLabel(
  entry: LeaderboardEntry,
  state: WorldParkLeagueState
): string {
  const playerEntry = state.world.leaderboard.find((candidate) => candidate.isPlayer) ?? null;
  if (!playerEntry) {
    return "-";
  }

  if (entry.isPlayer) {
    const nextRival = state.world.leaderboard.find(
      (candidate) => !candidate.isPlayer && candidate.rank === Math.max(1, entry.rank - 1)
    );
    if (!nextRival) {
      return "Top";
    }

    return `-${Math.max(0, nextRival.score - entry.score).toFixed(1)}`;
  }

  const scoreGap = entry.score - playerEntry.score;
  if (Math.abs(scoreGap) < 0.05) {
    return "Even";
  }

  return scoreGap > 0 ? `+${scoreGap.toFixed(1)}` : `-${Math.abs(scoreGap).toFixed(1)}`;
}

function getBoostTag(statusLabel: string): string {
  if (/spotlight/i.test(statusLabel)) {
    return "[SPOT]";
  }
  if (/featured/i.test(statusLabel)) {
    return "[FEAT]";
  }
  if (/buzz/i.test(statusLabel)) {
    return "[BUZZ]";
  }

  return "";
}

function getBoostMarker(statusLabel: string): string {
  if (/spotlight/i.test(statusLabel)) {
    return "*";
  }
  if (/featured|buzz/i.test(statusLabel)) {
    return "+";
  }

  return "";
}

function describeMarketMood(economyIndex: number, tourismIndex: number): string {
  const combined = (economyIndex + tourismIndex) / 2;
  if (combined >= 1.08) {
    return "Hot";
  }
  if (combined >= 1.01) {
    return "Good";
  }
  if (combined <= 0.94) {
    return "Slow";
  }
  return "Steady";
}

function describeCompetitionHeat(value: number): string {
  if (value >= 1.1) {
    return "Fierce";
  }
  if (value >= 1.02) {
    return "Busy";
  }
  if (value <= 0.94) {
    return "Calm";
  }
  return "Normal";
}
