import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/domain/simulation";
import { migrateState } from "../src/state/repository";
import type { PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  const snapshot: PlayerSnapshot = {
    parkName: "Legacy Park",
    currentMonth: 12,
    currentDay: 1,
    currentDayIndex: 12 * 31,
    parkRating: 790,
    guests: 980,
    parkValue: 1_868_000,
    companyValue: 1_850_000,
    cash: 42_000,
    bankLoan: 60_000,
    lastMonthRevenue: 46_000,
    lastMonthOperatingCosts: 33_000,
    lastMonthOperatingProfit: 13_000,
    totalRideCount: 9,
    openRideCount: 7,
    stallCount: 4,
    averageRideExcitement: 5.8,
    averageRideSatisfaction: 73,
    totalRideProfit: 58_000,
    ...overrides,
  };

  if (overrides.parkValue === undefined) {
    snapshot.parkValue = Math.max(0, snapshot.companyValue - snapshot.cash + snapshot.bankLoan);
  }
  if (overrides.companyValue === undefined) {
    snapshot.companyValue = Math.max(0, snapshot.parkValue + snapshot.cash - snapshot.bankLoan);
  }

  return snapshot;
}

describe("migrateState", () => {
  it("backfills regional markets and strategy fields for older save data", () => {
    const snapshot = createSnapshot();
    const seeded = createInitialState(0, snapshot.parkName);
    const legacyRival = seeded.world.rivals[0];
    if (!legacyRival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const legacyState = {
      schemaVersion: 2,
      pluginVersion: "0.1.0",
      seededAtMonth: seeded.seededAtMonth,
      lastSimulatedMonth: seeded.lastSimulatedMonth,
      config: seeded.config,
      world: {
        seed: seeded.world.seed,
        economyIndex: seeded.world.economyIndex,
        tourismIndex: seeded.world.tourismIndex,
        competitionHeat: seeded.world.competitionHeat,
        capitalMarketMood: seeded.world.capitalMarketMood,
        globalDemand: seeded.world.globalDemand,
        seasonFactor: seeded.world.seasonFactor,
        rivals: [
          {
            ...legacyRival,
            status: {
              active: legacyRival.status.active,
              monthsAtTop: legacyRival.status.monthsAtTop,
              monthsInSlump: legacyRival.status.monthsInSlump,
              monthsSinceFounded: legacyRival.status.monthsSinceFounded,
              mergedIntoId: legacyRival.status.mergedIntoId,
              lastHeadline: legacyRival.status.lastHeadline,
              distressLevel: legacyRival.status.distressLevel,
              scandalMonthsRemaining: legacyRival.status.scandalMonthsRemaining,
              expansionMonthsRemaining: legacyRival.status.expansionMonthsRemaining,
              recoveryMonthsRemaining: legacyRival.status.recoveryMonthsRemaining,
            },
          },
        ],
        history: {
          __player__: [
            {
              month: 3,
              score: 71.5,
              marketShare: 0.032,
              companyValue: 920_000,
              monthlyProfit: 15_000,
              money: 33_000,
              rank: 27,
            },
          ],
        },
        newsFeed: seeded.world.newsFeed,
        awards: seeded.world.awards,
        leaderboard: seeded.world.leaderboard,
      },
      player: seeded.player,
    };

    const migrated = migrateState(legacyState, snapshot);
    const migratedRival = migrated.world.rivals[0];

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(6);
    expect(migrated.world.safetyScrutinyMonthsRemaining).toBe(0);
    expect(migrated.world.regionMarkets.europe.key).toBe("europe");
    expect(migratedRival?.status.strategyFocus).toBeDefined();
    expect(migratedRival?.status.strategyShiftMonthsRemaining).toBe(0);
    expect(migrated.player.governance.activeDirective).toBeDefined();
    expect(migrated.player.governance.guestCapImpact).toBeGreaterThan(0);
    expect(Array.isArray(migrated.player.governance.pendingProposals)).toBe(true);
    expect(Array.isArray(migrated.player.governance.activePrograms)).toBe(true);
    expect(migrated.player.liveMomentum).toBe(0);
    expect(migrated.player.prestige.prestigeScore).toBe(0);
    expect(Array.isArray(migrated.player.prestige.unlockedAchievements)).toBe(true);
    expect(migrated.world.history.__player__?.[0]?.dayIndex).toBe(93);
    expect(migrated.world.history.__player__?.[0]?.momentum).toBe(0);
    expect(Array.isArray(migrated.world.historyEvents.__player__)).toBe(true);
    expect(migrated.lastLivePulseDayIndex).toBe(snapshot.currentDayIndex);
    expect(migrated.lastLiveEventDayIndex).toBe(snapshot.currentDayIndex);
    expect(migrated.world.rivals.length).toBeGreaterThanOrEqual(migrated.config.rivalCount);
    expect(migrated.config.dominantLeadThreshold).toBe(0.07);
    expect(migrated.config.maxCatchUpPressure).toBe(0.26);
    expect(migrated.config.spotlightGuestMultiplier).toBe(1.8);
    expect(migrated.config.spotlightScoreBonus).toBe(1.5);
    expect(migrated.world.spotlightGuestMultiplier).toBe(1.8);
  });

  it("normalizes newer saves that are missing reward and rivalry fields", () => {
    const snapshot = createSnapshot({ currentMonth: 18, currentDayIndex: 18 * 31 + 7 });
    const seeded = createInitialState(0, snapshot.parkName);

    const migrated = migrateState(
      {
        schemaVersion: 21,
        pluginVersion: "0.19.0",
        seededAtMonth: seeded.seededAtMonth,
        lastSimulatedMonth: seeded.lastSimulatedMonth,
        config: {
          rivalCount: seeded.config.rivalCount,
          newsRetention: seeded.config.newsRetention,
          dominantLeadThreshold: seeded.config.dominantLeadThreshold,
          maxCatchUpPressure: seeded.config.maxCatchUpPressure,
          mergerChance: seeded.config.mergerChance,
          challengerChance: seeded.config.challengerChance,
          annualMarketGrowthRate: seeded.config.annualMarketGrowthRate,
          livePulseIntervalDays: seeded.config.livePulseIntervalDays,
          liveEventIntervalDays: seeded.config.liveEventIntervalDays,
          spotlightGuestMultiplier: seeded.config.spotlightGuestMultiplier,
          spotlightScoreBonus: seeded.config.spotlightScoreBonus,
        },
        world: {
          ...seeded.world,
          featuredRewardOverrideParkId: undefined,
          breakoutRewardOverrideParkId: undefined,
        },
        player: {
          ...seeded.player,
          rivalry: {
            activeChallenge: {
              id: "legacy-duel",
              rivalId: "rival-4",
              rivalName: "Legacy Rival",
              type: "profit_duel",
              title: "Profit Duel",
              summary: "Legacy save challenge",
              issuedAtDayIndex: 200,
              resolveAtDayIndex: 228,
              baselinePlayerScore: 74.5,
              baselineRivalScore: 77.1,
              baselinePlayerShare: 0.028,
              baselineRivalShare: 0.033,
              baselinePlayerProfit: 12_000,
              baselineRivalProfit: 19_000,
              rewardCash: 18_000,
              rewardBoostType: "buzz",
              rewardBoostDays: 7,
              rewardScoreBonus: 3.5,
              rewardDurationDays: 21,
            },
            cooldownDaysRemaining: -3,
            completedChallenges: 2,
            wonChallenges: 1,
            lastChallengeSummary: "Legacy duel pending.",
          },
          prestige: {
            ...seeded.player.prestige,
            activeRewards: [],
            lastRewardSummary: null,
          },
        },
      },
      snapshot
    );

    expect(migrated.config.investmentSaleMultiplier).toBe(0.82);
    expect(migrated.config.investmentDividendMultiplier).toBe(0.72);
    expect(migrated.config.prestigeRewardCashMultiplier).toBe(0.72);
    expect(migrated.config.prestigeRewardBoostMultiplier).toBe(0.78);
    expect(migrated.world.featuredRewardOverrideDaysRemaining).toBe(0);
    expect(migrated.world.breakoutRewardOverrideDaysRemaining).toBe(0);
    expect(migrated.player.rivalry.activeChallenge?.type).toBe("profit_duel");
    expect(migrated.player.rivalry.cooldownDaysRemaining).toBe(0);
    expect(Array.isArray(migrated.player.prestige.activeRewards)).toBe(true);
    expect(migrated.player.prestige.lastRewardSummary).toBeNull();
  });
});
