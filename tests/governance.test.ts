import { describe, expect, it } from "vitest";
import {
  acceptBoardProposal,
  advancePlayerGovernance,
  calculateGovernanceGuestCapImpact,
  evaluateDirectiveScore,
} from "../src/domain/governance";
import { createInitialState } from "../src/domain/simulation";
import type { PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  const snapshot: PlayerSnapshot = {
    parkName: "Governance Park",
    currentMonth: 9,
    currentDay: 1,
    currentDayIndex: 9 * 31,
    parkRating: 860,
    guests: 2100,
    parkValue: 3_527_000,
    companyValue: 3_600_000,
    cash: 88_000,
    bankLoan: 15_000,
    lastMonthRevenue: 84_000,
    lastMonthOperatingCosts: 56_000,
    lastMonthOperatingProfit: 28_000,
    totalRideCount: 16,
    openRideCount: 13,
    stallCount: 6,
    averageRideExcitement: 7.2,
    averageRideSatisfaction: 84,
    totalRideProfit: 96_000,
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

describe("governance", () => {
  it("issues a board mandate and stores governance feedback", () => {
    const state = createInitialState(9, "Governance Park");
    state.player.currentRank = 4;
    state.player.marketShare = 0.065;
    state.world.leaderboard = [
      { rank: 1, parkId: "a", parkName: "A", isPlayer: false, score: 80, scoreDelta: 1.2, marketShare: 0.12, monthlyProfit: 18000, companyValue: 2800000, monthlyVisitors: 2100, debtRatio: 0.21, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "+" },
      { rank: 2, parkId: "b", parkName: "B", isPlayer: false, score: 76, scoreDelta: 0.6, marketShare: 0.1, monthlyProfit: 12000, companyValue: 2400000, monthlyVisitors: 1800, debtRatio: 0.28, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "+" },
      { rank: 3, parkId: "c", parkName: "C", isPlayer: false, score: 74, scoreDelta: -0.4, marketShare: 0.09, monthlyProfit: 9000, companyValue: 2200000, monthlyVisitors: 1650, debtRatio: 0.31, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "=" },
      { rank: 4, parkId: "__player__", parkName: "Governance Park", isPlayer: true, score: 71, scoreDelta: 0.9, marketShare: 0.065, monthlyProfit: 28000, companyValue: 3600000, monthlyVisitors: 2100, debtRatio: 0.0042, regionLabel: "Your park", statusLabel: "Player", trendLabel: "+" },
    ];

    const result = advancePlayerGovernance(state, createSnapshot(), 9);

    expect(state.player.governance.activeDirective).toBe("growth_push");
    expect(state.player.governance.lastReviewSummary).toContain("attendance");
    expect(result.notifications.length).toBeGreaterThan(0);
    expect(result.news.some((item) => item.category === "player")).toBe(true);
  });

  it("applies stronger pressure to dominant parks through governance impact", () => {
    const state = createInitialState(9, "Governance Park");
    state.player.currentRank = 1;
    state.player.marketShare = 0.18;
    state.player.monthsAtRankOne = 8;
    state.world.leaderboard = new Array(12).fill(null).map((_, index) => ({
      rank: index + 1,
      parkId: index === 0 ? "__player__" : `rival-${index}`,
      parkName: index === 0 ? "Governance Park" : `Rival ${index}`,
      isPlayer: index === 0,
      score: 90 - index,
      scoreDelta: index === 0 ? 1.2 : 0.4,
      marketShare: index === 0 ? 0.18 : 0.82 / 11,
      monthlyProfit: index === 0 ? 32000 : 12000 - index * 400,
      companyValue: index === 0 ? 3600000 : 2200000 - index * 45000,
      monthlyVisitors: index === 0 ? 2100 : 1400 - index * 20,
      debtRatio: index === 0 ? 0.0042 : 0.22 + index * 0.01,
      regionLabel: index === 0 ? "Your park" : "Europe",
      statusLabel: index === 0 ? "Player" : "Stable",
      trendLabel: index === 0 ? "+" : "=",
    }));

    const result = advancePlayerGovernance(state, createSnapshot(), 9);

    expect(state.player.governance.guestCapImpact).toBeLessThan(1);
    expect(result.notifications.some((item) => item.includes("Board mandate"))).toBe(true);
  });

  it("scores financial directives higher for profitable low-debt parks", () => {
    const state = createInitialState(9, "Governance Park");
    const strongScore = evaluateDirectiveScore(createSnapshot(), state, "profit_focus");
    const weakScore = evaluateDirectiveScore(
      createSnapshot({
        cash: 5_000,
        bankLoan: 1_000_000,
        totalRideProfit: 8_000,
        companyValue: 1_200_000,
      }),
      state,
      "profit_focus"
    );

    expect(strongScore).toBeGreaterThan(weakScore);
    expect(calculateGovernanceGuestCapImpact(state.player.governance, 0)).toBeGreaterThan(0.95);
  });

  it("creates an equity-raise vote and applies dilution plus program effects when approved", () => {
    const snapshot = createSnapshot({
      cash: 26_000,
      bankLoan: 12_000,
      companyValue: 2_200_000,
      parkRating: 845,
      averageRideSatisfaction: 84,
    });
    const state = createInitialState(9, "Governance Park");
    state.player.currentRank = 5;
    state.player.marketShare = 0.072;
    state.world.leaderboard = [
      { rank: 1, parkId: "a", parkName: "A", isPlayer: false, score: 84, scoreDelta: 0.7, marketShare: 0.13, monthlyProfit: 19000, companyValue: 2900000, monthlyVisitors: 2400, debtRatio: 0.18, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "+" },
      { rank: 2, parkId: "b", parkName: "B", isPlayer: false, score: 80, scoreDelta: 0.4, marketShare: 0.11, monthlyProfit: 14000, companyValue: 2650000, monthlyVisitors: 2200, debtRatio: 0.21, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "+" },
      { rank: 3, parkId: "c", parkName: "C", isPlayer: false, score: 78, scoreDelta: -0.2, marketShare: 0.09, monthlyProfit: 10500, companyValue: 2350000, monthlyVisitors: 1850, debtRatio: 0.24, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "=" },
      { rank: 4, parkId: "d", parkName: "D", isPlayer: false, score: 75, scoreDelta: 0.1, marketShare: 0.08, monthlyProfit: 8900, companyValue: 2180000, monthlyVisitors: 1710, debtRatio: 0.28, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "=" },
      { rank: 5, parkId: "__player__", parkName: "Governance Park", isPlayer: true, score: 73, scoreDelta: 0.8, marketShare: 0.072, monthlyProfit: 28000, companyValue: 2200000, monthlyVisitors: 2100, debtRatio: 0.0054, regionLabel: "Your park", statusLabel: "Player", trendLabel: "+" },
    ];

    const result = advancePlayerGovernance(state, snapshot, 9);
    const proposal = state.player.governance.pendingProposals[0];

    expect(result.notifications.some((item) => item.includes("Board vote ready"))).toBe(true);
    expect(proposal?.type).toBe("structured_equity_raise");

    const decision = acceptBoardProposal(state, snapshot, proposal!.id);

    expect(decision.ok).toBe(true);
    expect(decision.cashDelta).toBeGreaterThan(0);
    expect(decision.state.player.equity.outsideOwnedShare).toBeGreaterThan(0);
    expect(decision.state.player.equity.totalCashRaised).toBeGreaterThan(0);
    expect(decision.state.player.governance.activePrograms.length).toBe(1);
  });

  it("creates a debt-repair vote for leveraged parks and returns a loan paydown delta", () => {
    const snapshot = createSnapshot({
      cash: 54_000,
      bankLoan: 760_000,
      companyValue: 2_150_000,
      parkValue: 2_856_000,
      totalRideProfit: 88_000,
    });
    const state = createInitialState(9, "Governance Park");
    state.player.currentRank = 3;
    state.player.marketShare = 0.11;
    state.world.leaderboard = [
      { rank: 1, parkId: "a", parkName: "A", isPlayer: false, score: 88, scoreDelta: 0.8, marketShare: 0.16, monthlyProfit: 24000, companyValue: 3100000, monthlyVisitors: 2500, debtRatio: 0.17, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "+" },
      { rank: 2, parkId: "b", parkName: "B", isPlayer: false, score: 84, scoreDelta: 0.3, marketShare: 0.13, monthlyProfit: 16000, companyValue: 2800000, monthlyVisitors: 2200, debtRatio: 0.2, regionLabel: "Europe", statusLabel: "Stable", trendLabel: "=" },
      { rank: 3, parkId: "__player__", parkName: "Governance Park", isPlayer: true, score: 78, scoreDelta: 0.6, marketShare: 0.11, monthlyProfit: 28000, companyValue: 2150000, monthlyVisitors: 2100, debtRatio: 0.353, regionLabel: "Your park", statusLabel: "Player", trendLabel: "+" },
    ];

    advancePlayerGovernance(state, snapshot, 9);
    const proposal = state.player.governance.pendingProposals[0];

    expect(proposal?.type).toBe("debt_repayment");

    const decision = acceptBoardProposal(state, snapshot, proposal!.id);

    expect(decision.ok).toBe(true);
    expect(decision.cashDelta).toBeLessThan(0);
    expect(decision.loanDelta).toBeLessThan(0);
  });
});
