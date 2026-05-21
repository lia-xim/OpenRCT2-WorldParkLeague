import { describe, expect, it } from "vitest";
import {
  acceptEquityOffer,
  advancePlayerEquityMarket,
  declineEquityOffer,
  estimateBuybackPrice,
  repurchaseOutsideEquity,
} from "../src/domain/equity";
import { createInitialState, simulateMonth } from "../src/domain/simulation";
import type { PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  const snapshot: PlayerSnapshot = {
    parkName: "Equity Park",
    currentMonth: 0,
    currentDay: 1,
    currentDayIndex: 0,
    parkRating: 860,
    guests: 1600,
    parkValue: 2_720_000,
    companyValue: 2_800_000,
    cash: 95_000,
    bankLoan: 15_000,
    lastMonthRevenue: 74_000,
    lastMonthOperatingCosts: 48_000,
    lastMonthOperatingProfit: 26_000,
    totalRideCount: 14,
    openRideCount: 11,
    stallCount: 6,
    averageRideExcitement: 6.9,
    averageRideSatisfaction: 81,
    totalRideProfit: 92_000,
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

describe("equity market", () => {
  it("adds structural market growth over time", () => {
    let state = createInitialState(0, "Growth Park");
    const snapshot = createSnapshot();

    for (let month = 0; month < 8; month += 1) {
      state = simulateMonth(state, snapshot, month).nextState;
    }

    expect(state.world.structuralGrowthIndex).toBeGreaterThan(1.06);
  });

  it("can accept and decline player equity offers", () => {
    const state = createInitialState(0, "Offer Park");
    state.player.equity.activeOffers.push({
      id: "offer-a",
      month: 0,
      buyerName: "Northstar Capital",
      buyerType: "institutional",
      buyerRivalId: null,
      share: 0.05,
      price: 180_000,
      premiumRate: 0.04,
      expiresAtMonth: 2,
    });
    state.player.equity.activeOffers.push({
      id: "offer-b",
      month: 0,
      buyerName: "Meridian Family Office",
      buyerType: "family_office",
      buyerRivalId: null,
      share: 0.05,
      price: 175_000,
      premiumRate: 0.03,
      expiresAtMonth: 2,
    });

    const accepted = acceptEquityOffer(state, "offer-a");
    expect(accepted.ok).toBe(true);
    expect(accepted.cashDelta).toBe(180_000);
    expect(accepted.state.player.equity.outsideOwnedShare).toBe(0.05);
    expect(accepted.state.player.equity.activeOffers).toHaveLength(1);

    const declined = declineEquityOffer(accepted.state, "offer-b");
    expect(declined.ok).toBe(true);
    expect(declined.state.player.equity.activeOffers).toHaveLength(0);
    expect(declined.state.player.equity.lastDeclinedOfferSummary).toContain("declined");
  });

  it("can buy back previously sold outside equity", () => {
    const state = createInitialState(0, "Buyback Park");
    state.player.equity.outsideOwnedShare = 0.1;
    const snapshot = createSnapshot({ cash: 400_000, companyValue: 900_000 });

    const estimated = estimateBuybackPrice(state, snapshot, 0.05);
    const result = repurchaseOutsideEquity(state, snapshot, 0.05);

    expect(result.ok).toBe(true);
    expect(result.cashDelta).toBe(-estimated);
    expect(result.state.player.equity.outsideOwnedShare).toBe(0.05);
    expect(result.state.player.equity.lastBuybackSummary).toContain("5%");
  });

  it("can generate capital offers during monthly advancement", () => {
    const state = createInitialState(0, "Offer Generator");
    const snapshot = createSnapshot();

    for (let month = 0; month < 12; month += 1) {
      advancePlayerEquityMarket(state, snapshot, month);
      if (state.player.equity.activeOffers.length > 0) {
        break;
      }
    }

    expect(state.player.equity.activeOffers.length).toBeGreaterThan(0);
    const expiry = state.player.equity.activeOffers[0]?.expiresAtMonth ?? 0;
    expect(expiry).toBeGreaterThanOrEqual(2);
  });
});
