import { describe, it, expect } from 'vitest';
import { 
  createInitialGame, 
  startNewRound, 
  applyBid, 
  applyTrumpSelection, 
  applyDoubleDecision, 
  applyRedoubleDecision,
  applySecondDeal
} from './gameManager';
import { PlayerInfo, PlayerPosition } from './types';
import { evaluateRoundScore } from './scoring';

const dummyPlayers: PlayerInfo[] = [
  { id: 'p0', name: 'Alice', avatar: '🦊', position: 0, team: 0, isHost: true, isCpu: false, isReady: true, connected: true },
  { id: 'p1', name: 'Bob', avatar: '🐼', position: 1, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
  { id: 'p2', name: 'Charlie', avatar: '🐯', position: 2, team: 0, isHost: false, isCpu: false, isReady: true, connected: true },
  { id: 'p3', name: 'Diana', avatar: '🐸', position: 3, team: 1, isHost: false, isCpu: false, isReady: true, connected: true },
];

/**
 * Helper to set up a game state at DOUBLE_DECISION phase.
 * Bidder is P1 (Team 1, contract 17).
 * Defending team is Team 0 (Alice at P0, Charlie at P2).
 * Bidding team is Team 1 (Bob at P1, Diana at P3).
 */
const setupDoubleDecisionState = (dealer: PlayerPosition = 0) => {
  let state = createInitialGame('SCENARIOS_TEST', dummyPlayers);
  state = startNewRound(state, dealer);

  // P1 bids 17, others pass
  state = applyBid(state, 1, 17).state;
  state = applyBid(state, 2, 'PASS').state;
  state = applyBid(state, 3, 'PASS').state;
  state = applyBid(state, 0, 'PASS').state;

  expect(state.phase).toBe('TRUMP_SELECTION');
  expect(state.highestBidder).toBe(1);

  // P1 selects Spades trump
  state = applyTrumpSelection(state, 1, 'SPADES').state;
  expect(state.phase).toBe('DOUBLE_DECISION');

  // Verify Task 1: During Double/Redouble, all players hold only 4 cards!
  for (let p = 0; p < 4; p++) {
    expect(state.hands[p as PlayerPosition].length).toBe(4);
  }

  return state;
};

describe('Verification of the 6 Double/Redouble Scenarios', () => {
  // Scenario (a): no double
  it('(a) no double: both defending teammates pass -> moves to TRICK_PLAY at 1x, deals 8 cards', () => {
    let state = setupDoubleDecisionState();

    // Defending team is Team 0: Alice (P0) and Charlie (P2)
    // Neither chooses double -> both pass
    const pass1 = applyDoubleDecision(state, 0, 'PASS');
    expect(pass1.success).toBe(true);
    expect(pass1.state.phase).toBe('DOUBLE_DECISION'); // Waiting for Charlie
    expect(pass1.state.doubleVotes?.[0]).toBe('PASS');

    const pass2 = applyDoubleDecision(pass1.state, 2, 'PASS');
    expect(pass2.success).toBe(true);
    // Both passed -> advances to TRICK_PLAY at 1x
    expect(pass2.state.phase).toBe('TRICK_PLAY');
    expect(pass2.state.dealMultiplier).toBe(1);
    expect(pass2.state.doubleStatus).toBe('NONE');

    // Remaining 4 cards are now dealt: all players hold 8 cards
    for (let p = 0; p < 4; p++) {
      expect(pass2.state.hands[p as PlayerPosition].length).toBe(8);
    }
  });

  // Scenario (b): Double by the opponent's player 1
  it("(b) Double by the opponent's player 1: immediate acceptance, advances to REDOUBLE_DECISION (2x)", () => {
    let state = setupDoubleDecisionState();

    // Opponent player 1 (Alice at P0) doubles immediately
    const doubleRes = applyDoubleDecision(state, 0, 'DOUBLE');
    expect(doubleRes.success).toBe(true);
    // Accepted immediately without waiting for teammate Charlie (P2)
    expect(doubleRes.state.phase).toBe('REDOUBLE_DECISION');
    expect(doubleRes.state.dealMultiplier).toBe(2);
    expect(doubleRes.state.doubleStatus).toBe('DOUBLED');
    expect(doubleRes.state.doubledBy).toBe(0);

    // Cards are STILL held at 4 cards each during REDOUBLE_DECISION
    for (let p = 0; p < 4; p++) {
      expect(doubleRes.state.hands[p as PlayerPosition].length).toBe(4);
    }
  });

  // Scenario (c): Double by player 2 while player 1 passes
  it('(c) Double by player 2 while player 1 passes: player 1 pass does not cancel team double, accepted as 2x', () => {
    let state = setupDoubleDecisionState();

    // Player 1 (Alice at P0) passes
    const pass1 = applyDoubleDecision(state, 0, 'PASS');
    expect(pass1.success).toBe(true);
    expect(pass1.state.phase).toBe('DOUBLE_DECISION');
    expect(pass1.state.doubleVotes?.[0]).toBe('PASS');

    // Player 2 (Charlie at P2) doubles!
    const double2 = applyDoubleDecision(pass1.state, 2, 'DOUBLE');
    expect(double2.success).toBe(true);
    // Accepted immediately as DOUBLE!
    expect(double2.state.phase).toBe('REDOUBLE_DECISION');
    expect(double2.state.dealMultiplier).toBe(2);
    expect(double2.state.doubleStatus).toBe('DOUBLED');
    expect(double2.state.doubledBy).toBe(2);
  });

  // Scenario (d): both opponents pass
  it('(d) both opponents pass: team final decision is PASS, transitions to TRICK_PLAY (1x)', () => {
    let state = setupDoubleDecisionState();

    // First opponent (Charlie at P2) passes
    const res1 = applyDoubleDecision(state, 2, 'PASS');
    expect(res1.success).toBe(true);
    expect(res1.state.phase).toBe('DOUBLE_DECISION');
    expect(res1.state.doubleVotes?.[2]).toBe('PASS');

    // Second opponent (Alice at P0) passes
    const res2 = applyDoubleDecision(res1.state, 0, 'PASS');
    expect(res2.success).toBe(true);
    expect(res2.state.phase).toBe('TRICK_PLAY');
    expect(res2.state.dealMultiplier).toBe(1);
    expect(res2.state.doubleStatus).toBe('NONE');
    expect(res2.state.doubleVotes?.[0]).toBe('PASS');
    expect(res2.state.doubleVotes?.[2]).toBe('PASS');

    // All players now have their full 8 cards
    for (let p = 0; p < 4; p++) {
      expect(res2.state.hands[p as PlayerPosition].length).toBe(8);
    }
  });

  // Scenario (e): Double followed by Redouble
  it('(e) Double followed by Redouble: defending doubles (2x), then bidding redoubles (4x) -> TRICK_PLAY (4x)', () => {
    let state = setupDoubleDecisionState();

    // 1. Defending team doubles (Alice at P0)
    state = applyDoubleDecision(state, 0, 'DOUBLE').state;
    expect(state.phase).toBe('REDOUBLE_DECISION');
    expect(state.dealMultiplier).toBe(2);

    // 2. Bidding team (Bob at P1 and Diana at P3): Diana (P3) redoubles!
    const redoubleRes = applyRedoubleDecision(state, 3, 'REDOUBLE');
    expect(redoubleRes.success).toBe(true);
    expect(redoubleRes.state.phase).toBe('TRICK_PLAY');
    expect(redoubleRes.state.dealMultiplier).toBe(4);
    expect(redoubleRes.state.doubleStatus).toBe('REDOUBLED');
    expect(redoubleRes.state.redoubledBy).toBe(3);

    // Full 8 cards now dealt to each player
    for (let p = 0; p < 4; p++) {
      expect(redoubleRes.state.hands[p as PlayerPosition].length).toBe(8);
    }

    // Verify scoring calculation produces 4x match points
    const mockTricks = [
      { trickNumber: 1, leadPlayer: 0 as PlayerPosition, leadSuit: 'SPADES' as const, winner: 1 as PlayerPosition, winningTeam: 1 as const, cards: [], points: 20 },
      { trickNumber: 2, leadPlayer: 1 as PlayerPosition, leadSuit: 'SPADES' as const, winner: 0 as PlayerPosition, winningTeam: 0 as const, cards: [], points: 8 },
    ];
    // Bidding team won 20 points + 1 last trick = 21 (target was 17). Succeeded under 4x Re-Double!
    const roundSummary = evaluateRoundScore(
      mockTricks as any,
      1 as PlayerPosition,
      redoubleRes.state.highestBid,
      redoubleRes.state.rules,
      { team0: 0, team1: 0 },
      null,
      redoubleRes.state.dealMultiplier
    );
    expect(roundSummary.gamePointsDelta.team1).toBe(4); // +4 match points!
    expect(roundSummary.gamePointsDelta.team0).toBe(0);
  });

  // Scenario (f): Pass followed by Double within the same team
  it('(f) Pass followed by Double within the same team: first teammate passes, second doubles -> accepted immediately (2x)', () => {
    let state = setupDoubleDecisionState();

    // Stage 1: Defending team (P0 & P2)
    // Teammate 1 (P0) passes
    state = applyDoubleDecision(state, 0, 'PASS').state;
    expect(state.phase).toBe('DOUBLE_DECISION');
    expect(state.doubleVotes?.[0]).toBe('PASS');

    // Teammate 2 (P2) doubles!
    state = applyDoubleDecision(state, 2, 'DOUBLE').state;
    expect(state.phase).toBe('REDOUBLE_DECISION');
    expect(state.dealMultiplier).toBe(2);
    expect(state.doubleStatus).toBe('DOUBLED');

    // Stage 2: Bidding team (P1 & P3) also tests Pass followed by Redouble!
    // Teammate 1 (P1) passes Re-Double
    state = applyRedoubleDecision(state, 1, 'PASS').state;
    expect(state.phase).toBe('REDOUBLE_DECISION');
    expect(state.redoubleVotes?.[1]).toBe('PASS');

    // Teammate 2 (P3) redoubles!
    state = applyRedoubleDecision(state, 3, 'REDOUBLE').state;
    expect(state.phase).toBe('TRICK_PLAY');
    expect(state.dealMultiplier).toBe(4);
    expect(state.doubleStatus).toBe('REDOUBLED');
    expect(state.redoubledBy).toBe(3);

    // Hands are 8 cards
    for (let p = 0; p < 4; p++) {
      expect(state.hands[p as PlayerPosition].length).toBe(8);
    }
  });
});
