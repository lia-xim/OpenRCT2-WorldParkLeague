import type { DifficultyPreset } from "../types";

export interface DifficultyProfile {
  preset: DifficultyPreset;
  label: string;
  objectiveWeeklyChance: number;
  objectiveCooldownDays: number;
  objectiveRewardScale: number;
  objectivePenaltyScale: number;
  challengeRewardScale: number;
  challengePenaltyScale: number;
  investmentShockScale: number;
  rivalPressureChanceScale: number;
  rivalPressureImpactScale: number;
  rivalCatchUpScale: number;
  leaderPressureScale: number;
}

export const DIFFICULTY_PRESET_ORDER: DifficultyPreset[] = [
  "casual",
  "normal",
  "hard",
  "tycoon",
];

const DIFFICULTY_PROFILES: Record<DifficultyPreset, DifficultyProfile> = {
  casual: {
    preset: "casual",
    label: "Casual",
    objectiveWeeklyChance: 0.14,
    objectiveCooldownDays: 38,
    objectiveRewardScale: 1.08,
    objectivePenaltyScale: 0.55,
    challengeRewardScale: 1.08,
    challengePenaltyScale: 0.65,
    investmentShockScale: 0.55,
    rivalPressureChanceScale: 0.6,
    rivalPressureImpactScale: 0.7,
    rivalCatchUpScale: 0.82,
    leaderPressureScale: 0.72,
  },
  normal: {
    preset: "normal",
    label: "Normal",
    objectiveWeeklyChance: 0.28,
    objectiveCooldownDays: 30,
    objectiveRewardScale: 1,
    objectivePenaltyScale: 1,
    challengeRewardScale: 1,
    challengePenaltyScale: 1,
    investmentShockScale: 1,
    rivalPressureChanceScale: 1,
    rivalPressureImpactScale: 1,
    rivalCatchUpScale: 1,
    leaderPressureScale: 1,
  },
  hard: {
    preset: "hard",
    label: "Hard",
    objectiveWeeklyChance: 0.42,
    objectiveCooldownDays: 24,
    objectiveRewardScale: 0.95,
    objectivePenaltyScale: 1.32,
    challengeRewardScale: 0.95,
    challengePenaltyScale: 1.28,
    investmentShockScale: 1.35,
    rivalPressureChanceScale: 1.25,
    rivalPressureImpactScale: 1.22,
    rivalCatchUpScale: 1.16,
    leaderPressureScale: 1.22,
  },
  tycoon: {
    preset: "tycoon",
    label: "Tycoon",
    objectiveWeeklyChance: 0.58,
    objectiveCooldownDays: 18,
    objectiveRewardScale: 0.9,
    objectivePenaltyScale: 1.72,
    challengeRewardScale: 0.92,
    challengePenaltyScale: 1.62,
    investmentShockScale: 1.8,
    rivalPressureChanceScale: 1.55,
    rivalPressureImpactScale: 1.48,
    rivalCatchUpScale: 1.35,
    leaderPressureScale: 1.55,
  },
};

export function getDifficultyProfile(preset: DifficultyPreset): DifficultyProfile {
  return DIFFICULTY_PROFILES[preset] ?? DIFFICULTY_PROFILES.normal;
}

export function getDifficultyLabel(preset: DifficultyPreset): string {
  return getDifficultyProfile(preset).label;
}

export function normalizeDifficultyPreset(value: unknown): DifficultyPreset {
  return value === "casual" || value === "hard" || value === "tycoon" || value === "normal"
    ? value
    : "normal";
}
