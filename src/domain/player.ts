import { DAYS_PER_MONTH, PLAYER_PARK_ID } from "../config";
import { normalizeGameMoney } from "./currency";
import { getGovernanceDetailLine, getGovernanceSummaryLine } from "./governance";
import { average, clamp, logarithmicScale } from "./math";
import type { LeaderboardEntry, PlayerSnapshot, WorldParkLeagueState } from "../types";

type MonthlyFinanceType = Parameters<Park["getMonthlyExpenditure"]>[0];

export interface GuestCapBreakdown {
  modifier: number;
  rankBonus: number;
  shareBonus: number;
  awardBonus: number;
  economyBonus: number;
}

export interface PlayerScoreBreakdown {
  ratingScore: number;
  guestScore: number;
  valueScore: number;
  rideQualityScore: number;
  portfolioScore: number;
  maturityScore: number;
  totalScore: number;
}

export function calculatePlayerEquityValue(snapshot: PlayerSnapshot): number {
  const parkValue = sanitizeNonNegative(snapshot.parkValue);
  const cash = sanitizeNonNegative(snapshot.cash);
  const bankLoan = sanitizeNonNegative(snapshot.bankLoan);
  return Math.max(0, parkValue + cash - bankLoan);
}

export function readPlayerSnapshot(): PlayerSnapshot {
  const allRides = map.rides;
  const trackedRides = allRides.filter((ride) => ride.classification === "ride");
  const openRides = trackedRides.filter(
    (ride) => ride.status === "open" || ride.status === "testing" || ride.status === "simulating"
  );
  const stalls = allRides.filter((ride) => ride.classification === "stall");
  const excitementValues = trackedRides.map((ride) => ride.excitement / 100);
  const satisfactionValues = trackedRides.map((ride) => ride.satisfaction);
  const totalRideProfit = trackedRides.reduce((total, ride) => total + ride.totalProfit, 0);
  const lastMonthRevenue =
    readMonthlyFinance("park_entrance_tickets") +
    readMonthlyFinance("park_ride_tickets") +
    readMonthlyFinance("shop_sales") +
    readMonthlyFinance("food_drink_sales");
  const lastMonthOperatingCosts =
    readMonthlyFinance("ride_runningcosts") +
    readMonthlyFinance("shop_stock") +
    readMonthlyFinance("food_drink_stock") +
    readMonthlyFinance("wages") +
    readMonthlyFinance("marketing") +
    readMonthlyFinance("research") +
    readMonthlyFinance("interest");
  const currentDay = date.day;
  const currentDayIndex = date.monthsElapsed * DAYS_PER_MONTH + Math.max(0, currentDay - 1);

  return {
    parkName: park.name,
    currentMonth: date.monthsElapsed,
    currentDay,
    currentDayIndex,
    parkRating: park.rating,
    guests: park.guests,
    parkValue: normalizeGameMoney(park.value),
    companyValue: Math.max(
      0,
      normalizeGameMoney(park.value + park.cash - park.bankLoan)
    ),
    cash: normalizeGameMoney(park.cash),
    bankLoan: normalizeGameMoney(park.bankLoan),
    lastMonthRevenue: Math.round(lastMonthRevenue),
    lastMonthOperatingCosts: Math.round(lastMonthOperatingCosts),
    lastMonthOperatingProfit: Math.round(lastMonthRevenue - lastMonthOperatingCosts),
    totalRideCount: trackedRides.length,
    openRideCount: openRides.length,
    stallCount: stalls.length,
    averageRideExcitement: average(excitementValues),
    averageRideSatisfaction: average(satisfactionValues),
    totalRideProfit,
  };
}

export function calculatePlayerScore(snapshot: PlayerSnapshot): number {
  return calculatePlayerScoreBreakdown(snapshot).totalScore;
}

export function calculatePlayerScoreBreakdown(snapshot: PlayerSnapshot): PlayerScoreBreakdown {
  const parkRating = sanitizeNonNegative(snapshot.parkRating);
  const guests = sanitizeNonNegative(snapshot.guests);
  const lastMonthRevenue = sanitizeNonNegative(snapshot.lastMonthRevenue);
  const totalRideCount = sanitizeNonNegative(snapshot.totalRideCount);
  const openRideCount = sanitizeNonNegative(snapshot.openRideCount);
  const stallCount = sanitizeNonNegative(snapshot.stallCount);
  const averageRideExcitement = sanitizeNonNegative(snapshot.averageRideExcitement);
  const averageRideSatisfaction = clamp(sanitizeNonNegative(snapshot.averageRideSatisfaction), 0, 100);
  const equityValue = calculatePlayerEquityValue(snapshot);
  const ratingScore = clamp(parkRating / 10, 0, 100);
  const guestScore = logarithmicScale(guests, 3_200) * 100;
  const valueScore = logarithmicScale(equityValue, 3_500_000) * 100;
  const rideQualityScore = clamp(
    averageRideExcitement * 7.2 + averageRideSatisfaction * 0.34,
    0,
    100
  );
  const portfolioScore = clamp(
    openRideCount * 4.1 + stallCount * 1.7 + totalRideCount * 0.9,
    0,
    100
  );
  const scaleSignal = clamp(
    logarithmicScale(totalRideCount + stallCount, 28) * 0.35 +
      logarithmicScale(guests, 2_600) * 0.3 +
      logarithmicScale(Math.max(10_000, equityValue), 2_400_000) * 0.2 +
      logarithmicScale(Math.max(1_000, lastMonthRevenue), 80_000) * 0.15,
    0,
    1
  );
  const maturityFactor = clamp(0.32 + scaleSignal * 0.68, 0.32, 1);
  const maturityScore = maturityFactor * 100;
  const baseScore =
    ratingScore * 0.3 +
    guestScore * 0.18 +
    valueScore * 0.22 +
    rideQualityScore * 0.22 +
    portfolioScore * 0.08;

  const totalScore = clamp(
    baseScore * maturityFactor + scaleSignal * 4,
    18,
    100
  );

  return {
    ratingScore,
    guestScore,
    valueScore,
    rideQualityScore,
    portfolioScore,
    maturityScore,
    totalScore,
  };
}

export function calculateGuestCapModifier(
  rank: number | null,
  fieldSize: number,
  marketShare: number,
  activeAwardMonthsRemaining: number,
  economyIndex: number,
  tourismIndex: number
): number {
  return calculateGuestCapBreakdown(
    rank,
    fieldSize,
    marketShare,
    activeAwardMonthsRemaining,
    economyIndex,
    tourismIndex
  ).modifier;
}

export function calculateGuestCapBreakdown(
  rank: number | null,
  fieldSize: number,
  marketShare: number,
  activeAwardMonthsRemaining: number,
  economyIndex: number,
  tourismIndex: number
): GuestCapBreakdown {
  if (!rank || fieldSize <= 1) {
    return {
      modifier: 1,
      rankBonus: 0,
      shareBonus: 0,
      awardBonus: 0,
      economyBonus: 0,
    };
  }

  const rankStrength = 1 - (rank - 1) / (fieldSize - 1);
  const rankBonus = (rankStrength - 0.5) * 0.22;
  const averageShare = 1 / fieldSize;
  const shareBonus = clamp((marketShare - averageShare) * 0.65, -0.08, 0.09);
  const awardBonus = activeAwardMonthsRemaining > 0 ? 0.06 : 0;
  const economyBonus = clamp((economyIndex - 1) * 0.08 + (tourismIndex - 1) * 0.14, -0.05, 0.05);

  return {
    modifier: clamp(1 + rankBonus + shareBonus + awardBonus + economyBonus, 0.75, 1.35),
    rankBonus,
    shareBonus,
    awardBonus,
    economyBonus,
  };
}

export function getPlayerStandingLine(state: WorldParkLeagueState): string {
  const rank = state.player.currentRank ?? "-";
  const share = Math.round(state.player.marketShare * 1000) / 10;
  const modifier = Math.round(state.player.guestCapModifier * 1000) / 1000;
  return `Rank ${rank} | People share ${share}% | Guest cap x${modifier}`;
}

export function getGuestCapBreakdownLine(state: WorldParkLeagueState): string {
  const breakdown = calculateGuestCapBreakdown(
    state.player.currentRank,
    state.world.leaderboard.length,
    state.player.marketShare,
    state.player.activeAwardMonthsRemaining,
    state.world.economyIndex,
    state.world.tourismIndex
  );

  return `Drivers Rank ${formatDelta(breakdown.rankBonus)} | People ${formatDelta(
    breakdown.shareBonus
  )} | Award ${formatDelta(breakdown.awardBonus)} | Macro ${formatDelta(
    breakdown.economyBonus
  )}`;
}

export { getGovernanceDetailLine, getGovernanceSummaryLine };

export function createPlayerLeaderboardEntry(
  rank: number,
  score: number,
  marketShare: number,
  parkName: string,
  snapshot: PlayerSnapshot,
  liveMomentum: number
): LeaderboardEntry {
  const equityValue = calculatePlayerEquityValue(snapshot);
  return {
    rank,
    parkId: PLAYER_PARK_ID,
    parkName,
    isPlayer: true,
    score,
    scoreDelta: liveMomentum,
    marketShare: clamp(sanitizeNonNegative(marketShare), 0, 1),
    monthlyProfit: sanitizeFinite(snapshot.lastMonthOperatingProfit),
    companyValue: equityValue,
    monthlyVisitors: Math.round(sanitizeNonNegative(snapshot.guests)),
    debtRatio: equityValue > 0 ? sanitizeNonNegative(snapshot.bankLoan) / equityValue : 0,
    regionLabel: "Your park",
    statusLabel: "Player",
    trendLabel: getMomentumTrendLabel(liveMomentum),
  };
}

function formatDelta(value: number): string {
  const percent = Math.abs(value * 100).toFixed(1);
  return `${value >= 0 ? "+" : "-"}${percent}%`;
}

function readMonthlyFinance(type: MonthlyFinanceType): number {
  const history = park.getMonthlyExpenditure(type);
  const value = history[1] ?? history[0] ?? 0;
  return normalizeGameMoney(Math.abs(value));
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

function sanitizeFinite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function sanitizeNonNegative(value: number): number {
  return Math.max(0, sanitizeFinite(value));
}
