import {
  BREAKOUT_TITLE,
  DAYS_PER_MONTH,
  FEATURED_TITLE,
  PLAYER_PARK_ID,
  SPOTLIGHT_TITLE,
  SUPPORTING_BOOST_DURATION_DAYS,
} from "../config";
import {
  grantComplimentaryInvestmentByRivalId,
  MAX_SHARE_PER_RIVAL,
} from "./investments";
import { formatCompactMoney } from "./currency";
import { clamp } from "./math";
import { calculatePlayerEquityValue } from "./player";
import { getLocalMarketSummary } from "./watchlist";
import type {
  NewsItem,
  ParkHistoryPoint,
  PlayerPrestigeAchievement,
  PlayerPrestigeRewardProgram,
  PlayerPrestigeState,
  PlayerSnapshot,
  WorldParkLeagueState,
} from "../types";

export interface PrestigeProgressItem {
  key: string;
  title: string;
  category: string;
  description: string;
  rewardPreview: string;
  completed: boolean;
  progressLabel: string;
  progressRatio: number;
}

interface PrestigeProgressResult {
  completed: boolean;
  progressLabel: string;
  progressRatio: number;
  unlockSummary: string;
}

export interface PrestigeUpdateResult {
  notifications: string[];
  cashDelta: number;
}

export interface PrestigeRewardEffects {
  scoreBonus: number;
  guestCapBonus: number;
  momentumBonus: number;
}

interface AchievementRewardOutcome {
  rewardSummary: string;
  cashDelta: number;
  notifications: string[];
}

interface PrestigeDefinition {
  key: string;
  title: string;
  category: string;
  description: string;
  rewardPreview: string;
  points: number;
  evaluate: (context: PrestigeContext) => PrestigeProgressResult;
}

interface PrestigeContext {
  state: WorldParkLeagueState;
  snapshot: PlayerSnapshot;
  currentTopTenStreak: number;
  localMarketSummary: ReturnType<typeof getLocalMarketSummary>;
}

const PRESTIGE_LONG_BOOST_DAYS = DAYS_PER_MONTH * 2;

const PRESTIGE_DEFINITIONS: PrestigeDefinition[] = [
  {
    key: "guests_1000",
    title: "Grand Opening Crowd",
    category: "Crowd",
    description: "Reach 1,000 live guests in your park.",
    rewardPreview: "1 week Breakout Buzz",
    points: 4,
    evaluate: ({ snapshot }) => ({
      completed: snapshot.guests >= 1_000,
      progressLabel: `${Math.min(1_000, snapshot.guests).toLocaleString("en-US")}/1,000 guests`,
      progressRatio: clamp(snapshot.guests / 1_000, 0, 1),
      unlockSummary: "Your gates are now pulling a four-digit crowd.",
    }),
  },
  {
    key: "share_4",
    title: "Crowd Magnet",
    category: "League",
    description: "Hit 4.0% People Share in the global field.",
    rewardPreview: "1 week Featured Pick",
    points: 6,
    evaluate: ({ state }) => ({
      completed: state.player.marketShare >= 0.04,
      progressLabel: `${(Math.min(0.04, state.player.marketShare) * 100).toFixed(1)}/4.0% share`,
      progressRatio: clamp(state.player.marketShare / 0.04, 0, 1),
      unlockSummary: "Your park is now taking a serious slice of the league audience.",
    }),
  },
  {
    key: "local_lead",
    title: "Local Champion",
    category: "Rivalry",
    description: "Lead your local rival circuit.",
    rewardPreview: `${formatCompactMoney(12_000)} cash bonus`,
    points: 5,
    evaluate: ({ localMarketSummary }) => {
      const progressRatio = localMarketSummary
        ? localMarketSummary.playerLeads
          ? 1
          : clamp(
              localMarketSummary.leaderShare > 0
                ? localMarketSummary.playerShareOfCircuit /
                    Math.max(0.01, localMarketSummary.leaderShare / Math.max(0.01, localMarketSummary.circuitShare))
                : 0,
              0,
              0.99
            )
        : 0;
      return {
        completed: !!localMarketSummary?.playerLeads,
        progressLabel: localMarketSummary
          ? localMarketSummary.playerLeads
            ? "Lead held"
            : `-${(localMarketSummary.shareGapToLeader * 100).toFixed(1)}%`
          : "Forming",
        progressRatio,
        unlockSummary: "You are now the park others in your local circuit are chasing.",
      };
    },
  },
  {
    key: "top10_3m",
    title: "Top 10 Run",
    category: "League",
    description: "Stay in the Top 10 for three consecutive months.",
    rewardPreview: "+8 score for 2 months",
    points: 8,
    evaluate: ({ currentTopTenStreak }) => ({
      completed: currentTopTenStreak >= 3,
      progressLabel: `${Math.min(3, currentTopTenStreak)}/3 months`,
      progressRatio: clamp(currentTopTenStreak / 3, 0, 1),
      unlockSummary: "You are no longer a fluke entrant. The league now treats you as a real contender.",
    }),
  },
  {
    key: "rank1_3m",
    title: "Hold The Crown",
    category: "League",
    description: "Keep rank 1 for three consecutive months.",
    rewardPreview: "1 week World Spotlight",
    points: 12,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.longestRankOneStreak >= 3,
      progressLabel: `${Math.min(3, state.player.monthsAtRankOne)}/3 months`,
      progressRatio: clamp(
        Math.max(state.player.prestige.records.longestRankOneStreak, state.player.monthsAtRankOne) / 3,
        0,
        1
      ),
      unlockSummary: "Your park has shown it can stay on top, not just touch it.",
    }),
  },
  {
    key: "spotlight_first",
    title: "World Spotlight",
    category: "Buzz",
    description: "Capture the World Spotlight once.",
    rewardPreview: `${formatCompactMoney(20_000)} cash payout`,
    points: 9,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.totalSpotlightWins >= 1,
      progressLabel: `${Math.min(1, state.player.prestige.records.totalSpotlightWins)}/1 spotlight`,
      progressRatio: clamp(state.player.prestige.records.totalSpotlightWins, 0, 1),
      unlockSummary: "The entire league turned to look at your park for the month.",
    }),
  },
  {
    key: "featured_first",
    title: "Featured Pick",
    category: "Buzz",
    description: "Land the weekly Featured Pick once.",
    rewardPreview: "Free 5% rival stake",
    points: 4,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.totalFeaturedWins >= 1,
      progressLabel: `${Math.min(1, state.player.prestige.records.totalFeaturedWins)}/1 feature`,
      progressRatio: clamp(state.player.prestige.records.totalFeaturedWins, 0, 1),
      unlockSummary: "Your park broke through the chasing pack and caught a visible media lift.",
    }),
  },
  {
    key: "buzz_first",
    title: "Buzz Breakout",
    category: "Buzz",
    description: "Catch Breakout Buzz once.",
    rewardPreview: `${formatCompactMoney(8_000)} cash bonus`,
    points: 3,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.totalBuzzWins >= 1,
      progressLabel: `${Math.min(1, state.player.prestige.records.totalBuzzWins)}/1 buzz`,
      progressRatio: clamp(state.player.prestige.records.totalBuzzWins, 0, 1),
      unlockSummary: "Even from deeper in the table, your park found a wave of attention.",
    }),
  },
  {
    key: "award_yearly",
    title: "Annual Crown",
    category: "Prestige",
    description: "Win Best Park of the Year.",
    rewardPreview: "+10 score for 2 months",
    points: 14,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.totalYearlyAwards >= 1,
      progressLabel: `${Math.min(1, state.player.prestige.records.totalYearlyAwards)}/1 award`,
      progressRatio: clamp(state.player.prestige.records.totalYearlyAwards, 0, 1),
      unlockSummary: "Your park claimed the league's biggest annual honour.",
    }),
  },
  {
    key: "cash_100k",
    title: "Cash Cushion",
    category: "Finance",
    description: `Hold ${formatCompactMoney(100_000)} in owner cash at once.`,
    rewardPreview: `${formatCompactMoney(15_000)} liquidity bonus`,
    points: 4,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.peakMoney >= 100_000,
      progressLabel: `${formatCompactMoney(Math.min(100_000, state.player.prestige.records.peakMoney))}/${formatCompactMoney(100_000)}`,
      progressRatio: clamp(state.player.prestige.records.peakMoney / 100_000, 0, 1),
      unlockSummary: "You built enough liquidity to stop playing every month on the edge.",
    }),
  },
  {
    key: "equity_1m",
    title: "Million Value Park",
    category: "Finance",
    description: `Reach ${formatCompactMoney(1_000_000)} in equity value.`,
    rewardPreview: "+6 score for 2 months",
    points: 6,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.peakEquityValue >= 1_000_000,
      progressLabel: `${formatCompactMoney(Math.min(1_000_000, state.player.prestige.records.peakEquityValue))}/${formatCompactMoney(1_000_000)}`,
      progressRatio: clamp(state.player.prestige.records.peakEquityValue / 1_000_000, 0, 1),
      unlockSummary: "Your park crossed the line from small operator to serious asset.",
    }),
  },
  {
    key: "profit_25k",
    title: "Cash Machine",
    category: "Finance",
    description: `Post a ${formatCompactMoney(25_000)} monthly profit.`,
    rewardPreview: `${formatCompactMoney(18_000)} cash payout`,
    points: 5,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.peakMonthlyProfit >= 25_000,
      progressLabel: `${formatCompactMoney(Math.min(25_000, state.player.prestige.records.peakMonthlyProfit))}/${formatCompactMoney(25_000)}`,
      progressRatio: clamp(state.player.prestige.records.peakMonthlyProfit / 25_000, 0, 1),
      unlockSummary: "Your operations are now strong enough to spin off real surplus cash.",
    }),
  },
  {
    key: "holdings_3",
    title: "Mini Conglomerate",
    category: "Investing",
    description: "Hold stakes in three rivals at once.",
    rewardPreview: "Free 5% rival stake",
    points: 6,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.peakPortfolioHoldings >= 3,
      progressLabel: `${Math.min(3, state.player.prestige.records.peakPortfolioHoldings)}/3 holdings`,
      progressRatio: clamp(state.player.prestige.records.peakPortfolioHoldings / 3, 0, 1),
      unlockSummary: "You are no longer only running one park. You are shaping a network around it.",
    }),
  },
  {
    key: "mergers_3",
    title: "Industry Veteran",
    category: "World",
    description: "Witness three mergers in the league.",
    rewardPreview: "Free 5% consolidation stake",
    points: 5,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.totalMergersWitnessed >= 3,
      progressLabel: `${Math.min(3, state.player.prestige.records.totalMergersWitnessed)}/3 mergers`,
      progressRatio: clamp(state.player.prestige.records.totalMergersWitnessed / 3, 0, 1),
      unlockSummary: "You have lived through enough consolidation to feel the market really shifting around you.",
    }),
  },
  {
    key: "bankruptcies_2",
    title: "Survivor",
    category: "World",
    description: "See two rivals go bankrupt.",
    rewardPreview: "1 week Breakout Buzz",
    points: 5,
    evaluate: ({ state }) => ({
      completed: state.player.prestige.records.totalBankruptciesWitnessed >= 2,
      progressLabel: `${Math.min(2, state.player.prestige.records.totalBankruptciesWitnessed)}/2 exits`,
      progressRatio: clamp(state.player.prestige.records.totalBankruptciesWitnessed / 2, 0, 1),
      unlockSummary: "You stayed in the fight long enough to see weaker operators wash out of the field.",
    }),
  },
];

export function createInitialPrestigeState(): PlayerPrestigeState {
  return {
    prestigeScore: 0,
    unlockedAchievements: [],
    lastUnlockSummary: null,
    lastRewardSummary: null,
    activeRewards: [],
    records: {
      bestRank: null,
      peakScore: 0,
      peakGuests: 0,
      peakMoney: 0,
      peakParkValue: 0,
      peakEquityValue: 0,
      peakPeopleShare: 0,
      peakMonthlyProfit: 0,
      bestGuestCapModifier: 1,
      peakPortfolioHoldings: 0,
      peakPortfolioValue: 0,
      totalSpotlightWins: 0,
      totalFeaturedWins: 0,
      totalBuzzWins: 0,
      totalYearlyAwards: 0,
      totalMergersWitnessed: 0,
      totalBankruptciesWitnessed: 0,
      longestTopTenStreak: 0,
      longestRankOneStreak: 0,
    },
  };
}

export function updatePrestigeProgress(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  headlines: NewsItem[]
): PrestigeUpdateResult {
  const notifications: string[] = [];
  let cashDelta = 0;
  const prestige = state.player.prestige;
  const records = prestige.records;
  const equityValue = calculatePlayerEquityValue(snapshot);
  const currentTopTenStreak = calculateTopTenMonthStreak(state);

  records.bestRank =
    state.player.currentRank === null
      ? records.bestRank
      : records.bestRank === null
        ? state.player.currentRank
        : Math.min(records.bestRank, state.player.currentRank);
  records.peakScore = Math.max(records.peakScore, state.player.score);
  records.peakGuests = Math.max(records.peakGuests, snapshot.guests);
  records.peakMoney = Math.max(records.peakMoney, state.player.owner.cash);
  records.peakParkValue = Math.max(records.peakParkValue, snapshot.parkValue);
  records.peakEquityValue = Math.max(records.peakEquityValue, equityValue);
  records.peakPeopleShare = Math.max(records.peakPeopleShare, state.player.marketShare);
  records.peakMonthlyProfit = Math.max(records.peakMonthlyProfit, snapshot.lastMonthOperatingProfit);
  records.bestGuestCapModifier = Math.max(records.bestGuestCapModifier, state.player.guestCapModifier);
  records.peakPortfolioHoldings = Math.max(records.peakPortfolioHoldings, state.player.investments.length);
  records.peakPortfolioValue = Math.max(
    records.peakPortfolioValue,
    state.player.investmentSummary.portfolioValue
  );
  records.longestTopTenStreak = Math.max(records.longestTopTenStreak, currentTopTenStreak);
  records.longestRankOneStreak = Math.max(records.longestRankOneStreak, state.player.monthsAtRankOne);

  for (const headline of headlines) {
    if (headline.parkId === PLAYER_PARK_ID && headline.headline.includes(`captures ${SPOTLIGHT_TITLE}`)) {
      records.totalSpotlightWins += 1;
    }
    if (headline.parkId === PLAYER_PARK_ID && headline.headline.includes(`lands the ${FEATURED_TITLE}`)) {
      records.totalFeaturedWins += 1;
    }
    if (headline.parkId === PLAYER_PARK_ID && headline.headline.includes(`catches ${BREAKOUT_TITLE}`)) {
      records.totalBuzzWins += 1;
    }
    if (headline.parkId === PLAYER_PARK_ID && headline.headline.includes("wins Best Park of the Year")) {
      records.totalYearlyAwards += 1;
    }
    if (headline.category === "merger") {
      records.totalMergersWitnessed += 1;
    }
    if (/bankruptcy protection/i.test(headline.headline)) {
      records.totalBankruptciesWitnessed += 1;
    }
  }

  const unlockedKeys = new Set(prestige.unlockedAchievements.map((achievement) => achievement.key));
  const context: PrestigeContext = {
    state,
    snapshot,
    currentTopTenStreak,
    localMarketSummary: getLocalMarketSummary(state),
  };

  for (const definition of PRESTIGE_DEFINITIONS) {
    if (unlockedKeys.has(definition.key)) {
      continue;
    }

    const result = definition.evaluate(context);
    if (!result.completed) {
      continue;
    }

    const reward = applyAchievementReward(definition, context);
    const achievement: PlayerPrestigeAchievement = {
      key: definition.key,
      title: definition.title,
      summary: result.unlockSummary,
      rewardSummary: reward.rewardSummary,
      unlockedAtMonth: snapshot.currentMonth,
      unlockedAtDayIndex: snapshot.currentDayIndex,
    };
    prestige.unlockedAchievements.unshift(achievement);
    prestige.lastUnlockSummary = `${definition.title}: ${result.unlockSummary}`;
    prestige.lastRewardSummary = reward.rewardSummary;
    notifications.push(`Prestige unlocked: ${definition.title}. ${result.unlockSummary}`);
    notifications.push(...reward.notifications);
    cashDelta += reward.cashDelta;
    unlockedKeys.add(definition.key);
  }

  prestige.prestigeScore = calculatePrestigeScore(state);
  return {
    notifications,
    cashDelta,
  };
}

export function buildPrestigeProgress(state: WorldParkLeagueState, snapshot: PlayerSnapshot): PrestigeProgressItem[] {
  const context: PrestigeContext = {
    state,
    snapshot,
    currentTopTenStreak: calculateTopTenMonthStreak(state),
    localMarketSummary: getLocalMarketSummary(state),
  };

  return PRESTIGE_DEFINITIONS.map((definition) => {
    const result = definition.evaluate(context);
    return {
      key: definition.key,
      title: definition.title,
      category: definition.category,
      description: definition.description,
      rewardPreview: definition.rewardPreview,
      completed: result.completed,
      progressLabel: result.progressLabel,
      progressRatio: result.progressRatio,
    };
  });
}

export function getPrestigeHeadline(state: WorldParkLeagueState): string {
  const unlocked = state.player.prestige.unlockedAchievements.length;
  const total = PRESTIGE_DEFINITIONS.length;
  return `${unlocked}/${total} achievements | Prestige ${state.player.prestige.prestigeScore}`;
}

export function getPrestigeDefinitionCount(): number {
  return PRESTIGE_DEFINITIONS.length;
}

export function getNextPrestigeGoal(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): PrestigeProgressItem | null {
  const goals = buildPrestigeProgress(state, snapshot)
    .filter((goal) => !goal.completed)
    .sort((left, right) => {
      if (left.progressRatio !== right.progressRatio) {
        return right.progressRatio - left.progressRatio;
      }

      return left.title.localeCompare(right.title);
    });

  return goals[0] ?? null;
}

export function advancePrestigeRewardsForDays(
  state: WorldParkLeagueState,
  daysElapsed: number
): string[] {
  const notifications: string[] = [];
  const elapsed = Math.max(1, Math.round(daysElapsed));
  const remaining: PlayerPrestigeRewardProgram[] = [];

  for (const reward of state.player.prestige.activeRewards) {
    const nextDays = reward.daysRemaining - elapsed;
    if (nextDays <= 0) {
      notifications.push(`${reward.title} has faded.`);
      continue;
    }

    remaining.push({
      ...reward,
      daysRemaining: nextDays,
    });
  }

  state.player.prestige.activeRewards = remaining;
  return notifications;
}

export function getPrestigeRewardEffects(state: WorldParkLeagueState): PrestigeRewardEffects {
  return state.player.prestige.activeRewards.reduce<PrestigeRewardEffects>(
    (totals, reward) => ({
      scoreBonus: totals.scoreBonus + reward.scoreBonus,
      guestCapBonus: totals.guestCapBonus + reward.guestCapBonus,
      momentumBonus: totals.momentumBonus + reward.momentumBonus,
    }),
    {
      scoreBonus: 0,
      guestCapBonus: 0,
      momentumBonus: 0,
    }
  );
}

export function getPrestigeRewardSummary(state: WorldParkLeagueState): string {
  const rewards = state.player.prestige.activeRewards;
  if (rewards.length === 0) {
    return "None";
  }

  const first = rewards[0];
  if (!first) {
    return "None";
  }

  const mainLabel =
    first.scoreBonus > 0
      ? `+${first.scoreBonus.toFixed(0)} score`
      : trimText(first.title, 16);
  if (rewards.length === 1) {
    return `${mainLabel} ${first.daysRemaining}d`;
  }

  return `${mainLabel} ${first.daysRemaining}d | +${rewards.length - 1} more`;
}

function applyAchievementReward(
  definition: PrestigeDefinition,
  context: PrestigeContext
): AchievementRewardOutcome {
  switch (definition.key) {
    case "guests_1000":
      return activateRewardBoost(
        context.state,
        context.snapshot,
        "buzz",
        SUPPORTING_BOOST_DURATION_DAYS,
        "Achievement reward: Breakout Buzz for one week."
      );
    case "share_4":
      return activateRewardBoost(
        context.state,
        context.snapshot,
        "featured",
        SUPPORTING_BOOST_DURATION_DAYS,
        "Achievement reward: Featured Pick for one week."
      );
    case "local_lead":
      return grantCashReward(
        context.state,
        12_000,
        `Achievement reward: ${formatCompactMoney(12_000)} local winner bonus.`
      );
    case "top10_3m":
      return launchPrestigeRewardProgram(
        context.state,
        definition.key,
        "Contender Aura",
        "A two-month score glow for proving you belong in the Top 10.",
        "Achievement reward: +8 score for two months.",
        PRESTIGE_LONG_BOOST_DAYS,
        8,
        0.025,
        2.2
      );
    case "rank1_3m":
      return activateRewardBoost(
        context.state,
        context.snapshot,
        "spotlight",
        SUPPORTING_BOOST_DURATION_DAYS,
        "Achievement reward: World Spotlight for one week."
      );
    case "spotlight_first":
      return grantCashReward(
        context.state,
        20_000,
        `Achievement reward: ${formatCompactMoney(20_000)} global spotlight payout.`
      );
    case "featured_first":
      return grantComplimentaryStakeReward(
        context,
        0.05,
        "Achievement reward: complimentary 5% media-era stake."
      );
    case "buzz_first":
      return grantCashReward(
        context.state,
        8_000,
        `Achievement reward: ${formatCompactMoney(8_000)} breakout buzz bonus.`
      );
    case "award_yearly":
      return launchPrestigeRewardProgram(
        context.state,
        definition.key,
        "Champion's Run",
        "A two-month champion's aura that keeps your score and crowd momentum elevated.",
        "Achievement reward: +10 score for two months.",
        PRESTIGE_LONG_BOOST_DAYS,
        10,
        0.04,
        3
      );
    case "cash_100k":
      return grantCashReward(
        context.state,
        15_000,
        `Achievement reward: ${formatCompactMoney(15_000)} liquidity bonus.`
      );
    case "equity_1m":
      return launchPrestigeRewardProgram(
        context.state,
        definition.key,
        "Investor Glow",
        "A two-month prestige lift that makes the market treat your park like a proven asset.",
        "Achievement reward: +6 score for two months.",
        PRESTIGE_LONG_BOOST_DAYS,
        6,
        0.02,
        1.8
      );
    case "profit_25k":
      return grantCashReward(
        context.state,
        18_000,
        `Achievement reward: ${formatCompactMoney(18_000)} profit-sharing bonus.`
      );
    case "holdings_3":
      return grantComplimentaryStakeReward(
        context,
        0.05,
        "Achievement reward: complimentary 5% portfolio expansion stake."
      );
    case "mergers_3":
      return grantComplimentaryStakeReward(
        context,
        0.05,
        "Achievement reward: complimentary 5% consolidation stake."
      );
    case "bankruptcies_2":
      return activateRewardBoost(
        context.state,
        context.snapshot,
        "buzz",
        SUPPORTING_BOOST_DURATION_DAYS,
        "Achievement reward: Breakout Buzz for one week."
      );
    default:
      return {
        rewardSummary: "No extra reward.",
        cashDelta: 0,
        notifications: [],
      };
  }
}

function grantCashReward(
  state: WorldParkLeagueState,
  amount: number,
  rewardSummary: string
): AchievementRewardOutcome {
  const scaledAmount = Math.round(amount * state.config.prestigeRewardCashMultiplier);
  state.player.prestige.lastRewardSummary = rewardSummary;
  return {
    rewardSummary,
    cashDelta: scaledAmount,
    notifications: [`Prestige reward: received ${formatCompactMoney(scaledAmount)}.`],
  };
}

function launchPrestigeRewardProgram(
  state: WorldParkLeagueState,
  sourceAchievementKey: string,
  title: string,
  summary: string,
  rewardSummary: string,
  daysRemaining: number,
  scoreBonus: number,
  guestCapBonus: number,
  momentumBonus: number
): AchievementRewardOutcome {
  const boostScale = state.config.prestigeRewardBoostMultiplier;
  const existing = state.player.prestige.activeRewards.find(
    (reward) => reward.sourceAchievementKey === sourceAchievementKey
  );
  const scaledScoreBonus = roundMetric(scoreBonus * boostScale);
  const scaledGuestCapBonus = roundMetric(guestCapBonus * boostScale);
  const scaledMomentumBonus = roundMetric(momentumBonus * boostScale);

  if (existing) {
    existing.daysRemaining = Math.max(existing.daysRemaining, daysRemaining);
    existing.scoreBonus = Math.max(existing.scoreBonus, scaledScoreBonus);
    existing.guestCapBonus = Math.max(existing.guestCapBonus, scaledGuestCapBonus);
    existing.momentumBonus = Math.max(existing.momentumBonus, scaledMomentumBonus);
  } else {
    state.player.prestige.activeRewards.push({
      id: `${sourceAchievementKey}-${state.player.prestige.unlockedAchievements.length}`,
      sourceAchievementKey,
      title,
      summary,
      daysRemaining,
      scoreBonus: scaledScoreBonus,
      guestCapBonus: scaledGuestCapBonus,
      momentumBonus: scaledMomentumBonus,
    });
  }

  state.player.prestige.lastRewardSummary = rewardSummary;
  return {
    rewardSummary,
    cashDelta: 0,
    notifications: [`Prestige reward: ${title} is active for ${daysRemaining} days.`],
  };
}

function activateRewardBoost(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  boostType: "spotlight" | "featured" | "buzz",
  daysRemaining: number,
  rewardSummary: string
): AchievementRewardOutcome {
  switch (boostType) {
    case "spotlight":
      state.world.spotlightRewardOverrideParkId = PLAYER_PARK_ID;
      state.world.spotlightRewardOverrideDaysRemaining = Math.max(
        state.world.spotlightRewardOverrideDaysRemaining,
        daysRemaining
      );
      state.world.spotlightParkId = PLAYER_PARK_ID;
      state.world.spotlightParkName = snapshot.parkName;
      state.world.spotlightMonthsRemaining = 1;
      state.world.spotlightGuestMultiplier = state.config.spotlightGuestMultiplier;
      break;
    case "featured":
      state.world.featuredRewardOverrideParkId = PLAYER_PARK_ID;
      state.world.featuredRewardOverrideDaysRemaining = Math.max(
        state.world.featuredRewardOverrideDaysRemaining,
        daysRemaining
      );
      state.world.featuredParkId = PLAYER_PARK_ID;
      state.world.featuredParkName = snapshot.parkName;
      state.world.featuredDaysRemaining = Math.max(state.world.featuredDaysRemaining, daysRemaining);
      state.world.featuredGuestMultiplier = state.config.featuredGuestMultiplier;
      break;
    case "buzz":
      state.world.breakoutRewardOverrideParkId = PLAYER_PARK_ID;
      state.world.breakoutRewardOverrideDaysRemaining = Math.max(
        state.world.breakoutRewardOverrideDaysRemaining,
        daysRemaining
      );
      state.world.breakoutParkId = PLAYER_PARK_ID;
      state.world.breakoutParkName = snapshot.parkName;
      state.world.breakoutDaysRemaining = Math.max(state.world.breakoutDaysRemaining, daysRemaining);
      state.world.breakoutGuestMultiplier = state.config.breakoutGuestMultiplier;
      break;
  }

  state.player.prestige.lastRewardSummary = rewardSummary;
  return {
    rewardSummary,
    cashDelta: 0,
    notifications: [`Prestige reward: ${rewardSummary.replace("Achievement reward: ", "")}`],
  };
}

function grantComplimentaryStakeReward(
  context: PrestigeContext,
  share: number,
  fallbackSummary: string
): AchievementRewardOutcome {
  const target = selectComplimentaryStakeTarget(context, share);
  if (!target) {
    return grantCashReward(
      context.state,
      15_000,
      `${fallbackSummary} No stake target was available, so you received ${formatCompactMoney(15_000)} instead.`
    );
  }

  const grantResult = grantComplimentaryInvestmentByRivalId(
    context.state,
    target.id,
    share,
    context.snapshot.currentMonth
  );
  if (!grantResult.ok || grantResult.grantedShare <= 0) {
    return grantCashReward(
      context.state,
      15_000,
      `${fallbackSummary} No room for the stake, so you received ${formatCompactMoney(15_000)} instead.`
    );
  }

  const rewardSummary = `Achievement reward: complimentary ${(grantResult.grantedShare * 100).toFixed(0)}% stake in ${target.name}.`;
  context.state.player.prestige.lastRewardSummary = rewardSummary;
  return {
    rewardSummary,
    cashDelta: 0,
    notifications: [`Prestige reward: ${grantResult.message}`],
  };
}

function selectComplimentaryStakeTarget(
  context: PrestigeContext,
  desiredShare: number
): { id: string; name: string } | null {
  const candidateIds = [
    context.localMarketSummary && !context.localMarketSummary.playerLeads
      ? context.localMarketSummary.leaderId
      : null,
    ...context.state.player.watchlist.focusRivalIds,
    ...context.state.player.watchlist.watchedRivalIds,
    ...context.state.world.leaderboard.filter((entry) => !entry.isPlayer).map((entry) => entry.parkId),
    ...context.state.world.rivals.filter((rival) => rival.status.active).map((rival) => rival.id),
  ].filter((value): value is string => typeof value === "string" && value !== PLAYER_PARK_ID);

  const uniqueIds = candidateIds.filter(
    (candidateId, index, array) => array.indexOf(candidateId) === index
  );
  for (const rivalId of uniqueIds) {
    const rival = context.state.world.rivals.find((candidate) => candidate.id === rivalId);
    if (!rival || !rival.status.active) {
      continue;
    }

    const currentShare =
      context.state.player.investments.find((investment) => investment.rivalId === rivalId)?.share ?? 0;
    if (currentShare + desiredShare <= MAX_SHARE_PER_RIVAL + 0.000001) {
      return {
        id: rival.id,
        name: rival.name,
      };
    }
  }

  return null;
}

function calculatePrestigeScore(state: WorldParkLeagueState): number {
  const unlockedKeys = new Set(
    state.player.prestige.unlockedAchievements.map((achievement) => achievement.key)
  );
  const definitionPoints = PRESTIGE_DEFINITIONS.reduce(
    (total, definition) => total + (unlockedKeys.has(definition.key) ? definition.points : 0),
    0
  );
  const records = state.player.prestige.records;
  const spotlightPoints = records.totalSpotlightWins * 2;
  const yearlyPoints = records.totalYearlyAwards * 4;
  const streakPoints = records.longestTopTenStreak + records.longestRankOneStreak * 2;
  const financePoints =
    Math.min(10, Math.floor(records.peakMonthlyProfit / 15_000)) +
    Math.min(10, Math.floor(records.peakEquityValue / 500_000));

  return definitionPoints + spotlightPoints + yearlyPoints + streakPoints + financePoints;
}

function calculateTopTenMonthStreak(state: WorldParkLeagueState): number {
  const monthlyPoints = getMonthlyPlayerPoints(state);
  let streak = 0;
  for (let index = monthlyPoints.length - 1; index >= 0; index -= 1) {
    const point = monthlyPoints[index];
    if (!point || point.rank > 10) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function getMonthlyPlayerPoints(state: WorldParkLeagueState): ParkHistoryPoint[] {
  const playerSeries = state.world.history[PLAYER_PARK_ID] ?? [];
  const monthly = new Map<number, ParkHistoryPoint>();
  for (const point of playerSeries) {
    monthly.set(point.month, point);
  }

  return [...monthly.values()].sort((left, right) => left.month - right.month);
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
