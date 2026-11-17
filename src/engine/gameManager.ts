import { CARD_MANIFEST, Suit } from '../assets/cardManifest';
import { evaluateBiddingState, isLegalBid } from './bidding';
import { getBiddingOrder, getLeftOfDealer, hasPointCard } from './biddingOrder';
import { create29Deck, deal29Deck, shuffleDeck, sortHand } from './deck';
import { canDeclarePair, detectKingQueenPair, PAIR_MIN_CONTRACT_BID, evaluateRoundScore, calculatePlayerPoints } from './scoring';
import { evaluateTrickWinner, isLegalCardPlay } from './tricks';
import { 
  BidEntry,
  CompletedTrick, 
  DEFAULT_RULES_CONFIG, 
  GamePhase, 
  GameRulesConfig, 
  GameState, 
  PlayedCard, 
  PlayerInfo, 
  PlayerPosition, 
  PublicGameState, 
  RoundSummary, 
  SeventhCardInfo, 
  Team, 
  TrumpMode, 
  TrumpSelectionChoice 
} from './types';

/**
 * Creates a new GameState initialized in WAITING_LOBBY.
 * Selects initial dealer randomly at match start.
 */
export const createInitialGame = (
  roomCode: string,
  players: PlayerInfo[],
  rules: GameRulesConfig = DEFAULT_RULES_CONFIG
): GameState => {
  // Randomly select one of the four players as initial dealer
  const dealerIndex = Math.floor(Math.random() * 4) as PlayerPosition;
  const biddingOrder = getBiddingOrder(dealerIndex);
  const firstBidder = biddingOrder[0];

  return {
    id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    roomCode,
    phase: 'WAITING_LOBBY',
    rules,
    players,
    dealerIndex,
    currentTurn: firstBidder,
    biddingOrder,
    biddingTurnIndex: 0,
    bids: [],
    highestBid: 0,
    highestBidder: null,
    consecutivePasses: 0,
    trumpMode: 'suit',
    trumpSuit: null,
    isTrumpRevealed: false,
    trumpRevealedBy: null,
    trumpRevealedAtTrick: null,
    seventhCard: null,
    hands: { 0: [], 1: [], 2: [], 3: [] },
    currentTrickNumber: 1,
    currentTrickLead: firstBidder,
    currentTrickCards: [],
    completedTricks: [],
    lastCompletedTrick: null,
    pairDeclaration: null,
    dealMultiplier: 1,
    doubleStatus: 'NONE',
    doubledBy: null,
    redoubledBy: null,
    specialAnnouncement: null,
    adjustedTarget: null,
    playerPoints: { 0: 0, 1: 0, 2: 0, 3: 0 },
    roundNumber: 1,
    matchScore: { team0: 0, team1: 0 },
    roundHistory: [],
    winnerTeam: null,
    version: 1,
    lastActionTimestamp: Date.now(),
  };
};

/**
 * Deals 4 cards to each player, verifying that the first bidder holds at least
 * one point-valued card (J=3, 9=2, A=1, 10=1).
 * If not, the entire 32-card deck is reshuffled and redistributed until satisfied.
 */
export const dealWithFirstBidderEligibility = (
  dealerIndex: PlayerPosition
): { round1: Record<PlayerPosition, string[]>; round2: Record<PlayerPosition, string[]> } => {
  const firstBidder = getLeftOfDealer(dealerIndex);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const shuffled = shuffleDeck(create29Deck());
    const { round1, round2 } = deal29Deck(shuffled);
    if (hasPointCard(round1[firstBidder])) {
      return { round1, round2 };
    }
  }
  // Extremely rare fallback: return shuffled deal
  const fallbackShuffled = shuffleDeck(create29Deck());
  return deal29Deck(fallbackShuffled);
};

/**
 * Starts a new deal (round):
 * - Rotates dealer by one seat clockwise on subsequent rounds
 * - Deals 4 cards to each player with first-bidder minimum point-card eligibility
 * - Initiates the single-round bidding sequence
 */
export const startNewRound = (state: GameState, nextDealer?: PlayerPosition): GameState => {
  let dealerIndex: PlayerPosition;
  if (nextDealer !== undefined) {
    dealerIndex = nextDealer;
  } else if (state.phase !== 'WAITING_LOBBY') {
    dealerIndex = ((state.dealerIndex + 1) % 4) as PlayerPosition;
  } else {
    dealerIndex = state.dealerIndex;
  }

  const biddingOrder = getBiddingOrder(dealerIndex);
  const firstBidder = biddingOrder[0];

  const { round1, round2 } = dealWithFirstBidderEligibility(dealerIndex);

  const hands: Record<PlayerPosition, string[]> = {
    0: sortHand(round1[0]),
    1: sortHand(round1[1]),
    2: sortHand(round1[2]),
    3: sortHand(round1[3]),
  };

  const roundNumber = state.phase === 'WAITING_LOBBY' ? 1 : (state.roundNumber || 0) + 1;

  return {
    ...state,
    roundNumber,
    phase: 'BIDDING',
    dealerIndex,
    currentTurn: firstBidder,
    biddingOrder,
    biddingTurnIndex: 0,
    bids: [],
    highestBid: 0,
    highestBidder: null,
    consecutivePasses: 0,
    trumpMode: 'suit',
    trumpSuit: null,
    isTrumpRevealed: false,
    trumpRevealedBy: null,
    trumpRevealedAtTrick: null,
    seventhCard: null,
    hands,
    currentTrickNumber: 1,
    currentTrickLead: firstBidder,
    currentTrickCards: [],
    completedTricks: [],
    lastCompletedTrick: null,
    pairDeclaration: null,
    dealMultiplier: 1,
    doubleStatus: 'NONE',
    doubledBy: null,
    redoubledBy: null,
    doubleVotes: {},
    redoubleVotes: {},
    specialAnnouncement: null,
    adjustedTarget: null,
    playerPoints: { 0: 0, 1: 0, 2: 0, 3: 0 },
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
    // Keep secondary 4 cards accessible for deal phase 2
    _pendingSecondDeal: round2,
  } as GameState;
};

/**
 * Handles a bid or pass action in the single-round auction (4 turns total).
 */
export const applyBid = (
  state: GameState,
  playerIndex: PlayerPosition,
  bid: number | 'PASS'
): { success: boolean; state: GameState; error?: string } => {
  if (state.phase !== 'BIDDING') {
    return { success: false, state, error: 'Not currently in bidding phase' };
  }

  if (state.currentTurn !== playerIndex) {
    return { success: false, state, error: 'Not your turn to bid' };
  }

  const turnIndex = state.bids.length;
  if (turnIndex >= 4) {
    return { success: false, state, error: 'Bidding for this deal is already completed' };
  }

  const expectedBidder = state.biddingOrder[turnIndex];
  if (expectedBidder !== playerIndex) {
    return { success: false, state, error: 'Out-of-turn bid action' };
  }

  // Forced dealer bid applies only on the 4th turn when the first three players passed
  const isForcedDealer = 
    turnIndex === 3 && 
    state.bids.every((b) => b.bid === 'PASS') && 
    playerIndex === state.dealerIndex && 
    state.rules.forcedDealerBid;

  const validation = isLegalBid(bid, state.highestBid, state.rules, isForcedDealer);
  if (!validation.legal) {
    return { success: false, state, error: validation.reason };
  }

  const newBids: BidEntry[] = [
    ...state.bids,
    { playerIndex, bid, timestamp: Date.now() },
  ];

  const biddingStatus = evaluateBiddingState(newBids, state.dealerIndex, state.rules);

  if (biddingStatus.isComplete) {
    if (biddingStatus.highestBidder !== null) {
      // Single-round complete: transition to TRUMP_SELECTION with winning bidder
      return {
        success: true,
        state: {
          ...state,
          phase: 'TRUMP_SELECTION',
          bids: newBids,
          biddingTurnIndex: 4,
          highestBid: biddingStatus.highestBid,
          highestBidder: biddingStatus.highestBidder,
          currentTurn: biddingStatus.highestBidder,
          version: state.version + 1,
          lastActionTimestamp: Date.now(),
        },
      };
    } else {
      // All 4 passed without a bid: void deal, re-deal cards by advancing dealer
      const nextDealer = ((state.dealerIndex + 1) % 4) as PlayerPosition;
      const redealtState = startNewRound(state, nextDealer);
      return {
        success: true,
        state: {
          ...redealtState,
          version: state.version + 1,
          lastActionTimestamp: Date.now(),
        },
      };
    }
  }

  return {
    success: true,
    state: {
      ...state,
      bids: newBids,
      biddingTurnIndex: newBids.length,
      highestBid: biddingStatus.highestBid,
      highestBidder: biddingStatus.highestBidder,
      currentTurn: biddingStatus.nextTurn,
      version: state.version + 1,
      lastActionTimestamp: Date.now(),
    },
  };
};

/**
 * Handles bidder's trump selection from six options:
 * - 4 Suits (Hearts, Spades, Clubs, Diamonds)
 * - Joker (No Trump)
 * - 7th Card (Special Trump reservation)
 * Keeps hands at 4 cards, preserves secondary deal cards, and initiates Double decision phase.
 */
export const applyTrumpSelection = (
  state: GameState,
  playerIndex: PlayerPosition,
  choice: TrumpSelectionChoice
): { success: boolean; state: GameState; error?: string } => {
  if (state.phase !== 'TRUMP_SELECTION') {
    return { success: false, state, error: 'Not currently in trump selection phase' };
  }

  if (state.highestBidder !== playerIndex) {
    return { success: false, state, error: 'Only highest bidder can select trump' };
  }

  const pending = state._pendingSecondDeal || { 0: [], 1: [], 2: [], 3: [] };

  let trumpMode: TrumpMode = 'suit';
  let trumpSuit: Suit | null = null;
  let seventhCard: SeventhCardInfo | null = null;
  let phase: GamePhase = 'DOUBLE_DECISION';
  let specialAnnouncement: GameState['specialAnnouncement'] = null;

  if (choice === 'NO_TRUMP') {
    trumpMode = 'no-trump';
    trumpSuit = null;
    seventhCard = null;
    phase = 'TRUMP_ANNOUNCEMENT';
    specialAnnouncement = {
      type: 'NO_TRUMP',
      expiresAt: Date.now() + 1000,
    };
  } else if (choice === 'SEVENTH_CARD') {
    trumpMode = 'seventh-card';
    const bidderPending = pending[playerIndex] || [];
    // The 7th card overall is the 3rd card in the second 4-card deal (index 2)
    const seventhCardId = bidderPending[2] || bidderPending[0];
    seventhCard = {
      cardId: seventhCardId,
      owner: playerIndex,
      isRevealed: false,
    };
    trumpSuit = CARD_MANIFEST[seventhCardId]?.suit || 'SPADES';
    phase = 'TRUMP_ANNOUNCEMENT';
    specialAnnouncement = {
      type: 'SEVENTH_CARD',
      expiresAt: Date.now() + 1000,
    };
  } else {
    // Four suits: 'HEARTS' | 'SPADES' | 'CLUBS' | 'DIAMONDS'
    trumpMode = 'suit';
    trumpSuit = choice as Suit;
    seventhCard = null;
    phase = 'DOUBLE_DECISION';
    specialAnnouncement = null;
  }

  const newState: GameState = {
    ...state,
    phase,
    trumpMode,
    trumpSuit,
    isTrumpRevealed: false,
    seventhCard,
    specialAnnouncement,
    // Keep hands at 4 cards each during Double / Re-Double
    hands: state.hands,
    dealMultiplier: 1,
    doubleStatus: 'NONE',
    doubledBy: null,
    redoubledBy: null,
    doubleVotes: {},
    redoubleVotes: {},
    adjustedTarget: null,
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
    _pendingSecondDeal: pending,
  };

  return {
    success: true,
    state: newState,
  };
};

/**
 * Completes the 1-second Joker/7th-card trump announcement and transitions to DOUBLE_DECISION.
 */
export const applyTrumpAnnouncementComplete = (state: GameState): GameState => {
  if (state.phase !== 'TRUMP_ANNOUNCEMENT') {
    return state;
  }
  return {
    ...state,
    phase: 'DOUBLE_DECISION',
    specialAnnouncement: null,
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
  };
};

/**
 * Deals the remaining 4 cards to each player after the Double/Redouble phase concludes.
 * In 7th Card mode:
 * - The reserved 7th card remains set aside for the bidder (bidder gets other 3 cards -> 7 total).
 * - Other 3 players receive all 4 cards (8 total).
 * In Suit or No-Trump mode:
 * - All 4 players receive all 4 cards (8 total).
 * Transitions phase to TRICK_PLAY.
 */
export const applySecondDeal = (state: GameState): GameState => {
  const pending = state._pendingSecondDeal || { 0: [], 1: [], 2: [], 3: [] };
  const fullHands: Record<PlayerPosition, string[]> = { 0: [], 1: [], 2: [], 3: [] };

  if (state.trumpMode === 'seventh-card' && state.seventhCard && state.highestBidder !== null) {
    const bidderIndex = state.highestBidder;
    const seventhCardId = state.seventhCard.cardId;
    const bidderPending = pending[bidderIndex] || [];
    const otherThree = bidderPending.filter((id) => id !== seventhCardId);
    fullHands[bidderIndex] = sortHand([...(state.hands[bidderIndex] || []), ...otherThree]);

    for (let p = 0; p < 4; p++) {
      const pos = p as PlayerPosition;
      if (pos !== bidderIndex) {
        fullHands[pos] = sortHand([...(state.hands[pos] || []), ...(pending[pos] || [])]);
      }
    }
  } else {
    for (let p = 0; p < 4; p++) {
      const pos = p as PlayerPosition;
      fullHands[pos] = sortHand([...(state.hands[pos] || []), ...(pending[pos] || [])]);
    }
  }

  const firstTrickLead = getLeftOfDealer(state.dealerIndex);

  const nextState: GameState = {
    ...state,
    phase: 'TRICK_PLAY',
    hands: fullHands,
    currentTrickNumber: 1,
    currentTrickLead: firstTrickLead,
    currentTurn: firstTrickLead,
    currentTrickCards: [],
    completedTricks: [],
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
  };

  delete nextState._pendingSecondDeal;
  return nextState;
};

/**
 * Handles defending team's Double decision with team-based semantics:
 * - If EITHER defender chooses DOUBLE, team decision is accepted immediately -> REDOUBLE_DECISION (2x).
 * - If a defender chooses PASS, wait for partner. Team decision is PASS only when BOTH teammates pass.
 * - Once Double phase concludes with PASS, deals remaining 4 cards and transitions to TRICK_PLAY.
 */
export const applyDoubleDecision = (
  state: GameState,
  playerIndex: PlayerPosition,
  decision: 'DOUBLE' | 'PASS'
): { success: boolean; state: GameState; error?: string } => {
  if (state.phase !== 'DOUBLE_DECISION') {
    return { success: false, state, error: 'Not currently in Double decision phase' };
  }

  const biddingTeam: Team = (state.highestBidder === 0 || state.highestBidder === 2) ? 0 : 1;
  const playerTeam: Team = (playerIndex === 0 || playerIndex === 2) ? 0 : 1;
  if (playerTeam === biddingTeam) {
    return { success: false, state, error: 'Only the defending team can make the Double decision' };
  }

  if (state.doubleVotes?.[playerIndex]) {
    return { success: false, state, error: 'You have already made your Double decision' };
  }

  const defendingTeam: Team = biddingTeam === 0 ? 1 : 0;
  const defenderPositions: [PlayerPosition, PlayerPosition] = defendingTeam === 0 ? [0, 2] : [1, 3];

  if (decision === 'DOUBLE') {
    // Immediate team acceptance
    const updatedVotes = { ...(state.doubleVotes || {}), [playerIndex]: 'DOUBLE' as const };
    return {
      success: true,
      state: {
        ...state,
        phase: 'REDOUBLE_DECISION',
        doubleStatus: 'DOUBLED',
        dealMultiplier: 2,
        doubledBy: playerIndex,
        doubleVotes: updatedVotes,
        redoubleVotes: {},
        version: state.version + 1,
        lastActionTimestamp: Date.now(),
      },
    };
  }

  // Defending player voted PASS
  const updatedVotes = { ...(state.doubleVotes || {}), [playerIndex]: 'PASS' as const };
  const partnerIndex = defenderPositions.find((p) => p !== playerIndex)!;
  const partnerVote = updatedVotes[partnerIndex];

  // If partner hasn't passed yet, record vote and wait
  if (partnerVote !== 'PASS') {
    return {
      success: true,
      state: {
        ...state,
        doubleVotes: updatedVotes,
        version: state.version + 1,
        lastActionTimestamp: Date.now(),
      },
    };
  }

  // BOTH defenders have passed -> Team decision is PASS (1x)
  // Deal the remaining 4 cards and begin trick play
  const stateWithVotes: GameState = {
    ...state,
    doubleStatus: 'NONE',
    dealMultiplier: 1,
    doubleVotes: updatedVotes,
  };

  return {
    success: true,
    state: applySecondDeal(stateWithVotes),
  };
};

/**
 * Handles bidding team's Re-Double decision with team-based semantics:
 * - If EITHER bidder chooses REDOUBLE, team decision is accepted immediately -> 4x multiplier.
 * - If a bidder chooses PASS, wait for partner. Team decision is PASS only when BOTH teammates pass (2x multiplier).
 * - After Re-Double decision concludes (REDOUBLE or both PASS), deals remaining 4 cards and transitions to TRICK_PLAY.
 */
export const applyRedoubleDecision = (
  state: GameState,
  playerIndex: PlayerPosition,
  decision: 'REDOUBLE' | 'PASS'
): { success: boolean; state: GameState; error?: string } => {
  if (state.phase !== 'REDOUBLE_DECISION') {
    return { success: false, state, error: 'Not currently in Re-Double decision phase' };
  }

  const biddingTeam: Team = (state.highestBidder === 0 || state.highestBidder === 2) ? 0 : 1;
  const playerTeam: Team = (playerIndex === 0 || playerIndex === 2) ? 0 : 1;
  if (playerTeam !== biddingTeam) {
    return { success: false, state, error: 'Only the bidding team can make the Re-Double decision' };
  }

  if (state.redoubleVotes?.[playerIndex]) {
    return { success: false, state, error: 'You have already made your Re-Double decision' };
  }

  const bidderPositions: [PlayerPosition, PlayerPosition] = biddingTeam === 0 ? [0, 2] : [1, 3];

  if (decision === 'REDOUBLE') {
    // Immediate team acceptance
    const updatedVotes = { ...(state.redoubleVotes || {}), [playerIndex]: 'REDOUBLE' as const };
    const stateWithRedouble: GameState = {
      ...state,
      doubleStatus: 'REDOUBLED',
      dealMultiplier: 4,
      redoubledBy: playerIndex,
      redoubleVotes: updatedVotes,
    };
    return {
      success: true,
      state: applySecondDeal(stateWithRedouble),
    };
  }

  // Bidding team player voted PASS
  const updatedVotes = { ...(state.redoubleVotes || {}), [playerIndex]: 'PASS' as const };
  const partnerIndex = bidderPositions.find((p) => p !== playerIndex)!;
  const partnerVote = updatedVotes[partnerIndex];

  // If partner hasn't passed yet, wait for partner
  if (partnerVote !== 'PASS') {
    return {
      success: true,
      state: {
        ...state,
        redoubleVotes: updatedVotes,
        version: state.version + 1,
        lastActionTimestamp: Date.now(),
      },
    };
  }

  // BOTH bidders have passed -> Team decision is PASS (contract remains DOUBLED at 2x)
  const stateWithVotes: GameState = {
    ...state,
    doubleStatus: 'DOUBLED',
    dealMultiplier: 2,
    redoubleVotes: updatedVotes,
  };

  return {
    success: true,
    state: applySecondDeal(stateWithVotes),
  };
};

/**
 * Handles requesting/revealing the trump suit during trick play.
 * For 7th Card mode, reveals the card and returns it to the winning bidder's hand.
 * Evaluates King-Queen Pair / Royals upon legal reveal.
 */
export const applyTrumpReveal = (
  state: GameState,
  playerIndex: PlayerPosition
): { success: boolean; state: GameState; error?: string } => {
  if (state.phase !== 'TRICK_PLAY') {
    return { success: false, state, error: 'Trump can only be revealed during trick play' };
  }

  if (state.isTrumpRevealed) {
    return { success: false, state, error: 'Trump is already revealed' };
  }

  if (state.currentTurn !== playerIndex) {
    return { success: false, state, error: 'Can only reveal trump during your turn' };
  }

  // Player can only reveal trump if they cannot follow suit
  if (state.currentTrickCards.length > 0) {
    const leadCard = CARD_MANIFEST[state.currentTrickCards[0].cardId];
    if (leadCard) {
      const canFollow = state.hands[playerIndex].some(
        (id) => CARD_MANIFEST[id]?.suit === leadCard.suit
      );
      if (canFollow) {
        return { success: false, state, error: 'You must follow suit and cannot reveal trump' };
      }
    }
  }

  return { success: true, state: revealTrumpState(state, playerIndex) };
};

/**
 * Reveals the concealed trump (by request, or automatically when a player
 * cuts with a trump card). In 7th Card mode the reserved card returns to the
 * bidder's hand. Evaluates the King-Queen Pair on reveal.
 */
export const revealTrumpState = (state: GameState, revealedBy: PlayerPosition): GameState => {
  let updatedHands = state.hands;
  let updatedSeventhCard = state.seventhCard;

  if (state.trumpMode === 'seventh-card' && state.seventhCard && !state.seventhCard.isRevealed) {
    const owner = state.seventhCard.owner;
    const cardId = state.seventhCard.cardId;
    updatedHands = {
      ...state.hands,
      [owner]: sortHand([...state.hands[owner], cardId]),
    };
    updatedSeventhCard = { ...state.seventhCard, isRevealed: true };
  }

  const detectedPair = detectKingQueenPair(
    updatedHands,
    state.trumpSuit,
    true,
    state.highestBid,
    state.highestBidder,
    state.currentTrickNumber
  );

  return {
    ...state,
    hands: updatedHands,
    seventhCard: updatedSeventhCard,
    isTrumpRevealed: true,
    trumpRevealedBy: revealedBy,
    trumpRevealedAtTrick: state.currentTrickNumber,
    pairDeclaration: detectedPair || state.pairDeclaration,
    adjustedTarget: detectedPair ? detectedPair.adjustedTarget : state.adjustedTarget,
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
  };
};

/**
 * Handles playing a card in a trick
 */
export const applyCardPlay = (
  state: GameState,
  playerIndex: PlayerPosition,
  cardId: string
): { success: boolean; state: GameState; trickCompleted?: CompletedTrick; error?: string } => {
  if (state.phase !== 'TRICK_PLAY') {
    return { success: false, state, error: 'Not currently in trick play phase' };
  }

  if (state.currentTurn !== playerIndex) {
    return { success: false, state, error: 'Not your turn to play' };
  }

  if (state.currentTrickCards.length >= 4) {
    return { success: false, state, error: 'Trick is complete and being collected' };
  }

  const hand = state.hands[playerIndex];
  const leadCardId = state.currentTrickCards.length > 0 ? state.currentTrickCards[0].cardId : null;

  const validation = isLegalCardPlay(
    cardId,
    hand,
    leadCardId,
    state.trumpSuit,
    state.isTrumpRevealed,
    state.trumpMode
  );

  if (!validation.legal) {
    return { success: false, state, error: validation.reason };
  }

  // Cutting with a trump while it is still concealed reveals it to the table.
  const playedSuit = CARD_MANIFEST[cardId]?.suit;
  const leadSuitForCut = leadCardId ? CARD_MANIFEST[leadCardId]?.suit : null;
  if (
    !state.isTrumpRevealed &&
    state.trumpMode !== 'no-trump' &&
    state.trumpSuit &&
    leadSuitForCut &&
    playedSuit === state.trumpSuit &&
    leadSuitForCut !== state.trumpSuit
  ) {
    state = revealTrumpState(state, playerIndex);
  }

  // Remove card from player hand
  const hand2 = state.hands[playerIndex];
  const newHand = hand2.filter((id) => id !== cardId);
  const newHands = { ...state.hands, [playerIndex]: newHand };

  const playedCard: PlayedCard = { cardId, playerIndex };
  const newTrickCards = [...state.currentTrickCards, playedCard];

  const playActionId = `${state.roundNumber}_${state.currentTrickNumber}_${playerIndex}_${cardId}`;

  // Case 1: Trick is still in progress (fewer than 4 cards)
  if (newTrickCards.length < 4) {
    const nextTurn = ((playerIndex + 1) % 4) as PlayerPosition;
    return {
      success: true,
      state: {
        ...state,
        hands: newHands,
        currentTrickCards: newTrickCards,
        currentTurn: nextTurn,
        version: state.version + 1,
        lastActionTimestamp: Date.now(),
        lastPlayActionId: playActionId,
      },
    };
  }

  // Case 2: Trick is completed (all 4 cards played)
  const completedTrick = evaluateTrickWinner(
    newTrickCards,
    state.currentTrickLead,
    state.trumpSuit,
    state.isTrumpRevealed,
    state.currentTrickNumber,
    state.rules.lastTrickBonus,
    state.trumpMode
  );

  // Return state keeping all 4 cards displayed for the 1-second pause and collection animation
  return {
    success: true,
    trickCompleted: completedTrick,
    state: {
      ...state,
      hands: newHands,
      currentTrickCards: newTrickCards,
      lastCompletedTrick: completedTrick,
      version: state.version + 1,
      lastActionTimestamp: Date.now(),
      lastPlayActionId: playActionId,
    },
  };
};

/**
 * Completes the transition after the 1-second display pause and collection animation.
 * Updates completedTricks, playerPoints, matchScore, and advances to the next trick or ROUND_ENDED.
 */
export const completeTrickTransition = (
  state: GameState,
  completedTrick: CompletedTrick
): GameState => {
  const newCompletedTricks = [...state.completedTricks, completedTrick];

  const updatedPlayerPoints = {
    ...state.playerPoints,
    [completedTrick.winner]: (state.playerPoints?.[completedTrick.winner] || 0) + completedTrick.points,
  };

  // If this was the 8th trick, the round has finished!
  if (state.currentTrickNumber === 8) {
    const roundResult = evaluateRoundScore(
      newCompletedTricks,
      state.highestBidder!,
      state.highestBid,
      state.rules,
      state.matchScore,
      state.pairDeclaration,
      state.dealMultiplier || 1
    );

    const roundSummary: RoundSummary = {
      roundNumber: state.roundNumber,
      bidder: state.highestBidder!,
      biddingTeam: (state.highestBidder === 0 || state.highestBidder === 2) ? 0 : 1,
      contractBid: state.highestBid,
      adjustedTarget: roundResult.adjustedTarget,
      dealMultiplier: state.dealMultiplier || 1,
      doubleStatus: state.doubleStatus || 'NONE',
      trumpSuit: state.trumpSuit || 'SPADES',
      trumpRevealedBy: state.trumpRevealedBy || undefined,
      trumpRevealedAtTrick: state.trumpRevealedAtTrick || undefined,
      team0CardPoints: roundResult.team0CardPoints,
      team1CardPoints: roundResult.team1CardPoints,
      team0WonLastTrick: roundResult.team0WonLastTrick,
      team1WonLastTrick: roundResult.team1WonLastTrick,
      biddingTeamWon: roundResult.biddingTeamWon,
      pairDeclared: state.pairDeclaration || undefined,
      gamePointsDelta: roundResult.gamePointsDelta,
      matchScore: roundResult.newMatchScore,
    };

    const nextPhase: GamePhase = roundResult.isMatchOver ? 'MATCH_ENDED' : 'ROUND_ENDED';

    return {
      ...state,
      phase: nextPhase,
      currentTrickCards: [],
      completedTricks: newCompletedTricks,
      playerPoints: updatedPlayerPoints,
      matchScore: roundResult.newMatchScore,
      roundHistory: [...state.roundHistory, roundSummary],
      winnerTeam: roundResult.winnerTeam,
      version: state.version + 1,
      lastActionTimestamp: Date.now(),
    };
  }

  // Next trick begins: winner of this trick leads next trick
  const nextTrickLead = completedTrick.winner;

  return {
    ...state,
    currentTrickNumber: state.currentTrickNumber + 1,
    currentTrickLead: nextTrickLead,
    currentTurn: nextTrickLead,
    currentTrickCards: [],
    completedTricks: newCompletedTricks,
    playerPoints: updatedPlayerPoints,
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
  };
};

/**
 * Handles declaring Pair / Royals (King + Queen of trump)
 */
export const applyPairDeclaration = (
  state: GameState,
  playerIndex: PlayerPosition
): { success: boolean; state: GameState; error?: string } => {
  // In No Trump mode, there is no trump suit and Pair cannot be declared
  if (state.trumpMode === 'no-trump') {
    return { success: false, state, error: 'Pair / Royals cannot be declared in No Trump mode' };
  }

  const hand = state.hands[playerIndex];
  const check = canDeclarePair(
    hand,
    playerIndex,
    state.trumpSuit,
    state.isTrumpRevealed,
    state.completedTricks,
    state.pairDeclaration
  );

  if (!check.canDeclare) {
    return { success: false, state, error: check.reason };
  }

  if (state.highestBid < PAIR_MIN_CONTRACT_BID) {
    return { success: false, state, error: `King-Queen Pair only applies when the contract bid is ${PAIR_MIN_CONTRACT_BID} or higher` };
  }

  const playerTeam: Team = (playerIndex === 0 || playerIndex === 2) ? 0 : 1;
  const biddingTeam: Team = (state.highestBidder === 0 || state.highestBidder === 2) ? 0 : 1;
  const isBiddingTeam = playerTeam === biddingTeam;
  const adjustment = isBiddingTeam ? -state.rules.pairRoyalAdjustment : state.rules.pairRoyalAdjustment;

  const adjustedTarget = isBiddingTeam 
    ? Math.max(16, state.highestBid - state.rules.pairRoyalAdjustment) 
    : Math.min(29, state.highestBid + state.rules.pairRoyalAdjustment);

  return {
    success: true,
    state: {
      ...state,
      pairDeclaration: {
        playerIndex,
        team: playerTeam,
        suit: state.trumpSuit!,
        originalBid: state.highestBid,
        adjustedTarget,
        adjustment,
        declaredAtTrick: state.currentTrickNumber,
        kingCardId: `K_${state.trumpSuit}`,
        queenCardId: `Q_${state.trumpSuit}`,
        announced: true,
      },
      adjustedTarget,
      version: state.version + 1,
      lastActionTimestamp: Date.now(),
    },
  };
};

/**
 * Sanitizes GameState for safe public transmission to a specific client.
 * Strictly conceals opponent hands, concealed trump, and unrevealed 7th card!
 */
export const getPublicGameState = (
  state: GameState,
  viewingPlayerPosition: PlayerPosition | null
): PublicGameState => {
  const otherHandCounts: Record<PlayerPosition, number> = {
    0: state.hands[0]?.length || 0,
    1: state.hands[1]?.length || 0,
    2: state.hands[2]?.length || 0,
    3: state.hands[3]?.length || 0,
  };

  const myHand = viewingPlayerPosition !== null ? state.hands[viewingPlayerPosition] || [] : [];

  const isBidder = viewingPlayerPosition !== null && state.highestBidder === viewingPlayerPosition;
  const canSeeTrump = state.isTrumpRevealed || isBidder;

  const revealedTrumpSuit = canSeeTrump ? state.trumpSuit : null;
  const isTrumpConcealed = !state.isTrumpRevealed && (state.trumpSuit !== null || state.trumpMode === 'seventh-card');

  // 7th card trump visibility:
  let revealedSeventhCard: string | null = null;
  const hasSeventhCardReserved = Boolean(state.seventhCard && !state.seventhCard.isRevealed);

  if (state.seventhCard) {
    if (state.seventhCard.isRevealed || viewingPlayerPosition === state.seventhCard.owner) {
      revealedSeventhCard = state.seventhCard.cardId;
    }
  }

  const { hands, trumpSuit, seventhCard, _pendingSecondDeal, ...publicBase } = state;

  return {
    ...publicBase,
    playerPoints: state.playerPoints || calculatePlayerPoints(state.completedTricks),
    myPosition: viewingPlayerPosition,
    myHand,
    otherHandCounts,
    revealedTrumpSuit,
    isTrumpConcealed,
    revealedSeventhCard,
    hasSeventhCardReserved,
  };
};
