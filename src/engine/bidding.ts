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
        reason: 'Everyone else passed — you must open the bidding' 
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
 * True when `pos` is the only player who hasn't passed and nobody has bid yet:
 * with the forced-opening rule they must open at the minimum bid.
 */
export const isForcedOpening = (bids: BidEntry[], pos: PlayerPosition, rules: GameRulesConfig): boolean => {
  if (!rules.forcedDealerBid) return false;
  if (bids.some((b) => b.bid !== 'PASS')) return false;
  const passed = new Set(bids.filter((b) => b.bid === 'PASS').map((b) => b.playerIndex));
  return passed.size === 3 && !passed.has(pos);
};

/**
 * Evaluate an open auction.
 * Bidding goes clockwise from the dealer's left. On each turn a player raises
 * or passes; a player who passes is out of the auction. Turns keep going round
 * among the players still in until only the high bidder is left.
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

  const active = order.filter((p) => !passedPlayers.has(p));
  void rules;

  // Everyone passed without a bid (only possible without the forced opening): redeal.
  if (active.length === 0) {
    return { isComplete: true, highestBid: 0, highestBidder: null, nextTurn: order[0], biddingTurnIndex: bids.length, passedPlayers };
  }

  // Only the high bidder is left: they win the auction.
  if (active.length === 1 && highestBidder !== null && active[0] === highestBidder) {
    return { isComplete: true, highestBid, highestBidder, nextTurn: highestBidder, biddingTurnIndex: bids.length, passedPlayers };
  }

  // Next player clockwise (from the last caller) who is still in the auction.
  let nextTurn = order[0];
  if (bids.length > 0) {
    const last = bids[bids.length - 1].playerIndex;
    for (let step = 1; step <= 4; step++) {
      const candidate = ((last + step) % 4) as PlayerPosition;
      if (!passedPlayers.has(candidate)) {
        nextTurn = candidate;
        break;
      }
    }
  }

  return { isComplete: false, highestBid, highestBidder, nextTurn, biddingTurnIndex: bids.length, passedPlayers };
};
