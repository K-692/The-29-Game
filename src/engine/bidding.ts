import { BidEntry, GameRulesConfig, PlayerPosition } from './types';

export interface BiddingStatus {
  isComplete: boolean;
  highestBid: number;
  highestBidder: PlayerPosition | null;
  nextTurn: PlayerPosition;
  passedPlayers: Set<PlayerPosition>;
}

/**
 * Validates whether a proposed bid is legal given current bidding state
 */
export const isLegalBid = (
  bid: number | 'PASS',
  currentHighestBid: number,
  rules: GameRulesConfig,
  isForcedDealerBid: boolean = false
): { legal: boolean; reason?: string } => {
  if (bid === 'PASS') {
    if (isForcedDealerBid) {
      return { legal: false, reason: 'Dealer is forced to bid minimum when all players pass' };
    }
    return { legal: true };
  }

  if (typeof bid !== 'number' || !Number.isInteger(bid)) {
    return { legal: false, reason: 'Bid must be an integer' };
  }

  const minBid = rules.minBid;
  const maxBid = rules.lastTrickBonus ? 29 : rules.maxBid;

  if (bid < minBid) {
    return { legal: false, reason: `Bid must be at least ${minBid}` };
  }

  if (bid > maxBid) {
    return { legal: false, reason: `Bid cannot exceed ${maxBid}` };
  }

  if (currentHighestBid > 0 && bid <= currentHighestBid) {
    return { legal: false, reason: `Bid must be strictly higher than current bid of ${currentHighestBid}` };
  }

  return { legal: true };
};

/**
 * Returns the list of legal bid numbers a player can choose
 */
export const getLegalBidOptions = (
  currentHighestBid: number,
  rules: GameRulesConfig
): number[] => {
  const min = Math.max(rules.minBid, currentHighestBid + 1);
  const max = rules.lastTrickBonus ? 29 : rules.maxBid;
  const options: number[] = [];
  for (let b = min; b <= max; b++) {
    options.push(b);
  }
  return options;
};

/**
 * Evaluate bidding history to determine current state, next player, or if bidding has concluded
 */
export const evaluateBiddingState = (
  bids: BidEntry[],
  dealerIndex: PlayerPosition,
  rules: GameRulesConfig
): BiddingStatus => {
  const passedPlayers = new Set<PlayerPosition>();
  let highestBid = 0;
  let highestBidder: PlayerPosition | null = null;

  for (const entry of bids) {
    if (entry.bid === 'PASS') {
      passedPlayers.add(entry.playerIndex);
    } else {
      highestBid = entry.bid;
      highestBidder = entry.playerIndex;
    }
  }

  // All 4 players passed without any bid
  if (passedPlayers.size === 4 && highestBid === 0) {
    if (rules.forcedDealerBid) {
      // Dealer is assigned minimum bid
      return {
        isComplete: true,
        highestBid: rules.minBid,
        highestBidder: dealerIndex,
        nextTurn: dealerIndex,
        passedPlayers,
      };
    } else {
      // Re-deal required (if forcedDealerBid is disabled)
      return {
        isComplete: true,
        highestBid: 0,
        highestBidder: null,
        nextTurn: (dealerIndex + 1) % 4 as PlayerPosition,
        passedPlayers,
      };
    }
  }

  // If there is an active highest bidder and the other 3 players have passed, bidding is complete
  if (highestBidder !== null && passedPlayers.size === 3 && !passedPlayers.has(highestBidder)) {
    return {
      isComplete: true,
      highestBid,
      highestBidder,
      nextTurn: highestBidder,
      passedPlayers,
    };
  }

  // Calculate next turn (clockwise to the next player who has not passed)
  const lastPlayer = bids.length > 0 ? bids[bids.length - 1].playerIndex : dealerIndex;
  let next = ((lastPlayer + 1) % 4) as PlayerPosition;
  while (passedPlayers.has(next)) {
    next = ((next + 1) % 4) as PlayerPosition;
  }

  return {
    isComplete: false,
    highestBid,
    highestBidder,
    nextTurn: next,
    passedPlayers,
  };
};

