import { BidEntry, GameRulesConfig, PlayerPosition } from './types';
import { getBiddingOrder } from './biddingOrder';

export interface BiddingStatus {
  isComplete: boolean;
  highestBid: number;
  highestBidder: PlayerPosition | null;
  nextTurn: PlayerPosition;
  biddingTurnIndex: number;
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
      return { 
        legal: false, 
        reason: 'Dealer is required to make the minimum opening bid (16) when the first three players pass' 
      };
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
 * Evaluate single-round bidding history.
 * Bidding travels around the table exactly once:
 * Dealer's left -> Next -> Next -> Dealer (4 turns total).
 */
export const evaluateBiddingState = (
  bids: BidEntry[],
  dealerIndex: PlayerPosition,
  rules: GameRulesConfig
): BiddingStatus => {
  const order = getBiddingOrder(dealerIndex);
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

  const turnIndex = bids.length;

  // Single-round complete: all 4 scheduled turns executed
  if (turnIndex >= 4) {
    // If all 4 players passed without a bid
    if (highestBid === 0) {
      if (rules.forcedDealerBid) {
        return {
          isComplete: true,
          highestBid: rules.minBid,
          highestBidder: dealerIndex,
          nextTurn: dealerIndex,
          biddingTurnIndex: 4,
          passedPlayers,
        };
      } else {
        return {
          isComplete: true,
          highestBid: 0,
          highestBidder: null,
          nextTurn: order[0],
          biddingTurnIndex: 4,
          passedPlayers,
        };
      }
    }

    return {
      isComplete: true,
      highestBid,
      highestBidder,
      nextTurn: highestBidder ?? dealerIndex,
      biddingTurnIndex: 4,
      passedPlayers,
    };
  }

  // Next player in single-round sequence
  const nextPlayer = order[turnIndex];

  return {
    isComplete: false,
    highestBid,
    highestBidder,
    nextTurn: nextPlayer,
    biddingTurnIndex: turnIndex,
    passedPlayers,
  };
};
