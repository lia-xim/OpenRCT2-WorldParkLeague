import { describe, expect, it } from "vitest";
import { createInitialStateAtDay } from "../src/domain/simulation";
import { advancePlayerObjective } from "../src/domain/objectives";
import type { PlayerObjective, PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    parkName: "Goal Park",
    currentMonth: 0,
    currentDay: 8,
    currentDayIndex: 8,
    parkRating: 820,
    guests: 1_250,
    parkValue: 900_000,
    companyValue: 880_000,
    cash: 35_000,
    bankLoan: 20_000,
    lastMonthRevenue: 42_000,
    lastMonthOperatingCosts: 30_000,
    lastMonthOperatingProfit: 12_000,
    totalRideCount: 8,
    openRideCount: 7,
    stallCount: 3,
    averageRideExcitement: 5.7,
    averageRideSatisfaction: 76,
    totalRideProfit: 38_000,
    ...overrides,
  };
}

function createObjective(overrides: Partial<PlayerObjective> = {}): PlayerObjective {
  return {
    id: "objective:test",
    type: "guest_growth",
    title: "Crowd Target",
    summary: "Pull more guests into the park before the deadline.",
    issuedAtDayIndex: 0,
    resolveAtDayIndex: 7,
    baselineGuests: 1_000,
    baselineRating: 800,
    baselineProfit: 8_000,
    baselineOpenRideCount: 5,
    targetGuests: 1_200,
    targetRating: 0,
    targetProfit: 0,
    targetOpenRideCount: 0,
    rewardCash: 5_000,
    penaltyCash: 7_000,
    ...overrides,
  };
}

describe("player objectives", () => {
  it("rewards completed objectives with park cash and a temporary prestige reward", () => {
    const state = createInitialStateAtDay(0, 0, "Goal Park");
    state.player.objectives.activeObjective = createObjective();

    const result = advancePlayerObjective(state, createSnapshot({ guests: 1_250 }), 7);

    expect(result.cashDelta).toBe(5_000);
    expect(result.headlines[0]?.severity).toBe("success");
    expect(state.player.objectives.activeObjective).toBeNull();
    expect(state.player.objectives.completedObjectives).toBe(1);
    expect(state.player.prestige.activeRewards[0]?.title).toContain("Crowd Target");
  });

  it("penalizes failed objectives through park cash and governance pressure", () => {
    const state = createInitialStateAtDay(0, 0, "Goal Park");
    const beforeBoardPatience = state.player.governance.boardPatience;
    state.player.objectives.activeObjective = createObjective({
      type: "rating_hold",
      title: "Quality Check",
      targetGuests: 0,
      targetRating: 860,
    });

    const result = advancePlayerObjective(state, createSnapshot({ parkRating: 780 }), 7);

    expect(result.cashDelta).toBe(-7_000);
    expect(result.headlines[0]?.severity).toBe("warning");
    expect(state.player.objectives.activeObjective).toBeNull();
    expect(state.player.objectives.failedObjectives).toBe(1);
    expect(state.player.governance.boardPatience).toBeLessThan(beforeBoardPatience);
  });
});
