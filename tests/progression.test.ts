import { describe, expect, it } from "vitest";
import { PLAYER_PARK_ID } from "../src/config";
import { createInitialState } from "../src/domain/simulation";
import { buildPrestigeMilestones, buildYearlyRecap } from "../src/domain/progression";
import type { ParkHistoryPoint, PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    parkName: "Test Park",
    currentMonth: 7,
    currentDay: 1,
    currentDayIndex: 217,
    parkRating: 860,
    guests: 1250,
    parkValue: 2_000_000,
    companyValue: 2_040_000,
    cash: 60_000,
    bankLoan: 20_000,
    lastMonthRevenue: 72_000,
    lastMonthOperatingCosts: 54_000,
    lastMonthOperatingProfit: 18_000,
    totalRideCount: 12,
    openRideCount: 10,
    stallCount: 5,
    averageRideExcitement: 6.8,
    averageRideSatisfaction: 92,
    totalRideProfit: 96_000,
    ...overrides,
  };
}

function point(
  month: number,
  rank: number,
  score: number,
  monthlyProfit: number,
  marketShare: number = 0.03
): ParkHistoryPoint {
  return {
    dayIndex: month * 31,
    month,
    rank,
    score,
    marketShare,
    companyValue: 2_000_000 + month * 10_000,
    monthlyProfit,
    money: 50_000 + month * 1_000,
    momentum: 0,
  };
}

describe("progression", () => {
  it("builds prestige milestones from player state and local market state", () => {
    const state = createInitialState(0, "Test Park");
    state.player.marketShare = 0.041;
    state.world.history[PLAYER_PARK_ID] = [
      point(0, 9, 60, 8_000),
      point(1, 8, 63, 9_000),
      point(2, 7, 66, 12_000),
    ];

    const milestones = buildPrestigeMilestones(state, createSnapshot(), {
      circuitSize: 4,
      circuitShare: 0.12,
      playerShareOfCircuit: 0.36,
      playerCircuitRank: 1,
      leaderId: PLAYER_PARK_ID,
      leaderName: "Test Park",
      leaderShare: 0.041,
      shareGapToLeader: 0,
      playerLeads: true,
    });

    expect(milestones.find((item) => item.key === "guests_1000")?.completed).toBe(true);
    expect(milestones.find((item) => item.key === "top10_3m")?.completed).toBe(true);
    expect(milestones.find((item) => item.key === "local_lead")?.completed).toBe(true);
    expect(milestones.find((item) => item.key === "share_4")?.completed).toBe(true);
  });

  it("builds a yearly recap with winner, loser, rival, best month and biggest jump", () => {
    const state = createInitialState(0, "Test Park");
    const rivalA = state.world.rivals[0];
    const rivalB = state.world.rivals[1];
    if (!rivalA || !rivalB) {
      throw new Error("Expected seeded rivals.");
    }

    state.player.watchlist.focusRivalIds = [rivalA.id];
    state.world.history[PLAYER_PARK_ID] = [
      point(0, 20, 52, 4_000),
      point(1, 18, 55, 6_000),
      point(2, 14, 60, 11_000),
      point(3, 12, 64, 14_000),
      point(4, 10, 67, 18_000),
      point(5, 9, 72, 28_000),
      point(6, 8, 75, 24_000),
      point(7, 7, 78, 22_000),
    ];
    state.world.history[rivalA.id] = [
      point(0, 8, 60, 12_000),
      point(7, 5, 85, 24_000),
    ];
    state.world.history[rivalB.id] = [
      point(0, 5, 70, 20_000),
      point(7, 11, 58, 8_000),
    ];

    const recap = buildYearlyRecap(state, {
      rank: 6,
      parkId: rivalA.id,
      parkName: rivalA.name,
      isPlayer: false,
      score: 85,
      scoreDelta: 2,
      marketShare: 0.05,
      monthlyProfit: 24_000,
      companyValue: 2_400_000,
      monthlyVisitors: 1500,
      debtRatio: 0.2,
      regionLabel: "Europe",
      statusLabel: "Stable",
      trendLabel: "+",
    });

    expect(recap).not.toBeNull();
    expect(recap?.biggestWinner).toContain("Test Park");
    expect(recap?.biggestLoser).toContain(rivalB.name);
    expect(recap?.mainRival).toBe(rivalA.name);
    expect(recap?.bestMonth).toContain("M6");
    expect(recap?.biggestJump).toContain("+4");
  });
});
