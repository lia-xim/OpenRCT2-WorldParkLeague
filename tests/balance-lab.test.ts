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
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("expands top candidates with investment and prestige restraint variants", () => {
    const expanded = expandEconomicCandidates(
      buildBalanceLabCandidates().filter((candidate) => candidate.id === "baseline")
    );

    expect(expanded.some((candidate) => candidate.id === "baseline")).toBe(true);
    expect(
      expanded.some((candidate) => candidate.override.investmentDividendMultiplier === 0.72)
    ).toBe(true);
    expect(
      expanded.some((candidate) => candidate.override.prestigeRewardBoostMultiplier === 0.78)
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
      },
      dominant: {
        averageRank: 1.8,
        dominanceMonthRate: 0.62,
        averageTopScoreGap: 6.1,
        averageGuestCap: 1.3,
      },
      averageRoi: 0.34,
      largeStakeRoi: 0.4,
    });
    const runaway = createPayload({
      weak: { averageRank: 9, dominanceMonthRate: 0.36, averageGuestCap: 0.66 },
      mid: { averageRank: 2.2, dominanceMonthRate: 0.74, averageRankVolatility: 0.11 },
      strong: {
        averageRank: 1.1,
        dominanceMonthRate: 0.94,
        averageTopScoreGap: 10.5,
        averageGuestCap: 1.55,
        averageRankVolatility: 0.08,
      },
      dominant: {
        averageRank: 1,
        dominanceMonthRate: 0.99,
        averageTopScoreGap: 13,
        averageGuestCap: 1.72,
      },
      averageRoi: 0.78,
      largeStakeRoi: 0.92,
    });

    expect(scoreBalancePayload(runaway).total).toBeGreaterThan(scoreBalancePayload(healthy).total);
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
