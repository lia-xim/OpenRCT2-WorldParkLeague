import {
  BREAKOUT_BURST_GUESTS,
  BREAKOUT_BURST_INTERVAL_TICKS,
  FEATURED_BURST_GUESTS,
  FEATURED_BURST_INTERVAL_TICKS,
  PLAYER_PARK_ID,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  SPOTLIGHT_BURST_GUESTS,
  SPOTLIGHT_BURST_INTERVAL_TICKS,
  TARGET_API_VERSION,
  WINDOW_CLASSIFICATION,
} from "./config";
import { readPlayerSnapshot } from "./domain/player";
import { readState, syncStateToCurrentMonth } from "./state/repository";
import type {
  LivePulseResult,
  MonthlySimulationResult,
  PlayerSnapshot,
  WorldParkLeagueState,
} from "./types";
import { closeCapitalDeskWindowIfOpen, refreshCapitalDeskWindow } from "./ui/capitalDesk";
import { closePrestigeWindowIfOpen, refreshPrestigeWindow } from "./ui/prestigeWindow";
import { closeWatchlistWindowIfOpen, refreshWatchlistWindow } from "./ui/watchlistWindow";
import { closeMainWindowIfOpen, openMainWindow, refreshMainWindow } from "./ui/window";

let lastAnnouncedMonth = Number.MIN_SAFE_INTEGER;
let lastAnnouncedPulseDayIndex = Number.MIN_SAFE_INTEGER;
let lastSpotlightBurstTick = Number.MIN_SAFE_INTEGER;

function announceSimulationResults(
  state: WorldParkLeagueState,
  results: MonthlySimulationResult[]
): void {
  if (results.length === 0) {
    return;
  }

  const latest = results[results.length - 1];
  if (!latest || latest.month === lastAnnouncedMonth) {
    return;
  }

  lastAnnouncedMonth = latest.month;

  const firstHeadline = latest.headlines[0];
  if (firstHeadline) {
    park.postMessage(`[World Park League] ${firstHeadline.headline}`);
  }

  for (const note of latest.playerNotifications.slice(0, 2)) {
    park.postMessage(`[World Park League] ${note}`);
  }

  announceRankChange(state);
}

function announcePulseResults(
  state: WorldParkLeagueState,
  results: LivePulseResult[]
): void {
  if (results.length === 0) {
    return;
  }

  const latest = results[results.length - 1];
  if (!latest || latest.dayIndex === lastAnnouncedPulseDayIndex) {
    return;
  }

  lastAnnouncedPulseDayIndex = latest.dayIndex;

  const firstHeadline = latest.headlines[0];
  if (firstHeadline) {
    park.postMessage(`[World Park League] ${firstHeadline.headline}`);
  }

  for (const note of latest.playerNotifications.slice(0, 2)) {
    park.postMessage(`[World Park League] ${note}`);
  }

  announceRankChange(state);
}

function announceRankChange(state: WorldParkLeagueState): void {
  if (state.player.currentRank === 1 && state.player.previousRank !== 1) {
    park.postMessage("[World Park League] Your park has climbed to the top of the global leaderboard.");
  }
}

function logPluginError(scope: string, error: unknown): void {
  console.log(`[${PLUGIN_NAME}] ${scope} failed: ${String(error)}`);
}

function tryReadSnapshot(scope: string): PlayerSnapshot | null {
  try {
    return readPlayerSnapshot();
  } catch (error) {
    logPluginError(scope, error);
    return null;
  }
}

function trySyncLeagueMonth(
  snapshot: PlayerSnapshot,
  scope: string
): {
  state: WorldParkLeagueState;
  results: MonthlySimulationResult[];
  pulseResults: LivePulseResult[];
} | null {
  try {
    return syncStateToCurrentMonth(snapshot);
  } catch (error) {
    logPluginError(scope, error);
    return null;
  }
}

function applyDailyLeagueTick(): void {
  if (context.mode !== "normal") {
    return;
  }

  const snapshot = tryReadSnapshot("interval.day.snapshot");
  if (!snapshot) {
    return;
  }

  const synced = trySyncLeagueMonth(snapshot, "interval.day.sync");
  if (!synced) {
    return;
  }

  announceSimulationResults(synced.state, synced.results);
  announcePulseResults(synced.state, synced.pulseResults);
  if (synced.results.length > 0 || synced.pulseResults.length > 0) {
    refreshMainWindow();
    refreshCapitalDeskWindow();
    refreshPrestigeWindow();
    refreshWatchlistWindow();
  }
}

function registerHooks(): void {
  context.subscribe("interval.day", () => {
    try {
      applyDailyLeagueTick();
    } catch (error) {
      logPluginError("interval.day", error);
    }
  });

  context.subscribe("interval.tick", () => {
    try {
      applySpotlightGuestBurst();
    } catch (error) {
      logPluginError("interval.tick", error);
    }
  });

  context.subscribe("park.guest.softcap.calculate", (event) => {
    if (context.mode !== "normal") {
      return;
    }

    const snapshot = tryReadSnapshot("park.guest.softcap.snapshot");
    if (!snapshot) {
      return;
    }

    try {
      const state = readState(snapshot);
      event.suggestedGuestMaximum = Math.max(
        1,
        Math.round(event.suggestedGuestMaximum * state.player.guestCapModifier)
      );
    } catch (error) {
      logPluginError("park.guest.softcap.calculate", error);
    }
  });
}

function applySpotlightGuestBurst(): void {
  if (context.mode !== "normal") {
    return;
  }

  const snapshot = tryReadSnapshot("interval.tick.snapshot");
  if (!snapshot) {
    return;
  }

  const state = readState(snapshot);
  const burst = resolvePlayerBoostBurst(state);
  if (!burst) {
    return;
  }

  if (date.ticksElapsed - lastSpotlightBurstTick < burst.intervalTicks) {
    return;
  }

  const targetGuests = Math.max(
    park.suggestedGuestMaximum,
    Math.round(park.suggestedGuestMaximum * Math.max(1, state.player.guestCapModifier))
  );
  const gap = targetGuests - park.guests;
  if (gap <= 0) {
    return;
  }

  lastSpotlightBurstTick = date.ticksElapsed;
  for (let index = 0; index < Math.min(gap, burst.guestsPerBurst); index += 1) {
    park.generateGuest();
  }
}

function resolvePlayerBoostBurst(
  state: WorldParkLeagueState
): { intervalTicks: number; guestsPerBurst: number } | null {
  if (
    state.world.spotlightMonthsRemaining > 0 &&
    state.world.spotlightParkId === PLAYER_PARK_ID
  ) {
    return {
      intervalTicks: SPOTLIGHT_BURST_INTERVAL_TICKS,
      guestsPerBurst: SPOTLIGHT_BURST_GUESTS,
    };
  }

  if (state.world.featuredDaysRemaining > 0 && state.world.featuredParkId === PLAYER_PARK_ID) {
    return {
      intervalTicks: FEATURED_BURST_INTERVAL_TICKS,
      guestsPerBurst: FEATURED_BURST_GUESTS,
    };
  }

  if (state.world.breakoutDaysRemaining > 0 && state.world.breakoutParkId === PLAYER_PARK_ID) {
    return {
      intervalTicks: BREAKOUT_BURST_INTERVAL_TICKS,
      guestsPerBurst: BREAKOUT_BURST_GUESTS,
    };
  }

  return null;
}

function registerUi(): void {
  if (typeof ui === "undefined") {
    return;
  }

  ui.registerMenuItem(PLUGIN_NAME, () => {
    if (context.mode !== "normal") {
      ui.showError(PLUGIN_NAME, "Open the plugin from an active park to access the league view.");
      return;
    }

    try {
      openMainWindow();
    } catch (error) {
      logPluginError("menu.open", error);
      ui.showError(PLUGIN_NAME, "The league window could not be opened safely. Please reload the park.");
    }
  });
}

function main(): void {
  if (typeof ui !== "undefined" && ui.getWindow(WINDOW_CLASSIFICATION)) {
    closeMainWindowIfOpen();
  }
  closeCapitalDeskWindowIfOpen();
  closePrestigeWindowIfOpen();
  closeWatchlistWindowIfOpen();

  registerHooks();
  registerUi();
  if (context.mode === "normal") {
    const snapshot = tryReadSnapshot("main.snapshot");
    if (!snapshot) {
      console.log(`[${PLUGIN_NAME}] Loaded v${PLUGIN_VERSION}. Snapshot unavailable.`);
      return;
    }

    const synced = trySyncLeagueMonth(snapshot, "main.sync");
    if (synced) {
      console.log(
        `[${PLUGIN_NAME}] Loaded v${PLUGIN_VERSION}. Current rank: ${synced.state.player.currentRank ?? "n/a"}.`
      );
      return;
    }

    console.log(`[${PLUGIN_NAME}] Loaded v${PLUGIN_VERSION}. League sync unavailable.`);
    return;
  }

  console.log(`[${PLUGIN_NAME}] Loaded v${PLUGIN_VERSION}. Waiting for an active park.`);
}

registerPlugin({
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,
  authors: ["World Park League contributors"],
  type: "local",
  licence: "MIT",
  targetApiVersion: TARGET_API_VERSION,
  main,
});
