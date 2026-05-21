import { describe, expect, it } from "vitest";
import { calculatePlayerScoreBreakdown } from "../src/domain/player";
import type { PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    parkName: "Player Park",
    currentMonth: 0,
    currentDay: 1,
    currentDayIndex: 0,
    parkRating: 760,
    guests: 140,
    parkValue: 28_000,
    companyValue: 18_000,
    cash: 12_000,
    bankLoan: 22_000,
    lastMonthRevenue: 4_200,
    lastMonthOperatingCosts: 3_500,
    lastMonthOperatingProfit: 700,
    totalRideCount: 6,
    openRideCount: 6,
    stallCount: 1,
    averageRideExcitement: 5.9,
    averageRideSatisfaction: 72,
    totalRideProfit: 6_500,
    ...overrides,
  };
}

describe("player scoring", () => {
  it("keeps very early parks clearly below mature competitors", () => {
    const earlyPark = calculatePlayerScoreBreakdown(createSnapshot());
    const maturePark = calculatePlayerScoreBreakdown(
      createSnapshot({
        parkRating: 910,
        guests: 2_450,
        parkValue: 2_850_000,
        companyValue: 2_940_000,
        cash: 140_000,
        bankLoan: 50_000,
        lastMonthRevenue: 82_000,
        lastMonthOperatingCosts: 54_000,
        lastMonthOperatingProfit: 28_000,
        totalRideCount: 19,
        openRideCount: 17,
        stallCount: 7,
        averageRideExcitement: 7.4,
        averageRideSatisfaction: 86,
        totalRideProfit: 125_000,
      })
    );

    expect(earlyPark.totalScore).toBeLessThan(55);
    expect(maturePark.totalScore).toBeGreaterThan(earlyPark.totalScore + 20);
    expect(maturePark.maturityScore).toBeGreaterThan(earlyPark.maturityScore);
  });

  it("stays finite even if snapshot data is partially invalid", () => {
    const brokenSnapshot = createSnapshot({
      parkValue: Number.NaN,
      cash: Number.NaN,
      bankLoan: Number.NaN,
      guests: Number.NaN,
      parkRating: Number.NaN,
      lastMonthRevenue: Number.NaN,
      averageRideExcitement: Number.NaN,
      averageRideSatisfaction: Number.NaN,
    });

    const score = calculatePlayerScoreBreakdown(brokenSnapshot);

    expect(Number.isFinite(score.totalScore)).toBe(true);
    expect(score.totalScore).toBeGreaterThanOrEqual(18);
    expect(score.totalScore).toBeLessThanOrEqual(100);
  });
});
