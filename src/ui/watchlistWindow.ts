import { readPlayerSnapshot } from "../domain/player";
import { getArchetypeDescription, getArchetypeLabel } from "../domain/rivals";
import {
  getAlertPriorityLabel,
  getFocusRivalGapLabel,
  getFocusRivals,
  getTrackedRivals,
  isImportantAlert,
  isFocusRival,
} from "../domain/watchlist";
import { readState, toggleWatchlistRivalById } from "../state/repository";
import { PLUGIN_NAME } from "../config";
import type { PlayerSnapshot, WorldParkLeagueState } from "../types";

const WATCHLIST_WINDOW_CLASSIFICATION = "world-park-league.watchlist";
const WATCHLIST_WINDOW_TITLE = `${PLUGIN_NAME} | Rivals`;

let selectedTrackedRivalId: string | null = null;
let trackedRowIds: string[] = [];
let selectedAlertId: string | null = null;
let alertRowIds: string[] = [];
let importantAlertsOnly = true;

export function openWatchlistWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  const state = readState(snapshot);
  const existing = ui.getWindow(WATCHLIST_WINDOW_CLASSIFICATION);
  if (existing) {
    existing.bringToFront();
    updateWatchlistContents(state, snapshot);
    return;
  }

  ui.openWindow({
    classification: WATCHLIST_WINDOW_CLASSIFICATION,
    title: WATCHLIST_WINDOW_TITLE,
    width: 560,
    height: 548,
    minWidth: 560,
    minHeight: 548,
    maxWidth: 560,
    maxHeight: 548,
    onClose: () => {
      selectedTrackedRivalId = null;
      trackedRowIds = [];
      selectedAlertId = null;
      alertRowIds = [];
    },
    widgets: [
      { type: "groupbox", x: 8, y: 18, width: 544, height: 118, text: "Main Rivals" },
      {
        type: "listview",
        name: "focus-list",
        x: 18,
        y: 36,
        width: 524,
        height: 76,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: false,
        columns: [
          { header: "Park", width: 170 },
          { header: "Identity", width: 118 },
          { header: "Rank", width: 42 },
          { header: "Gap", width: 78 },
          { header: "Track", width: 78 },
        ],
        items: [],
      },
      { type: "label", name: "focus-hint", x: 18, y: 114, width: 524, height: 14, text: "" },

      { type: "groupbox", x: 8, y: 142, width: 544, height: 134, text: "Tracked Parks" },
      {
        type: "listview",
        name: "tracked-list",
        x: 18,
        y: 160,
        width: 524,
        height: 72,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: true,
        columns: [
          { header: "Park", width: 188 },
          { header: "Identity", width: 118 },
          { header: "Rank", width: 42 },
          { header: "Circuit", width: 72 },
          { header: "Status", width: 86 },
        ],
        items: [],
        onClick: (item) => {
          const rivalId = trackedRowIds[item];
          if (!rivalId) {
            return;
          }

          selectedTrackedRivalId = rivalId;
          updateWatchlistContents(readState(readPlayerSnapshot()), readPlayerSnapshot());
        },
      },
      {
        type: "button",
        name: "unwatch-selected",
        x: 18,
        y: 238,
        width: 126,
        height: 16,
        text: "Unwatch selected",
        onClick: () => {
          handleUnwatchSelected();
        },
      },
      { type: "label", name: "tracked-hint", x: 154, y: 240, width: 388, height: 14, text: "" },

      { type: "groupbox", x: 8, y: 282, width: 544, height: 258, text: "Rival Alerts" },
      {
        type: "button",
        name: "alert-filter",
        x: 18,
        y: 296,
        width: 132,
        height: 16,
        text: "Important only",
        onClick: () => {
          importantAlertsOnly = !importantAlertsOnly;
          updateWatchlistContents(readState(readPlayerSnapshot()), readPlayerSnapshot());
        },
      },
      {
        type: "listview",
        name: "alert-list",
        x: 18,
        y: 320,
        width: 524,
        height: 98,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: true,
        columns: [
          { header: "When", width: 74 },
          { header: "Park", width: 146 },
          { header: "Priority", width: 62 },
          { header: "Alert", width: 216 },
        ],
        items: [],
        onClick: (item) => {
          const alertId = alertRowIds[item];
          if (!alertId) {
            return;
          }

          selectedAlertId = alertId;
          updateWatchlistContents(readState(readPlayerSnapshot()), readPlayerSnapshot());
        },
      },
      { type: "label", name: "alert-detail", x: 18, y: 426, width: 524, height: 44, text: "" },
      { type: "label", name: "alert-footer", x: 18, y: 478, width: 524, height: 44, text: "" },
    ],
  });

  updateWatchlistContents(state, snapshot);
}

export function refreshWatchlistWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(WATCHLIST_WINDOW_CLASSIFICATION);
  if (!window || context.mode !== "normal") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  updateWatchlistContents(readState(snapshot), snapshot);
}

export function closeWatchlistWindowIfOpen(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(WATCHLIST_WINDOW_CLASSIFICATION);
  if (window) {
    window.close();
  }

  selectedTrackedRivalId = null;
  trackedRowIds = [];
  selectedAlertId = null;
  alertRowIds = [];
}

function updateWatchlistContents(
  state: WorldParkLeagueState,
  _snapshot: PlayerSnapshot
): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(WATCHLIST_WINDOW_CLASSIFICATION);
  if (!window) {
    return;
  }

  const focusRivals = getFocusRivals(state);
  const trackedRivals = getTrackedRivals(state);

  const focusList = window.findWidget("focus-list") as ListViewWidget | null;
  if (focusList) {
    focusList.items = focusRivals.map((rival) => {
      const entry = state.world.leaderboard.find((item) => item.parkId === rival.id);
      return [
        rival.name,
        getArchetypeLabel(rival.archetype),
        entry ? entry.rank.toString() : "-",
        getFocusRivalGapLabel(state, rival.id),
        state.player.watchlist.watchedRivalIds.includes(rival.id) ? "Tracked" : "Auto",
      ];
    });
  }

  const trackedList = window.findWidget("tracked-list") as ListViewWidget | null;
  if (trackedList) {
    trackedRowIds = trackedRivals.map((rival) => rival.id);
    trackedList.items =
      trackedRivals.length > 0
        ? trackedRivals.map((rival) => {
            const entry = state.world.leaderboard.find((item) => item.parkId === rival.id);
            return [
              rival.name,
              getArchetypeLabel(rival.archetype),
              entry ? entry.rank.toString() : "-",
              isFocusRival(state, rival.id) ? "Local rival" : "Global field",
              entry?.statusLabel ?? "Inactive",
            ];
          })
        : [["No watched rivals yet.", "", "", "", ""]];
  }

  if (selectedTrackedRivalId && !trackedRowIds.includes(selectedTrackedRivalId)) {
    selectedTrackedRivalId = trackedRowIds[0] ?? null;
  }
  if (!selectedTrackedRivalId) {
    selectedTrackedRivalId = trackedRowIds[0] ?? null;
  }

  const alertList = window.findWidget("alert-list") as ListViewWidget | null;
  const visibleAlerts = importantAlertsOnly
    ? state.player.watchlist.alerts.filter((alert) => isImportantAlert(alert))
    : state.player.watchlist.alerts;
  if (alertList) {
    alertRowIds = visibleAlerts.map((alert) => alert.id);
    alertList.items =
      visibleAlerts.length > 0
        ? visibleAlerts.map((alert) => [
            formatAlertTime(alert.dayIndex),
            alert.parkName,
            getAlertPriorityLabel(alert),
            alert.title,
          ])
        : [["No alerts yet.", "", "", ""]];
  }

  if (selectedAlertId && !alertRowIds.includes(selectedAlertId)) {
    selectedAlertId = alertRowIds[0] ?? null;
  }
  if (!selectedAlertId) {
    selectedAlertId = alertRowIds[0] ?? null;
  }

  const selectedTracked = trackedRivals.find((rival) => rival.id === selectedTrackedRivalId) ?? null;
  const selectedAlert = state.player.watchlist.alerts.find((alert) => alert.id === selectedAlertId) ?? null;
  const filterButton = window.findWidget("alert-filter") as ButtonWidget | null;
  if (filterButton) {
    filterButton.text = importantAlertsOnly ? "Important only" : "All alerts";
  }

  setButtonDisabled(window, "unwatch-selected", !selectedTracked);
  setLabel(
    window,
    "focus-hint",
      focusRivals.length > 0
      ? `These are your closest active competitors. They scale around your rank so the race stays alive.`
      : "Your local rival circuit will form after the league settles around your current rank."
  );
  setLabel(
    window,
    "tracked-hint",
    selectedTracked
      ? `${selectedTracked.name}: ${getArchetypeDescription(selectedTracked.archetype)}`
      : "Track rivals from the main window to receive targeted overtakes, scandal, distress and exit alerts."
  );
  setLabel(
    window,
    "alert-detail",
    selectedAlert
      ? `${selectedAlert.title} (${getAlertPriorityLabel(selectedAlert)}) ${selectedAlert.detail}`
      : "Alerts will explain why a tracked or local rival suddenly matters."
  );
  setLabel(
    window,
    "alert-footer",
    `${visibleAlerts.length}/${state.player.watchlist.alerts.length} alerts shown | ${
      state.player.watchlist.lastAlertSummary ?? "No recent alert summary."
    }`
  );
}

function handleUnwatchSelected(): void {
  if (typeof ui === "undefined") {
    return;
  }

  if (!selectedTrackedRivalId) {
    ui.showError(WATCHLIST_WINDOW_TITLE, "Select a tracked rival first.");
    return;
  }

  const snapshot = readPlayerSnapshot();
  const result = toggleWatchlistRivalById(selectedTrackedRivalId, snapshot);
  if (!result.ok) {
    ui.showError(WATCHLIST_WINDOW_TITLE, result.message);
    return;
  }

  park.postMessage(`[World Park League] ${result.message}`);
  updateWatchlistContents(result.state, readPlayerSnapshot());
}

function formatAlertTime(dayIndex: number): string {
  const month = Math.floor(dayIndex / 31) + 1;
  const day = (dayIndex % 31) + 1;
  return `M${month} D${day}`;
}

function setButtonDisabled(window: Window, name: string, isDisabled: boolean): void {
  const widget = window.findWidget(name) as ButtonWidget | null;
  if (widget) {
    widget.isDisabled = isDisabled;
  }
}

function setLabel(window: Window, name: string, text: string): void {
  const widget = window.findWidget(name) as LabelWidget | null;
  if (widget) {
    widget.text = text;
  }
}
