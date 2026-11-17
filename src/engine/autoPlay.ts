import { CARD_MANIFEST, Suit, SUITS } from '../assets/cardManifest';
import { getPlayableCards } from './tricks';
import { PlayedCard, PlayerPosition, Team, TrumpMode, TrumpSelectionChoice } from './types';

/**
 * Server-side auto-play used ONLY when a human player's turn timer expires
 * (or a disconnected player's turn comes up). There are no computer players.
 */

/**
 * Timeout fallback: pick a sensible trump among 6 options:
 * Hearts, Spades, Clubs, Diamonds, Joker (No Trump), 7th Card
 */
export const getAutoTrumpSelection = (handCardIds: string[]): TrumpSelectionChoice => {
  const suitCounts: Record<Suit, number> = { DIAMONDS: 0, HEARTS: 0, CLUBS: 0, SPADES: 0 };
  const suitPoints: Record<Suit, number> = { DIAMONDS: 0, HEARTS: 0, CLUBS: 0, SPADES: 0 };
  let aceOrTenCount = 0;

  for (const id of handCardIds) {
    const card = CARD_MANIFEST[id];
    if (!card) continue;
    suitCounts[card.suit]++;
    suitPoints[card.suit] += card.points;
    if (card.rank === 'A' || card.rank === '10') {
      aceOrTenCount++;
    }
  }

  let bestSuit: Suit = 'SPADES';
  let bestScore = -1;
  for (const suit of SUITS) {
    const count = suitCounts[suit];
    const points = suitPoints[suit];
    const score = count * 3 + points * 2;
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }

  // 1. Dominant suit: at least 2 cards and 2+ points -> choose that suit
  if (suitCounts[bestSuit] >= 2 && suitPoints[bestSuit] >= 2) {
    return bestSuit;
  }

  // 2. Balanced high cards (Aces/Tens spread across suits, no long suit) -> choose No Trump (Joker)
  if (aceOrTenCount >= 2 && Object.values(suitCounts).every((c) => c <= 1)) {
    return 'NO_TRUMP';
  }

  // 3. Flat hand with no strong suit -> gamble on 7th Card
  if (Object.values(suitCounts).every((c) => c <= 2) && bestScore <= 6) {
    return 'SEVENTH_CARD';
  }

  return bestSuit;
};

/**
 * Timeout fallback: pick a sensible legal card when a player's turn timer expires
 */
export const getAutoCardPlay = (
  handCardIds: string[],
  leadCardId: string | null,
  trumpSuit: Suit | null,
  isTrumpRevealed: boolean,
  currentTrickCards: PlayedCard[],
  myPosition: PlayerPosition,
  trumpMode: TrumpMode = 'suit'
): string => {
  const playable = getPlayableCards(handCardIds, leadCardId, trumpSuit, isTrumpRevealed, trumpMode);
  if (playable.length === 1) {
    return playable[0];
  }

  const myTeam: Team = (myPosition === 0 || myPosition === 2) ? 0 : 1;

  // Case 1: Player is leading the trick
  if (!leadCardId || currentTrickCards.length === 0) {
    // Lead an Ace (guaranteed high card) if available in non-trump
    const aces = playable.filter((id) => {
      const c = CARD_MANIFEST[id];
      return c && c.rank === 'A' && (!isTrumpRevealed || c.suit !== trumpSuit);
    });
    if (aces.length > 0) return aces[0];

    // Otherwise, lead a low card (7 or 8) to probe opponents
    const lowCards = playable.filter((id) => {
      const c = CARD_MANIFEST[id];
      return c && (c.rank === '7' || c.rank === '8');
    });
    if (lowCards.length > 0) return lowCards[0];

    // Fallback: lowest order card
    return [...playable].sort((a, b) => (CARD_MANIFEST[a]?.order || 0) - (CARD_MANIFEST[b]?.order || 0))[0];
  }

  // Case 2: Player is following or responding to trick
  const leadCard = CARD_MANIFEST[leadCardId];
  const canFollowSuit = leadCard && playable.some((id) => CARD_MANIFEST[id]?.suit === leadCard.suit);

  // Find who is currently winning the trick
  let currentWinningCard = leadCard;
  let currentWinningPlayer = currentTrickCards[0].playerIndex;
  let trumpPlayed = isTrumpRevealed && trumpSuit && leadCard.suit === trumpSuit;

  for (let i = 1; i < currentTrickCards.length; i++) {
    const pc = currentTrickCards[i];
    const c = CARD_MANIFEST[pc.cardId];
    if (!c) continue;

    const isThisTrump = Boolean(isTrumpRevealed && trumpSuit && c.suit === trumpSuit);
    if (isThisTrump) {
      if (!trumpPlayed || c.order > currentWinningCard.order) {
        trumpPlayed = true;
        currentWinningCard = c;
        currentWinningPlayer = pc.playerIndex;
      }
    } else if (!trumpPlayed && c.suit === leadCard.suit && c.order > currentWinningCard.order) {
      currentWinningCard = c;
      currentWinningPlayer = pc.playerIndex;
    }
  }

  const partnerPosition: PlayerPosition = ((myPosition + 2) % 4) as PlayerPosition;
  const isPartnerWinning = currentWinningPlayer === partnerPosition;

  if (isPartnerWinning) {
    // Partner is winning:
    // If partner has high winning card (J or A) and this is last play, throw points (10 or 9 or A)!
    if (currentTrickCards.length === 3 && (currentWinningCard.rank === 'J' || currentWinningCard.rank === '9')) {
      const highPointCards = playable.filter((id) => {
        const c = CARD_MANIFEST[id];
        return c && c.points > 0 && c.rank !== 'J';
      });
      if (highPointCards.length > 0) {
        return highPointCards[0];
      }
    }

    // Otherwise, play lowest card in suit to preserve high cards
    return [...playable].sort((a, b) => (CARD_MANIFEST[a]?.order || 0) - (CARD_MANIFEST[b]?.order || 0))[0];
  }

  // Opponent is winning:
  // Try to play the lowest card that can beat the current winning card
  const winningOptions = playable.filter((id) => {
    const c = CARD_MANIFEST[id];
    if (!c) return false;

    if (trumpPlayed) {
      // Must beat winning trump with higher trump
      return Boolean(isTrumpRevealed && trumpSuit && c.suit === trumpSuit && c.order > currentWinningCard.order);
    } else {
      // If we can cut with trump
      if (isTrumpRevealed && trumpSuit && c.suit === trumpSuit) return true;
      // Or beat with higher lead suit
      return c.suit === leadCard.suit && c.order > currentWinningCard.order;
    }
  });

  if (winningOptions.length > 0) {
    // Pick the lowest winning card (don't waste a Jack if a 9 or Ace wins)
    return winningOptions.sort((a, b) => (CARD_MANIFEST[a]?.order || 0) - (CARD_MANIFEST[b]?.order || 0))[0];
  }

  // Cannot beat it: discard lowest value/rank card
  return [...playable].sort((a, b) => {
    const ca = CARD_MANIFEST[a];
    const cb = CARD_MANIFEST[b];
    // Prefer discarding 0-point cards first
    if ((ca?.points || 0) !== (cb?.points || 0)) {
      return (ca?.points || 0) - (cb?.points || 0);
    }
    return (ca?.order || 0) - (cb?.order || 0);
  })[0];
};
