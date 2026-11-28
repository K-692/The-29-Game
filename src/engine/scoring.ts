import { CARD_MANIFEST, Suit } from '../assets/cardManifest';
import { CompletedTrick, GameRulesConfig, PairDeclaration, PlayerPosition, RoundSummary, Team } from './types';

/**
 * Calculates points collected by each individual player across completed tricks in current deal.
 */
export const calculatePlayerPoints = (completedTricks: CompletedTrick[]): Record<PlayerPosition, number> => {
  const points: Record<PlayerPosition, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const trick of completedTricks) {
    if (points[trick.winner] !== undefined) {
      points[trick.winner] += trick.points;
    }
  }
  return points;
};

/**
 * Checks if a player holds both King and Queen of the trump suit
 */
export const hasRoyalsPair = (handCardIds: string[], trumpSuit: Suit): boolean => {
  const kingId = `K_${trumpSuit}`;
  const queenId = `Q_${trumpSuit}`;
  return handCardIds.includes(kingId) && handCardIds.includes(queenId);
};

/** Pair / Royals only changes the target when the contract bid is at least this high. */
export const PAIR_MIN_CONTRACT_BID = 19;

/**
 * Detects King-Queen Pair in any player's hand after trump has been revealed.
 * Applies strictly when original contract bid >= 19 and trump is a normal suit (not Joker).
 * Bidding team pair: reduces target by 4 (min 16).
 * Defending team pair: increases target by 4 (max 29).
 */
export const detectKingQueenPair = (
  hands: Record<PlayerPosition, string[]>,
  trumpSuit: Suit | null,
  isTrumpRevealed: boolean,
  contractBid: number,
  highestBidder: PlayerPosition | null,
  currentTrickNumber: number = 1
): PairDeclaration | null => {
  if (!isTrumpRevealed || !trumpSuit || contractBid < PAIR_MIN_CONTRACT_BID || highestBidder === null) {
    return null;
  }

  const kingId = `K_${trumpSuit}`;
  const queenId = `Q_${trumpSuit}`;
  const biddingTeam: Team = (highestBidder === 0 || highestBidder === 2) ? 0 : 1;

  for (let p = 0; p < 4; p++) {
    const pos = p as PlayerPosition;
    const hand = hands[pos] || [];
    if (hand.includes(kingId) && hand.includes(queenId)) {
      const playerTeam: Team = (pos === 0 || pos === 2) ? 0 : 1;
      let adjustedTarget: number;
      let adjustment: number;
      if (playerTeam === biddingTeam) {
        // Bidding team pair: reduce target by 4, min 16
        adjustedTarget = Math.max(16, contractBid - 4);
        adjustment = -4;
      } else {
        // Defending team pair: increase target by 4, max 29
        adjustedTarget = Math.min(29, contractBid + 4);
        adjustment = 4;
      }
      return {
        playerIndex: pos,
        team: playerTeam,
        suit: trumpSuit,
        originalBid: contractBid,
        adjustedTarget,
        adjustment,
        declaredAtTrick: currentTrickNumber,
        kingCardId: kingId,
        queenCardId: queenId,
        announced: false,
      };
    }
  }
  return null;
};

/**
 * Validates whether a player can legally declare a Pair/Royals
 */
export const canDeclarePair = (
  handCardIds: string[],
  playerIndex: PlayerPosition,
  trumpSuit: Suit | null,
  isTrumpRevealed: boolean,
  completedTricks: CompletedTrick[],
  existingPairDeclaration: PairDeclaration | null
): { canDeclare: boolean; reason?: string } => {
  if (existingPairDeclaration) {
    return { canDeclare: false, reason: 'Pair has already been declared in this round' };
  }

  if (!trumpSuit || !isTrumpRevealed) {
    return { canDeclare: false, reason: 'Trump must be revealed before declaring Pair' };
  }

  if (!hasRoyalsPair(handCardIds, trumpSuit)) {
    return { canDeclare: false, reason: 'Player does not hold both King and Queen of Trump' };
  }

  const playerTeam: Team = (playerIndex === 0 || playerIndex === 2) ? 0 : 1;

  // Player or their team must have won at least one trick to declare pair
  const teamWonTrick = completedTricks.some((trick) => trick.winningTeam === playerTeam);
  if (!teamWonTrick) {
    return { canDeclare: false, reason: 'Team must have won at least one trick before declaring Pair' };
  }

  return { canDeclare: true };
};

export interface RoundScoringResult {
  team0CardPoints: number;
  team1CardPoints: number;
  team0WonLastTrick: boolean;
  team1WonLastTrick: boolean;
  biddingTeamWon: boolean;
  adjustedTarget: number;
  gamePointsDelta: { team0: number; team1: number };
  /** One side took every point of the deal (scored double). */
  sweep: 'BIDDING' | 'DEFENDING' | null;
  newMatchScore: { team0: number; team1: number };
  isMatchOver: boolean;
  winnerTeam: Team | null;
}

/**
 * Evaluates the full deal result, card points, contract fulfillment, and match score delta
 */
export const evaluateRoundScore = (
  completedTricks: CompletedTrick[],
  bidder: PlayerPosition,
  contractBid: number,
  rules: GameRulesConfig,
  currentMatchScore: { team0: number; team1: number },
  pairDeclaration: PairDeclaration | null,
  dealMultiplier: 1 | 2 | 4 = 1
): RoundScoringResult => {
  const biddingTeam: Team = (bidder === 0 || bidder === 2) ? 0 : 1;
  const defendingTeam: Team = biddingTeam === 0 ? 1 : 0;

  let team0CardPoints = 0;
  let team1CardPoints = 0;

  for (const trick of completedTricks) {
    if (trick.winningTeam === 0) {
      team0CardPoints += trick.points;
    } else {
      team1CardPoints += trick.points;
    }
  }

  const lastTrick = completedTricks[completedTricks.length - 1];
  const team0WonLastTrick = lastTrick ? lastTrick.winningTeam === 0 : false;
  const team1WonLastTrick = lastTrick ? lastTrick.winningTeam === 1 : false;

  // Apply Pair / Royals adjustment to contract target
  let adjustedTarget = contractBid;
  if (pairDeclaration) {
    adjustedTarget = pairDeclaration.adjustedTarget;
  }

  const biddingTeamPoints = biddingTeam === 0 ? team0CardPoints : team1CardPoints;
  const biddingTeamWon = biddingTeamPoints >= adjustedTarget;

  // Sweep: one side takes every point of the deal → the deal counts double
  // (+2 if the bidding side took everything, −2 if the defenders did),
  // further multiplied by Double (2×) / Re-double (4×).
  const defendingTeamPoints = biddingTeam === 0 ? team1CardPoints : team0CardPoints;
  const sweep: RoundScoringResult['sweep'] =
    completedTricks.length === 8 && defendingTeamPoints === 0
      ? 'BIDDING'
      : completedTricks.length === 8 && biddingTeamPoints === 0
      ? 'DEFENDING'
      : null;

  // Game points: 1 per deal, 2 for a sweep, times the Double / Re-double multiplier.
  const pointMagnitude = (sweep ? 2 : 1) * dealMultiplier;

  const gamePointsDelta = { team0: 0, team1: 0 };

  if (biddingTeamWon) {
    // Bidding team successfully fulfills contract: gains +pointMagnitude
    if (biddingTeam === 0) {
      gamePointsDelta.team0 = pointMagnitude;
    } else {
      gamePointsDelta.team1 = pointMagnitude;
    }
  } else {
    // Bidding team failed contract: loses -pointMagnitude
    if (biddingTeam === 0) {
      gamePointsDelta.team0 = -pointMagnitude;
    } else {
      gamePointsDelta.team1 = -pointMagnitude;
    }
  }

  const newMatchScore = {
    team0: currentMatchScore.team0 + gamePointsDelta.team0,
    team1: currentMatchScore.team1 + gamePointsDelta.team1,
  };

  // Check match end conditions (+6 to win, -6 to lose)
  const target = rules.targetGameScore;
  let isMatchOver = false;
  let winnerTeam: Team | null = null;

  if (newMatchScore.team0 >= target || newMatchScore.team1 <= -target) {
    isMatchOver = true;
    winnerTeam = 0;
  } else if (newMatchScore.team1 >= target || newMatchScore.team0 <= -target) {
    isMatchOver = true;
    winnerTeam = 1;
  }

  return {
    team0CardPoints,
    team1CardPoints,
    team0WonLastTrick,
    team1WonLastTrick,
    biddingTeamWon,
    adjustedTarget,
    gamePointsDelta,
    sweep,
    newMatchScore,
    isMatchOver,
    winnerTeam,
  };
};

