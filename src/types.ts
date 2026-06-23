export type RegionKey =
  | "north_america"
  | "europe"
  | "asia_pacific"
  | "latin_america";

export type RivalArchetype =
  | "legacy"
  | "premium"
  | "growth"
  | "destination"
  | "value";

export type RivalStrategyFocus =
  | "balanced"
  | "turnaround"
  | "brand_push"
  | "innovation_bet"
  | "efficiency_drive";

export type PlayerDirective =
  | "balanced"
  | "growth_push"
  | "guest_experience"
  | "profit_focus"
  | "deleveraging";

export type PlayerBoardProposalType =
  | "growth_capex"
  | "guest_experience_program"
  | "debt_repayment"
  | "structured_equity_raise"
  | "share_buyback";

export type PlayerLeagueActionType =
  | "pr_blitz"
  | "guest_festival"
  | "safety_campaign"
  | "efficiency_push"
  | "rival_counter_pr"
  | "local_discount_push"
  | "build_focus";

export type EquityBuyerType =
  | "institutional"
  | "rival"
  | "family_office"
  | "private_equity";

export type NewsCategory =
  | "world"
  | "rival"
  | "award"
  | "merger"
  | "player";

export type NewsSeverity = "info" | "success" | "warning";

export type WatchlistAlertType =
  | "focus_assigned"
  | "rank_overtake"
  | "rank_retake"
  | "scandal"
  | "distress"
  | "expansion"
  | "recovery"
  | "exit";

export type RivalChallengeType =
  | "score_sprint"
  | "share_sprint"
  | "profit_duel";

export type DifficultyPreset = "casual" | "normal" | "hard" | "tycoon";

export type PlayerObjectiveType =
  | "guest_growth"
  | "rating_hold"
  | "profit_push"
  | "ride_expansion"
  | "coaster_brief"
  | "capacity_push";

export type ParkExperienceEventType =
  | "press_day"
  | "school_trip"
  | "influencer_event"
  | "regional_fan_weekend"
  | "vip_critic";

export type PlayerRelevantGuestRole =
  | "critic"
  | "press"
  | "influencer"
  | "school_lead"
  | "fan_lead";

export interface SimulationConfig {
  difficultyPreset: DifficultyPreset;
  rivalCount: number;
  newsRetention: number;
  dominantLeadThreshold: number;
  maxCatchUpPressure: number;
  catchUpPlayerDominanceScale: number;
  catchUpPlayerGrowthScale: number;
  catchUpTenureScale: number;
  catchUpLocalRivalScale: number;
  mergerChance: number;
  challengerChance: number;
  annualMarketGrowthRate: number;
  livePulseIntervalDays: number;
  liveEventIntervalDays: number;
  spotlightGuestMultiplier: number;
  spotlightScoreBonus: number;
  featuredGuestMultiplier: number;
  breakoutGuestMultiplier: number;
  guestCapRankScale: number;
  guestCapShareScale: number;
  guestCapAwardBonus: number;
  guestCapUpperClamp: number;
  investmentSaleMultiplier: number;
  investmentDividendMultiplier: number;
  prestigeRewardCashMultiplier: number;
  prestigeRewardBoostMultiplier: number;
}

export interface RivalStats {
  prestige: number;
  operations: number;
  marketing: number;
  innovation: number;
  guestAppeal: number;
}

export interface RivalFinance {
  debt: number;
  cashReserve: number;
  companyValue: number;
  monthlyRevenue: number;
  monthlyProfit: number;
}

export interface RivalDerived {
  score: number;
  marketShare: number;
  monthlyVisitors: number;
  catchUpPressure: number;
  valuation: number;
  debtRatio: number;
}

export interface RivalStatus {
  active: boolean;
  monthsAtTop: number;
  monthsInSlump: number;
  monthsSinceFounded: number;
  mergedIntoId: string | null;
  lastHeadline: string | null;
  distressLevel: number;
  scandalMonthsRemaining: number;
  expansionMonthsRemaining: number;
  recoveryMonthsRemaining: number;
  strategyFocus: RivalStrategyFocus;
  strategyShiftMonthsRemaining: number;
}

export interface RivalPark {
  id: string;
  name: string;
  region: RegionKey;
  archetype: RivalArchetype;
  tier: number;
  stats: RivalStats;
  finance: RivalFinance;
  derived: RivalDerived;
  status: RivalStatus;
  momentum: number;
  risk: number;
}

export interface NewsItem {
  id: string;
  month: number;
  category: NewsCategory;
  severity: NewsSeverity;
  headline: string;
  detail: string;
  parkId?: string;
}

export interface AwardRecord {
  month: number;
  title: string;
  parkId: string;
  parkName: string;
}

export interface RegionMarketState {
  key: RegionKey;
  demandModifier: number;
  tourismModifier: number;
  competitionModifier: number;
  spotlightMonthsRemaining: number;
  slowdownMonthsRemaining: number;
}

export interface LeaderboardEntry {
  rank: number;
  parkId: string;
  parkName: string;
  isPlayer: boolean;
  score: number;
  scoreDelta: number;
  marketShare: number;
  monthlyProfit: number;
  companyValue: number;
  monthlyVisitors: number;
  debtRatio: number;
  regionLabel: string;
  statusLabel: string;
  trendLabel: string;
}

export type HistoryMetricKey =
  | "score"
  | "momentum"
  | "marketShare"
  | "companyValue"
  | "monthlyProfit"
  | "money"
  | "ownerCash"
  | "ownerNetWorth"
  | "rank";

export interface ParkHistoryPoint {
  dayIndex: number;
  month: number;
  rank: number;
  score: number;
  marketShare: number;
  companyValue: number;
  monthlyProfit: number;
  money: number;
  ownerCash: number;
  ownerNetWorth: number;
  momentum: number;
}

export interface ParkHistoryMarker {
  dayIndex: number;
  month: number;
  label: string;
  severity: NewsSeverity;
}

export interface PlayerInvestment {
  rivalId: string;
  share: number;
  costBasis: number;
  purchasedAtMonth: number;
  totalDividendsReceived: number;
  lastDividend: number;
  realizedProfit: number;
}

export interface PlayerInvestmentSummary {
  holdings: number;
  investedCapital: number;
  portfolioValue: number;
  totalDividendsReceived: number;
  realizedProfit: number;
  lastMonthCashDelta: number;
}

export interface PlayerOwnerState {
  cash: number;
  lastSalary: number;
  totalSalaryReceived: number;
  lifetimeNetCashFlow: number;
  lastCashFlow: number;
  lastCashFlowSummary: string | null;
}

export interface PlayerEquityOffer {
  id: string;
  month: number;
  buyerName: string;
  buyerType: EquityBuyerType;
  buyerRivalId: string | null;
  share: number;
  price: number;
  premiumRate: number;
  expiresAtMonth: number;
}

export interface PlayerEquityState {
  outsideOwnedShare: number;
  totalCashRaised: number;
  activeOffers: PlayerEquityOffer[];
  lastAcceptedOfferSummary: string | null;
  lastDeclinedOfferSummary: string | null;
  lastBuybackSummary: string | null;
}

export interface PlayerGovernanceState {
  investorConfidence: number;
  boardPatience: number;
  activeDirective: PlayerDirective;
  directiveMonthsRemaining: number;
  lastReviewMonth: number | null;
  lastReviewSummary: string | null;
  lastDirectiveScore: number;
  guestCapImpact: number;
  pendingProposals: PlayerBoardProposal[];
  activePrograms: PlayerGovernanceProgram[];
  lastProposalSummary: string | null;
}

export interface PlayerBoardProposal {
  id: string;
  month: number;
  type: PlayerBoardProposalType;
  title: string;
  summary: string;
  expiresAtMonth: number;
  cashDelta: number;
  loanDelta: number;
  outsideOwnershipDelta: number;
  guestCapBonus: number;
  programMonths: number;
  confidenceDelta: number;
  patienceDelta: number;
}

export interface PlayerGovernanceProgram {
  id: string;
  title: string;
  summary: string;
  sourceProposalType: PlayerBoardProposalType;
  monthsRemaining: number;
  guestCapBonus: number;
}

export interface PlayerLeagueActionProgram {
  id: string;
  type: PlayerLeagueActionType;
  title: string;
  summary: string;
  daysRemaining: number;
  scoreBonus: number;
  guestCapBonus: number;
  momentumBonus: number;
  safetyShield: number;
  launchedAtDayIndex: number;
}

export interface PlayerLeagueActionState {
  activeActions: PlayerLeagueActionProgram[];
  lastActionSummary: string | null;
}

export interface WatchlistAlert {
  id: string;
  dayIndex: number;
  month: number;
  rivalId: string;
  parkName: string;
  type: WatchlistAlertType;
  severity: NewsSeverity;
  title: string;
  detail: string;
}

export interface PlayerWatchlistState {
  watchedRivalIds: string[];
  focusRivalIds: string[];
  alerts: WatchlistAlert[];
  lastAlertSummary: string | null;
}

export interface PlayerRivalChallenge {
  id: string;
  rivalId: string;
  rivalName: string;
  type: RivalChallengeType;
  title: string;
  summary: string;
  issuedAtDayIndex: number;
  resolveAtDayIndex: number;
  baselinePlayerScore: number;
  baselineRivalScore: number;
  baselinePlayerShare: number;
  baselineRivalShare: number;
  baselinePlayerProfit: number;
  baselineRivalProfit: number;
  rewardCash: number;
  penaltyCash: number;
  rewardBoostType: "featured" | "buzz" | null;
  rewardBoostDays: number;
  rewardScoreBonus: number;
  rewardDurationDays: number;
}

export interface PlayerRivalChallengeState {
  activeChallenge: PlayerRivalChallenge | null;
  cooldownDaysRemaining: number;
  completedChallenges: number;
  wonChallenges: number;
  lastChallengeSummary: string | null;
}

export interface PlayerObjective {
  id: string;
  type: PlayerObjectiveType;
  title: string;
  summary: string;
  issuedAtDayIndex: number;
  resolveAtDayIndex: number;
  baselineGuests: number;
  baselineRating: number;
  baselineProfit: number;
  baselineOpenRideCount: number;
  baselineTotalRideCount: number;
  baselineAverageRideExcitement: number;
  targetGuests: number;
  targetRating: number;
  targetProfit: number;
  targetOpenRideCount: number;
  targetTotalRideCount: number;
  targetAverageRideExcitement: number;
  rewardCash: number;
  penaltyCash: number;
}

export interface PlayerObjectiveState {
  activeObjective: PlayerObjective | null;
  cooldownDaysRemaining: number;
  completedObjectives: number;
  failedObjectives: number;
  lastObjectiveSummary: string | null;
}

export interface PlayerUiState {
  hasSeenIntro: boolean;
  lastPopupNewsId: string | null;
  lastPopupDayIndex: number;
  popupCooldownDays: number;
}

export interface PlayerExperienceEvent {
  id: string;
  type: ParkExperienceEventType;
  title: string;
  summary: string;
  startedAtDayIndex: number;
  daysRemaining: number;
  guestCapBonus: number;
  scoreBonus: number;
  momentumBonus: number;
  visualIntensity: number;
  guestWaveSize: number;
  reviewerName: string | null;
  reviewerGuestId: number | null;
}

export interface PlayerRelevantGuest {
  id: string;
  guestId: number | null;
  name: string;
  role: PlayerRelevantGuestRole;
  eventId: string;
  eventTitle: string;
  arrivedAtDayIndex: number;
}

export interface PlayerExperienceState {
  activeEvent: PlayerExperienceEvent | null;
  lastEventSummary: string | null;
  lastPresentedEventId: string | null;
  recentEventSummaries: string[];
  relevantGuests: PlayerRelevantGuest[];
  completedReviews: number;
  positiveReviews: number;
}

export interface PlayerPrestigeAchievement {
  key: string;
  title: string;
  summary: string;
  rewardSummary: string;
  unlockedAtMonth: number;
  unlockedAtDayIndex: number;
}

export interface PlayerPrestigeRewardProgram {
  id: string;
  sourceAchievementKey: string;
  title: string;
  summary: string;
  daysRemaining: number;
  scoreBonus: number;
  guestCapBonus: number;
  momentumBonus: number;
}

export interface PlayerPrestigeRecords {
  bestRank: number | null;
  peakScore: number;
  peakGuests: number;
  peakMoney: number;
  peakParkValue: number;
  peakEquityValue: number;
  peakPeopleShare: number;
  peakMonthlyProfit: number;
  bestGuestCapModifier: number;
  peakPortfolioHoldings: number;
  peakPortfolioValue: number;
  totalSpotlightWins: number;
  totalFeaturedWins: number;
  totalBuzzWins: number;
  totalYearlyAwards: number;
  totalMergersWitnessed: number;
  totalBankruptciesWitnessed: number;
  longestTopTenStreak: number;
  longestRankOneStreak: number;
}

export interface PlayerPrestigeState {
  prestigeScore: number;
  unlockedAchievements: PlayerPrestigeAchievement[];
  lastUnlockSummary: string | null;
  lastRewardSummary: string | null;
  activeRewards: PlayerPrestigeRewardProgram[];
  records: PlayerPrestigeRecords;
}

export interface PlayerLeagueState {
  parkName: string;
  currentRank: number | null;
  previousRank: number | null;
  previousScore: number;
  score: number;
  liveMomentum: number;
  marketShare: number;
  guestCapModifier: number;
  monthsAtRankOne: number;
  activeAwardTitle: string | null;
  activeAwardMonthsRemaining: number;
  owner: PlayerOwnerState;
  investments: PlayerInvestment[];
  investmentSummary: PlayerInvestmentSummary;
  equity: PlayerEquityState;
  governance: PlayerGovernanceState;
  actions: PlayerLeagueActionState;
  watchlist: PlayerWatchlistState;
  rivalry: PlayerRivalChallengeState;
  objectives: PlayerObjectiveState;
  ui: PlayerUiState;
  experience: PlayerExperienceState;
  prestige: PlayerPrestigeState;
}

export interface WorldState {
  seed: number;
  economyIndex: number;
  tourismIndex: number;
  competitionHeat: number;
  capitalMarketMood: number;
  globalDemand: number;
  seasonFactor: number;
  structuralGrowthIndex: number;
  safetyScrutinyMonthsRemaining: number;
  spotlightParkId: string | null;
  spotlightParkName: string | null;
  spotlightMonthsRemaining: number;
  spotlightGuestMultiplier: number;
  spotlightRewardOverrideParkId: string | null;
  spotlightRewardOverrideDaysRemaining: number;
  spotlightDebugOverrideParkId: string | null;
  spotlightDebugOverrideDaysRemaining: number;
  featuredParkId: string | null;
  featuredParkName: string | null;
  featuredDaysRemaining: number;
  featuredGuestMultiplier: number;
  featuredRewardOverrideParkId: string | null;
  featuredRewardOverrideDaysRemaining: number;
  featuredDebugOverrideParkId: string | null;
  featuredDebugOverrideDaysRemaining: number;
  breakoutParkId: string | null;
  breakoutParkName: string | null;
  breakoutDaysRemaining: number;
  breakoutGuestMultiplier: number;
  breakoutRewardOverrideParkId: string | null;
  breakoutRewardOverrideDaysRemaining: number;
  breakoutDebugOverrideParkId: string | null;
  breakoutDebugOverrideDaysRemaining: number;
  regionMarkets: Record<RegionKey, RegionMarketState>;
  rivals: RivalPark[];
  newsFeed: NewsItem[];
  awards: AwardRecord[];
  leaderboard: LeaderboardEntry[];
  history: Record<string, ParkHistoryPoint[]>;
  historyEvents: Record<string, ParkHistoryMarker[]>;
}

export interface WorldParkLeagueState {
  schemaVersion: number;
  pluginVersion: string;
  seededAtMonth: number;
  lastSimulatedMonth: number;
  lastLivePulseDayIndex: number;
  lastLiveEventDayIndex: number;
  config: SimulationConfig;
  world: WorldState;
  player: PlayerLeagueState;
}

export interface PlayerSnapshot {
  parkName: string;
  currentMonth: number;
  currentDay: number;
  currentDayIndex: number;
  parkRating: number;
  guests: number;
  parkValue: number;
  companyValue: number;
  cash: number;
  bankLoan: number;
  lastMonthRevenue: number;
  lastMonthOperatingCosts: number;
  lastMonthOperatingProfit: number;
  totalRideCount: number;
  openRideCount: number;
  stallCount: number;
  averageRideExcitement: number;
  averageRideSatisfaction: number;
  totalRideProfit: number;
}

export interface MonthlySimulationResult {
  nextState: WorldParkLeagueState;
  month: number;
  headlines: NewsItem[];
  parkCashDelta: number;
  ownerCashDelta: number;
  playerNotifications: string[];
}

export interface LivePulseResult {
  nextState: WorldParkLeagueState;
  dayIndex: number;
  headlines: NewsItem[];
  parkCashDelta: number;
  ownerCashDelta: number;
  playerNotifications: string[];
}
