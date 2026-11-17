import { describe, expect, it } from 'vitest';
import { evaluateTrickWinner } from './tricks';
import { applyCardPlay, createInitialGame } from './gameManager';
import { DEFAULT_RULES_CONFIG, GameState, PlayedCard, PlayerInfo, PlayerPosition } from './types';

const trick = (...ids: string[]): PlayedCard[] => ids.map((cardId, i) => ({ cardId, playerIndex: i as PlayerPosition }));

describe('Trump wins the trick', () => {
  it('a single trump cut beats the highest card of the led suit (trump revealed)', () => {
    const t = evaluateTrickWinner(trick('J_HEARTS', '9_HEARTS', '7_SPADES', 'A_HEARTS'), 0, 'SPADES', true, 1);
    expect(t.winner).toBe(2);
  });

  it('a trump cut wins even while the trump is still concealed', () => {
    const t = evaluateTrickWinner(trick('J_HEARTS', '7_SPADES', '9_HEARTS', 'A_HEARTS'), 0, 'SPADES', false, 1);
    expect(t.winner).toBe(1);
  });

  it('over-trump: the highest trump wins (J > 9 > A > 10 > K > Q > 8 > 7)', () => {
    expect(evaluateTrickWinner(trick('J_HEARTS', '7_SPADES', '9_SPADES', 'A_HEARTS'), 0, 'SPADES', true, 1).winner).toBe(2);
    expect(evaluateTrickWinner(trick('A_HEARTS', 'K_SPADES', '10_SPADES', 'J_SPADES'), 0, 'SPADES', true, 1).winner).toBe(3);
    expect(evaluateTrickWinner(trick('A_HEARTS', '9_SPADES', 'A_SPADES', '8_SPADES'), 0, 'SPADES', false, 1).winner).toBe(1);
  });

  it('when trump is led, the highest trump still wins and off-suit cards never win', () => {
    const t = evaluateTrickWinner(trick('10_SPADES', 'J_HEARTS', '9_SPADES', 'A_CLUBS'), 0, 'SPADES', true, 1);
    expect(t.winner).toBe(2);
  });

  it('Joker / No Trump: nothing is trump, the highest led-suit card wins', () => {
    const t = evaluateTrickWinner(trick('9_HEARTS', 'J_SPADES', 'J_HEARTS', '7_HEARTS'), 0, null, false, 1, true, 'no-trump');
    expect(t.winner).toBe(2);
  });
});

describe('Cutting with a concealed trump reveals it', () => {
  const players: PlayerInfo[] = [0, 1, 2, 3].map((p) => ({
    id: `p${p}`, name: `P${p}`, position: p as PlayerPosition, team: (p % 2) as 0 | 1, isHost: p === 0, isReady: true, connected: true,
  }));

  const trickState = (): GameState => ({
    ...createInitialGame('ROOM', players, DEFAULT_RULES_CONFIG),
    phase: 'TRICK_PLAY',
    trumpMode: 'suit',
    trumpSuit: 'SPADES',
    isTrumpRevealed: false,
    highestBidder: 0,
    highestBid: 20,
    currentTurn: 1,
    currentTrickLead: 0,
    currentTrickNumber: 1,
    currentTrickCards: [{ cardId: 'J_HEARTS', playerIndex: 0 }],
    hands: { 0: ['7_CLUBS'], 1: ['7_SPADES', 'A_CLUBS'], 2: ['9_HEARTS'], 3: ['A_HEARTS'] },
  });

  it('reveals trump when a player who cannot follow plays a trump card', () => {
    const res = applyCardPlay(trickState(), 1, '7_SPADES');
    expect(res.success).toBe(true);
    expect(res.state.isTrumpRevealed).toBe(true);
    expect(res.state.trumpRevealedBy).toBe(1);
    expect(res.state.hands[1]).toEqual(['A_CLUBS']);
  });

  it('does not reveal for a discard of another suit', () => {
    const res = applyCardPlay(trickState(), 1, 'A_CLUBS');
    expect(res.state.isTrumpRevealed).toBe(false);
  });

  it('the trump cut then wins the completed trick', () => {
    let s = applyCardPlay(trickState(), 1, '7_SPADES').state;
    s = applyCardPlay(s, 2, '9_HEARTS').state;
    const done = applyCardPlay(s, 3, 'A_HEARTS');
    expect(done.trickCompleted?.winner).toBe(1);
  });
});
