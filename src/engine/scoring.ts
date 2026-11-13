import { CARD_MANIFEST, Suit } from '../assets/cardManifest';
import { CompletedTrick, GameRulesConfig, PairDeclaration, PlayerPosition, RoundSummary, Team } from './types';

/**
 * Checks if a player holds both King and Queen of the trump suit
 */
export const hasRoyalsPair = (handCardIds: string[], trumpSuit: Suit): boolean => {
  const kingId = `K_${trumpSuit}`;
  const queenId = `Q_${trumpSuit}`;
  return handCardIds.includes(kingId) && handCardIds.includes(queenId);
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
  pairDeclaration: PairDeclaration | null
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
    if (pairDeclaration.team === biddingTeam) {
      // Bidding team declaration reduces target
      adjustedTarget = Math.max(12, contractBid - rules.pairRoyalAdjustment);
    } else {
      // Defending team declaration increases target
      adjustedTarget = Math.min(29, contractBid + rules.pairRoyalAdjustment);
    }
  }

  const biddingTeamPoints = biddingTeam === 0 ? team0CardPoints : team1CardPoints;
  const biddingTeamWon = biddingTeamPoints >= adjustedTarget;

  // Calculate game points magnitude
  // Standard Indian 29: Bid >= 21 awards/penalizes 2 game points if doubleScoreForHighBid is on
  const isHighBid = rules.doubleScoreForHighBid && contractBid >= 21;
  const pointMagnitude = isHighBid ? 2 : 1;

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
    newMatchScore,
    isMatchOver,
    winnerTeam,
  };
};
