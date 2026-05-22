import { formatMoney } from "./currency";
import { clamp, deepClone, roundTo } from "./math";
import { createScopedRng, hashString } from "./random";
import type {
  EquityBuyerType,
  NewsItem,
  PlayerEquityOffer,
  PlayerEquityState,
  PlayerSnapshot,
  RivalPark,
  WorldParkLeagueState,
} from "../types";

const MAX_OUTSIDE_OWNERSHIP = 0.45;
const OFFER_SHARES = [0.05, 0.1] as const;

export interface EquityMarketAdvanceResult {
  news: NewsItem[];
  notifications: string[];
}

export interface EquityOfferDecisionResult {
  ok: boolean;
  state: WorldParkLeagueState;
  cashDelta: number;
  message: string;
}

export function createInitialEquityState(): PlayerEquityState {
  return {
    outsideOwnedShare: 0,
    totalCashRaised: 0,
    activeOffers: [],
    lastAcceptedOfferSummary: null,
    lastDeclinedOfferSummary: null,
    lastBuybackSummary: null,
  };
}

export function advancePlayerEquityMarket(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  month: number
): EquityMarketAdvanceResult {
  const news: NewsItem[] = [];
  const notifications: string[] = [];
  const expiredOffers = state.player.equity.activeOffers.filter((offer) => offer.expiresAtMonth < month);
  if (expiredOffers.length > 0) {
    state.player.equity.activeOffers = state.player.equity.activeOffers.filter(
      (offer) => offer.expiresAtMonth >= month
    );
    notifications.push(`${expiredOffers.length} capital offer(s) expired without a decision.`);
  }

  const availableShare = getAvailableOutsideOwnership(state.player.equity);
  if (availableShare < OFFER_SHARES[0]) {
    return { news, notifications };
  }

  const rng = createScopedRng(state.world.seed, month, 4801);
  const openOfferCount = state.player.equity.activeOffers.length;
  const offerChance =
    openOfferCount === 0
      ? 0.44
      : openOfferCount === 1
        ? 0.32
        : openOfferCount === 2
          ? 0.22
          : openOfferCount === 3
            ? 0.14
            : 0.08;
  if (!rng.chance(offerChance)) {
    return { news, notifications };
  }

  const offer = createEquityOffer(state, snapshot, month, rng);
  if (!offer) {
    return { news, notifications };
  }

  state.player.equity.activeOffers.unshift(offer);
  state.player.equity.activeOffers = state.player.equity.activeOffers.slice(0, 5);
  notifications.push(
    `${offer.buyerName} offers ${formatMoney(offer.price)} for ${(offer.share * 100).toFixed(0)}% of your park.`
  );
  news.push(
    createNews(
      month,
      "player",
      "info",
      `${offer.buyerName} approaches your park with a capital offer.`,
      `${getBuyerTypeLabel(offer.buyerType)} money is offering ${formatMoney(offer.price)} for ${(offer.share * 100).toFixed(0)}% of your company.`
    )
  );

  return { news, notifications };
}

export function acceptEquityOffer(
  state: WorldParkLeagueState,
  offerId: string
): EquityOfferDecisionResult {
  const nextState = deepClone(state);
  const offerIndex = nextState.player.equity.activeOffers.findIndex((offer) => offer.id === offerId);
  if (offerIndex < 0) {
    return failure(nextState, "That capital offer is no longer available.");
  }

  const offer = nextState.player.equity.activeOffers[offerIndex] as PlayerEquityOffer;
  const availableShare = getAvailableOutsideOwnership(nextState.player.equity);
  if (offer.share > availableShare + 0.000001) {
    return failure(nextState, "There is no room left for that much outside ownership.");
  }

  nextState.player.equity.outsideOwnedShare = roundTo(
    nextState.player.equity.outsideOwnedShare + offer.share,
    4
  );
  nextState.player.equity.totalCashRaised += offer.price;
  nextState.player.equity.lastAcceptedOfferSummary = `${offer.buyerName} bought ${(offer.share * 100).toFixed(0)}% for ${formatMoney(offer.price)}.`;
  nextState.player.equity.lastDeclinedOfferSummary = null;
  nextState.player.equity.lastBuybackSummary = null;
  nextState.player.equity.activeOffers.splice(offerIndex, 1);
  nextState.player.governance.investorConfidence = clamp(
    nextState.player.governance.investorConfidence + 2.2,
    22,
    94
  );
  nextState.player.governance.boardPatience = clamp(
    nextState.player.governance.boardPatience + 1.4,
    18,
    95
  );
  if (offer.buyerType === "rival") {
    nextState.world.competitionHeat = clamp(nextState.world.competitionHeat + 0.03, 0.9, 1.3);
  }

  return {
    ok: true,
    state: nextState,
    cashDelta: offer.price,
    message: `Accepted ${offer.buyerName}'s offer for ${(offer.share * 100).toFixed(0)}% at ${formatMoney(offer.price)}.`,
  };
}

export function declineEquityOffer(
  state: WorldParkLeagueState,
  offerId: string
): EquityOfferDecisionResult {
  const nextState = deepClone(state);
  const offerIndex = nextState.player.equity.activeOffers.findIndex((offer) => offer.id === offerId);
  if (offerIndex < 0) {
    return failure(nextState, "That capital offer is no longer available.");
  }

  const offer = nextState.player.equity.activeOffers[offerIndex] as PlayerEquityOffer;
  nextState.player.equity.activeOffers.splice(offerIndex, 1);
  nextState.player.equity.lastDeclinedOfferSummary = `${offer.buyerName}'s ${(offer.share * 100).toFixed(0)}% offer was declined.`;
  nextState.player.equity.lastBuybackSummary = null;
  nextState.player.governance.boardPatience = clamp(
    nextState.player.governance.boardPatience - 0.4,
    18,
    95
  );

  return {
    ok: true,
    state: nextState,
    cashDelta: 0,
    message: `Declined ${offer.buyerName}'s offer.`,
  };
}

export function repurchaseOutsideEquity(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  share: number
): EquityOfferDecisionResult {
  const nextState = deepClone(state);
  if (share <= 0) {
    return failure(nextState, "Choose a positive buyback share.");
  }
  if (share > nextState.player.equity.outsideOwnedShare + 0.000001) {
    return failure(nextState, "You do not have that much outside equity to buy back.");
  }

  const price = estimateBuybackPrice(nextState, snapshot, share);
  if (snapshot.cash < price) {
    return failure(nextState, `Not enough cash for the buyback. Need ${formatMoney(price)}.`);
  }

  nextState.player.equity.outsideOwnedShare = roundTo(
    Math.max(0, nextState.player.equity.outsideOwnedShare - share),
    4
  );
  nextState.player.equity.lastBuybackSummary = `Bought back ${(share * 100).toFixed(0)}% for ${formatMoney(price)}.`;
  nextState.player.equity.lastAcceptedOfferSummary = null;
  nextState.player.governance.investorConfidence = clamp(
    nextState.player.governance.investorConfidence - 0.5,
    22,
    94
  );
  nextState.player.governance.boardPatience = clamp(
    nextState.player.governance.boardPatience + 1.2,
    18,
    95
  );

  return {
    ok: true,
    state: nextState,
    cashDelta: -price,
    message: `Bought back ${(share * 100).toFixed(0)}% of outside equity for ${formatMoney(price)}.`,
  };
}

export function getActiveEquityOfferRows(state: WorldParkLeagueState): string[][] {
  const offers = state.player.equity.activeOffers;
  if (offers.length === 0) {
    return [["No active offers", "", "", "", ""]];
  }

  return offers.map((offer) => [
    trimName(offer.buyerName, 18),
    `${(offer.share * 100).toFixed(0)}%`,
    formatMoney(offer.price),
    `${offer.expiresAtMonth}`,
    getBuyerTypeShortLabel(offer.buyerType),
  ]);
}

export function getFounderOwnedShare(state: WorldParkLeagueState): number {
  return roundTo(1 - state.player.equity.outsideOwnedShare, 4);
}

export function getOutsideOwnedShare(state: WorldParkLeagueState): number {
  return state.player.equity.outsideOwnedShare;
}

export function getAvailableOutsideOwnershipForGovernance(
  state: WorldParkLeagueState
): number {
  return getAvailableOutsideOwnership(state.player.equity);
}

export function estimateBuybackPrice(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  share: number
): number {
  const baseValue = Math.max(snapshot.companyValue, 280_000) * share;
  const scarcityPremium = clamp(state.player.equity.outsideOwnedShare * 0.14, 0.01, 0.08);
  const marketPremium = clamp((state.world.capitalMarketMood - 1) * 0.07, -0.02, 0.04);
  const performancePremium = clamp((state.player.score - 60) * 0.0018, -0.03, 0.06);
  const premium = clamp(0.05 + scarcityPremium + marketPremium + performancePremium, 0.04, 0.18);
  return Math.max(15_000, Math.round(baseValue * (1 + premium)));
}

function createEquityOffer(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  month: number,
  rng: ReturnType<typeof createScopedRng>
): PlayerEquityOffer | null {
  const availableShare = getAvailableOutsideOwnership(state.player.equity);
  const eligibleShares = OFFER_SHARES.filter((share) => share <= availableShare + 0.000001);
  if (eligibleShares.length === 0) {
    return null;
  }

  const share = rng.pick(eligibleShares);
  const buyer = selectBuyer(state, rng);
  const priceBase = Math.max(snapshot.companyValue, 350_000) * share;
  const scorePremium = clamp((state.player.score - 58) * 0.0024, -0.06, 0.12);
  const governancePremium = clamp(
    (state.player.governance.investorConfidence - 60) * 0.0012,
    -0.03,
    0.05
  );
  const buyerBias = getBuyerBias(buyer.type);
  const premiumRate = clamp(
    0.01 + scorePremium + governancePremium + buyerBias + rng.float(-0.025, 0.035),
    -0.08,
    0.2
  );
  const price = Math.max(20_000, Math.round(priceBase * (1 + premiumRate)));

  return {
    id: `equity-${month}-${hashString(`${buyer.name}:${share}:${price}`)}`,
    month,
    buyerName: buyer.name,
    buyerType: buyer.type,
    buyerRivalId: buyer.rivalId,
    share,
    price,
    premiumRate: roundTo(premiumRate, 4),
    expiresAtMonth: month + rng.int(2, 5),
  };
}

function selectBuyer(
  state: WorldParkLeagueState,
  rng: ReturnType<typeof createScopedRng>
): { name: string; type: EquityBuyerType; rivalId: string | null } {
  const strategicRivals = state.world.rivals.filter(
    (rival) =>
      rival.status.active &&
      rival.finance.cashReserve > 95_000 &&
      rival.finance.companyValue > 1_400_000
  );

  if (strategicRivals.length > 0 && rng.chance(0.28)) {
    const rival = pickStrategicBuyer(strategicRivals, rng);
    return {
      name: `${rival.name} Strategic Holdings`,
      type: "rival",
      rivalId: rival.id,
    };
  }

  const options: Array<{ name: string; type: EquityBuyerType }> = [
    { name: "Northstar Capital", type: "institutional" },
    { name: "Blue Horizon Fund", type: "institutional" },
    { name: "Meridian Family Office", type: "family_office" },
    { name: "Summit Leisure Partners", type: "private_equity" },
  ];
  const buyer = rng.pick(options);
  return {
    name: buyer.name,
    type: buyer.type,
    rivalId: null,
  };
}

function pickStrategicBuyer(
  rivals: RivalPark[],
  rng: ReturnType<typeof createScopedRng>
): RivalPark {
  const sorted = [...rivals].sort((left, right) => right.finance.companyValue - left.finance.companyValue);
  const shortlist = sorted.slice(0, Math.min(4, sorted.length));
  return rng.pick(shortlist);
}

function getAvailableOutsideOwnership(equity: PlayerEquityState): number {
  return Math.max(0, roundTo(MAX_OUTSIDE_OWNERSHIP - equity.outsideOwnedShare, 4));
}

function getBuyerBias(type: EquityBuyerType): number {
  switch (type) {
    case "rival":
      return 0.03;
    case "institutional":
      return 0.015;
    case "family_office":
      return 0.006;
    case "private_equity":
      return -0.012;
  }
}

function getBuyerTypeLabel(type: EquityBuyerType): string {
  switch (type) {
    case "rival":
      return "Strategic";
    case "institutional":
      return "Institutional";
    case "family_office":
      return "Family office";
    case "private_equity":
      return "Private equity";
  }
}

function getBuyerTypeShortLabel(type: EquityBuyerType): string {
  switch (type) {
    case "rival":
      return "Rival";
    case "institutional":
      return "Inst";
    case "family_office":
      return "Family";
    case "private_equity":
      return "PE";
  }
}

function failure(state: WorldParkLeagueState, message: string): EquityOfferDecisionResult {
  return {
    ok: false,
    state,
    cashDelta: 0,
    message,
  };
}

function createNews(
  month: number,
  category: NewsItem["category"],
  severity: NewsItem["severity"],
  headline: string,
  detail: string
): NewsItem {
  return {
    id: `${category}-${month}-${hashString(`${headline}:${detail}:${month}`)}`,
    month,
    category,
    severity,
    headline,
    detail,
  };
}

function trimName(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
