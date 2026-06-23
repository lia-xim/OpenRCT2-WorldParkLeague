import {
  estimateBuybackPrice,
  getActiveEquityOfferRows,
  getFounderOwnedShare,
  getOutsideOwnedShare,
} from "../domain/equity";
import {
  getActiveProgramSummary,
  getBoardProposalRows,
} from "../domain/governance";
import { calculateOwnerNetWorth } from "../domain/owner";
import { calculatePlayerEquityValue, readPlayerSnapshot } from "../domain/player";
import {
  acceptGovernanceProposal,
  acceptPlayerEquityOffer,
  declineGovernanceProposal,
  declinePlayerEquityOffer,
  repurchasePlayerEquity,
  readState,
  startLeagueAction,
} from "../state/repository";
import { PLUGIN_NAME } from "../config";
import { formatCompactMoney, formatMoney } from "../domain/currency";
import {
  getActionDefinition,
  getActionDefinitionRows,
  getActionDefinitionTypes,
  getPlayerActionSummary,
} from "../domain/playerActions";
import { drawStatCard, type StatCardModel } from "./statCard";
import type {
  PlayerLeagueActionType,
  PlayerSnapshot,
  WorldParkLeagueState,
} from "../types";

const CAPITAL_DESK_CLASSIFICATION = "world-park-league.capital-desk";
const CAPITAL_DESK_TITLE = `${PLUGIN_NAME} | Money`;
const WINDOW_WIDTH = 540;
const WINDOW_HEIGHT = 742;

let selectedOfferId: string | null = null;
let offerRowIds: string[] = [];
let selectedProposalId: string | null = null;
let proposalRowIds: string[] = [];
let selectedActionType: PlayerLeagueActionType | null = null;
let actionRowTypes: PlayerLeagueActionType[] = [];
let equityOverviewCard: StatCardModel = { rows: [] };

export function openCapitalDeskWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  const state = readState(snapshot);
  const existing = ui.getWindow(CAPITAL_DESK_CLASSIFICATION);
  if (existing) {
    existing.bringToFront();
    updateCapitalDeskContents(state, snapshot);
    return;
  }

  ui.openWindow({
    classification: CAPITAL_DESK_CLASSIFICATION,
    title: CAPITAL_DESK_TITLE,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxWidth: WINDOW_WIDTH,
    maxHeight: WINDOW_HEIGHT,
    onClose: () => {
      selectedOfferId = null;
      offerRowIds = [];
      selectedProposalId = null;
      proposalRowIds = [];
      selectedActionType = null;
      actionRowTypes = [];
    },
    widgets: [
      { type: "groupbox", x: 8, y: 18, width: 524, height: 150, text: "Money Snapshot" },
      {
        type: "custom",
        name: "equity-card",
        x: 18,
        y: 34,
        width: 504,
        height: 100,
        onDraw(g) {
          drawStatCard(this, g, equityOverviewCard);
        },
      },
      { type: "label", name: "owner-boundary", x: 18, y: 136, width: 504, height: 24, text: "" },

      { type: "groupbox", x: 8, y: 174, width: 524, height: 176, text: "Investor Offers" },
      {
        type: "listview",
        name: "offer-list",
        x: 18,
        y: 192,
        width: 504,
        height: 88,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: true,
        columns: [
          { header: "Buyer", width: 206 },
          { header: "Equity", width: 52 },
          { header: "Price", width: 96 },
          { header: "Expiry", width: 54 },
          { header: "Type", width: 74 },
        ],
        items: [],
        onClick: (item) => {
          const offerId = offerRowIds[item];
          if (!offerId) {
            return;
          }

          selectedOfferId = offerId;
          updateCapitalDeskContents(readState(readPlayerSnapshot()), readPlayerSnapshot());
        },
      },
      {
        type: "button",
        name: "accept-offer",
        x: 18,
        y: 286,
        width: 110,
        height: 16,
        text: "Accept offer",
        onClick: () => {
          handleOfferAction("accept");
        },
      },
      {
        type: "button",
        name: "decline-offer",
        x: 136,
        y: 286,
        width: 110,
        height: 16,
        text: "Decline offer",
        onClick: () => {
          handleOfferAction("decline");
        },
      },
      {
        type: "button",
        name: "buyback-5",
        x: 256,
        y: 286,
        width: 96,
        height: 16,
        text: "Buy back 5%",
        onClick: () => {
          handleBuybackAction(0.05);
        },
      },
      {
        type: "button",
        name: "buyback-10",
        x: 360,
        y: 286,
        width: 96,
        height: 16,
        text: "Buy back 10%",
        onClick: () => {
          handleBuybackAction(0.1);
        },
      },
      { type: "label", name: "offer-hint", x: 18, y: 306, width: 504, height: 14, text: "" },
      { type: "label", name: "offer-footer", x: 18, y: 324, width: 504, height: 18, text: "" },

      { type: "groupbox", x: 8, y: 356, width: 524, height: 170, text: "Board Decisions" },
      {
        type: "listview",
        name: "proposal-list",
        x: 18,
        y: 374,
        width: 504,
        height: 88,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: true,
        columns: [
          { header: "Proposal", width: 262 },
          { header: "Type", width: 68 },
          { header: "Cash", width: 96 },
          { header: "Expiry", width: 58 },
        ],
        items: [],
        onClick: (item) => {
          const proposalId = proposalRowIds[item];
          if (!proposalId) {
            return;
          }

          selectedProposalId = proposalId;
          updateCapitalDeskContents(readState(readPlayerSnapshot()), readPlayerSnapshot());
        },
      },
      {
        type: "button",
        name: "approve-proposal",
        x: 18,
        y: 468,
        width: 110,
        height: 16,
        text: "Approve vote",
        onClick: () => {
          handleProposalAction("approve");
        },
      },
      {
        type: "button",
        name: "decline-proposal",
        x: 136,
        y: 468,
        width: 110,
        height: 16,
        text: "Decline vote",
        onClick: () => {
          handleProposalAction("decline");
        },
      },
      { type: "label", name: "proposal-hint", x: 18, y: 490, width: 504, height: 20, text: "" },
      { type: "label", name: "proposal-footer", x: 18, y: 510, width: 504, height: 12, text: "" },

      { type: "groupbox", x: 8, y: 532, width: 524, height: 198, text: "Actions" },
      {
        type: "listview",
        name: "action-list",
        x: 18,
        y: 550,
        width: 504,
        height: 96,
        scrollbars: "vertical",
        isStriped: true,
        showColumnHeaders: true,
        canSelect: true,
        columns: [
          { header: "Action", width: 184 },
          { header: "Cost", width: 82 },
          { header: "Length", width: 64 },
          { header: "Focus", width: 156 },
        ],
        items: [],
        onClick: (item) => {
          const actionType = actionRowTypes[item];
          if (!actionType) {
            return;
          }

          selectedActionType = actionType;
          updateCapitalDeskContents(readState(readPlayerSnapshot()), readPlayerSnapshot());
        },
      },
      {
        type: "button",
        name: "action-launch",
        x: 18,
        y: 654,
        width: 132,
        height: 16,
        text: "Launch selected",
        onClick: () => {
          if (selectedActionType) {
            handleLeagueAction(selectedActionType);
          }
        },
      },
      {
        type: "button",
        name: "action-counter",
        x: 158,
        y: 654,
        width: 110,
        height: 16,
        text: "Counter rival",
        onClick: () => {
          handleLeagueAction("rival_counter_pr");
        },
      },
      {
        type: "button",
        name: "action-local",
        x: 276,
        y: 654,
        width: 110,
        height: 16,
        text: "Local push",
        onClick: () => {
          handleLeagueAction("local_discount_push");
        },
      },
      {
        type: "button",
        name: "action-build",
        x: 394,
        y: 654,
        width: 88,
        height: 16,
        text: "Build focus",
        onClick: () => {
          handleLeagueAction("build_focus");
        },
      },
      { type: "label", name: "action-hint", x: 18, y: 678, width: 504, height: 22, text: "" },
      { type: "label", name: "action-footer", x: 18, y: 704, width: 504, height: 20, text: "" },
    ],
  });

  updateCapitalDeskContents(state, snapshot);
}

export function refreshCapitalDeskWindow(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(CAPITAL_DESK_CLASSIFICATION);
  if (!window || context.mode !== "normal") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  updateCapitalDeskContents(readState(snapshot), snapshot);
}

export function closeCapitalDeskWindowIfOpen(): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(CAPITAL_DESK_CLASSIFICATION);
  if (window) {
    window.close();
  }

  selectedOfferId = null;
  offerRowIds = [];
  selectedProposalId = null;
  proposalRowIds = [];
  selectedActionType = null;
  actionRowTypes = [];
}

function updateCapitalDeskContents(state: WorldParkLeagueState, snapshot: PlayerSnapshot): void {
  if (typeof ui === "undefined") {
    return;
  }

  const window = ui.getWindow(CAPITAL_DESK_CLASSIFICATION);
  if (!window) {
    return;
  }

  const founderShare = getFounderOwnedShare(state);
  const outsideShare = getOutsideOwnedShare(state);
  const ownerNetWorth = calculateOwnerNetWorth(state, snapshot);
  equityOverviewCard = {
    rows: [
      {
        left: { label: "Founder owned", value: `${(founderShare * 100).toFixed(0)}%` },
        right: { label: "Outside owned", value: `${(outsideShare * 100).toFixed(0)}%` },
      },
      {
        left: { label: "Park cash", value: formatCompactMoney(snapshot.cash) },
        right: { label: "Portfolio", value: formatCompactMoney(state.player.investmentSummary.portfolioValue) },
      },
      {
        left: { label: "Last league flow", value: formatCompactMoney(state.player.investmentSummary.lastMonthCashDelta) },
        right: { label: "League worth", value: formatCompactMoney(ownerNetWorth) },
      },
      {
        left: { label: "Park value", value: formatCompactMoney(calculatePlayerEquityValue(snapshot)) },
        right: { label: "Cash raised", value: formatCompactMoney(state.player.equity.totalCashRaised) },
      },
      {
        left: { label: "Open offers", value: state.player.equity.activeOffers.length.toString() },
        right: { label: "Votes", value: state.player.governance.pendingProposals.length.toString() },
      },
    ],
  };
  setLabel(
    window,
    "owner-boundary",
    trimText(
      `Park cash now funds rival stakes and receives dividends, exits, challenge payouts and prestige cash. This makes league decisions directly affect building money. Last flow: ${state.player.owner.lastCashFlowSummary ?? "No recent flow."}`,
      124
    )
  );

  const list = window.findWidget("offer-list") as ListViewWidget | null;
  if (list) {
    offerRowIds = state.player.equity.activeOffers.map((offer) => offer.id);
    list.items = getActiveEquityOfferRows(state);
  }

  if (selectedOfferId && !offerRowIds.includes(selectedOfferId)) {
    selectedOfferId = offerRowIds[0] ?? null;
  }
  if (!selectedOfferId) {
    selectedOfferId = offerRowIds[0] ?? null;
  }

  const proposalList = window.findWidget("proposal-list") as ListViewWidget | null;
  if (proposalList) {
    proposalRowIds = state.player.governance.pendingProposals.map((proposal) => proposal.id);
    proposalList.items = getBoardProposalRows(state);
  }
  const actionList = window.findWidget("action-list") as ListViewWidget | null;
  if (actionList) {
    actionRowTypes = getActionDefinitionTypes();
    actionList.items = getActionDefinitionRows();
  }
  if (selectedActionType && !actionRowTypes.includes(selectedActionType)) {
    selectedActionType = actionRowTypes[0] ?? null;
  }
  if (!selectedActionType) {
    selectedActionType = actionRowTypes[0] ?? null;
  }
  if (selectedProposalId && !proposalRowIds.includes(selectedProposalId)) {
    selectedProposalId = proposalRowIds[0] ?? null;
  }
  if (!selectedProposalId) {
    selectedProposalId = proposalRowIds[0] ?? null;
  }

  const selectedOffer = state.player.equity.activeOffers.find((offer) => offer.id === selectedOfferId) ?? null;
  const selectedProposal =
    state.player.governance.pendingProposals.find((proposal) => proposal.id === selectedProposalId) ?? null;
  const selectedActionDefinition = selectedActionType ? getActionDefinition(selectedActionType) : null;
  const selectedActionProgram =
    selectedActionType
      ? state.player.actions.activeActions.find((action) => action.type === selectedActionType) ?? null
      : null;
  setButtonDisabled(window, "accept-offer", !selectedOffer);
  setButtonDisabled(window, "decline-offer", !selectedOffer);
  setButtonDisabled(window, "buyback-5", state.player.equity.outsideOwnedShare < 0.05);
  setButtonDisabled(window, "buyback-10", state.player.equity.outsideOwnedShare < 0.1);
  setButtonDisabled(window, "approve-proposal", !selectedProposal);
  setButtonDisabled(window, "decline-proposal", !selectedProposal);
  setButtonDisabled(window, "action-launch", !selectedActionDefinition);
  const buybackFive = state.player.equity.outsideOwnedShare >= 0.05
    ? estimateBuybackPrice(state, snapshot, 0.05)
    : 0;
  const buybackTen = state.player.equity.outsideOwnedShare >= 0.1
    ? estimateBuybackPrice(state, snapshot, 0.1)
    : 0;
  setLabel(
    window,
    "offer-hint",
    selectedOffer
      ? `Selected offer: ${selectedOffer.buyerName}, ${(selectedOffer.share * 100).toFixed(0)}%, price ${formatMoney(selectedOffer.price)}, premium ${(selectedOffer.premiumRate * 100).toFixed(1)}%`
      : `Indicative buyback prices: 5% ${buybackFive > 0 ? formatMoney(buybackFive) : "n/a"}, 10% ${buybackTen > 0 ? formatMoney(buybackTen) : "n/a"}`
  );
  setLabel(
    window,
    "offer-footer",
    state.player.equity.lastAcceptedOfferSummary ??
      state.player.equity.lastBuybackSummary ??
      state.player.equity.lastDeclinedOfferSummary ??
      "Offers affect real park cash. Use buybacks when you want more control again."
  );
  setLabel(
    window,
    "proposal-hint",
    selectedProposal
      ? `${selectedProposal.title}: ${selectedProposal.summary}`
      : "Board votes approve capital measures, program spending and ownership moves."
  );
  setLabel(
    window,
    "proposal-footer",
    `${state.player.governance.lastProposalSummary ?? "No recent board decision."} ${getActiveProgramSummary(state)}`
  );
  setLabel(
    window,
    "action-hint",
    selectedActionDefinition
      ? buildActionHint(selectedActionDefinition, selectedActionProgram?.daysRemaining ?? null)
      : state.player.actions.lastActionSummary ??
          "League actions are direct short-term plays that cost cash and shape score, guest flow and live form."
  );
  setLabel(
    window,
    "action-footer",
    selectedActionDefinition
      ? `Effect: score +${selectedActionDefinition.scoreBonus.toFixed(1)}, people +${(selectedActionDefinition.guestCapBonus * 100).toFixed(1)}%, form +${selectedActionDefinition.momentumBonus.toFixed(1)}. ${getPlayerActionSummary(state)}`
      : `${getPlayerActionSummary(state)} | Select an action, then launch it.`
  );
}

function handleOfferAction(mode: "accept" | "decline"): void {
  if (typeof ui === "undefined") {
    return;
  }

  const offerId = selectedOfferId;
  if (!offerId) {
    ui.showError(CAPITAL_DESK_TITLE, "Select an offer first.");
    return;
  }

  const snapshot = readPlayerSnapshot();
  const result =
    mode === "accept"
      ? acceptPlayerEquityOffer(offerId, snapshot)
      : declinePlayerEquityOffer(offerId, snapshot);
  if (!result.ok) {
    ui.showError(CAPITAL_DESK_TITLE, result.message);
    return;
  }

  park.postMessage(`[World Park League] ${result.message}`);
  updateCapitalDeskContents(result.state, readPlayerSnapshot());
}

function handleProposalAction(mode: "approve" | "decline"): void {
  if (typeof ui === "undefined") {
    return;
  }

  const proposalId = selectedProposalId;
  if (!proposalId) {
    ui.showError(CAPITAL_DESK_TITLE, "Select a board vote first.");
    return;
  }

  const snapshot = readPlayerSnapshot();
  const result =
    mode === "approve"
      ? acceptGovernanceProposal(proposalId, snapshot)
      : declineGovernanceProposal(proposalId, snapshot);
  if (!result.ok) {
    ui.showError(CAPITAL_DESK_TITLE, result.message);
    return;
  }

  park.postMessage(`[World Park League] ${result.message}`);
  updateCapitalDeskContents(result.state, readPlayerSnapshot());
}

function handleBuybackAction(share: number): void {
  if (typeof ui === "undefined") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  const result = repurchasePlayerEquity(share, snapshot);
  if (!result.ok) {
    ui.showError(CAPITAL_DESK_TITLE, result.message);
    return;
  }

  park.postMessage(`[World Park League] ${result.message}`);
  updateCapitalDeskContents(result.state, readPlayerSnapshot());
}

function handleLeagueAction(actionType: PlayerLeagueActionType): void {
  if (typeof ui === "undefined") {
    return;
  }

  const snapshot = readPlayerSnapshot();
  const result = startLeagueAction(actionType, snapshot);
  if (!result.ok) {
    ui.showError(CAPITAL_DESK_TITLE, result.message);
    return;
  }

  park.postMessage(`[World Park League] ${result.message}`);
  updateCapitalDeskContents(result.state, readPlayerSnapshot());
}

function setButtonDisabled(window: Window, name: string, isDisabled: boolean): void {
  const widget = window.findWidget(name) as ButtonWidget | null;
  if (widget) {
    widget.isDisabled = isDisabled;
  }
}

function setLabel(window: Window, name: string, text: string): void {
  const widget = window.findWidget(name) as LabelWidget | null;
  if (widget) {
    widget.text = text;
  }
}

function buildActionHint(
  definition: NonNullable<ReturnType<typeof getActionDefinition>>,
  activeDaysRemaining: number | null
): string {
  const stateText = activeDaysRemaining
    ? `Active now, ${activeDaysRemaining}d remaining.`
    : `Ready to launch for ${formatMoney(definition.upfrontCost)}.`;

  return `${definition.title}: ${definition.story} ${definition.bestUse} ${stateText}`;
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
