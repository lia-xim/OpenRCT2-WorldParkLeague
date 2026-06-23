import { describe, expect, it } from "vitest";
import { advanceExperienceForDays, markExperienceEventPresented } from "../src/domain/experience";
import { createInitialStateAtDay } from "../src/domain/simulation";
import type { PlayerSnapshot } from "../src/types";

function createSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    parkName: "Review Park",
    currentMonth: 0,
    currentDay: 6,
    currentDayIndex: 5,
    parkRating: 910,
    guests: 2_200,
    parkValue: 2_900_000,
    companyValue: 2_950_000,
    cash: 120_000,
    bankLoan: 70_000,
    lastMonthRevenue: 92_000,
    lastMonthOperatingCosts: 54_000,
    lastMonthOperatingProfit: 38_000,
    totalRideCount: 16,
    openRideCount: 14,
    stallCount: 6,
    averageRideExcitement: 7.4,
    averageRideSatisfaction: 88,
    totalRideProfit: 130_000,
    ...overrides,
  };
}

describe("park experience events", () => {
  it("resolves a positive VIP critic visit into park cash and a short reward", () => {
    const state = createInitialStateAtDay(0, 0, "Review Park");
    state.player.experience.activeEvent = {
      id: "vip_critic:test",
      type: "vip_critic",
      title: "VIP Critic Visit",
      summary: "A named critic enters the park.",
      startedAtDayIndex: 0,
      daysRemaining: 1,
      guestCapBonus: 0,
      scoreBonus: 0,
      momentumBonus: 0.2,
      visualIntensity: 5,
      guestWaveSize: 1,
      reviewerName: "Mara Voss, Park Critic",
      reviewerGuestId: null,
    };

    const result = advanceExperienceForDays(state, createSnapshot(), 5, 1);

    expect(result.cashDelta).toBeGreaterThan(0);
    expect(result.headlines[0]?.severity).toBe("success");
    expect(state.player.experience.activeEvent).toBeNull();
    expect(state.player.experience.completedReviews).toBe(1);
    expect(state.player.experience.positiveReviews).toBe(1);
    expect(state.player.prestige.activeRewards[0]?.title).toContain("Positive Review");
  });

  it("turns a bad VIP critic visit into a real penalty", () => {
    const state = createInitialStateAtDay(0, 0, "Review Park");
    const beforeConfidence = state.player.governance.investorConfidence;
    state.player.experience.activeEvent = {
      id: "vip_critic:bad",
      type: "vip_critic",
      title: "VIP Critic Visit",
      summary: "A named critic enters the park.",
      startedAtDayIndex: 0,
      daysRemaining: 1,
      guestCapBonus: 0,
      scoreBonus: 0,
      momentumBonus: 0.2,
      visualIntensity: 5,
      guestWaveSize: 1,
      reviewerName: "Mara Voss, Park Critic",
      reviewerGuestId: null,
    };

    const result = advanceExperienceForDays(
      state,
      createSnapshot({
        parkRating: 560,
        averageRideSatisfaction: 42,
        averageRideExcitement: 3.6,
        lastMonthOperatingProfit: -8_000,
        openRideCount: 5,
        stallCount: 1,
      }),
      5,
      1
    );

    expect(result.cashDelta).toBeLessThan(0);
    expect(result.headlines[0]?.severity).toBe("warning");
    expect(state.player.experience.completedReviews).toBe(1);
    expect(state.player.governance.investorConfidence).toBeLessThan(beforeConfidence);
  });

  it("tracks presented relevant guests so the UI can locate active critics", () => {
    const state = createInitialStateAtDay(0, 0, "Review Park");
    state.player.experience.activeEvent = {
      id: "vip_critic:42",
      type: "vip_critic",
      title: "VIP Critic Visit",
      summary: "A named critic enters the park.",
      startedAtDayIndex: 42,
      daysRemaining: 5,
      guestCapBonus: 0,
      scoreBonus: 0,
      momentumBonus: 0.2,
      visualIntensity: 5,
      guestWaveSize: 1,
      reviewerName: "Mara Voss, Park Critic",
      reviewerGuestId: null,
    };

    markExperienceEventPresented(state, "vip_critic:42", [
      {
        id: "vip_critic:42:0",
        guestId: 123,
        name: "Mara Voss, Park Critic",
        role: "critic",
        eventId: "vip_critic:42",
        eventTitle: "VIP Critic Visit",
        arrivedAtDayIndex: 42,
      },
    ]);

    expect(state.player.experience.lastPresentedEventId).toBe("vip_critic:42");
    expect(state.player.experience.activeEvent?.reviewerGuestId).toBe(123);
    expect(state.player.experience.relevantGuests).toHaveLength(1);
    expect(state.player.experience.relevantGuests[0]?.role).toBe("critic");
  });
});
