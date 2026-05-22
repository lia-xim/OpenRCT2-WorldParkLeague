import { PLAYER_PARK_ID, SUPPORTING_BOOST_DURATION_DAYS } from "../config";
import { formatMoney } from "./currency";
import { calculatePlayerScoreBreakdown } from "./player";
import { getLocalMarketSummary, isFocusRival, isWatchedRival } from "./watchlist";
import type {
  LeaderboardEntry,
  PlayerRivalChallenge,
  PlayerRivalChallengeState,
  PlayerSnapshot,
  RivalChallengeType,
  WorldParkLeagueState,
} from "../types";

const CHALLENGE_DURATION_DAYS = 28;
const CHALLENGE_COOLDOWN_DAYS = 18;

export interface HeadToHeadSummary {
  rivalId: string;
  rivalName: string;
  rivalRank: number;
  rankGap: number;
  scoreGap: number;
  peopleShareGap: number;
  profitGap: number;
  momentumGap: number;
  recentScoreSwing: number;
  recentShareSwing: number;
  isLocalRival: boolean;
  isWatched: boolean;
  pressureLabel: string;
}

export interface AnalystInsight {
  title: string;
  summary: string;
}

export interface RivalChallengeResolution {
  notifications: string[];
  headlines: {
    title: string;
    detail: string;
    rivalId: string;
    success: boolean;
  }[];
  cashDelta: number;
}

export function createInitialRivalChallengeState(): PlayerRivalChallengeState {
  return {
    activeChallenge: null,
    cooldownDaysRemaining: 0,
    completedChallenges: 0,
    wonChallenges: 0,
    lastChallengeSummary: null,
  };
}

export function getPrimaryRivalSummary(
  state: WorldParkLeagueState,
  preferredRivalId?: string | null
): HeadToHeadSummary | null {
  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer) ?? null;
  if (!playerEntry) {
    return null;
  }

  const candidates = collectRivalCandidates(state, preferredRivalId);
  const rankedCandidates = candidates
    .map((entry) => ({
      entry,
      weight: scoreCandidate(state, playerEntry, entry, preferredRivalId),
    }))
    .sort((left, right) => left.weight - right.weight);
  const rivalEntry = rankedCandidates[0]?.entry ?? null;
  if (!rivalEntry) {
    return null;
  }

  const playerHistory = state.world.history[PLAYER_PARK_ID] ?? [];
  const rivalHistory = state.world.history[rivalEntry.parkId] ?? [];
  const playerScoreDelta = readRecentDelta(playerHistory, "score", 14);
  const rivalScoreDelta = readRecentDelta(rivalHistory, "score", 14);
  const playerShareDelta = readRecentDelta(playerHistory, "marketShare", 14);
  const rivalShareDelta = readRecentDelta(rivalHistory, "marketShare", 14);
  const scoreGap = rivalEntry.score - playerEntry.score;
  const peopleShareGap = rivalEntry.marketShare - playerEntry.marketShare;
  const profitGap = rivalEntry.monthlyProfit - playerEntry.monthlyProfit;
  const momentumGap = rivalEntry.scoreDelta - playerEntry.scoreDelta;

  return {
    rivalId: rivalEntry.parkId,
    rivalName: rivalEntry.parkName,
    rivalRank: rivalEntry.rank,
    rankGap: playerEntry.rank - rivalEntry.rank,
    scoreGap,
    peopleShareGap,
    profitGap,
    momentumGap,
    recentScoreSwing: playerScoreDelta - rivalScoreDelta,
    recentShareSwing: playerShareDelta - rivalShareDelta,
    isLocalRival: isFocusRival(state, rivalEntry.parkId),
    isWatched: isWatchedRival(state, rivalEntry.parkId),
    pressureLabel: resolvePressureLabel(scoreGap, peopleShareGap, profitGap),
  };
}

export function maybeStartRivalChallenge(
  state: WorldParkLeagueState,
  dayIndex: number,
  preferredRivalId?: string | null
): string[] {
  const notifications: string[] = [];
  if (state.player.rivalry.activeChallenge) {
    return notifications;
  }

  state.player.rivalry.cooldownDaysRemaining = Math.max(
    0,
    state.player.rivalry.cooldownDaysRemaining - 1
  );
  if (state.player.rivalry.cooldownDaysRemaining > 0) {
    return notifications;
  }

  const summary = getPrimaryRivalSummary(state, preferredRivalId);
  if (!summary) {
    return notifications;
  }

  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer) ?? null;
  const rivalEntry = state.world.leaderboard.find((entry) => entry.parkId === summary.rivalId) ?? null;
  if (!playerEntry || !rivalEntry) {
    return notifications;
  }

  const challenge = createChallenge(summary, playerEntry, rivalEntry, dayIndex);
  state.player.rivalry.activeChallenge = challenge;
  state.player.rivalry.lastChallengeSummary = `${challenge.title} vs ${challenge.rivalName} is live.`;
  notifications.push(`Rival challenge: ${challenge.title} against ${challenge.rivalName} is live for ${CHALLENGE_DURATION_DAYS} days.`);
  return notifications;
}

export function advanceRivalChallenge(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  dayIndex: number
): RivalChallengeResolution {
  const result: RivalChallengeResolution = {
    notifications: [],
    headlines: [],
    cashDelta: 0,
  };

  const challenge = state.player.rivalry.activeChallenge;
  if (!challenge || dayIndex < challenge.resolveAtDayIndex) {
    return result;
  }

  const playerEntry = state.world.leaderboard.find((entry) => entry.isPlayer) ?? null;
  const rivalEntry = state.world.leaderboard.find((entry) => entry.parkId === challenge.rivalId) ?? null;
  state.player.rivalry.activeChallenge = null;
  state.player.rivalry.completedChallenges += 1;
  state.player.rivalry.cooldownDaysRemaining = CHALLENGE_COOLDOWN_DAYS;

  if (!playerEntry || !rivalEntry) {
    state.player.rivalry.lastChallengeSummary = `${challenge.rivalName} dropped out before the challenge resolved.`;
    result.notifications.push(`Rival challenge void: ${challenge.rivalName} was no longer available when the duel resolved.`);
    return result;
  }

  const won = evaluateChallengeWin(challenge, playerEntry, snapshot, rivalEntry);
  if (won) {
    state.player.rivalry.wonChallenges += 1;
    state.player.rivalry.lastChallengeSummary = `You beat ${challenge.rivalName} in ${challenge.title}.`;
    result.cashDelta += challenge.rewardCash;
    applyChallengeReward(state, challenge, dayIndex);
    result.notifications.push(
      `Challenge won: ${challenge.title} vs ${challenge.rivalName}. Reward ${formatMoney(challenge.rewardCash)} plus ${describeChallengeReward(challenge)}.`
    );
    result.headlines.push({
      title: `You beat ${challenge.rivalName} in a head-to-head challenge.`,
      detail: `The rivalry duel broke your way and paid out ${formatMoney(challenge.rewardCash)} with an extra momentum reward.`,
      rivalId: challenge.rivalId,
      success: true,
    });
    return result;
  }

  state.player.rivalry.lastChallengeSummary = `${challenge.rivalName} held you off in ${challenge.title}.`;
  result.notifications.push(
    `Challenge lost: ${challenge.rivalName} held you off in ${challenge.title}.`
  );
  result.headlines.push({
    title: `${challenge.rivalName} held you off in a rivalry challenge.`,
    detail: `The duel went their way this time, so the reward window passed without paying out.`,
    rivalId: challenge.rivalId,
    success: false,
  });
  return result;
}

export function getActiveChallengeSummary(
  state: WorldParkLeagueState
): string {
  const challenge = state.player.rivalry.activeChallenge;
  if (!challenge) {
    return state.player.rivalry.lastChallengeSummary ?? "No active rival challenge.";
  }

  return `${challenge.title} vs ${challenge.rivalName} | ${remainingChallengeDays(
    challenge,
    Math.max(state.lastLivePulseDayIndex, challenge.issuedAtDayIndex)
  )}d | reward ${formatMoney(challenge.rewardCash)} + ${describeChallengeReward(challenge)}`;
}

export function formatHeadToHeadLine(summary: HeadToHeadSummary | null): string {
  if (!summary) {
    return "No clear rival yet";
  }

  const scoreText =
    Math.abs(summary.scoreGap) < 0.05
      ? "score even"
      : summary.scoreGap > 0
        ? `-${summary.scoreGap.toFixed(1)} score`
        : `+${Math.abs(summary.scoreGap).toFixed(1)} score`;
  const shareText =
    Math.abs(summary.peopleShareGap) < 0.0005
      ? "share even"
      : summary.peopleShareGap > 0
        ? `-${(summary.peopleShareGap * 100).toFixed(1)}% crowd`
        : `+${(Math.abs(summary.peopleShareGap) * 100).toFixed(1)}% crowd`;
  const swingText =
    Math.abs(summary.recentScoreSwing) < 0.1
      ? "flat lately"
      : summary.recentScoreSwing > 0
        ? `you are gaining ${summary.recentScoreSwing.toFixed(1)} score`
        : `${summary.rivalName} is gaining ${Math.abs(summary.recentScoreSwing).toFixed(1)} score`;
  return `${summary.rivalName} | ${scoreText} | ${shareText} | ${swingText}`;
}

export function buildAnalystInsight(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  summary: HeadToHeadSummary | null
): AnalystInsight {
  const localMarketSummary = getLocalMarketSummary(state);
  const breakdown = calculatePlayerScoreBreakdown(snapshot);
  const reasons: string[] = [];
  const challenge = state.player.rivalry.activeChallenge;

  if (summary) {
    if (summary.scoreGap > 3) {
      reasons.push(`${summary.rivalName} has a real score edge`);
    } else if (summary.scoreGap > 0.6) {
      reasons.push(`${summary.rivalName} is just ahead on score`);
    } else if (summary.scoreGap < -2) {
      reasons.push(`you are leading ${summary.rivalName} on score`);
    }

    if (summary.peopleShareGap > 0.008) {
      reasons.push(`you are losing guests to ${summary.rivalName}`);
    } else if (summary.peopleShareGap < -0.006) {
      reasons.push(`you are winning the crowd fight`);
    }

    if (summary.profitGap > 8_000) {
      reasons.push(`${summary.rivalName} is monetizing better`);
    } else if (summary.profitGap < -8_000) {
      reasons.push(`your cash engine is stronger`);
    }

    if (summary.recentScoreSwing > 1.2) {
      reasons.push(`momentum is turning in your favour`);
    } else if (summary.recentScoreSwing < -1.2) {
      reasons.push(`${summary.rivalName} has the hotter run right now`);
    }
  }

  if (challenge) {
    reasons.unshift(`rival challenge live: ${challenge.title.toLowerCase()} vs ${challenge.rivalName}`);
  }

  if (snapshot.lastMonthOperatingProfit < 0) {
    reasons.push("negative monthly profit is dragging your climb");
  } else if (snapshot.lastMonthOperatingProfit < snapshot.lastMonthRevenue * 0.15) {
    reasons.push("thin margins are limiting your pace");
  }

  if (breakdown.guestScore < breakdown.ratingScore - 12) {
    reasons.push("guest count is lagging behind park quality");
  } else if (breakdown.portfolioScore < 45) {
    reasons.push("park depth is still shallow");
  }

  if (localMarketSummary && !localMarketSummary.playerLeads && localMarketSummary.shareGapToLeader > 0.012) {
    reasons.push(`the local race is still favouring ${localMarketSummary.leaderName}`);
  }

  const title = challenge
    ? `Challenge: ${challenge.title}`
    : summary
      ? summary.pressureLabel
      : "Build your climb";
  const summaryText =
    reasons.length > 0
      ? reasons.slice(0, 3).join(" | ")
      : "your park is broadly balanced; steady growth, guests and profit are the main job now";

  return { title, summary: summaryText };
}

function collectRivalCandidates(
  state: WorldParkLeagueState,
  preferredRivalId?: string | null
): LeaderboardEntry[] {
  const pool = new Map<string, LeaderboardEntry>();

  if (preferredRivalId) {
    const preferredEntry = state.world.leaderboard.find(
      (entry) => entry.parkId === preferredRivalId && !entry.isPlayer
    );
    if (preferredEntry) {
      pool.set(preferredEntry.parkId, preferredEntry);
    }
  }

  for (const rivalId of state.player.watchlist.focusRivalIds) {
    const entry = state.world.leaderboard.find((candidate) => candidate.parkId === rivalId && !candidate.isPlayer);
    if (entry) {
      pool.set(entry.parkId, entry);
    }
  }

  for (const rivalId of state.player.watchlist.watchedRivalIds) {
    const entry = state.world.leaderboard.find((candidate) => candidate.parkId === rivalId && !candidate.isPlayer);
    if (entry) {
      pool.set(entry.parkId, entry);
    }
  }

  const playerRank = state.player.currentRank ?? 999;
  for (const entry of state.world.leaderboard) {
    if (entry.isPlayer) {
      continue;
    }

    if (Math.abs(entry.rank - playerRank) <= 6) {
      pool.set(entry.parkId, entry);
    }
  }

  return [...pool.values()];
}

function scoreCandidate(
  state: WorldParkLeagueState,
  playerEntry: LeaderboardEntry,
  rivalEntry: LeaderboardEntry,
  preferredRivalId?: string | null
): number {
  let weight = Math.abs(rivalEntry.rank - playerEntry.rank) * 5;
  weight += Math.abs(rivalEntry.score - playerEntry.score) * 1.4;
  weight += Math.abs(rivalEntry.marketShare - playerEntry.marketShare) * 260;
  if (preferredRivalId && rivalEntry.parkId === preferredRivalId) {
    weight -= 6;
  }
  if (isFocusRival(state, rivalEntry.parkId)) {
    weight -= 5;
  }
  if (isWatchedRival(state, rivalEntry.parkId)) {
    weight -= 2;
  }
  return weight;
}

function readRecentDelta(
  series: WorldParkLeagueState["world"]["history"][string] | undefined,
  key: "score" | "marketShare",
  days: number
): number {
  if (!series || series.length < 2) {
    return 0;
  }

  const latest = series[series.length - 1];
  if (!latest) {
    return 0;
  }

  const targetDay = latest.dayIndex - days;
  const previous =
    [...series].reverse().find((point) => point.dayIndex <= targetDay) ??
    series[0] ??
    null;
  if (!previous) {
    return 0;
  }

  return latest[key] - previous[key];
}

function resolvePressureLabel(scoreGap: number, peopleShareGap: number, profitGap: number): string {
  if (scoreGap > 4 || peopleShareGap > 0.01) {
    return "You are chasing";
  }
  if (scoreGap > 0.5 || profitGap > 5_000) {
    return "A close fight";
  }
  if (scoreGap < -3 && peopleShareGap < -0.008) {
    return "You are setting the pace";
  }
  return "Holding them off";
}

function createChallenge(
  summary: HeadToHeadSummary,
  playerEntry: LeaderboardEntry,
  rivalEntry: LeaderboardEntry,
  dayIndex: number
): PlayerRivalChallenge {
  const type = chooseChallengeType(summary);
  const rewardCash = type === "profit_duel" ? 18_000 : type === "share_sprint" ? 14_000 : 16_000;
  const rewardBoostType = type === "profit_duel" ? "buzz" : "featured";
  const rewardScoreBonus = type === "profit_duel" ? 3.5 : type === "share_sprint" ? 2.5 : 3;

  return {
    id: `${summary.rivalId}:${type}:${dayIndex}`,
    rivalId: summary.rivalId,
    rivalName: summary.rivalName,
    type,
    title: getChallengeTitle(type),
    summary: getChallengeSummary(type, summary.rivalName),
    issuedAtDayIndex: dayIndex,
    resolveAtDayIndex: dayIndex + CHALLENGE_DURATION_DAYS,
    baselinePlayerScore: playerEntry.score,
    baselineRivalScore: rivalEntry.score,
    baselinePlayerShare: playerEntry.marketShare,
    baselineRivalShare: rivalEntry.marketShare,
    baselinePlayerProfit: playerEntry.monthlyProfit,
    baselineRivalProfit: rivalEntry.monthlyProfit,
    rewardCash,
    rewardBoostType,
    rewardBoostDays: SUPPORTING_BOOST_DURATION_DAYS,
    rewardScoreBonus,
    rewardDurationDays: 21,
  };
}

function evaluateChallengeWin(
  challenge: PlayerRivalChallenge,
  playerEntry: LeaderboardEntry,
  snapshot: PlayerSnapshot,
  rivalEntry: LeaderboardEntry
): boolean {
  switch (challenge.type) {
    case "score_sprint": {
      const gapBefore = challenge.baselineRivalScore - challenge.baselinePlayerScore;
      const gapAfter = rivalEntry.score - playerEntry.score;
      return gapAfter <= Math.min(0.5, gapBefore - 1.5);
    }
    case "share_sprint": {
      const gapBefore = challenge.baselineRivalShare - challenge.baselinePlayerShare;
      const gapAfter = rivalEntry.marketShare - playerEntry.marketShare;
      return gapAfter <= Math.min(0.0015, gapBefore - 0.004);
    }
    case "profit_duel":
      return snapshot.lastMonthOperatingProfit >= rivalEntry.monthlyProfit;
  }
}

function applyChallengeReward(
  state: WorldParkLeagueState,
  challenge: PlayerRivalChallenge,
  dayIndex: number
): void {
  if (challenge.rewardBoostType === "featured") {
    state.world.featuredRewardOverrideParkId = PLAYER_PARK_ID;
    state.world.featuredRewardOverrideDaysRemaining = Math.max(
      state.world.featuredRewardOverrideDaysRemaining,
      challenge.rewardBoostDays
    );
  } else if (challenge.rewardBoostType === "buzz") {
    state.world.breakoutRewardOverrideParkId = PLAYER_PARK_ID;
    state.world.breakoutRewardOverrideDaysRemaining = Math.max(
      state.world.breakoutRewardOverrideDaysRemaining,
      challenge.rewardBoostDays
    );
  }

  state.player.prestige.activeRewards.push({
    id: `rival-challenge-${challenge.id}`,
    sourceAchievementKey: `rival-challenge-${challenge.type}`,
    title: `${challenge.title} Reward`,
    summary: `Challenge reward from beating ${challenge.rivalName}.`,
    daysRemaining: challenge.rewardDurationDays,
    scoreBonus: challenge.rewardScoreBonus,
    guestCapBonus: challenge.type === "share_sprint" ? 0.015 : 0.01,
    momentumBonus: challenge.type === "profit_duel" ? 1.6 : 1.2,
  });
  state.player.prestige.lastRewardSummary = `${challenge.title}: ${formatMoney(challenge.rewardCash)} and ${describeChallengeReward(challenge)}.`;
  state.player.rivalry.lastChallengeSummary = `Won ${challenge.title} vs ${challenge.rivalName} on day ${dayIndex + 1}.`;
}

function chooseChallengeType(summary: HeadToHeadSummary): RivalChallengeType {
  if (summary.peopleShareGap > 0.01) {
    return "share_sprint";
  }
  if (summary.profitGap > 6_000) {
    return "profit_duel";
  }
  return "score_sprint";
}

function getChallengeTitle(type: RivalChallengeType): string {
  switch (type) {
    case "share_sprint":
      return "Crowd Race";
    case "profit_duel":
      return "Profit Duel";
    case "score_sprint":
    default:
      return "Score Sprint";
  }
}

function getChallengeSummary(type: RivalChallengeType, rivalName: string): string {
  switch (type) {
    case "share_sprint":
      return `Steal visible people share from ${rivalName} over the next four weeks.`;
    case "profit_duel":
      return `Out-earn ${rivalName} in the next monthly cycle.`;
    case "score_sprint":
    default:
      return `Close the score gap on ${rivalName} before the next month rolls over.`;
  }
}

function describeChallengeReward(challenge: PlayerRivalChallenge): string {
  const boost = challenge.rewardBoostType === "featured" ? "Featured Pick" : "Breakout Buzz";
  return `${boost} + ${challenge.rewardScoreBonus.toFixed(1)} score for ${challenge.rewardDurationDays}d`;
}

function remainingChallengeDays(challenge: PlayerRivalChallenge, currentDayIndex: number): number {
  return Math.max(0, challenge.resolveAtDayIndex - currentDayIndex);
}
