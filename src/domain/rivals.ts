import { clamp, logarithmicScale } from "./math";
import { Rng } from "./random";
import type {
  RegionKey,
  RivalArchetype,
  RivalPark,
  RivalStrategyFocus,
} from "../types";

const REGION_KEYS: RegionKey[] = [
  "north_america",
  "europe",
  "asia_pacific",
  "latin_america",
];

const ARCHETYPES: RivalArchetype[] = [
  "legacy",
  "premium",
  "growth",
  "destination",
  "value",
];

const REGION_LABELS: Record<RegionKey, string> = {
  north_america: "North America",
  europe: "Europe",
  asia_pacific: "Asia Pacific",
  latin_america: "Latin America",
};

const STRATEGY_LABELS: Record<RivalStrategyFocus, string> = {
  balanced: "Balanced",
  turnaround: "Turnaround",
  brand_push: "Brand push",
  innovation_bet: "Innovation bet",
  efficiency_drive: "Efficiency drive",
};

const PREFIXES = [
  "Aurora",
  "Alpen",
  "Nord",
  "Sonnen",
  "Wunder",
  "Rhein",
  "Summit",
  "Bluewater",
  "Grand",
  "Evergreen",
  "Luna",
  "Cascade",
  "Velocity",
  "Harbor",
  "Silverline",
  "Suncrest",
  "Frontier",
  "Atlas",
  "Crown",
  "Meridian",
  "Pacific",
  "Mirage",
  "Royal",
  "Vista",
];

const SUFFIXES = [
  "Gardens",
  "Adventure Park",
  "Park",
  "Welt",
  "Garten",
  "Kingdom",
  "Resort",
  "World",
  "Pier",
  "Hills",
  "Harbor",
  "Studios",
  "Bay",
  "Point",
  "Falls",
  "Island",
];

interface ArchetypeTemplate {
  prestige: number;
  operations: number;
  marketing: number;
  innovation: number;
  guestAppeal: number;
  risk: number;
  debtRatio: number;
}

const ARCHETYPE_TEMPLATES: Record<RivalArchetype, ArchetypeTemplate> = {
  legacy: {
    prestige: 68,
    operations: 66,
    marketing: 50,
    innovation: 38,
    guestAppeal: 64,
    risk: 35,
    debtRatio: 0.36,
  },
  premium: {
    prestige: 78,
    operations: 60,
    marketing: 62,
    innovation: 54,
    guestAppeal: 74,
    risk: 43,
    debtRatio: 0.42,
  },
  growth: {
    prestige: 52,
    operations: 52,
    marketing: 67,
    innovation: 72,
    guestAppeal: 60,
    risk: 58,
    debtRatio: 0.52,
  },
  destination: {
    prestige: 64,
    operations: 58,
    marketing: 72,
    innovation: 58,
    guestAppeal: 76,
    risk: 50,
    debtRatio: 0.48,
  },
  value: {
    prestige: 46,
    operations: 68,
    marketing: 47,
    innovation: 34,
    guestAppeal: 50,
    risk: 30,
    debtRatio: 0.24,
  },
};

const ARCHETYPE_DEFAULT_STRATEGIES: Record<RivalArchetype, RivalStrategyFocus> = {
  legacy: "balanced",
  premium: "brand_push",
  growth: "innovation_bet",
  destination: "brand_push",
  value: "efficiency_drive",
};

const ARCHETYPE_LABELS: Record<RivalArchetype, string> = {
  legacy: "Legacy operator",
  premium: "Premium brand",
  growth: "Growth chaser",
  destination: "Destination magnet",
  value: "Value operator",
};

const ARCHETYPE_DESCRIPTIONS: Record<RivalArchetype, string> = {
  legacy: "An older operator with brand history, steadier operations and less appetite for reinvention.",
  premium: "A quality-first brand that leans on guest experience, pricing power and polished marketing.",
  growth: "An aggressive climber that trades stability for expansion, innovation and momentum.",
  destination: "A scale-driven park that wants to be a full trip destination, not just a local day out.",
  value: "A practical, efficient operator that competes on reliability and affordability over spectacle.",
};

export function getRegionLabel(region: RegionKey): string {
  return REGION_LABELS[region];
}

export function getStrategyLabel(strategy: RivalStrategyFocus): string {
  return STRATEGY_LABELS[strategy];
}

export function getArchetypeLabel(archetype: RivalArchetype): string {
  return ARCHETYPE_LABELS[archetype];
}

export function getArchetypeDescription(archetype: RivalArchetype): string {
  return ARCHETYPE_DESCRIPTIONS[archetype];
}

export function computeRivalScore(rival: RivalPark, competitionHeat: number): number {
  const debtRatio =
    rival.finance.companyValue > 0 ? rival.finance.debt / rival.finance.companyValue : 1.1;
  const experienceScore = clamp(
    rival.stats.prestige * 0.26 +
      rival.stats.operations * 0.24 +
      rival.stats.marketing * 0.16 +
      rival.stats.innovation * 0.12 +
      rival.stats.guestAppeal * 0.22,
    0,
    100
  );
  const scaleScore = logarithmicScale(Math.max(10_000, rival.finance.companyValue), 2_800_000) * 100;
  const financeConfidence = clamp(
    54 +
      rival.finance.cashReserve / 18_000 -
      rival.finance.debt / 260_000 -
      debtRatio * 18,
    8,
    92
  );
  const tierScore = 22 + rival.tier * 12;
  const momentumBonus = clamp(rival.momentum * 1.2, -10, 10);
  const competitionBonus = clamp(
    (competitionHeat - 1) * (rival.stats.marketing * 0.08 + rival.stats.guestAppeal * 0.04),
    -4,
    6
  );
  const distressPenalty = rival.status.distressLevel * 6.5;
  const scandalPenalty = rival.status.scandalMonthsRemaining > 0 ? 8 : 0;
  const expansionBonus = rival.status.expansionMonthsRemaining > 0 ? 5 : 0;
  const recoveryBonus = rival.status.recoveryMonthsRemaining > 0 ? 2.5 : 0;
  const score =
    experienceScore * 0.56 +
    scaleScore * 0.18 +
    financeConfidence * 0.12 +
    tierScore * 0.08 +
    momentumBonus +
    competitionBonus +
    expansionBonus +
    recoveryBonus -
    distressPenalty -
    scandalPenalty;

  return clamp(score, 18, 100);
}

export function createInitialRivals(seed: number, rivalCount: number): RivalPark[] {
  const rng = new Rng(seed);
  const usedNames = new Set<string>();
  const rivals: RivalPark[] = [];

  for (let index = 0; index < rivalCount; index += 1) {
    rivals.push(createRival(rng, index + 1, usedNames));
  }

  return rivals;
}

export function appendGeneratedRivals(
  existing: RivalPark[],
  seed: number,
  count: number
): RivalPark[] {
  const rng = new Rng(seed);
  const usedNames = new Set(existing.map((rival) => rival.name));
  const startIndex = existing.length + 1;
  const generated: RivalPark[] = [];
  const warmupNames = new Set<string>();

  for (let index = 0; index < existing.length; index += 1) {
    createRival(rng, index + 1, warmupNames);
  }

  for (let index = 0; index < count; index += 1) {
    generated.push(createRival(rng, startIndex + index, usedNames));
  }

  return generated;
}

function createRival(rng: Rng, ordinal: number, usedNames: Set<string>): RivalPark {
  const archetype = rng.pick(ARCHETYPES);
  const template = ARCHETYPE_TEMPLATES[archetype];
  const region = rng.pick(REGION_KEYS);
  const tier = rollTier(rng);
  const name = generateUniqueName(rng, usedNames);
  const sizeMultiplier =
    tier === 1
      ? rng.float(0.48, 0.98)
      : tier === 2
        ? rng.float(0.62, 1.05)
        : tier === 3
          ? rng.float(0.82, 1.18)
          : tier === 4
            ? rng.float(0.95, 1.35)
            : rng.float(1.05, 1.55);
  const companyValue = (90_000 + tier * 115_000) * sizeMultiplier;
  const debt = companyValue * template.debtRatio * rng.float(0.75, 1.15);
  const cashReserve = companyValue * rng.float(0.05, 0.17);
  const tierAdjustment = (tier - 3) * 5.6;

  const rival: RivalPark = {
    id: `rival-${ordinal}`,
    name,
    region,
    archetype,
    tier,
    stats: {
      prestige: clamp(template.prestige + tierAdjustment + rng.float(-10, 10), 20, 96),
      operations: clamp(template.operations + tierAdjustment * 0.95 + rng.float(-9, 9), 22, 97),
      marketing: clamp(template.marketing + tierAdjustment * 1.05 + rng.float(-10, 10), 18, 96),
      innovation: clamp(template.innovation + tierAdjustment + rng.float(-11, 11), 16, 98),
      guestAppeal: clamp(template.guestAppeal + tierAdjustment + rng.float(-9, 9), 20, 97),
    },
    finance: {
      debt: Math.round(debt),
      cashReserve: Math.round(cashReserve),
      companyValue: Math.round(companyValue),
      monthlyRevenue: 0,
      monthlyProfit: 0,
    },
    derived: {
      score: 0,
      marketShare: 0,
      monthlyVisitors: 0,
      catchUpPressure: 0,
      valuation: Math.round(companyValue),
      debtRatio: 0,
    },
    status: {
      active: true,
      monthsAtTop: 0,
      monthsInSlump: 0,
      monthsSinceFounded: rng.int(18, 160),
      mergedIntoId: null,
      lastHeadline: null,
      distressLevel: 0,
      scandalMonthsRemaining: 0,
      expansionMonthsRemaining: 0,
      recoveryMonthsRemaining: 0,
      strategyFocus: ARCHETYPE_DEFAULT_STRATEGIES[archetype],
      strategyShiftMonthsRemaining: 0,
    },
    momentum: rng.float(-2.5, 2.5),
    risk: clamp(template.risk + rng.float(-8, 8), 18, 85),
  };

  rival.derived.score = computeRivalScore(rival, 1);
  rival.derived.debtRatio =
    rival.finance.companyValue > 0 ? roundDebtRatio(rival.finance.debt / rival.finance.companyValue) : 0;
  return rival;
}

function roundDebtRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function rollTier(rng: Rng): number {
  const roll = rng.next();
  if (roll >= 0.95) {
    return 5;
  }
  if (roll >= 0.78) {
    return 4;
  }
  if (roll >= 0.46) {
    return 3;
  }
  if (roll >= 0.18) {
    return 2;
  }
  return 1;
}

function generateUniqueName(rng: Rng, usedNames: Set<string>): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const name = `${rng.pick(PREFIXES)} ${rng.pick(SUFFIXES)}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  const fallback = `Park ${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
}
