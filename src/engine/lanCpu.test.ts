import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomManager, LanRoom } from '../../server/roomManager';
import { DEFAULT_RULES_CONFIG, PlayerPosition } from './types';

/**
 * Computer players filling empty LAN seats and playing alongside humans.
 * Humans in these tests never act themselves, so their turns are covered by
 * the server's timeout auto-play; computer players act on their own.
 */

const mockSocket = (id: string) => ({ id, join: () => {}, leave: () => {}, emit: () => {} }) as any;
const mockIo = () => {
  const sent: Array<{ to: string; event: string; data: any }> = [];
  return { sent, to: (to: string) => ({ emit: (event: string, data: any) => sent.push({ to, event, data }) }) } as any;
};

function startWithHumans(humanSeats: PlayerPosition[]) {
  const io = mockIo();
  const mgr = new RoomManager(io);
  const host = mockSocket('h0');
  const { room, seat } = mgr.createRoom(host, 'Host', DEFAULT_RULES_CONFIG, humanSeats[0]);
  humanSeats.slice(1).forEach((pos) => mgr.joinRoom(mockSocket(`h${pos}`), room.code, `Human${pos}`, pos));
  expect(mgr.startMatch(host, room.code, seat.sessionToken).success).toBe(true);
  return { io, mgr, room, hostToken: seat.sessionToken };
}

/** Advance fake time until `done` or the time budget runs out. */
function runUntil(room: LanRoom, done: () => boolean, budgetMs = 20 * 60 * 1000) {
  for (let t = 0; t < budgetMs && !done(); t += 250) vi.advanceTimersByTime(250);
  return done();
}

describe('Computer players in LAN rooms', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a solo host plays a full deal with 3 computer players (bidding → trump → double → 8 tricks)', () => {
    const { room } = startWithHumans([0]);
    expect(room.seats.filter((s) => s.isCpu)).toHaveLength(3);
    const finished = runUntil(room, () => {
      const p = room.gameState!.phase;
      return p === 'ROUND_ENDED' || p === 'MATCH_ENDED';
    });
    expect(finished).toBe(true);
    const gs = room.gameState!;
    expect(gs.completedTricks).toHaveLength(8);
    expect(gs.roundHistory).toHaveLength(1);
    const total = gs.roundHistory[0].team0CardPoints + gs.roundHistory[0].team1CardPoints;
    expect(total).toBe(29);
  });

  it('computer players act within a couple of seconds instead of waiting out the 15s timer', () => {
    const { room } = startWithHumans([0]);
    // Get to a moment where a computer player must bid.
    runUntil(room, () => room.gameState!.phase === 'BIDDING' && room.seats[room.gameState!.currentTurn].isCpu, 60_000);
    const gs = room.gameState!;
    if (gs.phase !== 'BIDDING') return; // deal resolved before a CPU bid (all-pass redeal etc.)
    const bidsBefore = gs.bids.length;
    const roundBefore = gs.roundNumber;
    vi.advanceTimersByTime(1500 + 1500 + 100); // max think time + deal-animation grace
    const after = room.gameState!;
    expect(after.bids.length > bidsBefore || after.phase !== 'BIDDING' || after.roundNumber !== roundBefore).toBe(true);
  });

  it('computer defenders vote in the Double window and the deal moves on', () => {
    const { mgr, room, hostToken } = startWithHumans([0, 2]);
    const gs = room.gameState!;
    gs.dealerIndex = 3;
    gs.biddingOrder = [0, 1, 2, 3];
    gs.currentTurn = 0;
    gs.bids = [];
    expect(mgr.handleBid(room.code, hostToken, 24).success).toBe(true);
    // Seat 1 (CPU) bids or passes on its own; seat 2 (human) will time out to PASS.
    runUntil(room, () => room.gameState!.phase !== 'BIDDING', 60_000);
    if (room.gameState!.highestBidder === 0) {
      mgr.handleSelectTrump(room.code, hostToken, 'SPADES');
    }
    runUntil(room, () => room.gameState!.phase === 'DOUBLE_DECISION' || room.gameState!.phase === 'TRICK_PLAY', 60_000);
    runUntil(room, () => room.gameState!.phase === 'TRICK_PLAY', 60_000);
    expect(room.gameState!.phase).toBe('TRICK_PLAY');
    if (room.gameState!.highestBidder === 0) {
      // Both defenders were computer players: both must have voted (or one doubled).
      const votes = room.gameState!.doubleVotes || {};
      expect(Boolean(votes[1] || votes[3])).toBe(true);
    }
  });

  it('a late human can join a running match and replace a computer player', () => {
    const { mgr, room } = startWithHumans([0]);
    const cpuSeat = room.seats.find((s) => s.isCpu)!;
    const res = mgr.joinRoom(mockSocket('late'), room.code, 'Latecomer', cpuSeat.position);
    expect(res.success).toBe(true);
    expect(room.seats[cpuSeat.position].isCpu).toBe(false);
    expect(room.seats[cpuSeat.position].playerName).toBe('Latecomer');
    expect(room.gameState!.players[cpuSeat.position].isCpu).toBe(false);
    expect(room.gameState!.players[cpuSeat.position].name).toBe('Latecomer');
  });

  it('when a human leaves mid-match a computer player takes the seat and keeps playing', () => {
    const { mgr, room } = startWithHumans([0, 2]);
    const partnerToken = room.seats[2].sessionToken;
    mgr.leaveRoom(mockSocket('h2'), room.code, partnerToken);
    expect(room.seats[2].isCpu).toBe(true);
    expect(room.seats[2].connected).toBe(true);
    const finished = runUntil(room, () => ['ROUND_ENDED', 'MATCH_ENDED'].includes(room.gameState!.phase));
    expect(finished).toBe(true);
  });

  it('pauses when every human has dropped and resumes when one reconnects', () => {
    const { mgr, room, hostToken } = startWithHumans([0]);
    const before = room.gameState!.version;
    mgr.handleDisconnect('h0');
    expect(room.activeTurn).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(room.gameState!.version).toBe(before);

    const back = mgr.reconnectSeat(mockSocket('h0b'), room.code, hostToken);
    expect(back.success).toBe(true);
    expect(room.activeTurn).not.toBeNull();
    runUntil(room, () => room.gameState!.version > before, 60_000);
    expect(room.gameState!.version).toBeGreaterThan(before);
  });

  it('never makes a computer player the host', () => {
    const { mgr, room } = startWithHumans([0, 2]);
    mgr.leaveRoom(mockSocket('h0'), room.code, room.seats[0].sessionToken);
    const host = room.seats.find((s) => s.isHost)!;
    expect(host.position).toBe(2);
    expect(host.isCpu).toBe(false);
  });
});
