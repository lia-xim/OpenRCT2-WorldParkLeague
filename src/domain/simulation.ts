import {
  BREAKOUT_GUEST_MULTIPLIER,
  BREAKOUT_TITLE,
  CURRENT_SCHEMA_VERSION,
  DAYS_PER_MONTH,
  DEFAULT_CONFIG,
  FEATURED_GUEST_MULTIPLIER,
  FEATURED_TITLE,
  PLAYER_PARK_ID,
  PLUGIN_VERSION,
  SEASON_FACTORS,
  SPOTLIGHT_TITLE,
  SUPPORTING_BOOST_DURATION_DAYS,
  WORLD_DEMAND_BASE,
} from "../config";
import { advancePlayerEquityMarket, createInitialEquityState } from "./equity";
import { formatCompactMoney } from "./currency";
import { getDifficultyProfile } from "./difficulty";
import { advancePlayerGovernance, createInitialGovernanceState } from "./governance";
import { recordHistoryMarkers, recordHistorySnapshot } from "./history";
import { refreshInvestmentSummary, settleInvestmentsForMonth } from "./investments";
import {
  createInitialOwnerState,
  recordOwnerCashFlowSummary,
} from "./owner";
import {
  advancePlayerObjective,
  createInitialObjectiveState,
  maybeStartPlayerObjective,
} from "./objectives";
import {
  advancePlayerActionsForDay,
  createInitialPlayerActionState,
  getPlayerActionEffects,
} from "./playerActions";
import {
  advancePrestigeRewardsForDays,
  createInitialPrestigeState,
  getPrestigeRewardEffects,
  updatePrestigeProgress,
} from "./prestige";
import { calculateGuestCapModifier, calculatePlayerScore, createPlayerLeaderboardEntry } from "./player";
import { createInitialWatchlistState, updateWatchlistForCycle } from "./watchlist";
import { average, clamp, deepClone, meanRevert, roundTo, sum } from "./math";
import { computeRivalScore, createInitialRivals, getRegionLabel } from "./rivals";
import { createScopedRng, hashString } from "./random";
import {
  advanceRivalChallenge,
  createInitialRivalChallengeState,
  getPrimaryRivalSummary,
  maybeStartRivalChallenge,
} from "./rivalry";
import type {
  AwardRecord,
  LeaderboardEntry,
  LivePulseResult,
  MonthlySimulationResult,
  NewsItem,
  PlayerSnapshot,
  RegionKey,
  RegionMarketState,
  RivalPark,
  WorldParkLeagueState,
} from "../types";

interface RivalSimulationOutcome {
  rival: RivalPark;
  news: NewsItem[];
}

interface RivalIdentityProfile {
  macroSensitivity: number;
  tourismSensitivity: number;
  competitionSensitivity: number;
  capitalSensitivity: number;
  regionalDemandSensitivity: number;
  regionalTourismSensitivity: number;
  volatilityScale: number;
  resilience: number;
  monetization: number;
  valuationNarrative: number;
  safetySensitivity: number;
}

export function createInitialState(currentMonth: number, parkName: string): WorldParkLeagueState {
  return createInitialStateAtDay(currentMonth, currentMonth * DAYS_PER_MONTH, parkName);
}

export function createInitialStateAtDay(
  currentMonth: number,
  currentDayIndex: number,
  parkName: string
): WorldParkLeagueState {
  const seed = hashString(`${parkName}:${currentMonth}:world-park-league`);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    pluginVersion: PLUGIN_VERSION,
    seededAtMonth: currentMonth,
    lastSimulatedMonth: currentMonth - 1,
    lastLivePulseDayIndex: currentDayIndex,
    lastLiveEventDayIndex: currentDayIndex,
    config: { ...DEFAULT_CONFIG },
    world: {
      seed,
      economyIndex: 1,
      tourismIndex: 1,
      competitionHeat: 1,
      capitalMarketMood: 1,
      globalDemand: WORLD_DEMAND_BASE,
      seasonFactor: SEASON_FACTORS[currentMonth % SEASON_FACTORS.length] ?? 1,
      structuralGrowthIndex: 1,
      safetyScrutinyMonthsRemaining: 0,
      spotlightParkId: null,
      spotlightParkName: null,
      spotlightMonthsRemaining: 0,
      spotlightGuestMultiplier: DEFAULT_CONFIG.spotlightGuestMultiplier,
      spotlightRewardOverrideParkId: null,
      spotlightRewardOverrideDaysRemaining: 0,
      spotlightDebugOverrideParkId: null,
      spotlightDebugOverrideDaysRemaining: 0,
      featuredParkId: null,
      featuredParkName: null,
      featuredDaysRemaining: 0,
      featuredGuestMultiplier: DEFAULT_CONFIG.featuredGuestMultiplier,
      featuredRewardOverrideParkId: null,
      featuredRewardOverrideDaysRemaining: 0,
      featuredDebugOverrideParkId: null,
      featuredDebugOverrideDaysRemaining: 0,
      breakoutParkId: null,
      breakoutParkName: null,
      breakoutDaysRemaining: 0,
      breakoutGuestMultiplier: DEFAULT_CONFIG.breakoutGuestMultiplier,
      breakoutRewardOverrideParkId: null,
      breakoutRewardOverrideDaysRemaining: 0,
      breakoutDebugOverrideParkId: null,
      breakoutDebugOverrideDaysRemaining: 0,
      regionMarkets: createInitialRegionMarkets(),
      rivals: createInitialRivals(seed, DEFAULT_CONFIG.rivalCount),
      newsFeed: [],
      awards: [],
      leaderboard: [],
      history: {
        [PLAYER_PARK_ID]: [],
      },
      historyEvents: {
        [PLAYER_PARK_ID]: [],
      },
    },
    player: {
      parkName,
      currentRank: null,
      previousRank: null,
      previousScore: 0,
      score: 0,
      liveMomentum: 0,
      marketShare: 0,
      guestCapModifier: 1,
      monthsAtRankOne: 0,
      activeAwardTitle: null,
      activeAwardMonthsRemaining: 0,
      owner: createInitialOwnerState(),
      investments: [],
      investmentSummary: {
        holdings: 0,
        investedCapital: 0,
        portfolioValue: 0,
        totalDividendsReceived: 0,
        realizedProfit: 0,
        lastMonthCashDelta: 0,
      },
      equity: createInitialEquityState(),
      governance: createInitialGovernanceState(currentMonth),
      actions: createInitialPlayerActionState(),
      watchlist: createInitialWatchlistState(),
      rivalry: createInitialRivalChallengeState(),
      objectives: createInitialObjectiveState(),
      prestige: createInitialPrestigeState(),
    },
  };
}

export function simulateMonth(
  state: WorldParkLeagueState,
  playerSnapshot: PlayerSnapshot,
  month: number
): MonthlySimulationResult {
  const nextState = deepClone(state);
  const headlines: NewsItem[] = [];
  const playerNotifications: string[] = [];
  let parkRewardCashDelta = 0;
  const rng = createScopedRng(nextState.world.seed, month, nextState.world.rivals.length);

  nextState.player.parkName = playerSnapshot.parkName;
  nextState.world.seasonFactor = SEASON_FACTORS[month % SEASON_FACTORS.length] ?? 1;
  applyStructuralMarketGrowth(nextState);
  applyOngoingWorldEffects(nextState);
  nextState.world.economyIndex = meanRevert(
    nextState.world.economyIndex,
    1,
    0.18,
    rng.float(-0.045, 0.045),
    0.8,
    1.22
  );
  nextState.world.tourismIndex = meanRevert(
    nextState.world.tourismIndex,
    1,
    0.16,
    rng.float(-0.05, 0.05),
    0.78,
    1.24
  );
  nextState.world.capitalMarketMood = meanRevert(
    nextState.world.capitalMarketMood,
    1,
    0.2,
    rng.float(-0.05, 0.05),
    0.78,
    1.25
  );
  nextState.world.competitionHeat = meanRevert(
    nextState.world.competitionHeat,
    1,
    0.1,
    rng.float(-0.035, 0.05),
    0.9,
    1.24
  );
  updateRegionMarkets(nextState, month, headlines);

  const worldEvent = rollWorldEvent(nextState, month);
  if (worldEvent) {
    headlines.push(worldEvent);
  }

  const priorPlayerLeadShare =
    nextState.player.currentRank === 1 ? nextState.player.marketShare : 0;
  const priorMonthsAtRankOne = nextState.player.monthsAtRankOne;

  playerNotifications.push(...advancePrestigeRewardsForDays(nextState, DAYS_PER_MONTH));

  const rivalOutcomes = nextState.world.rivals.map((rival, index) =>
    simulateRivalMonth(
      rival,
      nextState,
      month,
      index,
      priorPlayerLeadShare,
      priorMonthsAtRankOne
    )
  );
  nextState.world.rivals = rivalOutcomes.map((outcome) => outcome.rival);
  for (const outcome of rivalOutcomes) {
    headlines.push(...outcome.news);
  }

  const structuralNews = maybeRunStructuralEvent(nextState, month);
  if (structuralNews) {
    headlines.push(structuralNews);
  }

  if (
    nextState.world.rivals.filter((rival) => rival.status.active).length <
    nextState.config.rivalCount
  ) {
    const challengerNews = spawnReplacementChallenger(nextState, month);
    if (challengerNews) {
      headlines.push(challengerNews);
    }
  }

  const playerScore = calculatePlayerScore(playerSnapshot);
  const playerActionEffects = getPlayerActionEffects(nextState);
  const prestigeRewardEffects = getPrestigeRewardEffects(nextState);
  const effectivePlayerScore = applyPlayerLeaguePressure(
    nextState,
    playerScore + playerActionEffects.scoreBonus + prestigeRewardEffects.scoreBonus
  );
  nextState.player.liveMomentum = calculatePlayerLiveMomentum(nextState, playerSnapshot, playerScore);
  const leaderboard = buildLeaderboard(
    nextState,
    playerSnapshot,
    effectivePlayerScore,
    nextState.player.liveMomentum
  );
  nextState.world.leaderboard = leaderboard;

  const playerEntry = leaderboard.find((entry) => entry.parkId === PLAYER_PARK_ID) ?? null;
  nextState.player.previousRank = nextState.player.currentRank;
  nextState.player.previousScore = nextState.player.score;
  nextState.player.currentRank = playerEntry?.rank ?? null;
  nextState.player.score = roundTo(
    effectivePlayerScore,
    2
  );
  nextState.player.marketShare = playerEntry?.marketShare ?? 0;
  nextState.player.monthsAtRankOne =
    nextState.player.currentRank === 1 ? nextState.player.monthsAtRankOne + 1 : 0;
  const spotlightNews = syncSpotlightState(nextState, month);
  if (spotlightNews) {
    headlines.push(spotlightNews);
  }
  headlines.push(...syncSupportingBoostStates(nextState, month * DAYS_PER_MONTH, month));
  playerNotifications.push(
    ...updateWatchlistForCycle(
      state,
      nextState,
      month * DAYS_PER_MONTH,
      month
    )
  );
  const challengeResolution = advanceRivalChallenge(nextState, playerSnapshot, month * DAYS_PER_MONTH);
  parkRewardCashDelta += challengeResolution.cashDelta;
  playerNotifications.push(...challengeResolution.notifications);
  headlines.push(...challengeResolution.headlines.map((item) =>
    createNews(
      month,
      "player",
      item.success ? "success" : "warning",
      item.title,
      item.detail,
      item.rivalId
    )
  ));
  playerNotifications.push(...maybeStartRivalChallenge(nextState, month * DAYS_PER_MONTH, comparisonRivalId(nextState)));
  const objectiveResolution = advancePlayerObjective(nextState, playerSnapshot, month * DAYS_PER_MONTH);
  parkRewardCashDelta += objectiveResolution.cashDelta;
  playerNotifications.push(...objectiveResolution.notifications);
  headlines.push(...objectiveResolution.headlines);
  playerNotifications.push(...maybeStartPlayerObjective(nextState, playerSnapshot, month * DAYS_PER_MONTH));
  const pressureCampaign = maybeTriggerRivalPressureCampaign(nextState, month);
  if (pressureCampaign) {
    headlines.push(pressureCampaign.news);
    playerNotifications.push(pressureCampaign.notification);
  }

  decrementAwardDurations(nextState);
  const awardNews = maybeGrantYearlyAward(nextState, month);
  if (awardNews) {
    headlines.push(awardNews);
  }

  const settlement = settleInvestmentsForMonth(nextState, month);
  playerNotifications.push(...settlement.notifications);
  nextState.player = settlement.state.player;
  nextState.world = settlement.state.world;

  const governanceResult = advancePlayerGovernance(nextState, playerSnapshot, month);
  headlines.push(...governanceResult.news);
  playerNotifications.push(...governanceResult.notifications);

  const equityResult = advancePlayerEquityMarket(nextState, playerSnapshot, month);
  headlines.push(...equityResult.news);
  playerNotifications.push(...equityResult.notifications);
  nextState.player.guestCapModifier = roundTo(
    clamp(
      calculateGuestCapModifier(
        nextState.player.currentRank,
        leaderboard.length,
        nextState.player.marketShare,
        nextState.player.activeAwardMonthsRemaining,
        nextState.world.economyIndex,
        nextState.world.tourismIndex,
        nextState.config
      ) *
        getPlayerSpotlightGuestMultiplier(nextState) *
        nextState.player.governance.guestCapImpact *
        (1 + playerActionEffects.guestCapBonus + prestigeRewardEffects.guestCapBonus),
      0.75,
      15
    ),
    3
  );
  refreshInvestmentSummary(nextState, settlement.cashDelta);
  recordHistorySnapshot(nextState, playerSnapshot, month * DAYS_PER_MONTH);
  recordHistoryMarkers(nextState, headlines, month * DAYS_PER_MONTH);
  const prestigeUpdate = updatePrestigeProgress(nextState, playerSnapshot, headlines);
  playerNotifications.push(...prestigeUpdate.notifications);
  parkRewardCashDelta += settlement.cashDelta + prestigeUpdate.cashDelta;
  if (parkRewardCashDelta !== 0) {
    playerNotifications.push(
      `League cashflow changed park cash by ${formatSignedMoneyCompact(parkRewardCashDelta)}.`
    );
  }
  recordOwnerCashFlowSummary(
    nextState,
    buildOwnerCashFlowSummary(
      0,
      settlement.cashDelta,
      prestigeUpdate.cashDelta,
      challengeResolution.cashDelta
    ),
    0
  );
  advanceSpotlightDebugOverride(nextState, DAYS_PER_MONTH);

  nextState.lastSimulatedMonth = month;
  nextState.world.newsFeed = [...headlines, ...nextState.world.newsFeed].slice(
    0,
    nextState.config.newsRetention
  );

  return {
    nextState,
    month,
    headlines,
    parkCashDelta: parkRewardCashDelta,
    ownerCashDelta: 0,
    playerNotifications,
  };
}

export function simulateLivePulse(
  state: WorldParkLeagueState,
  playerSnapshot: PlayerSnapshot,
  dayIndex: number
): LivePulseResult {
  const nextState = deepClone(state);
  const headlines: NewsItem[] = [];
  const playerNotifications: string[] = [];
  let parkRewardCashDelta = 0;
  const rng = createScopedRng(nextState.world.seed, dayIndex, 9201);
  const priorRank = nextState.player.currentRank;
  const priorScore = nextState.player.score;
  const priorLeadShare = nextState.player.currentRank === 1 ? nextState.player.marketShare : 0;
  const priorMonthsAtRankOne = nextState.player.monthsAtRankOne;
  const allowLiveEvents =
    dayIndex - nextState.lastLiveEventDayIndex >= nextState.config.liveEventIntervalDays;

  nextState.player.parkName = playerSnapshot.parkName;
  playerNotifications.push(...advancePlayerActionsForDay(nextState));
  playerNotifications.push(
    ...advancePrestigeRewardsForDays(nextState, Math.max(1, nextState.config.livePulseIntervalDays))
  );
  nextState.world.economyIndex = meanRevert(
    nextState.world.economyIndex,
    1,
    0.03,
    rng.float(-0.004, 0.004),
    0.8,
    1.22
  );
  nextState.world.tourismIndex = meanRevert(
    nextState.world.tourismIndex,
    1,
    0.03,
    rng.float(-0.0045, 0.0045),
    0.78,
    1.24
  );
  nextState.world.capitalMarketMood = meanRevert(
    nextState.world.capitalMarketMood,
    1,
    0.035,
    rng.float(-0.005, 0.005),
    0.78,
    1.25
  );
  nextState.world.competitionHeat = meanRevert(
    nextState.world.competitionHeat,
    1,
    0.025,
    rng.float(-0.003, 0.004),
    0.9,
    1.24
  );

  updateRegionMarketsForPulse(nextState, dayIndex, headlines, allowLiveEvents);
  const worldSignal = allowLiveEvents ? rollPulseWorldSignal(nextState, dayIndex) : null;
  if (worldSignal) {
    headlines.push(worldSignal);
  }
  if (allowLiveEvents) {
    nextState.lastLiveEventDayIndex = dayIndex;
  }

  nextState.world.rivals = nextState.world.rivals.map((rival, index) =>
    simulateRivalPulse(
      rival,
      nextState,
      dayIndex,
      index,
      priorLeadShare,
      priorMonthsAtRankOne,
      headlines,
      allowLiveEvents
    )
  );

  const playerScore = calculatePlayerScore(playerSnapshot);
  const playerActionEffects = getPlayerActionEffects(nextState);
  const prestigeRewardEffects = getPrestigeRewardEffects(nextState);
  const effectivePlayerScore = applyPlayerLeaguePressure(
    nextState,
    playerScore + playerActionEffects.scoreBonus + prestigeRewardEffects.scoreBonus
  );
  nextState.player.liveMomentum = calculatePlayerLiveMomentum(nextState, playerSnapshot, playerScore);
  const leaderboard = buildLeaderboard(
    nextState,
    playerSnapshot,
    effectivePlayerScore,
    nextState.player.liveMomentum
  );
  nextState.world.leaderboard = leaderboard;

  const playerEntry = leaderboard.find((entry) => entry.parkId === PLAYER_PARK_ID) ?? null;
  nextState.player.previousRank = nextState.player.currentRank;
  nextState.player.previousScore = nextState.player.score;
  nextState.player.currentRank = playerEntry?.rank ?? null;
  nextState.player.score = roundTo(
    effectivePlayerScore,
    2
  );
  nextState.player.marketShare = playerEntry?.marketShare ?? 0;
  const spotlightNews = syncSpotlightState(nextState, Math.floor(dayIndex / DAYS_PER_MONTH));
  if (spotlightNews) {
    headlines.push(spotlightNews);
  }
  if (allowLiveEvents) {
    headlines.push(
      ...syncSupportingBoostStates(nextState, dayIndex, Math.floor(dayIndex / DAYS_PER_MONTH))
    );
  }
  playerNotifications.push(
    ...updateWatchlistForCycle(
      state,
      nextState,
      dayIndex,
      Math.floor(dayIndex / DAYS_PER_MONTH)
    )
  );
  const challengeResolution = advanceRivalChallenge(nextState, playerSnapshot, dayIndex);
  parkRewardCashDelta += challengeResolution.cashDelta;
  playerNotifications.push(...challengeResolution.notifications);
  headlines.push(...challengeResolution.headlines.map((item) =>
    createNews(
      Math.floor(dayIndex / DAYS_PER_MONTH),
      "player",
      item.success ? "success" : "warning",
      item.title,
      item.detail,
      item.rivalId
    )
  ));
  playerNotifications.push(...maybeStartRivalChallenge(nextState, dayIndex, comparisonRivalId(nextState)));
  const objectiveResolution = advancePlayerObjective(nextState, playerSnapshot, dayIndex);
  parkRewardCashDelta += objectiveResolution.cashDelta;
  playerNotifications.push(...objectiveResolution.notifications);
  headlines.push(...objectiveResolution.headlines);
  playerNotifications.push(...maybeStartPlayerObjective(nextState, playerSnapshot, dayIndex));
  nextState.player.guestCapModifier = roundTo(
    clamp(
      calculateGuestCapModifier(
        nextState.player.currentRank,
        leaderboard.length,
        nextState.player.marketShare,
        nextState.player.activeAwardMonthsRemaining,
        nextState.world.economyIndex,
        nextState.world.tourismIndex,
        nextState.config
      ) *
        getPlayerSpotlightGuestMultiplier(nextState) *
        nextState.player.governance.guestCapImpact *
        (1 + playerActionEffects.guestCapBonus + prestigeRewardEffects.guestCapBonus),
      0.75,
      15
    ),
    3
  );
  refreshInvestmentSummary(nextState, 0);
  recordHistorySnapshot(nextState, playerSnapshot, dayIndex);
  recordHistoryMarkers(nextState, headlines, dayIndex);
  const prestigeUpdate = updatePrestigeProgress(nextState, playerSnapshot, headlines);
  playerNotifications.push(...prestigeUpdate.notifications);
  parkRewardCashDelta += prestigeUpdate.cashDelta;
  if (parkRewardCashDelta !== 0) {
    playerNotifications.push(
      `League cashflow changed park cash by ${formatSignedMoneyCompact(parkRewardCashDelta)}.`
    );
  }
  recordOwnerCashFlowSummary(
    nextState,
    buildOwnerCashFlowSummary(0, 0, prestigeUpdate.cashDelta, challengeResolution.cashDelta),
    0
  );
  advanceSpotlightDebugOverride(nextState, Math.max(1, nextState.config.livePulseIntervalDays));
  nextState.lastLivePulseDayIndex = dayIndex;

  if (priorRank && nextState.player.currentRank) {
    const rankDelta = priorRank - nextState.player.currentRank;
    if (rankDelta >= 2) {
      playerNotifications.push(
        `Live pulse: your park jumped ${rankDelta} place(s) to rank ${nextState.player.currentRank}.`
      );
    } else if (rankDelta <= -2) {
      playerNotifications.push(
        `Live pulse: your park slipped ${Math.abs(rankDelta)} place(s) to rank ${nextState.player.currentRank}.`
      );
    }
  }

  if (Math.abs(nextState.player.score - priorScore) >= 2.2) {
    playerNotifications.push(
      `Live pulse: score moved ${formatSignedMetric(nextState.player.score - priorScore)} to ${nextState.player.score.toFixed(1)}.`
    );
  }

  nextState.world.newsFeed = [...headlines, ...nextState.world.newsFeed].slice(
    0,
    nextState.config.newsRetention
  );

  return {
    nextState,
    dayIndex,
    headlines,
    parkCashDelta: parkRewardCashDelta,
    ownerCashDelta: 0,
    playerNotifications,
  };
}

function buildOwnerCashFlowSummary(
  salaryDelta: number,
  portfolioDelta: number,
  prestigeDelta: number,
  challengeDelta: number
): string | null {
  const parts: string[] = [];
  if (salaryDelta !== 0) {
    parts.push(`Salary ${formatSignedMoneyCompact(salaryDelta)}`);
  }
  if (portfolioDelta !== 0) {
    parts.push(`Portfolio ${formatSignedMoneyCompact(portfolioDelta)}`);
  }
  if (prestigeDelta !== 0) {
    parts.push(`Prestige ${formatSignedMoneyCompact(prestigeDelta)}`);
  }
  if (challengeDelta !== 0) {
    parts.push(`Rivalry ${formatSignedMoneyCompact(challengeDelta)}`);
  }

  return parts.length > 0 ? parts.join(" | ") : null;
}

function maybeTriggerRivalPressureCampaign(
  state: WorldParkLeagueState,
  month: number
): { news: NewsItem; notification: string } | null {
  const rank = state.player.currentRank ?? 999;
  const summary = getPrimaryRivalSummary(state, comparisonRivalId(state));
  if (!summary || rank > 10) {
    return null;
  }

  const rng = createScopedRng(state.world.seed, month, 7193, rank);
  const difficulty = getDifficultyProfile(state.config.difficultyPreset);
  const baseChance = rank === 1 ? 0.16 : rank <= 3 ? 0.12 : rank <= 5 ? 0.09 : 0.055;
  const rivalryBonus = summary.isLocalRival ? 0.035 : summary.isWatched ? 0.018 : 0;
  if (!rng.chance((baseChance + rivalryBonus) * difficulty.rivalPressureChanceScale)) {
    return null;
  }

  const intensity =
    (rank === 1 ? 1.25 : rank <= 3 ? 1.05 : 0.9) * difficulty.rivalPressureImpactScale;
  state.world.competitionHeat = clamp(
    state.world.competitionHeat + 0.026 * intensity,
    0.9,
    1.24
  );
  state.player.governance.investorConfidence = clamp(
    state.player.governance.investorConfidence - 0.035 * intensity,
    0.35,
    1.35
  );
  state.player.governance.boardPatience = clamp(
    state.player.governance.boardPatience - 0.028 * intensity,
    0.35,
    1.35
  );
  state.player.liveMomentum = roundTo(
    clamp(state.player.liveMomentum - 0.8 * intensity, -14, 14),
    2
  );
  state.player.governance.lastReviewSummary = `${summary.rivalName} is pressuring your market position.`;

  const news = createNews(
    month,
    "rival",
    "warning",
    `${summary.rivalName} launches a pressure campaign against your park.`,
    "Discounts, ads and investor whispers are making the climb harder. Board patience, investor confidence and league momentum take a short-term hit.",
    summary.rivalId
  );

  return {
    news,
    notification: `${summary.rivalName} pressure campaign: board patience, investors and momentum took a hit.`,
  };
}

function rollWorldEvent(state: WorldParkLeagueState, month: number): NewsItem | null {
  const rng = createScopedRng(state.world.seed, month, 91);
  const roll = rng.next();

  if (roll < 0.1) {
    state.world.tourismIndex = clamp(state.world.tourismIndex + 0.08, 0.78, 1.24);
    state.world.globalDemand = calculateGlobalDemand(state);
    return createNews(
      month,
      "world",
      "success",
      "Travel boom boosts the global theme park market.",
      "Tourism demand is running hot this month, lifting attendance expectations across the league."
    );
  }

  if (roll < 0.2) {
    state.world.economyIndex = clamp(state.world.economyIndex - 0.06, 0.8, 1.22);
    state.world.capitalMarketMood = clamp(state.world.capitalMarketMood - 0.05, 0.78, 1.25);
    state.world.globalDemand = calculateGlobalDemand(state);
    return createNews(
      month,
      "world",
      "warning",
      "Consumer slowdown cools discretionary spending.",
      "Families are still traveling, but they are spending more cautiously and pushing operators to compete harder."
    );
  }

  if (roll < 0.28) {
    state.world.competitionHeat = clamp(state.world.competitionHeat + 0.08, 0.9, 1.24);
    state.world.globalDemand = calculateGlobalDemand(state);
    return createNews(
      month,
      "world",
      "info",
      "Major operators launch an aggressive campaign cycle.",
      "Competition for market share is intensifying as big parks lean harder into brand and promotion."
    );
  }

  if (roll < 0.35) {
    state.world.safetyScrutinyMonthsRemaining = Math.max(
      state.world.safetyScrutinyMonthsRemaining,
      3
    );
    state.world.tourismIndex = clamp(state.world.tourismIndex - 0.03, 0.78, 1.24);
    state.world.globalDemand = calculateGlobalDemand(state);
    return createNews(
      month,
      "world",
      "warning",
      "A safety debate sweeps across the industry.",
      "Guests and regulators are paying more attention to incidents, putting extra pressure on risky operators."
    );
  }

  state.world.globalDemand = calculateGlobalDemand(state);
  return null;
}

function createInitialRegionMarkets(): Record<RegionKey, RegionMarketState> {
  return {
    north_america: {
      key: "north_america",
      demandModifier: 1.04,
      tourismModifier: 1.03,
      competitionModifier: 1.05,
      spotlightMonthsRemaining: 0,
      slowdownMonthsRemaining: 0,
    },
    europe: {
      key: "europe",
      demandModifier: 1.01,
      tourismModifier: 1.02,
      competitionModifier: 1.01,
      spotlightMonthsRemaining: 0,
      slowdownMonthsRemaining: 0,
    },
    asia_pacific: {
      key: "asia_pacific",
      demandModifier: 1.02,
      tourismModifier: 1.04,
      competitionModifier: 0.99,
      spotlightMonthsRemaining: 0,
      slowdownMonthsRemaining: 0,
    },
    latin_america: {
      key: "latin_america",
      demandModifier: 0.95,
      tourismModifier: 0.98,
      competitionModifier: 0.94,
      spotlightMonthsRemaining: 0,
      slowdownMonthsRemaining: 0,
    },
  };
}

function getRivalIdentityProfile(seed: number, rivalId: string): RivalIdentityProfile {
  return {
    macroSensitivity: deriveIdentityFactor(seed, `${rivalId}:macro`, 0.84, 1.18),
    tourismSensitivity: deriveIdentityFactor(seed, `${rivalId}:tourism`, 0.82, 1.2),
    competitionSensitivity: deriveIdentityFactor(seed, `${rivalId}:competition`, 0.84, 1.18),
    capitalSensitivity: deriveIdentityFactor(seed, `${rivalId}:capital`, 0.82, 1.16),
    regionalDemandSensitivity: deriveIdentityFactor(seed, `${rivalId}:regional-demand`, 0.82, 1.2),
    regionalTourismSensitivity: deriveIdentityFactor(seed, `${rivalId}:regional-tourism`, 0.82, 1.2),
    volatilityScale: deriveIdentityFactor(seed, `${rivalId}:volatility`, 0.82, 1.22),
    resilience: deriveIdentityFactor(seed, `${rivalId}:resilience`, 0.86, 1.18),
    monetization: deriveIdentityFactor(seed, `${rivalId}:monetization`, 0.9, 1.14),
    valuationNarrative: deriveIdentityFactor(seed, `${rivalId}:valuation`, 0.86, 1.18),
    safetySensitivity: deriveIdentityFactor(seed, `${rivalId}:safety`, 0.82, 1.2),
  };
}

function deriveIdentityFactor(
  seed: number,
  key: string,
  min: number,
  max: number
): number {
  const normalized = Math.abs(hashString(`${seed}:${key}`)) % 10_000;
  const fraction = normalized / 9_999;
  return min + (max - min) * fraction;
}

function applyStructuralMarketGrowth(state: WorldParkLeagueState): void {
  const monthlyGrowthMultiplier = Math.pow(
    1 + state.config.annualMarketGrowthRate,
    1 / SEASON_FACTORS.length
  );
  state.world.structuralGrowthIndex = roundTo(
    clamp(state.world.structuralGrowthIndex * monthlyGrowthMultiplier, 1, 5),
    4
  );
}

function applyOngoingWorldEffects(state: WorldParkLeagueState): void {
  if (state.world.safetyScrutinyMonthsRemaining > 0) {
    state.world.safetyScrutinyMonthsRemaining -= 1;
    state.world.competitionHeat = clamp(state.world.competitionHeat + 0.01, 0.9, 1.24);
  }
}

function updateRegionMarkets(
  state: WorldParkLeagueState,
  month: number,
  headlines: NewsItem[]
): void {
  const regionKeys = Object.keys(state.world.regionMarkets) as RegionKey[];

  for (const regionKey of regionKeys) {
    const region = state.world.regionMarkets[regionKey];
    const rng = createScopedRng(state.world.seed, month, hashString(regionKey));

    region.demandModifier = meanRevert(
      region.demandModifier,
      1,
      0.18,
      rng.float(-0.035, 0.035),
      0.86,
      1.18
    );
    region.tourismModifier = meanRevert(
      region.tourismModifier,
      1,
      0.16,
      rng.float(-0.03, 0.03),
      0.88,
      1.16
    );
    region.competitionModifier = meanRevert(
      region.competitionModifier,
      1,
      0.12,
      rng.float(-0.02, 0.03),
      0.88,
      1.14
    );

    if (region.spotlightMonthsRemaining > 0) {
      region.demandModifier = clamp(region.demandModifier + 0.04, 0.86, 1.18);
      region.tourismModifier = clamp(region.tourismModifier + 0.05, 0.88, 1.16);
      region.spotlightMonthsRemaining -= 1;
    }

    if (region.slowdownMonthsRemaining > 0) {
      region.demandModifier = clamp(region.demandModifier - 0.05, 0.86, 1.18);
      region.tourismModifier = clamp(region.tourismModifier - 0.04, 0.88, 1.16);
      region.slowdownMonthsRemaining -= 1;
    }
  }

  const triggerRng = createScopedRng(state.world.seed, month, 1701);
  if (!triggerRng.chance(0.16)) {
    state.world.globalDemand = calculateGlobalDemand(state);
    return;
  }

  const regionKey = triggerRng.pick(regionKeys);
  const region = state.world.regionMarkets[regionKey];

  if (triggerRng.chance(0.52)) {
    region.spotlightMonthsRemaining = Math.max(region.spotlightMonthsRemaining, 2);
    headlines.push(
      createNews(
        month,
        "world",
        "info",
        `${getRegionLabel(regionKey)} enters a tourism upswing.`,
        "Regional demand is strengthening and operators with exposure there should benefit over the next months."
      )
    );
  } else {
    region.slowdownMonthsRemaining = Math.max(region.slowdownMonthsRemaining, 2);
    headlines.push(
      createNews(
        month,
        "world",
        "warning",
        `${getRegionLabel(regionKey)} faces a regional demand slowdown.`,
        "Parks tied to that region will need to work harder for attendance while the headwind persists."
      )
    );
  }

  state.world.globalDemand = calculateGlobalDemand(state);
}

function updateRegionMarketsForPulse(
  state: WorldParkLeagueState,
  dayIndex: number,
  headlines: NewsItem[],
  allowEvents: boolean
): void {
  const regionKeys = Object.keys(state.world.regionMarkets) as RegionKey[];

  for (const regionKey of regionKeys) {
    const region = state.world.regionMarkets[regionKey];
    const rng = createScopedRng(state.world.seed, dayIndex, hashString(`pulse:${regionKey}`));

    region.demandModifier = meanRevert(
      region.demandModifier,
      1,
      0.035,
      rng.float(-0.004, 0.004),
      0.86,
      1.18
    );
    region.tourismModifier = meanRevert(
      region.tourismModifier,
      1,
      0.03,
      rng.float(-0.0038, 0.0038),
      0.88,
      1.16
    );
    region.competitionModifier = meanRevert(
      region.competitionModifier,
      1,
      0.025,
      rng.float(-0.0025, 0.003),
      0.88,
      1.14
    );

    if (region.spotlightMonthsRemaining > 0) {
      region.demandModifier = clamp(region.demandModifier + 0.004, 0.86, 1.18);
      region.tourismModifier = clamp(region.tourismModifier + 0.0045, 0.88, 1.16);
    }

    if (region.slowdownMonthsRemaining > 0) {
      region.demandModifier = clamp(region.demandModifier - 0.0045, 0.86, 1.18);
      region.tourismModifier = clamp(region.tourismModifier - 0.004, 0.88, 1.16);
    }
  }

  if (!allowEvents) {
    state.world.globalDemand = calculateGlobalDemand(state);
    return;
  }

  const triggerRng = createScopedRng(state.world.seed, dayIndex, 2701);
  if (triggerRng.chance(0.06)) {
    const regionKey = triggerRng.pick(regionKeys);
    const region = state.world.regionMarkets[regionKey];
    if (triggerRng.chance(0.55)) {
      region.demandModifier = clamp(region.demandModifier + 0.03, 0.86, 1.18);
      headlines.push(
        createNews(
          Math.floor(dayIndex / DAYS_PER_MONTH),
          "world",
          "info",
          `${getRegionLabel(regionKey)} sees a sharp weekend demand spike.`,
          "Regional bookings and footfall are running hotter than expected, giving exposed operators a short-term boost."
        )
      );
    } else {
      region.demandModifier = clamp(region.demandModifier - 0.03, 0.86, 1.18);
      headlines.push(
        createNews(
          Math.floor(dayIndex / DAYS_PER_MONTH),
          "world",
          "warning",
          `${getRegionLabel(regionKey)} cools off in the short term.`,
          "Demand has softened over the last few days, forcing parks there to compete harder for visitors."
        )
      );
    }
  }

  state.world.globalDemand = calculateGlobalDemand(state);
}

function rollPulseWorldSignal(state: WorldParkLeagueState, dayIndex: number): NewsItem | null {
  const rng = createScopedRng(state.world.seed, dayIndex, 2901);
  if (!rng.chance(0.16)) {
    state.world.globalDemand = calculateGlobalDemand(state);
    return null;
  }

  const roll = rng.next();
  if (roll < 0.34) {
    state.world.tourismIndex = clamp(state.world.tourismIndex + 0.025, 0.78, 1.24);
    state.world.globalDemand = calculateGlobalDemand(state);
    return createNews(
      Math.floor(dayIndex / DAYS_PER_MONTH),
      "world",
      "success",
      "A mid-cycle travel bump lifts short-term league demand.",
      "Guests are booking quick trips and destination parks are seeing a temporary attendance tailwind."
    );
  }

  if (roll < 0.68) {
    state.world.competitionHeat = clamp(state.world.competitionHeat + 0.03, 0.9, 1.24);
    state.world.globalDemand = calculateGlobalDemand(state);
    return createNews(
      Math.floor(dayIndex / DAYS_PER_MONTH),
      "world",
      "info",
      "Operators intensify short-term promotions across the league.",
      "Aggressive discounting and campaign pushes are creating a sharper fight for visitor attention this week."
    );
  }

  state.world.economyIndex = clamp(state.world.economyIndex - 0.02, 0.8, 1.22);
  state.world.capitalMarketMood = clamp(state.world.capitalMarketMood - 0.015, 0.78, 1.25);
  state.world.globalDemand = calculateGlobalDemand(state);
  return createNews(
    Math.floor(dayIndex / DAYS_PER_MONTH),
    "world",
    "warning",
    "A short-term consumer wobble cools the league.",
    "The market remains healthy overall, but spending confidence has softened over the last few in-game days."
  );
}

function simulateRivalPulse(
  rival: RivalPark,
  state: WorldParkLeagueState,
  dayIndex: number,
  index: number,
  priorPlayerLeadShare: number,
  priorMonthsAtRankOne: number,
  headlines: NewsItem[],
  allowEvents: boolean
): RivalPark {
  const nextRival = deepClone(rival);
  if (!nextRival.status.active) {
    return nextRival;
  }

  const rng = createScopedRng(state.world.seed, dayIndex, 3101, index + 1, nextRival.tier);
  const profile = getRivalIdentityProfile(state.world.seed, nextRival.id);
  const regionMarket = state.world.regionMarkets[nextRival.region];
  const playerHolding =
    state.player.investments.find((investment) => investment.rivalId === nextRival.id)?.share ?? 0;
  const previousMomentum = nextRival.momentum;
  const catchUpPressure = computeCatchUpPressure(
    nextRival,
    state,
    priorPlayerLeadShare,
    priorMonthsAtRankOne
  );
  const economyLift = (state.world.economyIndex - 1) * 2.4 * profile.macroSensitivity;
  const tourismLift = (state.world.tourismIndex - 1) * 2.8 * profile.tourismSensitivity;
  const competitionLift =
    (state.world.competitionHeat - 1) * 2.1 * profile.competitionSensitivity;
  const regionalDemandLift =
    (regionMarket.demandModifier - 1) * 2.6 * profile.regionalDemandSensitivity;
  const regionalTourismLift =
    (regionMarket.tourismModifier - 1) * 2.4 * profile.regionalTourismSensitivity;
  const volatility = rng.float(-0.22, 0.22) * profile.volatilityScale;

  applyPulseRivalEventEffects(nextRival);
  applyPlayerInfluencePulseSupport(nextRival, playerHolding);

  nextRival.momentum = clamp(
    nextRival.momentum * 0.965 +
      volatility +
      catchUpPressure * 0.42 * profile.resilience +
      economyLift * 0.05 +
      tourismLift * 0.045 -
      (regionMarket.competitionModifier - 1) * 0.28 * profile.competitionSensitivity,
    -14,
    14
  );
  nextRival.stats.marketing = clamp(
    nextRival.stats.marketing +
      rng.float(-0.08, 0.12) +
      catchUpPressure * 0.28 * profile.resilience +
      competitionLift * 0.03,
    25,
    99
  );
  nextRival.stats.innovation = clamp(
    nextRival.stats.innovation + rng.float(-0.06, 0.1) + catchUpPressure * 0.22,
    22,
    99
  );
  nextRival.stats.operations = clamp(
    nextRival.stats.operations + rng.float(-0.05, 0.08) + nextRival.momentum * 0.008,
    28,
    99
  );
  nextRival.stats.prestige = clamp(
    nextRival.stats.prestige +
      nextRival.momentum * 0.01 +
      tourismLift * 0.045 +
      regionalDemandLift * 0.03,
    25,
    99
  );
  nextRival.stats.guestAppeal = clamp(
    nextRival.stats.guestAppeal +
      nextRival.momentum * 0.012 +
      competitionLift * 0.03 +
      regionalTourismLift * 0.028,
    25,
    99
  );
  nextRival.risk = clamp(
    nextRival.risk + rng.float(-0.1, 0.1) + nextRival.status.distressLevel * 0.04,
    15,
    90
  );

  nextRival.derived.catchUpPressure = roundTo(catchUpPressure, 4);
  nextRival.derived.score = calculateCompetitiveScoreForLeaderboard(state, nextRival);

  const indicativeVisitors =
    (state.world.globalDemand / state.config.rivalCount) * (nextRival.derived.score / 72);
  const averageSpend =
    (16 +
      nextRival.tier * 2.4 +
      nextRival.stats.prestige * 0.05 +
      nextRival.stats.guestAppeal * 0.03) *
    profile.monetization;
  const operatingRatio = clamp(
    0.74 -
      nextRival.stats.operations * 0.0017 * profile.resilience +
      nextRival.risk * 0.0011 +
      nextRival.status.distressLevel * 0.025 +
      (state.world.competitionHeat - 1) * 0.04,
    0.49,
    0.86
  );
  const monthlyRevenueEstimate = indicativeVisitors * averageSpend;
  const debtService =
    nextRival.finance.debt * 0.0075 * state.world.capitalMarketMood * profile.capitalSensitivity;
  const monthlyProfitEstimate =
    monthlyRevenueEstimate * (1 - operatingRatio) -
    debtService +
    nextRival.momentum * 420 * profile.valuationNarrative;

  nextRival.finance.monthlyRevenue = Math.round(
    nextRival.finance.monthlyRevenue * 0.94 + monthlyRevenueEstimate * 0.06
  );
  nextRival.finance.monthlyProfit = Math.round(
    nextRival.finance.monthlyProfit * 0.93 + monthlyProfitEstimate * 0.07
  );
  nextRival.finance.cashReserve = Math.max(
    0,
    Math.round(
      nextRival.finance.cashReserve +
        nextRival.finance.monthlyProfit * (0.013 + (profile.resilience - 1) * 0.003)
    )
  );

  if (nextRival.finance.monthlyProfit < 0 && nextRival.finance.cashReserve < Math.abs(nextRival.finance.monthlyProfit) * 0.7) {
    nextRival.finance.debt = Math.round(nextRival.finance.debt + Math.abs(nextRival.finance.monthlyProfit) * 0.01);
  } else if (
    nextRival.finance.monthlyProfit > 0 &&
    nextRival.finance.debt > 0 &&
    nextRival.finance.cashReserve > 75_000
  ) {
    nextRival.finance.debt = Math.max(
      0,
      Math.round(nextRival.finance.debt - nextRival.finance.monthlyProfit * 0.006)
    );
  }

  const fundamentalValue = calculateFundamentalCompanyValue(
    nextRival,
    nextRival.finance.monthlyRevenue,
    nextRival.finance.monthlyProfit,
    state.world.structuralGrowthIndex
  );
  nextRival.finance.companyValue = Math.round(
    clamp(
      nextRival.finance.companyValue * 0.975 +
        fundamentalValue * 0.025 +
        nextRival.momentum * 320 * profile.valuationNarrative,
      220_000,
      32_000_000
    )
  );
  nextRival.derived.valuation = nextRival.finance.companyValue;
  nextRival.derived.debtRatio =
    nextRival.finance.companyValue > 0
      ? roundTo(nextRival.finance.debt / nextRival.finance.companyValue, 4)
      : 0;

  if (allowEvents && previousMomentum < 4 && nextRival.momentum >= 4 && rng.chance(0.35)) {
    headlines.push(
      createNews(
        Math.floor(dayIndex / DAYS_PER_MONTH),
        "rival",
        "info",
        `${nextRival.name} is gaining short-term momentum.`,
        "The park is putting together a strong run and is becoming more visible in the live league picture.",
        nextRival.id
      )
    );
  } else if (allowEvents && previousMomentum > -4 && nextRival.momentum <= -4 && rng.chance(0.3)) {
    headlines.push(
      createNews(
        Math.floor(dayIndex / DAYS_PER_MONTH),
        "rival",
        "warning",
        `${nextRival.name} is losing ground in the live table.`,
        "Short-term trading has cooled and the operator is slipping relative to the rest of the field.",
        nextRival.id
      )
    );
  }

  return nextRival;
}

function calculateCompetitiveScoreForLeaderboard(
  state: WorldParkLeagueState,
  rival: RivalPark
): number {
  const baseScore = computeRivalScore(rival, state.world.competitionHeat);
  const profile = getRivalIdentityProfile(state.world.seed, rival.id);
  const region = state.world.regionMarkets[rival.region];
  const regionFactor = clamp(
    region.demandModifier * (0.44 + profile.regionalDemandSensitivity * 0.06) +
      region.tourismModifier * (0.3 + profile.regionalTourismSensitivity * 0.05) +
      (2 - region.competitionModifier) * (0.14 + profile.competitionSensitivity * 0.02),
    0.9,
    1.16
  );
  const safetyPenalty =
    state.world.safetyScrutinyMonthsRemaining > 0
      ? clamp(1 - (rival.risk / 100) * 0.08 * profile.safetySensitivity, 0.88, 1)
      : 1;
  const strategyFactor =
    rival.status.strategyShiftMonthsRemaining > 0
      ? rival.status.strategyFocus === "turnaround"
        ? 0.975 + (profile.resilience - 1) * 0.025
        : 1.01 + (profile.valuationNarrative - 1) * 0.02
      : 1;

  return roundTo(clamp(baseScore * regionFactor * safetyPenalty * strategyFactor, 12, 125), 2);
}

function simulateRivalMonth(
  rival: RivalPark,
  state: WorldParkLeagueState,
  month: number,
  index: number,
  priorPlayerLeadShare: number,
  priorMonthsAtRankOne: number
): RivalSimulationOutcome {
  const nextRival = deepClone(rival);
  const news: NewsItem[] = [];
  const rng = createScopedRng(state.world.seed, month, index + 1, nextRival.tier);
  const profile = getRivalIdentityProfile(state.world.seed, nextRival.id);
  const regionMarket = state.world.regionMarkets[nextRival.region];
  const playerHolding =
    state.player.investments.find((investment) => investment.rivalId === nextRival.id)?.share ?? 0;

  if (!nextRival.status.active) {
    return { rival: nextRival, news };
  }

  applyOngoingRivalEventEffects(nextRival, month, news);
  applyPlayerInfluenceSupport(nextRival, playerHolding);

  const catchUpPressure = computeCatchUpPressure(
    nextRival,
    state,
    priorPlayerLeadShare,
    priorMonthsAtRankOne
  );

  const economyLift = (state.world.economyIndex - 1) * 7.5 * profile.macroSensitivity;
  const tourismLift = (state.world.tourismIndex - 1) * 8.5 * profile.tourismSensitivity;
  const competitionLift =
    (state.world.competitionHeat - 1) * 5.5 * profile.competitionSensitivity;
  const capitalLift = (state.world.capitalMarketMood - 1) * 6 * profile.capitalSensitivity;
  const regionalDemandLift =
    (regionMarket.demandModifier - 1) * 8 * profile.regionalDemandSensitivity;
  const regionalTourismLift =
    (regionMarket.tourismModifier - 1) * 8 * profile.regionalTourismSensitivity;
  const volatility = rng.float(-1.6, 1.6) * profile.volatilityScale;

  nextRival.momentum = clamp(
    nextRival.momentum * 0.68 +
      volatility +
      catchUpPressure * 5.5 * profile.resilience +
      economyLift * 0.2 +
      tourismLift * 0.18 -
      regionMarket.competitionModifier * 0.2 * profile.competitionSensitivity +
      nextRival.status.monthsInSlump * 0.35 * profile.resilience,
    -14,
    14
  );

  nextRival.stats.marketing = clamp(
    nextRival.stats.marketing +
      volatility * 0.9 +
      catchUpPressure * 7.5 * profile.resilience +
      capitalLift * 0.18 -
      (regionMarket.competitionModifier - 1) * 6 * profile.competitionSensitivity,
    25,
    99
  );
  nextRival.stats.innovation = clamp(
    nextRival.stats.innovation + rng.float(-1.1, 1.4) + catchUpPressure * 6.2,
    22,
    99
  );
  nextRival.stats.operations = clamp(
    nextRival.stats.operations +
      rng.float(-0.8, 1.1) +
      nextRival.momentum * 0.08 -
      state.world.safetyScrutinyMonthsRemaining * 0.5 * profile.safetySensitivity,
    28,
    99
  );
  nextRival.stats.prestige = clamp(
    nextRival.stats.prestige +
      nextRival.momentum * 0.09 +
      tourismLift * 0.16 +
      regionalDemandLift * 0.11,
    25,
    99
  );
  nextRival.stats.guestAppeal = clamp(
    nextRival.stats.guestAppeal +
      nextRival.momentum * 0.1 +
      competitionLift * 0.18 +
      regionalTourismLift * 0.12,
    25,
    99
  );
  nextRival.risk = clamp(
    nextRival.risk +
      rng.float(-1.2, 1.2) +
      catchUpPressure * 1.4 +
      nextRival.status.distressLevel * 0.8 +
      (nextRival.status.scandalMonthsRemaining > 0 ? 2 : 0),
    15,
    90
  );

  nextRival.derived.catchUpPressure = roundTo(catchUpPressure, 4);
  nextRival.derived.score = calculateCompetitiveScoreForLeaderboard(state, nextRival);

  const indicativeVisitors =
    (state.world.globalDemand / state.config.rivalCount) * (nextRival.derived.score / 72);
  const averageSpend =
    (16 +
      nextRival.tier * 2.4 +
      nextRival.stats.prestige * 0.05 +
      nextRival.stats.guestAppeal * 0.03) *
    profile.monetization;
  const operatingRatio = clamp(
    0.74 -
      nextRival.stats.operations * 0.0017 * profile.resilience +
      nextRival.risk * 0.0011 +
      nextRival.status.distressLevel * 0.025 +
      (state.world.competitionHeat - 1) * 0.04,
    0.49,
    0.86
  );
  const monthlyRevenue = indicativeVisitors * averageSpend;
  const debtService =
    nextRival.finance.debt * 0.0075 * state.world.capitalMarketMood * profile.capitalSensitivity;
  const monthlyProfit =
    monthlyRevenue * (1 - operatingRatio) -
    debtService +
    nextRival.momentum * 420 * profile.valuationNarrative;

  nextRival.finance.monthlyRevenue = Math.round(monthlyRevenue);
  nextRival.finance.monthlyProfit = Math.round(monthlyProfit);
  nextRival.finance.cashReserve = Math.max(
    0,
    Math.round(nextRival.finance.cashReserve + monthlyProfit * (0.58 + profile.resilience * 0.07))
  );

  if (monthlyProfit < 0 && nextRival.finance.cashReserve < Math.abs(monthlyProfit) * 1.5) {
    nextRival.finance.debt = Math.round(nextRival.finance.debt + Math.abs(monthlyProfit) * 0.72);
  } else if (monthlyProfit > 0 && nextRival.finance.debt > 0) {
    nextRival.finance.debt = Math.max(
      0,
      Math.round(nextRival.finance.debt - monthlyProfit * 0.16)
    );
  }

  nextRival.finance.companyValue = Math.round(
    calculateFundamentalCompanyValue(
      nextRival,
      monthlyRevenue,
      monthlyProfit,
      state.world.structuralGrowthIndex
    )
  );
  nextRival.derived.valuation = nextRival.finance.companyValue;
  nextRival.derived.debtRatio =
    nextRival.finance.companyValue > 0
      ? roundTo(nextRival.finance.debt / nextRival.finance.companyValue, 4)
      : 0;
  nextRival.status.monthsInSlump =
    monthlyProfit < 0 ? nextRival.status.monthsInSlump + 1 : Math.max(0, nextRival.status.monthsInSlump - 1);
  nextRival.status.monthsSinceFounded += 1;

  const previousDistressLevel = nextRival.status.distressLevel;
  nextRival.status.distressLevel = computeDistressLevel(nextRival);
  pushDistressTransitionNews(nextRival, previousDistressLevel, month, news);
  maybeTriggerRivalEventChain(nextRival, state, month, rng, news);

  if (shouldDeclareBankruptcy(nextRival)) {
    bankruptRival(nextRival);
    news.push(
      createNews(
        month,
        "rival",
        "warning",
        `${nextRival.name} files for bankruptcy protection.`,
        "After a prolonged slump and a crippling debt load, the operator can no longer sustain itself as an independent competitor.",
        nextRival.id
      )
    );
  }

  nextRival.derived.score = nextRival.status.active
    ? calculateCompetitiveScoreForLeaderboard(state, nextRival)
    : 0;

  return { rival: nextRival, news };
}

function applyPlayerInfluencePulseSupport(rival: RivalPark, holdingShare: number): void {
  if (holdingShare < 0.1) {
    return;
  }

  rival.stats.operations = clamp(rival.stats.operations + 0.08, 20, 99);
  rival.risk = clamp(rival.risk - 0.06, 15, 95);

  if (holdingShare >= 0.15 && rival.status.distressLevel > 0) {
    rival.momentum = clamp(rival.momentum + 0.08, -14, 14);
    rival.risk = clamp(rival.risk - 0.1, 15, 95);
  }

  if (holdingShare >= 0.2 && rival.status.scandalMonthsRemaining > 0) {
    rival.stats.prestige = clamp(rival.stats.prestige + 0.16, 20, 99);
    rival.stats.guestAppeal = clamp(rival.stats.guestAppeal + 0.16, 20, 99);
  }
}

function applyPlayerInfluenceSupport(rival: RivalPark, holdingShare: number): void {
  if (holdingShare < 0.1) {
    return;
  }

  rival.stats.operations = clamp(rival.stats.operations + 0.3, 20, 99);
  rival.risk = clamp(rival.risk - 0.25, 15, 95);

  if (holdingShare >= 0.15 && rival.status.distressLevel > 0) {
    rival.momentum = clamp(rival.momentum + 0.35, -14, 14);
    rival.risk = clamp(rival.risk - 0.55, 15, 95);
    rival.stats.operations = clamp(rival.stats.operations + 0.45, 20, 99);
  }

  if (holdingShare >= 0.2 && rival.status.scandalMonthsRemaining > 0) {
    rival.stats.prestige = clamp(rival.stats.prestige + 0.8, 20, 99);
    rival.stats.guestAppeal = clamp(rival.stats.guestAppeal + 0.8, 20, 99);
  }

  if (holdingShare >= 0.25 && rival.status.expansionMonthsRemaining > 0) {
    rival.stats.operations = clamp(rival.stats.operations + 0.5, 20, 99);
    rival.stats.innovation = clamp(rival.stats.innovation + 0.4, 20, 99);
    rival.stats.marketing = clamp(rival.stats.marketing + 0.3, 20, 99);
  }
}

function computeCatchUpPressure(
  rival: RivalPark,
  state: WorldParkLeagueState,
  priorPlayerLeadShare: number,
  priorMonthsAtRankOne: number
): number {
  const playerDominance =
    state.player.currentRank === 1
      ? clamp(
          (priorPlayerLeadShare - state.config.dominantLeadThreshold) * 1.35,
          0,
          0.3
        )
      : 0;
  const ambition = clamp((rival.tier - 2) * 0.04 + rival.stats.innovation * 0.0008, 0.02, 0.13);
  const slumpRelief = rival.status.monthsInSlump >= 3 ? 0.035 : 0;
  const tenurePressure = Math.max(0, priorMonthsAtRankOne - 1) * state.config.catchUpTenureScale;
  const localRivalPressure =
    computeLocalRivalPressure(rival.id, state) * state.config.catchUpLocalRivalScale;
  const playerGrowthPressure = computePlayerGrowthPressure(rival.id, state);
  const difficulty = getDifficultyProfile(state.config.difficultyPreset);
  const pressure =
    (playerDominance * state.config.catchUpPlayerDominanceScale +
      playerGrowthPressure +
      tenurePressure +
      ambition +
      slumpRelief +
      localRivalPressure) *
    difficulty.rivalCatchUpScale;

  return clamp(pressure, 0, state.config.maxCatchUpPressure);
}

function computePlayerGrowthPressure(rivalId: string, state: WorldParkLeagueState): number {
  const momentumSignal = Math.max(0, state.player.liveMomentum - 1.2);
  if (momentumSignal <= 0) {
    return 0;
  }

  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer);
  const rivalEntry = state.world.leaderboard.find((entry) => entry.parkId === rivalId);
  let proximityScale = 0.55;
  if (playerEntry && rivalEntry) {
    const rankGap = Math.abs(rivalEntry.rank - playerEntry.rank);
    if (rankGap <= 3) {
      proximityScale = 1.2;
    } else if (rankGap <= 10) {
      proximityScale = 1;
    } else if (rankGap <= 20) {
      proximityScale = 0.72;
    }
  }

  if (state.player.watchlist.focusRivalIds.includes(rivalId)) {
    proximityScale += 0.35;
  } else if (state.player.watchlist.watchedRivalIds.includes(rivalId)) {
    proximityScale += 0.16;
  }

  return clamp(
    momentumSignal * state.config.catchUpPlayerGrowthScale * proximityScale,
    0,
    0.14
  );
}

function computeLocalRivalPressure(rivalId: string, state: WorldParkLeagueState): number {
  if (!state.player.watchlist.focusRivalIds.includes(rivalId)) {
    return 0;
  }

  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer);
  const rivalEntry = state.world.leaderboard.find((entry) => entry.parkId === rivalId);
  if (!playerEntry || !rivalEntry) {
    return 0.02;
  }

  const gap = Math.abs(rivalEntry.rank - playerEntry.rank);
  if (gap <= 2) {
    return 0.04;
  }
  if (gap <= 5) {
    return 0.028;
  }
  if (gap <= 8) {
    return 0.016;
  }
  return 0.008;
}

function applyOngoingRivalEventEffects(
  rival: RivalPark,
  month: number,
  news: NewsItem[]
): void {
  if (rival.status.scandalMonthsRemaining > 0) {
    rival.stats.prestige = clamp(rival.stats.prestige - 1.8, 20, 99);
    rival.stats.guestAppeal = clamp(rival.stats.guestAppeal - 2.1, 20, 99);
    rival.stats.operations = clamp(rival.stats.operations - 0.7, 20, 99);
    rival.risk = clamp(rival.risk + 2.2, 15, 95);
    rival.status.scandalMonthsRemaining -= 1;

    if (rival.status.scandalMonthsRemaining === 0) {
      rival.status.recoveryMonthsRemaining = Math.max(rival.status.recoveryMonthsRemaining, 2);
      news.push(
        createNews(
          month,
          "rival",
          "info",
          `${rival.name} begins to recover from a public scandal.`,
          "The immediate headlines have faded, but the park still needs time to rebuild trust and demand.",
          rival.id
        )
      );
    }
  }

  if (rival.status.expansionMonthsRemaining > 0) {
    rival.stats.innovation = clamp(rival.stats.innovation + 1.4, 20, 99);
    rival.stats.guestAppeal = clamp(rival.stats.guestAppeal + 1.2, 20, 99);
    rival.stats.marketing = clamp(rival.stats.marketing + 0.9, 20, 99);
    rival.stats.operations = clamp(rival.stats.operations - 0.5, 20, 99);
    rival.finance.debt = Math.round(clamp(rival.finance.debt + 22_500, 0, 18_000_000));
    rival.finance.cashReserve = Math.max(0, rival.finance.cashReserve - 14_000);
    rival.status.expansionMonthsRemaining -= 1;

    if (rival.status.expansionMonthsRemaining === 0) {
      rival.stats.prestige = clamp(rival.stats.prestige + 3.5, 20, 99);
      rival.status.recoveryMonthsRemaining = Math.max(rival.status.recoveryMonthsRemaining, 1);
      news.push(
        createNews(
          month,
          "rival",
          "success",
          `${rival.name} unveils a major new expansion.`,
          "The investment has gone live and should strengthen the park's appeal if the balance sheet holds."
        )
      );
    }
  }

  if (rival.status.recoveryMonthsRemaining > 0) {
    rival.stats.operations = clamp(rival.stats.operations + 0.9, 20, 99);
    rival.stats.prestige = clamp(rival.stats.prestige + 0.7, 20, 99);
    rival.risk = clamp(rival.risk - 1.2, 15, 95);
    rival.status.recoveryMonthsRemaining -= 1;
  }

  if (rival.status.strategyShiftMonthsRemaining > 0) {
    applyStrategyShiftEffects(rival);
    rival.status.strategyShiftMonthsRemaining -= 1;

    if (rival.status.strategyShiftMonthsRemaining === 0) {
      rival.status.lastHeadline = `${rival.name} completed a ${describeStrategyFocus(
        rival.status.strategyFocus
      )} program.`;
      if (rival.status.strategyFocus === "turnaround") {
        rival.status.recoveryMonthsRemaining = Math.max(rival.status.recoveryMonthsRemaining, 2);
      }
      news.push(
        createNews(
          month,
          "rival",
          "info",
          `${rival.name} completes a ${describeStrategyFocus(rival.status.strategyFocus)} program.`,
          "The immediate leadership pivot is over and the park is now competing on its updated operating model."
        )
      );
    }
  }
}

function applyPulseRivalEventEffects(rival: RivalPark): void {
  if (rival.status.scandalMonthsRemaining > 0) {
    rival.stats.prestige = clamp(rival.stats.prestige - 0.35, 20, 99);
    rival.stats.guestAppeal = clamp(rival.stats.guestAppeal - 0.42, 20, 99);
    rival.stats.operations = clamp(rival.stats.operations - 0.12, 20, 99);
    rival.risk = clamp(rival.risk + 0.38, 15, 95);
  }

  if (rival.status.expansionMonthsRemaining > 0) {
    rival.stats.innovation = clamp(rival.stats.innovation + 0.14, 20, 99);
    rival.stats.marketing = clamp(rival.stats.marketing + 0.12, 20, 99);
    rival.finance.cashReserve = Math.max(0, rival.finance.cashReserve - 1_500);
    rival.finance.debt = Math.round(clamp(rival.finance.debt + 2_200, 0, 18_000_000));
  }

  if (rival.status.recoveryMonthsRemaining > 0) {
    rival.stats.operations = clamp(rival.stats.operations + 0.1, 20, 99);
    rival.stats.guestAppeal = clamp(rival.stats.guestAppeal + 0.08, 20, 99);
    rival.momentum = clamp(rival.momentum + 0.1, -14, 14);
  }
}

function applyStrategyShiftEffects(rival: RivalPark): void {
  switch (rival.status.strategyFocus) {
    case "turnaround":
      rival.stats.operations = clamp(rival.stats.operations + 1.4, 20, 99);
      rival.stats.marketing = clamp(rival.stats.marketing - 0.6, 20, 99);
      rival.stats.guestAppeal = clamp(rival.stats.guestAppeal - 0.2, 20, 99);
      rival.risk = clamp(rival.risk - 1.4, 15, 95);
      rival.momentum = clamp(rival.momentum + 0.35, -14, 14);
      if (rival.finance.debt > 0 && rival.finance.cashReserve > 80_000) {
        rival.finance.debt = Math.max(0, Math.round(rival.finance.debt - 8_000));
        rival.finance.cashReserve = Math.max(0, rival.finance.cashReserve - 8_000);
      }
      return;
    case "brand_push":
      rival.stats.marketing = clamp(rival.stats.marketing + 1.6, 20, 99);
      rival.stats.prestige = clamp(rival.stats.prestige + 0.7, 20, 99);
      rival.stats.guestAppeal = clamp(rival.stats.guestAppeal + 1.3, 20, 99);
      rival.finance.cashReserve = Math.max(0, rival.finance.cashReserve - 6_000);
      rival.risk = clamp(rival.risk + 0.4, 15, 95);
      return;
    case "innovation_bet":
      rival.stats.innovation = clamp(rival.stats.innovation + 1.7, 20, 99);
      rival.stats.guestAppeal = clamp(rival.stats.guestAppeal + 0.8, 20, 99);
      rival.stats.prestige = clamp(rival.stats.prestige + 0.5, 20, 99);
      rival.finance.debt = Math.round(clamp(rival.finance.debt + 12_000, 0, 18_000_000));
      rival.risk = clamp(rival.risk + 0.8, 15, 95);
      return;
    case "efficiency_drive":
      rival.stats.operations = clamp(rival.stats.operations + 1.4, 20, 99);
      rival.stats.marketing = clamp(rival.stats.marketing - 0.5, 20, 99);
      rival.stats.guestAppeal = clamp(rival.stats.guestAppeal - 0.3, 20, 99);
      rival.risk = clamp(rival.risk - 0.8, 15, 95);
      if (rival.finance.debt > 0) {
        rival.finance.debt = Math.max(0, Math.round(rival.finance.debt - 9_000));
      }
      return;
    case "balanced":
      return;
  }
}

function computeDistressLevel(rival: RivalPark): number {
  const debtRatio =
    rival.finance.companyValue > 0 ? rival.finance.debt / rival.finance.companyValue : 0;

  if (
    debtRatio > 0.88 ||
    (debtRatio > 0.72 &&
      rival.status.monthsInSlump >= 4 &&
      rival.finance.cashReserve < 40_000)
  ) {
    return 2;
  }

  if (
    debtRatio > 0.5 ||
    rival.status.monthsInSlump >= 3 ||
    (rival.finance.cashReserve < 60_000 && rival.finance.monthlyProfit < 0)
  ) {
    return 1;
  }

  return 0;
}

function pushDistressTransitionNews(
  rival: RivalPark,
  previousDistressLevel: number,
  month: number,
  news: NewsItem[]
): void {
  if (rival.status.distressLevel === previousDistressLevel) {
    return;
  }

  if (rival.status.distressLevel === 2) {
    news.push(
      createNews(
        month,
        "rival",
        "warning",
        `${rival.name} enters severe financial distress.`,
        "Debt pressure and repeated weak months are forcing aggressive cost cutting and emergency financing.",
        rival.id
      )
    );
    return;
  }

  if (rival.status.distressLevel === 1 && previousDistressLevel === 0) {
    news.push(
      createNews(
        month,
        "rival",
        "info",
        `${rival.name} starts a visible restructuring program.`,
        "The operator is still active, but margins and financing are clearly under pressure.",
        rival.id
      )
    );
    return;
  }

  if (rival.status.distressLevel === 0 && previousDistressLevel > 0) {
    rival.status.recoveryMonthsRemaining = Math.max(rival.status.recoveryMonthsRemaining, 2);
    news.push(
      createNews(
        month,
        "rival",
        "success",
        `${rival.name} stabilizes after a difficult period.`,
        "The park is no longer in formal distress and has started rebuilding confidence.",
        rival.id
      )
    );
  }
}

function maybeTriggerRivalEventChain(
  rival: RivalPark,
  state: WorldParkLeagueState,
  month: number,
  rng: ReturnType<typeof createScopedRng>,
  news: NewsItem[]
): void {
  if (rival.status.scandalMonthsRemaining > 0 || rival.status.expansionMonthsRemaining > 0) {
    return;
  }

  const canTriggerScandal =
    rival.risk > 58 &&
    (rival.status.monthsAtTop > 0 || rival.status.distressLevel > 0 || state.world.competitionHeat > 1.08);
  if (canTriggerScandal && rng.chance(0.02 + rival.risk * 0.0007)) {
    rival.status.scandalMonthsRemaining = 3;
    rival.status.lastHeadline = `${rival.name} is dealing with a scandal.`;
    news.push(
      createNews(
        month,
        "rival",
        "warning",
        `${rival.name} is hit by a brand-damaging scandal.`,
        "Negative press is reducing guest trust and putting real pressure on the park's short-term momentum.",
        rival.id
      )
    );
    return;
  }

  const canExpand =
    rival.finance.monthlyProfit > 0 &&
    rival.finance.cashReserve > 120_000 &&
    rival.finance.companyValue > 1_500_000 &&
    rival.stats.innovation > 68;
  if (canExpand && rng.chance(0.025 + rival.stats.marketing * 0.0004)) {
    rival.status.expansionMonthsRemaining = 3;
    rival.finance.cashReserve = Math.max(0, rival.finance.cashReserve - 50_000);
    rival.finance.debt = Math.round(clamp(rival.finance.debt + 70_000, 0, 18_000_000));
    rival.status.lastHeadline = `${rival.name} is funding a major expansion.`;
    news.push(
      createNews(
        month,
        "rival",
        "success",
        `${rival.name} greenlights a major expansion plan.`,
        "The operator is leaning into growth, taking on more risk now in exchange for a stronger future position.",
        rival.id
      )
    );
    return;
  }

  maybeTriggerManagementChange(rival, state, month, rng, news);
}

function maybeTriggerManagementChange(
  rival: RivalPark,
  state: WorldParkLeagueState,
  month: number,
  rng: ReturnType<typeof createScopedRng>,
  news: NewsItem[]
): void {
  if (!rival.status.active || rival.status.strategyShiftMonthsRemaining > 0) {
    return;
  }

  const playerPressure =
    state.player.currentRank === 1 &&
    state.player.marketShare > state.config.dominantLeadThreshold
      ? 0.03
      : 0;

  if (
    rival.status.distressLevel > 0 &&
    rng.chance(0.08 + rival.status.distressLevel * 0.08 + playerPressure)
  ) {
    startStrategyShift(
      rival,
      month,
      news,
      "turnaround",
      3,
      `${rival.name} appoints turnaround leadership.`,
      "Cost control and operational discipline are now the priority as the operator fights to stabilize."
    );
    return;
  }

  if (
    rival.finance.monthlyProfit < 0 &&
    rival.status.monthsInSlump >= 3 &&
    rng.chance(0.08 + playerPressure)
  ) {
    startStrategyShift(
      rival,
      month,
      news,
      "efficiency_drive",
      3,
      `${rival.name} launches an efficiency program.`,
      "The group is tightening operations and trying to defend margins before the slump worsens."
    );
    return;
  }

  if (
    rival.stats.marketing < 58 &&
    rival.stats.guestAppeal < 66 &&
    rng.chance(0.05 + playerPressure)
  ) {
    startStrategyShift(
      rival,
      month,
      news,
      "brand_push",
      2,
      `${rival.name} shifts into an aggressive brand campaign.`,
      "Management is spending harder on visibility and guest demand to regain attention in the league."
    );
    return;
  }

  if (
    rival.stats.innovation < 60 &&
    rival.finance.cashReserve > 100_000 &&
    rng.chance(0.05 + playerPressure)
  ) {
    startStrategyShift(
      rival,
      month,
      news,
      "innovation_bet",
      3,
      `${rival.name} backs a high-risk innovation push.`,
      "Leadership is betting on new attractions and sharper differentiation to move up the rankings."
    );
  }
}

function startStrategyShift(
  rival: RivalPark,
  month: number,
  news: NewsItem[],
  strategyFocus: RivalPark["status"]["strategyFocus"],
  duration: number,
  headline: string,
  detail: string
): void {
  rival.status.strategyFocus = strategyFocus;
  rival.status.strategyShiftMonthsRemaining = duration;
  rival.status.lastHeadline = headline;
  news.push(createNews(month, "rival", "info", headline, detail, rival.id));
}

function shouldDeclareBankruptcy(rival: RivalPark): boolean {
  const debtRatio =
    rival.finance.companyValue > 0 ? rival.finance.debt / rival.finance.companyValue : 999;
  return (
    rival.status.active &&
    rival.status.distressLevel === 2 &&
    rival.status.monthsInSlump >= 5 &&
    rival.finance.cashReserve < 45_000 &&
    (debtRatio > 1.15 || (debtRatio > 0.95 && rival.finance.monthlyProfit < 0) || rival.finance.companyValue < 420_000)
  );
}

function bankruptRival(rival: RivalPark): void {
  rival.status.active = false;
  rival.status.lastHeadline = `${rival.name} filed for bankruptcy.`;
  rival.finance.cashReserve = 0;
  rival.finance.monthlyRevenue = 0;
  rival.finance.monthlyProfit = 0;
  rival.finance.companyValue = Math.max(140_000, Math.round(rival.finance.companyValue * 0.35));
  rival.derived.marketShare = 0;
  rival.derived.monthlyVisitors = 0;
  rival.derived.score = 0;
}

function maybeRunStructuralEvent(state: WorldParkLeagueState, month: number): NewsItem | null {
  const rng = createScopedRng(state.world.seed, month, 717);
  if (!rng.chance(state.config.mergerChance)) {
    return null;
  }

  const activeRivals = state.world.rivals
    .filter((rival) => rival.status.active)
    .sort((left, right) => right.finance.companyValue - left.finance.companyValue);

  const buyer = activeRivals.find(
    (rival) => rival.finance.companyValue > 2_000_000 && rival.finance.cashReserve > 120_000
  );
  const seller = [...activeRivals]
    .reverse()
    .find(
      (rival) =>
        rival.id !== buyer?.id &&
        rival.status.monthsInSlump >= 2 &&
        rival.finance.debt > rival.finance.cashReserve
    );

  if (!buyer || !seller) {
    return null;
  }

  const buyerRef = state.world.rivals.find((rival) => rival.id === buyer.id);
  const sellerRef = state.world.rivals.find((rival) => rival.id === seller.id);
  if (!buyerRef || !sellerRef) {
    return null;
  }

  buyerRef.stats.prestige = clamp(buyerRef.stats.prestige + sellerRef.stats.prestige * 0.07, 25, 99);
  buyerRef.stats.guestAppeal = clamp(
    buyerRef.stats.guestAppeal + sellerRef.stats.guestAppeal * 0.05,
    25,
    99
  );
  buyerRef.finance.companyValue = Math.round(
    clamp(
      buyerRef.finance.companyValue + sellerRef.finance.companyValue * 0.42,
      280_000,
      32_000_000
    )
  );
  buyerRef.finance.debt = Math.round(
    clamp(buyerRef.finance.debt + sellerRef.finance.debt * 0.35, 0, 18_000_000)
  );
  buyerRef.finance.cashReserve = Math.round(
    Math.max(0, buyerRef.finance.cashReserve + sellerRef.finance.cashReserve * 0.2)
  );
  buyerRef.momentum = clamp(buyerRef.momentum + 2.8, -14, 14);

  sellerRef.status.active = false;
  sellerRef.status.mergedIntoId = buyerRef.id;
  sellerRef.status.lastHeadline = `${sellerRef.name} was absorbed by ${buyerRef.name}.`;
  sellerRef.finance.monthlyProfit = 0;
  sellerRef.derived.marketShare = 0;
  sellerRef.derived.monthlyVisitors = 0;

  return createNews(
    month,
    "merger",
    "warning",
    `${buyerRef.name} acquires ${sellerRef.name}.`,
    "The global field just consolidated, creating a stronger operator at the top end of the market."
  );
}

function spawnReplacementChallenger(state: WorldParkLeagueState, month: number): NewsItem | null {
  const rng = createScopedRng(state.world.seed, month, 991);
  if (!rng.chance(state.config.challengerChance)) {
    return null;
  }

  const usedIds = new Set(state.world.rivals.map((rival) => rival.id));
  const nextIndex = state.world.rivals.length + 1;
  const challengerSeed = state.world.seed ^ (month * 4099) ^ nextIndex;
  const challenger = createInitialRivals(challengerSeed, 1)[0];
  if (!challenger) {
    return null;
  }

  challenger.id = createUniqueRivalId(usedIds, nextIndex);
  challenger.tier = Math.max(1, challenger.tier - 1);
  challenger.finance.companyValue = Math.round(challenger.finance.companyValue * 0.72);
  challenger.finance.cashReserve = Math.round(challenger.finance.cashReserve * 0.68);
  challenger.status.monthsSinceFounded = 0;
  challenger.momentum = 3.5;
  challenger.status.lastHeadline = `${challenger.name} entered the market.`;
  challenger.derived.score = computeRivalScore(challenger, state.world.competitionHeat);

  state.world.rivals.push(challenger);

  return createNews(
    month,
    "rival",
    "info",
    `${challenger.name} enters the market as a new challenger.`,
    "Fresh capital and a focused launch campaign give the newcomer a real chance to shake up the middle of the table.",
    challenger.id
  );
}

function calculatePlayerLiveMomentum(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  playerScore: number
): number {
  const previousMomentum = state.player.liveMomentum ?? 0;
  const actionEffects = getPlayerActionEffects(state);
  const prestigeRewardEffects = getPrestigeRewardEffects(state);
  const scoreSignal = playerScore - state.player.score;
  const qualitySignal = clamp(
    ((snapshot.averageRideExcitement * 7.4 + snapshot.averageRideSatisfaction * 0.34) - 58) / 8,
    -5,
    5
  );
  const guestSignal = clamp((Math.log10(snapshot.guests + 10) - 2.5) * 5.4, -4.5, 4.5);
  const profitSignal = clamp(snapshot.lastMonthOperatingProfit / 18_000, -4.5, 4.5);
  const cashSignal = clamp((snapshot.cash - snapshot.bankLoan) / 65_000, -3.5, 3.5);
  const safetyPenalty =
    state.world.safetyScrutinyMonthsRemaining > 0
      ? (1 - actionEffects.safetyShield) * 1.4
      : 0;
  const targetMomentum =
    scoreSignal * 1.15 +
    qualitySignal * 0.45 +
    guestSignal * 0.35 +
    profitSignal * 0.24 +
    cashSignal * 0.16 +
    actionEffects.momentumBonus +
    prestigeRewardEffects.momentumBonus -
    safetyPenalty;

  return roundTo(clamp(previousMomentum * 0.72 + targetMomentum * 0.34, -14, 14), 2);
}

function buildLeaderboard(
  state: WorldParkLeagueState,
  playerSnapshot: PlayerSnapshot,
  playerScore: number,
  playerLiveMomentum: number
): LeaderboardEntry[] {
  const activeRivals = state.world.rivals.filter((rival) => rival.status.active);
  const rivalMap = new Map(activeRivals.map((rival) => [rival.id, rival]));
  const rivalScores = activeRivals.map((rival) => ({
    rival,
    score: sanitizeLeaderboardScore(calculateCompetitiveScoreForLeaderboard(state, rival)),
  }));
  const adjustedScores = [
      {
        parkId: PLAYER_PARK_ID,
        parkName: playerSnapshot.parkName,
        isPlayer: true,
        score: sanitizeLeaderboardScore(playerScore + getSpotlightScoreBonus(state, PLAYER_PARK_ID)),
        regionLabel: "Your park",
        statusLabel: getDisplayStatusLabel(state, PLAYER_PARK_ID, "Player"),
      },
    ...rivalScores.map(({ rival, score }) => ({
      parkId: rival.id,
      parkName: rival.name,
      isPlayer: false,
      score: sanitizeLeaderboardScore(score + getSpotlightScoreBonus(state, rival.id)),
      regionLabel: getRegionLabel(rival.region),
      statusLabel: getDisplayStatusLabel(state, rival.id, getRivalStatusLabel(rival)),
    })),
  ];

  const scoreMass = sum(
    adjustedScores.map(
      (entry) => entry.score ** 1.05 * getAudienceMassMultiplier(state, entry.parkId)
    )
  );
  const sorted = adjustedScores
    .map((entry) => ({
      ...entry,
      marketShare:
        scoreMass > 0
          ? (entry.score ** 1.05 * getAudienceMassMultiplier(state, entry.parkId)) / scoreMass
          : 0,
    }))
    .sort((left, right) => right.score - left.score);

  const leaderboard = sorted.map((entry, index) => {
    if (!entry.isPlayer) {
      const rival = rivalMap.get(entry.parkId);
      if (rival) {
        rival.derived.score = roundTo(entry.score, 2);
        rival.derived.marketShare = roundTo(entry.marketShare, 6);
        rival.derived.monthlyVisitors = Math.round(state.world.globalDemand * entry.marketShare);
        rival.status.monthsAtTop = index === 0 ? rival.status.monthsAtTop + 1 : 0;
      }
    }

    return entry.isPlayer
      ? createPlayerLeaderboardEntry(
          index + 1,
          roundTo(entry.score, 2),
          entry.marketShare,
          entry.parkName,
          playerSnapshot,
          playerLiveMomentum
        )
      : {
          rank: index + 1,
          parkId: entry.parkId,
          parkName: entry.parkName,
          isPlayer: false,
          score: roundTo(entry.score, 2),
          scoreDelta: roundTo(rivalMap.get(entry.parkId)?.momentum ?? 0, 1),
          marketShare: entry.marketShare,
          monthlyProfit: rivalMap.get(entry.parkId)?.finance.monthlyProfit ?? 0,
          companyValue: rivalMap.get(entry.parkId)?.finance.companyValue ?? 0,
          monthlyVisitors: rivalMap.get(entry.parkId)?.derived.monthlyVisitors ?? 0,
          debtRatio: rivalMap.get(entry.parkId)?.derived.debtRatio ?? 0,
          regionLabel: entry.regionLabel,
          statusLabel: entry.statusLabel,
          trendLabel: getMomentumTrendLabel(rivalMap.get(entry.parkId)?.momentum ?? 0),
        };
  });

  return leaderboard;
}

function applyPlayerLeaguePressure(
  state: WorldParkLeagueState,
  rawPlayerScore: number
): number {
  const rank = state.player.currentRank ?? 999;
  if (rank > 3) {
    return rawPlayerScore;
  }

  const basePressure = rank === 1 ? 1.2 : rank === 2 ? 0.65 : 0.35;
  const tenurePressure =
    rank === 1 ? clamp(state.player.monthsAtRankOne * 0.28, 0, 6.8) : 0;
  const awardPressure =
    getPlayerSpotlightGuestMultiplier(state) > 1 ? 0.55 : 0;
  const pressure = clamp(
    (basePressure + tenurePressure + awardPressure) *
      getDifficultyProfile(state.config.difficultyPreset).leaderPressureScale,
    0,
    9.5
  );
  return roundTo(clamp(rawPlayerScore - pressure, 12, 125), 2);
}

function getSpotlightScoreBonus(
  state: WorldParkLeagueState,
  parkId: string
): number {
  if (
    state.world.spotlightMonthsRemaining <= 0 ||
    state.world.spotlightParkId !== parkId
  ) {
    return 0;
  }

  return state.config.spotlightScoreBonus;
}

function getPlayerSpotlightGuestMultiplier(state: WorldParkLeagueState): number {
  return getAudienceGuestMultiplier(state, PLAYER_PARK_ID);
}

function getDisplayStatusLabel(
  state: WorldParkLeagueState,
  parkId: string,
  fallback: string
): string {
  if (
    state.world.spotlightMonthsRemaining > 0 &&
    state.world.spotlightParkId === parkId
  ) {
    return "Spotlight";
  }

  if (state.world.featuredDaysRemaining > 0 && state.world.featuredParkId === parkId) {
    return "Featured";
  }

  if (state.world.breakoutDaysRemaining > 0 && state.world.breakoutParkId === parkId) {
    return "Buzz";
  }

  return fallback;
}

function getAudienceGuestMultiplier(
  state: WorldParkLeagueState,
  parkId: string
): number {
  if (
    state.world.spotlightMonthsRemaining > 0 &&
    state.world.spotlightParkId === parkId
  ) {
    return Math.max(1, state.world.spotlightGuestMultiplier || state.config.spotlightGuestMultiplier);
  }

  if (state.world.featuredDaysRemaining > 0 && state.world.featuredParkId === parkId) {
    return Math.max(1, state.world.featuredGuestMultiplier || state.config.featuredGuestMultiplier);
  }

  if (state.world.breakoutDaysRemaining > 0 && state.world.breakoutParkId === parkId) {
    return Math.max(1, state.world.breakoutGuestMultiplier || state.config.breakoutGuestMultiplier);
  }

  return 1;
}

function getAudienceMassMultiplier(
  state: WorldParkLeagueState,
  parkId: string
): number {
  const guestMultiplier = getAudienceGuestMultiplier(state, parkId);
  return 1 + (guestMultiplier - 1) * 0.4;
}

function getMomentumTrendLabel(momentum: number): string {
  if (momentum >= 6) {
    return "++";
  }
  if (momentum >= 2) {
    return "+";
  }
  if (momentum <= -6) {
    return "--";
  }
  if (momentum <= -2) {
    return "-";
  }
  return "=";
}

function sanitizeLeaderboardScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return clamp(score, 0, 125);
}

function maybeGrantYearlyAward(state: WorldParkLeagueState, month: number): NewsItem | null {
  if (month % SEASON_FACTORS.length !== SEASON_FACTORS.length - 1) {
    return null;
  }

  const winner = state.world.leaderboard[0];
  if (!winner) {
    return null;
  }

  const award: AwardRecord = {
    month,
    title: "Best Park of the Year",
    parkId: winner.parkId,
    parkName: winner.parkName,
  };
  state.world.awards.unshift(award);
  state.world.awards = state.world.awards.slice(0, 12);

  if (winner.parkId === PLAYER_PARK_ID) {
    state.player.activeAwardTitle = award.title;
    state.player.activeAwardMonthsRemaining = 2;
  }

  return createNews(
    month,
    "award",
    winner.parkId === PLAYER_PARK_ID ? "success" : "info",
    `${winner.parkName} wins Best Park of the Year.`,
    winner.parkId === PLAYER_PARK_ID
      ? "Your park takes the top annual honour, which should translate into stronger guest interest over the next months."
      : "The award winner gets a prestige spike and extra attention from guests and investors alike.",
    winner.parkId
  );
}

function decrementAwardDurations(state: WorldParkLeagueState): void {
  if (state.player.activeAwardMonthsRemaining > 0) {
    state.player.activeAwardMonthsRemaining -= 1;
    if (state.player.activeAwardMonthsRemaining === 0) {
      state.player.activeAwardTitle = null;
    }
  }
}

function syncSpotlightState(
  state: WorldParkLeagueState,
  month: number
): NewsItem | null {
  if (
    state.world.spotlightDebugOverrideDaysRemaining > 0 &&
    state.world.spotlightDebugOverrideParkId
  ) {
    const forcedParkId = state.world.spotlightDebugOverrideParkId;
    const forcedParkName =
      forcedParkId === PLAYER_PARK_ID
        ? state.player.parkName
        : state.world.leaderboard.find((entry) => entry.parkId === forcedParkId)?.parkName ??
          state.world.rivals.find((rival) => rival.id === forcedParkId)?.name ??
          state.world.spotlightParkName ??
          "Debug Spotlight";
    state.world.spotlightParkId = forcedParkId;
    state.world.spotlightParkName = forcedParkName;
    state.world.spotlightMonthsRemaining = 1;
    state.world.spotlightGuestMultiplier = state.config.spotlightGuestMultiplier;
    return null;
  }

  if (
    state.world.spotlightRewardOverrideDaysRemaining > 0 &&
    state.world.spotlightRewardOverrideParkId
  ) {
    const rewardParkId = state.world.spotlightRewardOverrideParkId;
    const rewardParkName =
      rewardParkId === PLAYER_PARK_ID
        ? state.player.parkName
        : state.world.leaderboard.find((entry) => entry.parkId === rewardParkId)?.parkName ??
          state.world.rivals.find((rival) => rival.id === rewardParkId)?.name ??
          state.world.spotlightParkName ??
          SPOTLIGHT_TITLE;
    state.world.spotlightParkId = rewardParkId;
    state.world.spotlightParkName = rewardParkName;
    state.world.spotlightMonthsRemaining = 1;
    state.world.spotlightGuestMultiplier = state.config.spotlightGuestMultiplier;
    return null;
  }

  const leader = state.world.leaderboard[0];
  if (!leader) {
    state.world.spotlightParkId = null;
    state.world.spotlightParkName = null;
    state.world.spotlightMonthsRemaining = 0;
    return null;
  }

  const previousParkId = state.world.spotlightParkId;
  const spotlightChanged = previousParkId !== leader.parkId;

  state.world.spotlightParkId = leader.parkId;
  state.world.spotlightParkName = leader.parkName;
  state.world.spotlightMonthsRemaining = 1;
  state.world.spotlightGuestMultiplier = state.config.spotlightGuestMultiplier;

  if (!spotlightChanged) {
    return null;
  }

  return createNews(
    month,
    "award",
    leader.isPlayer ? "success" : "info",
    `${leader.parkName} captures ${SPOTLIGHT_TITLE}.`,
    leader.isPlayer
      ? "HURRAY! Your park is now the best park of the month. A huge guest rush is live and the spotlight bonus is pumping serious money through the gates."
      : "The league leader is now riding a huge guest rush, extra attention and a top-of-market prestige spike.",
    leader.parkId
  );
}

function syncSupportingBoostStates(
  state: WorldParkLeagueState,
  cycleKey: number,
  month: number
): NewsItem[] {
  const news: NewsItem[] = [];
  const rng = createScopedRng(state.world.seed, cycleKey, 4701);

  const featuredCandidates = state.world.leaderboard.filter(
    (entry) => entry.rank >= 2 && entry.rank <= 10
  );
  const breakoutCandidates = state.world.leaderboard.filter(
    (entry) => entry.rank >= 11 && entry.rank <= 20
  );

  const previousFeatured = state.world.featuredParkId;
  const previousBreakout = state.world.breakoutParkId;
  const featuredOverride =
    state.world.featuredDebugOverrideDaysRemaining > 0 &&
    state.world.featuredDebugOverrideParkId
      ? resolveLeaderboardEntryByParkId(state, state.world.featuredDebugOverrideParkId)
      : null;
  const featuredRewardOverride =
    !featuredOverride &&
    state.world.featuredRewardOverrideDaysRemaining > 0 &&
    state.world.featuredRewardOverrideParkId
      ? resolveLeaderboardEntryByParkId(state, state.world.featuredRewardOverrideParkId)
      : null;
  const breakoutOverride =
    state.world.breakoutDebugOverrideDaysRemaining > 0 &&
    state.world.breakoutDebugOverrideParkId
      ? resolveLeaderboardEntryByParkId(state, state.world.breakoutDebugOverrideParkId)
      : null;
  const breakoutRewardOverride =
    !breakoutOverride &&
    state.world.breakoutRewardOverrideDaysRemaining > 0 &&
    state.world.breakoutRewardOverrideParkId
      ? resolveLeaderboardEntryByParkId(state, state.world.breakoutRewardOverrideParkId)
      : null;

  const featured = featuredOverride ??
    featuredRewardOverride ??
    (featuredCandidates.length > 0
      ? featuredCandidates[rng.int(0, featuredCandidates.length - 1)]
      : null);
  const breakout = breakoutOverride ??
    breakoutRewardOverride ??
    (breakoutCandidates.length > 0
      ? breakoutCandidates[rng.int(0, breakoutCandidates.length - 1)]
      : null);

  state.world.featuredParkId = featured?.parkId ?? null;
  state.world.featuredParkName = featured?.parkName ?? null;
  state.world.featuredDaysRemaining = featured ? SUPPORTING_BOOST_DURATION_DAYS : 0;
  state.world.featuredGuestMultiplier = state.config.featuredGuestMultiplier;

  state.world.breakoutParkId = breakout?.parkId ?? null;
  state.world.breakoutParkName = breakout?.parkName ?? null;
  state.world.breakoutDaysRemaining = breakout ? SUPPORTING_BOOST_DURATION_DAYS : 0;
  state.world.breakoutGuestMultiplier = state.config.breakoutGuestMultiplier;

  if (featured && featured.parkId !== previousFeatured) {
    news.push(
      createNews(
        month,
        "world",
        featured.isPlayer ? "success" : "info",
        `${featured.parkName} lands the ${FEATURED_TITLE}.`,
        featured.isPlayer
          ? "You were randomly picked as this week's featured park from the top chasing pack, giving you a strong extra visibility push."
          : "A surprise media feature just gave one of the chasing parks a short, noticeable crowd boost.",
        featured.parkId
      )
    );
  }

  if (breakout && breakout.parkId !== previousBreakout) {
    news.push(
      createNews(
        month,
        "world",
        breakout.isPlayer ? "success" : "info",
        `${breakout.parkName} catches ${BREAKOUT_TITLE}.`,
        breakout.isPlayer
          ? "Your park was randomly picked from the mid-table group for a smaller but still useful burst of attention."
          : "A mid-table operator just caught a smaller lucky break and should see a short spike in attention.",
        breakout.parkId
      )
    );
  }

  return news;
}

function advanceSpotlightDebugOverride(
  state: WorldParkLeagueState,
  daysElapsed: number
): void {
  const elapsedDays = Math.max(1, Math.round(daysElapsed));

  if (state.world.spotlightDebugOverrideDaysRemaining <= 0) {
    state.world.spotlightDebugOverrideParkId = null;
  } else {
    state.world.spotlightDebugOverrideDaysRemaining = Math.max(
      0,
      state.world.spotlightDebugOverrideDaysRemaining - elapsedDays
    );
    if (state.world.spotlightDebugOverrideDaysRemaining === 0) {
      state.world.spotlightDebugOverrideParkId = null;
    }
  }

  if (state.world.spotlightRewardOverrideDaysRemaining <= 0) {
    state.world.spotlightRewardOverrideParkId = null;
  } else {
    state.world.spotlightRewardOverrideDaysRemaining = Math.max(
      0,
      state.world.spotlightRewardOverrideDaysRemaining - elapsedDays
    );
    if (state.world.spotlightRewardOverrideDaysRemaining === 0) {
      state.world.spotlightRewardOverrideParkId = null;
    }
  }

  state.world.featuredDaysRemaining = Math.max(
    0,
    state.world.featuredDaysRemaining - elapsedDays
  );
  if (state.world.featuredDaysRemaining === 0) {
    state.world.featuredParkId = null;
    state.world.featuredParkName = null;
  }

  if (state.world.featuredDebugOverrideDaysRemaining <= 0) {
    state.world.featuredDebugOverrideParkId = null;
  } else {
    state.world.featuredDebugOverrideDaysRemaining = Math.max(
      0,
      state.world.featuredDebugOverrideDaysRemaining - elapsedDays
    );
    if (state.world.featuredDebugOverrideDaysRemaining === 0) {
      state.world.featuredDebugOverrideParkId = null;
    }
  }

  if (state.world.featuredRewardOverrideDaysRemaining <= 0) {
    state.world.featuredRewardOverrideParkId = null;
  } else {
    state.world.featuredRewardOverrideDaysRemaining = Math.max(
      0,
      state.world.featuredRewardOverrideDaysRemaining - elapsedDays
    );
    if (state.world.featuredRewardOverrideDaysRemaining === 0) {
      state.world.featuredRewardOverrideParkId = null;
    }
  }

  state.world.breakoutDaysRemaining = Math.max(
    0,
    state.world.breakoutDaysRemaining - elapsedDays
  );
  if (state.world.breakoutDaysRemaining === 0) {
    state.world.breakoutParkId = null;
    state.world.breakoutParkName = null;
  }

  if (state.world.breakoutDebugOverrideDaysRemaining <= 0) {
    state.world.breakoutDebugOverrideParkId = null;
  } else {
    state.world.breakoutDebugOverrideDaysRemaining = Math.max(
      0,
      state.world.breakoutDebugOverrideDaysRemaining - elapsedDays
    );
    if (state.world.breakoutDebugOverrideDaysRemaining === 0) {
      state.world.breakoutDebugOverrideParkId = null;
    }
  }

  if (state.world.breakoutRewardOverrideDaysRemaining <= 0) {
    state.world.breakoutRewardOverrideParkId = null;
  } else {
    state.world.breakoutRewardOverrideDaysRemaining = Math.max(
      0,
      state.world.breakoutRewardOverrideDaysRemaining - elapsedDays
    );
    if (state.world.breakoutRewardOverrideDaysRemaining === 0) {
      state.world.breakoutRewardOverrideParkId = null;
    }
  }
}

function resolveLeaderboardEntryByParkId(
  state: WorldParkLeagueState,
  parkId: string
): LeaderboardEntry | null {
  if (parkId === PLAYER_PARK_ID) {
    return state.world.leaderboard.find((entry) => entry.parkId === PLAYER_PARK_ID) ?? null;
  }

  const leaderboardEntry = state.world.leaderboard.find((entry) => entry.parkId === parkId);
  if (leaderboardEntry) {
    return leaderboardEntry;
  }

  const rival = state.world.rivals.find((candidate) => candidate.id === parkId);
  if (!rival) {
    return null;
  }

  return {
    parkId: rival.id,
    parkName: rival.name,
    isPlayer: false,
    rank: state.world.leaderboard.length + 1,
    score: sanitizeLeaderboardScore(computeRivalScore(rival, state.world.competitionHeat)),
    scoreDelta: roundTo(rival.momentum, 1),
    marketShare: 0,
    monthlyProfit: rival.finance.monthlyProfit,
    companyValue: rival.finance.companyValue,
    monthlyVisitors: rival.derived.monthlyVisitors,
    debtRatio: rival.derived.debtRatio,
    regionLabel: getRegionLabel(rival.region),
    statusLabel: getDisplayStatusLabel(state, rival.id, getRivalStatusLabel(rival)),
    trendLabel: getMomentumTrendLabel(rival.momentum),
  };
}

function calculateGlobalDemand(state: WorldParkLeagueState): number {
  const regionalDemandIndex = clamp(
    average(
      Object.values(state.world.regionMarkets).map(
        (region) =>
          region.demandModifier * 0.55 +
          region.tourismModifier * 0.45 -
          (region.competitionModifier - 1) * 0.08
      )
    ),
    0.9,
    1.12
  );
  const safetyPenalty = state.world.safetyScrutinyMonthsRemaining > 0 ? 0.97 : 1;

  return Math.round(
    WORLD_DEMAND_BASE *
      Math.pow(state.world.structuralGrowthIndex, 0.62) *
      state.world.seasonFactor *
      state.world.economyIndex *
      state.world.tourismIndex *
      regionalDemandIndex *
      safetyPenalty *
      clamp(1 + (state.world.competitionHeat - 1) * 0.08, 0.92, 1.12)
  );
}

function calculateFundamentalCompanyValue(
  rival: RivalPark,
  monthlyRevenue: number,
  monthlyProfit: number,
  structuralGrowthIndex: number
): number {
  const dynamicFloor = 280_000 * Math.pow(structuralGrowthIndex, 0.35);
  const dynamicCap = 18_000_000 * Math.pow(structuralGrowthIndex, 0.92);
  const positiveProfit = Math.max(0, monthlyProfit);
  const fundamentalValue = clamp(
    monthlyRevenue * (24 + structuralGrowthIndex * 0.9) +
      positiveProfit * (42 + structuralGrowthIndex * 1.4) +
      rival.derived.score * 8_000 +
      rival.finance.cashReserve * 0.6 -
      rival.finance.debt * 0.55,
    dynamicFloor,
    dynamicCap
  );

  return clamp(
    rival.finance.companyValue * 0.77 +
      fundamentalValue * 0.23 +
      rival.momentum * 9_000 +
      structuralGrowthIndex * 3_500,
    dynamicFloor,
    dynamicCap
  );
}

function createNews(
  month: number,
  category: NewsItem["category"],
  severity: NewsItem["severity"],
  headline: string,
  detail: string,
  parkId?: string
): NewsItem {
  return {
    id: `${category}-${month}-${hashString(`${headline}:${detail}:${month}`)}`,
    month,
    category,
    severity,
    headline,
    detail,
    ...(parkId ? { parkId } : {}),
  };
}

function createUniqueRivalId(usedIds: Set<string>, startIndex: number): string {
  let candidate = `rival-${startIndex}`;
  let offset = 1;
  while (usedIds.has(candidate)) {
    candidate = `rival-${startIndex + offset}`;
    offset += 1;
  }
  return candidate;
}

function comparisonRivalId(state: WorldParkLeagueState): string | null {
  const playerRank = state.player.currentRank ?? null;
  if (!playerRank) {
    return state.player.watchlist.focusRivalIds[0] ?? null;
  }

  const nextUp =
    state.world.leaderboard.find((entry) => !entry.isPlayer && entry.rank === Math.max(1, playerRank - 1)) ??
    state.world.leaderboard.find((entry) => !entry.isPlayer);
  return nextUp?.parkId ?? state.player.watchlist.focusRivalIds[0] ?? null;
}

function getRivalStatusLabel(rival: RivalPark): string {
  if (!rival.status.active) {
    return rival.status.mergedIntoId ? "Merged" : "Bankrupt";
  }
  if (rival.status.scandalMonthsRemaining > 0) {
    return "Scandal";
  }
  if (rival.status.expansionMonthsRemaining > 0) {
    return "Expansion";
  }
  if (rival.status.distressLevel === 2) {
    return "Distress";
  }
  if (rival.status.distressLevel === 1) {
    return "Pressure";
  }
  if (rival.status.strategyShiftMonthsRemaining > 0) {
    return "Pivot";
  }
  if (rival.status.recoveryMonthsRemaining > 0) {
    return "Recovery";
  }
  return "Stable";
}

function formatSignedMetric(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatSignedMoneyCompact(value: number): string {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${formatCompactMoney(Math.abs(value))}`;
}

function describeStrategyFocus(strategyFocus: RivalPark["status"]["strategyFocus"]): string {
  switch (strategyFocus) {
    case "turnaround":
      return "turnaround";
    case "brand_push":
      return "brand strategy";
    case "innovation_bet":
      return "innovation push";
    case "efficiency_drive":
      return "efficiency program";
    case "balanced":
      return "balanced strategy";
  }
}
