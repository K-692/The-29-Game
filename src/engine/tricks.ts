import { CARD_MANIFEST, CardIdentity, Suit, RANK_POINTS, RANK_HIERARCHY } from '../assets/cardManifest';
import { CompletedTrick, PlayedCard, PlayerPosition, Team, TrumpMode } from './types';

/**
 * Returns all playable card IDs for the active player based on authentic 29 rules
 */
export const getPlayableCards = (
  handCardIds: string[],
  leadCardId: string | null,
  trumpSuit: Suit | null,
  isTrumpRevealed: boolean,
  trumpMode: TrumpMode = 'suit'
): string[] => {
  if (handCardIds.length === 0) return [];

  // If leading the trick, any card in hand can be led
  if (!leadCardId) {
    return [...handCardIds];
  }

  const leadCard = CARD_MANIFEST[leadCardId];
  if (!leadCard) return [...handCardIds];

  const leadSuit = leadCard.suit;

  // Check if player has any card of the lead suit
  const matchingSuitCards = handCardIds.filter((id) => {
    const card = CARD_MANIFEST[id];
    return card && card.suit === leadSuit;
  });

  // MANDATORY FOLLOW-SUIT: If player has card of lead suit, they MUST play lead suit
  if (matchingSuitCards.length > 0) {
    return matchingSuitCards;
  }

  // Player cannot follow suit
  if (trumpMode !== 'no-trump' && isTrumpRevealed && trumpSuit) {
    // Trump is revealed: player can play ANY card in hand (either trump to cut, or sluff/discard)
    return [...handCardIds];
  }

  // Trump is NOT revealed yet or No-Trump mode:
  return [...handCardIds];
};

/**
 * Validates whether a specific card play is legal
 */
export const isLegalCardPlay = (
  cardId: string,
  handCardIds: string[],
  leadCardId: string | null,
  trumpSuit: Suit | null,
  isTrumpRevealed: boolean,
  trumpMode: TrumpMode = 'suit'
): { legal: boolean; reason?: string } => {
  if (!handCardIds.includes(cardId)) {
    return { legal: false, reason: 'Card is not in player hand' };
  }

  const playable = getPlayableCards(handCardIds, leadCardId, trumpSuit, isTrumpRevealed, trumpMode);
  if (!playable.includes(cardId)) {
    const leadCard = leadCardId ? CARD_MANIFEST[leadCardId] : null;
    return { 
      legal: false, 
      reason: leadCard ? `You must follow suit (${leadCard.suit})` : 'Card cannot be played' 
    };
  }

  return { legal: true };
};

/**
 * Calculates card points for a set of played cards
 */
export const calculateTrickPoints = (cards: PlayedCard[], isLastTrick: boolean = false, lastTrickBonus: boolean = true): number => {
  let points = 0;
  for (const pc of cards) {
    const card = CARD_MANIFEST[pc.cardId];
    if (card) {
      points += card.points;
    }
  }
  if (isLastTrick && lastTrickBonus) {
    points += 1;
  }
  return points;
};

/**
 * Determines the winner of a trick among 4 played cards
 */
export const evaluateTrickWinner = (
  playedCards: PlayedCard[],
  leadPlayer: PlayerPosition,
  trumpSuit: Suit | null,
  isTrumpRevealed: boolean,
  trickNumber: number,
  lastTrickBonus: boolean = true,
  trumpMode: TrumpMode = 'suit'
): CompletedTrick => {
  if (playedCards.length !== 4) {
    throw new Error(`A completed trick must have exactly 4 cards, got ${playedCards.length}`);
  }

  const leadCardId = playedCards[0].cardId;
  const leadCard = CARD_MANIFEST[leadCardId];
  if (!leadCard) {
    throw new Error(`Invalid lead card: ${leadCardId}`);
  }

  const leadSuit = leadCard.suit;

  let bestPlayed = playedCards[0];
  let bestCard = leadCard;
  let trumpWasPlayed = (trumpMode !== 'no-trump' && isTrumpRevealed && trumpSuit && leadCard.suit === trumpSuit);

  for (let i = 1; i < playedCards.length; i++) {
    const pc = playedCards[i];
    const card = CARD_MANIFEST[pc.cardId];
    if (!card) continue;

    // Check if this card is trump (and trump is revealed and trumpMode is not no-trump)
    const isThisTrump = Boolean(
      trumpMode !== 'no-trump' && 
      isTrumpRevealed && 
      trumpSuit && 
      card.suit === trumpSuit
    );

    if (isThisTrump) {
      if (!trumpWasPlayed) {
        // First trump played beats any non-trump card
        trumpWasPlayed = true;
        bestPlayed = pc;
        bestCard = card;
      } else {
        // Higher trump rank wins (J > 9 > A > 10 > K > Q > 8 > 7)
        if (card.order > bestCard.order) {
          bestPlayed = pc;
          bestCard = card;
        }
      }
    } else if (!trumpWasPlayed && card.suit === leadSuit) {
      // Both are lead suit, higher rank wins
      if (card.order > bestCard.order) {
        bestPlayed = pc;
        bestCard = card;
      }
    }
  }

  const winner = bestPlayed.playerIndex;
  const winningTeam: Team = (winner === 0 || winner === 2) ? 0 : 1;
  const isLastTrick = trickNumber === 8;
  const points = calculateTrickPoints(playedCards, isLastTrick, lastTrickBonus);

  return {
    trickNumber,
    leadPlayer,
    cards: playedCards,
    winner,
    winningTeam,
    points,
    leadSuit,
  };
};

