import { DEFAULT_CONFIG } from "../src/config";
import type { SimulationConfig } from "../src/types";
import type { BalanceAnalysisPayload, ScenarioAggregate } from "./balance-shared";

export interface BalanceCandidateDefinition {
  id: string;
  label: string;
  override: Partial<SimulationConfig>;
}

export interface BalanceObjectiveBreakdown {
  total: number;
  ladderPenalty: number;
  dominancePenalty: number;
  investmentPenalty: number;
  volatilityPenalty: number;
  guestCapPenalty: number;
  notes: string[];
}

const DOMINANT_LEAD_OPTIONS = [0.07, 0.08, 0.09] as const;
const CATCH_UP_OPTIONS = [0.18, 0.22, 0.26] as const;
const SPOTLIGHT_GUEST_OPTIONS = [1.8, 2.4, 3] as const;
const SPOTLIGHT_SCORE_OPTIONS = [1.5, 2.5, 3.5] as const;
const INVESTMENT_SALE_OPTIONS = [0.82, 0.9] as const;
const INVESTMENT_DIVIDEND_OPTIONS = [0.72, 0.82] as const;
const PRESTIGE_CASH_OPTIONS = [0.72, 0.82] as const;
const PRESTIGE_BOOST_OPTIONS = [0.78, 0.9] as const;

export function buildBalanceLabCandidates(): BalanceCandidateDefinition[] {
  const candidates: BalanceCandidateDefinition[] = [
    {
      id: "baseline",
      label: "Baseline",
      override: {},
    },
  ];

  for (const dominantLeadThreshold of DOMINANT_LEAD_OPTIONS) {
    for (const maxCatchUpPressure of CATCH_UP_OPTIONS) {
      for (const spotlightGuestMultiplier of SPOTLIGHT_GUEST_OPTIONS) {
        for (const spotlightScoreBonus of SPOTLIGHT_SCORE_OPTIONS) {
            const id =
              `d${formatShort(dominantLeadThreshold)}-` +
              `c${formatShort(maxCatchUpPressure)}-` +
              `sg${formatShort(spotlightGuestMultiplier)}-` +
              `ss${formatShort(spotlightScoreBonus)}`;
            candidates.push({
              id,
              label:
                `Lead ${dominantLeadThreshold.toFixed(2)}, ` +
                `catch-up ${maxCatchUpPressure.toFixed(2)}, ` +
                `spotlight guests ${spotlightGuestMultiplier.toFixed(2)}, ` +
                `spotlight score ${spotlightScoreBonus.toFixed(2)}`,
              override: {
                dominantLeadThreshold,
                maxCatchUpPressure,
                spotlightGuestMultiplier,
                spotlightScoreBonus,
              },
            });
        }
      }
    }
  }

  return candidates;
}

export function expandEconomicCandidates(
  baseCandidates: BalanceCandidateDefinition[]
): BalanceCandidateDefinition[] {
  const uniqueBases = dedupeCandidates(baseCandidates);
  const expanded = [...uniqueBases];
  const seen = new Set(expanded.map((candidate) => candidate.id));

  for (const candidate of uniqueBases) {
    for (const investmentSaleMultiplier of INVESTMENT_SALE_OPTIONS) {
      for (const investmentDividendMultiplier of INVESTMENT_DIVIDEND_OPTIONS) {
        for (const prestigeRewardCashMultiplier of PRESTIGE_CASH_OPTIONS) {
          for (const prestigeRewardBoostMultiplier of PRESTIGE_BOOST_OPTIONS) {
            const differsFromDefault =
              investmentSaleMultiplier !== DEFAULT_CONFIG.investmentSaleMultiplier ||
              investmentDividendMultiplier !== DEFAULT_CONFIG.investmentDividendMultiplier ||
              prestigeRewardCashMultiplier !== DEFAULT_CONFIG.prestigeRewardCashMultiplier ||
              prestigeRewardBoostMultiplier !== DEFAULT_CONFIG.prestigeRewardBoostMultiplier;
            if (!differsFromDefault) {
              continue;
            }

            const id =
              `${candidate.id}-` +
              `is${formatShort(investmentSaleMultiplier)}-` +
              `id${formatShort(investmentDividendMultiplier)}-` +
              `pc${formatShort(prestigeRewardCashMultiplier)}-` +
              `pb${formatShort(prestigeRewardBoostMultiplier)}`;
            if (seen.has(id)) {
              continue;
            }

            seen.add(id);
            expanded.push({
              id,
              label:
                `${candidate.label}, ` +
                `sale ${investmentSaleMultiplier.toFixed(2)}, ` +
                `dividend ${investmentDividendMultiplier.toFixed(2)}, ` +
                `reward cash ${prestigeRewardCashMultiplier.toFixed(2)}, ` +
                `reward boost ${prestigeRewardBoostMultiplier.toFixed(2)}`,
              override: {
                ...candidate.override,
                investmentSaleMultiplier,
                investmentDividendMultiplier,
                prestigeRewardCashMultiplier,
                prestigeRewardBoostMultiplier,
              },
            });
          }
        }
      }
    }
  }

  return expanded;
}

export function scoreBalancePayload(payload: BalanceAnalysisPayload): BalanceObjectiveBreakdown {
  const weak = requireScenario(payload, "weak");
  const mid = requireScenario(payload, "mid");
  const strong = requireScenario(payload, "strong");
  const dominant = requireScenario(payload, "dominant");
  const averageInvestmentRoi =
    payload.investments.reduce((sum, investment) => sum + investment.averageRoi, 0) /
    Math.max(1, payload.investments.length);

  const notes: string[] = [];
  const ladderPenalty =
    rangePenalty(weak.averageRank, 12, 22, 5, 14, notes, "Weak parks are too compressed.") +
    rangePenalty(mid.averageRank, 4.5, 11, 2.5, 18, notes, "Mid parks are too dominant.") +
    rangePenalty(
      strong.averageRank,
      1.6,
      4.5,
      1.4,
      24,
      notes,
      "Strong parks are sticking to the very top too hard."
    ) +
    rangePenalty(
      dominant.averageRank,
      1,
      2.5,
      0.8,
      14,
      notes,
      "Dominant parks are no longer meaningfully challenged."
    );

  const dominancePenalty =
    upperBoundPenalty(
      weak.dominanceMonthRate,
      0.22,
      0.08,
      10,
      notes,
      "Weak parks are creating too many runaway months."
    ) +
    rangePenalty(
      mid.dominanceMonthRate,
      0.08,
      0.38,
      0.12,
      16,
      notes,
      "Mid parks are either too flat or too oppressive."
    ) +
    rangePenalty(
      strong.dominanceMonthRate,
      0.18,
      0.58,
      0.14,
      26,
      notes,
      "Strong parks dominate too much over long runs."
    ) +
    rangePenalty(
      dominant.dominanceMonthRate,
      0.35,
      0.82,
      0.16,
      20,
      notes,
      "Dominant parks are not leaving enough room for counterplay."
    ) +
    upperBoundPenalty(
      strong.averageTopScoreGap,
      5.5,
      1.5,
      10,
      notes,
      "Top score gaps are getting too wide."
    ) +
    upperBoundPenalty(
      dominant.averageTopScoreGap,
      7,
      1.5,
      10,
      notes,
      "Endgame score gaps are getting too wide."
    );

  const investmentPenalty =
    upperBoundPenalty(
      averageInvestmentRoi,
      0.45,
      0.08,
      24,
      notes,
      "Long-hold investment returns are too generous."
    ) +
    upperBoundPenalty(
      payload.investments[2]?.averageRoi ?? 0,
      0.52,
      0.08,
      18,
      notes,
      "Large strategic stakes are still snowballing too hard."
    );

  const volatilityPenalty =
    lowerBoundPenalty(
      mid.averageRankVolatility,
      0.35,
      0.12,
      8,
      notes,
      "Mid-table movement is too static."
    ) +
    lowerBoundPenalty(
      strong.averageRankVolatility,
      0.22,
      0.08,
      10,
      notes,
      "Top-end movement is too static."
    ) +
    upperBoundPenalty(
      weak.averageRankVolatility,
      2.25,
      0.5,
      6,
      notes,
      "Weak parks are swinging too erratically."
    );

  const guestCapPenalty =
    lowerBoundPenalty(
      weak.averageGuestCap,
      0.78,
      0.08,
      8,
      notes,
      "Weak parks are getting starved on guest cap."
    ) +
    upperBoundPenalty(
      strong.averageGuestCap,
      1.3,
      0.08,
      12,
      notes,
      "Strong parks are stacking too much guest-cap leverage."
    ) +
    upperBoundPenalty(
      dominant.averageGuestCap,
      1.45,
      0.08,
      10,
      notes,
      "Dominant parks are stacking too much guest-cap leverage."
    );

  const total =
    ladderPenalty + dominancePenalty + investmentPenalty + volatilityPenalty + guestCapPenalty;

  return {
    total,
    ladderPenalty,
    dominancePenalty,
    investmentPenalty,
    volatilityPenalty,
    guestCapPenalty,
    notes: dedupeNotes(notes).slice(0, 6),
  };
}

function requireScenario(payload: BalanceAnalysisPayload, key: string): ScenarioAggregate {
  const scenario = payload.scenarios.find((candidate) => candidate.key === key);
  if (!scenario) {
    throw new Error(`Balance payload is missing the ${key} scenario.`);
  }

  return scenario;
}

function dedupeCandidates(
  candidates: BalanceCandidateDefinition[]
): BalanceCandidateDefinition[] {
  const seen = new Set<string>();
  const deduped: BalanceCandidateDefinition[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) {
      continue;
    }

    seen.add(candidate.id);
    deduped.push(candidate);
  }

  return deduped;
}

function rangePenalty(
  actual: number,
  min: number,
  max: number,
  scale: number,
  weight: number,
  notes: string[],
  note: string
): number {
  if (actual < min) {
    notes.push(note);
    return normalizePenalty(min - actual, scale, weight);
  }

  if (actual > max) {
    notes.push(note);
    return normalizePenalty(actual - max, scale, weight);
  }

  return 0;
}

function upperBoundPenalty(
  actual: number,
  max: number,
  scale: number,
  weight: number,
  notes: string[],
  note: string
): number {
  if (actual <= max) {
    return 0;
  }

  notes.push(note);
  return normalizePenalty(actual - max, scale, weight);
}

function lowerBoundPenalty(
  actual: number,
  min: number,
  scale: number,
  weight: number,
  notes: string[],
  note: string
): number {
  if (actual >= min) {
    return 0;
  }

  notes.push(note);
  return normalizePenalty(min - actual, scale, weight);
}

function normalizePenalty(distance: number, scale: number, weight: number): number {
  const normalized = distance / Math.max(scale, 0.0001);
  return normalized * normalized * weight;
}

function dedupeNotes(notes: string[]): string[] {
  return Array.from(new Set(notes));
}

function formatShort(value: number): string {
  return value.toFixed(2).replace(".", "");
}
