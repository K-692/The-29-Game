import { CARD_MANIFEST } from '../assets/cardManifest';
import { PlayerPosition } from './types';

/**
 * Returns the player sitting immediately to the left of the dealer.
 * 
 * Seating (Clockwise):
 * - Seat 1 (Bottom, index 0)
 * - Seat 2 (Left, index 1)
 * - Seat 3 (Top, index 2)
 * - Seat 4 (Right, index 3)
 * 
 * If Seat 1 (0) is dealer -> Seat 2 (1) is left-hand player.
 */
export const getLeftOfDealer = (dealer: PlayerPosition): PlayerPosition => {
  return ((dealer + 1) % 4) as PlayerPosition;
};

/**
 * Returns the complete one-round bidding sequence:
 * Dealer's left-hand player -> Next -> Next -> Dealer.
 * 
 * Example:
 * If dealer is Seat 1 (0):
 * [1, 2, 3, 0] (Seat 2, Seat 3, Seat 4, Seat 1)
 */
export const getBiddingOrder = (dealer: PlayerPosition): PlayerPosition[] => {
  return [
    ((dealer + 1) % 4) as PlayerPosition,
    ((dealer + 2) % 4) as PlayerPosition,
    ((dealer + 3) % 4) as PlayerPosition,
    dealer,
  ];
};

/**
 * The point-valued cards in 29:
 * - Jack: 3 points
 * - Nine: 2 points
 * - Ace: 1 point
 * - Ten: 1 point
 * 
 * King, Queen, 8, 7 have 0 points.
 */
export const hasPointCard = (cardIds: string[]): boolean => {
  return cardIds.some((id) => {
    const card = CARD_MANIFEST[id];
    return card && (card.rank === 'J' || card.rank === '9' || card.rank === 'A' || card.rank === '10');
  });
};

/**
 * Counts total point-valued cards in a hand (how many cards among J, 9, A, 10).
 */
export const countPointCards = (cardIds: string[]): number => {
  return cardIds.filter((id) => {
    const card = CARD_MANIFEST[id];
    return card && (card.rank === 'J' || card.rank === '9' || card.rank === 'A' || card.rank === '10');
  }).length;
};

/**
 * Calculates sum of card points (J=3, 9=2, A=1, 10=1, K=0, Q=0, 8=0, 7=0).
 */
export const sumPointValues = (cardIds: string[]): number => {
  return cardIds.reduce((sum, id) => {
    const card = CARD_MANIFEST[id];
    return sum + (card ? card.points : 0);
  }, 0);
};
