import { describe, expect, it } from "vitest";
import { PLAYER_PARK_ID } from "../src/config";
import {
  advanceRivalChallenge,
  buildAnalystInsight,
  formatHeadToHeadLine,
  getPrimaryRivalSummary,
  maybeStartRivalChallenge,
} from "../src/domain/rivalry";
import { createInitialState } from "../src/domain/simulation";
import type { LeaderboardEntry, ParkHistoryPoint, PlayerSnapshot, WorldParkLeagueState } from "../src/types";

describe("rivalry insights", () => {
  it("selects the closest focus rival as the main head-to-head opponent", () => {
    const state = createInitialState(0, "Rival Park");
    state.player.watchlist.focusRivalIds = ["rival-2", "rival-4", "rival-7"];
    state.player.watchlist.watchedRivalIds = ["rival-7"];
    state.player.currentRank = 10;
    state.world.leaderboard = createLeaderboard(state, {
      playerRank: 10,
      rivalRanks: {
        "rival-2": 9,
        "rival-4": 15,
        "rival-7": 11,
      },
      scoreById: {
        [PLAYER_PARK_ID]: 73,
        "rival-2": 75.2,
        "rival-4": 69,
        "rival-7": 72.6,
      },
      shareById: {
        [PLAYER_PARK_ID]: 0.031,
        "rival-2": 0.033,
        "rival-4": 0.022,
        "rival-7": 0.0305,
      },
      profitById: {
        [PLAYER_PARK_ID]: 16_000,
        "rival-2": 18_000,
        "rival-4": 10_000,
        "rival-7": 15_500,
      },
      momentumById: {
        [PLAYER_PARK_ID]: 1.2,
        "rival-2": 2.1,
        "rival-4": -0.8,
        "rival-7": 0.7,
      },
    });
    state.world.history[PLAYER_PARK_ID] = [point(0, 70, 0.03), point(14, 73, 0.031)];
    state.world.history["rival-2"] = [point(0, 72.7, 0.031), point(14, 75.2, 0.033)];
    state.world.history["rival-7"] = [point(0, 72.9, 0.0302), point(14, 72.6, 0.0305)];

    const summary = getPrimaryRivalSummary(state);

    expect(summary).not.toBeNull();
    expect(summary?.rivalId).toBe("rival-7");
    expect(summary?.isLocalRival).toBe(true);
    expect(summary?.pressureLabel).toBeTruthy();
    expect(formatHeadToHeadLine(summary)).toContain("rival-7");
  });

  it("builds analyst guidance from rivalry and player weaknesses", () => {
    const state = createInitialState(0, "Analyst Park");
    state.player.currentRank = 6;
    state.player.score = 71.4;
    state.player.marketShare = 0.028;
    state.world.leaderboard = createLeaderboard(state, {
      playerRank: 6,
      rivalRanks: {
        "rival-1": 5,
      },
      scoreById: {
        [PLAYER_PARK_ID]: 71.4,
        "rival-1": 76.8,
      },
      shareById: {
        [PLAYER_PARK_ID]: 0.028,
        "rival-1": 0.039,
      },
      profitById: {
        [PLAYER_PARK_ID]: -2_000,
        "rival-1": 15_000,
      },
      momentumById: {
        [PLAYER_PARK_ID]: -1.1,
        "rival-1": 2.4,
      },
    });
    const summary = getPrimaryRivalSummary(state, "rival-1");
    const insight = buildAnalystInsight(state, createSnapshot(), summary);

    expect(insight.title).toBeTruthy();
    expect(insight.summary).toMatch(/score edge|losing guests|monetizing better/i);
  });

  it("starts and resolves a rival challenge with real rewards", () => {
    const state = createInitialState(0, "Challenge Park");
    state.player.watchlist.focusRivalIds = ["rival-1", "rival-2", "rival-3"];
    state.player.currentRank = 9;
    state.world.leaderboard = createLeaderboard(state, {
      playerRank: 9,
      rivalRanks: {
        "rival-1": 8,
        "rival-2": 10,
        "rival-3": 11,
      },
      scoreById: {
        [PLAYER_PARK_ID]: 76.5,
        "rival-1": 78.4,
        "rival-2": 72.1,
        "rival-3": 71.8,
      },
      shareById: {
        [PLAYER_PARK_ID]: 0.033,
        "rival-1": 0.037,
        "rival-2": 0.025,
        "rival-3": 0.024,
      },
      profitById: {
        [PLAYER_PARK_ID]: 11_000,
        "rival-1": 22_500,
        "rival-2": 9_000,
        "rival-3": 8_800,
      },
      momentumById: {
        [PLAYER_PARK_ID]: 1.1,
        "rival-1": 2.4,
        "rival-2": -0.4,
        "rival-3": -0.5,
      },
    });

    const startNotifications = maybeStartRivalChallenge(state, 14, "rival-1");

    expect(startNotifications[0]).toMatch(/Rival challenge/i);
    expect(state.player.rivalry.activeChallenge).not.toBeNull();
    expect(state.player.rivalry.activeChallenge?.type).toBe("profit_duel");

    const challenge = state.player.rivalry.activeChallenge;
    if (!challenge) {
      throw new Error("Expected an active rival challenge.");
    }

    const result = advanceRivalChallenge(
      state,
      createSnapshot({
        currentDayIndex: challenge.resolveAtDayIndex,
        lastMonthOperatingProfit: 28_000,
      }),
      challenge.resolveAtDayIndex
    );

    expect(result.cashDelta).toBe(challenge.rewardCash);
    expect(result.notifications[0]).toMatch(/Challenge won/i);
    expect(state.player.rivalry.activeChallenge).toBeNull();
    expect(state.player.rivalry.wonChallenges).toBe(1);
    expect(state.world.breakoutRewardOverrideParkId).toBe(PLAYER_PARK_ID);
    expect(state.player.prestige.activeRewards.some((reward) => reward.id.includes(challenge.id))).toBe(true);
  });

  it("charges park cash when a direct rival challenge is lost", () => {
    const state = createInitialState(0, "Penalty Park");
    state.player.watchlist.focusRivalIds = ["rival-1"];
    state.player.currentRank = 9;
    state.world.leaderboard = createLeaderboard(state, {
      playerRank: 9,
      rivalRanks: {
        "rival-1": 8,
      },
      scoreById: {
        [PLAYER_PARK_ID]: 76.5,
        "rival-1": 78.4,
      },
      shareById: {
        [PLAYER_PARK_ID]: 0.033,
        "rival-1": 0.037,
      },
      profitById: {
        [PLAYER_PARK_ID]: 11_000,
        "rival-1": 22_500,
      },
      momentumById: {
        [PLAYER_PARK_ID]: 1.1,
        "rival-1": 2.4,
      },
    });

    maybeStartRivalChallenge(state, 14, "rival-1");

    const challenge = state.player.rivalry.activeChallenge;
    if (!challenge) {
      throw new Error("Expected an active rival challenge.");
    }

    const result = advanceRivalChallenge(
      state,
      createSnapshot({
        currentDayIndex: challenge.resolveAtDayIndex,
        lastMonthOperatingProfit: 4_000,
      }),
      challenge.resolveAtDayIndex
    );

    expect(challenge.penaltyCash).toBeGreaterThan(0);
    expect(result.cashDelta).toBe(-challenge.penaltyCash);
    expect(result.notifications[0]).toMatch(/penalty/i);
    expect(state.player.rivalry.activeChallenge).toBeNull();
    expect(state.player.rivalry.wonChallenges).toBe(0);
  });
});

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    parkName: "Analyst Park",
    currentMonth: 4,
    currentDay: 10,
    currentDayIndex: 4 * 31 + 9,
    parkRating: 830,
    guests: 920,
    parkValue: 760_000,
    companyValue: 800_000,
    cash: 18_000,
    bankLoan: 45_000,
    lastMonthRevenue: 26_000,
    lastMonthOperatingCosts: 28_000,
    lastMonthOperatingProfit: -2_000,
    totalRideCount: 8,
    openRideCount: 7,
    stallCount: 3,
    averageRideExcitement: 6.1,
    averageRideSatisfaction: 73,
    totalRideProfit: 40_000,
    ...overrides,
  };
}

function point(dayIndex: number, score: number, marketShare: number): ParkHistoryPoint {
  return {
    dayIndex,
    month: Math.floor(dayIndex / 31),
    rank: 0,
    score,
    marketShare,
    companyValue: 1_000_000,
    monthlyProfit: 12_000,
    money: 50_000,
    ownerCash: 18_000,
    ownerNetWorth: 210_000,
    momentum: 0,
  };
}

function createLeaderboard(
  state: WorldParkLeagueState,
  config: {
    playerRank: number;
    rivalRanks: Record<string, number>;
    scoreById: Record<string, number>;
    shareById: Record<string, number>;
    profitById: Record<string, number>;
    momentumById: Record<string, number>;
  }
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  const usedRanks = new Set<number>([config.playerRank, ...Object.values(config.rivalRanks)]);
  const fieldSize = Math.max(state.world.rivals.length + 1, 12);

  for (let rank = 1; rank <= fieldSize; rank += 1) {
    if (rank === config.playerRank) {
      entries.push(createEntry(PLAYER_PARK_ID, "Player Park", true, rank, config));
      continue;
    }

    const matchingRivalId =
      Object.entries(config.rivalRanks).find(([, rivalRank]) => rivalRank === rank)?.[0] ?? null;
    if (matchingRivalId) {
      entries.push(createEntry(matchingRivalId, matchingRivalId, false, rank, config));
      continue;
    }

    const fallbackRival = state.world.rivals.find(
      (rival) =>
        !config.rivalRanks[rival.id] &&
        !entries.some((entry) => entry.parkId === rival.id)
    );
    if (!fallbackRival || usedRanks.has(rank)) {
      continue;
    }

    entries.push(createEntry(fallbackRival.id, fallbackRival.name, false, rank, config));
  }

  return entries.sort((left, right) => left.rank - right.rank);
}

function createEntry(
  parkId: string,
  parkName: string,
  isPlayer: boolean,
  rank: number,
  config: {
    scoreById: Record<string, number>;
    shareById: Record<string, number>;
    profitById: Record<string, number>;
    momentumById: Record<string, number>;
  }
): LeaderboardEntry {
  return {
    rank,
    parkId,
    parkName,
    isPlayer,
    score: config.scoreById[parkId] ?? 100 - rank,
    scoreDelta: config.momentumById[parkId] ?? 0,
    marketShare: config.shareById[parkId] ?? 0.02,
    monthlyProfit: config.profitById[parkId] ?? 10_000,
    companyValue: 1_000_000 - rank * 4_000,
    monthlyVisitors: 1_500 - rank * 10,
    debtRatio: 0.2,
    regionLabel: isPlayer ? "Your park" : "Europe",
    statusLabel: isPlayer ? "Player" : "Stable",
    trendLabel: "=",
  };
}
