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

  it('should retain all 4 cards on trick completion and not emit trick-won popups', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_trick');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    room.seats.forEach((s) => { s.isCpu = false; });

    // Transition straight to trick play with controlled hands
    room.gameState!.phase = 'TRICK_PLAY';
    room.gameState!.currentTurn = 0;
    room.gameState!.currentTrickLead = 0;
    room.gameState!.currentTrickCards = [];
    room.gameState!.trumpMode = 'suit';
    room.gameState!.trumpSuit = 'SPADES';
    room.gameState!.isTrumpRevealed = false;

    room.gameState!.hands[0] = ['J_HEARTS'];
    room.gameState!.hands[1] = ['9_HEARTS'];
    room.gameState!.hands[2] = ['A_HEARTS'];
    room.gameState!.hands[3] = ['10_HEARTS'];

    // Play 4 cards
    mgr.handlePlayCard(room.code, room.seats[0].sessionToken, 'J_HEARTS');
    mgr.handlePlayCard(room.code, room.seats[1].sessionToken, '9_HEARTS');
    mgr.handlePlayCard(room.code, room.seats[2].sessionToken, 'A_HEARTS');
    const play4 = mgr.handlePlayCard(room.code, room.seats[3].sessionToken, '10_HEARTS');

    expect(play4.success).toBe(true);
    // All 4 cards must remain visible in currentTrickCards for the 1-second pause & collection animation!
    expect(room.gameState?.currentTrickCards).toHaveLength(4);

    // Verify TRICK_COMPLETED socket event was broadcast to all clients
    const roomEvents: Array<{ event: string; data: any }> = io.roomMessages[room.code] || [];
    const trickCompletedEvent = roomEvents.find((e: { event: string; data: any }) => e.event === 'TRICK_COMPLETED');
    expect(trickCompletedEvent).toBeDefined();
    expect(trickCompletedEvent?.data.trick.winner).toBe(0); // Jack of Hearts wins!

    // Verify NO trick-won notification popup was broadcast
    const notifEvents = roomEvents.filter((e: { event: string; data: any }) => e.event === 'in_table_notification');
    const hasTrickWonNotif = notifEvents.some((e: { event: string; data: any }) => e.data.message?.includes('Trick won'));
    expect(hasTrickWonNotif).toBe(false);
  });

  it('should handle PASS actions sequentially from seats 1, 2, and 3, enforce dealer bid, and advance turns', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_bidding_pass');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', { ...DEFAULT_RULES_CONFIG, forcedDealerBid: true }, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    room.seats.forEach((s) => { s.isCpu = false; });

    // Set dealer to Seat 0 (Alice), so bidding order is [1, 2, 3, 0]
    room.gameState!.dealerIndex = 0;
    room.gameState!.biddingOrder = [1, 2, 3, 0];
    room.gameState!.biddingTurnIndex = 0;
    room.gameState!.currentTurn = 1;
    room.gameState!.bids = [];
    room.gameState!.phase = 'BIDDING';

    // Seat 1 tries out of turn? (Seat 2 tries to pass before Seat 1)
    const outOfTurn = mgr.handleBid(room.code, room.seats[2].sessionToken, 'PASS');
    expect(outOfTurn.success).toBe(false);
    expect(outOfTurn.error).toContain('Not your turn');

    // Seat 1 passes legally
    const pass1 = mgr.handleBid(room.code, room.seats[1].sessionToken, 'PASS');
    expect(pass1.success).toBe(true);
    expect(room.gameState?.bids).toHaveLength(1);
    expect(room.gameState?.bids[0]).toMatchObject({ playerIndex: 1, bid: 'PASS' });
    expect(room.gameState?.currentTurn).toBe(2);

    // Seat 2 passes legally
    const pass2 = mgr.handleBid(room.code, room.seats[2].sessionToken, 'PASS');
    expect(pass2.success).toBe(true);
    expect(room.gameState?.bids).toHaveLength(2);
    expect(room.gameState?.currentTurn).toBe(3);

    // Seat 3 passes legally
    const pass3 = mgr.handleBid(room.code, room.seats[3].sessionToken, 'PASS');
    expect(pass3.success).toBe(true);
    expect(room.gameState?.bids).toHaveLength(3);
    expect(room.gameState?.currentTurn).toBe(0); // Dealer's turn!

    // As dealer on 4th turn with all 3 previous players passed, dealer CANNOT pass when forcedDealerBid is true
    const illegalDealerPass = mgr.handleBid(room.code, hostSeat.sessionToken, 'PASS');
    expect(illegalDealerPass.success).toBe(false);
    expect(illegalDealerPass.error).toContain('Dealer is required to make the minimum opening bid');

    // Dealer bids 16 (minimum legal bid)
    const dealerBid = mgr.handleBid(room.code, hostSeat.sessionToken, 16);
    expect(dealerBid.success).toBe(true);
    expect(room.gameState?.phase).toBe('TRUMP_SELECTION');
    expect(room.gameState?.highestBid).toBe(16);
    expect(room.gameState?.highestBidder).toBe(0);
  });

  it('should automatically re-deal cards when all 4 players pass and forced dealer is disabled', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_all_pass');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', { ...DEFAULT_RULES_CONFIG, forcedDealerBid: false }, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    room.seats.forEach((s) => { s.isCpu = false; });

    // Set dealer to Seat 0, bidding order [1, 2, 3, 0]
    room.gameState!.dealerIndex = 0;
    room.gameState!.biddingOrder = [1, 2, 3, 0];
    room.gameState!.biddingTurnIndex = 0;
    room.gameState!.currentTurn = 1;
    room.gameState!.bids = [];
    room.gameState!.phase = 'BIDDING';

    mgr.handleBid(room.code, room.seats[1].sessionToken, 'PASS');
    mgr.handleBid(room.code, room.seats[2].sessionToken, 'PASS');
    mgr.handleBid(room.code, room.seats[3].sessionToken, 'PASS');
    const pass4 = mgr.handleBid(room.code, hostSeat.sessionToken, 'PASS');

    expect(pass4.success).toBe(true);
    // Void deal handled by redealing: dealer rotated to Seat 1, new deal in BIDDING phase!
    expect(room.gameState?.dealerIndex).toBe(1);
    expect(room.gameState?.phase).toBe('BIDDING');
    expect(room.gameState?.bids).toHaveLength(0);
  });

  it('should increment roundNumber and rotate dealer across three consecutive deals', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_consecutive_deals');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    // Deal 1: Start Match
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    expect(room.gameState?.roundNumber).toBe(1);
    const deal1Dealer = room.gameState!.dealerIndex;

    // Simulate round 1 completion
    room.gameState!.playerPoints = { 0: 12, 1: 5, 2: 7, 3: 4 };
    room.gameState!.phase = 'ROUND_ENDED';

    // Deal 2: Next Round
    const nextRes1 = mgr.handleNextRound(room.code, hostSeat.sessionToken);
    expect(nextRes1.success).toBe(true);
    expect(room.gameState?.roundNumber).toBe(2);
    expect(room.gameState?.dealerIndex).toBe(((deal1Dealer + 1) % 4));
    expect(room.gameState?.phase).toBe('BIDDING');
    // Points must reset to 0 for the new deal!
    expect(room.gameState?.playerPoints).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
    // Hand must have 4 initial cards
    expect(room.gameState?.hands[0]).toHaveLength(4);

    // Simulate round 2 completion
    room.gameState!.playerPoints = { 0: 8, 1: 15, 2: 3, 3: 2 };
    room.gameState!.phase = 'ROUND_ENDED';

    // Deal 3: Next Round
    const nextRes2 = mgr.handleNextRound(room.code, hostSeat.sessionToken);
    expect(nextRes2.success).toBe(true);
    expect(room.gameState?.roundNumber).toBe(3);
    expect(room.gameState?.dealerIndex).toBe(((deal1Dealer + 2) % 4));
    expect(room.gameState?.phase).toBe('BIDDING');
    expect(room.gameState?.playerPoints).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
    expect(room.gameState?.hands[0]).toHaveLength(4);
  });

  it('should execute timeout fallbacks silently without broadcasting TIMEOUT_AUTO_PLAY notifications', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_timeout_silent');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    room.seats.forEach((s) => { s.isCpu = false; });

    room.gameState!.dealerIndex = 0;
    room.gameState!.currentTurn = 1;
    room.gameState!.biddingOrder = [1, 2, 3, 0];
    room.gameState!.bids = [];
    room.gameState!.phase = 'BIDDING';

    // Clear messages
    io.roomMessages[room.code] = [];

    // Trigger timeout fallback on Seat 1
    (mgr as any).executeTimeoutFallback(room, 1);

    // Bidding turn must advance to Seat 2
    expect(room.gameState?.currentTurn).toBe(2);
    expect(room.gameState?.bids).toHaveLength(1);
    expect(room.gameState?.bids[0].bid).toBe('PASS');

    // Verify ZERO TIMEOUT_AUTO_PLAY notifications were broadcast!
    const roomEvents: Array<{ event: string; data: any }> = io.roomMessages[room.code] || [];
    const timeoutNotifs = roomEvents.filter(
      (e) => e.event === 'in_table_notification' && e.data?.type === 'TIMEOUT_AUTO_PLAY'
    );
    expect(timeoutNotifs).toHaveLength(0);
  });

  it('should strictly enforce the 30-second deadline and reject late human actions', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_timer_strict');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    room.seats.forEach((s) => { s.isCpu = false; });

    // Set up active turn with an expired deadline
    const currentTurn = room.gameState!.currentTurn;
    const currentSeat = room.seats.find((s) => s.position === currentTurn)!;

    expect(room.activeTurn).toBeDefined();
    expect(room.activeTurn?.deadline).toBeGreaterThan(Date.now());

    // Artificially expire the deadline
    room.activeTurn!.deadline = Date.now() - 5000;

    // Player attempts to bid after deadline has expired
    const lateBidRes = mgr.handleBid(room.code, currentSeat.sessionToken, 16);
    expect(lateBidRes.success).toBe(false);
    expect(lateBidRes.error).toMatch(/expired/i);
  });

  it('should atomically resolve the race between timeout fallback and human action', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_race_resolution');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    room.seats.forEach((s) => { s.isCpu = false; });

    const turnPos = room.gameState!.currentTurn;
    const seat = room.seats.find((s) => s.position === turnPos)!;

    // Simulate timeout fallback resolution
    expect(room.activeTurn?.resolved).toBe(false);
    (mgr as any).executeTimeoutFallback(room, turnPos);

    // After fallback resolves the turn, any subsequent human action for that same turn is rejected
    const lateBid = mgr.handleBid(room.code, seat.sessionToken, 16);
    expect(lateBid.success).toBe(false);
    expect(lateBid.error).toMatch(/resolved|turn/i);
  });

  it('should support Ask to Reveal Trump with unique request IDs and deduplicate identical requests', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_trump_reveal');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    room.seats.forEach((s) => { s.isCpu = false; });

    // Fast-forward to TRICK_PLAY with concealed trump in Clubs
    room.gameState!.phase = 'TRICK_PLAY';
    room.gameState!.trumpSuit = 'CLUBS';
    room.gameState!.isTrumpRevealed = false;
    room.gameState!.currentTurn = 1;
    // Lead is HEARTS
    room.gameState!.currentTrickCards = [{ cardId: 'J_HEARTS', playerIndex: 0 }];
    // Seat 1 holds NO HEARTS, only Spades and Diamonds
    room.gameState!.hands[1] = ['K_SPADES', 'Q_DIAMONDS'];

    const seat1 = room.seats.find((s) => s.position === 1)!;

    const reqPayload = {
      requestId: 'req_test_123',
      playerPosition: 1 as any,
      roundNumber: room.gameState!.roundNumber,
      trickNumber: room.gameState!.currentTrickNumber,
    };

    // First request: legal and successful
    const revealRes1 = mgr.handleRevealTrump(room.code, seat1.sessionToken, reqPayload);
    expect(revealRes1.success).toBe(true);
    expect(room.gameState?.isTrumpRevealed).toBe(true);
    expect(room.gameState?.trumpRevealedBy).toBe(1);

    // Duplicate request with the exact same requestId is safely accepted idempotently
    const revealRes2 = mgr.handleRevealTrump(room.code, seat1.sessionToken, reqPayload);
    expect(revealRes2.success).toBe(true);
  });

  it('should reject Ask to Reveal Trump if the player can legally follow the lead suit', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_cannot_reveal');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    room.seats.forEach((s) => { s.isCpu = false; });

    room.gameState!.phase = 'TRICK_PLAY';
    room.gameState!.trumpSuit = 'CLUBS';
    room.gameState!.isTrumpRevealed = false;
    room.gameState!.currentTurn = 1;
    // Lead is HEARTS
    room.gameState!.currentTrickCards = [{ cardId: 'J_HEARTS', playerIndex: 0 }];
    // Seat 1 holds a Heart! (Must follow suit!)
    room.gameState!.hands[1] = ['10_HEARTS', 'K_SPADES'];

    const seat1 = room.seats.find((s) => s.position === 1)!;

    const revealRes = mgr.handleRevealTrump(room.code, seat1.sessionToken);
    expect(revealRes.success).toBe(false);
    expect(revealRes.error).toMatch(/follow suit/i);
    expect(room.gameState?.isTrumpRevealed).toBe(false);
  });
});
