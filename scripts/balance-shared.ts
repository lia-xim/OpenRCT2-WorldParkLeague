import {
  buyInvestmentByRivalId,
  refreshInvestmentSummary,
  sellInvestmentByRivalId,
} from "../src/domain/investments";
import { DAYS_PER_MONTH } from "../src/config";
import { createInitialState, simulateMonth } from "../src/domain/simulation";
import type { PlayerSnapshot, SimulationConfig } from "../src/types";

export interface ScenarioDefinition {
  key: string;
  label: string;
  snapshot: Partial<
    Omit<PlayerSnapshot, "parkName" | "currentMonth" | "currentDay" | "currentDayIndex">
  >;
}

export interface ScenarioAggregate {
  key: string;
  label: string;
  averageRank: number;
  averageRankVolatility: number;
  averageTopScoreGap: number;
  averageTop3Share: number;
  averageShare: number;
  averageGuestCap: number;
  minGuestCap: number;
  maxGuestCap: number;
  averageGovernanceImpact: number;
  averageBoard: number;
  averageInvestors: number;
  averageMonthsAtTop: number;
  averageLongestTopStreak: number;
  averagePrestigeScore: number;
  averageAchievementsUnlocked: number;
  averageSpotlightWins: number;
  averageYearlyAwards: number;
  dominanceMonthRate: number;
}

export interface InvestmentAggregate {
  lotShare: number;
  seeds: number;
  averageInitialCost: number;
  averageNetProfit: number;
  averageRoi: number;
  averageDividends: number;
  averageSaleProceeds: number;
  averageFinalTargetValue: number;
}

export interface BalanceAnalysisPayload {
  months: number;
  seeds: number;
  configOverride: Partial<SimulationConfig>;
  scenarios: ScenarioAggregate[];
  investments: InvestmentAggregate[];
}

export interface BalanceAnalysisOptions {
  months?: number;
  seeds?: number;
  configOverride?: Partial<SimulationConfig>;
  scenarios?: ScenarioDefinition[];
}

export const DEFAULT_MONTHS = 48;
export const DEFAULT_SEEDS = 30;

export const DEFAULT_SCENARIOS: ScenarioDefinition[] = [
  {
    key: "weak",
    label: "Weak recovery park",
    snapshot: {
      parkRating: 720,
      guests: 820,
      companyValue: 1_300_000,
      parkValue: 1_440_000,
      cash: 20_000,
      bankLoan: 160_000,
      lastMonthRevenue: 28_000,
      lastMonthOperatingCosts: 30_000,
      lastMonthOperatingProfit: -2_000,
      totalRideCount: 8,
      openRideCount: 6,
      stallCount: 3,
      averageRideExcitement: 5.2,
      averageRideSatisfaction: 66,
      totalRideProfit: 22_000,
    },
  },
  {
    key: "mid",
    label: "Stable mid-table park",
    snapshot: {
      parkRating: 835,
      guests: 1550,
      companyValue: 2_550_000,
      parkValue: 2_538_000,
      cash: 52_000,
      bankLoan: 40_000,
      lastMonthRevenue: 61_000,
      lastMonthOperatingCosts: 45_000,
      lastMonthOperatingProfit: 16_000,
      totalRideCount: 13,
      openRideCount: 10,
      stallCount: 5,
      averageRideExcitement: 6.6,
      averageRideSatisfaction: 79,
      totalRideProfit: 72_000,
    },
  },
  {
    key: "strong",
    label: "Strong contender",
    snapshot: {
      parkRating: 910,
      guests: 2600,
      companyValue: 4_900_000,
      parkValue: 4_780_000,
      cash: 120_000,
      bankLoan: 0,
      lastMonthRevenue: 108_000,
      lastMonthOperatingCosts: 72_000,
      lastMonthOperatingProfit: 36_000,
      totalRideCount: 19,
      openRideCount: 16,
      stallCount: 7,
      averageRideExcitement: 7.5,
      averageRideSatisfaction: 90,
      totalRideProfit: 128_000,
    },
  },
  {
    key: "dominant",
    label: "Dominant endgame park",
    snapshot: {
      parkRating: 960,
      guests: 3600,
      companyValue: 7_800_000,
      parkValue: 7_540_000,
      cash: 260_000,
      bankLoan: 0,
      lastMonthRevenue: 168_000,
      lastMonthOperatingCosts: 108_000,
      lastMonthOperatingProfit: 60_000,
      totalRideCount: 25,
      openRideCount: 22,
      stallCount: 9,
      averageRideExcitement: 8.2,
      averageRideSatisfaction: 95,
      totalRideProfit: 185_000,
    },
  },
];

export function runBalanceAnalysis(options: BalanceAnalysisOptions = {}): BalanceAnalysisPayload {
  const months = options.months ?? DEFAULT_MONTHS;
  const seeds = options.seeds ?? DEFAULT_SEEDS;
  const configOverride = options.configOverride ?? {};
  const scenarios = options.scenarios ?? DEFAULT_SCENARIOS;

  return {
    months,
    seeds,
    configOverride,
    scenarios: scenarios.map((scenario) =>
      runScenarioAggregate(scenario, { months, seeds, configOverride })
    ),
    investments: [0.05, 0.1, 0.15].map((lotShare) =>
      runInvestmentAggregate(lotShare, { months, seeds, configOverride, scenarios })
    ),
  };
}

function runScenarioAggregate(
  scenario: ScenarioDefinition,
  options: Required<Pick<BalanceAnalysisOptions, "months" | "seeds" | "configOverride">>
): ScenarioAggregate {
  const { months, seeds, configOverride } = options;
  let rankSum = 0;
  let rankVolatilitySum = 0;
  let topScoreGapSum = 0;
  let top3ShareSum = 0;
  let shareSum = 0;
  let guestCapSum = 0;
  let governanceImpactSum = 0;
  let boardSum = 0;
  let investorSum = 0;
  let monthsAtTopSum = 0;
  let longestTopStreakSum = 0;
  let prestigeScoreSum = 0;
  let achievementsUnlockedSum = 0;
  let spotlightWinsSum = 0;
  let yearlyAwardsSum = 0;
  let dominanceMonths = 0;
  let minGuestCap = Number.POSITIVE_INFINITY;
  let maxGuestCap = Number.NEGATIVE_INFINITY;

  for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
    const parkName = `scenario-seed-${seedIndex + 1}`;
    let state = createInitialState(0, parkName);
    applyConfigOverride(state, configOverride);
    let previousRank: number | null = null;
    let currentTopStreak = 0;
    let longestTopStreak = 0;

    for (let month = 0; month < months; month += 1) {
      const snapshot = createSnapshot(parkName, month, scenario.snapshot);
      const result = simulateMonth(state, snapshot, month);
      state = result.nextState;
      assertFiniteState(state, scenario.key, seedIndex, month);

      const currentRank = state.player.currentRank ?? state.world.leaderboard.length;
      const topScoreGap = calculateTopScoreGap(state);
      const top3Share = state.world.leaderboard
        .slice(0, 3)
        .reduce((sum, entry) => sum + entry.marketShare, 0);

      rankSum += currentRank;
      if (previousRank !== null) {
        rankVolatilitySum += Math.abs(currentRank - previousRank);
      }
      topScoreGapSum += topScoreGap;
      top3ShareSum += top3Share;
      shareSum += state.player.marketShare;
      guestCapSum += state.player.guestCapModifier;
      governanceImpactSum += state.player.governance.guestCapImpact;
      boardSum += state.player.governance.boardPatience;
      investorSum += state.player.governance.investorConfidence;
      monthsAtTopSum += currentRank === 1 ? 1 : 0;
      prestigeScoreSum += state.player.prestige.prestigeScore;
      achievementsUnlockedSum += state.player.prestige.unlockedAchievements.length;
      spotlightWinsSum += state.player.prestige.records.totalSpotlightWins;
      yearlyAwardsSum += state.player.prestige.records.totalYearlyAwards;
      minGuestCap = Math.min(minGuestCap, state.player.guestCapModifier);
      maxGuestCap = Math.max(maxGuestCap, state.player.guestCapModifier);

      const leader = state.world.leaderboard[0];
      if (leader && (leader.marketShare >= 0.08 || topScoreGap >= 8)) {
        dominanceMonths += 1;
      }

      if (currentRank === 1) {
        currentTopStreak += 1;
        longestTopStreak = Math.max(longestTopStreak, currentTopStreak);
      } else {
        currentTopStreak = 0;
      }

      previousRank = currentRank;
    }

    longestTopStreakSum += longestTopStreak;
  }

  const samples = seeds * months;
  return {
    key: scenario.key,
    label: scenario.label,
    averageRank: rankSum / samples,
    averageRankVolatility: rankVolatilitySum / Math.max(1, seeds * (months - 1)),
    averageTopScoreGap: topScoreGapSum / samples,
    averageTop3Share: top3ShareSum / samples,
    averageShare: shareSum / samples,
    averageGuestCap: guestCapSum / samples,
    minGuestCap,
    maxGuestCap,
    averageGovernanceImpact: governanceImpactSum / samples,
    averageBoard: boardSum / samples,
    averageInvestors: investorSum / samples,
    averageMonthsAtTop: monthsAtTopSum / seeds,
    averageLongestTopStreak: longestTopStreakSum / seeds,
    averagePrestigeScore: prestigeScoreSum / samples,
    averageAchievementsUnlocked: achievementsUnlockedSum / samples,
    averageSpotlightWins: spotlightWinsSum / samples,
    averageYearlyAwards: yearlyAwardsSum / samples,
    dominanceMonthRate: dominanceMonths / samples,
  };
}

function runInvestmentAggregate(
  lotShare: number,
  options: Required<Pick<BalanceAnalysisOptions, "months" | "seeds" | "configOverride">> & {
    scenarios: ScenarioDefinition[];
  }
): InvestmentAggregate {
  const { months, seeds, configOverride, scenarios } = options;
  let initialCostSum = 0;
  let netProfitSum = 0;
  let dividendSum = 0;
  let saleProceedsSum = 0;
  let finalTargetValueSum = 0;
  let processedSeeds = 0;

  for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
    const parkName = `investment-seed-${seedIndex + 1}`;
    let state = createInitialState(0, parkName);
    applyConfigOverride(state, configOverride);
    const midScenario = getScenarioByKey(scenarios, "mid");
    const midSnapshot = createSnapshot(parkName, 0, midScenario.snapshot);
    const initialResult = simulateMonth(state, midSnapshot, 0);
    state = initialResult.nextState;

    const target = state.world.leaderboard.find((entry) => !entry.isPlayer && entry.rank === 3);
    if (!target) {
      continue;
    }

    const buyResult = buyInvestmentByRivalId(state, target.parkId, 5_000_000, 1, lotShare);
    if (!buyResult.ok) {
      continue;
    }

    state = buyResult.state;
    let dividends = 0;

    for (let month = 1; month < months; month += 1) {
      const snapshot = createSnapshot(parkName, month, midScenario.snapshot);
      const result = simulateMonth(state, snapshot, month);
      state = result.nextState;
      assertFiniteState(state, "investment", seedIndex, month);
      dividends += state.player.investmentSummary.lastMonthCashDelta;
    }

    const finalTarget = state.world.rivals.find((rival) => rival.id === target.parkId) ?? null;
    const sellResult = sellInvestmentByRivalId(state, target.parkId);
    if (!sellResult.ok) {
      continue;
    }

    refreshInvestmentSummary(sellResult.state, 0);
    const saleProceeds = sellResult.cashDelta;
    const initialCost = Math.abs(buyResult.cashDelta);
    const netProfit = dividends + saleProceeds - initialCost;

    initialCostSum += initialCost;
    netProfitSum += netProfit;
    dividendSum += dividends;
    saleProceedsSum += saleProceeds;
    finalTargetValueSum += finalTarget?.finance.companyValue ?? 0;
    processedSeeds += 1;
  }

  const processed = Math.max(1, processedSeeds);
  return {
    lotShare,
    seeds: processedSeeds,
    averageInitialCost: initialCostSum / processed,
    averageNetProfit: netProfitSum / processed,
    averageRoi: initialCostSum > 0 ? netProfitSum / initialCostSum : 0,
    averageDividends: dividendSum / processed,
    averageSaleProceeds: saleProceedsSum / processed,
    averageFinalTargetValue: finalTargetValueSum / processed,
  };
}

function applyConfigOverride(
  state: ReturnType<typeof createInitialState>,
  configOverride: Partial<SimulationConfig>
): void {
  state.config = {
    ...state.config,
    ...configOverride,
  };
  state.world.spotlightGuestMultiplier = state.config.spotlightGuestMultiplier;
  state.world.featuredGuestMultiplier = state.config.featuredGuestMultiplier;
  state.world.breakoutGuestMultiplier = state.config.breakoutGuestMultiplier;
}

function calculateTopScoreGap(state: ReturnType<typeof createInitialState>): number {
  const leader = state.world.leaderboard[0];
  const second = state.world.leaderboard[1];
  if (!leader || !second) {
    return 0;
  }

  return leader.score - second.score;
}

function createSnapshot(
  parkName: string,
  currentMonth: number,
  values: Partial<
    Omit<PlayerSnapshot, "parkName" | "currentMonth" | "currentDay" | "currentDayIndex">
  >
): PlayerSnapshot {
  const base = createSnapshotBase();
  const currentDay = DAYS_PER_MONTH;

  return {
    parkName,
    currentMonth,
    currentDay,
    currentDayIndex: currentMonth * DAYS_PER_MONTH + (currentDay - 1),
    ...base,
    ...values,
  };
}

function createSnapshotBase(): Omit<
  PlayerSnapshot,
  "parkName" | "currentMonth" | "currentDay" | "currentDayIndex"
> {
  return {
    parkRating: 760,
    guests: 1_100,
    parkValue: 1_900_000,
    companyValue: 1_840_000,
    cash: 35_000,
    bankLoan: 90_000,
    lastMonthRevenue: 42_000,
    lastMonthOperatingCosts: 35_000,
    lastMonthOperatingProfit: 7_000,
    totalRideCount: 10,
    openRideCount: 8,
    stallCount: 4,
    averageRideExcitement: 5.8,
    averageRideSatisfaction: 72,
    totalRideProfit: 36_000,
  };
}

function assertFiniteState(
  state: ReturnType<typeof createInitialState>,
  scenarioKey: string,
  seedIndex: number,
  month: number
): void {
  const metrics = [
    state.player.score,
    state.player.marketShare,
    state.player.guestCapModifier,
    state.player.liveMomentum,
  ];

  if (metrics.some((value) => !Number.isFinite(value))) {
    throw new Error(
      `Non-finite league state for ${scenarioKey} seed ${seedIndex + 1} month ${month + 1}`
    );
  }
}

function getScenarioByKey(scenarios: ScenarioDefinition[], key: string): ScenarioDefinition {
  const scenario = scenarios.find((candidate) => candidate.key === key);
  if (!scenario) {
    throw new Error(`Balance analysis is missing the ${key} scenario definition.`);
  }

  return scenario;
}
