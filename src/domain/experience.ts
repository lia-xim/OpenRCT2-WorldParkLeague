import { DAYS_PER_MONTH, PLAYER_PARK_ID, SUPPORTING_BOOST_DURATION_DAYS } from "../config";
import { formatMoney } from "./currency";
import { clamp, roundTo } from "./math";
import { createScopedRng } from "./random";
import type {
  NewsItem,
  ParkExperienceEventType,
  PlayerExperienceEvent,
  PlayerExperienceState,
  PlayerRelevantGuest,
  PlayerSnapshot,
  WorldParkLeagueState,
} from "../types";

interface ExperienceDefinition {
  type: ParkExperienceEventType;
  title: string;
  summary: string;
  daysRemaining: number;
  guestCapBonus: number;
  scoreBonus: number;
  momentumBonus: number;
  visualIntensity: number;
  guestWaveSize: number;
  reviewerName: string | null;
}

export interface ExperienceEffects {
  guestCapBonus: number;
  scoreBonus: number;
  momentumBonus: number;
}

export interface ExperienceResolution {
  notifications: string[];
  headlines: NewsItem[];
  cashDelta: number;
}

const EXPERIENCE_DEFINITIONS: Record<ParkExperienceEventType, ExperienceDefinition> = {
  press_day: {
    type: "press_day",
    title: "Press Day",
    summary: "Reporters arrive after your league buzz and push the park into the local conversation.",
    daysRemaining: 3,
    guestCapBonus: 0.018,
    scoreBonus: 0.6,
    momentumBonus: 0.8,
    visualIntensity: 8,
    guestWaveSize: 12,
    reviewerName: null,
  },
  school_trip: {
    type: "school_trip",
    title: "School Trip",
    summary: "A regional school group floods the paths and gives the park a clear weekday crowd spike.",
    daysRemaining: 2,
    guestCapBonus: 0.026,
    scoreBonus: 0.3,
    momentumBonus: 0.5,
    visualIntensity: 6,
    guestWaveSize: 18,
    reviewerName: null,
  },
  influencer_event: {
    type: "influencer_event",
    title: "Influencer Event",
    summary: "Creators turn the park into a trending stop and pull in a short burst of younger guests.",
    daysRemaining: 3,
    guestCapBonus: 0.022,
    scoreBonus: 0.7,
    momentumBonus: 1.1,
    visualIntensity: 10,
    guestWaveSize: 10,
    reviewerName: null,
  },
  regional_fan_weekend: {
    type: "regional_fan_weekend",
    title: "Regional Fan Weekend",
    summary: "Local fans organize around your league story and arrive in a visible weekend wave.",
    daysRemaining: 3,
    guestCapBonus: 0.032,
    scoreBonus: 0.4,
    momentumBonus: 0.7,
    visualIntensity: 9,
    guestWaveSize: 16,
    reviewerName: null,
  },
  vip_critic: {
    type: "vip_critic",
    title: "VIP Critic Visit",
    summary: "A named critic enters the park. Their final review will depend on real rating, quality and guest experience.",
    daysRemaining: 5,
    guestCapBonus: 0,
    scoreBonus: 0,
    momentumBonus: 0.2,
    visualIntensity: 5,
    guestWaveSize: 1,
    reviewerName: "Mara Voss, Park Critic",
  },
};

export function createInitialPlayerExperienceState(): PlayerExperienceState {
  return {
    activeEvent: null,
    lastEventSummary: null,
    lastPresentedEventId: null,
    recentEventSummaries: [],
    relevantGuests: [],
    completedReviews: 0,
    positiveReviews: 0,
  };
}

export function getExperienceEffects(state: WorldParkLeagueState): ExperienceEffects {
  const event = state.player.experience.activeEvent;
  if (!event) {
    return { guestCapBonus: 0, scoreBonus: 0, momentumBonus: 0 };
  }

  return {
    guestCapBonus: event.guestCapBonus,
    scoreBonus: event.scoreBonus,
    momentumBonus: event.momentumBonus,
  };
}

export function getActiveExperienceSummary(state: WorldParkLeagueState): string {
  const event = state.player.experience.activeEvent;
  if (!event) {
    return state.player.experience.lastEventSummary ?? "No active park event.";
  }

  return `${event.title} | ${event.daysRemaining}d | ${event.summary}`;
}

export function maybeStartExperienceEventForBoost(
  state: WorldParkLeagueState,
  source: "spotlight" | "featured" | "breakout",
  dayIndex: number
): string[] {
  if (state.player.experience.activeEvent) {
    return [];
  }

  const rng = createScopedRng(state.world.seed, dayIndex, 6131, source.length);
  const type = chooseBoostExperienceType(source, rng);
  const event = createExperienceEvent(type, dayIndex, rng);
  state.player.experience.activeEvent = event;
  state.player.experience.lastEventSummary = `${event.title}: ${event.summary}`;
  state.player.experience.recentEventSummaries = [
    state.player.experience.lastEventSummary,
    ...state.player.experience.recentEventSummaries,
  ].slice(0, 8);

  return [`${event.title} starts in your park. ${event.summary}`];
}

export function maybeStartStandaloneExperienceEvent(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  dayIndex: number
): string[] {
  if (state.player.experience.activeEvent || dayIndex % 7 !== 0) {
    return [];
  }

  const rank = state.player.currentRank ?? 999;
  if (rank > 25 && snapshot.parkRating < 780) {
    return [];
  }

  const rng = createScopedRng(state.world.seed, dayIndex, 9142, rank);
  const chance = rank <= 5 ? 0.08 : rank <= 12 ? 0.055 : 0.035;
  if (!rng.chance(chance)) {
    return [];
  }

  const type: ParkExperienceEventType =
    snapshot.parkRating >= 820 && snapshot.averageRideSatisfaction >= 72 && rng.chance(0.45)
      ? "vip_critic"
      : rng.chance(0.5)
        ? "school_trip"
        : "regional_fan_weekend";
  const event = createExperienceEvent(type, dayIndex, rng);
  state.player.experience.activeEvent = event;
  state.player.experience.lastEventSummary = `${event.title}: ${event.summary}`;
  state.player.experience.recentEventSummaries = [
    state.player.experience.lastEventSummary,
    ...state.player.experience.recentEventSummaries,
  ].slice(0, 8);

  return [`${event.title} starts in your park. ${event.summary}`];
}

export function advanceExperienceForDays(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  dayIndex: number,
  elapsedDays: number
): ExperienceResolution {
  const result: ExperienceResolution = {
    notifications: [],
    headlines: [],
    cashDelta: 0,
  };
  const event = state.player.experience.activeEvent;
  if (!event) {
    return result;
  }

  const nextDays = event.daysRemaining - Math.max(1, Math.round(elapsedDays));
  if (nextDays > 0) {
    state.player.experience.activeEvent = {
      ...event,
      daysRemaining: nextDays,
    };
    return result;
  }

  state.player.experience.activeEvent = null;
  if (event.type !== "vip_critic") {
    state.player.experience.lastEventSummary = `${event.title} ended.`;
    return result;
  }

  const review = evaluateCriticVisit(snapshot);
  state.player.experience.completedReviews += 1;
  if (review.positive) {
    state.player.experience.positiveReviews += 1;
    state.player.prestige.activeRewards.push({
      id: `critic-${event.id}`,
      sourceAchievementKey: "vip-critic-review",
      title: "Positive Review Lift",
      summary: "A park critic published a strong review after visiting your park.",
      daysRemaining: SUPPORTING_BOOST_DURATION_DAYS,
      scoreBonus: 1.3,
      guestCapBonus: 0.012,
      momentumBonus: 1.1,
    });
    result.cashDelta += review.cashDelta;
  } else {
    state.player.governance.boardPatience = clamp(
      state.player.governance.boardPatience - 0.04,
      0.35,
      1.35
    );
    state.player.governance.investorConfidence = clamp(
      state.player.governance.investorConfidence - 0.035,
      0.35,
      1.35
    );
    result.cashDelta += review.cashDelta;
  }

  const headline = review.positive
    ? `${event.reviewerName ?? "A park critic"} publishes a strong review.`
    : `${event.reviewerName ?? "A park critic"} leaves unimpressed.`;
  const detail = review.positive
    ? `The review score lands at ${review.score}/100. The park receives ${formatMoney(review.cashDelta)} in extra bookings and a short prestige lift.`
    : `The review score lands at ${review.score}/100. Refunds and bad press cost ${formatMoney(Math.abs(review.cashDelta))}, while board confidence takes a hit.`;

  state.player.experience.lastEventSummary = `${headline} ${detail}`;
  state.player.experience.recentEventSummaries = [
    state.player.experience.lastEventSummary,
    ...state.player.experience.recentEventSummaries,
  ].slice(0, 8);
  result.notifications.push(state.player.experience.lastEventSummary);
  result.headlines.push({
    id: `experience:${event.id}:${dayIndex}`,
    month: Math.floor(dayIndex / DAYS_PER_MONTH),
    category: "player",
    severity: review.positive ? "success" : "warning",
    headline,
    detail,
    parkId: PLAYER_PARK_ID,
  });

  return result;
}

export function markExperienceEventPresented(
  state: WorldParkLeagueState,
  eventId: string,
  relevantGuests: PlayerRelevantGuest[]
): void {
  state.player.experience.lastPresentedEventId = eventId;
  const reviewer = relevantGuests.find((guest) => guest.role === "critic") ?? null;
  if (state.player.experience.activeEvent?.id === eventId && reviewer && reviewer.guestId !== null) {
    state.player.experience.activeEvent.reviewerGuestId = reviewer.guestId;
  }
  state.player.experience.relevantGuests = [
    ...relevantGuests,
    ...state.player.experience.relevantGuests.filter((guest) => guest.eventId !== eventId),
  ].slice(0, 20);
}

function chooseBoostExperienceType(
  source: "spotlight" | "featured" | "breakout",
  rng: ReturnType<typeof createScopedRng>
): ParkExperienceEventType {
  if (source === "spotlight") {
    if (rng.chance(0.25)) {
      return "vip_critic";
    }

    return rng.chance(0.55) ? "press_day" : "influencer_event";
  }

  if (source === "featured") {
    return rng.chance(0.55) ? "influencer_event" : "regional_fan_weekend";
  }

  return rng.chance(0.55) ? "regional_fan_weekend" : "school_trip";
}

function createExperienceEvent(
  type: ParkExperienceEventType,
  dayIndex: number,
  rng: ReturnType<typeof createScopedRng>
): PlayerExperienceEvent {
  const definition = EXPERIENCE_DEFINITIONS[type];
  const reviewerName =
    type === "vip_critic"
      ? chooseReviewerName(rng)
      : definition.reviewerName;

  return {
    id: `${type}:${dayIndex}`,
    type,
    title: definition.title,
    summary: definition.summary,
    startedAtDayIndex: dayIndex,
    daysRemaining: definition.daysRemaining,
    guestCapBonus: definition.guestCapBonus,
    scoreBonus: definition.scoreBonus,
    momentumBonus: definition.momentumBonus,
    visualIntensity: definition.visualIntensity,
    guestWaveSize: definition.guestWaveSize,
    reviewerName,
    reviewerGuestId: null,
  };
}

function chooseReviewerName(rng: ReturnType<typeof createScopedRng>): string {
  const names = [
    "Mara Voss, Park Critic",
    "Jonas Vale, Travel Editor",
    "Iris Falk, Family Guide",
    "Theo Brandt, Thrill Reviewer",
  ];
  return names[rng.int(0, names.length - 1)] ?? "Mara Voss, Park Critic";
}

function evaluateCriticVisit(snapshot: PlayerSnapshot): {
  positive: boolean;
  score: number;
  cashDelta: number;
} {
  const ratingScore = clamp(snapshot.parkRating / 10, 0, 100);
  const satisfactionScore = clamp(snapshot.averageRideSatisfaction, 0, 100);
  const excitementScore = clamp(snapshot.averageRideExcitement * 12, 0, 100);
  const rideDepthScore = clamp(snapshot.openRideCount * 5 + snapshot.stallCount * 2, 0, 100);
  const profitScore = clamp(50 + snapshot.lastMonthOperatingProfit / 900, 0, 100);
  const score = Math.round(
    ratingScore * 0.32 +
      satisfactionScore * 0.24 +
      excitementScore * 0.2 +
      rideDepthScore * 0.14 +
      profitScore * 0.1
  );
  const positive = score >= 74;
  const base = clamp(snapshot.lastMonthRevenue * 0.18 + snapshot.guests * 8, 4_000, 38_000);
  const cashDelta = Math.round(positive ? base : -base * 0.45);

  return {
    positive,
    score: Math.round(roundTo(score, 0)),
    cashDelta,
  };
}
