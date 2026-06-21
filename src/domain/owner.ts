import type { PlayerOwnerState, PlayerSnapshot, WorldParkLeagueState } from "../types";
import { clamp, roundTo } from "./math";
import { calculatePlayerEquityValue } from "./player";

const BASE_OWNER_STARTING_CASH = 25_000;

export interface OwnerFinanceUpdate {
  cashDelta: number;
  salary: number;
  summary: string | null;
  notifications: string[];
}

export function createInitialOwnerState(initialCash: number = BASE_OWNER_STARTING_CASH): PlayerOwnerState {
  const normalizedCash = Math.max(0, Math.round(initialCash));
  return {
    cash: normalizedCash,
    lastSalary: 0,
    totalSalaryReceived: 0,
    lifetimeNetCashFlow: 0,
    lastCashFlow: 0,
    lastCashFlowSummary: null,
  };
}

export function migrateLegacyOwnerCash(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): number {
  const equityValue = calculatePlayerEquityValue(snapshot);
  const portfolioValue = state.player.investmentSummary.portfolioValue;
  const seedCash = Math.round(
    Math.max(
      BASE_OWNER_STARTING_CASH,
      Math.min(
        220_000,
        portfolioValue * 0.12 +
          equityValue * 0.025 +
          Math.max(0, snapshot.lastMonthOperatingProfit) * 0.75
      )
    )
  );

  return seedCash;
}

export function applyOwnerCashDelta(
  state: WorldParkLeagueState,
  delta: number,
  summary?: string | null
): void {
  if (delta === 0 && !summary) {
    return;
  }

  state.player.owner.cash = Math.max(0, Math.round(state.player.owner.cash + delta));
  state.player.owner.lastCashFlow = Math.round(delta);
  state.player.owner.lifetimeNetCashFlow += Math.round(delta);
  if (summary) {
    state.player.owner.lastCashFlowSummary = summary;
  }
}

export function recordOwnerCashFlowSummary(
  state: WorldParkLeagueState,
  summary: string | null,
  lastCashFlow: number = 0
): void {
  if (summary === null && lastCashFlow === 0) {
    return;
  }

  state.player.owner.lastCashFlow = Math.round(lastCashFlow);
  if (summary !== null) {
    state.player.owner.lastCashFlowSummary = summary;
  }
}

export function settleOwnerFinanceForMonth(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): OwnerFinanceUpdate {
  void state;
  void snapshot;
  return {
    cashDelta: 0,
    salary: 0,
    summary: null,
    notifications: [],
  };
}

export function calculateOwnerNetWorth(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): number {
  const ownerParkShare = clamp(1 - state.player.equity.outsideOwnedShare, 0.55, 1);
  const controlledParkValue = calculatePlayerEquityValue(snapshot) * ownerParkShare;
  return Math.max(
    0,
    Math.round(state.player.investmentSummary.portfolioValue + controlledParkValue)
  );
}

export function getOwnerPortfolioShareOfPark(state: WorldParkLeagueState): number {
  return roundTo(clamp(1 - state.player.equity.outsideOwnedShare, 0.55, 1), 3);
}

function calculateOwnerSalary(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): number {
  const rank = state.player.currentRank ?? state.world.leaderboard.length;
  const fieldSize = Math.max(1, state.world.leaderboard.length);
  const rankStrength = fieldSize > 1 ? 1 - (rank - 1) / (fieldSize - 1) : 0.5;
  const confidence = clamp(state.player.governance.investorConfidence, 0.7, 1.3);
  const boardPatience = clamp(state.player.governance.boardPatience, 0.7, 1.3);
  const profit = Math.max(0, snapshot.lastMonthOperatingProfit);
  const scaleValue = calculatePlayerEquityValue(snapshot);

  const baseSalary = 4_200;
  const rankBonus = rankStrength * 7_500;
  const profitBonus = Math.min(14_000, profit * 0.11);
  const scaleBonus = Math.min(10_000, scaleValue * 0.0075);
  const mandatePenalty =
    state.player.governance.directiveMonthsRemaining > 0 &&
    state.player.governance.lastDirectiveScore < 0
      ? 0.86
      : 1;

  return Math.max(
    2_500,
    Math.round((baseSalary + rankBonus + profitBonus + scaleBonus) * confidence * boardPatience * mandatePenalty)
  );
}
