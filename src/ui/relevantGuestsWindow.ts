import { readPlayerSnapshot } from "../domain/player";
import { readState } from "../state/repository";
import { PLUGIN_NAME } from "../config";
import type { PlayerRelevantGuest, PlayerRelevantGuestRole, WorldParkLeagueState } from "../types";

const RELEVANT_GUESTS_WINDOW_CLASSIFICATION = "world-park-league.relevant-guests";
const RELEVANT_GUESTS_WINDOW_TITLE = `${PLUGIN_NAME} | People`;

let selectedRelevantGuestId: string | null = null;
let relevantGuestRowIds: string[] = [];

export function openRelevantGuestsWindow(highlightGuestId: string | null = null): void {
  if (typeof ui === "undefined") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  const state = readState(snapshot);
  if (highlightGuestId) {
    selectedRelevantGuestId = highlightGuestId;
  }

  const existing = ui.getWindow(RELEVANT_GUESTS_WINDOW_CLASSIFICATION);
  if (existing) {
    existing.bringToFront();
    updateRelevantGuestsContents(state);
    return;
  }

  ui.openWindow({
    classification: RELEVANT_GUESTS_WINDOW_CLASSIFICATION,
    title: RELEVANT_GUESTS_WINDOW_TITLE,
    width: 520,
    height: 270,
    minWidth: 520,
    minHeight: 270,
    maxWidth: 520,
    maxHeight: 270,
    onClose: () => {
      selectedRelevantGuestId = null;
      relevantGuestRowIds = [];
    },
    widgets: [
      { type: "groupbox", x: 8, y: 18, width: 504, height: 184, text: "Relevant People In Your Park" },
      {
        type: "listview",
        name: "guest-list",
        x: 18,
        y: 36,
        width: 484,
        height: 122,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: true,
        columns: [
          { header: "Name", width: 160 },
          { header: "Role", width: 86 },
          { header: "Event", width: 130 },
          { header: "Status", width: 88 },
        ],
        items: [],
        onClick: (item) => {
          selectedRelevantGuestId = relevantGuestRowIds[item] ?? null;
          updateRelevantGuestsContents(readState(readPlayerSnapshot()));
        },
      },
      { type: "label", name: "guest-detail", x: 18, y: 166, width: 484, height: 28, text: "" },
      {
        type: "button",
        name: "locate-guest",
        x: 18,
        y: 214,
        width: 110,
        height: 18,
        text: "Locate",
        onClick: () => {
          locateSelectedGuest();
        },
      },
      {
        type: "button",
        name: "refresh-guests",
        x: 138,
        y: 214,
        width: 110,
        height: 18,
        text: "Refresh",
        onClick: () => {
          updateRelevantGuestsContents(readState(readPlayerSnapshot()));
        },
      },
      {
        type: "button",
        x: 392,
        y: 238,
        width: 110,
        height: 18,
        text: "Close",
        onClick: () => {
          const window = ui.getWindow(RELEVANT_GUESTS_WINDOW_CLASSIFICATION);
          if (window) {
            window.close();
          }
        },
      },
    ],
  });

  updateRelevantGuestsContents(state);
}

export function refreshRelevantGuestsWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(RELEVANT_GUESTS_WINDOW_CLASSIFICATION);
  if (!window || context.mode !== "normal") {
    return;
  }

  updateRelevantGuestsContents(readState(readPlayerSnapshot()));
}

export function closeRelevantGuestsWindowIfOpen(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(RELEVANT_GUESTS_WINDOW_CLASSIFICATION);
  if (window) {
    window.close();
  }

  selectedRelevantGuestId = null;
  relevantGuestRowIds = [];
}

function updateRelevantGuestsContents(state: WorldParkLeagueState): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(RELEVANT_GUESTS_WINDOW_CLASSIFICATION);
  if (!window) {
    return;
  }

  const guests = state.player.experience.relevantGuests;
  const list = window.findWidget("guest-list") as ListViewWidget | null;
  if (list) {
    relevantGuestRowIds = guests.map((guest) => guest.id);
    list.items =
      guests.length > 0
        ? guests.map((guest) => [
            guest.name,
            formatRole(guest.role),
            guest.eventTitle,
            getGuestStatusLabel(guest),
          ])
        : [["No relevant guests yet.", "", "", ""]];
  }

  if (selectedRelevantGuestId && !relevantGuestRowIds.includes(selectedRelevantGuestId)) {
    selectedRelevantGuestId = relevantGuestRowIds[0] ?? null;
  }
  if (!selectedRelevantGuestId) {
    selectedRelevantGuestId = relevantGuestRowIds[0] ?? null;
  }

  const selected = guests.find((guest) => guest.id === selectedRelevantGuestId) ?? null;
  setLabel(
    window,
    "guest-detail",
    selected
      ? `${selected.name} | ${formatRole(selected.role)} | ${selected.eventTitle} | ${getGuestStatusLabel(selected)}`
      : "Relevant guests appear here when VIPs, critics, press or creators enter your park."
  );
  setButtonDisabled(window, "locate-guest", !selected || !resolveGuestEntity(selected));
}

function locateSelectedGuest(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const state = readState(readPlayerSnapshot());
  const selected = state.player.experience.relevantGuests.find(
    (guest) => guest.id === selectedRelevantGuestId
  );
  const guest = selected ? resolveGuestEntity(selected) : null;
  if (!selected || !guest) {
    park.postMessage("[World Park League] This guest is no longer visible in the park.");
    updateRelevantGuestsContents(state);
    return;
  }

  ui.mainViewport.scrollTo({ x: guest.x, y: guest.y, z: guest.z });
  park.postMessage(`[World Park League] Tracking ${selected.name}.`);
}

function resolveGuestEntity(guest: PlayerRelevantGuest): Guest | null {
  if (guest.guestId === null) {
    return null;
  }

  try {
    const entity = map.getEntity(guest.guestId);
    return entity?.type === "guest" ? (entity as Guest) : null;
  } catch {
    return null;
  }
}

function getGuestStatusLabel(guest: PlayerRelevantGuest): string {
  const entity = resolveGuestEntity(guest);
  if (!entity) {
    return "Left";
  }

  return entity.isInPark ? "In park" : "Outside";
}

function formatRole(role: PlayerRelevantGuestRole): string {
  switch (role) {
    case "critic":
      return "Critic";
    case "press":
      return "Press";
    case "influencer":
      return "Creator";
    case "school_lead":
      return "School";
    case "fan_lead":
      return "Fan lead";
  }
}

function setLabel(window: Window, widgetName: string, text: string): void {
  const widget = window.findWidget(widgetName) as LabelWidget | null;
  if (widget) {
    widget.text = trimText(text, 96);
  }
}

function setButtonDisabled(window: Window, widgetName: string, isDisabled: boolean): void {
  const widget = window.findWidget(widgetName) as ButtonWidget | null;
  if (widget) {
    widget.isDisabled = isDisabled;
  }
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
