import type { SimulationConfig } from "./types";

export const PLUGIN_NAME = "World Park League";
export const PLUGIN_VERSION = "0.22.0";
export const TARGET_API_VERSION = 81;
export const STORAGE_KEY = "worldParkLeague.state";
export const WINDOW_CLASSIFICATION = "world-park-league.main";
export const CURRENT_SCHEMA_VERSION = 24;
export const PLAYER_PARK_ID = "__player__";
export const WORLD_DEMAND_BASE = 14_000;
export const DAYS_PER_MONTH = 31;
export const SPOTLIGHT_TITLE = "World Spotlight";
export const SPOTLIGHT_GUEST_MULTIPLIER = 3;
export const SPOTLIGHT_SCORE_BONUS = 3.5;
export const SPOTLIGHT_DEBUG_OVERRIDE_DAYS = 7;
export const SPOTLIGHT_BURST_INTERVAL_TICKS = 5;
export const SPOTLIGHT_BURST_GUESTS = 3;
export const FEATURED_TITLE = "Featured Pick";
export const FEATURED_GUEST_MULTIPLIER = 1.45;
export const FEATURED_BURST_INTERVAL_TICKS = 10;
export const FEATURED_BURST_GUESTS = 2;
export const BREAKOUT_TITLE = "Breakout Buzz";
export const BREAKOUT_GUEST_MULTIPLIER = 1.2;
export const BREAKOUT_BURST_INTERVAL_TICKS = 12;
export const BREAKOUT_BURST_GUESTS = 1;
export const SUPPORTING_BOOST_DURATION_DAYS = 7;

export const DEFAULT_CONFIG: SimulationConfig = {
  difficultyPreset: "normal",
  rivalCount: 50,
  newsRetention: 28,
  dominantLeadThreshold: 0.06,
  maxCatchUpPressure: 0.36,
  catchUpPlayerDominanceScale: 1.08,
  catchUpPlayerGrowthScale: 0.026,
  catchUpTenureScale: 0.014,
  catchUpLocalRivalScale: 1.5,
  mergerChance: 0.03,
  challengerChance: 0.05,
  annualMarketGrowthRate: 0.07,
  livePulseIntervalDays: 1,
  liveEventIntervalDays: 7,
  spotlightGuestMultiplier: 1.5,
  spotlightScoreBonus: 1,
  featuredGuestMultiplier: 1.18,
  breakoutGuestMultiplier: 1.06,
  guestCapRankScale: 0.16,
  guestCapShareScale: 0.46,
  guestCapAwardBonus: 0.03,
  guestCapUpperClamp: 1.16,
  investmentSaleMultiplier: 0.6,
  investmentDividendMultiplier: 0.42,
  prestigeRewardCashMultiplier: 0.6,
  prestigeRewardBoostMultiplier: 0.66,
};

export const SEASON_FACTORS = [0.92, 0.97, 1.03, 1.08, 1.13, 1.09, 0.99, 0.88] as const;
