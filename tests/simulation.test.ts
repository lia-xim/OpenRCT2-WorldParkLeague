import { describe, expect, it } from "vitest";
import { createInitialState, simulateLivePulse, simulateMonth } from "../src/domain/simulation";
import { buyInvestmentByRivalId } from "../src/domain/investments";
import type { PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  const snapshot: PlayerSnapshot = {
    parkName: "Test Park",
    currentMonth: 0,
    currentDay: 1,
    currentDayIndex: 0,
    parkRating: 850,
    guests: 1450,
    parkValue: 2_345_000,
    companyValue: 2_400_000,
    cash: 75_000,
    bankLoan: 20_000,
    lastMonthRevenue: 62_000,
    lastMonthOperatingCosts: 43_000,
    lastMonthOperatingProfit: 19_000,
    totalRideCount: 12,
    openRideCount: 9,
    stallCount: 5,
    averageRideExcitement: 6.7,
    averageRideSatisfaction: 78,
    totalRideProfit: 80_000,
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

describe("simulateMonth", () => {
  it("advances the saved month and produces a leaderboard", () => {
    const initial = createInitialState(0, "Test Park");
    const result = simulateMonth(initial, createSnapshot(), 0);

    expect(result.nextState.lastSimulatedMonth).toBe(0);
    expect(result.nextState.world.leaderboard.length).toBeGreaterThan(5);
    expect(result.nextState.player.currentRank).not.toBeNull();
    expect(result.nextState.world.history.__player__?.length ?? 0).toBeGreaterThan(0);
  });

  it("keeps the guest cap modifier within configured bounds", () => {
    const initial = createInitialState(0, "Test Park");
    const result = simulateMonth(
      initial,
      createSnapshot({
        guests: 3200,
        companyValue: 4_500_000,
        averageRideExcitement: 7.8,
        averageRideSatisfaction: 91,
      }),
      0
    );

    expect(result.nextState.player.guestCapModifier).toBeGreaterThanOrEqual(0.75);
    expect(result.nextState.player.guestCapModifier).toBeLessThanOrEqual(15);
  });

  it("bankrupts a rival in severe distress and removes it from active competition", () => {
    const initial = createInitialState(0, "Test Park");
    const target = initial.world.rivals[0];
    if (!target) {
      throw new Error("Expected a rival in the seeded state.");
    }

    target.finance.companyValue = 350_000;
    target.finance.debt = 1_100_000;
    target.finance.cashReserve = 1_000;
    target.finance.monthlyProfit = -60_000;
    target.stats.prestige = 22;
    target.stats.operations = 24;
    target.stats.marketing = 20;
    target.stats.innovation = 21;
    target.stats.guestAppeal = 23;
    target.risk = 88;
    target.momentum = -9;
    target.status.monthsInSlump = 8;
    target.status.distressLevel = 2;

    const result = simulateMonth(initial, createSnapshot(), 0);
    const updated = result.nextState.world.rivals.find((rival) => rival.id === target.id);

    expect(updated?.status.active).toBe(false);
    expect(
      result.headlines.some((headline) => headline.headline.includes("bankruptcy"))
    ).toBe(true);
  });

  it("settles an owned position when a rival goes bankrupt", () => {
    const initial = createInitialState(0, "Test Park");
    const target = initial.world.rivals[0];
    if (!target) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const buyResult = buyInvestmentByRivalId(initial, target.id, 1_000_000, 0);
    if (!buyResult.ok) {
      throw new Error("Expected initial investment purchase to succeed.");
    }

    const ownedTarget = buyResult.state.world.rivals.find((rival) => rival.id === target.id);
    if (!ownedTarget) {
      throw new Error("Expected owned rival to still exist.");
    }

    ownedTarget.finance.companyValue = 350_000;
    ownedTarget.finance.debt = 1_100_000;
    ownedTarget.finance.cashReserve = 1_000;
    ownedTarget.finance.monthlyProfit = -60_000;
    ownedTarget.stats.prestige = 22;
    ownedTarget.stats.operations = 24;
    ownedTarget.stats.marketing = 20;
    ownedTarget.stats.innovation = 21;
    ownedTarget.stats.guestAppeal = 23;
    ownedTarget.risk = 88;
    ownedTarget.momentum = -9;
    ownedTarget.status.monthsInSlump = 8;
    ownedTarget.status.distressLevel = 2;

    const result = simulateMonth(buyResult.state, createSnapshot(), 0);

    expect(result.playerCashDelta).toBeGreaterThan(0);
    expect(result.playerNotifications.length).toBeGreaterThan(0);
    expect(result.nextState.player.investments).toHaveLength(0);
  });

  it("lets hot regions outperform pressured regional markets", () => {
    const boosted = createInitialState(0, "Test Park");
    const pressured = createInitialState(0, "Test Park");
    const target = boosted.world.rivals[0];
    const comparisonTarget = pressured.world.rivals[0];
    if (!target || !comparisonTarget) {
      throw new Error("Expected rivals in the seeded state.");
    }

    const boostedRegion = boosted.world.regionMarkets[target.region];
    const pressuredRegion = pressured.world.regionMarkets[comparisonTarget.region];
    boostedRegion.demandModifier = 1.18;
    boostedRegion.tourismModifier = 1.16;
    boostedRegion.competitionModifier = 0.88;
    pressuredRegion.demandModifier = 0.86;
    pressuredRegion.tourismModifier = 0.88;
    pressuredRegion.competitionModifier = 1.14;

    const boostedResult = simulateMonth(boosted, createSnapshot(), 0);
    const pressuredResult = simulateMonth(pressured, createSnapshot(), 0);
    const boostedRival = boostedResult.nextState.world.rivals.find((rival) => rival.id === target.id);
    const pressuredRival = pressuredResult.nextState.world.rivals.find(
      (rival) => rival.id === comparisonTarget.id
    );

    expect(boostedRival?.finance.monthlyRevenue ?? 0).toBeGreaterThan(
      pressuredRival?.finance.monthlyRevenue ?? 0
    );
    expect(boostedResult.nextState.world.globalDemand).toBeGreaterThan(
      pressuredResult.nextState.world.globalDemand
    );
  });

  it("applies multi-month strategy programs to rival operations", () => {
    const initial = createInitialState(0, "Test Park");
    const target = initial.world.rivals[0];
    if (!target) {
      throw new Error("Expected a rival in the seeded state.");
    }

    target.status.strategyFocus = "turnaround";
    target.status.strategyShiftMonthsRemaining = 2;
    target.stats.operations = 52;
    target.risk = 72;
    target.finance.cashReserve = 120_000;
    target.finance.debt = 600_000;

    const result = simulateMonth(initial, createSnapshot(), 0);
    const updated = result.nextState.world.rivals.find((rival) => rival.id === target.id);

    expect(updated?.status.strategyShiftMonthsRemaining).toBe(1);
    expect((updated?.stats.operations ?? 0) > 52).toBe(true);
    expect((updated?.risk ?? 999) < 72).toBe(true);
  });

  it("runs live pulses between monthly settlements and refreshes standings", () => {
    const initial = createInitialState(0, "Test Park");
    const monthly = simulateMonth(initial, createSnapshot(), 0).nextState;
    const priorHistoryLength = monthly.world.history.__player__?.length ?? 0;
    const pulseSnapshot = createSnapshot({
      currentDay: 8,
      currentDayIndex: 7,
      guests: 1_980,
      cash: 88_000,
      companyValue: 2_650_000,
      parkValue: 2_582_000,
      averageRideExcitement: 7.1,
      averageRideSatisfaction: 82,
    });

    const result = simulateLivePulse(monthly, pulseSnapshot, 7);

    expect(result.nextState.lastLivePulseDayIndex).toBe(7);
    expect(result.nextState.world.leaderboard.length).toBeGreaterThan(5);
    expect(result.nextState.player.score).not.toBe(monthly.player.score);
    expect(result.nextState.player.liveMomentum).not.toBeNaN();
    expect(result.nextState.player.guestCapModifier).toBeGreaterThanOrEqual(0.75);
    expect(result.nextState.player.guestCapModifier).toBeLessThanOrEqual(15);
    expect(result.nextState.world.history.__player__?.length ?? 0).toBeGreaterThan(priorHistoryLength);
    expect(result.nextState.world.history.__player__?.at(-1)?.dayIndex).toBe(7);
    expect(result.nextState.world.history.__player__?.at(-1)?.momentum).toBe(
      result.nextState.player.liveMomentum
    );
  });

  it("keeps live pulses daily but gates live event windows to the configured cadence", () => {
    const initial = createInitialState(0, "Test Park");
    const monthly = simulateMonth(initial, createSnapshot(), 0).nextState;

    const dayOne = simulateLivePulse(
      monthly,
      createSnapshot({ currentDay: 2, currentDayIndex: 1 }),
      1
    );
    const daySeven = simulateLivePulse(
      monthly,
      createSnapshot({ currentDay: 8, currentDayIndex: 7 }),
      7
    );

    expect(dayOne.nextState.lastLivePulseDayIndex).toBe(1);
    expect(dayOne.nextState.lastLiveEventDayIndex).toBe(0);
    expect(daySeven.nextState.lastLiveEventDayIndex).toBe(7);
  });

  it("gives rivals more differentiated live movement under the same macro pulse", () => {
    const initial = createInitialState(0, "Test Park");
    const monthly = simulateMonth(initial, createSnapshot(), 0).nextState;
    const pulse = simulateLivePulse(
      monthly,
      createSnapshot({ currentDay: 3, currentDayIndex: 2 }),
      2
    ).nextState;

    const deltas = pulse.world.leaderboard
      .filter((entry) => !entry.isPlayer)
      .slice(0, 12)
      .map((entry) => entry.scoreDelta.toFixed(1));

    expect(new Set(deltas).size).toBeGreaterThan(5);
  });

  it("grants a strong but controlled spotlight guest surge when the player takes the monthly top spot", () => {
    const initial = createInitialState(0, "Test Park");
    for (const rival of initial.world.rivals) {
      rival.stats.prestige = 28;
      rival.stats.operations = 30;
      rival.stats.marketing = 27;
      rival.stats.innovation = 26;
      rival.stats.guestAppeal = 29;
      rival.finance.companyValue = 520_000;
      rival.finance.monthlyRevenue = 22_000;
      rival.finance.monthlyProfit = 2_000;
      rival.finance.cashReserve = 18_000;
      rival.momentum = -3;
    }

    const result = simulateMonth(
      initial,
      createSnapshot({
        parkRating: 980,
        guests: 4_200,
        companyValue: 5_400_000,
        parkValue: 5_345_000,
        cash: 95_000,
        lastMonthRevenue: 120_000,
        lastMonthOperatingProfit: 54_000,
        totalRideCount: 20,
        openRideCount: 17,
        stallCount: 8,
        averageRideExcitement: 8.5,
        averageRideSatisfaction: 93,
      }),
      0
    );

    expect(result.nextState.player.currentRank).toBe(1);
    expect(result.nextState.world.spotlightParkId).toBe("__player__");
    expect(result.nextState.world.spotlightParkName).toBe("Test Park");
    expect(result.nextState.player.guestCapModifier).toBeGreaterThan(2);
    expect(result.nextState.player.guestCapModifier).toBeLessThan(6);
    expect(
      result.headlines.some((headline) => headline.headline.includes("World Spotlight"))
    ).toBe(true);
  });

  it("assigns supporting random boosts to a top chaser and a mid-table park", () => {
    const initial = createInitialState(0, "Test Park");
    const monthly = simulateMonth(initial, createSnapshot(), 0).nextState;
    const result = simulateLivePulse(
      monthly,
      createSnapshot({ currentDay: 8, currentDayIndex: 7 }),
      7
    );

    const featuredEntry = result.nextState.world.leaderboard.find(
      (entry) => entry.parkId === result.nextState.world.featuredParkId
    );
    const breakoutEntry = result.nextState.world.leaderboard.find(
      (entry) => entry.parkId === result.nextState.world.breakoutParkId
    );

    expect(result.nextState.world.featuredDaysRemaining).toBe(6);
    expect(result.nextState.world.breakoutDaysRemaining).toBe(6);
    expect(featuredEntry?.rank ?? 0).toBeGreaterThanOrEqual(2);
    expect(featuredEntry?.rank ?? 999).toBeLessThanOrEqual(10);
    expect(breakoutEntry?.rank ?? 0).toBeGreaterThanOrEqual(11);
    expect(breakoutEntry?.rank ?? 999).toBeLessThanOrEqual(20);
  });

  it("keeps debug-forced featured and breakout boosts locked onto the player through a live event cycle", () => {
    const initial = createInitialState(0, "Test Park");
    const monthly = simulateMonth(initial, createSnapshot(), 0).nextState;

    monthly.world.featuredParkId = "__player__";
    monthly.world.featuredParkName = "Test Park";
    monthly.world.featuredDaysRemaining = 7;
    monthly.world.featuredDebugOverrideParkId = "__player__";
    monthly.world.featuredDebugOverrideDaysRemaining = 7;

    monthly.world.breakoutParkId = "__player__";
    monthly.world.breakoutParkName = "Test Park";
    monthly.world.breakoutDaysRemaining = 7;
    monthly.world.breakoutDebugOverrideParkId = "__player__";
    monthly.world.breakoutDebugOverrideDaysRemaining = 7;

    const pulse = simulateLivePulse(
      monthly,
      createSnapshot({ currentDay: 8, currentDayIndex: 7 }),
      7
    ).nextState;

    expect(pulse.world.featuredParkId).toBe("__player__");
    expect(pulse.world.breakoutParkId).toBe("__player__");
    expect(pulse.world.featuredDebugOverrideDaysRemaining).toBeLessThan(7);
    expect(pulse.world.breakoutDebugOverrideDaysRemaining).toBeLessThan(7);
  });
});
