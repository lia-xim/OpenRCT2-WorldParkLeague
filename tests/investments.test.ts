import { describe, expect, it } from "vitest";
import { buyInvestmentByRivalId, sellInvestmentByRivalId, settleInvestmentsForMonth } from "../src/domain/investments";
import { createInitialState } from "../src/domain/simulation";

describe("investments", () => {
  it("buys a 5 percent stake and updates the portfolio summary", () => {
    const state = createInitialState(0, "Test Park");
    const rival = state.world.rivals[0];
    if (!rival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const result = buyInvestmentByRivalId(state, rival.id, 1_000_000, 0);

    expect(result.ok).toBe(true);
    expect(result.cashDelta).toBeLessThan(0);
    expect(result.state.player.investments).toHaveLength(1);
    expect(result.state.player.investmentSummary.holdings).toBe(1);
  });

  it("supports larger buy lots when cash is available", () => {
    const state = createInitialState(0, "Test Park");
    const rival = state.world.rivals[0];
    if (!rival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const result = buyInvestmentByRivalId(state, rival.id, 2_000_000, 0, 0.1);

    expect(result.ok).toBe(true);
    expect(result.state.player.investments[0]?.share).toBe(0.1);
  });

  it("settles dividends for profitable holdings", () => {
    const state = createInitialState(0, "Test Park");
    const rival = state.world.rivals[0];
    if (!rival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const buyResult = buyInvestmentByRivalId(state, rival.id, 1_000_000, 0);
    if (!buyResult.ok) {
      throw new Error("Expected buy transaction to succeed.");
    }

    const ownedRival = buyResult.state.world.rivals.find((candidate) => candidate.id === rival.id);
    if (!ownedRival) {
      throw new Error("Expected owned rival to be present.");
    }

    ownedRival.finance.monthlyProfit = 120_000;
    const settlement = settleInvestmentsForMonth(buyResult.state, 1);

    expect(settlement.cashDelta).toBeGreaterThan(0);
    expect(settlement.state.player.investmentSummary.totalDividendsReceived).toBeGreaterThan(0);
  });

  it("sells an existing position and removes the holding", () => {
    const state = createInitialState(0, "Test Park");
    const rival = state.world.rivals[0];
    if (!rival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const buyResult = buyInvestmentByRivalId(state, rival.id, 1_000_000, 0);
    if (!buyResult.ok) {
      throw new Error("Expected buy transaction to succeed.");
    }

    const sellResult = sellInvestmentByRivalId(buyResult.state, rival.id);

    expect(sellResult.ok).toBe(true);
    expect(sellResult.cashDelta).toBeGreaterThan(0);
    expect(sellResult.state.player.investments).toHaveLength(0);
  });

  it("supports partial sells and preserves the remainder of the position", () => {
    const state = createInitialState(0, "Test Park");
    const rival = state.world.rivals[0];
    if (!rival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const buyResult = buyInvestmentByRivalId(state, rival.id, 2_000_000, 0, 0.1);
    if (!buyResult.ok) {
      throw new Error("Expected buy transaction to succeed.");
    }

    const partialSell = sellInvestmentByRivalId(buyResult.state, rival.id, 0.05);
    const remaining = partialSell.state.player.investments[0];

    expect(partialSell.ok).toBe(true);
    expect(partialSell.cashDelta).toBeGreaterThan(0);
    expect(remaining?.share).toBe(0.05);
    expect((remaining?.costBasis ?? 0) > 0).toBe(true);
    expect((remaining?.costBasis ?? 0) < (buyResult.state.player.investments[0]?.costBasis ?? 0)).toBe(true);
  });

  it("prevents buying above the per-rival ownership cap", () => {
    let state = createInitialState(0, "Test Park");
    const rival = state.world.rivals[0];
    if (!rival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    for (let index = 0; index < 5; index += 1) {
      const result = buyInvestmentByRivalId(state, rival.id, 2_000_000, index);
      if (!result.ok) {
        throw new Error("Expected capped buy sequence to succeed before the limit.");
      }
      state = result.state;
    }

    const overflow = buyInvestmentByRivalId(state, rival.id, 2_000_000, 6);
    expect(overflow.ok).toBe(false);
  });

  it("fails a purchase when cash is insufficient", () => {
    const state = createInitialState(0, "Test Park");
    const rival = state.world.rivals[0];
    if (!rival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const result = buyInvestmentByRivalId(state, rival.id, 100, 0);
    expect(result.ok).toBe(false);
  });

  it("improves dividend outcomes for larger strategic holdings", () => {
    const state = createInitialState(0, "Test Park");
    const rival = state.world.rivals[0];
    if (!rival) {
      throw new Error("Expected a rival in the seeded state.");
    }

    const smallBuy = buyInvestmentByRivalId(state, rival.id, 2_000_000, 0, 0.05);
    const largeBuy = buyInvestmentByRivalId(state, rival.id, 2_000_000, 0, 0.15);
    if (!smallBuy.ok || !largeBuy.ok) {
      throw new Error("Expected both investment purchases to succeed.");
    }

    const smallRival = smallBuy.state.world.rivals.find((candidate) => candidate.id === rival.id);
    const largeRival = largeBuy.state.world.rivals.find((candidate) => candidate.id === rival.id);
    if (!smallRival || !largeRival) {
      throw new Error("Expected both rivals to be present.");
    }

    smallRival.finance.monthlyProfit = 120_000;
    largeRival.finance.monthlyProfit = 120_000;

    const smallSettlement = settleInvestmentsForMonth(smallBuy.state, 1);
    const largeSettlement = settleInvestmentsForMonth(largeBuy.state, 1);

    expect(largeSettlement.cashDelta).toBeGreaterThan(smallSettlement.cashDelta * 2.9);
  });

  it("converts an absorbed holding into the acquirer so it remains tradable", () => {
    const state = createInitialState(0, "Test Park");
    const seller = state.world.rivals[0];
    const buyer = state.world.rivals[1];
    if (!seller || !buyer) {
      throw new Error("Expected seeded rivals for merger conversion.");
    }

    seller.finance.companyValue = 1_200_000;
    buyer.finance.companyValue = 3_800_000;
    buyer.status.active = true;

    const buyResult = buyInvestmentByRivalId(state, seller.id, 1_000_000, 0, 0.1);
    if (!buyResult.ok) {
      throw new Error("Expected seller investment to succeed.");
    }

    const ownedSeller = buyResult.state.world.rivals.find((candidate) => candidate.id === seller.id);
    if (!ownedSeller) {
      throw new Error("Expected seller rival to exist after purchase.");
    }

    ownedSeller.status.active = false;
    ownedSeller.status.mergedIntoId = buyer.id;

    const settlement = settleInvestmentsForMonth(buyResult.state, 1);
    const converted = settlement.state.player.investments.find(
      (investment) => investment.rivalId === buyer.id
    );

    expect(converted).toBeDefined();
    expect(converted?.share ?? 0).toBeGreaterThan(0);
    expect(
      settlement.notifications.some((item) => item.includes("merged into"))
    ).toBe(true);

    const sellResult = sellInvestmentByRivalId(settlement.state, buyer.id);
    expect(sellResult.ok).toBe(true);
    expect(sellResult.cashDelta).toBeGreaterThan(0);
  });
});
