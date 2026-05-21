import { estimateBuybackPrice, getAvailableOutsideOwnershipForGovernance } from "./equity";
import { clamp, deepClone, roundTo } from "./math";
import { hashString } from "./random";
import type {
  NewsItem,
  PlayerBoardProposal,
  PlayerBoardProposalType,
  PlayerDirective,
  PlayerGovernanceProgram,
  PlayerSnapshot,
  WorldParkLeagueState,
} from "../types";

const BOARD_REVIEW_INTERVAL = 3;
const MAX_PENDING_PROPOSALS = 3;

export interface GovernanceAdvanceResult {
  news: NewsItem[];
  notifications: string[];
}

export interface GovernanceProposalDecisionResult {
  ok: boolean;
  state: WorldParkLeagueState;
  cashDelta: number;
  loanDelta: number;
  message: string;
}

export function createInitialGovernanceState(currentMonth: number) {
  return {
    investorConfidence: 60,
    boardPatience: 62,
    activeDirective: "balanced" as PlayerDirective,
    directiveMonthsRemaining: BOARD_REVIEW_INTERVAL,
    lastReviewMonth: currentMonth - BOARD_REVIEW_INTERVAL,
    lastReviewSummary: "Initial governance baseline established.",
    lastDirectiveScore: 0.6,
    guestCapImpact: 1,
    pendingProposals: [] as PlayerBoardProposal[],
    activePrograms: [] as PlayerGovernanceProgram[],
    lastProposalSummary: null,
  };
}

export function advancePlayerGovernance(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  month: number
): GovernanceAdvanceResult {
  const news: NewsItem[] = [];
  const notifications: string[] = [];
  const governance = state.player.governance;
  advanceGovernancePrograms(governance, notifications);
  expireGovernanceProposals(governance, month, notifications);

  const directiveScore = evaluateDirectiveScore(snapshot, state, governance.activeDirective);
  const dominancePressure = calculateDominancePressure(state);
  const reviewDue =
    governance.lastReviewMonth === null ||
    month - governance.lastReviewMonth >= BOARD_REVIEW_INTERVAL;

  governance.lastDirectiveScore = roundTo(directiveScore, 3);

  const confidenceDelta =
    (directiveScore - 0.58) * 4.2 +
    calculateQualitySignal(snapshot) * 1.5 -
    dominancePressure * 8;
  const patienceDelta =
    (directiveScore - 0.55) * 4.8 +
    ((state.player.currentRank ?? 99) <= 3 ? 0.35 : -0.3) -
    dominancePressure * 7.5;

  governance.investorConfidence = clamp(
    governance.investorConfidence + confidenceDelta,
    22,
    94
  );
  governance.boardPatience = clamp(governance.boardPatience + patienceDelta, 18, 95);

  if (reviewDue) {
    if (governance.lastReviewMonth !== null) {
      pushBoardReviewOutcome(governance, month, directiveScore, news, notifications);
    }

    const nextDirective = selectNextDirective(snapshot, state);
    governance.activeDirective = nextDirective;
    governance.lastReviewMonth = month;
    governance.directiveMonthsRemaining = BOARD_REVIEW_INTERVAL;
    governance.lastReviewSummary = buildDirectiveSummary(nextDirective, snapshot, state);

    news.push(
      createNews(
        month,
        "player",
        directiveScore >= 0.62 ? "info" : "warning",
        `Your board sets a ${getDirectiveLabel(nextDirective)} mandate.`,
        governance.lastReviewSummary
      )
    );
    notifications.push(`Board mandate: ${getDirectiveLabel(nextDirective)}.`);

    const proposal = maybeCreateBoardProposal(state, snapshot, month);
    if (proposal) {
      governance.pendingProposals.unshift(proposal);
      governance.pendingProposals = governance.pendingProposals.slice(0, MAX_PENDING_PROPOSALS);
      governance.lastProposalSummary = `${proposal.title} is waiting for your vote.`;
      news.push(
        createNews(
          month,
          "player",
          "info",
          `Board vote opened: ${proposal.title}.`,
          proposal.summary
        )
      );
      notifications.push(`Board vote ready: ${proposal.title}.`);
    }
  } else {
    governance.directiveMonthsRemaining = Math.max(
      0,
      BOARD_REVIEW_INTERVAL - (month - (governance.lastReviewMonth ?? month))
    );
  }

  governance.guestCapImpact = calculateGovernanceGuestCapImpact(governance, dominancePressure);

  if (governance.boardPatience < 28) {
    notifications.push(
      "Board patience is running thin. Sustained underperformance could tighten your guest growth."
    );
  }

  return { news, notifications };
}

export function acceptBoardProposal(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  proposalId: string
): GovernanceProposalDecisionResult {
  const nextState = deepClone(state);
  const governance = nextState.player.governance;
  const proposalIndex = governance.pendingProposals.findIndex((proposal) => proposal.id === proposalId);
  if (proposalIndex < 0) {
    return failure(nextState, "That board proposal is no longer available.");
  }

  const proposal = governance.pendingProposals[proposalIndex] as PlayerBoardProposal;
  if (proposal.cashDelta < 0 && snapshot.cash < Math.abs(proposal.cashDelta)) {
    return failure(nextState, `Not enough money to approve ${proposal.title}.`);
  }
  if (proposal.loanDelta < 0 && snapshot.bankLoan < Math.abs(proposal.loanDelta)) {
    return failure(nextState, "There is not enough outstanding loan to apply that measure.");
  }

  const resultingOutsideOwnership = roundTo(
    nextState.player.equity.outsideOwnedShare + proposal.outsideOwnershipDelta,
    4
  );
  if (resultingOutsideOwnership < -0.000001 || resultingOutsideOwnership > 0.45 + 0.000001) {
    return failure(nextState, "That capital measure would break the allowed ownership limits.");
  }

  governance.pendingProposals.splice(proposalIndex, 1);
  governance.lastProposalSummary = `${proposal.title} was approved.`;
  governance.investorConfidence = clamp(
    governance.investorConfidence + proposal.confidenceDelta,
    22,
    94
  );
  governance.boardPatience = clamp(governance.boardPatience + proposal.patienceDelta, 18, 95);
  nextState.player.equity.outsideOwnedShare = clamp(resultingOutsideOwnership, 0, 0.45);

  if (proposal.outsideOwnershipDelta > 0) {
    nextState.player.equity.totalCashRaised += proposal.cashDelta;
  }

  if (proposal.programMonths > 0 && proposal.guestCapBonus > 0) {
    governance.activePrograms.unshift({
      id: `program-${proposal.id}`,
      title: proposal.title,
      summary: proposal.summary,
      sourceProposalType: proposal.type,
      monthsRemaining: proposal.programMonths,
      guestCapBonus: proposal.guestCapBonus,
    });
  }

  return {
    ok: true,
    state: nextState,
    cashDelta: proposal.cashDelta,
    loanDelta: proposal.loanDelta,
    message: `${proposal.title} approved.`,
  };
}

export function declineBoardProposal(
  state: WorldParkLeagueState,
  proposalId: string
): GovernanceProposalDecisionResult {
  const nextState = deepClone(state);
  const governance = nextState.player.governance;
  const proposalIndex = governance.pendingProposals.findIndex((proposal) => proposal.id === proposalId);
  if (proposalIndex < 0) {
    return failure(nextState, "That board proposal is no longer available.");
  }

  const proposal = governance.pendingProposals[proposalIndex] as PlayerBoardProposal;
  governance.pendingProposals.splice(proposalIndex, 1);
  governance.lastProposalSummary = `${proposal.title} was declined.`;
  governance.investorConfidence = clamp(governance.investorConfidence - 0.6, 22, 94);
  governance.boardPatience = clamp(governance.boardPatience - 1.4, 18, 95);

  return {
    ok: true,
    state: nextState,
    cashDelta: 0,
    loanDelta: 0,
    message: `${proposal.title} declined.`,
  };
}

export function getDirectiveLabel(directive: PlayerDirective): string {
  switch (directive) {
    case "growth_push":
      return "Growth push";
    case "guest_experience":
      return "Guest experience";
    case "profit_focus":
      return "Profit focus";
    case "deleveraging":
      return "Deleveraging";
    case "balanced":
      return "Balanced";
  }
}

export function getBoardProposalRows(state: WorldParkLeagueState): string[][] {
  const proposals = state.player.governance.pendingProposals;
  if (proposals.length === 0) {
    return [["No board votes", "", "", ""]];
  }

  return proposals.map((proposal) => [
    trimText(proposal.title, 24),
    getBoardProposalTypeShortLabel(proposal.type),
    formatCompactSignedMoney(proposal.cashDelta),
    `${proposal.expiresAtMonth}`,
  ]);
}

export function getActiveProgramSummary(state: WorldParkLeagueState): string {
  const programs = state.player.governance.activePrograms;
  if (programs.length === 0) {
    return "No active board programs.";
  }

  return programs
    .slice(0, 2)
    .map((program) => `${program.title} (${program.monthsRemaining}m)`)
    .join(" | ");
}

export function getGovernanceSummaryLine(state: WorldParkLeagueState): string {
  const governance = state.player.governance;
  return `Board: ${Math.round(governance.boardPatience)}  Investors: ${Math.round(
    governance.investorConfidence
  )}  Mandate: ${getDirectiveLabel(governance.activeDirective)} (${governance.directiveMonthsRemaining}m)  Votes: ${governance.pendingProposals.length}`;
}

export function getGovernanceDetailLine(state: WorldParkLeagueState): string {
  const governance = state.player.governance;
  return `Governance impact x${governance.guestCapImpact.toFixed(3)} | Mandate score ${Math.round(
    governance.lastDirectiveScore * 100
  )}% | Programs ${governance.activePrograms.length}`;
}

export function evaluateDirectiveScore(
  snapshot: PlayerSnapshot,
  state: WorldParkLeagueState,
  directive: PlayerDirective
): number {
  const loanRatio =
    snapshot.companyValue > 0 ? snapshot.bankLoan / snapshot.companyValue : 0;
  const ratingSignal = clamp((snapshot.parkRating - 650) / 250, 0, 1);
  const satisfactionSignal = clamp((snapshot.averageRideSatisfaction - 55) / 35, 0, 1);
  const excitementSignal = clamp((snapshot.averageRideExcitement - 4.5) / 3.5, 0, 1);
  const guestSignal = clamp(snapshot.guests / 2600, 0, 1.2);
  const valueSignal = clamp(snapshot.companyValue / 4_000_000, 0, 1.2);
  const profitSignal = clamp(snapshot.totalRideProfit / 110_000, 0, 1.25);
  const cashSignal = clamp(snapshot.cash / 95_000, 0, 1.15);
  const efficiencySignal = clamp(1 - loanRatio, 0, 1);
  const openRideSignal =
    snapshot.totalRideCount > 0
      ? clamp(snapshot.openRideCount / snapshot.totalRideCount, 0, 1)
      : 0.5;
  const shareSignal = clamp(state.player.marketShare / 0.12, 0, 1.15);

  switch (directive) {
    case "growth_push":
      return roundTo(
        clamp(
          guestSignal * 0.36 +
            shareSignal * 0.18 +
            valueSignal * 0.18 +
            openRideSignal * 0.14 +
            excitementSignal * 0.14,
          0,
          1.15
        ),
        3
      );
    case "guest_experience":
      return roundTo(
        clamp(
          ratingSignal * 0.38 +
            satisfactionSignal * 0.34 +
            excitementSignal * 0.16 +
            openRideSignal * 0.12,
          0,
          1.12
        ),
        3
      );
    case "profit_focus":
      return roundTo(
        clamp(
          profitSignal * 0.38 +
            cashSignal * 0.25 +
            efficiencySignal * 0.2 +
            ratingSignal * 0.17,
          0,
          1.15
        ),
        3
      );
    case "deleveraging":
      return roundTo(
        clamp(
          efficiencySignal * 0.46 +
            cashSignal * 0.24 +
            profitSignal * 0.2 +
            valueSignal * 0.1,
          0,
          1.1
        ),
        3
      );
    case "balanced":
      return roundTo(
        clamp(
          ratingSignal * 0.24 +
            satisfactionSignal * 0.18 +
            guestSignal * 0.16 +
            valueSignal * 0.16 +
            profitSignal * 0.16 +
            efficiencySignal * 0.1,
          0,
          1.12
        ),
        3
      );
  }
}

export function calculateGovernanceGuestCapImpact(
  governance: WorldParkLeagueState["player"]["governance"],
  dominancePressure: number
): number {
  const confidenceFactor = (governance.investorConfidence - 60) * 0.0007;
  const patienceFactor = (governance.boardPatience - 60) * 0.0005;
  const executionFactor = (governance.lastDirectiveScore - 0.6) * 0.07;
  const dominancePenalty = dominancePressure * 0.12;
  const programBonus = governance.activePrograms.reduce(
    (total, program) => total + program.guestCapBonus,
    0
  );

  return roundTo(
    clamp(
      1 + confidenceFactor + patienceFactor + executionFactor + programBonus - dominancePenalty,
      0.94,
      1.1
    ),
    3
  );
}

function pushBoardReviewOutcome(
  governance: WorldParkLeagueState["player"]["governance"],
  month: number,
  directiveScore: number,
  news: NewsItem[],
  notifications: string[]
): void {
  if (directiveScore >= 0.7) {
    governance.investorConfidence = clamp(governance.investorConfidence + 3.5, 22, 94);
    governance.boardPatience = clamp(governance.boardPatience + 4.5, 18, 95);
    news.push(
      createNews(
        month,
        "player",
        "success",
        "The board is pleased with your recent execution.",
        "Strong delivery against the previous mandate has improved your standing with both investors and directors."
      )
    );
    notifications.push("Board review: strong execution.");
    return;
  }

  if (directiveScore < 0.5) {
    governance.investorConfidence = clamp(governance.investorConfidence - 4.5, 22, 94);
    governance.boardPatience = clamp(governance.boardPatience - 6, 18, 95);
    news.push(
      createNews(
        month,
        "player",
        "warning",
        "The board is unhappy with recent results.",
        "Directors see a gap between mandate and execution, raising pressure on the next review cycle."
      )
    );
    notifications.push("Board review: expectations were missed.");
    return;
  }

  news.push(
    createNews(
      month,
      "player",
      "info",
      "The board signs off on your recent performance.",
      "Execution is acceptable, but directors still expect sharper progress before the next review."
    )
  );
  notifications.push("Board review: acceptable progress.");
}

function selectNextDirective(
  snapshot: PlayerSnapshot,
  state: WorldParkLeagueState
): PlayerDirective {
  const loanRatio =
    snapshot.companyValue > 0 ? snapshot.bankLoan / snapshot.companyValue : 0;
  const rank = state.player.currentRank ?? 99;

  if (loanRatio > 0.28 || (snapshot.bankLoan > 0 && snapshot.cash < 20_000)) {
    return "deleveraging";
  }
  if (snapshot.parkRating < 780 || snapshot.averageRideSatisfaction < 74) {
    return "guest_experience";
  }
  if (snapshot.totalRideProfit < 35_000 || snapshot.cash < 18_000) {
    return "profit_focus";
  }
  if (rank > 3 || state.player.marketShare < 0.08) {
    return "growth_push";
  }
  return "balanced";
}

function buildDirectiveSummary(
  directive: PlayerDirective,
  snapshot: PlayerSnapshot,
  state: WorldParkLeagueState
): string {
  const rank = state.player.currentRank ?? "-";

  switch (directive) {
    case "growth_push":
      return `Rank ${rank} is not secure enough. The board wants stronger attendance, broader capacity and more visible growth.`;
    case "guest_experience":
      return `Guest quality metrics need work. Improve rating, satisfaction and ride quality before investors will support more aggression.`;
    case "profit_focus":
      return `Cash generation is not convincing enough. The board wants cleaner margins and steadier operating profit from your park.`;
    case "deleveraging":
      return `Leverage is elevated relative to company value. Directors want debt pressure reduced before a bigger push.`;
    case "balanced":
      return `Your park is in a healthy position at ${snapshot.parkName}. The board is backing a balanced operating plan for now.`;
  }
}

function calculateQualitySignal(snapshot: PlayerSnapshot): number {
  const ratingSignal = clamp((snapshot.parkRating - 700) / 220, -0.2, 0.4);
  const satisfactionSignal = clamp(
    (snapshot.averageRideSatisfaction - 72) / 28,
    -0.16,
    0.3
  );
  return ratingSignal * 0.6 + satisfactionSignal * 0.4;
}

function calculateDominancePressure(state: WorldParkLeagueState): number {
  if (state.player.currentRank !== 1 || state.world.leaderboard.length <= 1) {
    return 0;
  }

  const averageShare = 1 / state.world.leaderboard.length;
  const sharePressure = clamp((state.player.marketShare - averageShare) * 1.8, 0, 0.2);
  const tenurePressure = Math.max(0, state.player.monthsAtRankOne - 2) * 0.012;

  return clamp(sharePressure + tenurePressure, 0, 0.22);
}

function advanceGovernancePrograms(
  governance: WorldParkLeagueState["player"]["governance"],
  notifications: string[]
): void {
  for (let index = governance.activePrograms.length - 1; index >= 0; index -= 1) {
    const program = governance.activePrograms[index] as PlayerGovernanceProgram;
    program.monthsRemaining = Math.max(0, program.monthsRemaining - 1);
    if (program.monthsRemaining === 0) {
      governance.activePrograms.splice(index, 1);
      notifications.push(`${program.title} has run its course.`);
    }
  }
}

function expireGovernanceProposals(
  governance: WorldParkLeagueState["player"]["governance"],
  month: number,
  notifications: string[]
): void {
  const expired = governance.pendingProposals.filter((proposal) => proposal.expiresAtMonth < month);
  if (expired.length === 0) {
    return;
  }

  governance.pendingProposals = governance.pendingProposals.filter(
    (proposal) => proposal.expiresAtMonth >= month
  );
  governance.lastProposalSummary = `${expired.length} board vote(s) expired.`;
  notifications.push(`${expired.length} board vote(s) expired without a decision.`);
}

function maybeCreateBoardProposal(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  month: number
): PlayerBoardProposal | null {
  if (state.player.governance.pendingProposals.length >= MAX_PENDING_PROPOSALS) {
    return null;
  }

  const proposalType = selectBoardProposalType(state, snapshot);
  if (!proposalType) {
    return null;
  }
  if (state.player.governance.pendingProposals.some((proposal) => proposal.type === proposalType)) {
    return null;
  }

  return buildBoardProposal(proposalType, state, snapshot, month);
}

function selectBoardProposalType(
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot
): PlayerBoardProposalType | null {
  const loanRatio = snapshot.companyValue > 0 ? snapshot.bankLoan / snapshot.companyValue : 0;
  const rank = state.player.currentRank ?? 99;
  const outsideCapacity = getAvailableOutsideOwnershipForGovernance(state);

  if (loanRatio > 0.26 && snapshot.cash >= 14_000 && snapshot.bankLoan >= 14_000) {
    return "debt_repayment";
  }
  if (
    state.player.equity.outsideOwnedShare >= 0.05 &&
    snapshot.cash >= estimateBuybackPrice(state, snapshot, 0.05) &&
    rank <= 6
  ) {
    return "share_buyback";
  }
  if ((rank > 8 || state.player.marketShare < 0.05) && snapshot.cash >= 18_000) {
    return "growth_capex";
  }
  if (snapshot.parkRating < 780 || snapshot.averageRideSatisfaction < 74) {
    return "guest_experience_program";
  }
  if (outsideCapacity >= 0.05) {
    return "structured_equity_raise";
  }
  return null;
}

function buildBoardProposal(
  type: PlayerBoardProposalType,
  state: WorldParkLeagueState,
  snapshot: PlayerSnapshot,
  month: number
): PlayerBoardProposal | null {
  const expiresAtMonth = month + 3;
  switch (type) {
    case "growth_capex": {
      const spend = Math.round(Math.min(Math.max(18_000, snapshot.cash * 0.32), 70_000));
      if (snapshot.cash < spend) {
        return null;
      }
      return createProposal(
        month,
        type,
        "Expansion Program",
        `The board wants a visible expansion push. Spend ${formatMoney(spend)} now to fund new capacity, launch marketing and support your market climb for the next few months.`,
        expiresAtMonth,
        -spend,
        0,
        0,
        0.026,
        5,
        1.6,
        2.2
      );
    }
    case "guest_experience_program": {
      const spend = Math.round(Math.min(Math.max(14_000, snapshot.cash * 0.26), 55_000));
      if (snapshot.cash < spend) {
        return null;
      }
      return createProposal(
        month,
        type,
        "Guest Experience Program",
        `Directors want a service-quality push. Allocate ${formatMoney(spend)} to ride polish, staffing and guest comfort to stabilize quality metrics and reputation.`,
        expiresAtMonth,
        -spend,
        0,
        0,
        0.02,
        5,
        1.4,
        2
      );
    }
    case "debt_repayment": {
      const paydown = Math.round(
        Math.min(snapshot.bankLoan, Math.max(14_000, snapshot.cash * 0.38), 80_000)
      );
      if (paydown <= 0 || snapshot.cash < paydown) {
        return null;
      }
      return createProposal(
        month,
        type,
        "Balance Sheet Repair",
        `The board proposes paying down ${formatMoney(paydown)} of debt now to improve resilience and reduce financing drag.`,
        expiresAtMonth,
        -paydown,
        -paydown,
        0,
        0.012,
        4,
        1.2,
        2.4
      );
    }
    case "structured_equity_raise": {
      const availableShare = getAvailableOutsideOwnershipForGovernance(state);
      const share = availableShare >= 0.1 && snapshot.cash < 22_000 ? 0.1 : 0.05;
      if (availableShare < share - 0.000001) {
        return null;
      }
      const raise = Math.round(Math.max(snapshot.companyValue, 280_000) * share * 0.97);
      return createProposal(
        month,
        type,
        "Structured Equity Raise",
        `Backers are willing to inject ${formatMoney(raise)} for ${(share * 100).toFixed(0)}% of the park. This dilutes ownership, but gives you immediate firepower.`,
        expiresAtMonth,
        raise,
        0,
        share,
        0.014,
        4,
        2.3,
        1.4
      );
    }
    case "share_buyback": {
      const buybackShare = 0.05;
      if (state.player.equity.outsideOwnedShare < buybackShare - 0.000001) {
        return null;
      }
      const price = estimateBuybackPrice(state, snapshot, buybackShare);
      if (snapshot.cash < price) {
        return null;
      }
      return createProposal(
        month,
        type,
        "Share Buyback",
        `The board is offering a controlled buyback of ${(buybackShare * 100).toFixed(0)}% for ${formatMoney(price)} to tighten ownership and support the share story.`,
        expiresAtMonth,
        -price,
        0,
        -buybackShare,
        0.01,
        4,
        -0.3,
        2.8
      );
    }
  }
}

function createProposal(
  month: number,
  type: PlayerBoardProposalType,
  title: string,
  summary: string,
  expiresAtMonth: number,
  cashDelta: number,
  loanDelta: number,
  outsideOwnershipDelta: number,
  guestCapBonus: number,
  programMonths: number,
  confidenceDelta: number,
  patienceDelta: number
): PlayerBoardProposal {
  return {
    id: `board-${month}-${hashString(`${type}:${title}:${month}`)}`,
    month,
    type,
    title,
    summary,
    expiresAtMonth,
    cashDelta,
    loanDelta,
    outsideOwnershipDelta,
    guestCapBonus,
    programMonths,
    confidenceDelta,
    patienceDelta,
  };
}

function getBoardProposalTypeShortLabel(type: PlayerBoardProposalType): string {
  switch (type) {
    case "growth_capex":
      return "Growth";
    case "guest_experience_program":
      return "Guest";
    case "debt_repayment":
      return "Debt";
    case "structured_equity_raise":
      return "Equity";
    case "share_buyback":
      return "Buyback";
  }
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

function failure(state: WorldParkLeagueState, message: string): GovernanceProposalDecisionResult {
  return {
    ok: false,
    state,
    cashDelta: 0,
    loanDelta: 0,
    message,
  };
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatCompactSignedMoney(value: number): string {
  const absValue = Math.abs(value);
  const prefix = value >= 0 ? "+" : "-";
  if (absValue >= 1_000_000) {
    return `${prefix}$${(absValue / 1_000_000).toFixed(1)}m`;
  }
  if (absValue >= 1_000) {
    return `${prefix}$${(absValue / 1_000).toFixed(0)}k`;
  }
  return `${prefix}$${Math.round(absValue)}`;
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
