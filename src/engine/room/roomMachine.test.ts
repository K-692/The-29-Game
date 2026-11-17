import { describe, expect, it } from 'vitest';
import {
  act,
  advance,
  createRoom,
  joinRoom,
  leaveRoom,
  nextWakeAt,
  playerView,
  publicRoom,
  RoomRecord,
  selectSeat,
  startMatch,
  touch,
  TRICK_DISPLAY_MS,
  DOUBLE_DECISION_MS,
  PRESENCE_TIMEOUT_MS,
} from './roomMachine';
import { getPlayableCards } from '../tricks';
import { PlayerPosition } from '../types';

/** Drives a room the way online clients do: ping/advance at nextWakeAt. */
function runUntil(room: RoomRecord, start: number, done: () => boolean, tokens: string[] = [], budget = 30 * 60_000) {
  let now = start;
  while (!done() && now - start < budget) {
    const wake = nextWakeAt(room);
    now = Math.max(now + 50, wake ?? now + 1000);
    tokens.forEach((t) => touch(room, t, now)); // humans stay "connected"
    advance(room, now);
  }
  return { finished: done(), now };
}

const fresh = (humans = 1) => {
  const t0 = 1_000_000;
  const { room, seat } = createRoom('ABC123', 'Host', t0);
  const tokens = [seat.token];
  for (let i = 1; i < humans; i++) {
    const j = joinRoom(room, `Friend${i}`, t0);
    if (!j.ok) throw new Error(j.error);
    tokens.push(j.seat.token);
  }
  return { room, tokens, t0 };
};

describe('Online room machine', () => {
  it('fills every empty seat with a computer player on start', () => {
    const { room, tokens, t0 } = fresh(2);
    expect(startMatch(room, tokens[0], t0).ok).toBe(true);
    expect(room.seats.map((s) => s.isCpu)).toEqual([false, false, true, true]);
    for (const s of room.seats.filter((x) => x.isCpu)) expect(s.name).not.toMatch(/bot|cpu|empty/i);
    expect(room.game?.phase).toBe('BIDDING');
  });

  it('only the host can start', () => {
    const { room, tokens, t0 } = fresh(2);
    expect(startMatch(room, tokens[1], t0).ok).toBe(false);
  });

  it('a solo human plays a complete deal with 3 computer players', () => {
    const { room, tokens, t0 } = fresh(1);
    startMatch(room, tokens[0], t0);
    const res = runUntil(room, t0, () => ['ROUND_ENDED', 'MATCH_ENDED'].includes(room.game!.phase), tokens);
    expect(res.finished).toBe(true);
    const sum = room.game!.roundHistory[0];
    expect(sum.team0CardPoints + sum.team1CardPoints).toBe(29);
  });

  it('keeps playing deal after deal (auto next deal) until a side wins the match', () => {
    const { room, tokens, t0 } = fresh(1);
    startMatch(room, tokens[0], t0);
    const res = runUntil(room, t0, () => room.game!.phase === 'MATCH_ENDED', tokens, 6 * 60 * 60_000);
    expect(res.finished).toBe(true);
    expect(room.game!.winnerTeam).not.toBeNull();
  });

  it('pauses while no human is connected and resumes on return', () => {
    const { room, tokens, t0 } = fresh(1);
    startMatch(room, tokens[0], t0);
    const v = room.game!.version;
    const later = t0 + PRESENCE_TIMEOUT_MS + 60_000;
    advance(room, later);
    expect(room.game!.version).toBe(v);
    touch(room, tokens[0], later);
    advance(room, later + 5000);
    expect(room.game!.version).toBeGreaterThan(v);
  });

  it('sends each player only their own hand and never the concealed trump', () => {
    const { room, tokens, t0 } = fresh(2);
    startMatch(room, tokens[0], t0);
    const v0 = playerView(room, 0, t0)!;
    const v1 = playerView(room, 1, t0)!;
    expect(v0.myHand).toEqual(room.game!.hands[0]);
    expect(v1.myHand).toEqual(room.game!.hands[1]);
    expect((v0 as any).hands).toBeUndefined();
    expect((v0 as any).trumpSuit).toBeUndefined();
    expect(JSON.stringify(publicRoom(room, t0))).not.toContain(tokens[0]);
  });

  it('a late human replaces a computer player mid-match; a leaver is replaced by one', () => {
    const { room, tokens, t0 } = fresh(1);
    startMatch(room, tokens[0], t0);
    const j = joinRoom(room, 'Late', t0 + 10);
    expect(j.ok).toBe(true);
    if (!j.ok) return;
    expect(j.seat.isCpu).toBe(false);
    expect(room.game!.players[j.seat.position].name).toBe('Late');
    leaveRoom(room, j.seat.token, t0 + 20);
    expect(room.seats[j.seat.position].isCpu).toBe(true);
  });

  it('host role moves to a present human, never to a computer player', () => {
    const { room, tokens, t0 } = fresh(2);
    startMatch(room, tokens[0], t0);
    leaveRoom(room, tokens[0], t0 + 1);
    const host = room.seats.find((s) => s.isHost)!;
    expect(host.isCpu).toBe(false);
    expect(host.token).toBe(tokens[1]);
  });

  it('lobby seat switching', () => {
    const { room, tokens, t0 } = fresh(2);
    const from = room.seats.findIndex((s) => s.token === tokens[1]);
    expect(selectSeat(room, tokens[1], 3, t0).ok).toBe(true);
    expect(room.seats[3].token).toBe(tokens[1]);
    expect(room.seats[from].token).toBe('');
    expect(selectSeat(room, tokens[1], 0, t0).ok).toBe(false); // host's seat
  });
});

describe('Double / Re-double and timers online', () => {
  /** Host (seat 0) wins the bid at `bid` with trump SPADES; seat 2 is the human partner. */
  const toDoubleWindow = (bid: number) => {
    const { room, tokens, t0 } = fresh(4);
    startMatch(room, tokens[0], t0);
    const gs = room.game!;
    gs.dealerIndex = 3;
    gs.biddingOrder = [0, 1, 2, 3];
    gs.currentTurn = 0;
    let now = t0 + 10;
    expect(act(room, tokens[0], { type: 'BID', bid }, now).ok).toBe(true);
    for (const p of [1, 2, 3]) expect(act(room, tokens[p], { type: 'BID', bid: 'PASS' }, (now += 10)).ok).toBe(true);
    expect(act(room, tokens[0], { type: 'TRUMP', choice: 'SPADES' }, (now += 10)).ok).toBe(true);
    expect(room.game!.phase).toBe('DOUBLE_DECISION');
    return { room, tokens, now };
  };

  it('double → re-double = 4×; defenders cannot re-double; repeat votes rejected', () => {
    const { room, tokens, now } = toDoubleWindow(18);
    expect(act(room, tokens[0], { type: 'DOUBLE', decision: 'DOUBLE' }, now + 1).ok).toBe(false);
    expect(act(room, tokens[1], { type: 'DOUBLE', decision: 'PASS' }, now + 2).ok).toBe(true);
    expect(act(room, tokens[1], { type: 'DOUBLE', decision: 'DOUBLE' }, now + 3).ok).toBe(false);
    expect(act(room, tokens[3], { type: 'DOUBLE', decision: 'DOUBLE' }, now + 4).ok).toBe(true);
    expect(room.game!.phase).toBe('REDOUBLE_DECISION');
    expect(act(room, tokens[3], { type: 'REDOUBLE', decision: 'REDOUBLE' }, now + 5).ok).toBe(false);
    expect(act(room, tokens[2], { type: 'REDOUBLE', decision: 'REDOUBLE' }, now + 6).ok).toBe(true);
    expect(room.game!.phase).toBe('TRICK_PLAY');
    expect(room.game!.dealMultiplier).toBe(4);
  });

  it('one pass does not reset the shared 10s window; expiry starts play at 1×', () => {
    const { room, tokens, now } = toDoubleWindow(18);
    const deadline = room.clock!.deadline;
    act(room, tokens[1], { type: 'DOUBLE', decision: 'PASS' }, now + 3000);
    expect(room.clock!.deadline).toBe(deadline);
    tokens.forEach((t) => touch(room, t, deadline + 1));
    advance(room, deadline + 1);
    expect(room.game!.phase).toBe('TRICK_PLAY');
    expect(room.game!.dealMultiplier).toBe(1);
    expect(DOUBLE_DECISION_MS).toBe(10_000);
  });

  it('rejects a 5th card while the full trick is shown, then collects it after the pause', () => {
    const { room, tokens, now } = toDoubleWindow(18);
    act(room, tokens[1], { type: 'DOUBLE', decision: 'PASS' }, now + 1);
    act(room, tokens[3], { type: 'DOUBLE', decision: 'PASS' }, now + 2);
    let t = now + 10;
    for (let i = 0; i < 4; i++) {
      const gs = room.game!;
      const p = gs.currentTurn as PlayerPosition;
      const lead = gs.currentTrickCards[0]?.cardId ?? null;
      const card = getPlayableCards(gs.hands[p], lead, gs.trumpSuit, gs.isTrumpRevealed, gs.trumpMode)[0];
      expect(act(room, tokens[p], { type: 'PLAY', cardId: card }, (t += 10)).ok).toBe(true);
    }
    expect(room.game!.currentTrickCards).toHaveLength(4);
    const p = room.game!.currentTurn;
    expect(act(room, tokens[p], { type: 'PLAY', cardId: room.game!.hands[p][0] }, t + 10).ok).toBe(false);
    tokens.forEach((tk) => touch(room, tk, t + TRICK_DISPLAY_MS + 5));
    advance(room, t + TRICK_DISPLAY_MS + 5);
    expect(room.game!.currentTrickCards).toHaveLength(0);
    expect(room.game!.completedTricks).toHaveLength(1);
  });

  it('an expired human turn is played automatically', () => {
    const { room, tokens, t0 } = fresh(4);
    startMatch(room, tokens[0], t0);
    const turn = room.game!.currentTurn;
    const deadline = room.clock!.deadline;
    tokens.forEach((t) => touch(room, t, deadline + 1));
    advance(room, deadline + 1);
    expect(room.game!.bids.length).toBe(1);
    expect(room.game!.bids[0].playerIndex).toBe(turn);
  });
});
