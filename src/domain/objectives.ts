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

export function getActiveObjectiveSummary(
  state: WorldParkLeagueState,
  currentDayIndex: number = state.lastLivePulseDayIndex
): string {
  const objective = state.player.objectives.activeObjective;
  if (!objective) {
    return state.player.objectives.lastObjectiveSummary ?? "No active objective.";
  }

  const remaining = Math.max(0, objective.resolveAtDayIndex - currentDayIndex);
  return `${objective.title} | ${remaining}d | ${describeObjectiveTarget(objective)} | reward ${formatMoney(objective.rewardCash)} | risk ${formatMoney(objective.penaltyCash)}`;
}

export function buildActiveObjectiveDetailRows(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): string[] {
  const objective = state.player.objectives.activeObjective;
  if (!objective) {
    const cooldown = state.player.objectives.cooldownDaysRemaining;
    return [
      `Status: ${state.player.objectives.lastObjectiveSummary ?? "No active task right now."}`,
      cooldown > 0
        ? `Next task window: cooldown ${cooldown} day${cooldown === 1 ? "" : "s"} remaining.`
        : "Next task window: a new task can appear on a weekly league tick.",
      `Record: ${state.player.objectives.completedObjectives} completed | ${state.player.objectives.failedObjectives} failed.`,
      "League tasks are checked automatically while you build in the park.",
    ];
  }

  const remaining = Math.max(0, objective.resolveAtDayIndex - snapshot.currentDayIndex);
  return [
    `Active task: ${objective.title}`,
    objective.summary,
    `Progress: ${describeObjectiveProgress(objective, snapshot)}`,
    `Target: ${describeObjectiveTarget(objective)}`,
    `Deadline: ${remaining} day${remaining === 1 ? "" : "s"} remaining`,
    `Reward: ${formatMoney(objective.rewardCash)} | Risk: ${formatMoney(objective.penaltyCash)}`,
    `Do this: ${getObjectiveActionHint(objective.type)}`,
    "No claim button: keep building; the league checks the result automatically.",
  ];
}

export function buildObjectiveTimelineRows(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): string[] {
  const rows: string[] = [];
  const objective = state.player.objectives.activeObjective;
  if (objective) {
    const remaining = Math.max(0, objective.resolveAtDayIndex - snapshot.currentDayIndex);
    rows.push(`Task: ${objective.title} (${remaining}d)`);
    rows.push(`${describeObjectiveProgress(objective, snapshot)}`);
  } else {
    rows.push(`Task: ${state.player.objectives.lastObjectiveSummary ?? "No active task"}`);
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
  const duration = type === "ride_expansion" || type === "coaster_brief" || type === "capacity_push" ? 28 : 21;

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
    baselineTotalRideCount: snapshot.totalRideCount,
    baselineAverageRideExcitement: snapshot.averageRideExcitement,
    targetGuests: calculateGuestTarget(snapshot, type),
    targetRating: calculateRatingTarget(snapshot, type),
    targetProfit: calculateProfitTarget(snapshot, type),
    targetOpenRideCount: calculateRideTarget(snapshot, type),
    targetTotalRideCount: calculateTotalRideTarget(snapshot, type),
    targetAverageRideExcitement: calculateExcitementTarget(snapshot, type),
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
  if (snapshot.totalRideCount >= 5 && snapshot.averageRideExcitement < 6.2 && rng.chance(0.36)) {
    return "coaster_brief";
  }
  if (snapshot.guests >= 950 && snapshot.totalRideCount < Math.max(10, Math.ceil(snapshot.guests / 190)) && rng.chance(0.42)) {
    return "capacity_push";
  }
  if (snapshot.openRideCount < 8 || rng.chance(0.28)) {
    return "ride_expansion";
  }
  if (rng.chance(0.22)) {
    return "coaster_brief";
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
    case "coaster_brief":
      return (
        snapshot.openRideCount >= objective.targetOpenRideCount &&
        snapshot.averageRideExcitement >= objective.targetAverageRideExcitement
      );
    case "capacity_push":
      return (
        snapshot.totalRideCount >= objective.targetTotalRideCount &&
        snapshot.guests >= objective.targetGuests
      );
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
    case "coaster_brief":
      return `${objective.targetOpenRideCount} open rides, ${objective.targetAverageRideExcitement.toFixed(1)} avg excitement`;
    case "capacity_push":
      return `${objective.targetTotalRideCount} rides and ${objective.targetGuests} guests`;
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
    case "coaster_brief":
      return `${snapshot.openRideCount}/${objective.targetOpenRideCount} open rides | ${snapshot.averageRideExcitement.toFixed(1)}/${objective.targetAverageRideExcitement.toFixed(1)} avg excitement`;
    case "capacity_push":
      return `${snapshot.totalRideCount}/${objective.targetTotalRideCount} rides | ${snapshot.guests}/${objective.targetGuests} guests`;
  }
}

function calculateGuestTarget(snapshot: PlayerSnapshot, type: PlayerObjectiveType): number {
  if (type === "capacity_push") {
    return Math.round(snapshot.guests + clamp(snapshot.guests * 0.1, 140, 700));
  }

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
  if (type === "coaster_brief") {
    return snapshot.openRideCount + 1;
  }

  if (type !== "ride_expansion") {
    return 0;
  }

  return snapshot.openRideCount + (snapshot.openRideCount < 8 ? 2 : 1);
}

function calculateTotalRideTarget(snapshot: PlayerSnapshot, type: PlayerObjectiveType): number {
  if (type !== "capacity_push") {
    return 0;
  }

  return snapshot.totalRideCount + (snapshot.totalRideCount < 12 ? 3 : 2);
}

function calculateExcitementTarget(snapshot: PlayerSnapshot, type: PlayerObjectiveType): number {
  if (type !== "coaster_brief") {
    return 0;
  }

  return roundTo(clamp(Math.max(snapshot.averageRideExcitement + 0.35, 6.2), 5.8, 8.5), 1);
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
    case "coaster_brief":
      return "Coaster Brief";
    case "capacity_push":
      return "Capacity Push";
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
    case "coaster_brief":
      return "Add or improve headline rides so the average excitement target is met.";
    case "capacity_push":
      return "Build enough capacity and convert it into real guest growth before the deadline.";
  }
}

function getObjectiveActionHint(type: PlayerObjectiveType): string {
  switch (type) {
    case "guest_growth":
      return "bring in more guests before the deadline.";
    case "rating_hold":
      return "clean paths, fix complaints and keep the park rating high.";
    case "profit_push":
      return "raise monthly operating profit through ride, shop and cost changes.";
    case "ride_expansion":
      return "build and open enough new attractions.";
    case "coaster_brief":
      return "add or improve exciting headline rides, then keep them open.";
    case "capacity_push":
      return "add ride capacity and convert it into guest growth.";
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
