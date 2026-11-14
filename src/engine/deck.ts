import { CARD_MANIFEST, CardIdentity, RANKS_29, SUITS, Suit, Rank, RANK_HIERARCHY } from '../assets/cardManifest';
import { PlayerPosition } from './types';

/**
 * Generate standard 32-card deck for Indian 29
 */
export const create29Deck = (): string[] => {
  const deck: string[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS_29) {
      deck.push(`${rank}_${suit}`);
    }
  }
  return deck;
};

/**
 * Cryptographically sound or secure Fisher-Yates shuffle
 */
export const shuffleDeck = (deck: string[]): string[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    let rand = Math.random();
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      rand = buffer[0] / (0xffffffff + 1);
    }
    const j = Math.floor(rand * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export interface DealtCards {
  round1: Record<PlayerPosition, string[]>;
  round2: Record<PlayerPosition, string[]>;
}

/**
 * Deal 32-card deck in two phases of 4 cards per player
 */
export const deal29Deck = (shuffledDeck: string[]): DealtCards => {
  if (shuffledDeck.length !== 32) {
    throw new Error(`Deck must have exactly 32 cards for 29, received ${shuffledDeck.length}`);
  }

  const round1: Record<PlayerPosition, string[]> = {
    0: shuffledDeck.slice(0, 4),
    1: shuffledDeck.slice(4, 8),
    2: shuffledDeck.slice(8, 12),
    3: shuffledDeck.slice(12, 16),
  };

  const round2: Record<PlayerPosition, string[]> = {
    0: shuffledDeck.slice(16, 20),
    1: shuffledDeck.slice(20, 24),
    2: shuffledDeck.slice(24, 28),
    3: shuffledDeck.slice(28, 32),
  };

  return { round1, round2 };
};

/**
 * Suit ordering for player hand display
 */
const SUIT_SORT_ORDER: Record<Suit, number> = {
  SPADES: 0,
  HEARTS: 1,
  CLUBS: 2,
  DIAMONDS: 3,
};

/**
 * Sorts cards in a player's hand logically by suit, then by 29 rank hierarchy (J > 9 > A > 10 > K > Q > 8 > 7)
 */
export const sortHand = (cardIds: string[]): string[] => {
  return [...cardIds].sort((aId, bId) => {
    const a = CARD_MANIFEST[aId];
    const b = CARD_MANIFEST[bId];
    if (!a || !b) return 0;
    
    if (a.suit !== b.suit) {
      return SUIT_SORT_ORDER[a.suit] - SUIT_SORT_ORDER[b.suit];
    }
    // Higher hierarchy first (J > 9 > A ...)
    return b.order - a.order;
  });
};

