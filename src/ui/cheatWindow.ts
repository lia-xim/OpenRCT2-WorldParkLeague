import {
  formatMoney,
  formatSignedMoney,
  normalizeGameMoney,
  denormalizeGameMoney,
} from "../domain/currency";
import { readPlayerSnapshot } from "../domain/player";
import {
  readState,
  runManualSimulation,
  triggerDebugBreakoutBoost,
  triggerDebugFeaturedBoost,
  triggerDebugSpotlight,
} from "../state/repository";
import { PLUGIN_NAME } from "../config";
import { refreshCapitalDeskWindow } from "./capitalDesk";
import { refreshObjectiveWindow } from "./objectiveWindow";
import { refreshPrestigeWindow } from "./prestigeWindow";
import { refreshRelevantGuestsWindow } from "./relevantGuestsWindow";
import { refreshWatchlistWindow } from "./watchlistWindow";

const CHEAT_WINDOW_CLASSIFICATION = "world-park-league.cheats";
const CHEAT_WINDOW_TITLE = `${PLUGIN_NAME} | Cheats`;

let cheatStatusText = "Ready.";

export function openCheatWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const existing = ui.getWindow(CHEAT_WINDOW_CLASSIFICATION);
  if (existing) {
    existing.bringToFront();
    updateCheatWindowContents();
    return;
  }

  ui.openWindow({
    classification: CHEAT_WINDOW_CLASSIFICATION,
    title: CHEAT_WINDOW_TITLE,
    width: 520,
    height: 390,
    minWidth: 520,
    minHeight: 390,
    maxWidth: 520,
    maxHeight: 390,
    widgets: [
      { type: "groupbox", x: 8, y: 18, width: 504, height: 54, text: "Save snapshot" },
      { type: "label", name: "cheat-summary", x: 20, y: 40, width: 480, height: 14, text: "" },

      { type: "groupbox", x: 8, y: 78, width: 504, height: 78, text: "Park and money" },
      cheatButton("cash-10k", 20, 100, "+$10k", () => addParkCash(10_000)),
      cheatButton("cash-100k", 136, 100, "+$100k", () => addParkCash(100_000)),
      cheatButton("cash-1m", 252, 100, "+$1m", () => addParkCash(1_000_000)),
      cheatButton("clear-loan", 368, 100, "Clear loan", clearBankLoan),
      cheatButton("open-park", 20, 126, "Open park", () => setParkOpen(true)),
      cheatButton("close-park", 136, 126, "Close park", () => setParkOpen(false)),
      cheatButton("free-entry", 252, 126, "Free entry", () => setFreeParkEntry(true)),
      cheatButton("paid-entry", 368, 126, "Paid entry", () => setFreeParkEntry(false)),

      { type: "groupbox", x: 8, y: 162, width: 504, height: 96, text: "Guests and effects" },
      cheatButton("spawn-25", 20, 184, "+25 guests", () => spawnGuests(25, "normal")),
      cheatButton("spawn-100", 136, 184, "+100 guests", () => spawnGuests(100, "normal")),
      cheatButton("spawn-500", 252, 184, "+500 guests", () => spawnGuests(500, "normal")),
      cheatButton("vip-wave", 368, 184, "VIP wave", () => spawnGuests(25, "vip")),
      cheatButton("happy-guests", 20, 210, "Happy all", makeGuestsHappy),
      cheatButton("cash-guests", 136, 210, "Rich guests", makeGuestsRich),
      cheatButton("fx-burst", 252, 210, "FX burst", () => spawnVisualBurst(24)),
      cheatButton("fan-party", 368, 210, "Fan party", fanParty),

      { type: "groupbox", x: 8, y: 264, width: 504, height: 70, text: "League cheats" },
      cheatButton("spotlight", 20, 286, "Spotlight", forceSpotlight),
      cheatButton("featured", 136, 286, "Featured", forceFeatured),
      cheatButton("breakout", 252, 286, "Breakout", forceBreakout),
      cheatButton("mega-hype", 368, 286, "Mega hype", megaHype),
      cheatButton("next-month", 20, 310, "Next month", advanceMonth),

      { type: "label", name: "cheat-status", x: 20, y: 344, width: 380, height: 28, text: cheatStatusText },
      {
        type: "button",
        x: 410,
        y: 356,
        width: 82,
        height: 18,
        text: "Close",
        onClick: () => {
          closeCheatWindowIfOpen();
        },
      },
    ],
  });

  updateCheatWindowContents();
}

export function closeCheatWindowIfOpen(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(CHEAT_WINDOW_CLASSIFICATION);
  if (window) {
    window.close();
  }
}

function cheatButton(
  name: string,
  x: number,
  y: number,
  text: string,
  action: () => string
): ButtonDesc {
  return {
    type: "button",
    name,
    x,
    y,
    width: 108,
    height: 18,
    text,
    onClick: () => runCheatAction(action),
  };
}

function runCheatAction(action: () => string): void {
  try {
    const message = action();
    setCheatStatus(message);
    park.postMessage(`[World Park League Cheats] ${message}`);
    refreshCheatTargets();
  } catch (error) {
    const message = `Cheat failed: ${String(error)}`;
    setCheatStatus(message);
    console.log(`[${PLUGIN_NAME}] cheat failed: ${String(error)}`);
    if (typeof ui !== "undefined") {
      ui.showError(CHEAT_WINDOW_TITLE, message);
    }
  }
}

function addParkCash(amount: number): string {
  park.cash += denormalizeGameMoney(amount);
  return `Added ${formatMoney(amount)} to park cash.`;
}

function clearBankLoan(): string {
  const previous = normalizeGameMoney(park.bankLoan);
  park.bankLoan = 0;
  return previous > 0 ? `Cleared ${formatMoney(previous)} bank loan.` : "Bank loan already clear.";
}

function setParkOpen(isOpen: boolean): string {
  park.setFlag("open", isOpen);
  const actual = readParkOpenState();
  if (actual === isOpen) {
    return isOpen ? "Park forced open." : "Park forced closed.";
  }

  return isOpen
    ? "Tried to open the park, but OpenRCT2 kept it closed."
    : "Tried to close the park, but OpenRCT2 kept it open. This scenario may lock the park status.";
}

function setFreeParkEntry(isFree: boolean): string {
  park.setFlag("freeParkEntry", isFree);
  return isFree ? "Park entry set to free." : "Park entry returned to paid mode.";
}

function spawnGuests(count: number, mode: "normal" | "vip"): string {
  let spawned = 0;
  for (let index = 0; index < count; index += 1) {
    try {
      const guest = park.generateGuest();
      spawned += 1;
      if (mode === "vip") {
        decorateCheatGuest(guest, index);
      }
    } catch (error) {
      console.log(`[${PLUGIN_NAME}] cheat guest spawn failed: ${String(error)}`);
      break;
    }
  }

  return mode === "vip"
    ? `Spawned ${spawned} VIP guests.`
    : `Spawned ${spawned} guests.`;
}

function decorateCheatGuest(guest: Guest, index: number): void {
  guest.name = `League VIP ${index + 1}`;
  guest.happiness = 255;
  guest.happinessTarget = 255;
  guest.energy = 128;
  guest.energyTarget = 128;
  guest.nausea = 0;
  guest.nauseaTarget = 0;
  guest.cash += denormalizeGameMoney(500);
  guest.tshirtColour = [2, 6, 10, 12][index % 4] ?? 2;
  guest.trousersColour = 0;
  guest.balloonColour = guest.tshirtColour;
  tryGiveGuestItem(guest, "map");
  tryGiveGuestItem(guest, "sunglasses");
  if (guest.availableAnimations.includes("takePhoto")) {
    guest.animation = "takePhoto";
  }
}

function makeGuestsHappy(): string {
  const guests = map.getAllEntities("guest");
  for (const guest of guests) {
    guest.happiness = 255;
    guest.happinessTarget = 255;
    guest.energy = 128;
    guest.energyTarget = 128;
    guest.nausea = 0;
    guest.nauseaTarget = 0;
    if (guest.availableAnimations.includes("joy")) {
      guest.animation = "joy";
    }
  }

  return `Maxed happiness for ${guests.length} guests.`;
}

function makeGuestsRich(): string {
  const guests = map.getAllEntities("guest");
  for (const guest of guests) {
    guest.cash += denormalizeGameMoney(500);
  }

  return `Gave ${formatMoney(500)} to ${guests.length} guests.`;
}

function spawnVisualBurst(count: number): string {
  const anchors = map.getAllEntities("guest").filter((guest) => guest.isInPark);
  for (let index = 0; index < count; index += 1) {
    const anchor = anchors[index % Math.max(1, anchors.length)];
    const location = anchor
      ? { x: anchor.x, y: anchor.y, z: anchor.z + 36 }
      : getMapCenterLocation();
    createCheatEntity("balloon", {
      x: location.x + ((index % 5) - 2) * 8,
      y: location.y + (((index + 2) % 5) - 2) * 8,
      z: location.z + (index % 5) * 4,
      colour: [2, 6, 8, 10, 12][index % 5] ?? 2,
    });

    if (index % 3 === 0) {
      createCheatEntity("money_effect", {
        x: location.x,
        y: location.y,
        z: location.z + 12,
        value: 0,
      });
    }

    if (index % 6 === 0) {
      createCheatEntity("explosion_flare", {
        x: location.x,
        y: location.y,
        z: location.z + 24,
      });
    }
  }

  return `Spawned ${count} visual effects.`;
}

function fanParty(): string {
  const guestMessage = spawnGuests(75, "vip");
  const effectMessage = spawnVisualBurst(32);
  return `${guestMessage} ${effectMessage}`;
}

function forceSpotlight(): string {
  const result = triggerDebugSpotlight(readPlayerSnapshot());
  return result.message;
}

function forceFeatured(): string {
  const result = triggerDebugFeaturedBoost(readPlayerSnapshot());
  return result.message;
}

function forceBreakout(): string {
  const result = triggerDebugBreakoutBoost(readPlayerSnapshot());
  return result.message;
}

function megaHype(): string {
  const snapshot = readPlayerSnapshot();
  triggerDebugSpotlight(snapshot);
  triggerDebugFeaturedBoost(snapshot);
  triggerDebugBreakoutBoost(snapshot);
  spawnGuests(200, "vip");
  spawnVisualBurst(40);
  return "Mega hype enabled: all boosts, VIP guests and FX burst.";
}

function advanceMonth(): string {
  const result = runManualSimulation(readPlayerSnapshot());
  return `Advanced one league month. Park cash ${formatSignedMoney(result.parkCashDelta)}.`;
}

function tryGiveGuestItem(guest: Guest, type: GuestItemType): void {
  try {
    guest.giveItem({ type });
  } catch (error) {
    console.log(`[${PLUGIN_NAME}] cheat give item failed: ${String(error)}`);
  }
}

function createCheatEntity(type: EntityType, initializer: object): void {
  try {
    map.createEntity(type, initializer);
  } catch (error) {
    console.log(`[${PLUGIN_NAME}] cheat create entity ${type} failed: ${String(error)}`);
  }
}

function getMapCenterLocation(): { x: number; y: number; z: number } {
  return {
    x: Math.max(1, Math.floor(map.size.x / 2)) * 32,
    y: Math.max(1, Math.floor(map.size.y / 2)) * 32,
    z: 32,
  };
}

function updateCheatWindowContents(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(CHEAT_WINDOW_CLASSIFICATION);
  if (!window) {
    return;
  }

  const snapshot = readPlayerSnapshot();
  const state = readState(snapshot);
  setLabel(
    window,
    "cheat-summary",
    `Cash ${formatMoney(snapshot.cash)} | Loan ${formatMoney(snapshot.bankLoan)} | Guests ${snapshot.guests} | Park ${readParkOpenState() ? "open" : "closed"} | Rank ${state.player.currentRank ?? "-"}`
  );
  setLabel(window, "cheat-status", cheatStatusText);
}

function readParkOpenState(): boolean {
  try {
    return park.getFlag("open");
  } catch (error) {
    console.log(`[${PLUGIN_NAME}] cheat read park open failed: ${String(error)}`);
    return false;
  }
}

function setCheatStatus(message: string): void {
  cheatStatusText = trimText(message, 92);
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(CHEAT_WINDOW_CLASSIFICATION);
  if (window) {
    setLabel(window, "cheat-status", cheatStatusText);
  }
}

function refreshCheatTargets(): void {
  updateCheatWindowContents();
  refreshCapitalDeskWindow();
  refreshObjectiveWindow();
  refreshPrestigeWindow();
  refreshRelevantGuestsWindow();
  refreshWatchlistWindow();
}

function setLabel(window: Window, name: string, text: string): void {
  const widget = window.findWidget(name) as LabelWidget | null;
  if (widget) {
    widget.text = trimText(text, 98);
  }
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
