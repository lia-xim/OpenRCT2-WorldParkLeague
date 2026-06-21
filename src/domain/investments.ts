import { formatMoney, formatSignedMoney } from "./currency";
import { getDifficultyProfile } from "./difficulty";
import { clamp, deepClone, roundTo } from "./math";
import { createScopedRng, hashString } from "./random";
import type {
  PlayerInvestment,
  PlayerInvestmentSummary,
  RivalPark,
  WorldParkLeagueState,
} from "../types";

const BASE_LOT_SHARE = 0.05;
const SUPPORTED_LOT_SHARES = [0.05, 0.1, 0.15] as const;
export const MAX_SHARE_PER_RIVAL = 0.25;

export interface InvestmentTransactionResult {
  ok: boolean;
  state: WorldParkLeagueState;
  cashDelta: number;
  message: string;
}

export interface InvestmentSettlementResult {
  state: WorldParkLeagueState;
  cashDelta: number;
  notifications: string[];
}

interface MergerConversionResult {
  converted: boolean;
  cashDelta: number;
  notification: string;
}

export function buyInvestmentByRivalId(
  state: WorldParkLeagueState,
  rivalId: string,
  availableCash: number,
  currentMonth: number,
  share: number = BASE_LOT_SHARE
): InvestmentTransactionResult {
  const nextState = deepClone(state);
  const rival = nextState.world.rivals.find((candidate) => candidate.id === rivalId);

  if (!rival || !rival.status.active) {
    return failure(nextState, "That rival is no longer investable.");
  }

  if (!isSupportedLotShare(share)) {
    return failure(nextState, "Unsupported buy lot size.");
  }

  const existing = nextState.player.investments.find((investment) => investment.rivalId === rivalId);
  const currentShare = existing?.share ?? 0;
  if (currentShare + share > MAX_SHARE_PER_RIVAL + 0.000001) {
    return failure(nextState, "Max ownership per rival reached.");
  }

  const cost = calculatePurchasePrice(
    rival,
    share,
    nextState.world.capitalMarketMood,
    currentShare
  );
  if (availableCash < cost) {
    return failure(nextState, `Not enough park cash. Need ${formatMoney(cost)}.`);
  }

  if (existing) {
    existing.share = roundTo(existing.share + share, 4);
    existing.costBasis += cost;
  } else {
    nextState.player.investments.push({
      rivalId,
      share,
      costBasis: cost,
      purchasedAtMonth: currentMonth,
      totalDividendsReceived: 0,
      lastDividend: 0,
      realizedProfit: 0,
    });
  }

  refreshInvestmentSummary(nextState, 0);
  return {
    ok: true,
    state: nextState,
    cashDelta: -cost,
    message: `Bought a ${(share * 100).toFixed(0)}% stake in ${rival.name} for ${formatMoney(cost)}.`,
  };
}

export function sellInvestmentByRivalId(
  state: WorldParkLeagueState,
  rivalId: string,
  share?: number
): InvestmentTransactionResult {
  const nextState = deepClone(state);
  const investmentIndex = nextState.player.investments.findIndex(
    (investment) => investment.rivalId === rivalId
  );
  if (investmentIndex < 0) {
    return failure(nextState, "No investment found for that rival.");
  }

  const investment = nextState.player.investments[investmentIndex] as PlayerInvestment;
  const rival = nextState.world.rivals.find((candidate) => candidate.id === rivalId);
  if (!rival) {
    return failure(nextState, "That rival no longer exists in the league.");
  }

  const saleShare = share ?? investment.share;
  if (!isValidSellShare(saleShare, investment.share)) {
    return failure(nextState, "Unsupported sell lot size for this position.");
  }
  const isFullExit = saleShare >= investment.share - 0.000001;

  const proceeds = calculateSalePrice(
    rival,
    saleShare,
    nextState.world.capitalMarketMood,
    investment.share,
    nextState.config.investmentSaleMultiplier
  );
  const removedCostBasis = roundTo((investment.costBasis * saleShare) / investment.share, 2);
  investment.realizedProfit += proceeds - removedCostBasis;

  if (isFullExit) {
    nextState.player.investments.splice(investmentIndex, 1);
  } else {
    investment.share = roundTo(investment.share - saleShare, 4);
    investment.costBasis = Math.max(0, roundTo(investment.costBasis - removedCostBasis, 2));
  }

  refreshInvestmentSummary(nextState, 0);
  return {
    ok: true,
    state: nextState,
    cashDelta: proceeds,
    message: isFullExit
      ? `Sold the full stake in ${rival.name} for ${formatMoney(proceeds)}.`
      : `Sold ${(saleShare * 100).toFixed(0)}% of ${rival.name} for ${formatMoney(proceeds)}.`,
  };
}

export function settleInvestmentsForMonth(
  state: WorldParkLeagueState,
  currentMonth: number
): InvestmentSettlementResult {
  const nextState = deepClone(state);
  const notifications: string[] = [];
  let cashDelta = 0;

  for (let index = nextState.player.investments.length - 1; index >= 0; index -= 1) {
    const investment = nextState.player.investments[index] as PlayerInvestment;
    const rival = nextState.world.rivals.find((candidate) => candidate.id === investment.rivalId);

    if (!rival) {
      nextState.player.investments.splice(index, 1);
      notifications.push("A delisted rival position was written out of the portfolio.");
      continue;
    }

    if (!rival.status.active) {
      if (rival.status.mergedIntoId) {
        const conversion = convertMergedInvestment(
          nextState,
          rival,
          investment,
          currentMonth
        );
        if (conversion.converted) {
          cashDelta += conversion.cashDelta;
          notifications.push(conversion.notification);
          continue;
        }
      }

      const payout = rival
        ? calculateForcedExitPayout(rival, investment, nextState.config.investmentSaleMultiplier)
        : 0;
      cashDelta += payout;
      nextState.player.investments.splice(index, 1);
      notifications.push(
        rival
          ? `${rival.name} exited the market. Your stake was settled for ${formatMoney(payout)}.`
          : "A delisted rival position was written out of the portfolio."
      );
      continue;
    }

    investment.lastDividend = 0;
    const shockNotification = maybeApplyInvestmentShock(
      nextState,
      rival,
      investment,
      currentMonth,
      index
    );
    if (shockNotification) {
      notifications.push(shockNotification);
    }

    const dividend = calculateDividend(
      rival,
      investment.share,
      nextState.world.capitalMarketMood,
      nextState.config.investmentDividendMultiplier
    );
    if (dividend > 0) {
      investment.lastDividend = dividend;
      investment.totalDividendsReceived += dividend;
      cashDelta += dividend;
      notifications.push(
        `${rival.name} paid a dividend of ${formatMoney(dividend)} on your ${(investment.share * 100).toFixed(0)}% stake.`
      );
    }

    if (rival.finance.monthlyProfit < 0 && rival.status.monthsInSlump >= 4 && investment.share >= 0.15) {
      notifications.push(
        `${rival.name} remains under pressure. Your position is still active, but the risk profile has worsened.`
      );
    }

    if (investment.share >= 0.1 && rival.status.scandalMonthsRemaining > 0) {
      notifications.push(
        `${rival.name}: your observer access confirms the scandal is still dragging on guest demand.`
      );
    } else if (investment.share >= 0.15 && rival.status.expansionMonthsRemaining > 0) {
      notifications.push(
        `${rival.name}: management access suggests the current expansion is still stretching financing.`
      );
    } else if (investment.share >= 0.2 && rival.status.distressLevel > 0) {
      notifications.push(
        `${rival.name}: as a major holder you are seeing elevated refinancing pressure inside the business.`
      );
    }
  }

  refreshInvestmentSummary(nextState, cashDelta);
  nextState.player.investmentSummary.lastMonthCashDelta = cashDelta;

  if (currentMonth >= 0) {
    for (const investment of nextState.player.investments) {
      investment.lastDividend = investment.lastDividend ?? 0;
    }
  }

  return {
    state: nextState,
    cashDelta,
    notifications,
  };
}

function maybeApplyInvestmentShock(
  state: WorldParkLeagueState,
  rival: RivalPark,
  investment: PlayerInvestment,
  currentMonth: number,
  index: number
): string | null {
  const profile = getDifficultyProfile(state.config.difficultyPreset);
  const rng = createScopedRng(
    state.world.seed,
    currentMonth,
    index + 1,
    hashString(investment.rivalId),
    4417
  );
  const baseChance =
    0.012 +
    rival.risk * 0.00025 +
    rival.status.distressLevel * 0.018 +
    rival.status.monthsInSlump * 0.004 +
    (rival.status.scandalMonthsRemaining > 0 ? 0.03 : 0);
  const holdingScale = investment.share >= 0.15 ? 1.15 : 1;
  if (!rng.chance(baseChance * holdingScale * profile.investmentShockScale)) {
    return null;
  }

  const severity = clamp(
    rng.float(0.055, 0.16) +
      rival.status.distressLevel * 0.025 +
      (rival.status.scandalMonthsRemaining > 0 ? 0.03 : 0),
    0.04,
    0.24
  );
  const valueBefore = rival.finance.companyValue;
  const valueLoss = Math.round(valueBefore * severity);
  rival.finance.companyValue = Math.max(160_000, Math.round(valueBefore - valueLoss));
  rival.finance.monthlyProfit = Math.round(rival.finance.monthlyProfit - valueLoss * 0.018);
  rival.finance.cashReserve = Math.max(0, Math.round(rival.finance.cashReserve - valueLoss * 0.045));
  rival.risk = clamp(rival.risk + severity * 45, 15, 95);
  rival.status.monthsInSlump += rival.finance.monthlyProfit < 0 ? 1 : 0;

  return `${rival.name} suffers a share shock. Your ${(investment.share * 100).toFixed(0)}% stake lost about ${formatMoney(valueLoss * investment.share)} in paper value.`;
}

function convertMergedInvestment(
  state: WorldParkLeagueState,
  absorbedRival: RivalPark,
  investment: PlayerInvestment,
  currentMonth: number
): MergerConversionResult {
  const acquirer = state.world.rivals.find(
    (candidate) => candidate.id === absorbedRival.status.mergedIntoId && candidate.status.active
  );
  if (!acquirer || acquirer.finance.companyValue <= 0) {
    return {
      converted: false,
      cashDelta: 0,
      notification: "",
    };
  }

  const sourceIndex = state.player.investments.findIndex(
    (candidate) => candidate.rivalId === absorbedRival.id
  );
  if (sourceIndex < 0) {
    return {
      converted: false,
      cashDelta: 0,
      notification: "",
    };
  }

  const existingAcquirerInvestment =
    state.player.investments.find((candidate) => candidate.rivalId === acquirer.id) ?? null;
  const currentAcquirerShare = existingAcquirerInvestment?.share ?? 0;
  const availableCapacity = Math.max(0, MAX_SHARE_PER_RIVAL - currentAcquirerShare);
  const exchangeValue = calculateMergerExchangeValue(
    absorbedRival,
    acquirer,
    investment,
    state.config.investmentSaleMultiplier
  );
  const transferableShare =
    availableCapacity > 0
      ? roundTo(
          Math.min(availableCapacity, exchangeValue / acquirer.finance.companyValue),
          4
        )
      : 0;
  const transferredValue = Math.round(acquirer.finance.companyValue * transferableShare);
  const carryRatio = exchangeValue > 0 ? transferredValue / exchangeValue : 0;
  const carriedCostBasis = roundTo(investment.costBasis * carryRatio, 2);
  const residualCash = Math.max(0, Math.round(exchangeValue - transferredValue));

  if (transferableShare > 0.000001) {
    if (existingAcquirerInvestment) {
      existingAcquirerInvestment.share = roundTo(
        Math.min(MAX_SHARE_PER_RIVAL, existingAcquirerInvestment.share + transferableShare),
        4
      );
      existingAcquirerInvestment.costBasis = roundTo(
        existingAcquirerInvestment.costBasis + carriedCostBasis,
        2
      );
      existingAcquirerInvestment.totalDividendsReceived += investment.totalDividendsReceived;
      existingAcquirerInvestment.realizedProfit += investment.realizedProfit;
    } else {
      state.player.investments.push({
        rivalId: acquirer.id,
        share: transferableShare,
        costBasis: carriedCostBasis,
        purchasedAtMonth: currentMonth,
        totalDividendsReceived: investment.totalDividendsReceived,
        lastDividend: 0,
        realizedProfit: investment.realizedProfit,
      });
    }
  }

  state.player.investments.splice(sourceIndex, 1);

  const convertedLabel =
    transferableShare > 0.000001
      ? `${(transferableShare * 100).toFixed(1)}% of ${acquirer.name}`
      : "cash only";
  const cashLabel =
    residualCash > 0 ? ` plus ${formatMoney(residualCash)} cash` : "";

  return {
    converted: true,
    cashDelta: residualCash,
    notification: `${absorbedRival.name} merged into ${acquirer.name}. Your stake was converted into ${convertedLabel}${cashLabel}.`,
  };
}

export function refreshInvestmentSummary(
  state: WorldParkLeagueState,
  lastMonthCashDelta: number
): PlayerInvestmentSummary {
  let investedCapital = 0;
  let portfolioValue = 0;
  let totalDividendsReceived = 0;
  let realizedProfit = 0;

  for (const investment of state.player.investments) {
    investedCapital += investment.costBasis;
    totalDividendsReceived += investment.totalDividendsReceived;
    realizedProfit += investment.realizedProfit;

    const rival = state.world.rivals.find((candidate) => candidate.id === investment.rivalId);
    if (rival && rival.status.active) {
      portfolioValue += calculatePositionValue(rival, investment.share);
    }
  }

  state.player.investmentSummary = {
    holdings: state.player.investments.length,
    investedCapital: Math.round(investedCapital),
    portfolioValue: Math.round(portfolioValue),
    totalDividendsReceived: Math.round(totalDividendsReceived),
    realizedProfit: Math.round(realizedProfit),
    lastMonthCashDelta: Math.round(lastMonthCashDelta),
  };

  return state.player.investmentSummary;
}

export function getPortfolioOverviewLine(state: WorldParkLeagueState): string {
  const summary = state.player.investmentSummary;
  return `Holdings ${summary.holdings} | Value ${formatMoney(summary.portfolioValue)} | Dividends ${formatMoney(summary.totalDividendsReceived)}`;
}

export function getPortfolioDetailLine(state: WorldParkLeagueState): string {
  const summary = state.player.investmentSummary;
  return `Invested ${formatMoney(summary.investedCapital)} | Realized ${formatMoney(summary.realizedProfit)} | Last month ${formatSignedMoney(summary.lastMonthCashDelta)}`;
}

export function getTopHoldingLines(state: WorldParkLeagueState, limit: number): string[] {
  const rows = state.player.investments
    .map((investment) => {
      const rival = state.world.rivals.find((candidate) => candidate.id === investment.rivalId);
      if (!rival) {
        return null;
      }

      const value = calculatePositionValue(rival, investment.share);
      return `${trimName(rival.name, 14)} ${(investment.share * 100).toFixed(0)}% ${formatMoney(value)}`;
    })
    .filter((row): row is string => !!row);

  if (rows.length === 0) {
    return ["No active holdings."];
  }

  return rows.slice(0, limit);
}

export function getPortfolioRows(state: WorldParkLeagueState): string[][] {
  const rows = state.player.investments
    .map((investment) => {
      const rival = state.world.rivals.find((candidate) => candidate.id === investment.rivalId);
      if (!rival) {
        return null;
      }

      return [
        trimName(rival.name, 18),
        `${(investment.share * 100).toFixed(0)}%`,
        getInvestmentInfluenceLabel(investment.share),
        formatMoney(investment.costBasis),
        formatMoney(calculatePositionValue(rival, investment.share)),
        formatMoney(investment.lastDividend),
      ];
    })
    .filter((row): row is string[] => !!row);

  if (rows.length > 0) {
    return rows;
  }

  return [["No holdings", "", "", "", "", ""]];
}

export function getInvestmentForRival(
  state: WorldParkLeagueState,
  rivalId: string | null
): PlayerInvestment | null {
  if (!rivalId) {
    return null;
  }

  return state.player.investments.find((investment) => investment.rivalId === rivalId) ?? null;
}

export function grantComplimentaryInvestmentByRivalId(
  state: WorldParkLeagueState,
  rivalId: string,
  share: number,
  currentMonth: number
): { ok: boolean; grantedShare: number; message: string } {
  const rival = state.world.rivals.find((candidate) => candidate.id === rivalId);
  if (!rival || !rival.status.active) {
    return {
      ok: false,
      grantedShare: 0,
      message: "That rival is no longer active enough for a complimentary stake reward.",
    };
  }

  const existing = state.player.investments.find((investment) => investment.rivalId === rivalId) ?? null;
  const currentShare = existing?.share ?? 0;
  const grantedShare = roundTo(
    Math.max(0, Math.min(share, MAX_SHARE_PER_RIVAL - currentShare)),
    4
  );
  if (grantedShare <= 0.000001) {
    return {
      ok: false,
      grantedShare: 0,
      message: `You already own the maximum practical stake in ${rival.name}.`,
    };
  }

  if (existing) {
    existing.share = roundTo(existing.share + grantedShare, 4);
  } else {
    state.player.investments.push({
      rivalId,
      share: grantedShare,
      costBasis: 0,
      purchasedAtMonth: currentMonth,
      totalDividendsReceived: 0,
      lastDividend: 0,
      realizedProfit: 0,
    });
  }

  refreshInvestmentSummary(state, state.player.investmentSummary.lastMonthCashDelta);
  return {
    ok: true,
    grantedShare,
    message: `Received a complimentary ${(grantedShare * 100).toFixed(0)}% stake in ${rival.name}.`,
  };
}

export function getInvestmentInfluenceLabel(share: number): string {
  if (share >= 0.25 - 0.000001) {
    return "Blocking";
  }
  if (share >= 0.2 - 0.000001) {
    return "Anchor";
  }
  if (share >= 0.15 - 0.000001) {
    return "Strategic";
  }
  if (share >= 0.1 - 0.000001) {
    return "Observer";
  }
  return "Passive";
}

function calculatePurchasePrice(
  rival: RivalPark,
  share: number,
  capitalMarketMood: number,
  currentShare: number
): number {
  const dueDiligenceDiscount =
    currentShare >= 0.2 ? 0.02 : currentShare >= 0.15 ? 0.015 : currentShare >= 0.1 ? 0.01 : 0;
  const premium = clamp(
    1.03 + (capitalMarketMood - 1) * 0.08 + rival.momentum * 0.003 - dueDiligenceDiscount,
    1.005,
    1.16
  );
  return Math.round(calculatePositionValue(rival, share) * premium);
}

function calculateSalePrice(
  rival: RivalPark,
  share: number,
  capitalMarketMood: number,
  currentShare: number,
  saleMultiplier: number
): number {
  const strategicLiquidityBonus =
    currentShare >= 0.2 ? 0.012 : currentShare >= 0.15 ? 0.008 : currentShare >= 0.1 ? 0.004 : 0;
  const discount = clamp(
    0.97 - (capitalMarketMood - 1) * 0.03 - rival.risk * 0.0008 + strategicLiquidityBonus,
    0.88,
    0.99
  );
  return Math.round(calculatePositionValue(rival, share) * discount * saleMultiplier);
}

function calculateForcedExitPayout(
  rival: RivalPark,
  investment: PlayerInvestment,
  saleMultiplier: number
): number {
  const baseValue = calculatePositionValue(rival, investment.share);
  const influenceRecoveryBonus =
    investment.share >= 0.2 ? 0.08 : investment.share >= 0.15 ? 0.05 : investment.share >= 0.1 ? 0.03 : 0;
  const discount = rival.status.mergedIntoId ? 0.92 + influenceRecoveryBonus * 0.4 : 0.55 + influenceRecoveryBonus;
  return Math.round(baseValue * discount * saleMultiplier);
}

function calculateMergerExchangeValue(
  absorbedRival: RivalPark,
  acquirer: RivalPark,
  investment: PlayerInvestment,
  saleMultiplier: number
): number {
  const baseValue = calculatePositionValue(absorbedRival, investment.share);
  const scaleBonus = clamp(
    (acquirer.finance.companyValue / Math.max(1, absorbedRival.finance.companyValue) - 1) * 0.01,
    0,
    0.04
  );
  const influenceBonus =
    investment.share >= 0.2 ? 0.05 : investment.share >= 0.15 ? 0.035 : investment.share >= 0.1 ? 0.02 : 0.01;
  const exchangeRate = clamp(0.92 + scaleBonus + influenceBonus, 0.92, 0.99);
  return Math.round(baseValue * exchangeRate * saleMultiplier);
}

function calculateDividend(
  rival: RivalPark,
  share: number,
  capitalMarketMood: number,
  dividendMultiplier: number
): number {
  if (rival.finance.monthlyProfit <= 0) {
    return 0;
  }

  const debtRatio =
    rival.finance.companyValue > 0 ? rival.finance.debt / rival.finance.companyValue : 0;
  const payoutRatio = clamp(
    0.12 +
      (capitalMarketMood - 1) * 0.05 +
      rival.stats.operations * 0.001 +
      rival.stats.prestige * 0.0004 -
      debtRatio * 0.08,
    0.05,
    0.28
  );
  const influenceMultiplier =
    share >= 0.25 ? 1.16 : share >= 0.2 ? 1.12 : share >= 0.15 ? 1.08 : share >= 0.1 ? 1.04 : 1;

  return Math.max(
    0,
    Math.round(rival.finance.monthlyProfit * payoutRatio * share * influenceMultiplier * dividendMultiplier)
  );
}

function calculatePositionValue(rival: RivalPark, share: number): number {
  return Math.round(rival.finance.companyValue * share);
}

function isSupportedLotShare(share: number): boolean {
  return SUPPORTED_LOT_SHARES.some((candidate) => Math.abs(candidate - share) < 0.000001);
}

function isValidSellShare(share: number, currentShare: number): boolean {
  if (share <= 0 || share > currentShare + 0.000001) {
    return false;
  }
  return isSupportedLotShare(share) || Math.abs(share - currentShare) < 0.000001;
}

function failure(state: WorldParkLeagueState, message: string): InvestmentTransactionResult {
  return {
    ok: false,
    state,
    cashDelta: 0,
    message,
  };
}

function trimName(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
