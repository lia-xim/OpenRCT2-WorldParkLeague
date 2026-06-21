import { describe, expect, it } from "vitest";
import { PLAYER_PARK_ID } from "../src/config";
import {
  getHistorySeries,
  getHistoryMetricValue,
  summarizeHistoryMetric,
  recordHistorySnapshot,
} from "../src/domain/history";
import { createInitialState } from "../src/domain/simulation";
import type { LeaderboardEntry, PlayerSnapshot } from "../src/types";

function createSnapshot(dayIndex: number): PlayerSnapshot {
  const month = Math.floor(dayIndex / 31);
  const day = (dayIndex % 31) + 1;
  return {
    parkName: "Test Park",
    currentMonth: month,
    currentDay: day,
    currentDayIndex: dayIndex,
    parkRating: 820,
    guests: 1_200 + dayIndex,
    parkValue: 2_000_000 + dayIndex * 100,
    companyValue: 2_050_000 + dayIndex * 100,
    cash: 50_000 + dayIndex * 10,
    bankLoan: 20_000,
    lastMonthRevenue: 60_000,
    lastMonthOperatingCosts: 42_000,
    lastMonthOperatingProfit: 18_000 + (dayIndex % 10),
    totalRideCount: 12,
    openRideCount: 10,
    stallCount: 5,
    averageRideExcitement: 6.5,
    averageRideSatisfaction: 82,
    totalRideProfit: 88_000,
  };
}

function createPlayerEntry(snapshot: PlayerSnapshot): LeaderboardEntry {
  return {
    rank: 12,
    parkId: PLAYER_PARK_ID,
    parkName: snapshot.parkName,
    isPlayer: true,
    score: 64,
    scoreDelta: 0.5,
    marketShare: 0.024,
    monthlyProfit: snapshot.lastMonthOperatingProfit,
    companyValue: snapshot.companyValue,
    monthlyVisitors: 1300,
    debtRatio: 0.1,
    regionLabel: "Europe",
    statusLabel: "Player",
    trendLabel: "+",
  };
}

describe("history retention", () => {
  it("keeps long-range history compacted for all-view use instead of hard-dropping old months", () => {
    const state = createInitialState(0, "Test Park");

    for (let dayIndex = 0; dayIndex <= 500; dayIndex += 1) {
      const snapshot = createSnapshot(dayIndex);
      state.world.leaderboard = [createPlayerEntry(snapshot)];
      recordHistorySnapshot(state, snapshot, dayIndex);
    }

    const series = getHistorySeries(state, PLAYER_PARK_ID, 9_999);
    expect(series.length).toBeGreaterThan(140);
    expect(series.length).toBeLessThan(260);
    expect(series[0]?.month).toBe(0);
    expect(series.at(-1)?.dayIndex).toBe(500);
    expect(series.some((point) => point.month === 6)).toBe(true);
    expect(series.some((point) => point.dayIndex >= 450)).toBe(true);
  });

  it("tracks park cash and league worth for player-side finance trends", () => {
    const state = createInitialState(0, "Finance Test Park");

    for (let dayIndex = 0; dayIndex <= 40; dayIndex += 10) {
      const snapshot = createSnapshot(dayIndex);
      state.world.leaderboard = [createPlayerEntry(snapshot)];
      recordHistorySnapshot(state, snapshot, dayIndex);
    }

    const series = getHistorySeries(state, PLAYER_PARK_ID, 100);
    const latest = series.at(-1);
    const summary = summarizeHistoryMetric(series, "ownerCash");

    expect(series.length).toBeGreaterThan(0);
    expect(latest?.ownerCash).toBe(createSnapshot(40).cash);
    expect((latest?.ownerNetWorth ?? 0) >= (latest?.ownerCash ?? 0)).toBe(true);
    expect(getHistoryMetricValue(latest!, "ownerCash")).toBe(latest?.ownerCash);
    expect(summary?.current).toBe(latest?.ownerCash);
  });
});
