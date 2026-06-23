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
import {
  markExperienceEventPresented,
  peekStoredState,
  readState,
  syncStateToCurrentMonth,
} from "./state/repository";
import type {
  LivePulseResult,
  MonthlySimulationResult,
  PlayerExperienceEvent,
  PlayerRelevantGuest,
  PlayerSnapshot,
  WorldParkLeagueState,
} from "./types";
import { closeCapitalDeskWindowIfOpen, refreshCapitalDeskWindow } from "./ui/capitalDesk";
import { closeCheatWindowIfOpen, openCheatWindow } from "./ui/cheatWindow";
import { closeObjectiveWindowIfOpen, refreshObjectiveWindow } from "./ui/objectiveWindow";
import { closePrestigeWindowIfOpen, refreshPrestigeWindow } from "./ui/prestigeWindow";
import {
  closeRelevantGuestsWindowIfOpen,
  refreshRelevantGuestsWindow,
} from "./ui/relevantGuestsWindow";
import { closeWatchlistWindowIfOpen, refreshWatchlistWindow } from "./ui/watchlistWindow";
import { closeMainWindowIfOpen, openMainWindow, refreshMainWindow } from "./ui/window";

let lastAnnouncedMonth = Number.MIN_SAFE_INTEGER;
let lastAnnouncedPulseDayIndex = Number.MIN_SAFE_INTEGER;
let lastSpotlightBurstTick = Number.MIN_SAFE_INTEGER;
let lastClosedParkExperienceNoticeEventId: string | null = null;
let runtimeHooksRegistered = false;

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
  presentActiveExperienceEvent(synced.state, snapshot);
  if (synced.results.length > 0 || synced.pulseResults.length > 0) {
    refreshMainWindow();
    refreshCapitalDeskWindow();
    refreshObjectiveWindow();
    refreshPrestigeWindow();
    refreshWatchlistWindow();
    refreshRelevantGuestsWindow();
  }
}

function registerHooks(): void {
  if (runtimeHooksRegistered) {
    return;
  }

  runtimeHooksRegistered = true;

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

  if (!isParkOpenForLeagueGuests()) {
    return;
  }

  const storedState = peekStoredState();
  if (!storedState || !hasAnyPlayerBoost(storedState)) {
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

function presentActiveExperienceEvent(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): void {
  const event = state.player.experience.activeEvent;
  if (!event || state.player.experience.lastPresentedEventId === event.id) {
    return;
  }

  if (!isParkOpenForLeagueGuests()) {
    if (lastClosedParkExperienceNoticeEventId !== event.id) {
      lastClosedParkExperienceNoticeEventId = event.id;
      park.postMessage(
        "[World Park League] Event guests are waiting because the park is currently closed."
      );
    }
    return;
  }

  const relevantGuests = spawnExperienceGuestWave(event);
  spawnExperienceVisuals(event);
  lastClosedParkExperienceNoticeEventId = null;
  markExperienceEventPresented(event.id, relevantGuests, snapshot);
}

function spawnExperienceGuestWave(event: PlayerExperienceEvent): PlayerRelevantGuest[] {
  const relevantGuests: PlayerRelevantGuest[] = [];
  const guestsToSpawn = Math.max(1, Math.min(event.guestWaveSize, 28));

  for (let index = 0; index < guestsToSpawn; index += 1) {
    try {
      const guest = park.generateGuest();
      decorateExperienceGuest(guest, event, index);
      const relevantGuest = buildRelevantGuestRecord(guest, event, index);
      if (relevantGuest) {
        relevantGuests.push(relevantGuest);
      }
    } catch (error) {
      logPluginError("experience.generateGuest", error);
      break;
    }
  }

  return relevantGuests;
}

function decorateExperienceGuest(
  guest: Guest,
  event: PlayerExperienceEvent,
  index: number
): void {
  try {
    guest.happiness = Math.max(guest.happiness, 210);
    guest.happinessTarget = Math.max(guest.happinessTarget, 210);

    if (event.type === "vip_critic" && index === 0) {
      guest.name = event.reviewerName ?? "Park Critic";
      guest.tshirtColour = 2;
      guest.trousersColour = 0;
      guest.giveItem({ type: "map" });
      if (guest.availableAnimations.includes("takePhoto")) {
        guest.animation = "takePhoto";
      }
      return;
    }

    if (index > 5) {
      return;
    }

    if (event.type === "school_trip") {
      guest.name = `School Trip Guest ${index + 1}`;
      guest.tshirtColour = 12;
      guest.giveItem({ type: "map" });
      return;
    }

    if (event.type === "influencer_event") {
      guest.name = `Creator Guest ${index + 1}`;
      guest.tshirtColour = 6;
      guest.giveItem({ type: "sunglasses" });
      if (guest.availableAnimations.includes("takePhoto")) {
        guest.animation = "takePhoto";
      }
      return;
    }

    if (event.type === "press_day") {
      guest.name = `Press Guest ${index + 1}`;
      guest.tshirtColour = 1;
      guest.giveItem({ type: "map" });
      return;
    }

    guest.name = `Fan Weekend Guest ${index + 1}`;
    guest.tshirtColour = 10;
    guest.giveItem({ type: "balloon" });
  } catch (error) {
    logPluginError("experience.decorateGuest", error);
  }
}

function buildRelevantGuestRecord(
  guest: Guest,
  event: PlayerExperienceEvent,
  index: number
): PlayerRelevantGuest | null {
  const guestId = typeof guest.id === "number" ? guest.id : null;
  if (event.type === "vip_critic") {
    return index === 0
      ? {
          id: `${event.id}:critic`,
          guestId,
          name: event.reviewerName ?? guest.name,
          role: "critic",
          eventId: event.id,
          eventTitle: event.title,
          arrivedAtDayIndex: event.startedAtDayIndex,
        }
      : null;
  }

  if (event.type === "press_day" && index < 3) {
    return {
      id: `${event.id}:press:${index}`,
      guestId,
      name: guest.name,
      role: "press",
      eventId: event.id,
      eventTitle: event.title,
      arrivedAtDayIndex: event.startedAtDayIndex,
    };
  }

  if (event.type === "influencer_event" && index < 3) {
    return {
      id: `${event.id}:creator:${index}`,
      guestId,
      name: guest.name,
      role: "influencer",
      eventId: event.id,
      eventTitle: event.title,
      arrivedAtDayIndex: event.startedAtDayIndex,
    };
  }

  if (event.type === "school_trip" && index < 2) {
    return {
      id: `${event.id}:school:${index}`,
      guestId,
      name: index === 0 ? "School Trip Lead" : guest.name,
      role: "school_lead",
      eventId: event.id,
      eventTitle: event.title,
      arrivedAtDayIndex: event.startedAtDayIndex,
    };
  }

  if (event.type === "regional_fan_weekend" && index < 2) {
    return {
      id: `${event.id}:fan:${index}`,
      guestId,
      name: index === 0 ? "Fan Weekend Captain" : guest.name,
      role: "fan_lead",
      eventId: event.id,
      eventTitle: event.title,
      arrivedAtDayIndex: event.startedAtDayIndex,
    };
  }

  return null;
}

function spawnExperienceVisuals(event: PlayerExperienceEvent): void {
  const anchors = map.getAllEntities("guest").filter((guest) => guest.isInPark);
  const effectCount = Math.max(2, Math.min(event.visualIntensity, 12));
  for (let index = 0; index < effectCount; index += 1) {
    const anchor = anchors[(date.ticksElapsed + index * 7) % Math.max(1, anchors.length)];
    if (!anchor) {
      continue;
    }

    tryCreateEntity("balloon", {
      x: anchor.x + ((index % 3) - 1) * 10,
      y: anchor.y + (((index + 1) % 3) - 1) * 10,
      z: anchor.z + 28 + (index % 4) * 4,
      colour: getExperienceColour(event, index),
    });

    if (index % 3 === 0) {
      tryCreateEntity("money_effect", {
        x: anchor.x,
        y: anchor.y,
        z: anchor.z + 32,
        value: 0,
      });
    }

    if (event.visualIntensity >= 8) {
      tryCreateEntity("explosion_flare", {
        x: anchor.x,
        y: anchor.y,
        z: anchor.z + 48,
      });
    }
  }
}

function tryCreateEntity(type: EntityType, initializer: object): void {
  try {
    map.createEntity(type, initializer);
  } catch (error) {
    logPluginError(`experience.createEntity.${type}`, error);
  }
}

function getExperienceColour(event: PlayerExperienceEvent, index: number): number {
  switch (event.type) {
    case "school_trip":
      return [12, 13, 14][index % 3] ?? 12;
    case "influencer_event":
      return [6, 8, 9][index % 3] ?? 6;
    case "regional_fan_weekend":
      return [10, 11, 15][index % 3] ?? 10;
    case "vip_critic":
      return [0, 1, 2][index % 3] ?? 1;
    case "press_day":
    default:
      return [1, 2, 3][index % 3] ?? 2;
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
      registerHooks();
      openMainWindow();
      const snapshot = tryReadSnapshot("menu.experience.snapshot");
      if (snapshot) {
        presentActiveExperienceEvent(readState(snapshot), snapshot);
      }
    } catch (error) {
      logPluginError("menu.open", error);
      ui.showError(PLUGIN_NAME, "The league window could not be opened safely. Please reload the park.");
    }
  });

  ui.registerMenuItem(`${PLUGIN_NAME} Cheats`, () => {
    if (context.mode !== "normal") {
      ui.showError(PLUGIN_NAME, "Open a park first to use cheats.");
      return;
    }

    try {
      registerHooks();
      openCheatWindow();
    } catch (error) {
      logPluginError("menu.cheats", error);
      ui.showError(PLUGIN_NAME, "The cheat window could not be opened safely.");
    }
  });
}

function isParkOpenForLeagueGuests(): boolean {
  try {
    return park.getFlag("open");
  } catch (error) {
    logPluginError("park.open", error);
    return false;
  }
}

function main(): void {
  if (typeof ui !== "undefined" && ui.getWindow(WINDOW_CLASSIFICATION)) {
    closeMainWindowIfOpen();
  }
  closeCapitalDeskWindowIfOpen();
  closeCheatWindowIfOpen();
  closeObjectiveWindowIfOpen();
  closePrestigeWindowIfOpen();
  closeRelevantGuestsWindowIfOpen();
  closeWatchlistWindowIfOpen();

  registerUi();
  if (context.mode === "normal") {
    console.log(
      `[${PLUGIN_NAME}] Loaded v${PLUGIN_VERSION}. Runtime hooks will initialize the first time the plugin window is opened in a park.`
    );
    return;
  }

  console.log(`[${PLUGIN_NAME}] Loaded v${PLUGIN_VERSION}. Waiting for an active park.`);
}

function hasAnyPlayerBoost(state: WorldParkLeagueState): boolean {
  return (
    (state.world.spotlightMonthsRemaining > 0 && state.world.spotlightParkId === PLAYER_PARK_ID) ||
    (state.world.featuredDaysRemaining > 0 && state.world.featuredParkId === PLAYER_PARK_ID) ||
    (state.world.breakoutDaysRemaining > 0 && state.world.breakoutParkId === PLAYER_PARK_ID)
  );
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
