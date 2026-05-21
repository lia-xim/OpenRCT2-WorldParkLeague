import { DAYS_PER_MONTH, PLAYER_PARK_ID, SEASON_FACTORS } from "../config";
import type { LeaderboardEntry, ParkHistoryPoint, PlayerSnapshot, WorldParkLeagueState } from "../types";
import type { LocalMarketSummary } from "./watchlist";

const YEAR_MONTHS = SEASON_FACTORS.length;

export interface PrestigeMilestone {
  key: string;
  title: string;
  completed: boolean;
  progressLabel: string;
}

export interface YearlyRecap {
  windowLabel: string;
  biggestWinner: string;
  biggestLoser: string;
  mainRival: string;
  bestMonth: string;
  biggestJump: string;
}

export function buildPrestigeMilestones(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  localMarketSummary: LocalMarketSummary | null
): PrestigeMilestone[] {
  const topTenStreak = calculateTopTenMonthStreak(state);

  return [
    {
      key: "guests_1000",
      title: "1,000 guests",
      completed: snapshot.guests >= 1_000,
      progressLabel: `${Math.min(1_000, snapshot.guests).toLocaleString("en-US")}/1,000`,
    },
    {
      key: "top10_3m",
      title: "Top 10 streak",
      completed: topTenStreak >= 3,
      progressLabel: `${Math.min(3, topTenStreak)}/3 months`,
    },
    {
      key: "local_lead",
      title: "Local market lead",
      completed: !!localMarketSummary?.playerLeads,
      progressLabel: localMarketSummary
        ? localMarketSummary.playerLeads
          ? "Lead held"
          : `-${(localMarketSummary.shareGapToLeader * 100).toFixed(1)}%`
        : "Forming",
    },
    {
      key: "satisfaction_90",
      title: "90 satisfaction",
      completed: snapshot.averageRideSatisfaction >= 90,
      progressLabel: `${Math.round(Math.min(90, snapshot.averageRideSatisfaction))}/90`,
    },
    {
      key: "share_4",
      title: "4% people share",
      completed: state.player.marketShare >= 0.04,
      progressLabel: `${(Math.min(0.04, state.player.marketShare) * 100).toFixed(1)}/4.0%`,
    },
  ];
}

export function buildYearlyRecap(
  state: WorldParkLeagueState,
  comparisonEntry: LeaderboardEntry | null
): YearlyRecap | null {
  const playerSeries = state.world.history[PLAYER_PARK_ID] ?? [];
  if (playerSeries.length === 0) {
    return null;
  }

  const lastPoint = playerSeries[playerSeries.length - 1];
  if (!lastPoint) {
    return null;
  }

  const endMonth = lastPoint.month;
  const startMonth = Math.max(0, endMonth - (YEAR_MONTHS - 1));
  const recapCandidates = collectRecapCandidates(state, startMonth, endMonth);
  const fallbackCandidate = recapCandidates[0];
  if (!fallbackCandidate) {
    return null;
  }

  const biggestWinner = recapCandidates.reduce(
    (best, candidate) => (candidate.deltaScore > best.deltaScore ? candidate : best),
    fallbackCandidate
  );
  const biggestLoser = recapCandidates.reduce(
    (worst, candidate) => (candidate.deltaScore < worst.deltaScore ? candidate : worst),
    fallbackCandidate
  );

  const mainRival = resolveMainRival(state, comparisonEntry);
  const bestMonth = resolveBestMonth(playerSeries, startMonth, endMonth);
  const biggestJump = resolveBiggestJump(playerSeries, startMonth, endMonth);

  return {
    windowLabel: buildWindowLabel(startMonth, endMonth),
    biggestWinner: biggestWinner
      ? `${biggestWinner.parkName} (${formatSignedNumber(biggestWinner.deltaScore)})`
      : "n/a",
    biggestLoser: biggestLoser
      ? `${biggestLoser.parkName} (${formatSignedNumber(biggestLoser.deltaScore)})`
      : "n/a",
    mainRival,
    bestMonth,
    biggestJump,
  };
}

export function summarizeMilestones(milestones: PrestigeMilestone[]): {
  completed: number;
  total: number;
  nextGoal: string;
} {
  const completed = milestones.filter((milestone) => milestone.completed).length;
  const nextMilestone = milestones.find((milestone) => !milestone.completed) ?? milestones[0];
  return {
    completed,
    total: milestones.length,
    nextGoal: nextMilestone
      ? `${nextMilestone.title} ${nextMilestone.progressLabel}`
      : "All goals cleared",
  };
}

function calculateTopTenMonthStreak(state: WorldParkLeagueState): number {
  const monthlyPoints = getMonthlyPlayerPoints(state);
  let streak = 0;
  for (let index = monthlyPoints.length - 1; index >= 0; index -= 1) {
    const point = monthlyPoints[index];
    if (!point || point.rank > 10) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function getMonthlyPlayerPoints(state: WorldParkLeagueState): ParkHistoryPoint[] {
  const playerSeries = state.world.history[PLAYER_PARK_ID] ?? [];
  const monthly = new Map<number, ParkHistoryPoint>();
  for (const point of playerSeries) {
    monthly.set(point.month, point);
  }

  return [...monthly.values()].sort((left, right) => left.month - right.month);
}

function collectRecapCandidates(
  state: WorldParkLeagueState,
  startMonth: number,
  endMonth: number
): Array<{ parkId: string; parkName: string; deltaScore: number }> {
  const candidates: Array<{ parkId: string; parkName: string; deltaScore: number }> = [];

  for (const [parkId, series] of Object.entries(state.world.history)) {
    const startPoint = findPointForMonth(series, startMonth);
    const endPoint = findPointForMonth(series, endMonth);
    if (!startPoint || !endPoint) {
      continue;
    }

    candidates.push({
      parkId,
      parkName: resolveParkName(state, parkId),
      deltaScore: endPoint.score - startPoint.score,
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      parkId: PLAYER_PARK_ID,
      parkName: state.player.parkName,
      deltaScore: 0,
    });
  }

  return candidates;
}

function resolveBestMonth(
  playerSeries: ParkHistoryPoint[],
  startMonth: number,
  endMonth: number
): string {
  const monthlyPoints = new Map<number, ParkHistoryPoint>();
  for (const point of playerSeries) {
    if (point.month < startMonth || point.month > endMonth) {
      continue;
    }

    monthlyPoints.set(point.month, point);
  }

  const months = [...monthlyPoints.values()];
  if (months.length === 0) {
    return "No month closed yet";
  }

  const best = months.reduce((candidate, point) =>
    point.monthlyProfit > candidate.monthlyProfit ? point : candidate
  );
  return `M${best.month + 1} ${formatSignedMoney(best.monthlyProfit)}`;
}

function resolveBiggestJump(
  playerSeries: ParkHistoryPoint[],
  startMonth: number,
  endMonth: number
): string {
  const months = [...new Map(
    playerSeries
      .filter((point) => point.month >= startMonth && point.month <= endMonth)
      .map((point) => [point.month, point])
  ).values()].sort((left, right) => left.month - right.month);

  if (months.length < 2) {
    return "No jump yet";
  }

  let bestJump = 0;
  let bestMonth = months[0]?.month ?? startMonth;
  for (let index = 1; index < months.length; index += 1) {
    const previous = months[index - 1];
    const current = months[index];
    if (!previous || !current) {
      continue;
    }

    const jump = previous.rank - current.rank;
    if (jump > bestJump) {
      bestJump = jump;
      bestMonth = current.month;
    }
  }

  if (bestJump <= 0) {
    return "No positive jump";
  }

  return `M${bestMonth + 1} +${bestJump} rank${bestJump === 1 ? "" : "s"}`;
}

function resolveMainRival(
  state: WorldParkLeagueState,
  comparisonEntry: LeaderboardEntry | null
): string {
  if (comparisonEntry && !comparisonEntry.isPlayer) {
    return comparisonEntry.parkName;
  }

  const focusId = state.player.watchlist.focusRivalIds[0];
  if (focusId) {
    return resolveParkName(state, focusId);
  }

  const nextRival = state.world.leaderboard.find((entry) => !entry.isPlayer);
  return nextRival?.parkName ?? "No rival yet";
}

function resolveParkName(state: WorldParkLeagueState, parkId: string): string {
  if (parkId === PLAYER_PARK_ID) {
    return state.player.parkName;
  }

  return (
    state.world.leaderboard.find((entry) => entry.parkId === parkId)?.parkName ??
    state.world.rivals.find((rival) => rival.id === parkId)?.name ??
    "Unknown park"
  );
}

function findPointForMonth(series: ParkHistoryPoint[], month: number): ParkHistoryPoint | null {
  let selected: ParkHistoryPoint | null = null;
  for (const point of series) {
    if (point.month > month) {
      break;
    }

    selected = point;
  }

  return selected;
}

function buildWindowLabel(startMonth: number, endMonth: number): string {
  if (startMonth === endMonth) {
    return `M${endMonth + 1}`;
  }

  return `M${startMonth + 1}-${endMonth + 1}`;
}

function formatSignedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatSignedMoney(value: number): string {
  const rounded = Math.round(Math.abs(value)).toLocaleString("en-US");
  return `${value >= 0 ? "+" : "-"}$${rounded}`;
}
