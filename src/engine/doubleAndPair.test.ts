import { describe, it, expect } from 'vitest';
import { 
  createInitialGame, 
  startNewRound, 
  applyBid, 
  applyTrumpSelection, 
  applyDoubleDecision, 
  applyRedoubleDecision, 
  applyTrumpAnnouncementComplete,
  applyTrumpReveal,
  completeTrickTransition 
} from './gameManager';
import { detectKingQueenPair, evaluateRoundScore } from './scoring';
import { DEFAULT_RULES_CONFIG, PlayerInfo, PlayerPosition } from './types';
import { CARD_MANIFEST } from '../assets/cardManifest';

const dummyPlayers: PlayerInfo[] = [
  { id: 'p0', name: 'Player 1', avatar: '🦊', position: 0, team: 0, isHost: true, isReady: true, connected: true },
  { id: 'p1', name: 'Player 2', avatar: '🐼', position: 1, team: 1, isHost: false, isReady: true, connected: true },
  { id: 'p2', name: 'Player 3', avatar: '🐯', position: 2, team: 0, isHost: false, isReady: true, connected: true },
  { id: 'p3', name: 'Player 4', avatar: '🐸', position: 3, team: 1, isHost: false, isReady: true, connected: true },
];

describe('Double & Re-Double Engine Mechanics', () => {
  it('should transition to DOUBLE_DECISION after suit trump selection', () => {
    let state = createInitialGame('DOUBLE_TEST', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    expect(state.phase).toBe('TRUMP_SELECTION');
    expect(state.highestBidder).toBe(1); // Team 1

    const trumpRes = applyTrumpSelection(state, 1, 'SPADES');
    expect(trumpRes.success).toBe(true);
    expect(trumpRes.state.phase).toBe('DOUBLE_DECISION');
    expect(trumpRes.state.dealMultiplier).toBe(1);
    expect(trumpRes.state.doubleStatus).toBe('NONE');
  });

  it('should allow defending team to DOUBLE and advance to REDOUBLE_DECISION (2x)', () => {
    let state = createInitialGame('DOUBLE_TEST_2', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state; // Team 1 won bid
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    state = applyTrumpSelection(state, 1, 'SPADES').state;

    // Bidding team (P1) cannot Double
    const invalidDouble = applyDoubleDecision(state, 1, 'DOUBLE');
    expect(invalidDouble.success).toBe(false);
    expect(invalidDouble.error).toContain('Only the defending team');

    // Defending team (P0, Team 0) DOUBLES
    const doubleRes = applyDoubleDecision(state, 0, 'DOUBLE');
    expect(doubleRes.success).toBe(true);
    expect(doubleRes.state.phase).toBe('REDOUBLE_DECISION');
    expect(doubleRes.state.dealMultiplier).toBe(2);
    expect(doubleRes.state.doubleStatus).toBe('DOUBLED');
    expect(doubleRes.state.doubledBy).toBe(0);
  });

  it('should transition to TRICK_PLAY (1x) when defending team PASSES (both defenders pass)', () => {
    let state = createInitialGame('PASS_TEST', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    state = applyTrumpSelection(state, 1, 'HEARTS').state;
    expect(state.phase).toBe('DOUBLE_DECISION');

    // Defender 1 (P2) passes: phase remains DOUBLE_DECISION waiting for teammate
    const pass1 = applyDoubleDecision(state, 2, 'PASS');
    expect(pass1.success).toBe(true);
    expect(pass1.state.phase).toBe('DOUBLE_DECISION');

    // Defender 2 (P0) passes: BOTH have passed -> transitions to TRICK_PLAY and deals cards
    const pass2 = applyDoubleDecision(pass1.state, 0, 'PASS');
    expect(pass2.success).toBe(true);
    expect(pass2.state.phase).toBe('TRICK_PLAY');
    expect(pass2.state.dealMultiplier).toBe(1);
    expect(pass2.state.doubleStatus).toBe('NONE');
    expect(pass2.state.hands[0].length).toBe(8);
  });

  it('should allow bidding team to RE-DOUBLE and advance to TRICK_PLAY (4x)', () => {
    let state = createInitialGame('REDOUBLE_TEST', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state; // Team 1 won bid
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    state = applyTrumpSelection(state, 1, 'CLUBS').state;
    state = applyDoubleDecision(state, 0, 'DOUBLE').state; // Defending team doubles
    expect(state.phase).toBe('REDOUBLE_DECISION');

    // Defending team cannot re-double
    const invalidRedouble = applyRedoubleDecision(state, 0, 'REDOUBLE');
    expect(invalidRedouble.success).toBe(false);
    expect(invalidRedouble.error).toContain('Only the bidding team');

    // Bidding team (P1) RE-DOUBLES
    const redoubleRes = applyRedoubleDecision(state, 1, 'REDOUBLE');
    expect(redoubleRes.success).toBe(true);
    expect(redoubleRes.state.phase).toBe('TRICK_PLAY');
    expect(redoubleRes.state.dealMultiplier).toBe(4);
    expect(redoubleRes.state.doubleStatus).toBe('REDOUBLED');
    expect(redoubleRes.state.redoubledBy).toBe(1);
  });

  it('should remain at 2x multiplier when bidding team passes Re-Double', () => {
    let state = createInitialGame('REDOUBLE_PASS', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    state = applyTrumpSelection(state, 1, 'DIAMONDS').state;
    state = applyDoubleDecision(state, 2, 'DOUBLE').state;
    expect(state.phase).toBe('REDOUBLE_DECISION');

    // Bidder 1 (P1) passes: phase remains REDOUBLE_DECISION waiting for teammate P3
    const pass1 = applyRedoubleDecision(state, 1, 'PASS');
    expect(pass1.success).toBe(true);
    expect(pass1.state.phase).toBe('REDOUBLE_DECISION');

    // Bidder 2 (P3) passes: BOTH have passed -> transitions to TRICK_PLAY at 2x
    const pass2 = applyRedoubleDecision(pass1.state, 3, 'PASS');
    expect(pass2.success).toBe(true);
    expect(pass2.state.phase).toBe('TRICK_PLAY');
    expect(pass2.state.dealMultiplier).toBe(2);
    expect(pass2.state.doubleStatus).toBe('DOUBLED');
    expect(pass2.state.hands[0].length).toBe(8);
  });
});

describe('Match Point Scoring Multipliers', () => {
  const createMockCompletedTricks = (team0Points: number, team1Points: number) => {
    return [
      {
        trickNumber: 1,
        leadPlayer: 0 as PlayerPosition,
        leadSuit: 'SPADES' as const,
        winner: 0 as PlayerPosition,
        winningTeam: 0 as const,
        cards: [],
        points: team0Points,
      },
      {
        trickNumber: 8,
        leadPlayer: 1 as PlayerPosition,
        leadSuit: 'HEARTS' as const,
        winner: 1 as PlayerPosition,
        winningTeam: 1 as const,
        cards: [],
        points: team1Points,
      },
    ];
  };

  it('should award +1 / -1 in normal (1x) match', () => {
    // Team 0 bid 16 and won 17 pts -> +1
    const winResult = evaluateRoundScore(
      createMockCompletedTricks(17, 11),
      0, // bidder P0 (Team 0)
      16,
      DEFAULT_RULES_CONFIG,
      { team0: 0, team1: 0 },
      null,
      1 // normal 1x
    );
    expect(winResult.biddingTeamWon).toBe(true);
    expect(winResult.gamePointsDelta).toEqual({ team0: 1, team1: 0 });
    expect(winResult.newMatchScore).toEqual({ team0: 1, team1: 0 });

    // Team 0 bid 16 and won 15 pts -> -1
    const failResult = evaluateRoundScore(
      createMockCompletedTricks(15, 13),
      0,
      16,
      DEFAULT_RULES_CONFIG,
      { team0: 0, team1: 0 },
      null,
      1
    );
    expect(failResult.biddingTeamWon).toBe(false);
    expect(failResult.gamePointsDelta).toEqual({ team0: -1, team1: 0 });
    expect(failResult.newMatchScore).toEqual({ team0: -1, team1: 0 });
  });

  it('should award +2 / -2 under DOUBLE (2x)', () => {
    // Win under Double: +2
    const winResult = evaluateRoundScore(
      createMockCompletedTricks(17, 11),
      0,
      16,
      DEFAULT_RULES_CONFIG,
      { team0: 2, team1: 0 },
      null,
      2 // 2x
    );
    expect(winResult.gamePointsDelta).toEqual({ team0: 2, team1: 0 });
    expect(winResult.newMatchScore).toEqual({ team0: 4, team1: 0 });

    // Fail under Double: -2
    const failResult = evaluateRoundScore(
      createMockCompletedTricks(14, 14),
      0,
      16,
      DEFAULT_RULES_CONFIG,
      { team0: 1, team1: 0 },
      null,
      2 // 2x
    );
    expect(failResult.gamePointsDelta).toEqual({ team0: -2, team1: 0 });
    expect(failResult.newMatchScore).toEqual({ team0: -1, team1: 0 });
  });

  it('should award +4 / -4 under RE-DOUBLE (4x) and end match at +6', () => {
    // Win under Re-Double: +4
    const winResult = evaluateRoundScore(
      createMockCompletedTricks(19, 9),
      0,
      16,
      DEFAULT_RULES_CONFIG,
      { team0: 2, team1: 0 },
      null,
      4 // 4x
    );
    expect(winResult.gamePointsDelta).toEqual({ team0: 4, team1: 0 });
    expect(winResult.newMatchScore).toEqual({ team0: 6, team1: 0 });
    expect(winResult.isMatchOver).toBe(true);
    expect(winResult.winnerTeam).toBe(0);

    // Fail under Re-Double: -4, supports negative scores
    const failResult = evaluateRoundScore(
      createMockCompletedTricks(10, 18),
      0,
      16,
      DEFAULT_RULES_CONFIG,
      { team0: 0, team1: 0 },
      null,
      4 // 4x
    );
    expect(failResult.gamePointsDelta).toEqual({ team0: -4, team1: 0 });
    expect(failResult.newMatchScore).toEqual({ team0: -4, team1: 0 });
  });
});

describe('King-Queen Pair / Royals Logic', () => {
  it('should detect pair when bid >= 19 and player holds both King and Queen of trump', () => {
    const hands: Record<PlayerPosition, string[]> = {
      0: ['K_HEARTS', 'Q_HEARTS', 'J_SPADES', '9_CLUBS'],
      1: ['A_HEARTS', '10_HEARTS'],
      2: ['8_HEARTS', '7_HEARTS'],
      3: ['K_SPADES', 'Q_SPADES'],
    };

    // Bidding team pair (P0 is bidder, bid=20)
    const pairBidding = detectKingQueenPair(hands, 'HEARTS', true, 20, 0, 2);
    expect(pairBidding).not.toBeNull();
    expect(pairBidding?.playerIndex).toBe(0);
    expect(pairBidding?.team).toBe(0);
    expect(pairBidding?.originalBid).toBe(20);
    // Bidding team target decreases by 4: 20 - 4 = 16
    expect(pairBidding?.adjustedTarget).toBe(16);
    expect(pairBidding?.adjustment).toBe(-4);
  });

  it('should respect minimum target of 16 for bidding team pair', () => {
    const hands: Record<PlayerPosition, string[]> = {
      0: ['K_SPADES', 'Q_SPADES'],
      1: [],
      2: [],
      3: [],
    };
    // Bid = 19; 19 - 4 = 15, but min target is 16
    const pair = detectKingQueenPair(hands, 'SPADES', true, 19, 0, 1);
    expect(pair?.adjustedTarget).toBe(16);
  });

  it('should increase target by 4 (max 29) for defending team pair', () => {
    const hands: Record<PlayerPosition, string[]> = {
      0: ['A_CLUBS'],
      1: ['K_CLUBS', 'Q_CLUBS'], // P1 is defending team (bidder is P0)
      2: [],
      3: [],
    };
    // Bid = 22; defending team pair: 22 + 4 = 26
    const pair = detectKingQueenPair(hands, 'CLUBS', true, 22, 0, 1);
    expect(pair).not.toBeNull();
    expect(pair?.playerIndex).toBe(1);
    expect(pair?.team).toBe(1);
    expect(pair?.adjustedTarget).toBe(26);
    expect(pair?.adjustment).toBe(4);

    // Bid = 27; defending team pair: min(29, 27 + 4) = 29
    const pairMax = detectKingQueenPair(hands, 'CLUBS', true, 27, 0, 1);
    expect(pairMax?.adjustedTarget).toBe(29);
  });

  it('should NOT declare pair if bid is under 19', () => {
    const hands: Record<PlayerPosition, string[]> = {
      0: ['K_HEARTS', 'Q_HEARTS'],
      1: [],
      2: [],
      3: [],
    };
    // Bid = 18 (< 19)
    const pair = detectKingQueenPair(hands, 'HEARTS', true, 18, 0, 1);
    expect(pair).toBeNull();
  });

  it('should NOT declare pair in Joker / No Trump mode', () => {
    const hands: Record<PlayerPosition, string[]> = {
      0: ['K_HEARTS', 'Q_HEARTS'],
      1: [],
      2: [],
      3: [],
    };
    const pair = detectKingQueenPair(hands, null, true, 22, 0, 1);
    expect(pair).toBeNull();
  });

  it('should automatically detect pair upon legal trump reveal in trick play', () => {
    let state = createInitialGame('PAIR_REVEAL_TEST', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 20).state; // Bid = 20
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    state = applyTrumpSelection(state, 1, 'HEARTS').state;
    state = applyDoubleDecision(state, 0, 'PASS').state;
    state = applyDoubleDecision(state, 2, 'PASS').state;
    expect(state.phase).toBe('TRICK_PLAY');

    // Manually place K & Q of Hearts in P1's hand for testing (and make sure the
    // random deal didn't also give them to someone else)
    for (const p of [0, 2, 3] as const) {
      state.hands[p] = state.hands[p].filter((id) => id !== 'K_HEARTS' && id !== 'Q_HEARTS');
    }
    state.hands[1] = ['K_HEARTS', 'Q_HEARTS', 'J_HEARTS', '9_HEARTS'];

    // Legal reveal
    const revealRes = applyTrumpReveal(state, state.currentTurn);
    expect(revealRes.success).toBe(true);
    expect(revealRes.state.isTrumpRevealed).toBe(true);
    expect(revealRes.state.pairDeclaration).not.toBeNull();
    expect(revealRes.state.adjustedTarget).toBe(16); // 20 - 4 = 16
  });
});

describe('Joker & 7th Card Special Table Announcements', () => {
  it('should trigger TRUMP_ANNOUNCEMENT for Joker and transition via applyTrumpAnnouncementComplete', () => {
    let state = createInitialGame('JOKER_ANNOUNCE', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    const res = applyTrumpSelection(state, 1, 'NO_TRUMP');
    expect(res.state.phase).toBe('TRUMP_ANNOUNCEMENT');
    expect(res.state.specialAnnouncement?.type).toBe('NO_TRUMP');

    const completed = applyTrumpAnnouncementComplete(res.state);
    expect(completed.phase).toBe('DOUBLE_DECISION');
    expect(completed.specialAnnouncement).toBeNull();
  });

  it('should trigger TRUMP_ANNOUNCEMENT for 7th Card and transition via applyTrumpAnnouncementComplete', () => {
    let state = createInitialGame('SEVENTH_ANNOUNCE', dummyPlayers);
    state = startNewRound(state, 0);

    state = applyBid(state, 1, 16).state;
    state = applyBid(state, 2, 'PASS').state;
    state = applyBid(state, 3, 'PASS').state;
    state = applyBid(state, 0, 'PASS').state;

    const res = applyTrumpSelection(state, 1, 'SEVENTH_CARD');
    expect(res.state.phase).toBe('TRUMP_ANNOUNCEMENT');
    expect(res.state.specialAnnouncement?.type).toBe('SEVENTH_CARD');

    const completed = applyTrumpAnnouncementComplete(res.state);
    expect(completed.phase).toBe('DOUBLE_DECISION');
    expect(completed.specialAnnouncement).toBeNull();
  });
});
