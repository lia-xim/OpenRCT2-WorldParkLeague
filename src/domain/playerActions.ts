import { formatMoney } from "./currency";
import { clamp } from "./math";
import type {
  PlayerLeagueActionProgram,
  PlayerLeagueActionState,
  PlayerLeagueActionType,
  PlayerSnapshot,
  WorldParkLeagueState,
} from "../types";

interface ActionDefinition {
  type: PlayerLeagueActionType;
  title: string;
  summary: string;
  story: string;
  bestUse: string;
  upfrontCost: number;
  daysRemaining: number;
  scoreBonus: number;
  guestCapBonus: number;
  momentumBonus: number;
  safetyShield: number;
}

const ACTION_DEFINITIONS: Record<PlayerLeagueActionType, ActionDefinition> = {
  pr_blitz: {
    type: "pr_blitz",
    title: "PR Blitz",
    summary: "A short, expensive media push that heats up league attention and short-term demand.",
    story: "You flood the region with ads, interviews and local buzz to force yourself back into the conversation.",
    bestUse: "Best when you are close to a rank jump or want momentum before a weekly event cycle.",
    upfrontCost: 12_000,
    daysRemaining: 10,
    scoreBonus: 2.6,
    guestCapBonus: 0.025,
    momentumBonus: 2.4,
    safetyShield: 0,
  },
  guest_festival: {
    type: "guest_festival",
    title: "Guest Festival",
    summary: "An event push that improves guest appeal and lifts your visible league form for two weeks.",
    story: "You stage a headline festival week with themed extras, louder buzz and a reason for guests to choose you now.",
    bestUse: "Best when you need the biggest short-term guest spike and can afford the higher spend.",
    upfrontCost: 18_000,
    daysRemaining: 14,
    scoreBonus: 3.6,
    guestCapBonus: 0.045,
    momentumBonus: 2.1,
    safetyShield: 0,
  },
  safety_campaign: {
    type: "safety_campaign",
    title: "Safety Campaign",
    summary: "Extra staff checks and communication reduce the damage from safety-focused market cycles.",
    story: "You invest in inspections, training and public reassurance so safety scares hurt you less than your rivals.",
    bestUse: "Best during tense market climates or before a risky expansion period.",
    upfrontCost: 14_000,
    daysRemaining: 18,
    scoreBonus: 1.8,
    guestCapBonus: 0.02,
    momentumBonus: 1.2,
    safetyShield: 0.6,
  },
  efficiency_push: {
    type: "efficiency_push",
    title: "Efficiency Push",
    summary: "A sharper operating push that steadies your park and supports league score with modest upside.",
    story: "You tighten operations, scheduling and staffing to squeeze more output from the same park footprint.",
    bestUse: "Best as a cheaper stabilizer when cash is tight or you want a low-risk boost.",
    upfrontCost: 8_000,
    daysRemaining: 16,
    scoreBonus: 1.7,
    guestCapBonus: 0.012,
    momentumBonus: 1.4,
    safetyShield: 0.2,
  },
};

const ACTION_ORDER: PlayerLeagueActionType[] = [
  "pr_blitz",
  "guest_festival",
  "safety_campaign",
  "efficiency_push",
];

export interface PlayerActionEffects {
  scoreBonus: number;
  guestCapBonus: number;
  momentumBonus: number;
  safetyShield: number;
}

export function createInitialPlayerActionState(): PlayerLeagueActionState {
  return {
    activeActions: [],
    lastActionSummary: null,
  };
}

export function getPlayerActionEffects(state: WorldParkLeagueState): PlayerActionEffects {
  return state.player.actions.activeActions.reduce<PlayerActionEffects>(
    (totals, action) => ({
      scoreBonus: totals.scoreBonus + action.scoreBonus,
      guestCapBonus: totals.guestCapBonus + action.guestCapBonus,
      momentumBonus: totals.momentumBonus + action.momentumBonus,
      safetyShield: clamp(totals.safetyShield + action.safetyShield, 0, 0.9),
    }),
    {
      scoreBonus: 0,
      guestCapBonus: 0,
      momentumBonus: 0,
      safetyShield: 0,
    }
  );
}

export function advancePlayerActionsForDay(
  state: WorldParkLeagueState
): string[] {
  const notifications: string[] = [];
  const remaining: PlayerLeagueActionProgram[] = [];

  for (const action of state.player.actions.activeActions) {
    const nextDays = action.daysRemaining - 1;
    if (nextDays <= 0) {
      notifications.push(`${action.title} has run its course.`);
      continue;
    }

    remaining.push({
      ...action,
      daysRemaining: nextDays,
    });
  }

  state.player.actions.activeActions = remaining;
  return notifications;
}

export function launchPlayerLeagueAction(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  type: PlayerLeagueActionType
): { state: WorldParkLeagueState; ok: boolean; message: string; cashDelta: number } {
  const definition = ACTION_DEFINITIONS[type];
  if (!definition) {
    return { state, ok: false, message: "Unknown league action.", cashDelta: 0 };
  }

  if (state.player.actions.activeActions.some((action) => action.type === type)) {
    return { state, ok: false, message: `${definition.title} is already active.`, cashDelta: 0 };
  }

  if (state.player.actions.activeActions.length >= 2) {
    return {
      state,
      ok: false,
      message: "You can only run two league actions at the same time.",
      cashDelta: 0,
    };
  }

  if (snapshot.cash < definition.upfrontCost) {
    return {
      state,
      ok: false,
      message: `You need ${formatMoney(definition.upfrontCost)} to launch ${definition.title}.`,
      cashDelta: 0,
    };
  }

  const nextAction: PlayerLeagueActionProgram = {
    id: `${type}-${snapshot.currentDayIndex}`,
    type: definition.type,
    title: definition.title,
    summary: definition.summary,
    daysRemaining: definition.daysRemaining,
    scoreBonus: definition.scoreBonus,
    guestCapBonus: definition.guestCapBonus,
    momentumBonus: definition.momentumBonus,
    safetyShield: definition.safetyShield,
    launchedAtDayIndex: snapshot.currentDayIndex,
  };

  state.player.actions.activeActions = [...state.player.actions.activeActions, nextAction];
  state.player.actions.lastActionSummary = `${definition.title} launched for ${definition.daysRemaining} days.`;

  return {
    state,
    ok: true,
    message: `${definition.title} launched.`,
    cashDelta: -definition.upfrontCost,
  };
}

export function getActionDefinitionRows(): string[][] {
  return ACTION_ORDER.map((type) => ACTION_DEFINITIONS[type]).map((definition) => [
    definition.title,
    formatMoney(definition.upfrontCost),
    `${definition.daysRemaining}d`,
    getActionImpactLabel(definition),
  ]);
}

export function getActionDefinitionTypes(): PlayerLeagueActionType[] {
  return [...ACTION_ORDER];
}

export function getActionDefinition(
  type: PlayerLeagueActionType
): ActionDefinition | null {
  return ACTION_DEFINITIONS[type] ?? null;
}

export function getPlayerActionSummary(state: WorldParkLeagueState): string {
  const actions = state.player.actions.activeActions;
  if (actions.length === 0) {
    return "No active league actions.";
  }

  return actions
    .map((action) => `${action.title} ${action.daysRemaining}d`)
    .join(" | ");
}

function getActionImpactLabel(definition: ActionDefinition): string {
  if (definition.type === "safety_campaign") {
    return "Safety shield";
  }

  if (definition.type === "efficiency_push") {
    return "Cheap stabilizer";
  }

  if (definition.type === "guest_festival") {
    return "Crowd spike";
  }

  return "Media push";
}
