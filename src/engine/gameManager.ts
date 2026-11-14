import { CARD_MANIFEST, Suit } from '../assets/cardManifest';
import { evaluateBiddingState, isLegalBid } from './bidding';
import { create29Deck, deal29Deck, shuffleDeck, sortHand } from './deck';
import { canDeclarePair, evaluateRoundScore } from './scoring';
import { evaluateTrickWinner, isLegalCardPlay } from './tricks';
import { 
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
  Team 
} from './types';

/**
 * Creates a new GameState initialized in WAITING_LOBBY or ready to start
 */
export const createInitialGame = (
  roomCode: string,
  players: PlayerInfo[],
  rules: GameRulesConfig = DEFAULT_RULES_CONFIG
): GameState => {
  return {
    id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    roomCode,
    phase: 'WAITING_LOBBY',
    rules,
    players,
    dealerIndex: 0,
    currentTurn: 1, // Traditional: player left of dealer starts bidding
    bids: [],
    highestBid: 0,
    highestBidder: null,
    consecutivePasses: 0,
    trumpSuit: null,
    isTrumpRevealed: false,
    trumpRevealedBy: null,
    trumpRevealedAtTrick: null,
    hands: { 0: [], 1: [], 2: [], 3: [] },
    currentTrickNumber: 1,
    currentTrickLead: 1,
    currentTrickCards: [],
    completedTricks: [],
    pairDeclaration: null,
    roundNumber: 1,
    matchScore: { team0: 0, team1: 0 },
    roundHistory: [],
    winnerTeam: null,
    version: 1,
    lastActionTimestamp: Date.now(),
  };
};

/**
 * Starts a new deal (round): shuffles 32-card deck, deals 4 cards to each player, initiates bidding
 */
export const startNewRound = (state: GameState, nextDealer?: PlayerPosition): GameState => {
  const dealerIndex = nextDealer !== undefined ? nextDealer : state.dealerIndex;
  const firstBidder = ((dealerIndex + 1) % 4) as PlayerPosition;

  const shuffled = shuffleDeck(create29Deck());
  const { round1, round2 } = deal29Deck(shuffled);

  // Store round2 cards temporarily on a private deal stash (or in state)
  // For round 1, players receive only their first 4 cards
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
    bids: [],
    highestBid: 0,
    highestBidder: null,
    consecutivePasses: 0,
    trumpSuit: null,
    isTrumpRevealed: false,
    trumpRevealedBy: null,
    trumpRevealedAtTrick: null,
    hands,
    currentTrickNumber: 1,
    currentTrickLead: firstBidder,
    currentTrickCards: [],
    completedTricks: [],
    pairDeclaration: null,
    version: state.version + 1,
    lastActionTimestamp: Date.now(),
    // Keep secondary 4 cards accessible for deal phase 2
    _pendingSecondDeal: round2,
  } as GameState & { _pendingSecondDeal: Record<PlayerPosition, string[]> };
};

/**
 * Handles a bid or pass action
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

  const isForcedDealer = 
    state.bids.length === 3 && 
    state.bids.every((b) => b.bid === 'PASS') && 
    playerIndex === state.dealerIndex && 
    state.rules.forcedDealerBid;

  const validation = isLegalBid(bid, state.highestBid, state.rules, isForcedDealer);
  if (!validation.legal) {
    return { success: false, state, error: validation.reason };
  }

  const newBids = [
    ...state.bids,
    { playerIndex, bid, timestamp: Date.now() },
  ];

  const biddingStatus = evaluateBiddingState(newBids, state.dealerIndex, state.rules);

  if (biddingStatus.isComplete && biddingStatus.highestBidder !== null) {
    // Transition to TRUMP_SELECTION with highest bidder having turn
    return {
      success: true,
      state: {
        ...state,
        phase: 'TRUMP_SELECTION',
        bids: newBids,
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
      highestBid: biddingStatus.highestBid,
      highestBidder: biddingStatus.highestBidder,
      currentTurn: biddingStatus.nextTurn,
      version: state.version + 1,
      lastActionTimestamp: Date.now(),
    },
  };
};

/**
 * Handles bidder's trump selection, deals second 4 cards, initiates trick play
 */
export const applyTrumpSelection = (
  state: GameState & { _pendingSecondDeal?: Record<PlayerPosition, string[]> },
  playerIndex: PlayerPosition,
  suit: Suit
): { success: boolean; state: GameState; error?: string } => {
  if (state.phase !== 'TRUMP_SELECTION') {
    return { success: false, state, error: 'Not currently in trump selection phase' };
  }

  if (state.highestBidder !== playerIndex) {
    return { success: false, state, error: 'Only highest bidder can select trump' };
  }

  // Deal second 4 cards to each player
  const pending = state._pendingSecondDeal || { 0: [], 1: [], 2: [], 3: [] };
  const fullHands: Record<PlayerPosition, string[]> = {
    0: sortHand([...state.hands[0], ...(pending[0] || [])]),
    1: sortHand([...state.hands[1], ...(pending[1] || [])]),
    2: sortHand([...state.hands[2], ...(pending[2] || [])]),
    3: sortHand([...state.hands[3], ...(pending[3] || [])]),
  };

  // Traditional 29 rule: Player to the left of dealer leads Trick 1
  const firstTrickLead = ((state.dealerIndex + 1) % 4) as PlayerPosition;

  const newState = {
    ...state,
    phase: 'TRICK_PLAY' as GamePhase,
    trumpSuit: suit,
    isTrumpRevealed: false,
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
 * Handles requesting/revealing the trump suit
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

  return {
    success: true,
    state: {
      ...state,
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
    state.isTrumpRevealed
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
    state.rules.lastTrickBonus
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
      trumpSuit: state.trumpSuit!,
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
      success: true,
      trickCompleted: completedTrick,
      state: {
        ...state,
        phase: nextPhase,
        hands: newHands,
        currentTrickCards: newTrickCards,
        completedTricks: newCompletedTricks,
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

  return {
    success: true,
    trickCompleted: completedTrick,
    state: {
      ...state,
      hands: newHands,
      currentTrickNumber: state.currentTrickNumber + 1,
      currentTrickLead: nextTrickLead,
      currentTurn: nextTrickLead,
      currentTrickCards: [], // Clear for next trick
      completedTricks: newCompletedTricks,
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
 * Strictly conceals opponent hands and concealed trump!
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

  // Trump visibility:
  // Visible if revealed, or if viewing player is the highest bidder who picked it
  const isBidder = viewingPlayerPosition !== null && state.highestBidder === viewingPlayerPosition;
  const canSeeTrump = state.isTrumpRevealed || isBidder;

  const revealedTrumpSuit = canSeeTrump ? state.trumpSuit : null;
  const isTrumpConcealed = !state.isTrumpRevealed && state.trumpSuit !== null;

  const { hands, trumpSuit, ...publicBase } = state;

  return {
    ...publicBase,
    myPosition: viewingPlayerPosition,
    myHand,
    otherHandCounts,
    revealedTrumpSuit,
    isTrumpConcealed,
  };
};

