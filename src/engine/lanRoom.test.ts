import { describe, it, expect } from 'vitest';
import { RoomManager, SeatInfo } from '../../server/roomManager';
import { DEFAULT_RULES_CONFIG } from './types';
import { getPlayableCards } from './tricks';
import { completeTrickTransition } from './gameManager';

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

/** Seats three more human players so the host can start (no computer players exist). */
function fillSeats(mgr: RoomManager, code: string) {
  const sockets = [1, 2, 3].map((i) => createMockSocket(`player_socket_${code}_${i}`));
  sockets.forEach((sock, i) => {
    const res = mgr.joinRoom(sock, code, `Friend ${i + 1}`);
    expect(res.success).toBe(true);
  });
  return sockets;
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

  it('should refuse to start until all 4 seats are filled by real players', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_1');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    const early = mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    expect(early.success).toBe(false);
    expect(early.error).toMatch(/3 more players/);
    expect(room.isStarted).toBe(false);

    fillSeats(mgr, room.code);
    const startRes = mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    expect(startRes.success).toBe(true);
    expect(room.isStarted).toBe(true);
    expect(room.seats.map((s) => s.playerName)).toEqual(['Alice', 'Friend 1', 'Friend 2', 'Friend 3']);

    // 4 cards dealt to each player
    for (const pos of [0, 1, 2, 3] as const) {
      expect(room.gameState?.hands[pos]).toHaveLength(4);
    }
    expect(room.gameState?.phase).toBe('BIDDING');
  });

  it('should only let the host start, and not restart a match in progress', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_only');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);
    fillSeats(mgr, room.code);

    const guest = room.seats[1];
    expect(mgr.startMatch(hostSocket, room.code, guest.sessionToken).success).toBe(false);
    expect(mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken).success).toBe(true);
    const again = mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    expect(again.success).toBe(false);
    expect(again.error).toMatch(/in progress/);
  });

  it('should hand the host role over when the host leaves the lobby', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_leaving');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);
    fillSeats(mgr, room.code);

    mgr.leaveRoom(hostSocket, room.code, hostSeat.sessionToken);
    expect(room.seats[0].sessionToken).toBe('');
    expect(room.seats.filter((s) => s.isHost)).toHaveLength(1);
    expect(room.seats[1].isHost).toBe(true);
  });

  it('should let a new player take over a disconnected seat mid-match', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_takeover');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);
    const [s1] = fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

    // Full table: nobody else can join
    expect(mgr.joinRoom(createMockSocket('late'), room.code, 'Late').success).toBe(false);

    mgr.handleDisconnect(s1.id);
    expect(room.seats[1].connected).toBe(false);

    const sub = createMockSocket('substitute');
    const res = mgr.joinRoom(sub, room.code, 'Sub');
    expect(res.success).toBe(true);
    expect(res.seat?.position).toBe(1);
    expect(room.gameState?.players[1].name).toBe('Sub');
    expect(room.gameState?.players[1].connected).toBe(true);
  });

  it('should send each player only their own hand (no full game state leak)', () => {
    const io = createMockIo();
    const sent: Array<{ to: string; event: string; data: any }> = [];
    io.to = (target: string) => ({
      emit: (event: string, data: any) => sent.push({ to: target, event, data }),
    });
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_private');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);
    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

    const updates = sent.filter((m) => m.event === 'game_state_update');
    expect(updates.length).toBe(4);
    for (const u of updates) {
      expect(u.data.gameState).toBeUndefined();
      expect(u.data.publicState.hands).toBeUndefined();
      expect(u.data.publicState.myHand).toEqual(room.gameState!.hands[u.data.myPosition as 0 | 1 | 2 | 3]);
    }
  });

  it('should reject a 5th card while the completed trick is being collected', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_fifth');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);
    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

    room.gameState!.phase = 'TRICK_PLAY';
    room.gameState!.currentTurn = 0;
    room.gameState!.currentTrickLead = 0;
    room.gameState!.currentTrickCards = [];
    room.gameState!.trumpSuit = 'SPADES';
    room.gameState!.hands[0] = ['J_HEARTS', '7_CLUBS'];
    room.gameState!.hands[1] = ['9_HEARTS', '8_CLUBS'];
    room.gameState!.hands[2] = ['A_HEARTS', 'K_CLUBS'];
    room.gameState!.hands[3] = ['10_HEARTS', 'Q_CLUBS'];
    room.activeTurn = null;

    const plays = ['J_HEARTS', '9_HEARTS', 'A_HEARTS', '10_HEARTS'];
    plays.forEach((card, pos) => {
      expect(mgr.handlePlayCard(room.code, room.seats[pos].sessionToken, card).success).toBe(true);
    });
    expect(room.gameState!.currentTrickCards).toHaveLength(4);
    // Seat 3 is still "currentTurn" during the pause — must be rejected
    const extra = mgr.handlePlayCard(room.code, room.seats[3].sessionToken, 'Q_CLUBS');
    expect(extra.success).toBe(false);
    expect(room.gameState!.currentTrickCards).toHaveLength(4);
  });

  it('should prevent outside players from joining after match has started (room locked)', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_1');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

    // An outside player tries to join locked room
    const outsiderSocket = createMockSocket('outsider_socket');
    const joinRes = mgr.joinRoom(outsiderSocket, room.code, 'Eve');

    expect(joinRes.success).toBe(false);
    expect(joinRes.error).toContain('in progress');
  });

  it('should allow disconnected players to reconnect to their exact seat with session token', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_1');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    const clientSocket = createMockSocket('client_socket_1');
    const joinRes = mgr.joinRoom(clientSocket, room.code, 'Bob', 2);
    const bobToken = joinRes.seat!.sessionToken;

    mgr.joinRoom(createMockSocket('c_left'), room.code, 'Carl', 1);
    mgr.joinRoom(createMockSocket('c_right'), room.code, 'Dina', 3);
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

  it('should accept Joker / No Trump and 7th Card options in LAN handleSelectTrump', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_trump');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    expect(room.gameState).toBeDefined();


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
    expect(room.gameState?.phase).toBe('TRUMP_ANNOUNCEMENT');
    expect(room.gameState?.specialAnnouncement?.type).toBe('NO_TRUMP');
  });

  it('should retain all 4 cards on trick completion and not emit trick-won popups', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_socket_trick');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Alice', DEFAULT_RULES_CONFIG, 0);

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

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

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

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

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

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
    fillSeats(mgr, room.code);
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

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

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

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

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

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

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

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

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

    fillSeats(mgr, room.code);
    mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);

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

  it('should play through an entire 4-player match round and reach ROUND_ENDED with correct summary', () => {
    const io = createMockIo();
    const mgr = new RoomManager(io);
    const hostSocket = createMockSocket('host_bot_round');
    const { room, seat: hostSeat } = mgr.createRoom(hostSocket, 'Krish', DEFAULT_RULES_CONFIG, 0);

    fillSeats(mgr, room.code);
    const startRes = mgr.startMatch(hostSocket, room.code, hostSeat.sessionToken);
    expect(startRes.success).toBe(true);
    expect(room.gameState?.phase).toBe('BIDDING');

    // Force dealer to Seat 3 so Seat 0 (human) is first bidder in biddingOrder [0, 1, 2, 3]
    room.gameState!.dealerIndex = 3;
    room.gameState!.currentTurn = 0;
    room.gameState!.biddingOrder = [0, 1, 2, 3];
    room.gameState!.biddingTurnIndex = 0;
    room.gameState!.bids = [];

    // Human (Seat 0) bids 16
    const b0 = mgr.handleBid(room.code, hostSeat.sessionToken, 16);
    expect(b0.success).toBe(true);

    // Players 1, 2, 3 pass
    const s1 = room.seats[1];
    const s2 = room.seats[2];
    const s3 = room.seats[3];
    mgr.handleBid(room.code, s1.sessionToken, 'PASS');
    mgr.handleBid(room.code, s2.sessionToken, 'PASS');
    mgr.handleBid(room.code, s3.sessionToken, 'PASS');

    expect(room.gameState?.phase).toBe('TRUMP_SELECTION');
    expect(room.gameState?.highestBidder).toBe(0);

    // Host selects SPADES
    const trumpRes = mgr.handleSelectTrump(room.code, hostSeat.sessionToken, 'SPADES');
    expect(trumpRes.success).toBe(true);
    expect(room.gameState?.phase).toBe('DOUBLE_DECISION');

    // Defending team (Seat 1 and Seat 3) pass Double
    const doubleRes1 = mgr.handleDoubleDecision(room.code, s1.sessionToken, 'PASS');
    expect(doubleRes1.success).toBe(true);
    expect(room.gameState?.phase).toBe('DOUBLE_DECISION');

    const doubleRes2 = mgr.handleDoubleDecision(room.code, s3.sessionToken, 'PASS');
    expect(doubleRes2.success).toBe(true);
    expect(room.gameState?.phase).toBe('TRICK_PLAY');
    expect(room.gameState?.trumpSuit).toBe('SPADES');
    // Cards dealt after Double phase concludes
    expect(room.gameState?.hands[0].length).toBe(8);

    // Play all 8 tricks
    for (let trick = 1; trick <= 8; trick++) {
      expect(room.gameState?.currentTrickNumber).toBe(trick);

      for (let cardIndex = 0; cardIndex < 4; cardIndex++) {
        const turn = room.gameState!.currentTurn;
        const currentSeat = room.seats.find((s) => s.position === turn)!;
        const hand = room.gameState!.hands[turn];

        const leadCardId = room.gameState!.currentTrickCards.length > 0 
          ? room.gameState!.currentTrickCards[0].cardId 
          : null;

        // Pick legal card
        const playable = getPlayableCards(
          hand,
          leadCardId,
          room.gameState!.trumpSuit,
          room.gameState!.isTrumpRevealed,
          room.gameState!.trumpMode
        );

        const cardToPlay = playable[0];
        const playRes = mgr.handlePlayCard(room.code, currentSeat.sessionToken, cardToPlay);
        expect(playRes.success).toBe(true);
      }

      // Authoritatively transition trick
      const lastTrick = room.gameState!.lastCompletedTrick!;
      expect(lastTrick).toBeDefined();
      room.gameState = completeTrickTransition(room.gameState!, lastTrick);
    }

    // Verify all 8 tricks played and round concluded
    expect(room.gameState?.completedTricks).toHaveLength(8);
    expect(room.gameState?.phase).toBe('ROUND_ENDED');
    expect(room.gameState?.roundHistory).toHaveLength(1);
    const summary = room.gameState!.roundHistory[0];
    expect(summary.roundNumber).toBe(1);
    expect(summary.contractBid).toBe(16);
    expect(summary.trumpSuit).toBe('SPADES');
  });
});
