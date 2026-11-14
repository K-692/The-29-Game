import { CARD_MANIFEST, Suit } from '../assets/cardManifest';
import { evaluateBiddingState, isLegalBid } from './bidding';
import { getBiddingOrder, getLeftOfDealer, hasPointCard } from './biddingOrder';
import { create29Deck, deal29Deck, shuffleDeck, sortHand } from './deck';
import { canDeclarePair, evaluateRoundScore, calculatePlayerPoints } from './scoring';
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
    pairDeclaration: null,
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

  return {
    ...state,
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
    pairDeclaration: null,
    playerPoints: { 0: 0, 1: 0, 2: 0, 3: 0 },
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
    // Keep secondary 4 cards accessible for deal phase 2
    _pendingSecondDeal: round2,
  } as GameState & { _pendingSecondDeal: Record<PlayerPosition, string[]> };
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

  if (biddingStatus.isComplete && biddingStatus.highestBidder !== null) {
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
 * Deals second 4 cards to each player and initiates trick play.
 */
export const applyTrumpSelection = (
  state: GameState & { _pendingSecondDeal?: Record<PlayerPosition, string[]> },
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
  const firstTrickLead = getLeftOfDealer(state.dealerIndex);

  let trumpMode: TrumpMode = 'suit';
  let trumpSuit: Suit | null = null;
  let seventhCard: SeventhCardInfo | null = null;
  const fullHands: Record<PlayerPosition, string[]> = { 0: [], 1: [], 2: [], 3: [] };

  if (choice === 'NO_TRUMP') {
    trumpMode = 'no-trump';
    trumpSuit = null;
    seventhCard = null;
    for (let p = 0; p < 4; p++) {
      const pos = p as PlayerPosition;
      fullHands[pos] = sortHand([...state.hands[pos], ...(pending[pos] || [])]);
    }
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

    // Winning bidder gets the other 3 cards added to their 4 cards (total 7 cards in hand)
    const otherThree = bidderPending.filter((id) => id !== seventhCardId);
    fullHands[playerIndex] = sortHand([...state.hands[playerIndex], ...otherThree]);

    // Other 3 players receive all 4 cards
    for (let p = 0; p < 4; p++) {
      const pos = p as PlayerPosition;
      if (pos !== playerIndex) {
        fullHands[pos] = sortHand([...state.hands[pos], ...(pending[pos] || [])]);
      }
    }
  } else {
    // Four suits: 'HEARTS' | 'SPADES' | 'CLUBS' | 'DIAMONDS'
    trumpMode = 'suit';
    trumpSuit = choice as Suit;
    seventhCard = null;
    for (let p = 0; p < 4; p++) {
      const pos = p as PlayerPosition;
      fullHands[pos] = sortHand([...state.hands[pos], ...(pending[pos] || [])]);
    }
  }

  const newState = {
    ...state,
    phase: 'TRICK_PLAY' as GamePhase,
    trumpMode,
    trumpSuit,
    isTrumpRevealed: false,
    seventhCard,
    hands: fullHands,
    currentTrickNumber: 1,
    currentTrickLead: firstTrickLead,
    currentTurn: firstTrickLead,
    currentTrickCards: [],
    completedTricks: [],
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
  };

  delete (newState as any)._pendingSecondDeal;

  return {
    success: true,
    state: newState,
  };
};

/**
 * Handles requesting/revealing the trump suit during trick play.
 * For 7th Card mode, reveals the card and returns it to the winning bidder's hand.
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

  let updatedHands = state.hands;
  let updatedSeventhCard = state.seventhCard;

  // If 7th Card mode, return the 7th card to the winning bidder's hand!
  if (state.trumpMode === 'seventh-card' && state.seventhCard && !state.seventhCard.isRevealed) {
    const owner = state.seventhCard.owner;
    const cardId = state.seventhCard.cardId;
    updatedHands = {
      ...state.hands,
      [owner]: sortHand([...state.hands[owner], cardId]),
    };
    updatedSeventhCard = {
      ...state.seventhCard,
      isRevealed: true,
    };
  }

  return {
    success: true,
    state: {
      ...state,
      hands: updatedHands,
      seventhCard: updatedSeventhCard,
      isTrumpRevealed: true,
      trumpRevealedBy: playerIndex,
      trumpRevealedAtTrick: state.currentTrickNumber,
      version: state.version + 1,
      lastActionTimestamp: Date.now(),
    },
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

  // Remove card from player hand
  const newHand = hand.filter((id) => id !== cardId);
  const newHands = { ...state.hands, [playerIndex]: newHand };

  const playedCard: PlayedCard = { cardId, playerIndex };
  const newTrickCards = [...state.currentTrickCards, playedCard];

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

  const newCompletedTricks = [...state.completedTricks, completedTrick];

  // If this was the 8th trick, the round has finished!
  if (state.currentTrickNumber === 8) {
    const roundResult = evaluateRoundScore(
      newCompletedTricks,
      state.highestBidder!,
      state.highestBid,
      state.rules,
      state.matchScore,
      state.pairDeclaration
    );

    const roundSummary: RoundSummary = {
      roundNumber: state.roundNumber,
      bidder: state.highestBidder!,
      biddingTeam: (state.highestBidder === 0 || state.highestBidder === 2) ? 0 : 1,
      contractBid: state.highestBid,
      adjustedTarget: roundResult.adjustedTarget,
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

    const updatedPlayerPoints = {
      ...state.playerPoints,
      [completedTrick.winner]: (state.playerPoints?.[completedTrick.winner] || 0) + completedTrick.points,
    };

    return {
      success: true,
      trickCompleted: completedTrick,
      state: {
        ...state,
        phase: nextPhase,
        hands: newHands,
        currentTrickCards: newTrickCards,
        completedTricks: newCompletedTricks,
        playerPoints: updatedPlayerPoints,
        matchScore: roundResult.newMatchScore,
        roundHistory: [...state.roundHistory, roundSummary],
        winnerTeam: roundResult.winnerTeam,
        version: state.version + 1,
        lastActionTimestamp: Date.now(),
      },
    };
  }

  // Next trick begins: winner of this trick leads next trick
  const nextTrickLead = completedTrick.winner;
  const updatedPlayerPoints = {
    ...state.playerPoints,
    [completedTrick.winner]: (state.playerPoints?.[completedTrick.winner] || 0) + completedTrick.points,
  };

  return {
    success: true,
    trickCompleted: completedTrick,
    state: {
      ...state,
      hands: newHands,
      currentTrickNumber: state.currentTrickNumber + 1,
      currentTrickLead: nextTrickLead,
      currentTurn: nextTrickLead,
      currentTrickCards: [],
      completedTricks: newCompletedTricks,
      playerPoints: updatedPlayerPoints,
      version: state.version + 1,
      lastActionTimestamp: Date.now(),
    },
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

  const playerTeam: Team = (playerIndex === 0 || playerIndex === 2) ? 0 : 1;
  const biddingTeam: Team = (state.highestBidder === 0 || state.highestBidder === 2) ? 0 : 1;
  const isBiddingTeam = playerTeam === biddingTeam;
  const adjustment = isBiddingTeam ? -state.rules.pairRoyalAdjustment : state.rules.pairRoyalAdjustment;

  return {
    success: true,
    state: {
      ...state,
      pairDeclaration: {
        playerIndex,
        team: playerTeam,
        suit: state.trumpSuit!,
        adjustment,
        declaredAtTrick: state.currentTrickNumber,
      },
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

  const { hands, trumpSuit, seventhCard, ...publicBase } = state;

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
