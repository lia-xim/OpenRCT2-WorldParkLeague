import { describe, expect, it } from "vitest";
import { PLAYER_PARK_ID } from "../src/config";
import {
  advancePrestigeRewardsForDays,
  buildPrestigeProgress,
  getNextPrestigeGoal,
  getPrestigeRewardEffects,
  updatePrestigeProgress,
} from "../src/domain/prestige";
import { createInitialState } from "../src/domain/simulation";
import type { ParkHistoryPoint, PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    parkName: "Prestige Park",
    currentMonth: 5,
    currentDay: 12,
    currentDayIndex: 5 * 31 + 11,
    parkRating: 905,
    guests: 1_260,
    parkValue: 1_020_000,
    companyValue: 1_140_000,
    cash: 120_000,
    bankLoan: 0,
    lastMonthRevenue: 84_000,
    lastMonthOperatingCosts: 53_000,
    lastMonthOperatingProfit: 31_000,
    totalRideCount: 14,
    openRideCount: 12,
    stallCount: 6,
    averageRideExcitement: 7.1,
    averageRideSatisfaction: 91,
    totalRideProfit: 118_000,
    ...overrides,
  };
}

function point(month: number, rank: number, score: number): ParkHistoryPoint {
  return {
    dayIndex: month * 31,
    month,
    rank,
    score,
    marketShare: 0.03 + month * 0.002,
    companyValue: 700_000 + month * 40_000,
    monthlyProfit: 10_000 + month * 4_000,
    money: 45_000 + month * 6_000,
    momentum: 2 + month * 0.3,
  };
}

describe("prestige", () => {
  it("tracks lifetime records and unlocks achievements from state and headlines", () => {
    const state = createInitialState(0, "Prestige Park");
    state.player.currentRank = 1;
    state.player.score = 82.4;
    state.player.marketShare = 0.045;
    state.player.guestCapModifier = 1.31;
    state.player.monthsAtRankOne = 3;
    state.player.owner.cash = 120_000;
    state.player.investments = [
      {
        rivalId: "r1",
        share: 0.05,
        costBasis: 50_000,
        purchasedAtMonth: 1,
        totalDividendsReceived: 0,
        lastDividend: 0,
        realizedProfit: 0,
      },
      {
        rivalId: "r2",
        share: 0.05,
        costBasis: 50_000,
        purchasedAtMonth: 1,
        totalDividendsReceived: 0,
        lastDividend: 0,
        realizedProfit: 0,
      },
      {
        rivalId: "r3",
        share: 0.05,
        costBasis: 50_000,
        purchasedAtMonth: 1,
        totalDividendsReceived: 0,
        lastDividend: 0,
        realizedProfit: 0,
      },
    ];
    state.player.investmentSummary.portfolioValue = 230_000;
    state.world.history[PLAYER_PARK_ID] = [
      point(0, 9, 62),
      point(1, 7, 68),
      point(2, 5, 74),
    ];

    const result = updatePrestigeProgress(state, createSnapshot(), [
      {
        id: "spot",
        month: 5,
        category: "award",
        severity: "success",
        headline: "Prestige Park captures World Spotlight.",
        detail: "Spotlight active.",
        parkId: PLAYER_PARK_ID,
      },
      {
        id: "feat",
        month: 5,
        category: "world",
        severity: "success",
        headline: "Prestige Park lands the Featured Pick.",
        detail: "Featured active.",
        parkId: PLAYER_PARK_ID,
      },
      {
        id: "buzz",
        month: 5,
        category: "world",
        severity: "success",
        headline: "Prestige Park catches Breakout Buzz.",
        detail: "Buzz active.",
        parkId: PLAYER_PARK_ID,
      },
      {
        id: "award-year",
        month: 5,
        category: "award",
        severity: "success",
        headline: "Prestige Park wins Best Park of the Year.",
        detail: "Annual crown.",
        parkId: PLAYER_PARK_ID,
      },
      {
        id: "merger",
        month: 5,
        category: "merger",
        severity: "info",
        headline: "Rival A absorbs Rival B.",
        detail: "Merger.",
      },
      {
        id: "bankrupt",
        month: 5,
        category: "rival",
        severity: "warning",
        headline: "Rival C files for bankruptcy protection.",
        detail: "Exit.",
        parkId: "rival-c",
      },
    ]);

    expect(state.player.prestige.records.totalSpotlightWins).toBe(1);
    expect(state.player.prestige.records.totalFeaturedWins).toBe(1);
    expect(state.player.prestige.records.totalBuzzWins).toBe(1);
    expect(state.player.prestige.records.totalYearlyAwards).toBe(1);
    expect(state.player.prestige.records.totalMergersWitnessed).toBe(1);
    expect(state.player.prestige.records.totalBankruptciesWitnessed).toBe(1);
    expect(state.player.prestige.records.peakEquityValue).toBeGreaterThanOrEqual(1_000_000);
    expect(state.player.prestige.records.longestTopTenStreak).toBe(3);
    expect(state.player.prestige.records.longestRankOneStreak).toBe(3);
    expect(state.player.prestige.prestigeScore).toBeGreaterThan(0);
    expect(result.notifications.some((note) => note.includes("World Spotlight"))).toBe(true);
    expect(result.cashDelta).toBeGreaterThan(0);
    expect(state.player.prestige.activeRewards.length).toBeGreaterThan(0);
    expect(state.player.investments.length).toBeGreaterThanOrEqual(3);
    expect(state.world.spotlightRewardOverrideParkId).toBe(PLAYER_PARK_ID);
    expect(state.world.featuredRewardOverrideParkId).toBe(PLAYER_PARK_ID);
    expect(state.world.breakoutRewardOverrideParkId).toBe(PLAYER_PARK_ID);
    expect(getPrestigeRewardEffects(state).scoreBonus).toBeGreaterThan(0);

    const unlockedKeys = state.player.prestige.unlockedAchievements.map((achievement) => achievement.key);
    expect(unlockedKeys).toContain("guests_1000");
    expect(unlockedKeys).toContain("share_4");
    expect(unlockedKeys).toContain("top10_3m");
    expect(unlockedKeys).toContain("rank1_3m");
    expect(unlockedKeys).toContain("spotlight_first");
    expect(unlockedKeys).toContain("featured_first");
    expect(unlockedKeys).toContain("buzz_first");
    expect(unlockedKeys).toContain("award_yearly");
    expect(unlockedKeys).toContain("cash_100k");
    expect(unlockedKeys).toContain("equity_1m");
    expect(unlockedKeys).toContain("profit_25k");
    expect(unlockedKeys).toContain("holdings_3");
    expect(
      state.player.prestige.unlockedAchievements.every(
        (achievement) => achievement.rewardSummary.length > 0
      )
    ).toBe(true);
  });

  it("builds progress rows for remaining prestige goals", () => {
    const state = createInitialState(0, "Prestige Park");
    state.player.marketShare = 0.021;
    state.world.history[PLAYER_PARK_ID] = [point(0, 18, 55), point(1, 14, 58)];

    const progress = buildPrestigeProgress(
      state,
      createSnapshot({
        guests: 620,
        cash: 22_000,
        parkValue: 340_000,
        bankLoan: 20_000,
        lastMonthOperatingProfit: 8_000,
      })
    );

    const guestGoal = progress.find((goal) => goal.key === "guests_1000");
    const topTenGoal = progress.find((goal) => goal.key === "top10_3m");
    expect(guestGoal?.completed).toBe(false);
    expect(guestGoal?.progressLabel).toContain("620");
    expect(guestGoal?.rewardPreview).toContain("Buzz");
    expect(topTenGoal?.progressLabel).toContain("0/3");
  });

  it("surfaces the closest next prestige goal", () => {
    const state = createInitialState(0, "Prestige Park");
    state.player.marketShare = 0.036;

    const nextGoal = getNextPrestigeGoal(
      state,
      createSnapshot({
        guests: 980,
        cash: 26_000,
        lastMonthOperatingProfit: 12_000,
      })
    );

    expect(nextGoal?.key).toBe("guests_1000");
    expect(nextGoal?.rewardPreview).toContain("Buzz");
    expect(nextGoal?.progressRatio).toBeGreaterThan(0.9);
  });

  it("expires temporary prestige reward programs over time", () => {
    const state = createInitialState(0, "Prestige Park");
    state.player.prestige.activeRewards.push({
      id: "test-reward",
      sourceAchievementKey: "test",
      title: "Test Aura",
      summary: "Temporary score aura.",
      daysRemaining: 2,
      scoreBonus: 4,
      guestCapBonus: 0.01,
      momentumBonus: 1,
    });

    const dayOne = advancePrestigeRewardsForDays(state, 1);
    expect(dayOne).toEqual([]);
    expect(state.player.prestige.activeRewards[0]?.daysRemaining).toBe(1);
    expect(getPrestigeRewardEffects(state).scoreBonus).toBe(4);

    const dayTwo = advancePrestigeRewardsForDays(state, 1);
    expect(dayTwo[0]).toContain("Test Aura");
    expect(state.player.prestige.activeRewards).toHaveLength(0);
    expect(getPrestigeRewardEffects(state).scoreBonus).toBe(0);
  });
});
