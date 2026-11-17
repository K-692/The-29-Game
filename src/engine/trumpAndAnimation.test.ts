import { describe, it, expect } from 'vitest';
import {
  TRUMP_DISPLAY_CARDS,
  getCardSvgUrl,
  getCardPngUrl,
  CARD_MANIFEST,
  getAllCards,
} from '../assets/cardManifest';
import {
  createInitialGame,
  startNewRound,
  applyBid,
  applyTrumpSelection,
  applyTrumpReveal,
} from './gameManager';
import { DEFAULT_RULES_CONFIG } from './types';
import { evaluateTrickWinner } from './tricks';

describe('Card Manifest and Trump Display Cards', () => {
  it('preserves the authoritative 32-card playing deck', () => {
    const allCards = getAllCards();
    expect(allCards).toHaveLength(32);
    // 6-number cards must NOT be part of the 32-card playable deck
    expect(allCards.some((c) => (c.rank as string) === '6')).toBe(false);
  });

  it('provides authentic 6-number display cards for all 4 suits', () => {
    expect(TRUMP_DISPLAY_CARDS.HEARTS.id).toBe('6_HEARTS');
    expect(TRUMP_DISPLAY_CARDS.SPADES.id).toBe('6_SPADES');
    expect(TRUMP_DISPLAY_CARDS.CLUBS.id).toBe('6_CLUBS');
    expect(TRUMP_DISPLAY_CARDS.DIAMONDS.id).toBe('6_DIAMONDS');

    // Resolves SVG and PNG asset paths properly
    expect(getCardSvgUrl('6_HEARTS')).toContain('six_of_hearts.svg');
    expect(getCardPngUrl('6_HEARTS')).toContain('six_of_hearts.png');
    expect(getCardSvgUrl('6_SPADES')).toContain('six_of_spades.svg');
    expect(getCardPngUrl('6_SPADES')).toContain('six_of_spades.png');
    expect(getCardSvgUrl('6_CLUBS')).toContain('six_of_clubs.svg');
    expect(getCardPngUrl('6_CLUBS')).toContain('six_of_clubs.png');
    expect(getCardSvgUrl('6_DIAMONDS')).toContain('six_of_diamonds.svg');
    expect(getCardPngUrl('6_DIAMONDS')).toContain('six_of_diamonds.png');
  });
});

describe('Trump Indicator and 7th Card Reveal Lifecycle', () => {
  it('executes 7th card mode: conceals card, reveals exact 7th card, restores to owner hand, and resolves suit', () => {
    const players = [
      { id: 'p0', name: 'Krish', position: 0 as const, team: 0 as const, isHost: true, isCpu: false, isReady: true, connected: true },
      { id: 'p1', name: 'Ishaan', position: 1 as const, team: 1 as const, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p2', name: 'Aarav', position: 2 as const, team: 0 as const, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p3', name: 'Karan', position: 3 as const, team: 1 as const, isHost: false, isCpu: false, isReady: true, connected: true },
    ];

    let state = createInitialGame('R12345', players, DEFAULT_RULES_CONFIG);
    state = startNewRound(state, 0);
    state.currentTurn = 1;

    // Player 1 bids 16, others pass
    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    expect(state.phase).toBe('TRUMP_SELECTION');
    expect(state.highestBidder).toBe(1);

    // Player 1 chooses 7th Card mode
    const trumpRes = applyTrumpSelection(state, 1, 'SEVENTH_CARD');
    expect(trumpRes.success).toBe(true);
    state = trumpRes.state;

    expect(state.trumpMode).toBe('seventh-card');
    expect(state.isTrumpRevealed).toBe(false);
    expect(state.seventhCard).not.toBeNull();
    expect(state.seventhCard?.owner).toBe(1);
    expect(state.seventhCard?.isRevealed).toBe(false);

    // 7th card is held back: owner has 7 cards, others have 8
    expect(state.hands[1].length).toBe(7);
    expect(state.hands[0].length).toBe(8);
    expect(state.hands[2].length).toBe(8);
    expect(state.hands[3].length).toBe(8);

    const reservedSeventhCardId = state.seventhCard!.cardId;
    const expectedTrumpSuit = CARD_MANIFEST[reservedSeventhCardId].suit;

    state.phase = 'TRICK_PLAY';

    // Trigger trump reveal by active player
    const revealRes = applyTrumpReveal(state, state.currentTurn);
    expect(revealRes.success).toBe(true);
    state = revealRes.state;

    // Stage 1 & 2 verification: 7th card is revealed, returned to owner hand
    expect(state.isTrumpRevealed).toBe(true);
    expect(state.seventhCard?.isRevealed).toBe(true);
    expect(state.hands[1].length).toBe(8);
    expect(state.hands[1]).toContain(reservedSeventhCardId);
    expect(state.trumpSuit).toBe(expectedTrumpSuit);

    // Stage 3 verification: the suit display card for this trump suit exists
    const displayCard = TRUMP_DISPLAY_CARDS[expectedTrumpSuit];
    expect(displayCard.id).toBe(`6_${expectedTrumpSuit}`);
  });

  it('normal suit selection: conceals trump until reveal, then maps to correct 6 display card', () => {
    const players = [
      { id: 'p0', name: 'Krish', position: 0 as const, team: 0 as const, isHost: true, isCpu: false, isReady: true, connected: true },
      { id: 'p1', name: 'Ishaan', position: 1 as const, team: 1 as const, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p2', name: 'Aarav', position: 2 as const, team: 0 as const, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p3', name: 'Karan', position: 3 as const, team: 1 as const, isHost: false, isCpu: false, isReady: true, connected: true },
    ];

    let state = createInitialGame('R67890', players, DEFAULT_RULES_CONFIG);
    state = startNewRound(state, 0);
    state.currentTurn = 1;

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    state = applyTrumpSelection(state, 1, 'HEARTS').state;
    expect(state.trumpMode).toBe('suit');
    expect(state.isTrumpRevealed).toBe(false);

    state.phase = 'TRICK_PLAY';
    state = applyTrumpReveal(state, state.currentTurn).state;
    expect(state.isTrumpRevealed).toBe(true);
    expect(state.trumpSuit).toBe('HEARTS');
    expect(TRUMP_DISPLAY_CARDS[state.trumpSuit!].id).toBe('6_HEARTS');
  });

  it('no trump / joker mode: maintains concealed status and reveals cleanly', () => {
    const players = [
      { id: 'p0', name: 'Krish', position: 0 as const, team: 0 as const, isHost: true, isCpu: false, isReady: true, connected: true },
      { id: 'p1', name: 'Ishaan', position: 1 as const, team: 1 as const, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p2', name: 'Aarav', position: 2 as const, team: 0 as const, isHost: false, isCpu: false, isReady: true, connected: true },
      { id: 'p3', name: 'Karan', position: 3 as const, team: 1 as const, isHost: false, isCpu: false, isReady: true, connected: true },
    ];

    let state = createInitialGame('RJOKER', players, DEFAULT_RULES_CONFIG);
    state = startNewRound(state, 0);
    state.currentTurn = 1;

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    state = applyTrumpSelection(state, 1, 'NO_TRUMP').state;
    expect(state.trumpMode).toBe('no-trump');
    expect(state.isTrumpRevealed).toBe(false);

    state.phase = 'TRICK_PLAY';
    state = applyTrumpReveal(state, state.currentTurn).state;
    expect(state.isTrumpRevealed).toBe(true);
    expect(state.trumpMode).toBe('no-trump');
  });

  it('determines the correct winning player and maps the 4-card collective win animation trajectory', () => {
    // Relative position mapper matching TrickArea
    const getRelativePosition = (pos: 0 | 1 | 2 | 3, myPos: 0 | 1 | 2 | 3): 'bottom' | 'left' | 'top' | 'right' => {
      const diff = (pos - myPos + 4) % 4;
      switch (diff) {
        case 0: return 'bottom';
        case 1: return 'left';
        case 2: return 'top';
        case 3: return 'right';
        default: return 'bottom';
      }
    };

    // Case A: Bottom player (Player 0) wins with highest trump Jack
    const trickCardsP0Wins = [
      { cardId: 'K_HEARTS', playerIndex: 1 as const },
      { cardId: '10_HEARTS', playerIndex: 2 as const },
      { cardId: '8_HEARTS', playerIndex: 3 as const },
      { cardId: 'J_SPADES', playerIndex: 0 as const }, // Trump Jack
    ];
    const resultP0 = evaluateTrickWinner(trickCardsP0Wins, 1, 'SPADES', true, 1, true, 'suit');
    expect(resultP0.winner).toBe(0);
    const relPosP0 = getRelativePosition(resultP0.winner, 0);
    expect(relPosP0).toBe('bottom');
    const animClassP0 = `animate-trick-win-${relPosP0}`;
    expect(animClassP0).toBe('animate-trick-win-bottom');

    // Case B: Left opponent (Player 1) wins with Jack of lead suit
    const trickCardsP1Wins = [
      { cardId: 'J_HEARTS', playerIndex: 1 as const }, // Jack of Hearts leads
      { cardId: '9_HEARTS', playerIndex: 2 as const },
      { cardId: 'A_HEARTS', playerIndex: 3 as const },
      { cardId: '10_HEARTS', playerIndex: 0 as const },
    ];
    const resultP1 = evaluateTrickWinner(trickCardsP1Wins, 1, 'CLUBS', true, 2, true, 'suit');
    expect(resultP1.winner).toBe(1);
    const relPosP1 = getRelativePosition(resultP1.winner, 0);
    expect(relPosP1).toBe('left');
    const animClassP1 = `animate-trick-win-${relPosP1}`;
    expect(animClassP1).toBe('animate-trick-win-left');

    // Case C: Top partner (Player 2) wins with highest trump
    const trickCardsP2Wins = [
      { cardId: 'A_CLUBS', playerIndex: 3 as const },
      { cardId: '8_CLUBS', playerIndex: 0 as const },
      { cardId: '7_CLUBS', playerIndex: 1 as const },
      { cardId: '9_DIAMONDS', playerIndex: 2 as const }, // Trump 9
    ];
    const resultP2 = evaluateTrickWinner(trickCardsP2Wins, 3, 'DIAMONDS', true, 3, true, 'suit');
    expect(resultP2.winner).toBe(2);
    const relPosP2 = getRelativePosition(resultP2.winner, 0);
    expect(relPosP2).toBe('top');
    const animClassP2 = `animate-trick-win-${relPosP2}`;
    expect(animClassP2).toBe('animate-trick-win-top');

    // Case D: Right opponent (Player 3) wins with 9 of lead suit (Trump unrevealed)
    const trickCardsP3Wins = [
      { cardId: 'K_CLUBS', playerIndex: 0 as const },
      { cardId: '8_CLUBS', playerIndex: 1 as const },
      { cardId: '7_CLUBS', playerIndex: 2 as const },
      { cardId: '9_CLUBS', playerIndex: 3 as const }, // 9 is second highest card in 29
    ];
    const resultP3 = evaluateTrickWinner(trickCardsP3Wins, 0, 'HEARTS', false, 4, true, 'suit');
    expect(resultP3.winner).toBe(3);
    const relPosP3 = getRelativePosition(resultP3.winner, 0);
    expect(relPosP3).toBe('right');
    const animClassP3 = `animate-trick-win-${relPosP3}`;
    expect(animClassP3).toBe('animate-trick-win-right');
  });
});
