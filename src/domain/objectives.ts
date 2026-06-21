import { DAYS_PER_MONTH, PLAYER_PARK_ID, SUPPORTING_BOOST_DURATION_DAYS } from "../config";
import { formatMoney } from "./currency";
import { getDifficultyProfile } from "./difficulty";
import { clamp, roundTo } from "./math";
import { createScopedRng } from "./random";
import type {
  NewsItem,
  PlayerObjective,
  PlayerObjectiveState,
  PlayerObjectiveType,
  PlayerSnapshot,
  WorldParkLeagueState,
} from "../types";

export interface PlayerObjectiveResolution {
  notifications: string[];
  headlines: NewsItem[];
  cashDelta: number;
}

export function createInitialObjectiveState(): PlayerObjectiveState {
  return {
    activeObjective: null,
    cooldownDaysRemaining: 0,
    completedObjectives: 0,
    failedObjectives: 0,
    lastObjectiveSummary: null,
  };
}

export function maybeStartPlayerObjective(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  dayIndex: number
): string[] {
  const notifications: string[] = [];
  if (state.player.objectives.activeObjective) {
    return notifications;
  }

  state.player.objectives.cooldownDaysRemaining = Math.max(
    0,
    state.player.objectives.cooldownDaysRemaining - 1
  );
  if (state.player.objectives.cooldownDaysRemaining > 0 || dayIndex % 7 !== 0) {
    return notifications;
  }

  const profile = getDifficultyProfile(state.config.difficultyPreset);
  const rng = createScopedRng(state.world.seed, dayIndex, 8123);
  if (!rng.chance(profile.objectiveWeeklyChance)) {
    return notifications;
  }

  const objective = createObjective(state, snapshot, dayIndex, rng);
  state.player.objectives.activeObjective = objective;
  state.player.objectives.lastObjectiveSummary = `${objective.title}: ${objective.summary}`;
  notifications.push(
    `New objective: ${objective.title}. Reward ${formatMoney(objective.rewardCash)}, risk ${formatMoney(objective.penaltyCash)}.`
  );
  return notifications;
}

export function advancePlayerObjective(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  dayIndex: number
): PlayerObjectiveResolution {
  const result: PlayerObjectiveResolution = {
    notifications: [],
    headlines: [],
    cashDelta: 0,
  };
  const objective = state.player.objectives.activeObjective;
  if (!objective || dayIndex < objective.resolveAtDayIndex) {
    return result;
  }

  state.player.objectives.activeObjective = null;
  const succeeded = evaluateObjective(objective, snapshot);
  if (succeeded) {
    state.player.objectives.completedObjectives += 1;
    state.player.objectives.lastObjectiveSummary = `Completed ${objective.title}.`;
    result.cashDelta += objective.rewardCash;
    state.player.prestige.activeRewards.push({
      id: `objective-${objective.id}`,
      sourceAchievementKey: `objective-${objective.type}`,
      title: `${objective.title} Momentum`,
      summary: "Short momentum reward for meeting an active league objective.",
      daysRemaining: SUPPORTING_BOOST_DURATION_DAYS,
      scoreBonus: 1.6,
      guestCapBonus: 0.01,
      momentumBonus: 1.2,
    });
    result.notifications.push(
      `Objective completed: ${objective.title}. Park cash +${formatMoney(objective.rewardCash)}.`
    );
    result.headlines.push(createObjectiveNews(objective, true));
  } else {
    state.player.objectives.failedObjectives += 1;
    state.player.objectives.lastObjectiveSummary = `Failed ${objective.title}.`;
    state.player.governance.boardPatience = clamp(
      state.player.governance.boardPatience - 0.06,
      0.35,
      1.35
    );
    state.player.governance.investorConfidence = clamp(
      state.player.governance.investorConfidence - 0.05,
      0.35,
      1.35
    );
    result.cashDelta -= objective.penaltyCash;
    result.notifications.push(
      `Objective failed: ${objective.title}. Park cash -${formatMoney(objective.penaltyCash)}.`
    );
    result.headlines.push(createObjectiveNews(objective, false));
  }

  state.player.objectives.cooldownDaysRemaining = getDifficultyProfile(
    state.config.difficultyPreset
  ).objectiveCooldownDays;
  return result;
}

export function getActiveObjectiveSummary(state: WorldParkLeagueState): string {
  const objective = state.player.objectives.activeObjective;
  if (!objective) {
    return state.player.objectives.lastObjectiveSummary ?? "No active objective.";
  }

  const remaining = Math.max(0, objective.resolveAtDayIndex - state.lastLivePulseDayIndex);
  return `${objective.title} | ${remaining}d | ${describeObjectiveTarget(objective)} | reward ${formatMoney(objective.rewardCash)} | risk ${formatMoney(objective.penaltyCash)}`;
}

export function buildObjectiveTimelineRows(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): string[] {
  const rows: string[] = [];
  const objective = state.player.objectives.activeObjective;
  if (objective) {
    const remaining = Math.max(0, objective.resolveAtDayIndex - snapshot.currentDayIndex);
    rows.push(`Goal: ${objective.title} (${remaining}d)`);
    rows.push(`${describeObjectiveProgress(objective, snapshot)}`);
  } else {
    rows.push(`Goal: ${state.player.objectives.lastObjectiveSummary ?? "No active goal"}`);
  }

  const challenge = state.player.rivalry.activeChallenge;
  if (challenge) {
    const remaining = Math.max(0, challenge.resolveAtDayIndex - snapshot.currentDayIndex);
    rows.push(`Rival: ${challenge.title} vs ${challenge.rivalName} (${remaining}d)`);
  }

  const pressureHeadline = state.world.newsFeed.find(
    (item) =>
      item.severity === "warning" &&
      /pressure campaign|objective failed|misses|challenge|share shock|bankruptcy/i.test(
        `${item.headline} ${item.detail}`
      )
  );
  if (pressureHeadline) {
    rows.push(`Risk: ${pressureHeadline.headline}`);
  }

  return rows.slice(0, 4);
}

function createObjective(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  dayIndex: number,
  rng: ReturnType<typeof createScopedRng>
): PlayerObjective {
  const type = chooseObjectiveType(snapshot, rng);
  const profile = getDifficultyProfile(state.config.difficultyPreset);
  const baseCash = clamp(
    7_500 + Math.max(0, snapshot.lastMonthOperatingProfit) * 0.42 + snapshot.cash * 0.08,
    6_000,
    52_000
  );
  const rewardCash = Math.round(baseCash * profile.objectiveRewardScale);
  const penaltyCash = Math.round(baseCash * profile.objectivePenaltyScale);
  const duration = type === "ride_expansion" ? 28 : 21;

  return {
    id: `${type}:${dayIndex}`,
    type,
    title: getObjectiveTitle(type),
    summary: getObjectiveSummary(type),
    issuedAtDayIndex: dayIndex,
    resolveAtDayIndex: dayIndex + duration,
    baselineGuests: snapshot.guests,
    baselineRating: snapshot.parkRating,
    baselineProfit: snapshot.lastMonthOperatingProfit,
    baselineOpenRideCount: snapshot.openRideCount,
    targetGuests: calculateGuestTarget(snapshot, type),
    targetRating: calculateRatingTarget(snapshot, type),
    targetProfit: calculateProfitTarget(snapshot, type),
    targetOpenRideCount: calculateRideTarget(snapshot, type),
    rewardCash,
    penaltyCash,
  };
}

function chooseObjectiveType(
  snapshot: PlayerSnapshot,
  rng: ReturnType<typeof createScopedRng>
): PlayerObjectiveType {
  if (snapshot.parkRating < 800) {
    return "rating_hold";
  }
  if (snapshot.lastMonthOperatingProfit < 8_000) {
    return "profit_push";
  }
  if (snapshot.openRideCount < 8 || rng.chance(0.28)) {
    return "ride_expansion";
  }
  return rng.chance(0.55) ? "guest_growth" : "profit_push";
}

function evaluateObjective(objective: PlayerObjective, snapshot: PlayerSnapshot): boolean {
  switch (objective.type) {
    case "guest_growth":
      return snapshot.guests >= objective.targetGuests;
    case "rating_hold":
      return snapshot.parkRating >= objective.targetRating;
    case "profit_push":
      return snapshot.lastMonthOperatingProfit >= objective.targetProfit;
    case "ride_expansion":
      return snapshot.openRideCount >= objective.targetOpenRideCount;
  }
}

function describeObjectiveTarget(objective: PlayerObjective): string {
  switch (objective.type) {
    case "guest_growth":
      return `${objective.targetGuests} guests`;
    case "rating_hold":
      return `${objective.targetRating} rating`;
    case "profit_push":
      return `${formatMoney(objective.targetProfit)} profit`;
    case "ride_expansion":
      return `${objective.targetOpenRideCount} open rides`;
  }
}

function describeObjectiveProgress(objective: PlayerObjective, snapshot: PlayerSnapshot): string {
  switch (objective.type) {
    case "guest_growth":
      return `${snapshot.guests}/${objective.targetGuests} guests`;
    case "rating_hold":
      return `${snapshot.parkRating}/${objective.targetRating} rating`;
    case "profit_push":
      return `${formatMoney(snapshot.lastMonthOperatingProfit)}/${formatMoney(objective.targetProfit)} profit`;
    case "ride_expansion":
      return `${snapshot.openRideCount}/${objective.targetOpenRideCount} open rides`;
  }
}

function calculateGuestTarget(snapshot: PlayerSnapshot, type: PlayerObjectiveType): number {
  if (type !== "guest_growth") {
    return 0;
  }
  return Math.round(snapshot.guests + clamp(snapshot.guests * 0.18, 220, 1_200));
}

function calculateRatingTarget(snapshot: PlayerSnapshot, type: PlayerObjectiveType): number {
  if (type !== "rating_hold") {
    return 0;
  }
  return Math.round(clamp(Math.max(760, snapshot.parkRating + 45), 760, 940));
}

function calculateProfitTarget(snapshot: PlayerSnapshot, type: PlayerObjectiveType): number {
  if (type !== "profit_push") {
    return 0;
  }
  return Math.round(Math.max(8_000, snapshot.lastMonthOperatingProfit + 7_500));
}

function calculateRideTarget(snapshot: PlayerSnapshot, type: PlayerObjectiveType): number {
  if (type !== "ride_expansion") {
    return 0;
  }
  return snapshot.openRideCount + (snapshot.openRideCount < 8 ? 2 : 1);
}

function getObjectiveTitle(type: PlayerObjectiveType): string {
  switch (type) {
    case "guest_growth":
      return "Crowd Target";
    case "rating_hold":
      return "Quality Check";
    case "profit_push":
      return "Profit Target";
    case "ride_expansion":
      return "Expansion Brief";
  }
}

function getObjectiveSummary(type: PlayerObjectiveType): string {
  switch (type) {
    case "guest_growth":
      return "Pull more guests into the park before the deadline.";
    case "rating_hold":
      return "Recover or hold a strong park rating under league scrutiny.";
    case "profit_push":
      return "Prove the park can convert demand into real operating profit.";
    case "ride_expansion":
      return "Add enough open attractions to keep the park from feeling stale.";
  }
}

function createObjectiveNews(objective: PlayerObjective, success: boolean): NewsItem {
  return {
    id: `objective:${objective.id}:${success ? "success" : "fail"}`,
    month: Math.floor(objective.resolveAtDayIndex / DAYS_PER_MONTH),
    category: "player",
    severity: success ? "success" : "warning",
    headline: success
      ? `Your park completes ${objective.title}.`
      : `Your park misses ${objective.title}.`,
    detail: success
      ? `The board rewards the completed target with ${formatMoney(objective.rewardCash)} and a short momentum lift.`
      : `The missed target costs ${formatMoney(objective.penaltyCash)} and weakens board and investor confidence.`,
    parkId: PLAYER_PARK_ID,
  };
}
