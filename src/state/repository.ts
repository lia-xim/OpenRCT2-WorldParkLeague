import {
  CURRENT_SCHEMA_VERSION,
  DAYS_PER_MONTH,
  BREAKOUT_GUEST_MULTIPLIER,
  BREAKOUT_TITLE,
  FEATURED_GUEST_MULTIPLIER,
  FEATURED_TITLE,
  PLAYER_PARK_ID,
  PLUGIN_VERSION,
  SPOTLIGHT_DEBUG_OVERRIDE_DAYS,
  SPOTLIGHT_GUEST_MULTIPLIER,
  SPOTLIGHT_TITLE,
  STORAGE_KEY,
} from "../config";
import {
  acceptEquityOffer,
  createInitialEquityState,
  declineEquityOffer,
  repurchaseOutsideEquity,
} from "../domain/equity";
import {
  acceptBoardProposal,
  declineBoardProposal,
} from "../domain/governance";
import {
  buyInvestmentByRivalId,
  refreshInvestmentSummary,
  sellInvestmentByRivalId,
} from "../domain/investments";
import {
  applyOwnerCashDelta,
  createInitialOwnerState,
  migrateLegacyOwnerCash,
} from "../domain/owner";
import {
  createInitialPlayerActionState,
  launchPlayerLeagueAction,
} from "../domain/playerActions";
import { createInitialPrestigeState } from "../domain/prestige";
import { createInitialRivalChallengeState } from "../domain/rivalry";
import {
  createInitialWatchlistState,
  toggleWatchedRival,
} from "../domain/watchlist";
import { denormalizeGameMoney } from "../domain/currency";
import { roundTo } from "../domain/math";
import { readPlayerSnapshot } from "../domain/player";
import { appendGeneratedRivals } from "../domain/rivals";
import {
  createInitialStateAtDay,
  simulateLivePulse,
  simulateMonth,
} from "../domain/simulation";
import type {
  LivePulseResult,
  ParkHistoryMarker,
  ParkHistoryPoint,
  MonthlySimulationResult,
  PlayerLeagueActionState,
  PlayerRivalChallenge,
  PlayerPrestigeState,
  PlayerLeagueActionType,
  PlayerOwnerState,
  PlayerRivalChallengeState,
  PlayerWatchlistState,
  SimulationConfig,
  PlayerDirective,
  PlayerSnapshot,
  RegionKey,
  RegionMarketState,
  RivalPark,
  WatchlistAlert,
  WorldParkLeagueState,
} from "../types";

function getStorage(): Configuration {
  return context.getParkStorage();
}

export function ensureState(snapshot: PlayerSnapshot = readPlayerSnapshot()): WorldParkLeagueState {
  const storage = getStorage();
  const rawState = storage.get(STORAGE_KEY);
  const state = migrateState(rawState, snapshot);
  storage.set(STORAGE_KEY, state);
  return state;
}

export function readState(snapshot: PlayerSnapshot = readPlayerSnapshot()): WorldParkLeagueState {
  const rawState = getStorage().get(STORAGE_KEY);
  return isValidState(rawState) ? rawState : ensureState(snapshot);
}

export function saveState(state: WorldParkLeagueState): void {
  getStorage().set(STORAGE_KEY, state);
}

export function syncStateToCurrentMonth(
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): {
  state: WorldParkLeagueState;
  results: MonthlySimulationResult[];
  pulseResults: LivePulseResult[];
} {
  let state = ensureState(snapshot);
  const results: MonthlySimulationResult[] = [];
  const pulseResults: LivePulseResult[] = [];

  while (state.lastSimulatedMonth < snapshot.currentMonth) {
    const result = simulateMonth(state, snapshot, state.lastSimulatedMonth + 1);
    results.push(result);
    applyParkCashDelta(result.parkCashDelta);
    state = result.nextState;
  }

  state.lastLivePulseDayIndex = Math.max(
    state.lastLivePulseDayIndex,
    getMonthStartDayIndex(snapshot.currentMonth)
  );
  while (
    state.lastLivePulseDayIndex + state.config.livePulseIntervalDays <=
    snapshot.currentDayIndex
  ) {
    const nextPulseDayIndex = state.lastLivePulseDayIndex + state.config.livePulseIntervalDays;
    const result = simulateLivePulse(state, snapshot, nextPulseDayIndex);
    pulseResults.push(result);
    applyParkCashDelta(result.parkCashDelta);
    state = result.nextState;
  }

  saveState(state);
  return { state, results, pulseResults };
}

export function runManualSimulation(
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): MonthlySimulationResult {
  const state = ensureState(snapshot);
  const result = simulateMonth(state, snapshot, state.lastSimulatedMonth + 1);
  applyParkCashDelta(result.parkCashDelta);
  saveState(result.nextState);
  return result;
}

export function resetState(snapshot: PlayerSnapshot = readPlayerSnapshot()): WorldParkLeagueState {
  const freshState = createInitialStateAtDay(
    snapshot.currentMonth,
    snapshot.currentDayIndex,
    snapshot.parkName
  );
  saveState(freshState);
  return freshState;
}

export function triggerDebugSpotlight(
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  state.world.featuredDebugOverrideParkId = null;
  state.world.featuredDebugOverrideDaysRemaining = 0;
  state.world.breakoutDebugOverrideParkId = null;
  state.world.breakoutDebugOverrideDaysRemaining = 0;
  state.world.spotlightParkId = PLAYER_PARK_ID;
  state.world.spotlightParkName = snapshot.parkName;
  state.world.spotlightMonthsRemaining = 1;
  state.world.spotlightGuestMultiplier = state.config.spotlightGuestMultiplier;
  state.world.spotlightDebugOverrideParkId = PLAYER_PARK_ID;
  state.world.spotlightDebugOverrideDaysRemaining = SPOTLIGHT_DEBUG_OVERRIDE_DAYS;
  saveState(state);
  return {
    state,
    ok: true,
    message: `${SPOTLIGHT_TITLE} forced onto your park for debugging for ${SPOTLIGHT_DEBUG_OVERRIDE_DAYS} days.`,
  };
}

export function triggerDebugFeaturedBoost(
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  state.world.featuredParkId = PLAYER_PARK_ID;
  state.world.featuredParkName = snapshot.parkName;
  state.world.featuredDaysRemaining = SPOTLIGHT_DEBUG_OVERRIDE_DAYS;
  state.world.featuredGuestMultiplier = state.config.featuredGuestMultiplier;
  state.world.featuredDebugOverrideParkId = PLAYER_PARK_ID;
  state.world.featuredDebugOverrideDaysRemaining = SPOTLIGHT_DEBUG_OVERRIDE_DAYS;
  saveState(state);
  return {
    state,
    ok: true,
    message: `${FEATURED_TITLE} forced onto your park for debugging for ${SPOTLIGHT_DEBUG_OVERRIDE_DAYS} days.`,
  };
}

export function triggerDebugBreakoutBoost(
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  state.world.breakoutParkId = PLAYER_PARK_ID;
  state.world.breakoutParkName = snapshot.parkName;
  state.world.breakoutDaysRemaining = SPOTLIGHT_DEBUG_OVERRIDE_DAYS;
  state.world.breakoutGuestMultiplier = state.config.breakoutGuestMultiplier;
  state.world.breakoutDebugOverrideParkId = PLAYER_PARK_ID;
  state.world.breakoutDebugOverrideDaysRemaining = SPOTLIGHT_DEBUG_OVERRIDE_DAYS;
  saveState(state);
  return {
    state,
    ok: true,
    message: `${BREAKOUT_TITLE} forced onto your park for debugging for ${SPOTLIGHT_DEBUG_OVERRIDE_DAYS} days.`,
  };
}

export function buyInvestmentAtRank(
  rank: number,
  snapshot: PlayerSnapshot = readPlayerSnapshot(),
  share: number = 0.05
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const targetEntry = state.world.leaderboard.find(
    (entry) => !entry.isPlayer && entry.rank === rank
  );

  if (!targetEntry) {
    return { state, ok: false, message: "No rival found at that rank." };
  }

  return buyInvestmentForRival(targetEntry.parkId, snapshot, share);
}

export function buyInvestmentForRival(
  rivalId: string,
  snapshot: PlayerSnapshot = readPlayerSnapshot(),
  share: number = 0.05
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const liveSnapshot = readPlayerSnapshot();
  const result = buyInvestmentByRivalId(
    state,
    rivalId,
    state.player.owner.cash,
    liveSnapshot.currentMonth,
    share
  );
  if (!result.ok) {
    return { state: result.state, ok: false, message: result.message };
  }

  applyOwnerCashDelta(result.state, result.cashDelta, result.message);
  saveState(result.state);
  return { state: result.state, ok: true, message: result.message };
}

export function sellInvestmentAtRank(
  rank: number,
  snapshot: PlayerSnapshot = readPlayerSnapshot(),
  share?: number
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const targetEntry = state.world.leaderboard.find(
    (entry) => !entry.isPlayer && entry.rank === rank
  );

  if (!targetEntry) {
    return { state, ok: false, message: "No rival found at that rank." };
  }

  return sellInvestmentForRival(targetEntry.parkId, snapshot, share);
}

export function sellInvestmentForRival(
  rivalId: string,
  snapshot: PlayerSnapshot = readPlayerSnapshot(),
  share?: number
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const result = sellInvestmentByRivalId(state, rivalId, share);
  if (!result.ok) {
    return { state: result.state, ok: false, message: result.message };
  }

  applyOwnerCashDelta(result.state, result.cashDelta, result.message);
  saveState(result.state);
  return { state: result.state, ok: true, message: result.message };
}

export function acceptPlayerEquityOffer(
  offerId: string,
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const result = acceptEquityOffer(state, offerId);
  if (!result.ok) {
    return { state: result.state, ok: false, message: result.message };
  }

  applyParkCashDelta(result.cashDelta);
  saveState(result.state);
  return { state: result.state, ok: true, message: result.message };
}

export function declinePlayerEquityOffer(
  offerId: string,
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const result = declineEquityOffer(state, offerId);
  if (!result.ok) {
    return { state: result.state, ok: false, message: result.message };
  }

  saveState(result.state);
  return { state: result.state, ok: true, message: result.message };
}

export function repurchasePlayerEquity(
  share: number,
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const liveSnapshot = readPlayerSnapshot();
  const result = repurchaseOutsideEquity(state, liveSnapshot, share);
  if (!result.ok) {
    return { state: result.state, ok: false, message: result.message };
  }

  applyParkCashDelta(result.cashDelta);
  saveState(result.state);
  return { state: result.state, ok: true, message: result.message };
}

export function acceptGovernanceProposal(
  proposalId: string,
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const liveSnapshot = readPlayerSnapshot();
  const result = acceptBoardProposal(state, liveSnapshot, proposalId);
  if (!result.ok) {
    return { state: result.state, ok: false, message: result.message };
  }

  applyParkCashDelta(result.cashDelta);
  applyParkLoanDelta(result.loanDelta);
  saveState(result.state);
  return { state: result.state, ok: true, message: result.message };
}

export function declineGovernanceProposal(
  proposalId: string,
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const result = declineBoardProposal(state, proposalId);
  if (!result.ok) {
    return { state: result.state, ok: false, message: result.message };
  }

  saveState(result.state);
  return { state: result.state, ok: true, message: result.message };
}

export function startLeagueAction(
  actionType: "pr_blitz" | "guest_festival" | "safety_campaign" | "efficiency_push",
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const liveSnapshot = readPlayerSnapshot();
  const result = launchPlayerLeagueAction(state, liveSnapshot, actionType);
  if (!result.ok) {
    return { state: result.state, ok: false, message: result.message };
  }

  applyParkCashDelta(result.cashDelta);
  saveState(result.state);
  return { state: result.state, ok: true, message: result.message };
}

export function toggleWatchlistRivalById(
  rivalId: string,
  snapshot: PlayerSnapshot = readPlayerSnapshot()
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  const { state } = syncStateToCurrentMonth(snapshot);
  const result = toggleWatchedRival(state, rivalId);
  if (!result.ok) {
    return result;
  }

  saveState(result.state);
  return result;
}

function applyParkCashDelta(delta: number): void {
  if (delta === 0) {
    return;
  }

  park.cash += denormalizeGameMoney(delta);
}

function applyParkLoanDelta(delta: number): void {
  if (delta === 0) {
    return;
  }

  park.bankLoan = Math.max(0, park.bankLoan + denormalizeGameMoney(delta));
}

export function migrateState(
  value: unknown,
  snapshot: PlayerSnapshot
): WorldParkLeagueState {
  const freshState = createInitialStateAtDay(
    snapshot.currentMonth,
    snapshot.currentDayIndex,
    snapshot.parkName
  );
  if (!isObjectLike(value)) {
    return freshState;
  }

  const candidate = value as Partial<WorldParkLeagueState>;
  const sourceSchemaVersion =
    typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : 0;
  if (!candidate.world || !candidate.player || !candidate.config) {
    return freshState;
  }

  const merged: WorldParkLeagueState = {
    ...freshState,
    ...candidate,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    pluginVersion: PLUGIN_VERSION,
    lastLivePulseDayIndex:
      typeof candidate.lastLivePulseDayIndex === "number"
        ? Math.max(0, Math.round(candidate.lastLivePulseDayIndex))
        : snapshot.currentDayIndex,
    lastLiveEventDayIndex:
      typeof candidate.lastLiveEventDayIndex === "number"
        ? Math.max(0, Math.round(candidate.lastLiveEventDayIndex))
        : snapshot.currentDayIndex,
    config: normalizeConfig(candidate.config, freshState.config),
    world: {
      ...freshState.world,
      ...candidate.world,
      structuralGrowthIndex:
        typeof candidate.world.structuralGrowthIndex === "number"
          ? Math.max(1, candidate.world.structuralGrowthIndex)
          : freshState.world.structuralGrowthIndex,
      safetyScrutinyMonthsRemaining:
        typeof candidate.world.safetyScrutinyMonthsRemaining === "number"
          ? Math.max(0, candidate.world.safetyScrutinyMonthsRemaining)
          : freshState.world.safetyScrutinyMonthsRemaining,
      spotlightParkId:
        typeof candidate.world.spotlightParkId === "string" || candidate.world.spotlightParkId === null
          ? candidate.world.spotlightParkId
          : freshState.world.spotlightParkId,
      spotlightParkName:
        typeof candidate.world.spotlightParkName === "string" || candidate.world.spotlightParkName === null
          ? candidate.world.spotlightParkName
          : freshState.world.spotlightParkName,
      spotlightMonthsRemaining:
        typeof candidate.world.spotlightMonthsRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.spotlightMonthsRemaining))
          : freshState.world.spotlightMonthsRemaining,
      spotlightGuestMultiplier:
        typeof candidate.world.spotlightGuestMultiplier === "number"
          ? Math.max(1, candidate.world.spotlightGuestMultiplier)
          : freshState.world.spotlightGuestMultiplier,
      spotlightRewardOverrideParkId:
        typeof candidate.world.spotlightRewardOverrideParkId === "string" ||
        candidate.world.spotlightRewardOverrideParkId === null
          ? candidate.world.spotlightRewardOverrideParkId
          : freshState.world.spotlightRewardOverrideParkId,
      spotlightRewardOverrideDaysRemaining:
        typeof candidate.world.spotlightRewardOverrideDaysRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.spotlightRewardOverrideDaysRemaining))
          : freshState.world.spotlightRewardOverrideDaysRemaining,
      spotlightDebugOverrideParkId:
        typeof candidate.world.spotlightDebugOverrideParkId === "string" ||
        candidate.world.spotlightDebugOverrideParkId === null
          ? candidate.world.spotlightDebugOverrideParkId
          : freshState.world.spotlightDebugOverrideParkId,
      spotlightDebugOverrideDaysRemaining:
        typeof candidate.world.spotlightDebugOverrideDaysRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.spotlightDebugOverrideDaysRemaining))
          : freshState.world.spotlightDebugOverrideDaysRemaining,
      featuredParkId:
        typeof candidate.world.featuredParkId === "string" || candidate.world.featuredParkId === null
          ? candidate.world.featuredParkId
          : freshState.world.featuredParkId,
      featuredParkName:
        typeof candidate.world.featuredParkName === "string" || candidate.world.featuredParkName === null
          ? candidate.world.featuredParkName
          : freshState.world.featuredParkName,
      featuredDaysRemaining:
        typeof candidate.world.featuredDaysRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.featuredDaysRemaining))
          : freshState.world.featuredDaysRemaining,
      featuredGuestMultiplier:
        typeof candidate.world.featuredGuestMultiplier === "number"
          ? Math.max(1, candidate.world.featuredGuestMultiplier)
          : freshState.world.featuredGuestMultiplier,
      featuredRewardOverrideParkId:
        typeof candidate.world.featuredRewardOverrideParkId === "string" ||
        candidate.world.featuredRewardOverrideParkId === null
          ? candidate.world.featuredRewardOverrideParkId
          : freshState.world.featuredRewardOverrideParkId,
      featuredRewardOverrideDaysRemaining:
        typeof candidate.world.featuredRewardOverrideDaysRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.featuredRewardOverrideDaysRemaining))
          : freshState.world.featuredRewardOverrideDaysRemaining,
      featuredDebugOverrideParkId:
        typeof candidate.world.featuredDebugOverrideParkId === "string" ||
        candidate.world.featuredDebugOverrideParkId === null
          ? candidate.world.featuredDebugOverrideParkId
          : freshState.world.featuredDebugOverrideParkId,
      featuredDebugOverrideDaysRemaining:
        typeof candidate.world.featuredDebugOverrideDaysRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.featuredDebugOverrideDaysRemaining))
          : freshState.world.featuredDebugOverrideDaysRemaining,
      breakoutParkId:
        typeof candidate.world.breakoutParkId === "string" || candidate.world.breakoutParkId === null
          ? candidate.world.breakoutParkId
          : freshState.world.breakoutParkId,
      breakoutParkName:
        typeof candidate.world.breakoutParkName === "string" || candidate.world.breakoutParkName === null
          ? candidate.world.breakoutParkName
          : freshState.world.breakoutParkName,
      breakoutDaysRemaining:
        typeof candidate.world.breakoutDaysRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.breakoutDaysRemaining))
          : freshState.world.breakoutDaysRemaining,
      breakoutGuestMultiplier:
        typeof candidate.world.breakoutGuestMultiplier === "number"
          ? Math.max(1, candidate.world.breakoutGuestMultiplier)
          : freshState.world.breakoutGuestMultiplier,
      breakoutRewardOverrideParkId:
        typeof candidate.world.breakoutRewardOverrideParkId === "string" ||
        candidate.world.breakoutRewardOverrideParkId === null
          ? candidate.world.breakoutRewardOverrideParkId
          : freshState.world.breakoutRewardOverrideParkId,
      breakoutRewardOverrideDaysRemaining:
        typeof candidate.world.breakoutRewardOverrideDaysRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.breakoutRewardOverrideDaysRemaining))
          : freshState.world.breakoutRewardOverrideDaysRemaining,
      breakoutDebugOverrideParkId:
        typeof candidate.world.breakoutDebugOverrideParkId === "string" ||
        candidate.world.breakoutDebugOverrideParkId === null
          ? candidate.world.breakoutDebugOverrideParkId
          : freshState.world.breakoutDebugOverrideParkId,
      breakoutDebugOverrideDaysRemaining:
        typeof candidate.world.breakoutDebugOverrideDaysRemaining === "number"
          ? Math.max(0, Math.round(candidate.world.breakoutDebugOverrideDaysRemaining))
          : freshState.world.breakoutDebugOverrideDaysRemaining,
      regionMarkets: normalizeRegionMarkets(candidate.world.regionMarkets, freshState.world.regionMarkets),
      rivals: normalizeRivals(
        Array.isArray(candidate.world.rivals) ? candidate.world.rivals : [],
        freshState.world.rivals
      ),
      history: normalizeHistory(candidate.world.history, freshState.world.history),
      newsFeed: Array.isArray(candidate.world.newsFeed)
        ? candidate.world.newsFeed
        : freshState.world.newsFeed,
      awards: Array.isArray(candidate.world.awards) ? candidate.world.awards : freshState.world.awards,
      leaderboard: Array.isArray(candidate.world.leaderboard)
        ? candidate.world.leaderboard
        : freshState.world.leaderboard,
      historyEvents: normalizeHistoryEvents(
        candidate.world.historyEvents,
        freshState.world.historyEvents
      ),
    },
    player: {
      ...freshState.player,
      ...candidate.player,
      parkName: snapshot.parkName,
      previousScore:
        typeof candidate.player.previousScore === "number"
          ? candidate.player.previousScore
          : typeof candidate.player.score === "number"
            ? candidate.player.score
            : freshState.player.previousScore,
      liveMomentum:
        typeof candidate.player.liveMomentum === "number"
          ? candidate.player.liveMomentum
          : freshState.player.liveMomentum,
      owner: normalizeOwner(candidate.player.owner, freshState.player.owner),
      investments: Array.isArray(candidate.player.investments)
        ? candidate.player.investments.map((investment) => ({
            rivalId: investment.rivalId,
            share: typeof investment.share === "number" ? investment.share : 0,
            costBasis: typeof investment.costBasis === "number" ? investment.costBasis : 0,
            purchasedAtMonth:
              typeof investment.purchasedAtMonth === "number"
                ? investment.purchasedAtMonth
                : snapshot.currentMonth,
            totalDividendsReceived:
              typeof investment.totalDividendsReceived === "number"
                ? investment.totalDividendsReceived
                : 0,
            lastDividend:
              typeof investment.lastDividend === "number" ? investment.lastDividend : 0,
            realizedProfit:
              typeof investment.realizedProfit === "number" ? investment.realizedProfit : 0,
          }))
        : [],
      investmentSummary: {
        ...freshState.player.investmentSummary,
        ...candidate.player.investmentSummary,
      },
      equity: normalizeEquity(candidate.player.equity, freshState.player.equity),
      governance: normalizeGovernance(candidate.player.governance, freshState.player.governance),
      actions: normalizeActions(candidate.player.actions, freshState.player.actions),
      watchlist: normalizeWatchlist(candidate.player.watchlist, freshState.player.watchlist),
      rivalry: normalizeRivalry(candidate.player.rivalry, freshState.player.rivalry),
      prestige: normalizePrestige(candidate.player.prestige, freshState.player.prestige),
    },
  };

  if (sourceSchemaVersion < 20) {
    merged.config.dominantLeadThreshold = freshState.config.dominantLeadThreshold;
    merged.config.maxCatchUpPressure = freshState.config.maxCatchUpPressure;
    merged.config.spotlightGuestMultiplier = freshState.config.spotlightGuestMultiplier;
    merged.config.spotlightScoreBonus = freshState.config.spotlightScoreBonus;
  }

  if (sourceSchemaVersion < 22) {
    merged.config.featuredGuestMultiplier = freshState.config.featuredGuestMultiplier;
    merged.config.breakoutGuestMultiplier = freshState.config.breakoutGuestMultiplier;
    merged.config.investmentSaleMultiplier = freshState.config.investmentSaleMultiplier;
    merged.config.investmentDividendMultiplier = freshState.config.investmentDividendMultiplier;
    merged.config.prestigeRewardCashMultiplier = freshState.config.prestigeRewardCashMultiplier;
    merged.config.prestigeRewardBoostMultiplier = freshState.config.prestigeRewardBoostMultiplier;
  }

  if (sourceSchemaVersion < 23 || !isObjectLike(candidate.player.owner)) {
    merged.player.owner = createInitialOwnerState(migrateLegacyOwnerCash(merged, snapshot));
    merged.player.owner.lastCashFlowSummary = "Legacy holdings moved into owner finance.";
    merged.player.owner.lastCashFlow = 0;
  }

  merged.world.spotlightGuestMultiplier = merged.config.spotlightGuestMultiplier;
  merged.world.featuredGuestMultiplier = merged.config.featuredGuestMultiplier;
  merged.world.breakoutGuestMultiplier = merged.config.breakoutGuestMultiplier;

  const missingRivalCount = Math.max(0, merged.config.rivalCount - merged.world.rivals.length);
  if (missingRivalCount > 0) {
    merged.world.rivals.push(
      ...appendGeneratedRivals(merged.world.rivals, merged.world.seed, missingRivalCount)
    );
  }

  refreshInvestmentSummary(merged, merged.player.investmentSummary.lastMonthCashDelta);
  merged.player.prestige.records.peakMoney = Math.max(
    merged.player.prestige.records.peakMoney,
    merged.player.owner.cash
  );
  return merged;
}

function isValidState(value: unknown): value is WorldParkLeagueState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WorldParkLeagueState>;
  return (
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.lastSimulatedMonth === "number" &&
    !!candidate.config &&
    !!candidate.world &&
    Array.isArray(candidate.world.rivals) &&
    Array.isArray(candidate.world.newsFeed) &&
    !!candidate.player
  );
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function normalizeConfig(
  source: unknown,
  fallback: SimulationConfig
): SimulationConfig {
  if (!isObjectLike(source)) {
    return { ...fallback };
  }

  return {
    ...fallback,
    ...source,
    rivalCount:
      typeof source.rivalCount === "number"
        ? Math.max(fallback.rivalCount, Math.round(source.rivalCount))
        : fallback.rivalCount,
    newsRetention:
      typeof source.newsRetention === "number"
        ? Math.max(8, Math.round(source.newsRetention))
        : fallback.newsRetention,
    dominantLeadThreshold:
      typeof source.dominantLeadThreshold === "number"
        ? source.dominantLeadThreshold
        : fallback.dominantLeadThreshold,
    maxCatchUpPressure:
      typeof source.maxCatchUpPressure === "number"
        ? source.maxCatchUpPressure
        : fallback.maxCatchUpPressure,
    mergerChance:
      typeof source.mergerChance === "number" ? source.mergerChance : fallback.mergerChance,
    challengerChance:
      typeof source.challengerChance === "number"
        ? source.challengerChance
        : fallback.challengerChance,
    annualMarketGrowthRate:
      typeof source.annualMarketGrowthRate === "number"
        ? source.annualMarketGrowthRate
        : fallback.annualMarketGrowthRate,
    livePulseIntervalDays:
      typeof source.livePulseIntervalDays === "number"
        ? Math.max(1, Math.round(source.livePulseIntervalDays))
        : fallback.livePulseIntervalDays,
    liveEventIntervalDays:
      typeof source.liveEventIntervalDays === "number"
        ? Math.max(1, Math.round(source.liveEventIntervalDays))
        : fallback.liveEventIntervalDays,
    spotlightGuestMultiplier:
      typeof source.spotlightGuestMultiplier === "number"
        ? clampNumber(source.spotlightGuestMultiplier, 1, 6)
        : fallback.spotlightGuestMultiplier,
    spotlightScoreBonus:
      typeof source.spotlightScoreBonus === "number"
        ? clampNumber(source.spotlightScoreBonus, 0, 8)
        : fallback.spotlightScoreBonus,
    featuredGuestMultiplier:
      typeof source.featuredGuestMultiplier === "number"
        ? clampNumber(source.featuredGuestMultiplier, 1, 3)
        : fallback.featuredGuestMultiplier,
    breakoutGuestMultiplier:
      typeof source.breakoutGuestMultiplier === "number"
        ? clampNumber(source.breakoutGuestMultiplier, 1, 2.5)
        : fallback.breakoutGuestMultiplier,
    investmentSaleMultiplier:
      typeof source.investmentSaleMultiplier === "number"
        ? clampNumber(source.investmentSaleMultiplier, 0.55, 1.05)
        : fallback.investmentSaleMultiplier,
    investmentDividendMultiplier:
      typeof source.investmentDividendMultiplier === "number"
        ? clampNumber(source.investmentDividendMultiplier, 0.45, 1.05)
        : fallback.investmentDividendMultiplier,
    prestigeRewardCashMultiplier:
      typeof source.prestigeRewardCashMultiplier === "number"
        ? clampNumber(source.prestigeRewardCashMultiplier, 0.5, 1.25)
        : fallback.prestigeRewardCashMultiplier,
    prestigeRewardBoostMultiplier:
      typeof source.prestigeRewardBoostMultiplier === "number"
        ? clampNumber(source.prestigeRewardBoostMultiplier, 0.5, 1.25)
        : fallback.prestigeRewardBoostMultiplier,
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMonthStartDayIndex(month: number): number {
  return month * DAYS_PER_MONTH;
}

function normalizeRivals(source: unknown[], fallback: RivalPark[]): RivalPark[] {
  return source
    .map((value, index) => {
      const fallbackRival = fallback[Math.min(index, fallback.length - 1)];
      if (!fallbackRival || !isObjectLike(value)) {
        return null;
      }

      const candidate = value as Partial<RivalPark>;
      const companyValue =
        typeof candidate.finance?.companyValue === "number"
          ? candidate.finance.companyValue
          : fallbackRival.finance.companyValue;
      const debt =
        typeof candidate.finance?.debt === "number" ? candidate.finance.debt : fallbackRival.finance.debt;

      return {
        ...fallbackRival,
        ...candidate,
        stats: {
          ...fallbackRival.stats,
          ...candidate.stats,
        },
        finance: {
          ...fallbackRival.finance,
          ...candidate.finance,
        },
        derived: {
          ...fallbackRival.derived,
          ...candidate.derived,
          debtRatio: companyValue > 0 ? roundTo(debt / companyValue, 4) : 0,
        },
        status: {
          ...fallbackRival.status,
          ...candidate.status,
        },
      };
    })
    .filter((value): value is RivalPark => !!value);
}

function normalizeRegionMarkets(
  source: unknown,
  fallback: Record<RegionKey, RegionMarketState>
): Record<RegionKey, RegionMarketState> {
  const normalized = { ...fallback };
  if (!isObjectLike(source)) {
    return normalized;
  }

  for (const key of Object.keys(fallback) as RegionKey[]) {
    const fallbackRegion = fallback[key];
    const candidateValue = source[key];
    if (!isObjectLike(candidateValue)) {
      normalized[key] = { ...fallbackRegion };
      continue;
    }

    normalized[key] = {
      ...fallbackRegion,
      ...candidateValue,
      key,
      demandModifier:
        typeof candidateValue.demandModifier === "number"
          ? candidateValue.demandModifier
          : fallbackRegion.demandModifier,
      tourismModifier:
        typeof candidateValue.tourismModifier === "number"
          ? candidateValue.tourismModifier
          : fallbackRegion.tourismModifier,
      competitionModifier:
        typeof candidateValue.competitionModifier === "number"
          ? candidateValue.competitionModifier
          : fallbackRegion.competitionModifier,
      spotlightMonthsRemaining:
        typeof candidateValue.spotlightMonthsRemaining === "number"
          ? Math.max(0, candidateValue.spotlightMonthsRemaining)
          : fallbackRegion.spotlightMonthsRemaining,
      slowdownMonthsRemaining:
        typeof candidateValue.slowdownMonthsRemaining === "number"
          ? Math.max(0, candidateValue.slowdownMonthsRemaining)
          : fallbackRegion.slowdownMonthsRemaining,
    };
  }

  return normalized;
}

function normalizeHistory(
  source: unknown,
  fallback: Record<string, ParkHistoryPoint[]>
): Record<string, ParkHistoryPoint[]> {
  const normalized: Record<string, ParkHistoryPoint[]> = { ...fallback };
  if (!isObjectLike(source)) {
    return normalized;
  }

  for (const [parkId, value] of Object.entries(source)) {
    if (!Array.isArray(value)) {
      continue;
    }

    normalized[parkId] = value
      .filter((point) => isObjectLike(point))
      .map((point, index) => {
        const dayIndex =
          typeof point.dayIndex === "number"
            ? Math.max(0, Math.round(point.dayIndex))
            : Math.max(0, Math.round((typeof point.month === "number" ? point.month : index) * DAYS_PER_MONTH));
        const month =
          typeof point.month === "number"
            ? Math.max(0, Math.round(point.month))
            : Math.floor(dayIndex / DAYS_PER_MONTH);

        return {
          dayIndex,
          month,
          rank: typeof point.rank === "number" ? Math.max(0, Math.round(point.rank)) : 0,
          score: typeof point.score === "number" ? point.score : 0,
          marketShare: typeof point.marketShare === "number" ? point.marketShare : 0,
          companyValue:
            typeof point.companyValue === "number" ? Math.round(point.companyValue) : 0,
          monthlyProfit:
            typeof point.monthlyProfit === "number" ? Math.round(point.monthlyProfit) : 0,
          money: typeof point.money === "number" ? Math.round(point.money) : 0,
          momentum: typeof point.momentum === "number" ? point.momentum : 0,
        };
      })
      .sort((left, right) => left.dayIndex - right.dayIndex);
  }

  return normalized;
}

function normalizeHistoryEvents(
  source: unknown,
  fallback: Record<string, ParkHistoryMarker[]>
): Record<string, ParkHistoryMarker[]> {
  const normalized: Record<string, ParkHistoryMarker[]> = { ...fallback };
  if (!isObjectLike(source)) {
    return normalized;
  }

  for (const [parkId, value] of Object.entries(source)) {
    if (!Array.isArray(value)) {
      continue;
    }

    normalized[parkId] = value
      .filter((marker) => isObjectLike(marker))
      .map((marker, index) => {
        const dayIndex =
          typeof marker.dayIndex === "number"
            ? Math.max(0, Math.round(marker.dayIndex))
            : Math.max(
                0,
                Math.round((typeof marker.month === "number" ? marker.month : index) * DAYS_PER_MONTH)
              );
        const severity: ParkHistoryMarker["severity"] =
          marker.severity === "success" || marker.severity === "warning" || marker.severity === "info"
            ? marker.severity
            : "info";
        return {
          dayIndex,
          month:
            typeof marker.month === "number"
              ? Math.max(0, Math.round(marker.month))
              : Math.floor(dayIndex / DAYS_PER_MONTH),
          label: typeof marker.label === "string" ? marker.label : "League event",
          severity,
        };
      })
      .sort((left, right) => left.dayIndex - right.dayIndex);
  }

  return normalized;
}

function normalizeGovernance(
  source: unknown,
  fallback: WorldParkLeagueState["player"]["governance"]
): WorldParkLeagueState["player"]["governance"] {
  if (!isObjectLike(source)) {
    return { ...fallback };
  }

  return {
    ...fallback,
    ...source,
    investorConfidence:
      typeof source.investorConfidence === "number"
        ? source.investorConfidence
        : fallback.investorConfidence,
    boardPatience:
      typeof source.boardPatience === "number"
        ? source.boardPatience
        : fallback.boardPatience,
    activeDirective:
      normalizeDirective(source.activeDirective, fallback.activeDirective),
    directiveMonthsRemaining:
      typeof source.directiveMonthsRemaining === "number"
        ? Math.max(0, source.directiveMonthsRemaining)
        : fallback.directiveMonthsRemaining,
    lastReviewMonth:
      typeof source.lastReviewMonth === "number" ? source.lastReviewMonth : fallback.lastReviewMonth,
    lastReviewSummary:
      typeof source.lastReviewSummary === "string"
        ? source.lastReviewSummary
        : fallback.lastReviewSummary,
    lastDirectiveScore:
      typeof source.lastDirectiveScore === "number"
        ? source.lastDirectiveScore
        : fallback.lastDirectiveScore,
    guestCapImpact:
      typeof source.guestCapImpact === "number"
        ? source.guestCapImpact
        : fallback.guestCapImpact,
    pendingProposals: Array.isArray(source.pendingProposals)
      ? source.pendingProposals
          .filter((proposal) => isObjectLike(proposal))
          .map((proposal, index) => ({
            id: typeof proposal.id === "string" ? proposal.id : `legacy-proposal-${index}`,
            month: typeof proposal.month === "number" ? proposal.month : 0,
            type:
              proposal.type === "growth_capex" ||
              proposal.type === "guest_experience_program" ||
              proposal.type === "debt_repayment" ||
              proposal.type === "structured_equity_raise" ||
              proposal.type === "share_buyback"
                ? proposal.type
                : "growth_capex",
            title: typeof proposal.title === "string" ? proposal.title : "Board proposal",
            summary:
              typeof proposal.summary === "string"
                ? proposal.summary
                : "Legacy board proposal migrated into the latest schema.",
            expiresAtMonth:
              typeof proposal.expiresAtMonth === "number" ? proposal.expiresAtMonth : 0,
            cashDelta: typeof proposal.cashDelta === "number" ? proposal.cashDelta : 0,
            loanDelta: typeof proposal.loanDelta === "number" ? proposal.loanDelta : 0,
            outsideOwnershipDelta:
              typeof proposal.outsideOwnershipDelta === "number"
                ? proposal.outsideOwnershipDelta
                : 0,
            guestCapBonus:
              typeof proposal.guestCapBonus === "number" ? proposal.guestCapBonus : 0,
            programMonths:
              typeof proposal.programMonths === "number"
                ? Math.max(0, proposal.programMonths)
                : 0,
            confidenceDelta:
              typeof proposal.confidenceDelta === "number" ? proposal.confidenceDelta : 0,
            patienceDelta:
              typeof proposal.patienceDelta === "number" ? proposal.patienceDelta : 0,
          }))
      : fallback.pendingProposals,
    activePrograms: Array.isArray(source.activePrograms)
      ? source.activePrograms
          .filter((program) => isObjectLike(program))
          .map((program, index) => ({
            id: typeof program.id === "string" ? program.id : `legacy-program-${index}`,
            title: typeof program.title === "string" ? program.title : "Board program",
            summary:
              typeof program.summary === "string"
                ? program.summary
                : "Legacy board program migrated into the latest schema.",
            sourceProposalType:
              program.sourceProposalType === "growth_capex" ||
              program.sourceProposalType === "guest_experience_program" ||
              program.sourceProposalType === "debt_repayment" ||
              program.sourceProposalType === "structured_equity_raise" ||
              program.sourceProposalType === "share_buyback"
                ? program.sourceProposalType
                : "growth_capex",
            monthsRemaining:
              typeof program.monthsRemaining === "number"
                ? Math.max(0, program.monthsRemaining)
                : 0,
            guestCapBonus:
              typeof program.guestCapBonus === "number" ? program.guestCapBonus : 0,
          }))
      : fallback.activePrograms,
    lastProposalSummary:
      typeof source.lastProposalSummary === "string"
        ? source.lastProposalSummary
        : fallback.lastProposalSummary,
  };
}

function normalizeActions(
  source: unknown,
  fallback: PlayerLeagueActionState
): PlayerLeagueActionState {
  if (!isObjectLike(source)) {
    return createInitialPlayerActionState();
  }

  return {
    ...fallback,
    ...source,
    activeActions: Array.isArray(source.activeActions)
      ? source.activeActions
          .filter((action) => isObjectLike(action))
          .map((action, index) => ({
            id: typeof action.id === "string" ? action.id : `legacy-action-${index}`,
            type:
              action.type === "pr_blitz" ||
              action.type === "guest_festival" ||
              action.type === "safety_campaign" ||
              action.type === "efficiency_push"
                ? action.type
                : "pr_blitz",
            title: typeof action.title === "string" ? action.title : "League action",
            summary:
              typeof action.summary === "string"
                ? action.summary
                : "Legacy league action migrated into the latest schema.",
            daysRemaining:
              typeof action.daysRemaining === "number" ? Math.max(0, Math.round(action.daysRemaining)) : 0,
            scoreBonus: typeof action.scoreBonus === "number" ? action.scoreBonus : 0,
            guestCapBonus:
              typeof action.guestCapBonus === "number" ? action.guestCapBonus : 0,
            momentumBonus:
              typeof action.momentumBonus === "number" ? action.momentumBonus : 0,
            safetyShield:
              typeof action.safetyShield === "number" ? action.safetyShield : 0,
            launchedAtDayIndex:
              typeof action.launchedAtDayIndex === "number"
                ? Math.max(0, Math.round(action.launchedAtDayIndex))
                : 0,
          }))
      : fallback.activeActions,
    lastActionSummary:
      typeof source.lastActionSummary === "string"
        ? source.lastActionSummary
        : fallback.lastActionSummary,
  };
}

function normalizeOwner(
  source: unknown,
  fallback: PlayerOwnerState
): PlayerOwnerState {
  if (!isObjectLike(source)) {
    return createInitialOwnerState(fallback.cash);
  }

  return {
    ...fallback,
    ...source,
    cash: typeof source.cash === "number" ? Math.max(0, Math.round(source.cash)) : fallback.cash,
    lastSalary:
      typeof source.lastSalary === "number" ? Math.max(0, Math.round(source.lastSalary)) : fallback.lastSalary,
    totalSalaryReceived:
      typeof source.totalSalaryReceived === "number"
        ? Math.max(0, Math.round(source.totalSalaryReceived))
        : fallback.totalSalaryReceived,
    lifetimeNetCashFlow:
      typeof source.lifetimeNetCashFlow === "number"
        ? Math.round(source.lifetimeNetCashFlow)
        : fallback.lifetimeNetCashFlow,
    lastCashFlow:
      typeof source.lastCashFlow === "number" ? Math.round(source.lastCashFlow) : fallback.lastCashFlow,
    lastCashFlowSummary:
      typeof source.lastCashFlowSummary === "string"
        ? source.lastCashFlowSummary
        : fallback.lastCashFlowSummary,
  };
}

function normalizeEquity(
  source: unknown,
  fallback: WorldParkLeagueState["player"]["equity"]
): WorldParkLeagueState["player"]["equity"] {
  if (!isObjectLike(source)) {
    return createInitialEquityState();
  }

  return {
    ...fallback,
    ...source,
    outsideOwnedShare:
      typeof source.outsideOwnedShare === "number"
        ? Math.max(0, Math.min(0.45, source.outsideOwnedShare))
        : fallback.outsideOwnedShare,
    totalCashRaised:
      typeof source.totalCashRaised === "number"
        ? Math.max(0, source.totalCashRaised)
        : fallback.totalCashRaised,
    activeOffers: Array.isArray(source.activeOffers)
      ? source.activeOffers
          .filter((offer) => isObjectLike(offer))
          .map((offer, index) => ({
            id: typeof offer.id === "string" ? offer.id : `legacy-offer-${index}`,
            month: typeof offer.month === "number" ? offer.month : 0,
            buyerName: typeof offer.buyerName === "string" ? offer.buyerName : "Unknown investor",
            buyerType:
              offer.buyerType === "rival" ||
              offer.buyerType === "institutional" ||
              offer.buyerType === "family_office" ||
              offer.buyerType === "private_equity"
                ? offer.buyerType
                : "institutional",
            buyerRivalId: typeof offer.buyerRivalId === "string" ? offer.buyerRivalId : null,
            share: typeof offer.share === "number" ? offer.share : 0.05,
            price: typeof offer.price === "number" ? offer.price : 0,
            premiumRate: typeof offer.premiumRate === "number" ? offer.premiumRate : 0,
            expiresAtMonth: typeof offer.expiresAtMonth === "number" ? offer.expiresAtMonth : 0,
          }))
      : fallback.activeOffers,
    lastAcceptedOfferSummary:
      typeof source.lastAcceptedOfferSummary === "string"
        ? source.lastAcceptedOfferSummary
        : fallback.lastAcceptedOfferSummary,
    lastDeclinedOfferSummary:
      typeof source.lastDeclinedOfferSummary === "string"
        ? source.lastDeclinedOfferSummary
        : fallback.lastDeclinedOfferSummary,
    lastBuybackSummary:
      typeof source.lastBuybackSummary === "string"
        ? source.lastBuybackSummary
        : fallback.lastBuybackSummary,
  };
}

function normalizeWatchlist(
  source: unknown,
  fallback: PlayerWatchlistState
): PlayerWatchlistState {
  if (!isObjectLike(source)) {
    return createInitialWatchlistState();
  }

  return {
    ...fallback,
    ...source,
    watchedRivalIds: Array.isArray(source.watchedRivalIds)
      ? source.watchedRivalIds.filter((value): value is string => typeof value === "string").slice(0, 6)
      : fallback.watchedRivalIds,
    focusRivalIds: Array.isArray(source.focusRivalIds)
      ? source.focusRivalIds.filter((value): value is string => typeof value === "string").slice(0, 3)
      : fallback.focusRivalIds,
    alerts: Array.isArray(source.alerts)
      ? source.alerts
          .filter((alert) => isObjectLike(alert))
          .map((alert, index) => {
            const type: WatchlistAlert["type"] =
              alert.type === "focus_assigned" ||
              alert.type === "rank_overtake" ||
              alert.type === "rank_retake" ||
              alert.type === "scandal" ||
              alert.type === "distress" ||
              alert.type === "expansion" ||
              alert.type === "recovery" ||
              alert.type === "exit"
                ? alert.type
                : "focus_assigned";
            const severity: WatchlistAlert["severity"] =
              alert.severity === "success" || alert.severity === "warning" || alert.severity === "info"
                ? alert.severity
                : "info";

            return {
              id: typeof alert.id === "string" ? alert.id : `legacy-watch-alert-${index}`,
              dayIndex:
                typeof alert.dayIndex === "number" ? Math.max(0, Math.round(alert.dayIndex)) : 0,
              month: typeof alert.month === "number" ? Math.max(0, Math.round(alert.month)) : 0,
              rivalId: typeof alert.rivalId === "string" ? alert.rivalId : "unknown",
              parkName: typeof alert.parkName === "string" ? alert.parkName : "Unknown rival",
              type,
              severity,
              title: typeof alert.title === "string" ? alert.title : "League alert",
              detail:
                typeof alert.detail === "string"
                  ? alert.detail
                  : "A tracked rival generated an alert in a previous version of the plugin.",
            };
          })
          .slice(0, 24)
      : fallback.alerts,
    lastAlertSummary:
      typeof source.lastAlertSummary === "string"
        ? source.lastAlertSummary
        : fallback.lastAlertSummary,
  };
}

function normalizeRivalry(
  source: unknown,
  fallback: PlayerRivalChallengeState
): PlayerRivalChallengeState {
  if (!isObjectLike(source)) {
    return createInitialRivalChallengeState();
  }

  const activeChallenge: PlayerRivalChallenge | null = isObjectLike(source.activeChallenge)
    ? {
        id:
          typeof source.activeChallenge.id === "string"
            ? source.activeChallenge.id
            : "legacy-rival-challenge",
        rivalId:
          typeof source.activeChallenge.rivalId === "string"
            ? source.activeChallenge.rivalId
            : "unknown-rival",
        rivalName:
          typeof source.activeChallenge.rivalName === "string"
            ? source.activeChallenge.rivalName
            : "Unknown rival",
        type:
          source.activeChallenge.type === "score_sprint" ||
          source.activeChallenge.type === "share_sprint" ||
          source.activeChallenge.type === "profit_duel"
            ? source.activeChallenge.type
            : "score_sprint",
        title:
          typeof source.activeChallenge.title === "string"
            ? source.activeChallenge.title
            : "Rival challenge",
        summary:
          typeof source.activeChallenge.summary === "string"
            ? source.activeChallenge.summary
            : "Legacy rival challenge migrated into the latest schema.",
        issuedAtDayIndex:
          typeof source.activeChallenge.issuedAtDayIndex === "number"
            ? Math.max(0, Math.round(source.activeChallenge.issuedAtDayIndex))
            : 0,
        resolveAtDayIndex:
          typeof source.activeChallenge.resolveAtDayIndex === "number"
            ? Math.max(0, Math.round(source.activeChallenge.resolveAtDayIndex))
            : 0,
        baselinePlayerScore:
          typeof source.activeChallenge.baselinePlayerScore === "number"
            ? source.activeChallenge.baselinePlayerScore
            : 0,
        baselineRivalScore:
          typeof source.activeChallenge.baselineRivalScore === "number"
            ? source.activeChallenge.baselineRivalScore
            : 0,
        baselinePlayerShare:
          typeof source.activeChallenge.baselinePlayerShare === "number"
            ? source.activeChallenge.baselinePlayerShare
            : 0,
        baselineRivalShare:
          typeof source.activeChallenge.baselineRivalShare === "number"
            ? source.activeChallenge.baselineRivalShare
            : 0,
        baselinePlayerProfit:
          typeof source.activeChallenge.baselinePlayerProfit === "number"
            ? source.activeChallenge.baselinePlayerProfit
            : 0,
        baselineRivalProfit:
          typeof source.activeChallenge.baselineRivalProfit === "number"
            ? source.activeChallenge.baselineRivalProfit
            : 0,
        rewardCash:
          typeof source.activeChallenge.rewardCash === "number"
            ? Math.max(0, Math.round(source.activeChallenge.rewardCash))
            : 0,
        rewardBoostType:
          source.activeChallenge.rewardBoostType === "featured" ||
          source.activeChallenge.rewardBoostType === "buzz"
            ? source.activeChallenge.rewardBoostType
            : null,
        rewardBoostDays:
          typeof source.activeChallenge.rewardBoostDays === "number"
            ? Math.max(0, Math.round(source.activeChallenge.rewardBoostDays))
            : 0,
        rewardScoreBonus:
          typeof source.activeChallenge.rewardScoreBonus === "number"
            ? source.activeChallenge.rewardScoreBonus
            : 0,
        rewardDurationDays:
          typeof source.activeChallenge.rewardDurationDays === "number"
            ? Math.max(0, Math.round(source.activeChallenge.rewardDurationDays))
            : 0,
      }
    : null;

  return {
    ...fallback,
    ...source,
    activeChallenge,
    cooldownDaysRemaining:
      typeof source.cooldownDaysRemaining === "number"
        ? Math.max(0, Math.round(source.cooldownDaysRemaining))
        : fallback.cooldownDaysRemaining,
    completedChallenges:
      typeof source.completedChallenges === "number"
        ? Math.max(0, Math.round(source.completedChallenges))
        : fallback.completedChallenges,
    wonChallenges:
      typeof source.wonChallenges === "number"
        ? Math.max(0, Math.round(source.wonChallenges))
        : fallback.wonChallenges,
    lastChallengeSummary:
      typeof source.lastChallengeSummary === "string"
        ? source.lastChallengeSummary
        : fallback.lastChallengeSummary,
  };
}

function normalizePrestige(
  source: unknown,
  fallback: PlayerPrestigeState
): PlayerPrestigeState {
  if (!isObjectLike(source)) {
    return createInitialPrestigeState();
  }

  const recordsSource = isObjectLike(source.records) ? source.records : {};

  return {
    ...fallback,
    ...source,
    prestigeScore:
      typeof source.prestigeScore === "number"
        ? Math.max(0, Math.round(source.prestigeScore))
        : fallback.prestigeScore,
    unlockedAchievements: Array.isArray(source.unlockedAchievements)
      ? source.unlockedAchievements
          .filter((achievement) => isObjectLike(achievement))
          .map((achievement, index) => ({
            key:
              typeof achievement.key === "string" ? achievement.key : `legacy-achievement-${index}`,
            title:
              typeof achievement.title === "string" ? achievement.title : "Legacy achievement",
            summary:
              typeof achievement.summary === "string"
                ? achievement.summary
                : "Achievement unlocked in an earlier version of the plugin.",
            rewardSummary:
              typeof achievement.rewardSummary === "string"
                ? achievement.rewardSummary
                : "Legacy reward",
            unlockedAtMonth:
              typeof achievement.unlockedAtMonth === "number"
                ? Math.max(0, Math.round(achievement.unlockedAtMonth))
                : 0,
            unlockedAtDayIndex:
              typeof achievement.unlockedAtDayIndex === "number"
                ? Math.max(0, Math.round(achievement.unlockedAtDayIndex))
                : 0,
          }))
      : fallback.unlockedAchievements,
    lastUnlockSummary:
      typeof source.lastUnlockSummary === "string"
        ? source.lastUnlockSummary
        : fallback.lastUnlockSummary,
    lastRewardSummary:
      typeof source.lastRewardSummary === "string"
        ? source.lastRewardSummary
        : fallback.lastRewardSummary,
    activeRewards: Array.isArray(source.activeRewards)
      ? source.activeRewards
          .filter((reward) => isObjectLike(reward))
          .map((reward, index) => ({
            id: typeof reward.id === "string" ? reward.id : `legacy-prestige-reward-${index}`,
            sourceAchievementKey:
              typeof reward.sourceAchievementKey === "string"
                ? reward.sourceAchievementKey
                : `legacy-achievement-${index}`,
            title: typeof reward.title === "string" ? reward.title : "Prestige reward",
            summary:
              typeof reward.summary === "string"
                ? reward.summary
                : "Legacy prestige reward migrated into the latest schema.",
            daysRemaining:
              typeof reward.daysRemaining === "number"
                ? Math.max(0, Math.round(reward.daysRemaining))
                : 0,
            scoreBonus: typeof reward.scoreBonus === "number" ? reward.scoreBonus : 0,
            guestCapBonus:
              typeof reward.guestCapBonus === "number" ? reward.guestCapBonus : 0,
            momentumBonus:
              typeof reward.momentumBonus === "number" ? reward.momentumBonus : 0,
          }))
      : fallback.activeRewards,
    records: {
      ...fallback.records,
      ...recordsSource,
      bestRank:
        typeof recordsSource.bestRank === "number"
          ? Math.max(1, Math.round(recordsSource.bestRank))
          : recordsSource.bestRank === null
            ? null
            : fallback.records.bestRank,
      peakScore:
        typeof recordsSource.peakScore === "number" ? recordsSource.peakScore : fallback.records.peakScore,
      peakGuests:
        typeof recordsSource.peakGuests === "number"
          ? Math.max(0, Math.round(recordsSource.peakGuests))
          : fallback.records.peakGuests,
      peakMoney:
        typeof recordsSource.peakMoney === "number"
          ? Math.max(0, Math.round(recordsSource.peakMoney))
          : fallback.records.peakMoney,
      peakParkValue:
        typeof recordsSource.peakParkValue === "number"
          ? Math.max(0, Math.round(recordsSource.peakParkValue))
          : fallback.records.peakParkValue,
      peakEquityValue:
        typeof recordsSource.peakEquityValue === "number"
          ? Math.max(0, Math.round(recordsSource.peakEquityValue))
          : fallback.records.peakEquityValue,
      peakPeopleShare:
        typeof recordsSource.peakPeopleShare === "number"
          ? Math.max(0, recordsSource.peakPeopleShare)
          : fallback.records.peakPeopleShare,
      peakMonthlyProfit:
        typeof recordsSource.peakMonthlyProfit === "number"
          ? Math.max(0, Math.round(recordsSource.peakMonthlyProfit))
          : fallback.records.peakMonthlyProfit,
      bestGuestCapModifier:
        typeof recordsSource.bestGuestCapModifier === "number"
          ? Math.max(1, recordsSource.bestGuestCapModifier)
          : fallback.records.bestGuestCapModifier,
      peakPortfolioHoldings:
        typeof recordsSource.peakPortfolioHoldings === "number"
          ? Math.max(0, Math.round(recordsSource.peakPortfolioHoldings))
          : fallback.records.peakPortfolioHoldings,
      peakPortfolioValue:
        typeof recordsSource.peakPortfolioValue === "number"
          ? Math.max(0, Math.round(recordsSource.peakPortfolioValue))
          : fallback.records.peakPortfolioValue,
      totalSpotlightWins:
        typeof recordsSource.totalSpotlightWins === "number"
          ? Math.max(0, Math.round(recordsSource.totalSpotlightWins))
          : fallback.records.totalSpotlightWins,
      totalFeaturedWins:
        typeof recordsSource.totalFeaturedWins === "number"
          ? Math.max(0, Math.round(recordsSource.totalFeaturedWins))
          : fallback.records.totalFeaturedWins,
      totalBuzzWins:
        typeof recordsSource.totalBuzzWins === "number"
          ? Math.max(0, Math.round(recordsSource.totalBuzzWins))
          : fallback.records.totalBuzzWins,
      totalYearlyAwards:
        typeof recordsSource.totalYearlyAwards === "number"
          ? Math.max(0, Math.round(recordsSource.totalYearlyAwards))
          : fallback.records.totalYearlyAwards,
      totalMergersWitnessed:
        typeof recordsSource.totalMergersWitnessed === "number"
          ? Math.max(0, Math.round(recordsSource.totalMergersWitnessed))
          : fallback.records.totalMergersWitnessed,
      totalBankruptciesWitnessed:
        typeof recordsSource.totalBankruptciesWitnessed === "number"
          ? Math.max(0, Math.round(recordsSource.totalBankruptciesWitnessed))
          : fallback.records.totalBankruptciesWitnessed,
      longestTopTenStreak:
        typeof recordsSource.longestTopTenStreak === "number"
          ? Math.max(0, Math.round(recordsSource.longestTopTenStreak))
          : fallback.records.longestTopTenStreak,
      longestRankOneStreak:
        typeof recordsSource.longestRankOneStreak === "number"
          ? Math.max(0, Math.round(recordsSource.longestRankOneStreak))
          : fallback.records.longestRankOneStreak,
    },
  };
}

function normalizeDirective(
  value: unknown,
  fallback: PlayerDirective
): PlayerDirective {
  switch (value) {
    case "balanced":
    case "growth_push":
    case "guest_experience":
    case "profit_focus":
    case "deleveraging":
      return value;
    default:
      return fallback;
  }
}
