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
const CAPITAL_DESK_TITLE = `${PLUGIN_NAME} | Capital Desk`;

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
    width: 540,
    height: 680,
    minWidth: 540,
    minHeight: 680,
    maxWidth: 540,
    maxHeight: 680,
    onClose: () => {
      selectedOfferId = null;
      offerRowIds = [];
      selectedProposalId = null;
      proposalRowIds = [];
      selectedActionType = null;
      actionRowTypes = [];
    },
    widgets: [
      { type: "groupbox", x: 8, y: 18, width: 524, height: 98, text: "Equity Overview" },
      {
        type: "custom",
        name: "equity-card",
        x: 18,
        y: 34,
        width: 504,
        height: 72,
        onDraw(g) {
          drawStatCard(this, g, equityOverviewCard);
        },
      },

      { type: "groupbox", x: 8, y: 122, width: 524, height: 176, text: "Open Capital Offers" },
      {
        type: "listview",
        name: "offer-list",
        x: 18,
        y: 140,
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
        y: 234,
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
        y: 234,
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
        y: 234,
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
        y: 234,
        width: 96,
        height: 16,
        text: "Buy back 10%",
        onClick: () => {
          handleBuybackAction(0.1);
        },
      },
      { type: "label", name: "offer-hint", x: 18, y: 254, width: 504, height: 14, text: "" },
      { type: "label", name: "offer-footer", x: 18, y: 272, width: 504, height: 18, text: "" },

      { type: "groupbox", x: 8, y: 304, width: 524, height: 170, text: "Board Votes" },
      {
        type: "listview",
        name: "proposal-list",
        x: 18,
        y: 322,
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
        y: 416,
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
        y: 416,
        width: 110,
        height: 16,
        text: "Decline vote",
        onClick: () => {
          handleProposalAction("decline");
        },
      },
      { type: "label", name: "proposal-hint", x: 18, y: 438, width: 504, height: 20, text: "" },
      { type: "label", name: "proposal-footer", x: 18, y: 458, width: 504, height: 12, text: "" },

      { type: "groupbox", x: 8, y: 480, width: 524, height: 190, text: "League Actions" },
      {
        type: "listview",
        name: "action-list",
        x: 18,
        y: 498,
        width: 504,
        height: 92,
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
        name: "action-pr",
        x: 18,
        y: 598,
        width: 110,
        height: 16,
        text: "PR Blitz",
        onClick: () => {
          handleLeagueAction("pr_blitz");
        },
      },
      {
        type: "button",
        name: "action-festival",
        x: 136,
        y: 598,
        width: 110,
        height: 16,
        text: "Guest Fest",
        onClick: () => {
          handleLeagueAction("guest_festival");
        },
      },
      {
        type: "button",
        name: "action-safety",
        x: 254,
        y: 598,
        width: 110,
        height: 16,
        text: "Safety Camp",
        onClick: () => {
          handleLeagueAction("safety_campaign");
        },
      },
      {
        type: "button",
        name: "action-efficiency",
        x: 372,
        y: 598,
        width: 110,
        height: 16,
        text: "Efficiency",
        onClick: () => {
          handleLeagueAction("efficiency_push");
        },
      },
      { type: "label", name: "action-hint", x: 18, y: 620, width: 504, height: 22, text: "" },
      { type: "label", name: "action-footer", x: 18, y: 644, width: 504, height: 18, text: "" },
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
  equityOverviewCard = {
    rows: [
      {
        left: { label: "Founder owned", value: `${(founderShare * 100).toFixed(0)}%` },
        right: { label: "Outside owned", value: `${(outsideShare * 100).toFixed(0)}%` },
      },
      {
        left: { label: "Park cash", value: formatCompactMoney(snapshot.cash) },
        right: { label: "Cash raised", value: formatCompactMoney(state.player.equity.totalCashRaised) },
      },
      {
        left: { label: "Park value", value: formatCompactMoney(snapshot.parkValue) },
        right: { label: "Loan", value: formatCompactMoney(snapshot.bankLoan) },
      },
      {
        left: { label: "Equity value", value: formatCompactMoney(calculatePlayerEquityValue(snapshot)) },
        right: { label: "Open offers", value: state.player.equity.activeOffers.length.toString() },
      },
      {
        left: { label: "Pending votes", value: state.player.governance.pendingProposals.length.toString() },
        right: { label: "Active programs", value: state.player.governance.activePrograms.length.toString() },
      },
    ],
  };

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
      "Capital offers bring in cash. Buybacks reduce outside ownership but cost current market price."
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
      ? `Effect: score +${selectedActionDefinition.scoreBonus.toFixed(1)}, people +${(selectedActionDefinition.guestCapBonus * 100).toFixed(1)}%, live form +${selectedActionDefinition.momentumBonus.toFixed(1)}. ${getPlayerActionSummary(state)}`
      : `${getPlayerActionSummary(state)} | These are player-triggered plays, not random world events.`
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

function handleLeagueAction(
  actionType: "pr_blitz" | "guest_festival" | "safety_campaign" | "efficiency_push"
): void {
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
