import type { PlayerUiState } from "../types";

export function createInitialPlayerUiState(): PlayerUiState {
  return {
    hasSeenIntro: false,
    lastPopupNewsId: null,
    lastPopupDayIndex: -9999,
    popupCooldownDays: 6,
  };
}
