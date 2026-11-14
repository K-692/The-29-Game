/**
 * Card Asset Manifest for Indian 29 (Twenty-Nine) Card Game
 * Authoritatively mapped from original EPS collection: poker-cards-icons-collection/OIUGSZ1.eps
 */

export type Suit = 'DIAMONDS' | 'HEARTS' | 'CLUBS' | 'SPADES';
export type Rank = 'J' | '9' | 'A' | '10' | 'K' | 'Q' | '8' | '7';

export interface CardIdentity {
  id: string; // e.g. "J_DIAMONDS"
  rank: Rank;
  suit: Suit;
  points: number;
  order: number; // 29 rank hierarchy: J (7) > 9 (6) > A (5) > 10 (4) > K (3) > Q (2) > 8 (1) > 7 (0)
  name: string;
  svgAsset: string;
  pngAsset: string;
  color: 'red' | 'black';
}

export const SUITS: Suit[] = ['DIAMONDS', 'HEARTS', 'CLUBS', 'SPADES'];
export const RANKS_29: Rank[] = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];

export const RANK_POINTS: Record<Rank, number> = {
  J: 3,
  '9': 2,
  A: 1,
  '10': 1,
  K: 0,
  Q: 0,
  '8': 0,
  '7': 0,
};

export const RANK_HIERARCHY: Record<Rank, number> = {
  J: 7,
  '9': 6,
  A: 5,
  '10': 4,
  K: 3,
  Q: 2,
  '8': 1,
  '7': 0,
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
  SPADES: '♠',
};

export const SUIT_COLORS: Record<Suit, 'red' | 'black'> = {
  HEARTS: 'red',
  DIAMONDS: 'red',
  CLUBS: 'black',
  SPADES: 'black',
};

const getBasePath = (): string => {
  // Vite sets import.meta.env.BASE_URL based on `base` config
  const base = import.meta.env?.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
};

export const getCardAssetPath = (filename: string): string => {
  return `${getBasePath()}assets/cards/${filename}`;
};

const rankToWord: Record<Rank, string> = {
  J: 'jack',
  '9': 'nine',
  A: 'ace',
  '10': 'ten',
  K: 'king',
  Q: 'queen',
  '8': 'eight',
  '7': 'seven',
};

const suitToWord: Record<Suit, string> = {
  DIAMONDS: 'diamonds',
  HEARTS: 'hearts',
  CLUBS: 'clubs',
  SPADES: 'spades',
};

/**
 * 32-card manifest for Indian 29
 */
export const CARD_MANIFEST: Record<string, CardIdentity> = {};

for (const suit of SUITS) {
  for (const rank of RANKS_29) {
    const id = `${rank}_${suit}`;
    const filenameBase = `${rankToWord[rank]}_of_${suitToWord[suit]}`;
    CARD_MANIFEST[id] = {
      id,
      rank,
      suit,
      points: RANK_POINTS[rank],
      order: RANK_HIERARCHY[rank],
      name: `${rank} of ${suit.charAt(0) + suit.slice(1).toLowerCase()}`,
      svgAsset: `${filenameBase}.svg`,
      pngAsset: `${filenameBase}.png`,
      color: SUIT_COLORS[suit],
    };
  }
}

export const CARD_BACK = {
  id: 'CARD_BACK',
  name: 'Card Back',
  svgAsset: 'card_back.svg',
  pngAsset: 'card_back.png',
};

export const getAllCards = (): CardIdentity[] => Object.values(CARD_MANIFEST);

export const getCardById = (id: string): CardIdentity | undefined => CARD_MANIFEST[id];

export const getCardSvgUrl = (cardId: string): string => {
  if (cardId === 'CARD_BACK') {
    return getCardAssetPath(CARD_BACK.svgAsset);
  }
  const card = CARD_MANIFEST[cardId];
  return card ? getCardAssetPath(card.svgAsset) : getCardAssetPath(CARD_BACK.svgAsset);
};

export const getCardPngUrl = (cardId: string): string => {
  if (cardId === 'CARD_BACK') {
    return getCardAssetPath(CARD_BACK.pngAsset);
  }
  const card = CARD_MANIFEST[cardId];
  return card ? getCardAssetPath(card.pngAsset) : getCardAssetPath(CARD_BACK.pngAsset);
};

