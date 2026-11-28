import { BidEntry, GameRulesConfig, PlayerPosition } from './types';
import { getBiddingOrder } from './biddingOrder';

export interface BiddingStatus {
  isComplete: boolean;
  highestBid: number;
  highestBidder: PlayerPosition | null;
  nextTurn: PlayerPosition;
  biddingTurnIndex: number;
  passedPlayers: Set<PlayerPosition>;
  /** The two players currently bidding against each other (challenger null when nobody is left to challenge). */
  duel: { holder: PlayerPosition; challenger: PlayerPosition | null };
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
 * Evaluate a head-to-head auction (traditional 29).
 *
 * Bidding goes in pairs, starting with the dealer's left (A) against the next
 * player (B). They take turns raising until one passes. The survivor then
 * faces C, and the survivor of that faces D. A player who passes is out for
 * the rest of the deal. The last survivor wins at the highest bid.
 *
 * Who speaks first: A opens the first pair. When a new challenger joins, the
 * challenger speaks first (they must beat the current bid) — unless nobody has
 * bid yet, in which case the surviving player speaks first.
 * If A, B and C all pass without a bid, D must open (forced opening rule).
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

  let holder: PlayerPosition = order[0];
  let challenger: PlayerPosition | null = order[1];
  let nextIdx = 2;
  let turn: PlayerPosition | null = order[0];

  for (const entry of bids) {
    const p = entry.playerIndex;
    if (entry.bid === 'PASS') {
      passedPlayers.add(p);
      if (p === holder && challenger !== null) {
        holder = challenger; // challenger survives
      }
      // Bring in the next challenger, if any.
      challenger = nextIdx < 4 ? order[nextIdx++] : null;
      if (challenger !== null) {
        turn = highestBid > 0 ? challenger : holder;
      } else {
        turn = passedPlayers.has(holder) ? null : holder;
      }
    } else {
      highestBid = entry.bid;
      highestBidder = p;
      // The other player in the pair must answer.
      turn = p === holder ? challenger : holder;
    }
  }

  void rules;
  const duel = { holder, challenger };

  // Everyone passed (only possible without the forced opening): redeal.
  if (passedPlayers.size === 4) {
    return { isComplete: true, highestBid: 0, highestBidder: null, nextTurn: order[0], biddingTurnIndex: bids.length, passedPlayers, duel };
  }

  // Nobody left to challenge and the survivor holds the bid: they win.
  if (challenger === null && highestBidder !== null && highestBidder === holder) {
    return { isComplete: true, highestBid, highestBidder, nextTurn: highestBidder, biddingTurnIndex: bids.length, passedPlayers, duel };
  }

  return {
    isComplete: false,
    highestBid,
    highestBidder,
    nextTurn: turn ?? holder,
    biddingTurnIndex: bids.length,
    passedPlayers,
    duel,
  };
};
