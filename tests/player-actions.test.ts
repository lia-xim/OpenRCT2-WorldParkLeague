import { describe, expect, it } from "vitest";
import { createInitialState, simulateLivePulse, simulateMonth } from "../src/domain/simulation";
import { launchPlayerLeagueAction } from "../src/domain/playerActions";
import type { PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  const snapshot: PlayerSnapshot = {
    parkName: "Action Park",
    currentMonth: 0,
    currentDay: 1,
    currentDayIndex: 0,
    parkRating: 830,
    guests: 1320,
    parkValue: 1_980_000,
    companyValue: 2_020_000,
    cash: 90_000,
    bankLoan: 45_000,
    lastMonthRevenue: 58_000,
    lastMonthOperatingCosts: 41_000,
    lastMonthOperatingProfit: 17_000,
    totalRideCount: 11,
    openRideCount: 9,
    stallCount: 4,
    averageRideExcitement: 6.4,
    averageRideSatisfaction: 77,
    totalRideProfit: 74_000,
    ...overrides,
  };

  if (overrides.parkValue === undefined) {
    snapshot.parkValue = Math.max(0, snapshot.companyValue - snapshot.cash + snapshot.bankLoan);
  }
  if (overrides.companyValue === undefined) {
    snapshot.companyValue = Math.max(0, snapshot.parkValue + snapshot.cash - snapshot.bankLoan);
  }

  return snapshot;
}

describe("player league actions", () => {
  it("launches a short-term action and stores it on the player state", () => {
    const state = createInitialState(0, "Action Park");
    const result = launchPlayerLeagueAction(state, createSnapshot(), "pr_blitz");

    expect(result.ok).toBe(true);
    expect(result.cashDelta).toBeLessThan(0);
    expect(result.state.player.actions.activeActions).toHaveLength(1);
    expect(result.state.player.actions.activeActions[0]?.type).toBe("pr_blitz");
  });

  it("lets active actions influence live pulses", () => {
    const initial = createInitialState(0, "Action Park");
    const monthly = simulateMonth(initial, createSnapshot(), 0).nextState;
    const baselinePulse = simulateLivePulse(
      monthly,
      createSnapshot({ currentDay: 2, currentDayIndex: 1 }),
      1
    ).nextState;
    const withAction = launchPlayerLeagueAction(monthly, createSnapshot(), "guest_festival");
    if (!withAction.ok) {
      throw new Error("Expected guest festival launch to succeed.");
    }

    const pulsed = simulateLivePulse(
      withAction.state,
      createSnapshot({ currentDay: 2, currentDayIndex: 1 }),
      1
    ).nextState;

    expect(pulsed.player.actions.activeActions[0]?.daysRemaining).toBeGreaterThan(0);
    expect(pulsed.player.liveMomentum).toBeGreaterThan(baselinePulse.player.liveMomentum);
  });
});
