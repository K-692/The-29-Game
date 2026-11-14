import { describe, it, expect } from 'vitest';
import { RoomManager, SeatInfo } from '../../server/roomManager';
import { DEFAULT_RULES_CONFIG } from './types';

// Mock Socket for server-side testing
function createMockSocket(id: string) {
  const roomsJoined = new Set<string>();
  const emittedEvents: Array<{ event: string; data: any }> = [];

  return {
    id,
    join: (room: string) => roomsJoined.add(room),
    leave: (room: string) => roomsJoined.delete(room),
    emit: (event: string, data: any) => emittedEvents.push({ event, data }),
    roomsJoined,
    emittedEvents,
  } as any;
}

// Mock IO server
function createMockIo() {
  const roomMessages: Record<string, Array<{ event: string; data: any }>> = {};

  return {
    to: (room: string) => ({
      emit: (event: string, data: any) => {
        if (!roomMessages[room]) roomMessages[room] = [];
        roomMessages[room].push({ event, data });
      },
    }),
    roomMessages,
  } as any;
}

describe('LAN Room Manager & Multiplayer Logic', () => {
  it('should generate unpredictable 6-character room codes', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const codes = new Set<string>();

    for (let i = 0; i < 50; i++) {
      const code = mgr.generateRoomCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      codes.add(code);
    }

    // High entropy: all 50 codes unique
    expect(codes.size).toBe(50);
  });

  it('should create room with exactly 4 seats mapped to teams', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_1');

    const { room, seat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    expect(room.code).toHaveLength(6);
    expect(room.seats).toHaveLength(4);

    // Seat 0: Bottom, Team A
    expect(room.seats[0].position).toBe(0);
    expect(room.seats[0].team).toBe(0);
    expect(room.seats[0].playerName).toBe('Alice');
    expect(room.seats[0].isHost).toBe(true);

    // Seat 1: Left, Team B
    expect(room.seats[1].position).toBe(1);
    expect(room.seats[1].team).toBe(1);

    // Seat 2: Top, Team A (Partner)
    expect(room.seats[2].position).toBe(2);
    expect(room.seats[2].team).toBe(0);

    // Seat 3: Right, Team B
    expect(room.seats[3].position).toBe(3);
    expect(room.seats[3].team).toBe(1);
  });

  it('should allow human players to select and switch vacant seats', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_1');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Host', DEFAULT_RULES_CONFIG, 0);

    const clientSocket = createMockSocket('client_socket_1');
    const joinRes = mgr.joinRoom(clientSocket, room.code, 'Bob', 2); // Prefers Partner Seat 2 (Top)

    expect(joinRes.success).toBe(true);
    expect(joinRes.seat?.position).toBe(2);
    expect(joinRes.seat?.playerName).toBe('Bob');

    // Bob switches from Seat 2 (Top, Team A) to Seat 1 (Left, Team B)
    const switchRes = mgr.selectSeat(clientSocket, room.code, joinRes.seat!.sessionToken, 1);
    expect(switchRes.success).toBe(true);
    expect(room.seats[1].playerName).toBe('Bob');
    expect(room.seats[2].socketId).toBeNull(); // Seat 2 is now vacant
  });

  it('should auto-fill all vacant seats with CPU bots when host starts match', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_1');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    // Only Alice is in the room. When Alice starts the match, seats 1, 2, 3 must become bots!
    const startRes = mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    expect(startRes.success).toBe(true);
    expect(room.isStarted).toBe(true);
    expect(room.gameState).not.toBeNull();

    // Verify seats
    expect(room.seats[0].isCpu).toBe(false); // Alice
    expect(room.seats[1].isCpu).toBe(true);  // Bot
    expect(room.seats[2].isCpu).toBe(true);  // Bot Partner
    expect(room.seats[3].isCpu).toBe(true);  // Bot

    // 4 cards dealt to each player
    expect(room.gameState?.hands[0]).toHaveLength(4);
    expect(room.gameState?.hands[1]).toHaveLength(4);
    expect(room.gameState?.hands[2]).toHaveLength(4);
    expect(room.gameState?.hands[3]).toHaveLength(4);

    // Initial phase is BIDDING
    expect(room.gameState?.phase).toBe('BIDDING');
  });

  it('should prevent outside players from joining after match has started (room locked)', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_1');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

    // An outside player tries to join locked room
    const outsiderSocket = createMockSocket('outsider_socket');
    const joinRes = mgr.joinRoom(outsiderSocket, room.code, 'Eve');

    expect(joinRes.success).toBe(false);
    expect(joinRes.error).toContain('already in progress');
  });

  it('should allow disconnected players to reconnect to their exact seat with session token', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_1');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    const clientSocket = createMockSocket('client_socket_1');
    const joinRes = mgr.joinRoom(clientSocket, room.code, 'Bob', 2);
    const bobToken = joinRes.seat!.sessionToken;

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

    // Bob disconnects
    mgr.handleDisconnect('client_socket_1');
    expect(room.seats[2].connected).toBe(false);

    // Bob reconnects with a new socket and his session token
    const newBobSocket = createMockSocket('client_socket_reconnect');
    const reconnectRes = mgr.reconnectSeat(newBobSocket, room.code, bobToken);

    expect(reconnectRes.success).toBe(true);
    expect(reconnectRes.seat?.position).toBe(2);
    expect(room.seats[2].connected).toBe(true);
    expect(room.seats[2].socketId).toBe('client_socket_reconnect');
    expect(reconnectRes.gameState).toBeDefined();
  });

  it('should assign authentic Indian human names to auto-filled CPU players with no bot tags', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_names');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Aarav', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

    // Seats 1, 2, 3 are CPU
    const cpuSeats = room.seats.filter((s) => s.isCpu);
    expect(cpuSeats).toHaveLength(3);
    for (const s of cpuSeats) {
      expect(s.playerName).not.toMatch(/bot/i);
      expect(s.playerName).not.toMatch(/cpu/i);
      expect(s.playerName).not.toMatch(/computer/i);
      expect(s.playerName.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should accept Joker / No Trump and 7th Card options in LAN handleSelectTrump', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_trump');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    expect(room.gameState).toBeDefined();

    // Set all seats to human for deterministic step-by-step auction testing
    room.seats.forEach((s) => {
      s.isCpu = false;
    });

    // Force dealer to Seat 3 so Seat 0 (Alice) is first bidder:
    room.gameState!.dealerIndex = 3;
    room.gameState!.biddingOrder = [0, 1, 2, 3];
    room.gameState!.biddingTurnIndex = 0;
    room.gameState!.currentTurn = 0;

    // Alice bids 16
    const bid1 = mgr.handleBid(room.code, hostSeat.sessionToken, 16);
    expect(bid1.success).toBe(true);

    // Other 3 seats pass (via session tokens)
    const pass1 = mgr.handleBid(room.code, room.seats[1].sessionToken, 'PASS');
    const pass2 = mgr.handleBid(room.code, room.seats[2].sessionToken, 'PASS');
    const pass3 = mgr.handleBid(room.code, room.seats[3].sessionToken, 'PASS');
    expect(pass1.success).toBe(true);
    expect(pass2.success).toBe(true);
    expect(pass3.success).toBe(true);

    // Bidding phase should now be complete, phase = TRUMP_SELECTION
    expect(room.gameState?.phase).toBe('TRUMP_SELECTION');
    expect(room.gameState?.highestBidder).toBe(0);

    // Alice selects NO_TRUMP
    const trumpRes = mgr.handleSelectTrump(room.code, hostSeat.sessionToken, 'NO_TRUMP');
    expect(trumpRes.success).toBe(true);
    expect(room.gameState?.trumpMode).toBe('no-trump');
    expect(room.gameState?.phase).toBe('TRICK_PLAY');
  });
});
