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

/**
 * Six-number display cards used exclusively as visual Trump suit indicators.
 * Not part of the 32-card playing deck.
 */
export const TRUMP_DISPLAY_CARDS: Record<Suit, { id: string; name: string; svgAsset: string; pngAsset: string; suit: Suit }> = {
  HEARTS: {
    id: '6_HEARTS',
    name: '6 of Hearts',
    svgAsset: 'six_of_hearts.svg',
    pngAsset: 'six_of_hearts.png',
    suit: 'HEARTS',
  },
  SPADES: {
    id: '6_SPADES',
    name: '6 of Spades',
    svgAsset: 'six_of_spades.svg',
    pngAsset: 'six_of_spades.png',
    suit: 'SPADES',
  },
  CLUBS: {
    id: '6_CLUBS',
    name: '6 of Clubs',
    svgAsset: 'six_of_clubs.svg',
    pngAsset: 'six_of_clubs.png',
    suit: 'CLUBS',
  },
  DIAMONDS: {
    id: '6_DIAMONDS',
    name: '6 of Diamonds',
    svgAsset: 'six_of_diamonds.svg',
    pngAsset: 'six_of_diamonds.png',
    suit: 'DIAMONDS',
  },
};

const TRUMP_DISPLAY_MAP: Record<string, string> = {
  '6_HEARTS': 'six_of_hearts',
  '6_SPADES': 'six_of_spades',
  '6_CLUBS': 'six_of_clubs',
  '6_DIAMONDS': 'six_of_diamonds',
};

export const getAllCards = (): CardIdentity[] => Object.values(CARD_MANIFEST);

export const getCardById = (id: string): CardIdentity | undefined => CARD_MANIFEST[id];

export const getCardSvgUrl = (cardId: string): string => {
  if (cardId === 'CARD_BACK') {
    return getCardAssetPath(CARD_BACK.svgAsset);
  }
  if (TRUMP_DISPLAY_MAP[cardId]) {
    return getCardAssetPath(`${TRUMP_DISPLAY_MAP[cardId]}.svg`);
  }
  const card = CARD_MANIFEST[cardId];
  return card ? getCardAssetPath(card.svgAsset) : getCardAssetPath(CARD_BACK.svgAsset);
};

export const getCardPngUrl = (cardId: string): string => {
  if (cardId === 'CARD_BACK') {
    return getCardAssetPath(CARD_BACK.pngAsset);
  }
  if (TRUMP_DISPLAY_MAP[cardId]) {
    return getCardAssetPath(`${TRUMP_DISPLAY_MAP[cardId]}.png`);
  }
  const card = CARD_MANIFEST[cardId];
  return card ? getCardAssetPath(card.pngAsset) : getCardAssetPath(CARD_BACK.pngAsset);
};

