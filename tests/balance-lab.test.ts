import { describe, expect, it } from "vitest";
import type { BalanceAnalysisPayload } from "../scripts/balance-shared";
import {
  buildBalanceLabCandidates,
  expandEconomicCandidates,
  scoreBalancePayload,
} from "../scripts/balance-lab-shared";

describe("balance lab candidate generation", () => {
  it("includes a baseline candidate and unique ids", () => {
    const candidates = buildBalanceLabCandidates();
    const ids = candidates.map((candidate) => candidate.id);

    expect(ids).toContain("baseline");
    expect(candidates.length).toBe(325);
    expect(new Set(ids).size).toBe(ids.length);
    expect(candidates.some((candidate) => candidate.override.guestCapUpperClamp === 1.16)).toBe(true);
    expect(
      candidates.some(
        (candidate) =>
          candidate.id === "d007-c030-sg150-ss100-gc-tight-anti-aggressive" &&
          candidate.override.catchUpPlayerDominanceScale === 1.08 &&
          candidate.override.catchUpPlayerGrowthScale === 0.026 &&
          candidate.override.catchUpTenureScale === 0.014 &&
          candidate.override.catchUpLocalRivalScale === 1.5
      )
    ).toBe(true);
  });

  it("expands top candidates with owner-return and supporting-boost variants", () => {
    const expanded = expandEconomicCandidates(
      buildBalanceLabCandidates().filter((candidate) => candidate.id === "baseline")
    );

    expect(expanded.some((candidate) => candidate.id === "baseline")).toBe(true);
    expect(
      expanded.some((candidate) => candidate.override.investmentDividendMultiplier === 0.42)
    ).toBe(true);
    expect(
      expanded.some((candidate) => candidate.override.featuredGuestMultiplier === 1.18)
    ).toBe(true);
  });
});

describe("balance lab scoring", () => {
  it("penalizes runaway dominance and oversized investment returns", () => {
    const healthy = createPayload({
      weak: { averageRank: 16, dominanceMonthRate: 0.12, averageGuestCap: 0.92 },
      mid: { averageRank: 7.5, dominanceMonthRate: 0.22, averageRankVolatility: 0.5 },
      strong: {
        averageRank: 3,
        dominanceMonthRate: 0.36,
        averageTopScoreGap: 4.2,
        averageGuestCap: 1.14,
        averageRankVolatility: 0.32,
        averageMonthsAtTop: 14,
        averageLongestTopStreak: 7,
      },
      dominant: {
        averageRank: 1.8,
        dominanceMonthRate: 0.62,
        averageTopScoreGap: 6.1,
        averageGuestCap: 1.3,
        averageMonthsAtTop: 24,
        averageLongestTopStreak: 12,
      },
      averageRoi: 0.24,
      largeStakeRoi: 0.28,
    });
    const runaway = createPayload({
      weak: { averageRank: 9, dominanceMonthRate: 0.36, averageGuestCap: 0.66 },
      mid: {
        averageRank: 2.2,
        dominanceMonthRate: 0.74,
        averageRankVolatility: 0.11,
        averageMonthsAtTop: 20,
        averageLongestTopStreak: 11,
      },
      strong: {
        averageRank: 1.1,
        dominanceMonthRate: 0.94,
        averageTopScoreGap: 10.5,
        averageGuestCap: 1.55,
        averageRankVolatility: 0.08,
        averageMonthsAtTop: 34,
        averageLongestTopStreak: 23,
      },
      dominant: {
        averageRank: 1,
        dominanceMonthRate: 0.99,
        averageTopScoreGap: 13,
        averageGuestCap: 1.72,
        averageMonthsAtTop: 46,
        averageLongestTopStreak: 34,
      },
      averageRoi: 0.52,
      largeStakeRoi: 0.61,
    });

    expect(scoreBalancePayload(runaway).total).toBeGreaterThan(scoreBalancePayload(healthy).total);
    expect(scoreBalancePayload(runaway).stickinessPenalty).toBeGreaterThan(
      scoreBalancePayload(healthy).stickinessPenalty
    );
  });
});

function createPayload(input: {
  weak: PartialScenario;
  mid: PartialScenario;
  strong: PartialScenario;
  dominant: PartialScenario;
  averageRoi: number;
  largeStakeRoi: number;
}): BalanceAnalysisPayload {
  return {
    months: 48,
    seeds: 30,
    configOverride: {},
    scenarios: [
      createScenario("weak", input.weak),
      createScenario("mid", input.mid),
      createScenario("strong", input.strong),
      createScenario("dominant", input.dominant),
    ],
    investments: [
      createInvestment(0.05, input.averageRoi),
      createInvestment(0.1, input.averageRoi),
      createInvestment(0.15, input.largeStakeRoi),
    ],
  };
}

type PartialScenario = Partial<
  BalanceAnalysisPayload["scenarios"][number]
>;

function createScenario(
  key: string,
  overrides: PartialScenario
): BalanceAnalysisPayload["scenarios"][number] {
  return {
    key,
    label: key,
    averageRank: 10,
    averageRankVolatility: 0.4,
    averageTopScoreGap: 4,
    averageTop3Share: 0.23,
    averageShare: 0.03,
    averageGuestCap: 1,
    minGuestCap: 0.8,
    maxGuestCap: 1.2,
    averageGovernanceImpact: 0,
    averageBoard: 0.6,
    averageInvestors: 0.6,
    averageMonthsAtTop: 4,
    averageLongestTopStreak: 2,
    averagePrestigeScore: 10,
    averageAchievementsUnlocked: 1,
    averageSpotlightWins: 0.4,
    averageYearlyAwards: 0.3,
    dominanceMonthRate: 0.2,
    ...overrides,
  };
}

function createInvestment(
  lotShare: number,
  averageRoi: number
): BalanceAnalysisPayload["investments"][number] {
  return {
    lotShare,
    seeds: 30,
    averageInitialCost: 100_000,
    averageNetProfit: averageRoi * 100_000,
    averageRoi,
    averageDividends: 10_000,
    averageSaleProceeds: 115_000,
    averageFinalTargetValue: 1_000_000,
  };
}
