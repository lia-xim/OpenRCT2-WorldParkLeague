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
  stickinessPenalty: number;
  investmentPenalty: number;
  volatilityPenalty: number;
  guestCapPenalty: number;
  notes: string[];
}

const DOMINANT_LEAD_OPTIONS = [0.07, 0.08, 0.09] as const;
const CATCH_UP_OPTIONS = [0.26, 0.3, 0.36] as const;
const SPOTLIGHT_GUEST_OPTIONS = [1.5, 1.8] as const;
const SPOTLIGHT_SCORE_OPTIONS = [1, 1.5] as const;
interface GuestCapProfile {
  id: string;
  label: string;
  override: Pick<
    SimulationConfig,
    "guestCapRankScale" | "guestCapShareScale" | "guestCapAwardBonus" | "guestCapUpperClamp"
  >;
}

interface AntiDominanceProfile {
  id: string;
  label: string;
  override: Pick<
    SimulationConfig,
    | "catchUpPlayerDominanceScale"
    | "catchUpPlayerGrowthScale"
    | "catchUpTenureScale"
    | "catchUpLocalRivalScale"
  >;
}

interface EconomicProfile {
  id: string;
  label: string;
  override: Pick<
    SimulationConfig,
    | "investmentSaleMultiplier"
    | "investmentDividendMultiplier"
    | "prestigeRewardCashMultiplier"
    | "prestigeRewardBoostMultiplier"
  >;
}

interface SupportingBoostProfile {
  id: string;
  label: string;
  override: Pick<SimulationConfig, "featuredGuestMultiplier" | "breakoutGuestMultiplier">;
}

const GUEST_CAP_PROFILES: GuestCapProfile[] = [
  {
    id: "gc-default",
    label: "default guest-cap",
    override: {
      guestCapRankScale: 0.2,
      guestCapShareScale: 0.56,
      guestCapAwardBonus: 0.045,
      guestCapUpperClamp: 1.24,
    },
  },
  {
    id: "gc-soft",
    label: "softer guest-cap",
    override: {
      guestCapRankScale: 0.18,
      guestCapShareScale: 0.5,
      guestCapAwardBonus: 0.038,
      guestCapUpperClamp: 1.2,
    },
  },
  {
    id: "gc-tight",
    label: "tight guest-cap",
    override: {
      guestCapRankScale: 0.16,
      guestCapShareScale: 0.46,
      guestCapAwardBonus: 0.03,
      guestCapUpperClamp: 1.16,
    },
  },
];

const ANTI_DOMINANCE_PROFILES: AntiDominanceProfile[] = [
  {
    id: "anti-default",
    label: "default anti-dominance",
    override: {
      catchUpPlayerDominanceScale: DEFAULT_CONFIG.catchUpPlayerDominanceScale,
      catchUpPlayerGrowthScale: DEFAULT_CONFIG.catchUpPlayerGrowthScale,
      catchUpTenureScale: DEFAULT_CONFIG.catchUpTenureScale,
      catchUpLocalRivalScale: DEFAULT_CONFIG.catchUpLocalRivalScale,
    },
  },
  {
    id: "anti-assertive",
    label: "assertive anti-dominance",
    override: {
      catchUpPlayerDominanceScale: 0.94,
      catchUpPlayerGrowthScale: 0.021,
      catchUpTenureScale: 0.011,
      catchUpLocalRivalScale: 1.35,
    },
  },
  {
    id: "anti-aggressive",
    label: "aggressive anti-dominance",
    override: {
      catchUpPlayerDominanceScale: 1.08,
      catchUpPlayerGrowthScale: 0.026,
      catchUpTenureScale: 0.014,
      catchUpLocalRivalScale: 1.5,
    },
  },
];

const ECONOMIC_PROFILES: EconomicProfile[] = [
  {
    id: "econ-default",
    label: "default economy",
    override: {
      investmentSaleMultiplier: DEFAULT_CONFIG.investmentSaleMultiplier,
      investmentDividendMultiplier: DEFAULT_CONFIG.investmentDividendMultiplier,
      prestigeRewardCashMultiplier: DEFAULT_CONFIG.prestigeRewardCashMultiplier,
      prestigeRewardBoostMultiplier: DEFAULT_CONFIG.prestigeRewardBoostMultiplier,
    },
  },
  {
    id: "econ-light",
    label: "moderate portfolio returns",
    override: {
      investmentSaleMultiplier: 0.66,
      investmentDividendMultiplier: 0.5,
      prestigeRewardCashMultiplier: 0.68,
      prestigeRewardBoostMultiplier: 0.74,
    },
  },
  {
    id: "econ-hard",
    label: "hard portfolio restraint",
    override: {
      investmentSaleMultiplier: 0.54,
      investmentDividendMultiplier: 0.34,
      prestigeRewardCashMultiplier: 0.6,
      prestigeRewardBoostMultiplier: 0.66,
    },
  },
];

const SUPPORTING_BOOST_PROFILES: SupportingBoostProfile[] = [
  {
    id: "boost-default",
    label: "default support boosts",
    override: {
      featuredGuestMultiplier: DEFAULT_CONFIG.featuredGuestMultiplier,
      breakoutGuestMultiplier: DEFAULT_CONFIG.breakoutGuestMultiplier,
    },
  },
  {
    id: "boost-soft",
    label: "softer support boosts",
    override: {
      featuredGuestMultiplier: 1.3,
      breakoutGuestMultiplier: 1.12,
    },
  },
  {
    id: "boost-tiny",
    label: "tiny support boosts",
    override: {
      featuredGuestMultiplier: 1.18,
      breakoutGuestMultiplier: 1.06,
    },
  },
];

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
            for (const guestCapProfile of GUEST_CAP_PROFILES) {
              for (const antiDominanceProfile of ANTI_DOMINANCE_PROFILES) {
                const id =
                  `d${formatShort(dominantLeadThreshold)}-` +
                  `c${formatShort(maxCatchUpPressure)}-` +
                  `sg${formatShort(spotlightGuestMultiplier)}-` +
                  `ss${formatShort(spotlightScoreBonus)}-` +
                  `${guestCapProfile.id}-${antiDominanceProfile.id}`;
                candidates.push({
                  id,
                  label:
                    `Lead ${dominantLeadThreshold.toFixed(2)}, ` +
                    `catch-up ${maxCatchUpPressure.toFixed(2)}, ` +
                    `spotlight guests ${spotlightGuestMultiplier.toFixed(2)}, ` +
                    `spotlight score ${spotlightScoreBonus.toFixed(2)}, ` +
                    `${guestCapProfile.label}, ${antiDominanceProfile.label}`,
                  override: {
                    dominantLeadThreshold,
                    maxCatchUpPressure,
                    spotlightGuestMultiplier,
                    spotlightScoreBonus,
                    ...guestCapProfile.override,
                    ...antiDominanceProfile.override,
                  },
                });
              }
            }
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
    for (const economicProfile of ECONOMIC_PROFILES) {
      for (const boostProfile of SUPPORTING_BOOST_PROFILES) {
        const isDefaultProfile =
          economicProfile.id === "econ-default" && boostProfile.id === "boost-default";
        if (isDefaultProfile) {
          continue;
        }

        const id = `${candidate.id}-${economicProfile.id}-${boostProfile.id}`;
        if (seen.has(id)) {
          continue;
        }

        seen.add(id);
        expanded.push({
          id,
          label: `${candidate.label}, ${economicProfile.label}, ${boostProfile.label}`,
          override: {
            ...candidate.override,
            ...economicProfile.override,
            ...boostProfile.override,
          },
        });
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

  const stickinessPenalty =
    upperBoundPenalty(
      mid.averageMonthsAtTop / Math.max(1, payload.months),
      0.26,
      0.08,
      18,
      notes,
      "Mid parks are holding the top spot too often."
    ) +
    upperBoundPenalty(
      strong.averageMonthsAtTop / Math.max(1, payload.months),
      0.6,
      0.08,
      28,
      notes,
      "Strong parks are sitting on first place too consistently."
    ) +
    upperBoundPenalty(
      dominant.averageMonthsAtTop / Math.max(1, payload.months),
      0.82,
      0.08,
      18,
      notes,
      "Dominant parks are not giving the field enough turnover."
    ) +
    upperBoundPenalty(
      mid.averageLongestTopStreak,
      8,
      2.5,
      10,
      notes,
      "Mid parks are chaining top streaks too easily."
    ) +
    upperBoundPenalty(
      strong.averageLongestTopStreak,
      14,
      3,
      14,
      notes,
      "Strong parks are chaining top streaks too easily."
    ) +
    upperBoundPenalty(
      dominant.averageLongestTopStreak,
      20,
      4,
      10,
      notes,
      "Dominant parks are staying locked in for too long."
    );

  const investmentPenalty =
    upperBoundPenalty(
      averageInvestmentRoi,
      0.32,
      0.05,
      32,
      notes,
      "Long-hold investment returns are too generous."
    ) +
    upperBoundPenalty(
      payload.investments[2]?.averageRoi ?? 0,
      0.36,
      0.05,
      26,
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
      1.22,
      0.06,
      14,
      notes,
      "Strong parks are stacking too much guest-cap leverage."
    ) +
    upperBoundPenalty(
      dominant.averageGuestCap,
      1.28,
      0.06,
      12,
      notes,
      "Dominant parks are stacking too much guest-cap leverage."
    );

  const total =
    ladderPenalty +
    dominancePenalty +
    stickinessPenalty +
    investmentPenalty +
    volatilityPenalty +
    guestCapPenalty;

  return {
    total,
    ladderPenalty,
    dominancePenalty,
    stickinessPenalty,
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
