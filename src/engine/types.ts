import { Suit, Rank, CardIdentity } from '../assets/cardManifest';

export type PlayerPosition = 0 | 1 | 2 | 3;
export type Team = 0 | 1; // Team 0 = Players 0 & 2; Team 1 = Players 1 & 3

export type GamePhase = 
  | 'WAITING_LOBBY'
  | 'DEALING_FIRST'
  | 'BIDDING'
  | 'TRUMP_SELECTION'
  | 'DEALING_SECOND'
  | 'TRICK_PLAY'
  | 'ROUND_ENDED'
  | 'MATCH_ENDED';

export interface GameRulesConfig {
  minBid: number; // default 16
  maxBid: number; // default 28 (or 29 with last trick)
  lastTrickBonus: boolean; // default true (1 point for 8th trick)
  forcedDealerBid: boolean; // default true (dealer forced to bid min if all pass)
  doubleScoreForHighBid: boolean; // default true (bids >= 21 award/penalize 2 game points)
  pairRoyalAdjustment: number; // default 4 points
  targetGameScore: number; // default 6 (first to +6 wins, -6 loses)
  allowTrumpRevealOnNoLeadSuit: boolean; // default true
}

export const DEFAULT_RULES_CONFIG: GameRulesConfig = {
  minBid: 16,
  maxBid: 29,
  lastTrickBonus: true,
  forcedDealerBid: true,
  doubleScoreForHighBid: true,
  pairRoyalAdjustment: 4,
  targetGameScore: 6,
  allowTrumpRevealOnNoLeadSuit: true,
};

export interface PlayerInfo {
  id: string;
  name: string;
  position: PlayerPosition;
  team: Team;
  isHost: boolean;
  isCpu: boolean;
  isReady: boolean;
  connected: boolean;
  avatarSeed?: string;
}

export interface BidEntry {
  playerIndex: PlayerPosition;
  bid: number | 'PASS';
  timestamp: number;
}

export interface PlayedCard {
  cardId: string;
  playerIndex: PlayerPosition;
}

export interface CompletedTrick {
  trickNumber: number; // 1 to 8
  leadPlayer: PlayerPosition;
  cards: PlayedCard[];
  winner: PlayerPosition;
  winningTeam: Team;
  points: number;
  leadSuit: Suit;
}

export interface PairDeclaration {
  playerIndex: PlayerPosition;
  team: Team;
  suit: Suit; // Must be trump suit
  adjustment: number; // -4 for bidding team, +4 for defending team
  declaredAtTrick: number;
}

export interface RoundSummary {
  roundNumber: number;
  bidder: PlayerPosition;
  biddingTeam: Team;
  contractBid: number;
  adjustedTarget: number;
  trumpSuit: Suit;
  trumpRevealedBy?: PlayerPosition;
  trumpRevealedAtTrick?: number;
  team0CardPoints: number;
  team1CardPoints: number;
  team0WonLastTrick: boolean;
  team1WonLastTrick: boolean;
  biddingTeamWon: boolean;
  pairDeclared?: PairDeclaration;
  gamePointsDelta: { team0: number; team1: number };
  matchScore: { team0: number; team1: number };
}

export type TrumpMode = 'suit' | 'no-trump' | 'seventh-card';

export type TrumpSelectionChoice = 
  | 'HEARTS' 
  | 'SPADES' 
  | 'CLUBS' 
  | 'DIAMONDS' 
  | 'NO_TRUMP' 
  | 'SEVENTH_CARD';

export interface SeventhCardInfo {
  cardId: string;
  owner: PlayerPosition;
  isRevealed: boolean;
}

export interface GameState {
  id: string;
  roomCode: string;
  phase: GamePhase;
  rules: GameRulesConfig;
  players: PlayerInfo[];
  dealerIndex: PlayerPosition;
  currentTurn: PlayerPosition;
  
  // Bidding state (Strictly one round of 4 turns)
  biddingOrder: PlayerPosition[];
  biddingTurnIndex: number; // 0 to 4 (4 = complete)
  bids: BidEntry[];
  highestBid: number;
  highestBidder: PlayerPosition | null;
  consecutivePasses: number;
  
  // Trump state (6 options: 4 suits, no-trump/joker, 7th card)
  trumpMode: TrumpMode;
  trumpSuit: Suit | null;
  isTrumpRevealed: boolean;
  trumpRevealedBy: PlayerPosition | null;
  trumpRevealedAtTrick: number | null;
  seventhCard: SeventhCardInfo | null;
  
  // Player cards: private hands indexed by position
  hands: Record<PlayerPosition, string[]>; // string[] of card IDs (e.g. 'J_DIAMONDS')
  
  // Trick state
  currentTrickNumber: number; // 1 to 8
  currentTrickLead: PlayerPosition;
  currentTrickCards: PlayedCard[];
  completedTricks: CompletedTrick[];
  
  // Pair declaration
  pairDeclaration: PairDeclaration | null;
  
  // Match scores
  roundNumber: number;
  matchScore: { team0: number; team1: number };
  roundHistory: RoundSummary[];
  
  // Winner if match ended
  winnerTeam: Team | null;
  
  // Metadata & version for sync
  version: number;
  lastActionTimestamp: number;
}

/**
 * Public/Sanitized Game State that can be safely transmitted to a player.
 * Conceals private hands of other players, concealed trump suit, and unrevealed 7th card.
 */
export interface PublicGameState extends Omit<GameState, 'hands' | 'trumpSuit' | 'seventhCard'> {
  myPosition: PlayerPosition | null;
  myHand: string[];
  otherHandCounts: Record<PlayerPosition, number>;
  // Concealed trump is null unless revealed or the player is the bidder
  revealedTrumpSuit: Suit | null;
  isTrumpConcealed: boolean;
  // 7th card trump visibility: visible to bidder only before reveal; visible to all after reveal
  revealedSeventhCard: string | null;
  hasSeventhCardReserved: boolean;
}

