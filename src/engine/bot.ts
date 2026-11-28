import { CARD_MANIFEST, CardIdentity, Suit, SUITS } from '../assets/cardManifest';
import { canDeclarePair, hasRoyalsPair } from './scoring';
import { getPlayableCards } from './tricks';
import { CompletedTrick, GameRulesConfig, PairDeclaration, PlayedCard, PlayerPosition, Team, TrumpMode, TrumpSelectionChoice } from './types';

/**
 * Heuristic evaluation of a 4-card hand for initial bidding
 */
export const evaluateHandForBid = (handCardIds: string[]): { maxBid: number; preferredSuit: Suit } => {
  const suitCounts: Record<Suit, number> = { DIAMONDS: 0, HEARTS: 0, CLUBS: 0, SPADES: 0 };
  const suitPoints: Record<Suit, number> = { DIAMONDS: 0, HEARTS: 0, CLUBS: 0, SPADES: 0 };

  let totalCardPoints = 0;

  for (const id of handCardIds) {
    const card = CARD_MANIFEST[id];
    if (!card) continue;
    suitCounts[card.suit]++;
    suitPoints[card.suit] += card.points;
    totalCardPoints += card.points;
  }

  // Determine preferred trump suit (highest count, then highest points)
  let preferredSuit: Suit = 'SPADES';
  let bestScore = -1;

  for (const suit of SUITS) {
    const count = suitCounts[suit];
    const points = suitPoints[suit];
    const score = count * 3 + points * 2;
    if (score > bestScore) {
      bestScore = score;
      preferredSuit = suit;
    }
  }

  // Baseline estimate:
  // In 29, standard hands bid 16-17 with 1 Jack or good suit.
  // With Jack + 9 or two Jacks, can bid 18-20.
  // With strong suit (3+ cards, J, 9), can bid 20-22.
  let calculatedMaxBid = 15;
  if (totalCardPoints >= 3 && suitCounts[preferredSuit] >= 2) {
    calculatedMaxBid = 16;
  }
  if (totalCardPoints >= 4 && suitCounts[preferredSuit] >= 2) {
    calculatedMaxBid = 17;
  }
  if (totalCardPoints >= 5 && suitCounts[preferredSuit] >= 3) {
    calculatedMaxBid = 19;
  }
  if (totalCardPoints >= 6 && suitCounts[preferredSuit] >= 3) {
    calculatedMaxBid = 21;
  }

  return { maxBid: calculatedMaxBid, preferredSuit };
};

/**
 * Determine Bot's bidding decision
 */
export const getBotBidDecision = (
  handCardIds: string[],
  currentHighestBid: number,
  rules: GameRulesConfig,
  isForcedDealer: boolean,
  partnerHoldsBid: boolean = false
): number | 'PASS' => {
  if (isForcedDealer) {
    return rules.minBid;
  }

  const { maxBid } = evaluateHandForBid(handCardIds);
  const nextRequiredBid = Math.max(rules.minBid, currentHighestBid + 1);

  // Don't outbid your own partner unless the hand is clearly stronger.
  const ceiling = partnerHoldsBid ? maxBid - 2 : maxBid;
  if (nextRequiredBid <= ceiling) {
    return nextRequiredBid;
  }

  return 'PASS';
};

/**
 * Determine Bot's trump choice among 6 options:
 * Hearts, Spades, Clubs, Diamonds, Joker (No Trump), 7th Card
 */
export const getBotTrumpSelection = (handCardIds: string[]): TrumpSelectionChoice => {
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
 * Determine whether Bot should request to reveal trump
 */
export const shouldBotRequestTrumpReveal = (
  handCardIds: string[],
  leadCardId: string | null,
  trumpSuit: Suit | null,
  isTrumpRevealed: boolean,
  currentTrickCards: PlayedCard[],
  myPosition: PlayerPosition
): boolean => {
  if (isTrumpRevealed || !trumpSuit || !leadCardId) {
    return false;
  }

  const leadCard = CARD_MANIFEST[leadCardId];
  if (!leadCard) return false;

  // Check if bot can follow suit
  const canFollow = handCardIds.some((id) => {
    const card = CARD_MANIFEST[id];
    return card && card.suit === leadCard.suit;
  });

  if (canFollow) {
    // Must follow suit, cannot reveal trump
    return false;
  }

  // Cannot follow suit: check if bot holds any trump cards in hand
  const trumpsInHand = handCardIds.filter((id) => {
    const card = CARD_MANIFEST[id];
    return card && card.suit === trumpSuit;
  });

  if (trumpsInHand.length === 0) {
    // No trump cards, no reason to reveal trump yet
    return false;
  }

  // Check if opponents are currently winning or if trick has valuable points
  const myTeam: Team = (myPosition === 0 || myPosition === 2) ? 0 : 1;
  const trickPoints = currentTrickCards.reduce((sum, pc) => {
    const c = CARD_MANIFEST[pc.cardId];
    return sum + (c ? c.points : 0);
  }, 0);

  // If there are points in the trick (or >= 1 pt) and we have trump, reveal to win trick!
  return trickPoints >= 1 || currentTrickCards.length >= 2;
};

/**
 * Determine Bot's optimal legal card to play
 */
export const getBotCardPlay = (
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

  // Case 1: Bot is leading the trick
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

  // Case 2: Bot is following or responding to trick
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

/**
 * Check if Bot should declare Pair/Royals
 */
export const checkBotPairDeclaration = (
  handCardIds: string[],
  playerIndex: PlayerPosition,
  trumpSuit: Suit | null,
  isTrumpRevealed: boolean,
  completedTricks: CompletedTrick[],
  existingPairDeclaration: PairDeclaration | null
): boolean => {
  const { canDeclare } = canDeclarePair(
    handCardIds,
    playerIndex,
    trumpSuit,
    isTrumpRevealed,
    completedTricks,
    existingPairDeclaration
  );
  return canDeclare;
};

/**
 * Determines whether a Defending bot should DOUBLE the contract.
 * Heuristic: Evaluates defensive high-point cards and high contract bids.
 */
export const getBotDoubleDecision = (
  handCardIds: string[],
  contractBid: number
): boolean => {
  let totalPoints = 0;
  let jackCount = 0;
  let nineCount = 0;

  for (const id of handCardIds) {
    const card = CARD_MANIFEST[id];
    if (!card) continue;
    totalPoints += card.points;
    if (card.rank === 'J') jackCount++;
    if (card.rank === '9') nineCount++;
  }

  // Double if opponents bid very aggressively (>=24) and bot has at least 3 points,
  // or if bid >= 21 and bot holds 2+ high honor cards (Jacks/9s) or >= 6 points.
  if (contractBid >= 24 && totalPoints >= 3) {
    return true;
  }
  if (contractBid >= 21 && (jackCount + nineCount >= 2 || totalPoints >= 6)) {
    return true;
  }

  return false;
};

/**
 * Determines whether a Bidding bot should RE-DOUBLE the contract.
 * Heuristic: Evaluates offensive power and low/confident bids.
 */
export const getBotRedoubleDecision = (
  handCardIds: string[],
  contractBid: number,
  trumpSuit: Suit | null
): boolean => {
  let totalPoints = 0;
  let trumpHonorCount = 0;

  for (const id of handCardIds) {
    const card = CARD_MANIFEST[id];
    if (!card) continue;
    totalPoints += card.points;
    if (trumpSuit && card.suit === trumpSuit && (card.rank === 'J' || card.rank === '9' || card.rank === 'A')) {
      trumpHonorCount++;
    }
  }

  // Re-double if bidder holds multiple trump honors or strong overall 4-card points (>=6)
  if (trumpHonorCount >= 2 || totalPoints >= 6) {
    return true;
  }
  // If bid was a modest 16-17 and hand has >= 5 points, confident to re-double
  if (contractBid <= 17 && totalPoints >= 5) {
    return true;
  }

  return false;
};

