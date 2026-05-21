import { DAYS_PER_MONTH, PLAYER_PARK_ID } from "../config";
import { roundTo } from "./math";
import type {
  HistoryMetricKey,
  LeaderboardEntry,
  NewsItem,
  ParkHistoryMarker,
  ParkHistoryPoint,
  PlayerSnapshot,
  RivalPark,
  WorldParkLeagueState,
} from "../types";

const DAILY_HISTORY_RETENTION_DAYS = 124;
const WEEKLY_HISTORY_RETENTION_DAYS = 372;
const MONTHLY_HISTORY_RETENTION_MONTHS = 240;
const HISTORY_EVENT_RETENTION_POINTS = 96;

export interface HistorySummary {
  current: number;
  previous: number | null;
  delta: number;
  min: number;
  max: number;
}

export function recordHistorySnapshot(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  dayIndex: number
): void {
  const recordedMonth = Math.max(0, Math.floor(dayIndex / DAYS_PER_MONTH));
  const leaderboard = state.world.leaderboard;
  const playerEntry = leaderboard.find((entry) => entry.parkId === PLAYER_PARK_ID) ?? null;
  if (playerEntry) {
    upsertHistoryPoint(
      state.world.history,
      PLAYER_PARK_ID,
      createHistoryPoint(
        playerEntry,
        snapshot.cash,
        recordedMonth,
        state.player.liveMomentum,
        dayIndex
      )
    );
  }

  for (const entry of leaderboard) {
    if (entry.isPlayer) {
      continue;
    }

    const rival = state.world.rivals.find((candidate) => candidate.id === entry.parkId);
    if (!rival) {
      continue;
    }

    upsertHistoryPoint(
      state.world.history,
      entry.parkId,
      createHistoryPoint(
        entry,
        rival.finance.cashReserve,
        recordedMonth,
        rival.momentum,
        dayIndex
      )
    );
  }
}

export function getHistorySeries(
  state: WorldParkLeagueState,
  parkId: string | null,
  maxPoints: number = 42
): ParkHistoryPoint[] {
  if (!parkId) {
    return [];
  }

  const series = state.world.history[parkId] ?? [];
  if (series.length <= maxPoints) {
    return series;
  }

  return series.slice(series.length - maxPoints);
}

export function getHistoryMarkers(
  state: WorldParkLeagueState,
  parkId: string | null,
  minDayIndex: number = 0
): ParkHistoryMarker[] {
  if (!parkId) {
    return [];
  }

  return (state.world.historyEvents[parkId] ?? []).filter((marker) => marker.dayIndex >= minDayIndex);
}

export function getHistoryMetricValue(
  point: ParkHistoryPoint,
  metric: HistoryMetricKey
): number {
  switch (metric) {
    case "momentum":
      return point.momentum;
    case "marketShare":
      return point.marketShare;
    case "companyValue":
      return point.companyValue;
    case "monthlyProfit":
      return point.monthlyProfit;
    case "money":
      return point.money;
    case "rank":
      return point.rank;
    case "score":
    default:
      return point.score;
  }
}

export function summarizeHistoryMetric(
  series: ParkHistoryPoint[],
  metric: HistoryMetricKey
): HistorySummary | null {
  if (series.length === 0) {
    return null;
  }

  const values = series.map((point) => getHistoryMetricValue(point, metric));
  const current = values[values.length - 1] ?? 0;
  const previous = values.length > 1 ? (values[values.length - 2] ?? null) : null;
  const min = values.reduce((lowest, value) => Math.min(lowest, value), values[0] ?? 0);
  const max = values.reduce((highest, value) => Math.max(highest, value), values[0] ?? 0);

  return {
    current,
    previous,
    delta: previous === null ? 0 : roundTo(current - previous, 4),
    min,
    max,
  };
}

export function recordHistoryMarkers(
  state: WorldParkLeagueState,
  newsItems: NewsItem[],
  dayIndex: number
): void {
  const recordedMonth = Math.max(0, Math.floor(dayIndex / DAYS_PER_MONTH));
  for (const item of newsItems) {
    if (!item.parkId) {
      continue;
    }

    upsertHistoryMarker(state.world.historyEvents, item.parkId, {
      dayIndex,
      month: recordedMonth,
      label: item.headline,
      severity: item.severity,
    });
  }
}

function createHistoryPoint(
  entry: LeaderboardEntry,
  money: number,
  month: number,
  momentum: number,
  dayIndex: number
): ParkHistoryPoint {
  return {
    dayIndex,
    month,
    rank: entry.rank,
    score: roundTo(entry.score, 2),
    marketShare: roundTo(entry.marketShare, 6),
    companyValue: Math.round(entry.companyValue),
    monthlyProfit: Math.round(entry.monthlyProfit),
    money: Math.round(money),
    momentum: roundTo(momentum, 2),
  };
}

function upsertHistoryPoint(
  history: Record<string, ParkHistoryPoint[]>,
  parkId: string,
  point: ParkHistoryPoint
): void {
  const series = history[parkId] ?? [];
  const lastPoint = series[series.length - 1];
  if (lastPoint && lastPoint.dayIndex === point.dayIndex) {
    series[series.length - 1] = point;
  } else {
    series.push(point);
  }

  history[parkId] = compactHistorySeries(series, point.dayIndex);
}

function upsertHistoryMarker(
  historyEvents: Record<string, ParkHistoryMarker[]>,
  parkId: string,
  marker: ParkHistoryMarker
): void {
  const series = historyEvents[parkId] ?? [];
  const duplicate = series.find(
    (entry) => entry.dayIndex === marker.dayIndex && entry.label === marker.label
  );
  if (!duplicate) {
    series.push(marker);
  }

  if (series.length > HISTORY_EVENT_RETENTION_POINTS) {
    series.splice(0, series.length - HISTORY_EVENT_RETENTION_POINTS);
  }

  historyEvents[parkId] = series;
}

function compactHistorySeries(
  series: ParkHistoryPoint[],
  latestDayIndex: number
): ParkHistoryPoint[] {
  const dailyCutoff = latestDayIndex - DAILY_HISTORY_RETENTION_DAYS;
  const weeklyCutoff = latestDayIndex - WEEKLY_HISTORY_RETENTION_DAYS;
  const monthlyCutoff = latestDayIndex - DAYS_PER_MONTH * MONTHLY_HISTORY_RETENTION_MONTHS;
  const compacted = new Map<string, ParkHistoryPoint>();

  for (const point of series) {
    const bucket = getRetentionBucket(point, dailyCutoff, weeklyCutoff, monthlyCutoff);
    if (!bucket) {
      continue;
    }

    compacted.set(bucket, point);
  }

  return [...compacted.values()].sort((left, right) => left.dayIndex - right.dayIndex);
}

function getRetentionBucket(
  point: ParkHistoryPoint,
  dailyCutoff: number,
  weeklyCutoff: number,
  monthlyCutoff: number
): string | null {
  if (point.dayIndex >= dailyCutoff) {
    return `d:${point.dayIndex}`;
  }

  if (point.dayIndex >= weeklyCutoff) {
    return `w:${Math.floor(point.dayIndex / 7)}`;
  }

  if (point.dayIndex >= monthlyCutoff) {
    return `m:${point.month}`;
  }

  return null;
}
