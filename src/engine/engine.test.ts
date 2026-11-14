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
import { getLeftOfDealer, getBiddingOrder, hasPointCard, countPointCards, sumPointValues } from './biddingOrder';
import { AUTHENTIC_BOT_NAMES, getRandomBotNames } from './botNames';

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

describe('Dealer Selection, Seating & Bidding Order Rules', () => {
  it('should calculate first bidder as immediate left of dealer (clockwise)', () => {
    expect(getLeftOfDealer(0)).toBe(1);
    expect(getLeftOfDealer(1)).toBe(2);
    expect(getLeftOfDealer(2)).toBe(3);
    expect(getLeftOfDealer(3)).toBe(0);
  });

  it('should calculate exact clockwise single-round bidding order for all 4 dealer positions', () => {
    expect(getBiddingOrder(0)).toEqual([1, 2, 3, 0]);
    expect(getBiddingOrder(1)).toEqual([2, 3, 0, 1]);
    expect(getBiddingOrder(2)).toEqual([3, 0, 1, 2]);
    expect(getBiddingOrder(3)).toEqual([0, 1, 2, 3]);
  });

  it('should accurately detect point-valued cards (J, 9, A, 10)', () => {
    expect(hasPointCard(['K_SPADES', 'Q_SPADES', '8_HEARTS', '7_CLUBS'])).toBe(false);
    expect(countPointCards(['K_SPADES', 'Q_SPADES', '8_HEARTS', '7_CLUBS'])).toBe(0);
    expect(sumPointValues(['K_SPADES', 'Q_SPADES', '8_HEARTS', '7_CLUBS'])).toBe(0);

    expect(hasPointCard(['J_SPADES', 'K_HEARTS', '8_DIAMONDS', '7_CLUBS'])).toBe(true);
    expect(countPointCards(['J_SPADES', 'K_HEARTS', '8_DIAMONDS', '7_CLUBS'])).toBe(1);
    expect(sumPointValues(['J_SPADES', 'K_HEARTS', '8_DIAMONDS', '7_CLUBS'])).toBe(3);

    expect(countPointCards(['J_HEARTS', '9_SPADES', 'A_CLUBS', '10_DIAMONDS'])).toBe(4);
    expect(sumPointValues(['J_HEARTS', '9_SPADES', 'A_CLUBS', '10_DIAMONDS'])).toBe(3 + 2 + 1 + 1);
  });

  it('should guarantee first bidder holds at least 1 point card upon initial deal', () => {
    const dummyPlayers: PlayerInfo[] = [
      { id: 'p0', name: 'Player 0', position: 0, team: 0, isHost: true, isCpu: false, isReady: true, connected: true },
      { id: 'p1', name: 'Player 1', position: 1, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p2', name: 'Player 2', position: 2, team: 0, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p3', name: 'Player 3', position: 3, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
    ];

    for (let trial = 0; trial < 10; trial++) {
      let state = createInitialGame(`TRIAL_${trial}`, dummyPlayers);
      state = startNewRound(state);
      const firstBidder = state.biddingOrder[0];
      const firstBidderCards = state.hands[firstBidder];
      expect(firstBidderCards).toHaveLength(4);
      expect(hasPointCard(firstBidderCards)).toBe(true);
      expect(countPointCards(firstBidderCards)).toBeGreaterThanOrEqual(1);
      expect(sumPointValues(firstBidderCards)).toBeGreaterThanOrEqual(1);
    }
  });

  it('should rotate dealer clockwise on startNewRound', () => {
    const dummyPlayers: PlayerInfo[] = [
      { id: 'p0', name: 'Player 0', position: 0, team: 0, isHost: true, isCpu: false, isReady: true, connected: true },
      { id: 'p1', name: 'Player 1', position: 1, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p2', name: 'Player 2', position: 2, team: 0, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p3', name: 'Player 3', position: 3, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
    ];

    let state = createInitialGame('ROTATION_TEST', dummyPlayers);
    state = startNewRound(state);
    const initialDealer = state.dealerIndex;

    const round2 = startNewRound(state);
    expect(round2.dealerIndex).toBe(((initialDealer + 1) % 4) as PlayerPosition);
    expect(round2.biddingOrder).toEqual(getBiddingOrder(round2.dealerIndex));

    const round3 = startNewRound(round2);
    expect(round3.dealerIndex).toBe(((initialDealer + 2) % 4) as PlayerPosition);
  });
});

describe('Authentic Bot Names Pool', () => {
  it('should have a rich pool of authentic Indian names with no generic Bot labels', () => {
    expect(AUTHENTIC_BOT_NAMES.length).toBeGreaterThanOrEqual(30);
    for (const name of AUTHENTIC_BOT_NAMES) {
      expect(name).not.toMatch(/bot/i);
      expect(name).not.toMatch(/cpu/i);
      expect(name).not.toMatch(/computer/i);
    }
  });

  it('should select distinct random bot names excluding host name', () => {
    const selected = getRandomBotNames(3, ['Aarav']);
    expect(selected).toHaveLength(3);
    expect(new Set(selected).size).toBe(3);
    expect(selected).not.toContain('Aarav');
  });
});

describe('Single-Round Bidding & Forced Dealer Bid Mechanics', () => {
  const dummyPlayers: PlayerInfo[] = [
    { id: 'p0', name: 'Player 0', position: 0, team: 0, isHost: true, isCpu: false, isReady: true, connected: true },
    { id: 'p1', name: 'Player 1', position: 1, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
    { id: 'p2', name: 'Player 2', position: 2, team: 0, isHost: false, isCpu: false, isReady: true, connected: true },
    { id: 'p3', name: 'Player 3', position: 3, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
  ];

  it('should strictly limit bidding to 4 turns and transition to TRUMP_SELECTION', () => {
    let state = createInitialGame('AUCTION_4_TURNS', dummyPlayers);
    state = startNewRound(state, 0); // Dealer = 0, Order = [1, 2, 3, 0]
    expect(state.phase).toBe('BIDDING');
    expect(state.currentTurn).toBe(1);

    // Turn 1: P1 bids 16
    let res = applyBid(state, 1, 16);
    expect(res.success).toBe(true);
    state = res.state;
    expect(state.phase).toBe('BIDDING');
    expect(state.currentTurn).toBe(2);

    // Turn 2: P2 bids 17
    res = applyBid(state, 2, 17);
    expect(res.success).toBe(true);
    state = res.state;
    expect(state.phase).toBe('BIDDING');
    expect(state.currentTurn).toBe(3);

    // Turn 3: P3 passes
    res = applyBid(state, 3, 'PASS');
    expect(res.success).toBe(true);
    state = res.state;
    expect(state.phase).toBe('BIDDING');
    expect(state.currentTurn).toBe(0); // Dealer's turn

    // Turn 4: P0 (Dealer) passes
    res = applyBid(state, 0, 'PASS');
    expect(res.success).toBe(true);
    state = res.state;

    // Auction complete! Exactly 4 turns, phase is TRUMP_SELECTION
    expect(state.phase).toBe('TRUMP_SELECTION');
    expect(state.highestBid).toBe(17);
    expect(state.highestBidder).toBe(2);

    // Any attempt to place a 5th bid must fail
    const fifthBidRes = applyBid(state, 1, 18);
    expect(fifthBidRes.success).toBe(false);
  });

  it('should force dealer to bid minimum 16 if first 3 players pass', () => {
    let state = createInitialGame('FORCED_DEALER', dummyPlayers);
    state = startNewRound(state, 0); // Dealer = 0, Order = [1, 2, 3, 0]

    // P1, P2, P3 pass
    state = applyBid(state, 1, 'PASS').state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;

    // Dealer (P0) turn: Dealer attempts to PASS -> rejected
    const dealerPass = applyBid(state, 0, 'PASS');
    expect(dealerPass.success).toBe(false);
    expect(dealerPass.error).toContain('minimum opening bid');

    // Dealer bids 16 -> accepted and wins auction
    const dealerBid = applyBid(state, 0, 16);
    expect(dealerBid.success).toBe(true);
    expect(dealerBid.state.phase).toBe('TRUMP_SELECTION');
    expect(dealerBid.state.highestBid).toBe(16);
    expect(dealerBid.state.highestBidder).toBe(0);
  });
});

describe('Six Trump Options & 7th Card Mechanics', () => {
  const dummyPlayers: PlayerInfo[] = [
    { id: 'p0', name: 'Player 0', position: 0, team: 0, isHost: true, isCpu: false, isReady: true, connected: true },
    { id: 'p1', name: 'Player 1', position: 1, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
    { id: 'p2', name: 'Player 2', position: 2, team: 0, isHost: false, isCpu: false, isReady: true, connected: true },
    { id: 'p3', name: 'Player 3', position: 3, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
  ];

  it('should support standard Suit trump selection and second deal distribution', () => {
    let state = createInitialGame('SUIT_TRUMP', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    expect(state.phase).toBe('TRUMP_SELECTION');
    const trumpRes = applyTrumpSelection(state, 1, 'DIAMONDS');
    expect(trumpRes.success).toBe(true);

    const s = trumpRes.state;
    expect(s.phase).toBe('TRICK_PLAY');
    expect(s.trumpSuit).toBe('DIAMONDS');
    expect(s.trumpMode).toBe('suit');
    expect(s.isTrumpRevealed).toBe(false);

    // In public state: trump is concealed for opponents
    const pubP0 = getPublicGameState(s, 0);
    expect(pubP0.isTrumpConcealed).toBe(true);
    expect(pubP0.revealedTrumpSuit).toBeNull();

    // All players now hold exactly 8 cards
    for (let p = 0; p < 4; p++) {
      expect(s.hands[p as PlayerPosition]).toHaveLength(8);
    }
  });

  it('should support Joker / No Trump mode where lead suit wins and off-suit cannot cut', () => {
    let state = createInitialGame('NO_TRUMP_MODE', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    const trumpRes = applyTrumpSelection(state, 1, 'NO_TRUMP');
    expect(trumpRes.success).toBe(true);

    const s = trumpRes.state;
    expect(s.phase).toBe('TRICK_PLAY');
    expect(s.trumpMode).toBe('no-trump');
    expect(s.trumpSuit).toBeNull();
    expect(s.isTrumpRevealed).toBe(false);

    const pubP0 = getPublicGameState(s, 0);
    expect(pubP0.isTrumpConcealed).toBe(false);
    expect(pubP0.trumpMode).toBe('no-trump');

    // Verify trick evaluation in No Trump mode:
    // Lead is 10 of Hearts. Player 2 plays Ace of Spades (normally would cut if Spades were trump).
    // In No Trump, off-suit cards NEVER cut: 10 of Hearts wins because it is highest lead card!
    const trickCards = [
      { cardId: '10_HEARTS', playerIndex: 1 as PlayerPosition }, // Lead Heart (Rank: 10, value: 1)
      { cardId: 'A_SPADES', playerIndex: 2 as PlayerPosition },  // Off-suit Ace! Cannot cut!
      { cardId: '7_HEARTS', playerIndex: 3 as PlayerPosition },  // Lower Heart
      { cardId: '8_HEARTS', playerIndex: 0 as PlayerPosition },  // Lower Heart
    ];

    const trickResult = evaluateTrickWinner(trickCards, 1, null, false, 1, true, 'no-trump');
    expect(trickResult.winner).toBe(1); // 10 of Hearts wins!
  });

  it('should support 7th Card mode with reservation and subsequent reveal returning to bidder hand', () => {
    let state = createInitialGame('SEVENTH_CARD_MODE', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    const trumpRes = applyTrumpSelection(state, 1, 'SEVENTH_CARD');
    expect(trumpRes.success).toBe(true);

    const s = trumpRes.state;
    expect(s.phase).toBe('TRICK_PLAY');
    expect(s.trumpMode).toBe('seventh-card');
    expect(s.seventhCard).not.toBeNull();

    // Bidder (P1) has 7 cards dealt to hand during trick play; other 3 players have 8
    expect(s.hands[1]).toHaveLength(7);
    expect(s.hands[0]).toHaveLength(8);
    expect(s.hands[2]).toHaveLength(8);
    expect(s.hands[3]).toHaveLength(8);

    // Public state for opponent (P0): 7th card details hidden
    const publicP0 = getPublicGameState(s, 0);
    expect(publicP0.hasSeventhCardReserved).toBe(true);
    expect(publicP0.revealedSeventhCard).toBeNull();
    expect(publicP0.revealedTrumpSuit).toBeNull();

    // Public state for bidder (P1): bidder can see reserved 7th card
    const publicP1 = getPublicGameState(s, 1);
    expect(publicP1.revealedSeventhCard).not.toBeNull();
    expect(publicP1.revealedSeventhCard).toBe(s.seventhCard?.cardId);

    // Reveal Trump!
    const revealRes = applyTrumpReveal(s, s.currentTurn);
    expect(revealRes.success).toBe(true);
    const revealedState = revealRes.state;

    expect(revealedState.isTrumpRevealed).toBe(true);
    const seventhCardSuit = CARD_MANIFEST[s.seventhCard!.cardId].suit;
    expect(revealedState.trumpSuit).toBe(seventhCardSuit);

    // 7th card has now been returned to bidder's hand, bringing total playable cards to 8!
    expect(revealedState.hands[1]).toHaveLength(8);
    expect(revealedState.hands[1]).toContain(s.seventhCard?.cardId);

    // Public state after reveal shows 7th card to all players
    const publicP0After = getPublicGameState(revealedState, 0);
    expect(publicP0After.revealedTrumpSuit).toBe(seventhCardSuit);
    expect(publicP0After.revealedSeventhCard).toBe(s.seventhCard?.cardId);
    expect(publicP0After.hasSeventhCardReserved).toBe(false);
  });
});

