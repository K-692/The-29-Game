import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomManager, LanRoom, DOUBLE_DECISION_SECONDS, TRICK_DISPLAY_MS } from '../../server/roomManager';
import { DEFAULT_RULES_CONFIG, PlayerPosition } from './types';
import { applyDoubleDecision, applyPairDeclaration, applyRedoubleDecision } from './gameManager';
import { getPlayableCards } from './tricks';

/**
 * End-to-end checks of Double / Re-Double and King-Queen Pair through the
 * LAN room manager (the same code path the 4 browsers drive over Socket.IO).
 */

const mockSocket = (id: string) =>
  ({ id, join: () => {}, leave: () => {}, emit: () => {} }) as any;

const mockIo = () => {
  const sent: Array<{ to: string; event: string; data: any }> = [];
  return {
    sent,
    to: (to: string) => ({ emit: (event: string, data: any) => sent.push({ to, event, data }) }),
  } as any;
};

/** 4 humans seated, bidding forced so seat 0 wins at `bid` and picks `trump`. */
function setupToDoublePhase(bid: number, trump: 'SPADES' | 'HEARTS' = 'SPADES') {
  const io = mockIo();
  const mgr = new RoomManager(io);
  const { room, seat: host } = mgr.createRoom(mockSocket('s0'), 'P0', DEFAULT_RULES_CONFIG, 0);
  [1, 2, 3].forEach((i) => mgr.joinRoom(mockSocket(`s${i}`), room.code, `P${i}`, i as PlayerPosition));
  expect(mgr.startMatch(mockSocket('s0'), room.code, host.sessionToken).success).toBe(true);

  const gs = room.gameState!;
  gs.dealerIndex = 3;
  gs.biddingOrder = [0, 1, 2, 3];
  gs.currentTurn = 0;
  const tok = (p: number) => room.seats[p].sessionToken;

  expect(mgr.handleBid(room.code, tok(0), bid).success).toBe(true);
  mgr.handleBid(room.code, tok(1), 'PASS');
  mgr.handleBid(room.code, tok(2), 'PASS');
  mgr.handleBid(room.code, tok(3), 'PASS');
  expect(room.gameState!.phase).toBe('TRUMP_SELECTION');
  expect(mgr.handleSelectTrump(room.code, tok(0), trump).success).toBe(true);
  expect(room.gameState!.phase).toBe('DOUBLE_DECISION');
  return { io, mgr, room, tok };
}

function playOutDeal(mgr: RoomManager, room: LanRoom) {
  for (let trick = 0; trick < 8; trick++) {
    for (let i = 0; i < 4; i++) {
      const gs = room.gameState!;
      const turn = gs.currentTurn;
      const lead = gs.currentTrickCards[0]?.cardId ?? null;
      const card = getPlayableCards(gs.hands[turn], lead, gs.trumpSuit, gs.isTrumpRevealed, gs.trumpMode)[0];
      expect(mgr.handlePlayCard(room.code, room.seats[turn].sessionToken, card).success).toBe(true);
    }
    vi.advanceTimersByTime(TRICK_DISPLAY_MS + 10);
  }
}

describe('LAN Double / Re-Double', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('only the defending team may double; bidding team is rejected', () => {
    const { mgr, room, tok } = setupToDoublePhase(18);
    expect(mgr.handleDoubleDecision(room.code, tok(0), 'DOUBLE').success).toBe(false);
    expect(mgr.handleDoubleDecision(room.code, tok(2), 'DOUBLE').success).toBe(false);
    expect(room.gameState!.phase).toBe('DOUBLE_DECISION');
  });

  it('one defender passing waits for the partner; both passing starts play at 1x with 8 cards', () => {
    const { mgr, room, tok } = setupToDoublePhase(18);
    expect(mgr.handleDoubleDecision(room.code, tok(1), 'PASS').success).toBe(true);
    expect(room.gameState!.phase).toBe('DOUBLE_DECISION');
    expect(mgr.handleDoubleDecision(room.code, tok(3), 'PASS').success).toBe(true);
    expect(room.gameState!.phase).toBe('TRICK_PLAY');
    expect(room.gameState!.dealMultiplier).toBe(1);
    for (const p of [0, 1, 2, 3] as const) expect(room.gameState!.hands[p]).toHaveLength(8);
  });

  it('a player cannot vote twice (PASS then DOUBLE is rejected)', () => {
    const { mgr, room, tok } = setupToDoublePhase(18);
    mgr.handleDoubleDecision(room.code, tok(1), 'PASS');
    const second = mgr.handleDoubleDecision(room.code, tok(1), 'DOUBLE');
    expect(second.success).toBe(false);
    expect(room.gameState!.phase).toBe('DOUBLE_DECISION');
    // The partner can still double for the team
    expect(mgr.handleDoubleDecision(room.code, tok(3), 'DOUBLE').success).toBe(true);
    expect(room.gameState!.phase).toBe('REDOUBLE_DECISION');
  });

  it('Double → Re-Double gives 4x and the 4x result is applied to the match score', () => {
    const { mgr, room, tok } = setupToDoublePhase(16);
    expect(mgr.handleDoubleDecision(room.code, tok(1), 'DOUBLE').success).toBe(true);
    expect(room.gameState!.phase).toBe('REDOUBLE_DECISION');
    expect(room.gameState!.dealMultiplier).toBe(2);
    // Defenders can't redouble
    expect(mgr.handleRedoubleDecision(room.code, tok(3), 'REDOUBLE').success).toBe(false);
    expect(mgr.handleRedoubleDecision(room.code, tok(2), 'REDOUBLE').success).toBe(true);
    expect(room.gameState!.phase).toBe('TRICK_PLAY');
    expect(room.gameState!.dealMultiplier).toBe(4);
    expect(room.gameState!.doubleStatus).toBe('REDOUBLED');

    playOutDeal(mgr, room);
    expect(room.gameState!.phase === 'ROUND_ENDED' || room.gameState!.phase === 'MATCH_ENDED').toBe(true);
    const summary = room.gameState!.roundHistory[0];
    expect(summary.dealMultiplier).toBe(4);
    expect(Math.abs(summary.gamePointsDelta.team0)).toBe(4);
  });

  it('bidding team passing Re-Double keeps the deal at 2x', () => {
    const { mgr, room, tok } = setupToDoublePhase(17);
    mgr.handleDoubleDecision(room.code, tok(3), 'DOUBLE');
    mgr.handleRedoubleDecision(room.code, tok(0), 'PASS');
    expect(room.gameState!.phase).toBe('REDOUBLE_DECISION');
    mgr.handleRedoubleDecision(room.code, tok(2), 'PASS');
    expect(room.gameState!.phase).toBe('TRICK_PLAY');
    expect(room.gameState!.dealMultiplier).toBe(2);
  });

  it('when the 10s Double window expires the deal starts at 1x', () => {
    const { mgr, room, tok } = setupToDoublePhase(18);
    mgr.handleDoubleDecision(room.code, tok(1), 'PASS');
    vi.advanceTimersByTime(DOUBLE_DECISION_SECONDS * 1000 + 1100);
    expect(room.gameState!.phase).toBe('TRICK_PLAY');
    expect(room.gameState!.dealMultiplier).toBe(1);
    expect(mgr.handleDoubleDecision(room.code, tok(3), 'DOUBLE').success).toBe(false);
  });

  it('when the Re-Double window expires the deal stays 2x', () => {
    const { mgr, room, tok } = setupToDoublePhase(18);
    mgr.handleDoubleDecision(room.code, tok(1), 'DOUBLE');
    vi.advanceTimersByTime(DOUBLE_DECISION_SECONDS * 1000 + 1100);
    expect(room.gameState!.phase).toBe('TRICK_PLAY');
    expect(room.gameState!.dealMultiplier).toBe(2);
  });

  it('if both deciding players are disconnected the window closes early', () => {
    const { mgr, room } = setupToDoublePhase(18);
    mgr.handleDisconnect('s1');
    mgr.handleDisconnect('s3');
    vi.advanceTimersByTime(4100);
    expect(room.gameState!.phase).toBe('TRICK_PLAY');
  });
});

describe('Engine vote guards', () => {
  it('rejects a repeat Re-Double vote from the same player', () => {
    const { room } = setupToDoublePhase(18);
    let gs = applyDoubleDecision(room.gameState!, 1, 'DOUBLE').state;
    gs = applyRedoubleDecision(gs, 0, 'PASS').state;
    const again = applyRedoubleDecision(gs, 0, 'REDOUBLE');
    expect(again.success).toBe(false);
  });
});

describe('LAN King-Queen Pair', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Forces a trick-play position where seat 1 cannot follow hearts and reveals trump. */
  function revealWithHands(bid: number, pairOwner: PlayerPosition) {
    const { mgr, room, tok, io } = setupToDoublePhase(bid, 'SPADES');
    mgr.handleDoubleDecision(room.code, tok(1), 'PASS');
    mgr.handleDoubleDecision(room.code, tok(3), 'PASS');
    const gs = room.gameState!;
    const others: Record<PlayerPosition, string[]> = {
      0: ['J_HEARTS', '7_DIAMONDS'],
      1: ['7_CLUBS', '8_CLUBS'],
      2: ['9_HEARTS', '8_DIAMONDS'],
      3: ['A_HEARTS', '9_DIAMONDS'],
    };
    others[pairOwner] = [...others[pairOwner], 'K_SPADES', 'Q_SPADES'];
    gs.hands = others;
    gs.currentTurn = 0;
    gs.currentTrickLead = 0;
    gs.currentTrickCards = [];
    room.activeTurn = null;

    expect(mgr.handlePlayCard(room.code, tok(0), 'J_HEARTS').success).toBe(true);
    // Seat 1 has no hearts → may ask for trump
    const reveal = mgr.handleRevealTrump(room.code, tok(1), { requestId: 'req_1' });
    expect(reveal.success).toBe(true);
    // Duplicate request id is idempotent
    expect(mgr.handleRevealTrump(room.code, tok(1), { requestId: 'req_1' }).success).toBe(true);
    return { mgr, room, io };
  }

  it('bidding-team pair (bid ≥ 19) lowers the target by 4 and is announced to everyone', () => {
    const { room, io } = revealWithHands(20, 2);
    const pair = room.gameState!.pairDeclaration!;
    expect(pair.playerIndex).toBe(2);
    expect(pair.adjustedTarget).toBe(16);
    expect(room.gameState!.adjustedTarget).toBe(16);
    const notes = io.sent.filter((m: any) => m.event === 'in_table_notification' && m.data.type === 'PAIR_DECLARED');
    expect(notes).toHaveLength(1);
    // Every player's view carries the pair so all 4 tables show the announcement
    const views = io.sent.filter((m: any) => m.event === 'game_state_update').slice(-4);
    for (const v of views) expect(v.data.publicState.pairDeclaration?.adjustedTarget).toBe(16);
  });

  it('defending-team pair raises the target by 4 (capped at 29)', () => {
    const { room } = revealWithHands(27, 3);
    expect(room.gameState!.pairDeclaration!.adjustedTarget).toBe(29);
  });

  it('no pair adjustment below a 19 bid (auto or manual)', () => {
    const { room } = revealWithHands(18, 2);
    expect(room.gameState!.pairDeclaration).toBeNull();
    const manual = applyPairDeclaration(
      { ...room.gameState!, completedTricks: [{ cards: [], winner: 2, winningTeam: 0, points: 0, trickNumber: 1 } as any] },
      2
    );
    expect(manual.success).toBe(false);
  });
});
