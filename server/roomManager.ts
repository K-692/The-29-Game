import { Server, Socket } from 'socket.io';
import { 
  CARD_MANIFEST, 
  Suit 
} from '../src/assets/cardManifest.js';
import { 
  DEFAULT_RULES_CONFIG, 
  GamePhase,
  GameRulesConfig, 
  GameState, 
  PlayerInfo, 
  PlayerPosition, 
  PublicGameState, 
  Team,
  TrumpSelectionChoice
} from '../src/engine/types.js';
import { 
  applyBid, 
  applyCardPlay, 
  applyPairDeclaration, 
  applyTrumpReveal, 
  applyTrumpSelection, 
  completeTrickTransition,
  createInitialGame, 
  getPublicGameState, 
  startNewRound 
} from '../src/engine/gameManager.js';
import { 
  checkBotPairDeclaration, 
  getBotBidDecision, 
  getBotCardPlay, 
  getBotTrumpSelection, 
  shouldBotRequestTrumpReveal 
} from '../src/engine/bot.js';
import { getPlayableCards } from '../src/engine/tricks.js';
import { isLegalBid } from '../src/engine/bidding.js';
import { getRandomBotNames } from '../src/engine/botNames.js';

export const ANIMAL_AVATARS = [
  '🦊', '🐼', '🐯', '🐸', '🦁', '🐻', '🐵', '🐺', 
  '🐨', '🦉', '🐧', '🐱', '🐰', '🦄', '🦖', '🦋'
];

export function getRandomDistinctAvatars(count: number, exclude: string[] = []): string[] {
  const excludeSet = new Set(exclude);
  const pool = ANIMAL_AVATARS.filter((a) => !excludeSet.has(a));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export interface SeatInfo {
  position: PlayerPosition;
  team: Team;
  playerId: string;
  playerName: string;
  avatar: string;
  isHost: boolean;
  isCpu: boolean;
  socketId: string | null;
  connected: boolean;
  sessionToken: string;
}

export interface ActiveTurnContext {
  turnId: string;
  position: PlayerPosition;
  phase: GamePhase;
  actionType: 'BID' | 'TRUMP_SELECTION' | 'PLAY_CARD';
  startTime: number;
  deadline: number;
  version: number;
  resolved: boolean;
}

export interface LanRoom {
  code: string;
  hostId: string;
  rules: GameRulesConfig;
  isStarted: boolean;
  seats: SeatInfo[];
  gameState: GameState | null;
  turnTimer: NodeJS.Timeout | null;
  remainingSeconds: number;
  turnDeadline: number;
  botTurnTimeout: NodeJS.Timeout | null;
  activeTurn: ActiveTurnContext | null;
  revealedTrumpRequestId: string | null;
  roundEndedTimer: NodeJS.Timeout | null;
}

export class RoomManager {
  private io: Server;
  private rooms: Map<string, LanRoom> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Generates a 6-character alphanumeric room code.
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Generates a unique session token for reconnection.
   */
  private generateSessionToken(): string {
    return 'tok_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  /**
   * Creates a brand new LAN game room.
   */
  public createRoom(
    socket: Socket,
    hostName: string,
    rules: GameRulesConfig = DEFAULT_RULES_CONFIG,
    preferredSeat: PlayerPosition = 0
  ): { room: LanRoom; seat: SeatInfo } {
    const code = this.generateRoomCode();
    const hostId = socket.id;
    const sessionToken = this.generateSessionToken();
    const initialAvatars = getRandomDistinctAvatars(4);

    const seats: SeatInfo[] = [
      {
        position: 0,
        team: 0,
        playerId: preferredSeat === 0 ? hostId : '',
        playerName: preferredSeat === 0 ? hostName : 'Empty Seat (Bottom - Team A)',
        avatar: initialAvatars[0],
        isHost: preferredSeat === 0,
        isCpu: false,
        socketId: preferredSeat === 0 ? socket.id : null,
        connected: preferredSeat === 0,
        sessionToken: preferredSeat === 0 ? sessionToken : '',
      },
      {
        position: 1,
        team: 1,
        playerId: preferredSeat === 1 ? hostId : '',
        playerName: preferredSeat === 1 ? hostName : 'Empty Seat (Left - Team B)',
        avatar: initialAvatars[1],
        isHost: preferredSeat === 1,
        isCpu: false,
        socketId: preferredSeat === 1 ? socket.id : null,
        connected: preferredSeat === 1,
        sessionToken: preferredSeat === 1 ? sessionToken : '',
      },
      {
        position: 2,
        team: 0,
        playerId: preferredSeat === 2 ? hostId : '',
        playerName: preferredSeat === 2 ? hostName : 'Empty Seat (Top - Team A)',
        avatar: initialAvatars[2],
        isHost: preferredSeat === 2,
        isCpu: false,
        socketId: preferredSeat === 2 ? socket.id : null,
        connected: preferredSeat === 2,
        sessionToken: preferredSeat === 2 ? sessionToken : '',
      },
      {
        position: 3,
        team: 1,
        playerId: preferredSeat === 3 ? hostId : '',
        playerName: preferredSeat === 3 ? hostName : 'Empty Seat (Right - Team B)',
        avatar: initialAvatars[3],
        isHost: preferredSeat === 3,
        isCpu: false,
        socketId: preferredSeat === 3 ? socket.id : null,
        connected: preferredSeat === 3,
        sessionToken: preferredSeat === 3 ? sessionToken : '',
      },
    ];

    const room: LanRoom = {
      code,
      hostId,
      rules,
      isStarted: false,
      seats,
      gameState: null,
      turnTimer: null,
      remainingSeconds: 30,
      turnDeadline: 0,
      botTurnTimeout: null,
      activeTurn: null,
      revealedTrumpRequestId: null,
      roundEndedTimer: null,
    };

    this.rooms.set(code, room);
    socket.join(code);

    const hostSeat = seats[preferredSeat];
    return { room, seat: hostSeat };
  }

  /**
   * Joins an existing LAN room.
   */
  public joinRoom(
    socket: Socket,
    code: string,
    playerName: string,
    preferredSeat?: PlayerPosition
  ): { success: boolean; error?: string; room?: LanRoom; seat?: SeatInfo } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      return { success: false, error: `Room ${code} was not found on this LAN server.` };
    }

    if (room.isStarted) {
      return { success: false, error: `Room ${code} match is already in progress.` };
    }

    // Determine target seat
    let targetIndex: number = -1;
    if (preferredSeat !== undefined && !room.seats[preferredSeat].socketId && !room.seats[preferredSeat].isCpu) {
      targetIndex = preferredSeat;
    } else {
      // Find lowest vacant seat
      targetIndex = room.seats.findIndex((s) => !s.socketId && !s.isCpu && s.playerId === '');
    }

    if (targetIndex === -1) {
      return { success: false, error: `Room ${code} is full (all 4 seats are occupied).` };
    }

    const sessionToken = this.generateSessionToken();
    const seat = room.seats[targetIndex];
    seat.playerId = socket.id;
    seat.playerName = playerName;
    seat.socketId = socket.id;
    seat.connected = true;
    seat.sessionToken = sessionToken;
    seat.isCpu = false;

    socket.join(code);
    return { success: true, room, seat };
  }

  /**
   * Selects or changes seat in lobby before game starts.
   */
  public selectSeat(
    socket: Socket,
    code: string,
    sessionToken: string,
    targetPosition: PlayerPosition
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.isStarted) return { success: false, error: 'Cannot change seat after match started.' };

    const currentSeat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!currentSeat) return { success: false, error: 'Invalid session.' };

    if (currentSeat.position === targetPosition) return { success: true };

    const targetSeat = room.seats[targetPosition];
    if (targetSeat.connected && targetSeat.socketId && targetSeat.socketId !== socket.id) {
      return { success: false, error: `Seat ${targetPosition + 1} is already occupied by another player.` };
    }

    // Vacate current seat
    const prevName = currentSeat.playerName;
    const prevAvatar = currentSeat.avatar;
    const isHost = currentSeat.isHost;

    currentSeat.playerId = '';
    currentSeat.playerName = `Empty Seat (${this.getSeatLabel(currentSeat.position)})`;
    currentSeat.socketId = null;
    currentSeat.connected = false;
    currentSeat.sessionToken = '';
    currentSeat.isHost = false;

    // Occupy target seat
    targetSeat.playerId = socket.id;
    targetSeat.playerName = prevName;
    targetSeat.avatar = prevAvatar;
    targetSeat.socketId = socket.id;
    targetSeat.connected = true;
    targetSeat.sessionToken = sessionToken;
    targetSeat.isHost = isHost;
    targetSeat.isCpu = false;

    this.broadcastRoomUpdate(room);
    return { success: true };
  }

  /**
   * Reconnects a player to their existing seat using their session token.
   */
  public reconnectSeat(
    socket: Socket,
    code: string,
    sessionToken: string
  ): { success: boolean; error?: string; seat?: SeatInfo; gameState?: PublicGameState } {
    const room = this.rooms.get(code);
    if (!room) return { success: false, error: 'Room not found.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Session token expired or seat not found.' };

    seat.socketId = socket.id;
    seat.connected = true;
    socket.join(code);

    let publicState: PublicGameState | undefined = undefined;
    if (room.gameState) {
      publicState = getPublicGameState(room.gameState, seat.position);
      if (room.turnDeadline > 0) {
        const remaining = Math.max(0, Math.ceil((room.turnDeadline - Date.now()) / 1000));
        const turnPos = room.gameState.phase === 'TRUMP_SELECTION' 
          ? (room.gameState.highestBidder ?? room.gameState.currentTurn)
          : room.gameState.currentTurn;
        const turnId = room.activeTurn?.turnId || `${room.code}_turn_${turnPos}`;
        socket.emit('timer_tick', {
          turnId,
          remainingSeconds: remaining,
          turnDeadline: room.turnDeadline,
          turnPosition: turnPos,
          phase: room.gameState.phase,
        });
      }
    }

    this.broadcastRoomUpdate(room);
    this.broadcastNotification(room, 'INFO', `${seat.playerName} reconnected to Seat ${seat.position + 1}.`);

    return { success: true, seat, gameState: publicState };
  }

  /**
   * Handles player disconnection.
   */
  public handleDisconnect(socketId: string) {
    for (const room of this.rooms.values()) {
      const seat = room.seats.find((s) => s.socketId === socketId);
      if (seat) {
        seat.connected = false;
        seat.socketId = null;

        if (!room.isStarted) {
          // If match hasn't started yet, free up the seat completely unless it's host
          if (!seat.isHost) {
            seat.playerId = '';
            seat.playerName = `Empty Seat (${this.getSeatLabel(seat.position)})`;
            seat.sessionToken = '';
          }
        }

        this.broadcastRoomUpdate(room);
        this.broadcastNotification(room, 'INFO', `${seat.playerName} disconnected (reconnecting...)`);
        break;
      }
    }
  }

  /**
   * Starts the match. Fills any vacant seats with CPU bots automatically.
   */
  public startMatch(
    socket: Socket,
    code: string,
    sessionToken: string
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { success: false, error: 'Room not found.' };

    const hostSeat = room.seats.find((s) => s.sessionToken === sessionToken && s.isHost);
    if (!hostSeat) return { success: false, error: 'Only the room host can start the match.' };

    // Fill all unoccupied seats with realistic CPU bots (random human names)
    const existingHumanNames = room.seats
      .filter((s) => s.connected && s.socketId && !s.isCpu)
      .map((s) => s.playerName);

    const existingAvatars = room.seats
      .filter((s) => s.connected && s.socketId && !s.isCpu)
      .map((s) => s.avatar);

    const vacantSeats = room.seats.filter((s) => !s.connected || !s.socketId);
    const botNames = getRandomBotNames(vacantSeats.length, existingHumanNames);
    const newAvatars = getRandomDistinctAvatars(vacantSeats.length, existingAvatars);

    let botIdx = 0;
    let avatarIdx = 0;
    const players: PlayerInfo[] = [];

    room.seats.forEach((seat) => {
      if (!seat.connected || !seat.socketId) {
        seat.isCpu = true;
        seat.connected = true;
        seat.sessionToken = `tok_cpu_${seat.position}_${Math.random().toString(36).substring(2, 9)}`;
        seat.playerId = `cpu_${seat.position}_${Math.random().toString(36).substring(2, 6)}`;
        seat.playerName = botNames[botIdx++] || `Player ${seat.position + 1}`;
        seat.avatar = newAvatars[avatarIdx++] || seat.avatar || '🦊';
      }

      players.push({
        id: seat.playerId,
        name: seat.playerName,
        avatar: seat.avatar,
        position: seat.position,
        team: seat.team,
        isHost: seat.isHost,
        isCpu: seat.isCpu,
        isReady: true,
        connected: seat.connected,
      });
    });

    room.isStarted = true;
    const initial = createInitialGame(room.code, players, room.rules);
    room.gameState = startNewRound(initial);

    this.broadcastRoomUpdate(room);
    this.broadcastGameState(room);
    this.startTurnTimer(room);
    setTimeout(() => {
      this.checkAndExecuteBotTurn(room);
    }, 2100);

    return { success: true };
  }

  /**
   * Handles a player or bot bid in the single-round auction.
   */
  public handleBid(
    code: string,
    sessionToken: string,
    bid: number | 'PASS'
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    if (room.gameState.currentTurn !== seat.position || room.gameState.phase !== 'BIDDING') {
      return { success: false, error: 'Not your turn to bid.' };
    }

    const turnIndex = room.gameState.bids.length;
    const isForcedDealer = 
      turnIndex === 3 &&
      room.gameState.bids.every((b) => b.bid === 'PASS') &&
      seat.position === room.gameState.dealerIndex &&
      room.gameState.rules.forcedDealerBid;

    const validation = isLegalBid(bid, room.gameState.highestBid, room.gameState.rules, isForcedDealer);
    if (!validation.legal) {
      return { success: false, error: validation.reason };
    }

    // Atomic server-authoritative deadline and turn resolution
    const now = Date.now();
    if (room.activeTurn && !seat.isCpu) {
      if (room.activeTurn.resolved) {
        return { success: false, error: 'Turn action already resolved or expired.' };
      }
      if (now > room.activeTurn.deadline + 1000) {
        return { success: false, error: 'Turn deadline has expired.' };
      }
      room.activeTurn.resolved = true;
    }
    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }

    const res = applyBid(room.gameState, seat.position, bid);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    room.gameState = res.state;

    this.broadcastGameState(room);
    this.startTurnTimer(room);
    this.checkAndExecuteBotTurn(room);

    return { success: true };
  }

  /**
   * Handles trump selection from the six options:
   * Hearts, Spades, Clubs, Diamonds, Joker (No Trump), 7th Card.
   */
  public handleSelectTrump(
    code: string,
    sessionToken: string,
    choice: TrumpSelectionChoice
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    if (room.gameState.highestBidder !== seat.position || room.gameState.phase !== 'TRUMP_SELECTION') {
      return { success: false, error: 'You are not the designated trump chooser.' };
    }

    // Atomic server-authoritative deadline and turn resolution
    const now = Date.now();
    if (room.activeTurn && !seat.isCpu) {
      if (room.activeTurn.resolved) {
        return { success: false, error: 'Turn action already resolved or expired.' };
      }
      if (now > room.activeTurn.deadline + 1000) {
        return { success: false, error: 'Turn deadline has expired.' };
      }
      room.activeTurn.resolved = true;
    }
    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }

    const res = applyTrumpSelection(room.gameState, seat.position, choice);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    room.gameState = res.state;

    let notifMsg = `${seat.playerName} has selected and concealed the secret Trump suit.`;
    if (choice === 'NO_TRUMP') {
      notifMsg = `${seat.playerName} selected Joker / No Trump mode!`;
    } else if (choice === 'SEVENTH_CARD') {
      notifMsg = `${seat.playerName} selected 7th Card Trump mode (7th dealt card reserved)!`;
    }

    this.broadcastNotification(
      room, 
      'INFO', 
      notifMsg
    );

    this.broadcastGameState(room);
    this.startTurnTimer(room);
    this.checkAndExecuteBotTurn(room);

    return { success: true };
  }

  /**
   * Handles trump reveal request during trick play.
   */
  public handleRevealTrump(
    code: string,
    sessionToken: string,
    data?: { requestId?: string; playerPosition?: PlayerPosition; roundNumber?: number; trickNumber?: number }
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    // Deduplication check
    if (data?.requestId && room.revealedTrumpRequestId === data.requestId) {
      return { success: true };
    }

    if (room.gameState.phase !== 'TRICK_PLAY' || room.gameState.isTrumpRevealed) {
      return { success: false, error: 'Cannot reveal trump at this time.' };
    }

    const res = applyTrumpReveal(room.gameState, seat.position);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    if (data?.requestId) {
      room.revealedTrumpRequestId = data.requestId;
    }
    room.gameState = res.state;

    let revealMsg = `⚡ ${seat.playerName} revealed the secret Trump suit: ${res.state.trumpSuit}!`;
    if (res.state.trumpMode === 'no-trump') {
      revealMsg = `⚡ ${seat.playerName} revealed: Joker / No Trump mode! No suit has trump priority.`;
    } else if (res.state.trumpMode === 'seventh-card' && res.state.seventhCard) {
      const cardInfo = CARD_MANIFEST[res.state.seventhCard.cardId];
      const cardName = cardInfo ? `${cardInfo.rank} of ${cardInfo.suit}` : res.state.seventhCard.cardId;
      revealMsg = `⚡ ${seat.playerName} revealed the 7th Card Trump: ${cardName}! Trump is ${res.state.trumpSuit} and card returned to hand.`;
    }

    this.broadcastNotification(
      room, 
      'TRUMP_REVEALED', 
      revealMsg
    );

    this.broadcastGameState(room);
    return { success: true };
  }

  /**
   * Handles playing a card in a trick.
   */
  public handlePlayCard(
    code: string,
    sessionToken: string,
    cardId: string
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    if (room.gameState.currentTurn !== seat.position || room.gameState.phase !== 'TRICK_PLAY') {
      return { success: false, error: 'Not your turn to play.' };
    }

    // Atomic server-authoritative deadline and turn resolution
    const now = Date.now();
    if (room.activeTurn && !seat.isCpu) {
      if (room.activeTurn.resolved) {
        return { success: false, error: 'Turn action already resolved or expired.' };
      }
      if (now > room.activeTurn.deadline + 1000) {
        return { success: false, error: 'Turn deadline has expired.' };
      }
      room.activeTurn.resolved = true;
    }
    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }

    const myHand = room.gameState.hands[seat.position];
    if (!myHand.includes(cardId)) {
      return { success: false, error: 'Card not in your hand.' };
    }

    const leadCardId = room.gameState.currentTrickCards.length > 0 
      ? room.gameState.currentTrickCards[0].cardId 
      : null;

    const playable = getPlayableCards(
      myHand,
      leadCardId,
      room.gameState.trumpSuit,
      room.gameState.isTrumpRevealed,
      room.gameState.trumpMode
    );

    if (!playable.includes(cardId)) {
      return { success: false, error: 'Illegal card play: You must follow the lead suit.' };
    }

    const res = applyCardPlay(room.gameState, seat.position, cardId);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    room.gameState = res.state;

    this.broadcastGameState(room);

    if (res.trickCompleted) {
      const lastTrick = res.trickCompleted;

      // Clear active turn during collection pause
      room.activeTurn = null;

      // Broadcast trick completed event so all connected clients synchronize the collection
      this.io.to(room.code).emit('TRICK_COMPLETED', { trick: lastTrick });

      // Delay next turn timer & bot action by 1600ms so all connected clients observe
      // the complete 4-card trick for 1 second, followed by smooth collection animation
      setTimeout(() => {
        if (!room.gameState) return;
        // Authoritatively finalize trick transition, point counters, and next trick / round end
        room.gameState = completeTrickTransition(room.gameState, lastTrick);
        this.broadcastGameState(room);

        if (room.gameState.phase === 'TRICK_PLAY') {
          this.startTurnTimer(room);
          this.checkAndExecuteBotTurn(room);
        } else if (room.gameState.phase === 'ROUND_ENDED') {
          // Auto-advance to next deal after 15 seconds if idle so the game NEVER halts
          if (room.roundEndedTimer) clearTimeout(room.roundEndedTimer);
          room.roundEndedTimer = setTimeout(() => {
            if (room.gameState && room.gameState.phase === 'ROUND_ENDED') {
              const anySeat = room.seats.find((s) => s.isHost) || room.seats[0];
              if (anySeat) {
                this.handleNextRound(room.code, anySeat.sessionToken);
              }
            }
          }, 15000);
        }
      }, 1600);
    } else {
      this.startTurnTimer(room);
      this.checkAndExecuteBotTurn(room);
    }

    return { success: true };
  }

  /**
   * Handles Pair / Royals declaration.
   */
  public handleDeclarePair(
    code: string,
    sessionToken: string
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    const res = applyPairDeclaration(room.gameState, seat.position);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    room.gameState = res.state;

    this.broadcastNotification(
      room, 
      'PAIR_DECLARED', 
      `👑 ${seat.playerName} declared Pair / Royals! Target adjusted by ±4 points.`
    );

    this.broadcastGameState(room);
    return { success: true };
  }

  /**
   * Deals the next round when previous deal ends.
   * Rotates dealer by one seat clockwise for subsequent deals.
   */
  public handleNextRound(
    code: string,
    sessionToken: string
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found in room.' };

    if (room.gameState.phase !== 'ROUND_ENDED') {
      return { success: false, error: 'Current round has not concluded yet.' };
    }

    if (room.roundEndedTimer) {
      clearTimeout(room.roundEndedTimer);
      room.roundEndedTimer = null;
    }

    const nextDealer = ((room.gameState.dealerIndex + 1) % 4) as PlayerPosition;
    room.gameState = startNewRound(room.gameState, nextDealer);
    this.broadcastGameState(room);
    this.startTurnTimer(room);
    setTimeout(() => {
      this.checkAndExecuteBotTurn(room);
    }, 2100);

    return { success: true };
  }

  /**
   * Server-authoritative turn countdown timer:
   * Strictly 30 seconds for all actionable turns (Bidding, Trump Selection, Card Play).
   */
  private startTurnTimer(room: LanRoom) {
    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }

    if (!room.gameState || (room.gameState.phase !== 'BIDDING' && room.gameState.phase !== 'TRUMP_SELECTION' && room.gameState.phase !== 'TRICK_PLAY')) {
      room.activeTurn = null;
      return;
    }

    const turnPos = room.gameState.phase === 'TRUMP_SELECTION' 
      ? (room.gameState.highestBidder ?? room.gameState.currentTurn)
      : room.gameState.currentTurn;

    const actionType: 'BID' | 'TRUMP_SELECTION' | 'PLAY_CARD' =
      room.gameState.phase === 'BIDDING'
        ? 'BID'
        : room.gameState.phase === 'TRUMP_SELECTION'
        ? 'TRUMP_SELECTION'
        : 'PLAY_CARD';

    const totalDuration = 30; // Strictly 30 seconds for all human turns
    const now = Date.now();
    room.remainingSeconds = totalDuration;
    room.turnDeadline = now + totalDuration * 1000;

    const turnId = `${room.code}_r${room.gameState.roundNumber}_t${room.gameState.currentTrickNumber}_p${room.gameState.phase}_pos${turnPos}_v${room.gameState.version}_${now}`;

    room.activeTurn = {
      turnId,
      position: turnPos,
      phase: room.gameState.phase,
      actionType,
      startTime: now,
      deadline: room.turnDeadline,
      version: room.gameState.version,
      resolved: false,
    };

    // Broadcast initial tick with turnId
    this.io.to(room.code).emit('timer_tick', {
      turnId,
      remainingSeconds: room.remainingSeconds,
      turnDeadline: room.turnDeadline,
      turnPosition: turnPos,
      phase: room.gameState.phase,
    });

    room.turnTimer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((room.turnDeadline - Date.now()) / 1000));
      room.remainingSeconds = remaining;

      this.io.to(room.code).emit('timer_tick', {
        turnId,
        remainingSeconds: remaining,
        turnDeadline: room.turnDeadline,
        turnPosition: turnPos,
        phase: room.gameState?.phase || 'TRICK_PLAY',
      });

      if (remaining <= 0) {
        if (room.turnTimer) {
          clearInterval(room.turnTimer);
          room.turnTimer = null;
        }

        // Atomic check: only fire fallback if this turn is not already resolved
        if (room.activeTurn && room.activeTurn.turnId === turnId && !room.activeTurn.resolved) {
          room.activeTurn.resolved = true;
          this.executeTimeoutFallback(room, turnPos);
        }
      }
    }, 1000);
  }

  /**
   * Server-authoritative smart fallback play when turn timer expires.
   */
  private executeTimeoutFallback(room: LanRoom, turnPosition: PlayerPosition) {
    if (!room.gameState) return;

    const seat = room.seats.find((s) => s.position === turnPosition);
    if (!seat) return;
    const playerHand = room.gameState.hands[turnPosition];

    // Clear activeTurn so authoritative fallback can proceed without self-rejection
    room.activeTurn = null;

    if (room.gameState.phase === 'BIDDING') {
      // Check if forced dealer on scheduled 4th turn
      const turnIndex = room.gameState.bids.length;
      const isForcedDealer = 
        turnIndex === 3 &&
        room.gameState.bids.every((b) => b.bid === 'PASS') &&
        turnPosition === room.gameState.dealerIndex &&
        room.gameState.rules.forcedDealerBid;

      const fallbackBid: number | 'PASS' = isForcedDealer 
        ? room.gameState.rules.minBid 
        : 'PASS';

      // Silent authoritative timeout execution
      this.handleBid(room.code, seat.sessionToken, fallbackBid);
    } else if (room.gameState.phase === 'TRUMP_SELECTION') {
      const bestChoice = getBotTrumpSelection(playerHand);
      // Silent authoritative timeout execution
      this.handleSelectTrump(room.code, seat.sessionToken, bestChoice);
    } else if (room.gameState.phase === 'TRICK_PLAY') {
      const leadCardId = room.gameState.currentTrickCards.length > 0 
        ? room.gameState.currentTrickCards[0].cardId 
        : null;

      const chosenCard = getBotCardPlay(
        playerHand,
        leadCardId,
        room.gameState.trumpSuit,
        room.gameState.isTrumpRevealed,
        room.gameState.currentTrickCards,
        turnPosition,
        room.gameState.trumpMode
      );

      // Silent authoritative timeout execution
      this.handlePlayCard(room.code, seat.sessionToken, chosenCard);
    }
  }

  /**
   * Checks if current turn is a CPU Bot and schedules realistic bot action.
   */
  private checkAndExecuteBotTurn(room: LanRoom) {
    if (room.botTurnTimeout) {
      clearTimeout(room.botTurnTimeout);
      room.botTurnTimeout = null;
    }

    if (!room.gameState) return;

    const currentTurn = room.gameState.phase === 'TRUMP_SELECTION' 
      ? (room.gameState.highestBidder ?? room.gameState.currentTurn)
      : room.gameState.currentTurn;

    const seat = room.seats.find((s) => s.position === currentTurn);
    if (!seat || !seat.isCpu) return;

    const botDelay = 900 + Math.floor(Math.random() * 400);

    room.botTurnTimeout = setTimeout(() => {
      if (!room.gameState) return;

      const botHand = room.gameState.hands[currentTurn];

      if (room.gameState.phase === 'BIDDING') {
        const turnIndex = room.gameState.bids.length;
        const isForcedDealer = 
          turnIndex === 3 &&
          room.gameState.bids.every((b) => b.bid === 'PASS') &&
          currentTurn === room.gameState.dealerIndex &&
          room.gameState.rules.forcedDealerBid;

        const bid = getBotBidDecision(
          botHand,
          room.gameState.highestBid,
          room.gameState.rules,
          isForcedDealer
        );

        this.handleBid(room.code, seat.sessionToken, bid);
      } else if (room.gameState.phase === 'TRUMP_SELECTION') {
        const choice = getBotTrumpSelection(botHand);
        this.handleSelectTrump(room.code, seat.sessionToken, choice);
      } else if (room.gameState.phase === 'TRICK_PLAY') {
        // Check if bot should reveal trump
        const leadCardId = room.gameState.currentTrickCards.length > 0 
          ? room.gameState.currentTrickCards[0].cardId 
          : null;

        if (
          !room.gameState.isTrumpRevealed &&
          leadCardId &&
          shouldBotRequestTrumpReveal(
            botHand,
            leadCardId,
            room.gameState.trumpSuit,
            room.gameState.isTrumpRevealed,
            room.gameState.currentTrickCards,
            currentTurn
          )
        ) {
          this.handleRevealTrump(room.code, seat.sessionToken);
        }

        // Check if bot should declare pair
        if (
          checkBotPairDeclaration(
            botHand,
            currentTurn,
            room.gameState.trumpSuit,
            room.gameState.isTrumpRevealed,
            room.gameState.completedTricks,
            room.gameState.pairDeclaration
          )
        ) {
          this.handleDeclarePair(room.code, seat.sessionToken);
        }

        const cardId = getBotCardPlay(
          botHand,
          leadCardId,
          room.gameState.trumpSuit,
          room.gameState.isTrumpRevealed,
          room.gameState.currentTrickCards,
          currentTurn
        );

        this.handlePlayCard(room.code, seat.sessionToken, cardId);
      }
    }, botDelay);
  }

  /**
   * Broadcasts sanitized public room information to all sockets in the room.
   */
  public broadcastRoomUpdate(room: LanRoom) {
    const payload = {
      roomCode: room.code,
      hostId: room.hostId,
      isStarted: room.isStarted,
      rules: room.rules,
      seats: room.seats.map((s) => ({
        position: s.position,
        team: s.team,
        playerId: s.playerId,
        playerName: s.playerName,
        avatar: s.avatar,
        isHost: s.isHost,
        isCpu: s.isCpu,
        connected: s.connected,
      })),
    };

    this.io.to(room.code).emit('room_update', payload);
  }

  /**
   * Broadcasts game state to each seat individually (keeping private cards secure).
   */
  public broadcastGameState(room: LanRoom) {
    if (!room.gameState) return;

    for (const seat of room.seats) {
      if (seat.socketId) {
        const publicState = getPublicGameState(room.gameState, seat.position);
        publicState.turnDeadline = room.turnDeadline;
        this.io.to(seat.socketId).emit('game_state_update', {
          gameState: room.gameState, // Full state for host/debug if needed
          publicState,
          myPosition: seat.position,
        });
      }
    }
  }

  /**
   * Broadcasts in-table notification message to all room players.
   */
  public broadcastNotification(
    room: LanRoom, 
    type: 'INFO' | 'TIMEOUT_AUTO_PLAY' | 'TRUMP_REVEALED' | 'PAIR_DECLARED', 
    message: string, 
    cardId?: string
  ) {
    this.io.to(room.code).emit('in_table_notification', {
      type,
      message,
      cardId,
      timestamp: Date.now(),
    });
  }

  private getSeatLabel(pos: PlayerPosition): string {
    switch (pos) {
      case 0: return 'Bottom - Team A';
      case 1: return 'Left - Team B';
      case 2: return 'Top - Team A';
      case 3: return 'Right - Team B';
    }
  }
}
