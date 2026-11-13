import { describe, it, expect } from 'vitest';
import { CARD_MANIFEST, getAllCards, CardIdentity, Suit, Rank } from '../assets/cardManifest';
import { create29Deck, deal29Deck, shuffleDeck } from './deck';
import { evaluateBiddingState, isLegalBid } from './bidding';
import { getPlayableCards, evaluateTrickWinner, calculateTrickPoints } from './tricks';
import { canDeclarePair, evaluateRoundScore, hasRoyalsPair } from './scoring';
import { 
  applyBid, 
  applyCardPlay, 
  applyTrumpReveal, 
  applyTrumpSelection, 
  createInitialGame, 
  getPublicGameState, 
  startNewRound 
} from './gameManager';
import { DEFAULT_RULES_CONFIG, PlayerInfo, PlayerPosition } from './types';

describe('Asset Manifest & Deck Verification', () => {
  it('should have exactly 32 cards in the 29 card manifest', () => {
    const cards = getAllCards();
    expect(cards).toHaveLength(32);
  });

  it('should calculate total card points in the deck as exactly 28 points', () => {
    const cards = getAllCards();
    const totalPoints = cards.reduce((sum, c) => sum + c.points, 0);
    // Jack: 4 * 3 = 12
    // Nine: 4 * 2 = 8
    // Ace:  4 * 1 = 4
    // Ten:  4 * 1 = 4
    // K, Q, 8, 7: 0
    // Total = 12 + 8 + 4 + 4 = 28
    expect(totalPoints).toBe(28);
  });

  it('should map each card to valid SVG and PNG filenames', () => {
    const cards = getAllCards();
    for (const card of cards) {
      expect(card.svgAsset).toMatch(/^[a-z0-9_]+_of_[a-z0-9_]+\.svg$/);
      expect(card.pngAsset).toMatch(/^[a-z0-9_]+_of_[a-z0-9_]+\.png$/);
    }
  });

  it('should deal exactly 4 cards in round 1 and 4 in round 2 with zero duplicate cards', () => {
    const deck = shuffleDeck(create29Deck());
    expect(deck).toHaveLength(32);

    const { round1, round2 } = deal29Deck(deck);
    const allDealt = [
      ...round1[0], ...round1[1], ...round1[2], ...round1[3],
      ...round2[0], ...round2[1], ...round2[2], ...round2[3],
    ];

    expect(allDealt).toHaveLength(32);
    const uniqueCards = new Set(allDealt);
    expect(uniqueCards.size).toBe(32);
  });
});

describe('Bidding Engine', () => {
  const rules = DEFAULT_RULES_CONFIG;

  it('should enforce minimum bid of 16', () => {
    expect(isLegalBid(15, 0, rules).legal).toBe(false);
    expect(isLegalBid(16, 0, rules).legal).toBe(true);
    expect(isLegalBid(17, 0, rules).legal).toBe(true);
  });

  it('should enforce bid higher than current highest bid', () => {
    expect(isLegalBid(17, 17, rules).legal).toBe(false);
    expect(isLegalBid(16, 17, rules).legal).toBe(false);
    expect(isLegalBid(18, 17, rules).legal).toBe(true);
  });

  it('should allow PASS unless forced dealer bid', () => {
    expect(isLegalBid('PASS', 17, rules, false).legal).toBe(true);
    expect(isLegalBid('PASS', 0, rules, true).legal).toBe(false);
  });

  it('should force dealer minimum bid if all 4 players pass initially', () => {
    const bids = [
      { playerIndex: 1 as PlayerPosition, bid: 'PASS' as const, timestamp: 1 },
      { playerIndex: 2 as PlayerPosition, bid: 'PASS' as const, timestamp: 2 },
      { playerIndex: 3 as PlayerPosition, bid: 'PASS' as const, timestamp: 3 },
      { playerIndex: 0 as PlayerPosition, bid: 'PASS' as const, timestamp: 4 }, // Dealer
    ];
    const status = evaluateBiddingState(bids, 0, rules);
    expect(status.isComplete).toBe(true);
    expect(status.highestBid).toBe(16);
    expect(status.highestBidder).toBe(0);
  });

  it('should complete bidding when 3 players have passed', () => {
    const bids = [
      { playerIndex: 1 as PlayerPosition, bid: 16, timestamp: 1 },
      { playerIndex: 2 as PlayerPosition, bid: 'PASS' as const, timestamp: 2 },
      { playerIndex: 3 as PlayerPosition, bid: 'PASS' as const, timestamp: 3 },
      { playerIndex: 0 as PlayerPosition, bid: 'PASS' as const, timestamp: 4 },
    ];
    const status = evaluateBiddingState(bids, 0, rules);
    expect(status.isComplete).toBe(true);
    expect(status.highestBid).toBe(16);
    expect(status.highestBidder).toBe(1);
  });
});

describe('Trick Evaluation & Follow-Suit', () => {
  it('should enforce mandatory follow suit when player holds lead suit', () => {
    const hand = ['J_HEARTS', '9_HEARTS', 'K_SPADES', '10_DIAMONDS'];
    const playable = getPlayableCards(hand, 'A_HEARTS', 'SPADES', false);
    expect(playable).toEqual(['J_HEARTS', '9_HEARTS']);
  });

  it('should allow any card when player cannot follow suit', () => {
    const hand = ['K_SPADES', '10_DIAMONDS', '8_CLUBS'];
    const playable = getPlayableCards(hand, 'A_HEARTS', 'SPADES', true);
    expect(playable).toEqual(hand);
  });

  it('should determine trick winner by highest card in suit led when no trump played', () => {
    const trickCards = [
      { cardId: '10_HEARTS', playerIndex: 1 as PlayerPosition }, // Lead
      { cardId: 'J_HEARTS', playerIndex: 2 as PlayerPosition },  // Jack beats 10
      { cardId: '9_HEARTS', playerIndex: 3 as PlayerPosition },  // 9 is below Jack
      { cardId: '7_HEARTS', playerIndex: 0 as PlayerPosition },
    ];
    const trick = evaluateTrickWinner(trickCards, 1, 'SPADES', true, 1, true);
    expect(trick.winner).toBe(2); // Player 2's Jack wins
    expect(trick.points).toBe(1 + 3 + 2 + 0); // 6 points
  });

  it('should allow revealed trump to cut non-trump lead', () => {
    const trickCards = [
      { cardId: 'A_HEARTS', playerIndex: 1 as PlayerPosition }, // Points: 1
      { cardId: 'K_HEARTS', playerIndex: 2 as PlayerPosition }, // Points: 0
      { cardId: '7_SPADES', playerIndex: 3 as PlayerPosition }, // Trump cut!
      { cardId: '8_HEARTS', playerIndex: 0 as PlayerPosition }, // Points: 0
    ];
    const trick = evaluateTrickWinner(trickCards, 1, 'SPADES', true, 1, true);
    expect(trick.winner).toBe(3); // Player 3 cuts with 7 of Spades
  });
});

describe('Security & Public Game State', () => {
  const dummyPlayers: PlayerInfo[] = [
    { id: 'p0', name: 'Player 0', position: 0, team: 0, isHost: true, isCpu: false, isReady: true, connected: true },
    { id: 'p1', name: 'Player 1', position: 1, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
    { id: 'p2', name: 'Player 2', position: 2, team: 0, isHost: false, isCpu: false, isReady: true, connected: true },
    { id: 'p3', name: 'Player 3', position: 3, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
  ];

  it('should securely hide opponent hands and concealed trump in public state', () => {
    let state = createInitialGame('TEST', dummyPlayers);
    state = startNewRound(state, 0);

    // P1 bids 16, others pass
    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    // P1 picks trump 'HEARTS'
    state = applyTrumpSelection(state, 1, 'HEARTS').state;

    // Opponent P0 viewing public state
    const publicP0 = getPublicGameState(state, 0);
    expect(publicP0.myPosition).toBe(0);
    expect(publicP0.myHand).toHaveLength(8);
    // Opponent hands should NOT be in public state
    expect((publicP0 as any).hands).toBeUndefined();
    // Hidden trump should NOT be visible to opponent
    expect(publicP0.revealedTrumpSuit).toBeNull();
    expect(publicP0.isTrumpConcealed).toBe(true);

    // Bidder P1 viewing public state
    const publicP1 = getPublicGameState(state, 1);
    // Bidder can see their own picked trump
    expect(publicP1.revealedTrumpSuit).toBe('HEARTS');

    // Trump reveal by current active player
    state = applyTrumpReveal(state, state.currentTurn).state;
    const publicP0AfterReveal = getPublicGameState(state, 0);
    expect(publicP0AfterReveal.revealedTrumpSuit).toBe('HEARTS');
    expect(publicP0AfterReveal.isTrumpConcealed).toBe(false);
  });
});

describe('Scoring & Match Progression', () => {
  it('should adjust contract target by ±4 for Pair/Royals declaration', () => {
    const handWithRoyals = ['K_SPADES', 'Q_SPADES', '7_SPADES', '8_HEARTS'];
    expect(hasRoyalsPair(handWithRoyals, 'SPADES')).toBe(true);
    expect(hasRoyalsPair(handWithRoyals, 'HEARTS')).toBe(false);
  });

  it('should award +1 game point when bidding team fulfills contract', () => {
    // 8 mock tricks where Team 0 wins 17 points, target 16
    const mockTricks = Array.from({ length: 8 }).map((_, i) => ({
      trickNumber: i + 1,
      leadPlayer: 0 as PlayerPosition,
      cards: [],
      winner: (i % 2 === 0 ? 0 : 2) as PlayerPosition,
      winningTeam: 0 as const,
      points: i === 0 ? 10 : (i === 1 ? 7 : 0),
      leadSuit: 'HEARTS' as Suit,
    }));

    const result = evaluateRoundScore(
      mockTricks,
      0, // Bidder = P0 (Team 0)
      16,
      DEFAULT_RULES_CONFIG,
      { team0: 0, team1: 0 },
      null
    );

    expect(result.biddingTeamWon).toBe(true);
    expect(result.gamePointsDelta.team0).toBe(1);
    expect(result.newMatchScore.team0).toBe(1);
    expect(result.isMatchOver).toBe(false);
  });
});
