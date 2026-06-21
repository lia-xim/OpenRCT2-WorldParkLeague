import { DIFFICULTY_PRESET_ORDER, getDifficultyLabel } from "../src/domain/difficulty";
import type { DifficultyPreset } from "../src/types";
import { DEFAULT_MONTHS, DEFAULT_SEEDS, runBalanceAnalysis } from "./balance-shared";

interface DifficultyScenarioSummary {
  key: string;
  averageRank: number;
  averageGuestCap: number;
  dominanceMonthRate: number;
  averageBoard: number;
  averageInvestors: number;
}

interface DifficultyInvestmentSummary {
  lotShare: number;
  averageRoi: number;
  averageNetProfit: number;
}

interface DifficultyPresetSummary {
  preset: DifficultyPreset;
  label: string;
  scenarios: DifficultyScenarioSummary[];
  investments: DifficultyInvestmentSummary[];
}

function readIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function summarizePreset(preset: DifficultyPreset, months: number, seeds: number): DifficultyPresetSummary {
  const payload = runBalanceAnalysis({
    months,
    seeds,
    configOverride: { difficultyPreset: preset },
  });

  return {
    preset,
    label: getDifficultyLabel(preset),
    scenarios: payload.scenarios.map((scenario) => ({
      key: scenario.key,
      averageRank: round(scenario.averageRank),
      averageGuestCap: round(scenario.averageGuestCap),
      dominanceMonthRate: round(scenario.dominanceMonthRate),
      averageBoard: round(scenario.averageBoard),
      averageInvestors: round(scenario.averageInvestors),
    })),
    investments: payload.investments.map((investment) => ({
      lotShare: investment.lotShare,
      averageRoi: round(investment.averageRoi),
      averageNetProfit: round(investment.averageNetProfit),
    })),
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function main(): void {
  const months = readIntegerEnv("BALANCE_DIFFICULTY_MONTHS", DEFAULT_MONTHS);
  const seeds = readIntegerEnv("BALANCE_DIFFICULTY_SEEDS", DEFAULT_SEEDS);
  const report = {
    months,
    seeds,
    presets: DIFFICULTY_PRESET_ORDER.map((preset) => summarizePreset(preset, months, seeds)),
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
