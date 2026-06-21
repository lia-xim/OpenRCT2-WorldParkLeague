import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/domain/simulation";
import {
  createInitialWatchlistState,
  getAlertPriorityLabel,
  getLocalMarketSummary,
  isImportantAlert,
  toggleWatchedRival,
  updateWatchlistForCycle,
} from "../src/domain/watchlist";
import type { LeaderboardEntry, RivalPark, WorldParkLeagueState } from "../src/types";

describe("watchlist and local rivals", () => {
  it("adds and removes watched rivals cleanly", () => {
    const state = createInitialState(0, "Watch Park");
    state.player.watchlist = createInitialWatchlistState();

    const addResult = toggleWatchedRival(state, "rival-1");
    expect(addResult.ok).toBe(true);
    expect(addResult.state.player.watchlist.watchedRivalIds).toContain("rival-1");

    const removeResult = toggleWatchedRival(state, "rival-1");
    expect(removeResult.ok).toBe(true);
    expect(removeResult.state.player.watchlist.watchedRivalIds).not.toContain("rival-1");
  });

  it("selects the closest rivals as the local circuit", () => {
    const previous = createInitialState(0, "Previous Park");
    const next = createInitialState(0, "Next Park");

    next.world.leaderboard = createLeaderboard(next, {
      playerRank: 10,
      rivalRanks: {
        "rival-1": 8,
        "rival-2": 9,
        "rival-3": 11,
        "rival-4": 14,
      },
    });
    next.player.currentRank = 10;
    next.player.watchlist = createInitialWatchlistState();

    updateWatchlistForCycle(previous, next, 1, 0);

    expect(next.player.watchlist.focusRivalIds).toEqual(["rival-2", "rival-3", "rival-1"]);
  });

  it("creates an alert when a watched rival overtakes the player", () => {
    const previous = createInitialState(0, "Prev Park");
    const next = createInitialState(0, "Next Park");

    previous.player.watchlist = {
      watchedRivalIds: ["rival-1"],
      focusRivalIds: ["rival-1", "rival-2", "rival-3"],
      alerts: [],
      lastAlertSummary: null,
    };
    next.player.watchlist = {
      watchedRivalIds: ["rival-1"],
      focusRivalIds: ["rival-1", "rival-2", "rival-3"],
      alerts: [],
      lastAlertSummary: null,
    };

    previous.world.leaderboard = createLeaderboard(previous, {
      playerRank: 8,
      rivalRanks: {
        "rival-1": 9,
        "rival-2": 7,
        "rival-3": 10,
      },
    });
    previous.player.currentRank = 8;

    next.world.leaderboard = createLeaderboard(next, {
      playerRank: 9,
      rivalRanks: {
        "rival-1": 8,
        "rival-2": 7,
        "rival-3": 10,
      },
    });
    next.player.currentRank = 9;

    const notifications = updateWatchlistForCycle(previous, next, 3, 0);

    expect(notifications.some((message) => message.includes("moved ahead of you"))).toBe(true);
    expect(next.player.watchlist.alerts.some((alert) => alert.type === "rank_overtake")).toBe(true);
  });

  it("suppresses repeated alert spam inside the cooldown window", () => {
    const previous = createInitialState(0, "Prev Park");
    const next = createInitialState(0, "Next Park");

    previous.player.watchlist = {
      watchedRivalIds: ["rival-1"],
      focusRivalIds: ["rival-1", "rival-2", "rival-3"],
      alerts: [],
      lastAlertSummary: null,
    };
    next.player.watchlist = {
      watchedRivalIds: ["rival-1"],
      focusRivalIds: ["rival-1", "rival-2", "rival-3"],
      alerts: [
        {
          id: "old-alert",
          dayIndex: 2,
          month: 0,
          rivalId: "rival-1",
          parkName: "rival-1",
          type: "rank_overtake",
          severity: "warning",
          title: "rival-1 moved ahead of you in the rankings.",
          detail: "Legacy alert still inside the cooldown window.",
        },
      ],
      lastAlertSummary: null,
    };

    previous.world.leaderboard = createLeaderboard(previous, {
      playerRank: 8,
      rivalRanks: {
        "rival-1": 9,
        "rival-2": 7,
        "rival-3": 10,
      },
    });
    previous.player.currentRank = 8;

    next.world.leaderboard = createLeaderboard(next, {
      playerRank: 9,
      rivalRanks: {
        "rival-1": 8,
        "rival-2": 7,
        "rival-3": 10,
      },
    });
    next.player.currentRank = 9;

    const notifications = updateWatchlistForCycle(previous, next, 5, 0);

    expect(notifications).toEqual([]);
    expect(next.player.watchlist.alerts).toHaveLength(1);
  });

  it("summarizes the local market circuit around the player", () => {
    const state = createInitialState(0, "Local Park");
    state.player.watchlist = {
      watchedRivalIds: [],
      focusRivalIds: ["rival-1", "rival-2", "rival-3"],
      alerts: [],
      lastAlertSummary: null,
    };
    state.world.leaderboard = createLeaderboard(state, {
      playerRank: 12,
      rivalRanks: {
        "rival-1": 10,
        "rival-2": 11,
        "rival-3": 13,
      },
    }).map((entry) => {
      const marketShares: Record<string, number> = {
        __player__: 0.06,
        "rival-1": 0.075,
        "rival-2": 0.082,
        "rival-3": 0.053,
      };

      return {
        ...entry,
        marketShare: marketShares[entry.parkId] ?? entry.marketShare,
      };
    });
    state.player.currentRank = 12;

    const summary = getLocalMarketSummary(state);

    expect(summary).not.toBeNull();
    expect(summary?.circuitSize).toBe(4);
    expect(summary?.playerCircuitRank).toBe(3);
    expect(summary?.leaderId).toBe("rival-2");
    expect(summary?.playerLeads).toBe(false);
    expect(summary?.shareGapToLeader).toBeCloseTo(0.022, 5);
    expect(summary?.playerShareOfCircuit).toBeCloseTo(0.06 / 0.27, 5);
  });

  it("classifies important alerts for quieter watchlist filtering", () => {
    expect(
      isImportantAlert({
        id: "warn",
        dayIndex: 10,
        month: 0,
        rivalId: "rival-1",
        parkName: "Rival One",
        type: "distress",
        severity: "warning",
        title: "Rival One is under distress.",
        detail: "Pressure is building.",
      })
    ).toBe(true);

    expect(
      isImportantAlert({
        id: "info",
        dayIndex: 12,
        month: 0,
        rivalId: "rival-2",
        parkName: "Rival Two",
        type: "focus_assigned",
        severity: "info",
        title: "Rival Two is now a local rival.",
        detail: "This is mainly a routing note.",
      })
    ).toBe(false);

    expect(
      getAlertPriorityLabel({
        id: "success",
        dayIndex: 14,
        month: 0,
        rivalId: "rival-3",
        parkName: "Rival Three",
        type: "rank_retake",
        severity: "success",
        title: "You just passed Rival Three.",
        detail: "Momentum moved your way.",
      })
    ).toBe("Medium");
  });
});

function createLeaderboard(
  state: WorldParkLeagueState,
  config: {
    playerRank: number;
    rivalRanks: Record<string, number>;
  }
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  const usedRanks = new Set<number>([config.playerRank, ...Object.values(config.rivalRanks)]);
  const rivalsById = new Map(state.world.rivals.map((rival) => [rival.id, rival]));
  const fieldSize = Math.max(state.world.rivals.length + 1, 12);

  for (let rank = 1; rank <= fieldSize; rank += 1) {
    if (rank === config.playerRank) {
      entries.push(createEntry("__player__", "Player Park", true, rank));
      continue;
    }

    const matchingRivalId =
      Object.entries(config.rivalRanks).find(([, rivalRank]) => rivalRank === rank)?.[0] ?? null;
    if (matchingRivalId) {
      const rival = rivalsById.get(matchingRivalId);
      entries.push(createEntry(matchingRivalId, rival?.name ?? matchingRivalId, false, rank));
      continue;
    }

    const fallbackRival = state.world.rivals.find(
      (rival) =>
        !config.rivalRanks[rival.id] &&
        !entries.some((entry) => entry.parkId === rival.id)
    );
    if (!fallbackRival || usedRanks.has(rank)) {
      continue;
    }

    entries.push(createEntry(fallbackRival.id, fallbackRival.name, false, rank));
  }

  return entries.sort((left, right) => left.rank - right.rank);
}

function createEntry(
  parkId: string,
  parkName: string,
  isPlayer: boolean,
  rank: number
): LeaderboardEntry {
  return {
    rank,
    parkId,
    parkName,
    isPlayer,
    score: 100 - rank,
    scoreDelta: 0,
    marketShare: 0.02,
    monthlyProfit: 10_000 - rank * 100,
    companyValue: 1_000_000 - rank * 2_000,
    monthlyVisitors: 1_500 - rank * 10,
    debtRatio: 0.2,
    regionLabel: isPlayer ? "Your park" : "Europe",
    statusLabel: isPlayer ? "Player" : "Stable",
    trendLabel: "=",
  };
}
