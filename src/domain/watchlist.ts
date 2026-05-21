import { PLAYER_PARK_ID } from "../config";
import type {
  LeaderboardEntry,
  PlayerWatchlistState,
  RivalPark,
  WatchlistAlert,
  WorldParkLeagueState,
} from "../types";

const MAX_WATCHED_RIVALS = 6;
const FOCUS_RIVAL_COUNT = 3;
const ALERT_RETENTION = 24;
const MAX_FOCUS_RANK_GAP = 14;
const ALERT_CYCLE_LIMIT = 4;
const ALERT_COOLDOWN_BY_TYPE: Record<WatchlistAlert["type"], number> = {
  focus_assigned: 21,
  rank_overtake: 7,
  rank_retake: 7,
  scandal: 18,
  distress: 14,
  expansion: 12,
  recovery: 14,
  exit: 30,
};

export function createInitialWatchlistState(): PlayerWatchlistState {
  return {
    watchedRivalIds: [],
    focusRivalIds: [],
    alerts: [],
    lastAlertSummary: null,
  };
}

export function toggleWatchedRival(
  state: WorldParkLeagueState,
  rivalId: string
): { state: WorldParkLeagueState; ok: boolean; message: string } {
  if (rivalId === PLAYER_PARK_ID) {
    return { state, ok: false, message: "Your own park cannot be added to the watchlist." };
  }

  const rival = getRivalById(state, rivalId);
  if (!rival) {
    return { state, ok: false, message: "That rival is no longer active in the field." };
  }

  const watched = new Set(state.player.watchlist.watchedRivalIds);
  if (watched.has(rivalId)) {
    watched.delete(rivalId);
    state.player.watchlist.watchedRivalIds = [...watched];
    state.player.watchlist.lastAlertSummary = `${rival.name} was removed from your watchlist.`;
    return {
      state,
      ok: true,
      message: `${rival.name} removed from your watchlist.`,
    };
  }

  if (watched.size >= MAX_WATCHED_RIVALS) {
    return {
      state,
      ok: false,
      message: `You can track up to ${MAX_WATCHED_RIVALS} rivals at the same time.`,
    };
  }

  watched.add(rivalId);
  state.player.watchlist.watchedRivalIds = [...watched];
  state.player.watchlist.lastAlertSummary = `${rival.name} is now on your watchlist.`;
  return {
    state,
    ok: true,
    message: `${rival.name} added to your watchlist.`,
  };
}

export function isWatchedRival(
  state: WorldParkLeagueState,
  rivalId: string | null | undefined
): boolean {
  if (!rivalId) {
    return false;
  }

  return state.player.watchlist.watchedRivalIds.includes(rivalId);
}

export function isFocusRival(
  state: WorldParkLeagueState,
  rivalId: string | null | undefined
): boolean {
  if (!rivalId) {
    return false;
  }

  return state.player.watchlist.focusRivalIds.includes(rivalId);
}

export function updateWatchlistForCycle(
  previousState: WorldParkLeagueState,
  nextState: WorldParkLeagueState,
  dayIndex: number,
  month: number
): string[] {
  const previousFocusIds = [...previousState.player.watchlist.focusRivalIds];

  nextState.player.watchlist.watchedRivalIds = nextState.player.watchlist.watchedRivalIds
    .filter((rivalId, index, array) => array.indexOf(rivalId) === index)
    .filter((rivalId) => !!getRivalById(nextState, rivalId));

  nextState.player.watchlist.focusRivalIds = selectFocusRivalIds(nextState, previousFocusIds);

  const alerts = collectCycleAlerts(
    previousState,
    nextState,
    previousFocusIds,
    dayIndex,
    month
  );
  if (alerts.length === 0) {
    return [];
  }

  const filteredAlerts = filterAlertsAgainstHistory(alerts, nextState.player.watchlist.alerts);
  if (filteredAlerts.length === 0) {
    return [];
  }

  nextState.player.watchlist.alerts = [...filteredAlerts, ...nextState.player.watchlist.alerts].slice(
    0,
    ALERT_RETENTION
  );
  nextState.player.watchlist.lastAlertSummary =
    filteredAlerts[0]?.title ?? nextState.player.watchlist.lastAlertSummary;
  return filteredAlerts.map((alert) => alert.title);
}

export function getFocusRivalGapLabel(
  state: WorldParkLeagueState,
  rivalId: string
): string {
  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer);
  const rivalEntry = state.world.leaderboard.find((entry) => entry.parkId === rivalId);
  if (!playerEntry || !rivalEntry) {
    return "n/a";
  }

  const gap = rivalEntry.rank - playerEntry.rank;
  if (gap === 0) {
    return "level";
  }

  return gap > 0 ? `${gap} behind` : `${Math.abs(gap)} ahead`;
}

export function getTrackedRivals(state: WorldParkLeagueState): RivalPark[] {
  return state.player.watchlist.watchedRivalIds
    .map((rivalId) => getRivalById(state, rivalId))
    .filter((rival): rival is RivalPark => !!rival);
}

export function getFocusRivals(state: WorldParkLeagueState): RivalPark[] {
  return state.player.watchlist.focusRivalIds
    .map((rivalId) => getRivalById(state, rivalId))
    .filter((rival): rival is RivalPark => !!rival);
}

export interface LocalMarketSummary {
  circuitSize: number;
  circuitShare: number;
  playerShareOfCircuit: number;
  playerCircuitRank: number;
  leaderId: string;
  leaderName: string;
  leaderShare: number;
  shareGapToLeader: number;
  playerLeads: boolean;
}

export function getLocalMarketSummary(
  state: WorldParkLeagueState
): LocalMarketSummary | null {
  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer);
  if (!playerEntry) {
    return null;
  }

  const entries = [
    playerEntry,
    ...state.player.watchlist.focusRivalIds
      .map((rivalId) => state.world.leaderboard.find((entry) => entry.parkId === rivalId) ?? null)
      .filter((entry): entry is LeaderboardEntry => !!entry),
  ];

  const uniqueEntries = entries.filter(
    (entry, index, array) => array.findIndex((candidate) => candidate.parkId === entry.parkId) === index
  );
  if (uniqueEntries.length <= 1) {
    return null;
  }

  const circuitShare = uniqueEntries.reduce((total, entry) => total + entry.marketShare, 0);
  const sorted = [...uniqueEntries].sort((left, right) => right.marketShare - left.marketShare);
  const leader = sorted[0];
  if (!leader) {
    return null;
  }

  return {
    circuitSize: uniqueEntries.length,
    circuitShare,
    playerShareOfCircuit: circuitShare > 0 ? playerEntry.marketShare / circuitShare : 0,
    playerCircuitRank:
      sorted.findIndex((entry) => entry.isPlayer) >= 0
        ? sorted.findIndex((entry) => entry.isPlayer) + 1
        : uniqueEntries.length,
    leaderId: leader.parkId,
    leaderName: leader.parkName,
    leaderShare: leader.marketShare,
    shareGapToLeader: Math.max(0, leader.marketShare - playerEntry.marketShare),
    playerLeads: leader.isPlayer,
  };
}

function selectFocusRivalIds(
  state: WorldParkLeagueState,
  previousFocusIds: string[]
): string[] {
  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer);
  if (!playerEntry) {
    return previousFocusIds.filter((rivalId, index, array) => array.indexOf(rivalId) === index);
  }

  const rankedRivals = state.world.leaderboard
    .filter((entry) => !entry.isPlayer)
    .map((entry) => ({
      entry,
      gap: Math.abs(entry.rank - playerEntry.rank),
      watched: state.player.watchlist.watchedRivalIds.includes(entry.parkId),
      keep: previousFocusIds.includes(entry.parkId),
    }))
    .filter(({ gap }) => gap <= MAX_FOCUS_RANK_GAP)
    .sort((left, right) => {
      if (left.keep !== right.keep) {
        return left.keep ? -1 : 1;
      }
      if (left.watched !== right.watched) {
        return left.watched ? -1 : 1;
      }
      if (left.gap !== right.gap) {
        return left.gap - right.gap;
      }
      return left.entry.rank - right.entry.rank;
    });

  const selected: string[] = [];
  for (const candidate of rankedRivals) {
    if (selected.includes(candidate.entry.parkId)) {
      continue;
    }

    selected.push(candidate.entry.parkId);
    if (selected.length >= FOCUS_RIVAL_COUNT) {
      break;
    }
  }

  if (selected.length < FOCUS_RIVAL_COUNT) {
    const fallbackRivals = state.world.leaderboard
      .filter((entry) => !entry.isPlayer)
      .sort((left, right) => Math.abs(left.rank - playerEntry.rank) - Math.abs(right.rank - playerEntry.rank));

    for (const entry of fallbackRivals) {
      if (selected.includes(entry.parkId)) {
        continue;
      }

      selected.push(entry.parkId);
      if (selected.length >= FOCUS_RIVAL_COUNT) {
        break;
      }
    }
  }

  return selected;
}

function collectCycleAlerts(
  previousState: WorldParkLeagueState,
  nextState: WorldParkLeagueState,
  previousFocusIds: string[],
  dayIndex: number,
  month: number
): WatchlistAlert[] {
  const alerts: WatchlistAlert[] = [];
  const trackedIds = new Set<string>([
    ...previousState.player.watchlist.watchedRivalIds,
    ...nextState.player.watchlist.watchedRivalIds,
    ...previousFocusIds,
    ...nextState.player.watchlist.focusRivalIds,
  ]);

  const previousPlayerEntry = previousState.world.leaderboard.find((entry) => entry.isPlayer) ?? null;
  const nextPlayerEntry = nextState.world.leaderboard.find((entry) => entry.isPlayer) ?? null;

  for (const rivalId of nextState.player.watchlist.focusRivalIds) {
    if (previousFocusIds.includes(rivalId)) {
      continue;
    }

    const rival = getRivalById(nextState, rivalId);
    if (!rival) {
      continue;
    }

    alerts.push(
      createAlert(
        dayIndex,
        month,
        rivalId,
        rival.name,
        "focus_assigned",
        "info",
        `${rival.name} is now a local rival.`,
        "This operator is now in your immediate competitive circuit and is more likely to push back against your climb."
      )
    );
  }

  for (const rivalId of trackedIds) {
    const previousEntry = getLeaderboardEntry(previousState, rivalId);
    const nextEntry = getLeaderboardEntry(nextState, rivalId);
    const previousRival = getRivalById(previousState, rivalId);
    const nextRival = getRivalById(nextState, rivalId);
    const parkName = nextRival?.name ?? previousRival?.name;
    if (!parkName) {
      continue;
    }

    if (previousEntry && nextEntry && previousPlayerEntry && nextPlayerEntry) {
      const wasAhead = previousEntry.rank < previousPlayerEntry.rank;
      const isAhead = nextEntry.rank < nextPlayerEntry.rank;
      if (!wasAhead && isAhead) {
        alerts.push(
          createAlert(
            dayIndex,
            month,
            rivalId,
            parkName,
            "rank_overtake",
            "warning",
            `${parkName} has moved ahead of you.`,
            "A tracked rival just overtook your park in the live standings. Check its momentum, profit and recent events."
          )
        );
      } else if (wasAhead && !isAhead) {
        alerts.push(
          createAlert(
            dayIndex,
            month,
            rivalId,
            parkName,
            "rank_retake",
            "success",
            `You just passed ${parkName}.`,
            "Your park moved ahead of a tracked rival in the standings. This is a good moment to press the advantage."
          )
        );
      }
    }

    if (previousRival && nextRival) {
      if (previousRival.status.scandalMonthsRemaining === 0 && nextRival.status.scandalMonthsRemaining > 0) {
        alerts.push(
          createAlert(
            dayIndex,
            month,
            rivalId,
            parkName,
            "scandal",
            "warning",
            `${parkName} is dealing with a scandal.`,
            "A tracked rival is taking a reputation hit. That can open a short-term window for you to steal share."
          )
        );
      }

      if (previousRival.status.distressLevel < 2 && nextRival.status.distressLevel >= 2) {
        alerts.push(
          createAlert(
            dayIndex,
            month,
            rivalId,
            parkName,
            "distress",
            "warning",
            `${parkName} is under distress.`,
            "Debt and pressure are piling up at a tracked rival. Investments and rankings around it may become more volatile."
          )
        );
      }

      if (previousRival.status.expansionMonthsRemaining === 0 && nextRival.status.expansionMonthsRemaining > 0) {
        alerts.push(
          createAlert(
            dayIndex,
            month,
            rivalId,
            parkName,
            "expansion",
            "success",
            `${parkName} launched an expansion push.`,
            "A tracked rival is leaning into growth. Expect stronger short-term pressure, but also more risk on its side."
          )
        );
      }

      if (previousRival.status.recoveryMonthsRemaining === 0 && nextRival.status.recoveryMonthsRemaining > 0) {
        alerts.push(
          createAlert(
            dayIndex,
            month,
            rivalId,
            parkName,
            "recovery",
            "info",
            `${parkName} is mounting a recovery.`,
            "This rival is stabilizing after a rough patch, so its momentum may improve over the next few cycles."
          )
        );
      }

      if (previousRival.status.active && !nextRival.status.active) {
        alerts.push(
          createAlert(
            dayIndex,
            month,
            rivalId,
            parkName,
            "exit",
            "warning",
            nextRival.status.mergedIntoId
              ? `${parkName} exited the field through a merger.`
              : `${parkName} exited the field.`,
            nextRival.status.mergedIntoId
              ? "A tracked rival was absorbed into a larger operator. Review any holdings and nearby market gaps."
              : "A tracked rival fell out of the active field. That can reshape the local competitive circuit quickly."
          )
        );
      }
    }
  }

  return prioritizeAlerts(dedupeAlerts(alerts));
}

function dedupeAlerts(alerts: WatchlistAlert[]): WatchlistAlert[] {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = `${alert.rivalId}:${alert.type}:${alert.dayIndex}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function prioritizeAlerts(alerts: WatchlistAlert[]): WatchlistAlert[] {
  const severityScore: Record<WatchlistAlert["severity"], number> = {
    warning: 0,
    success: 1,
    info: 2,
  };
  const typeScore: Record<WatchlistAlert["type"], number> = {
    rank_overtake: 0,
    rank_retake: 1,
    distress: 2,
    scandal: 3,
    exit: 4,
    expansion: 5,
    recovery: 6,
    focus_assigned: 7,
  };

  const sorted = [...alerts].sort((left, right) => {
    const severityDelta = severityScore[left.severity] - severityScore[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const typeDelta = typeScore[left.type] - typeScore[right.type];
    if (typeDelta !== 0) {
      return typeDelta;
    }

    return right.dayIndex - left.dayIndex;
  });

  const warnings = sorted.filter((alert) => alert.severity === "warning");
  const successes = sorted.filter((alert) => alert.severity === "success");
  const infos = sorted.filter((alert) => alert.severity === "info");
  if (warnings.length > 0) {
    return [...warnings, ...successes.slice(0, 2), ...infos.slice(0, 1)].slice(0, ALERT_CYCLE_LIMIT);
  }

  if (successes.length > 0) {
    return [...successes, ...infos.slice(0, 2)].slice(0, ALERT_CYCLE_LIMIT);
  }

  return sorted.slice(0, ALERT_CYCLE_LIMIT);
}

function filterAlertsAgainstHistory(
  alerts: WatchlistAlert[],
  history: WatchlistAlert[]
): WatchlistAlert[] {
  return alerts.filter((alert) => {
    const cooldown = ALERT_COOLDOWN_BY_TYPE[alert.type] ?? 10;
    const matchingRecent = history.find(
      (item) =>
        item.rivalId === alert.rivalId &&
        item.type === alert.type &&
        alert.dayIndex - item.dayIndex < cooldown
    );
    return !matchingRecent;
  });
}

function createAlert(
  dayIndex: number,
  month: number,
  rivalId: string,
  parkName: string,
  type: WatchlistAlert["type"],
  severity: WatchlistAlert["severity"],
  title: string,
  detail: string
): WatchlistAlert {
  return {
    id: `${rivalId}:${type}:${dayIndex}`,
    dayIndex,
    month,
    rivalId,
    parkName,
    type,
    severity,
    title,
    detail,
  };
}

function getLeaderboardEntry(
  state: WorldParkLeagueState,
  rivalId: string
): LeaderboardEntry | null {
  return state.world.leaderboard.find((entry) => entry.parkId === rivalId) ?? null;
}

function getRivalById(
  state: WorldParkLeagueState,
  rivalId: string
): RivalPark | null {
  return state.world.rivals.find((rival) => rival.id === rivalId) ?? null;
}
