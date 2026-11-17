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
  applyDoubleDecision,
  applyPairDeclaration, 
  applyRedoubleDecision,
  applySecondDeal,
  applyTrumpAnnouncementComplete,
  applyTrumpReveal, 
  applyTrumpSelection, 
  completeTrickTransition,
  createInitialGame, 
  getPublicGameState, 
  startNewRound 
} from '../src/engine/gameManager.js';
import { getAutoCardPlay, getAutoTrumpSelection } from '../src/engine/autoPlay.js';
import {
  getBotBidDecision,
  getBotCardPlay,
  getBotDoubleDecision,
  getBotRedoubleDecision,
  getBotTrumpSelection,
  shouldBotRequestTrumpReveal,
} from '../src/engine/bot.js';
import { getRandomBotNames } from '../src/engine/botNames.js';
import { getPlayableCards } from '../src/engine/tricks.js';
import { isLegalBid } from '../src/engine/bidding.js';

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
  /** Played by the server's computer player (fills seats no human took). */
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
  activeTurn: ActiveTurnContext | null;
  revealedTrumpRequestId: string | null;
  roundEndedTimer: NodeJS.Timeout | null;
  trumpAnnouncementTimer?: NodeJS.Timeout | null;
  trickTransitionTimer?: NodeJS.Timeout | null;
  /** Pending computer-player action and the state it was scheduled for. */
  cpuTimer?: NodeJS.Timeout | null;
  cpuTimerKey?: string | null;
  /** Deletes a started room nobody has come back to. */
  abandonTimer?: NodeJS.Timeout | null;
  /** Lobby-only: grace timers that free a seat if its player does not come back. */
  seatReleaseTimers?: Partial<Record<PlayerPosition, NodeJS.Timeout>>;
}

/** Turn length for a connected human player (seconds). */
export const TURN_SECONDS = 15;
/** Double / Re-Double decision window (seconds). */
export const DOUBLE_DECISION_SECONDS = 10;
/** Turn length when the player whose turn it is has disconnected (seconds). */
export const DISCONNECTED_TURN_SECONDS = 3;
/** Extra time on the first bid of a deal so the dealing animation can finish. */
export const DEAL_ANIMATION_GRACE_MS = 1500;
/** How long a lobby seat is held for a player who dropped (page refresh, Wi-Fi blip). */
export const LOBBY_SEAT_HOLD_MS = 20000;
/** Pause showing the full 4-card trick before it is collected. */
export const TRICK_DISPLAY_MS = 1600;
/** How long a computer player "thinks" before acting (randomised within this range). */
export const CPU_THINK_MS: [number, number] = [900, 1500];
/** Computer players wait a little longer on Double/Re-Double so humans can read the panel. */
export const CPU_DECISION_MS: [number, number] = [1600, 2600];
/** A started room with no human connected is removed after this long. */
export const ABANDONED_ROOM_MS = 10 * 60 * 1000;

const SEAT_LABELS: Record<PlayerPosition, string> = {
  0: 'Bottom - Team A',
  1: 'Left - Team B',
  2: 'Top - Team A',
  3: 'Right - Team B',
};

const teamOf = (pos: PlayerPosition): Team => (pos === 0 || pos === 2 ? 0 : 1);

export class RoomManager {
  private io: Server;
  private rooms: Map<string, LanRoom> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  public getRoom(code: string): LanRoom | undefined {
    return this.rooms.get(code.toUpperCase());
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

  private emptySeat(seat: SeatInfo) {
    seat.playerId = '';
    seat.playerName = `Empty Seat (${SEAT_LABELS[seat.position]})`;
    seat.socketId = null;
    seat.connected = false;
    seat.sessionToken = '';
    seat.isHost = false;
    seat.isCpu = false;
  }

  private isSeatTaken(seat: SeatInfo): boolean {
    return seat.sessionToken !== '';
  }

  private clearSeatReleaseTimer(room: LanRoom, pos: PlayerPosition) {
    const t = room.seatReleaseTimers?.[pos];
    if (t) {
      clearTimeout(t);
      delete room.seatReleaseTimers![pos];
    }
  }

  /** Hands the host role to the first connected player if the current host is gone. */
  private ensureHost(room: LanRoom) {
    const host = room.seats.find((s) => s.isHost);
    if (host && host.connected) return;
    const next = room.seats.find((s) => s.connected && s.socketId);
    if (!next) return;
    if (host) host.isHost = false;
    next.isHost = true;
    room.hostId = next.playerId;
    this.broadcastNotification(room, 'INFO', `${next.playerName} is now the room host.`);
  }

  private clearRoomTimers(room: LanRoom) {
    if (room.turnTimer) clearInterval(room.turnTimer);
    if (room.roundEndedTimer) clearTimeout(room.roundEndedTimer);
    if (room.trumpAnnouncementTimer) clearTimeout(room.trumpAnnouncementTimer);
    if (room.trickTransitionTimer) clearTimeout(room.trickTransitionTimer);
    if (room.cpuTimer) clearTimeout(room.cpuTimer);
    if (room.abandonTimer) clearTimeout(room.abandonTimer);
    room.abandonTimer = null;
    room.cpuTimer = null;
    room.cpuTimerKey = null;
    for (const t of Object.values(room.seatReleaseTimers || {})) {
      if (t) clearTimeout(t);
    }
    room.turnTimer = null;
    room.roundEndedTimer = null;
    room.trumpAnnouncementTimer = null;
    room.trickTransitionTimer = null;
    room.seatReleaseTimers = {};
  }

  private deleteRoomIfEmpty(room: LanRoom): boolean {
    const anyoneConnected = room.seats.some((s) => s.connected && s.socketId);
    if (anyoneConnected) return false;
    this.clearRoomTimers(room);
    this.rooms.delete(room.code);
    return true;
  }

  /** Keeps gameState.players in sync with seat names / avatars / connection flags. */
  private syncPlayersFromSeats(room: LanRoom) {
    if (!room.gameState) return;
    room.gameState = {
      ...room.gameState,
      players: room.gameState.players.map((p) => {
        const seat = room.seats[p.position];
        return {
          ...p,
          id: seat.playerId,
          name: seat.playerName,
          avatar: seat.avatar,
          isHost: seat.isHost,
          isCpu: seat.isCpu,
          connected: seat.connected,
        };
      }),
    };
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

    const seats: SeatInfo[] = ([0, 1, 2, 3] as PlayerPosition[]).map((pos) => {
      const isMine = pos === preferredSeat;
      return {
        position: pos,
        team: teamOf(pos),
        playerId: isMine ? hostId : '',
        playerName: isMine ? hostName : `Empty Seat (${SEAT_LABELS[pos]})`,
        avatar: initialAvatars[pos],
        isHost: isMine,
        isCpu: false,
        socketId: isMine ? socket.id : null,
        connected: isMine,
        sessionToken: isMine ? sessionToken : '',
      };
    });

    const room: LanRoom = {
      code,
      hostId,
      rules,
      isStarted: false,
      seats,
      gameState: null,
      turnTimer: null,
      remainingSeconds: TURN_SECONDS,
      turnDeadline: 0,
      activeTurn: null,
      revealedTrumpRequestId: null,
      roundEndedTimer: null,
      trumpAnnouncementTimer: null,
      trickTransitionTimer: null,
      seatReleaseTimers: {},
    };

    this.rooms.set(code, room);
    socket.join(code);

    return { room, seat: seats[preferredSeat] };
  }

  /**
   * Joins an existing LAN room.
   * - In the lobby: takes the preferred (or lowest) vacant seat.
   * - During a match: takes over a seat whose player has disconnected, so a
   *   dropped player (or a substitute) can get straight back into the game.
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

    let targetIndex = -1;

    if (room.isStarted) {
      // A late arrival can replace a computer player or a disconnected human.
      const canTake = (s: SeatInfo) => s.isCpu || !s.connected || !s.socketId;
      if (preferredSeat !== undefined && canTake(room.seats[preferredSeat])) {
        targetIndex = preferredSeat;
      } else {
        targetIndex = room.seats.findIndex(canTake);
      }
      if (targetIndex === -1) {
        return { success: false, error: `Room ${code} match is in progress and all 4 seats have human players.` };
      }
    } else {
      if (preferredSeat !== undefined && !this.isSeatTaken(room.seats[preferredSeat])) {
        targetIndex = preferredSeat;
      } else {
        targetIndex = room.seats.findIndex((s) => !this.isSeatTaken(s));
      }
      if (targetIndex === -1) {
        return { success: false, error: `Room ${code} is full (all 4 seats are occupied).` };
      }
    }

    const sessionToken = this.generateSessionToken();
    const seat = room.seats[targetIndex];
    const replacedCpu = seat.isCpu ? seat.playerName : null;
    this.clearSeatReleaseTimer(room, seat.position);
    seat.isCpu = false;
    seat.playerId = socket.id;
    seat.playerName = playerName;
    seat.socketId = socket.id;
    seat.connected = true;
    seat.sessionToken = sessionToken;

    socket.join(room.code);

    if (room.isStarted) {
      this.ensureHost(room);
      this.syncPlayersFromSeats(room);
      this.broadcastNotification(
        room,
        'INFO',
        replacedCpu
          ? `${playerName} joined and takes over from computer player ${replacedCpu}.`
          : `${playerName} took over Seat ${seat.position + 1}.`
      );
      // If it is this seat's move right now, give the new human a full turn.
      if (!this.resumeIfPaused(room) && room.activeTurn && !room.activeTurn.resolved && this.isSeatDeciding(room, seat.position)) {
        this.restartCurrentCountdown(room);
      }
      this.broadcastGameState(room);
      this.sendTimerSnapshot(room, socket);
    }

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
    if (this.isSeatTaken(targetSeat)) {
      return { success: false, error: `Seat ${targetPosition + 1} is already occupied by another player.` };
    }

    const prevName = currentSeat.playerName;
    const prevAvatar = currentSeat.avatar;
    const isHost = currentSeat.isHost;

    this.emptySeat(currentSeat);

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

    this.clearSeatReleaseTimer(room, seat.position);
    const wasConnected = seat.connected;
    seat.socketId = socket.id;
    seat.playerId = socket.id;
    seat.connected = true;
    socket.join(code);

    this.ensureHost(room);

    let publicState: PublicGameState | undefined = undefined;
    if (room.gameState) {
      this.syncPlayersFromSeats(room);
      publicState = getPublicGameState(room.gameState, seat.position);
    }

    this.broadcastRoomUpdate(room);
    if (room.gameState) {
      this.resumeIfPaused(room);
      this.broadcastGameState(room);
      this.sendTimerSnapshot(room, socket);
    }
    if (!wasConnected) {
      this.broadcastNotification(room, 'INFO', `${seat.playerName} reconnected.`);
    }

    return { success: true, seat, gameState: publicState };
  }

  /** Sends the current countdown to a single (re)connecting socket. */
  private sendTimerSnapshot(room: LanRoom, socket: Socket) {
    if (!room.gameState || room.turnDeadline <= 0) return;
    const remaining = Math.max(0, Math.ceil((room.turnDeadline - Date.now()) / 1000));
    socket.emit('timer_tick', {
      turnId: room.activeTurn?.turnId || `${room.code}_turn`,
      remainingSeconds: remaining,
      turnDeadline: room.turnDeadline,
      turnPosition: room.activeTurn?.position ?? room.gameState.currentTurn,
      phase: room.gameState.phase,
    });
  }

  /**
   * Player explicitly leaves the room (Leave button).
   * Lobby: frees the seat. Match: the seat is marked disconnected (auto-play
   * covers its turns) and can be taken over by anyone who joins with the code.
   */
  public leaveRoom(socket: Socket, code: string, sessionToken: string): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { success: true };
    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    socket.leave(code);
    if (!seat) return { success: true };

    const name = seat.playerName;
    this.clearSeatReleaseTimer(room, seat.position);

    if (!room.isStarted) {
      this.emptySeat(seat);
    } else {
      // A computer player keeps the seat so the remaining humans can play on.
      // Anyone joining later with the room code can take it back over.
      this.makeCpuSeat(room, seat);
      seat.isHost = false;
      this.syncPlayersFromSeats(room);
    }

    if (this.deleteRoomIfEmpty(room)) return { success: true };


    this.ensureHost(room);
    this.syncPlayersFromSeats(room);
    this.broadcastRoomUpdate(room);
    this.broadcastNotification(
      room,
      'INFO',
      room.isStarted ? `${name} left — computer player ${seat.playerName} takes the seat.` : `${name} left the table.`
    );
    if (room.gameState) {
      this.broadcastGameState(room);
      this.accelerateIfDisconnectedTurn(room);
    }
    return { success: true };
  }

  /**
   * Handles player disconnection.
   */
  public handleDisconnect(socketId: string) {
    for (const room of this.rooms.values()) {
      const seat = room.seats.find((s) => s.socketId === socketId);
      if (!seat) continue;

      seat.connected = false;
      seat.socketId = null;

      if (!room.isStarted) {
        // Hold the lobby seat briefly so a page refresh does not lose it.
        this.clearSeatReleaseTimer(room, seat.position);
        if (!room.seatReleaseTimers) room.seatReleaseTimers = {};
        room.seatReleaseTimers[seat.position] = setTimeout(() => {
          delete room.seatReleaseTimers![seat.position];
          if (seat.connected || room.isStarted) return;
          this.emptySeat(seat);
          if (this.deleteRoomIfEmpty(room)) return;
          this.ensureHost(room);
          this.broadcastRoomUpdate(room);
        }, LOBBY_SEAT_HOLD_MS);
      } else {
        this.ensureHost(room);
        this.syncPlayersFromSeats(room);
        if (!this.hasConnectedHuman(room)) {
          this.pauseRoom(room);
        } else {
          this.broadcastGameState(room);
          this.accelerateIfDisconnectedTurn(room);
        }
      }

      this.broadcastRoomUpdate(room);
      this.broadcastNotification(room, 'INFO', `${seat.playerName} disconnected — waiting for them to rejoin.`);
      break;
    }
  }

  /**
   * If the player who must act right now is disconnected, shorten their
   * deadline so the table never sits idle waiting for an empty chair.
   */
  private accelerateIfDisconnectedTurn(room: LanRoom) {
    if (!room.gameState || !room.activeTurn || room.activeTurn.resolved) return;
    const phase = room.gameState.phase;
    let decidingSeats: SeatInfo[] = [];
    if (phase === 'DOUBLE_DECISION' || phase === 'REDOUBLE_DECISION') {
      const biddingTeam = teamOf(room.gameState.highestBidder ?? 0);
      const team = phase === 'DOUBLE_DECISION' ? (biddingTeam === 0 ? 1 : 0) : biddingTeam;
      decidingSeats = room.seats.filter((s) => s.team === team);
    } else {
      decidingSeats = [room.seats[room.activeTurn.position]];
    }
    if (decidingSeats.some((s) => s.connected)) return;

    const fastDeadline = Date.now() + DISCONNECTED_TURN_SECONDS * 1000;
    if (fastDeadline < room.turnDeadline) {
      room.turnDeadline = fastDeadline;
      room.activeTurn.deadline = fastDeadline;
    }
  }

  /**
   * Starts (or restarts after MATCH_ENDED) the match.
   * All four seats must be occupied by connected players — there are no computer players.
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

    if (room.isStarted && room.gameState && room.gameState.phase !== 'MATCH_ENDED') {
      return { success: false, error: 'The match is already in progress.' };
    }

    // Every seat without a connected human is played by a computer player.
    for (const seat of room.seats) {
      const hasHuman = !seat.isCpu && seat.connected && Boolean(seat.socketId);
      if (!hasHuman && !seat.isCpu) {
        this.clearSeatReleaseTimer(room, seat.position);
        this.makeCpuSeat(room, seat);
      }
    }

    this.clearRoomTimers(room);

    const players: PlayerInfo[] = room.seats.map((seat) => ({
      id: seat.playerId,
      name: seat.playerName,
      avatar: seat.avatar,
      position: seat.position,
      team: seat.team,
      isHost: seat.isHost,
      isCpu: seat.isCpu,
      isReady: true,
      connected: seat.connected,
    }));

    room.isStarted = true;
    room.revealedTrumpRequestId = null;
    const initial = createInitialGame(room.code, players, room.rules);
    room.gameState = startNewRound(initial);

    this.broadcastRoomUpdate(room);
    this.startTurnTimer(room);
    this.broadcastGameState(room);

    return { success: true };
  }

  /**
   * Validates that a human action arrives inside the live turn window and
   * atomically claims the turn. Timeout fallbacks pass `fromTimeout`.
   */
  private claimTurn(room: LanRoom, fromTimeout: boolean): { ok: boolean; error?: string } {
    if (fromTimeout || !room.activeTurn) return { ok: true };
    if (room.activeTurn.resolved) {
      return { ok: false, error: 'Turn action already resolved or expired.' };
    }
    if (Date.now() > room.activeTurn.deadline + 1000) {
      return { ok: false, error: 'Turn deadline has expired.' };
    }
    return { ok: true };
  }

  private stopCountdown(room: LanRoom) {
    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }
  }

  /**
   * Single server-authoritative countdown used for every timed decision.
   * Broadcasts `timer_tick` each second and runs `onExpire` exactly once.
   */
  private runCountdown(
    room: LanRoom,
    opts: {
      position: PlayerPosition;
      phase: GamePhase;
      actionType: ActiveTurnContext['actionType'];
      durationMs: number;
      onExpire: () => void;
    }
  ) {
    this.stopCountdown(room);
    if (!room.gameState) return;
    if (!this.hasConnectedHuman(room)) {
      // Nobody is at the table: hold the game until a human comes back.
      room.activeTurn = null;
      room.turnDeadline = 0;
      return;
    }

    const now = Date.now();
    room.turnDeadline = now + opts.durationMs;
    room.remainingSeconds = Math.ceil(opts.durationMs / 1000);

    const turnId = `${room.code}_r${room.gameState.roundNumber}_t${room.gameState.currentTrickNumber}_${opts.phase}_pos${opts.position}_v${room.gameState.version}_${now}`;
    room.activeTurn = {
      turnId,
      position: opts.position,
      phase: opts.phase,
      actionType: opts.actionType,
      startTime: now,
      deadline: room.turnDeadline,
      version: room.gameState.version,
      resolved: false,
    };

    // A disconnected player should not stall the table for the full window.
    this.accelerateIfDisconnectedTurn(room);

    const emitTick = () => {
      const remaining = Math.max(0, Math.ceil((room.turnDeadline - Date.now()) / 1000));
      room.remainingSeconds = remaining;
      this.io.to(room.code).emit('timer_tick', {
        turnId,
        remainingSeconds: Math.min(remaining, TURN_SECONDS),
        turnDeadline: room.turnDeadline,
        turnPosition: opts.position,
        phase: opts.phase,
      });
      return remaining;
    };

    emitTick();
    room.turnTimer = setInterval(() => {
      const remaining = emitTick();
      if (remaining > 0) return;
      this.stopCountdown(room);
      if (room.activeTurn && room.activeTurn.turnId === turnId && !room.activeTurn.resolved) {
        room.activeTurn.resolved = true;
        opts.onExpire();
      }
    }, 1000);
  }

  /**
   * Handles a player bid in the single-round auction.
   */
  public handleBid(
    code: string,
    sessionToken: string,
    bid: number | 'PASS',
    fromTimeout: boolean = false
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

    const claim = this.claimTurn(room, fromTimeout);
    if (!claim.ok) return { success: false, error: claim.error };

    const res = applyBid(room.gameState, seat.position, bid);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    if (room.activeTurn) room.activeTurn.resolved = true;
    this.stopCountdown(room);
    room.gameState = res.state;

    this.startTurnTimer(room);
    this.broadcastGameState(room);

    return { success: true };
  }

  /**
   * Handles trump selection from the six options:
   * Hearts, Spades, Clubs, Diamonds, Joker (No Trump), 7th Card.
   */
  public handleSelectTrump(
    code: string,
    sessionToken: string,
    choice: TrumpSelectionChoice,
    fromTimeout: boolean = false
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    if (room.gameState.highestBidder !== seat.position || room.gameState.phase !== 'TRUMP_SELECTION') {
      return { success: false, error: 'You are not the designated trump chooser.' };
    }

    const claim = this.claimTurn(room, fromTimeout);
    if (!claim.ok) return { success: false, error: claim.error };

    const res = applyTrumpSelection(room.gameState, seat.position, choice);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    if (room.activeTurn) room.activeTurn.resolved = true;
    this.stopCountdown(room);
    room.gameState = res.state;

    let notifMsg = `${seat.playerName} has selected and concealed the secret Trump suit.`;
    if (choice === 'NO_TRUMP') {
      notifMsg = `${seat.playerName} selected Joker / No Trump mode!`;
    } else if (choice === 'SEVENTH_CARD') {
      notifMsg = `${seat.playerName} selected 7th Card Trump mode (7th dealt card reserved)!`;
    }
    this.broadcastNotification(room, 'INFO', notifMsg);

    // Joker / 7th card: 1 second central table announcement before the Double phase
    if (room.gameState.phase === 'TRUMP_ANNOUNCEMENT') {
      room.activeTurn = null;
      room.turnDeadline = 0;
      this.broadcastGameState(room);
      if (room.trumpAnnouncementTimer) clearTimeout(room.trumpAnnouncementTimer);
      room.trumpAnnouncementTimer = setTimeout(() => {
        room.trumpAnnouncementTimer = null;
        if (!room.gameState || room.gameState.phase !== 'TRUMP_ANNOUNCEMENT') return;
        room.gameState = applyTrumpAnnouncementComplete(room.gameState);
        this.startDoublePhase(room);
        this.broadcastGameState(room);
      }, 1000);
      return { success: true };
    }

    this.startDoublePhase(room);
    this.broadcastGameState(room);
    return { success: true };
  }

  /**
   * Stage 1 of the Double phase: the defending team has 10 seconds to DOUBLE or PASS.
   * Either defender can DOUBLE immediately; the team passes only when both pass
   * (or the window expires).
   */
  private startDoublePhase(room: LanRoom) {
    if (!room.gameState || room.gameState.phase !== 'DOUBLE_DECISION') return;

    const biddingTeam = teamOf(room.gameState.highestBidder ?? 0);
    const defendingSeats = room.seats.filter((s) => s.team !== biddingTeam);

    this.runCountdown(room, {
      position: defendingSeats[0].position,
      phase: 'DOUBLE_DECISION',
      actionType: 'BID',
      durationMs: DOUBLE_DECISION_SECONDS * 1000,
      onExpire: () => {
        if (!room.gameState || room.gameState.phase !== 'DOUBLE_DECISION') return;
        const stateWithPass: GameState = {
          ...room.gameState,
          doubleVotes: {
            ...(room.gameState.doubleVotes || {}),
            [defendingSeats[0].position]: room.gameState.doubleVotes?.[defendingSeats[0].position] || 'PASS',
            [defendingSeats[1].position]: room.gameState.doubleVotes?.[defendingSeats[1].position] || 'PASS',
          },
          doubleStatus: 'NONE',
          dealMultiplier: 1,
        };
        room.gameState = applySecondDeal(stateWithPass);
        this.broadcastNotification(room, 'INFO', 'Defending team did not Double (time expired). Deal is 1x.');
        this.startTurnTimer(room);
        this.broadcastGameState(room);
      },
    });
  }

  /**
   * Handles a defending player's DOUBLE / PASS vote.
   */
  public handleDoubleDecision(
    code: string,
    sessionToken: string,
    decision: 'DOUBLE' | 'PASS'
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };
    if (room.gameState.phase !== 'DOUBLE_DECISION') {
      return { success: false, error: 'Not currently in Double decision phase.' };
    }

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    const claim = this.claimTurn(room, false);
    if (!claim.ok) return { success: false, error: claim.error };

    const res = applyDoubleDecision(room.gameState, seat.position, decision);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    room.gameState = res.state;

    if (decision === 'DOUBLE') {
      if (room.activeTurn) room.activeTurn.resolved = true;
      this.broadcastNotification(room, 'INFO', `⚡ ${seat.playerName} DOUBLED the contract! (2x)`);
      this.startRedoublePhase(room);
      this.broadcastGameState(room);
      return { success: true };
    }

    if (room.gameState.phase === 'TRICK_PLAY') {
      // Both defenders passed
      if (room.activeTurn) room.activeTurn.resolved = true;
      this.broadcastNotification(room, 'INFO', 'Defending team passed. Deal is 1x.');
      this.startTurnTimer(room);
    }
    // Otherwise the partner still has time to decide; countdown keeps running.
    this.broadcastGameState(room);
    return { success: true };
  }

  /**
   * Stage 2: the bidding team has 10 seconds to RE-DOUBLE (4x) or PASS (stays 2x).
   */
  private startRedoublePhase(room: LanRoom) {
    if (!room.gameState || room.gameState.phase !== 'REDOUBLE_DECISION') return;

    const biddingTeam = teamOf(room.gameState.highestBidder ?? 0);
    const biddingSeats = room.seats.filter((s) => s.team === biddingTeam);

    this.runCountdown(room, {
      position: biddingSeats[0].position,
      phase: 'REDOUBLE_DECISION',
      actionType: 'BID',
      durationMs: DOUBLE_DECISION_SECONDS * 1000,
      onExpire: () => {
        if (!room.gameState || room.gameState.phase !== 'REDOUBLE_DECISION') return;
        const stateWithPass: GameState = {
          ...room.gameState,
          redoubleVotes: {
            ...(room.gameState.redoubleVotes || {}),
            [biddingSeats[0].position]: room.gameState.redoubleVotes?.[biddingSeats[0].position] || 'PASS',
            [biddingSeats[1].position]: room.gameState.redoubleVotes?.[biddingSeats[1].position] || 'PASS',
          },
          doubleStatus: 'DOUBLED',
          dealMultiplier: 2,
        };
        room.gameState = applySecondDeal(stateWithPass);
        this.broadcastNotification(room, 'INFO', 'Bidding team did not Re-Double (time expired). Deal stays 2x.');
        this.startTurnTimer(room);
        this.broadcastGameState(room);
      },
    });
  }

  /**
   * Handles a bidding-team player's REDOUBLE / PASS vote.
   */
  public handleRedoubleDecision(
    code: string,
    sessionToken: string,
    decision: 'REDOUBLE' | 'PASS'
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };
    if (room.gameState.phase !== 'REDOUBLE_DECISION') {
      return { success: false, error: 'Not currently in Re-Double decision phase.' };
    }

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    const claim = this.claimTurn(room, false);
    if (!claim.ok) return { success: false, error: claim.error };

    const res = applyRedoubleDecision(room.gameState, seat.position, decision);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    room.gameState = res.state;

    if (room.gameState.phase === 'TRICK_PLAY') {
      if (room.activeTurn) room.activeTurn.resolved = true;
      this.broadcastNotification(
        room,
        'INFO',
        decision === 'REDOUBLE'
          ? `💥 ${seat.playerName} RE-DOUBLED the contract! (4x)`
          : 'Bidding team passed Re-Double. Deal stays 2x.'
      );
      this.startTurnTimer(room);
    }
    this.broadcastGameState(room);
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

    if (data?.requestId && room.revealedTrumpRequestId === data.requestId) {
      return { success: true };
    }

    if (
      room.gameState.phase !== 'TRICK_PLAY' ||
      room.gameState.isTrumpRevealed ||
      room.gameState.currentTrickCards.length >= 4
    ) {
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

    this.announceTrumpReveal(room, seat, false);

    this.broadcastGameState(room);
    return { success: true };
  }

  /** Table-wide notifications for a trump reveal (requested or by cutting) and any pair it exposes. */
  private announceTrumpReveal(room: LanRoom, seat: SeatInfo, byCut: boolean) {
    const gs = room.gameState!;
    const suitName = gs.trumpSuit ? gs.trumpSuit.charAt(0) + gs.trumpSuit.slice(1).toLowerCase() : '';
    let msg = byCut
      ? `${seat.playerName} cut with a trump — trump is ${suitName}.`
      : `${seat.playerName} revealed trump: ${suitName}.`;
    if (gs.trumpMode === 'no-trump') {
      msg = `${seat.playerName} revealed: Joker / No Trump.`;
    } else if (gs.trumpMode === 'seventh-card' && gs.seventhCard) {
      const info = CARD_MANIFEST[gs.seventhCard.cardId];
      const cardName = info ? `${info.rank} of ${info.suit.toLowerCase()}` : gs.seventhCard.cardId;
      msg = `7th card revealed: ${cardName} — trump is ${suitName}.`;
    }
    this.broadcastNotification(room, 'TRUMP_REVEALED', msg);

    if (gs.pairDeclaration) {
      const pair = gs.pairDeclaration;
      const owner = room.seats[pair.playerIndex];
      this.broadcastNotification(
        room,
        'PAIR_DECLARED',
        `${owner ? owner.playerName : 'Player'} holds King & Queen of trump — target is now ${pair.adjustedTarget}.`
      );
    }
  }

  /**
   * Handles playing a card in a trick.
   */
  public handlePlayCard(
    code: string,
    sessionToken: string,
    cardId: string,
    fromTimeout: boolean = false
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return { success: false, error: 'Game not active.' };

    const seat = room.seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return { success: false, error: 'Seat not found.' };

    if (room.gameState.currentTurn !== seat.position || room.gameState.phase !== 'TRICK_PLAY') {
      return { success: false, error: 'Not your turn to play.' };
    }

    // The trick is full and being collected — nobody may play until it is cleared.
    if (room.gameState.currentTrickCards.length >= 4) {
      return { success: false, error: 'Wait for the trick to be collected.' };
    }

    const claim = this.claimTurn(room, fromTimeout);
    if (!claim.ok) return { success: false, error: claim.error };

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

    const wasRevealed = room.gameState.isTrumpRevealed;
    const res = applyCardPlay(room.gameState, seat.position, cardId);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    if (room.activeTurn) room.activeTurn.resolved = true;
    this.stopCountdown(room);
    room.gameState = res.state;

    if (!wasRevealed && res.state.isTrumpRevealed) {
      this.announceTrumpReveal(room, seat, true);
    }

    if (res.trickCompleted) {
      const lastTrick = res.trickCompleted;
      room.activeTurn = null;
      room.turnDeadline = 0;
      this.broadcastGameState(room);
      this.io.to(room.code).emit('TRICK_COMPLETED', { trick: lastTrick });

      // Keep the full trick on the table, then collect it and move on.
      if (room.trickTransitionTimer) clearTimeout(room.trickTransitionTimer);
      room.trickTransitionTimer = setTimeout(() => {
        room.trickTransitionTimer = null;
        if (!room.gameState) return;
        room.gameState = completeTrickTransition(room.gameState, lastTrick);

        if (room.gameState.phase === 'TRICK_PLAY') {
          this.startTurnTimer(room);
        } else if (room.gameState.phase === 'ROUND_ENDED') {
          // Auto-advance to the next deal if nobody presses "Next Deal"
          if (room.roundEndedTimer) clearTimeout(room.roundEndedTimer);
          room.roundEndedTimer = setTimeout(() => {
            room.roundEndedTimer = null;
            if (room.gameState && room.gameState.phase === 'ROUND_ENDED') {
              const anySeat = room.seats.find((s) => s.isHost) || room.seats[0];
              this.handleNextRound(room.code, anySeat.sessionToken);
            }
          }, 15000);
        }
        this.broadcastGameState(room);
      }, TRICK_DISPLAY_MS);
    } else {
      this.startTurnTimer(room);
      this.broadcastGameState(room);
    }

    return { success: true };
  }

  /**
   * Handles a manual Pair / Royals declaration (the engine applies the same
   * eligibility rules as automatic detection on trump reveal).
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
      `👑 ${seat.playerName} declared King & Queen! Target is now ${res.state.adjustedTarget}.`
    );
    this.broadcastGameState(room);
    return { success: true };
  }

  /**
   * Deals the next round when the previous deal ends (dealer rotates clockwise).
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

    room.revealedTrumpRequestId = null;
    const nextDealer = ((room.gameState.dealerIndex + 1) % 4) as PlayerPosition;
    room.gameState = startNewRound(room.gameState, nextDealer);
    this.startTurnTimer(room);
    this.broadcastGameState(room);

    return { success: true };
  }

  /**
   * Starts the countdown for the current actionable turn (Bidding, Trump Selection, Card Play).
   */
  private startTurnTimer(room: LanRoom) {
    this.stopCountdown(room);

    const gs = room.gameState;
    if (!gs || (gs.phase !== 'BIDDING' && gs.phase !== 'TRUMP_SELECTION' && gs.phase !== 'TRICK_PLAY')) {
      room.activeTurn = null;
      room.turnDeadline = 0;
      return;
    }

    const turnPos = gs.phase === 'TRUMP_SELECTION'
      ? (gs.highestBidder ?? gs.currentTurn)
      : gs.currentTurn;

    const actionType: ActiveTurnContext['actionType'] =
      gs.phase === 'BIDDING' ? 'BID' : gs.phase === 'TRUMP_SELECTION' ? 'TRUMP_SELECTION' : 'PLAY_CARD';

    // First bid of a fresh deal: allow the dealing animation to finish first.
    const grace = gs.phase === 'BIDDING' && gs.bids.length === 0 ? DEAL_ANIMATION_GRACE_MS : 0;

    this.runCountdown(room, {
      position: turnPos,
      phase: gs.phase,
      actionType,
      durationMs: TURN_SECONDS * 1000 + grace,
      onExpire: () => this.executeTimeoutFallback(room, turnPos),
    });
  }

  /**
   * Server-authoritative fallback when a player's turn timer expires.
   */
  private executeTimeoutFallback(room: LanRoom, turnPosition: PlayerPosition) {
    if (!room.gameState) return;

    const seat = room.seats.find((s) => s.position === turnPosition);
    if (!seat) return;
    const playerHand = room.gameState.hands[turnPosition];

    if (room.gameState.phase === 'BIDDING') {
      const turnIndex = room.gameState.bids.length;
      const isForcedDealer =
        turnIndex === 3 &&
        room.gameState.bids.every((b) => b.bid === 'PASS') &&
        turnPosition === room.gameState.dealerIndex &&
        room.gameState.rules.forcedDealerBid;

      this.handleBid(room.code, seat.sessionToken, isForcedDealer ? room.gameState.rules.minBid : 'PASS', true);
    } else if (room.gameState.phase === 'TRUMP_SELECTION') {
      this.handleSelectTrump(room.code, seat.sessionToken, getAutoTrumpSelection(playerHand), true);
    } else if (room.gameState.phase === 'TRICK_PLAY') {
      const leadCardId = room.gameState.currentTrickCards.length > 0
        ? room.gameState.currentTrickCards[0].cardId
        : null;

      const chosenCard = getAutoCardPlay(
        playerHand,
        leadCardId,
        room.gameState.trumpSuit,
        room.gameState.isTrumpRevealed,
        room.gameState.currentTrickCards,
        turnPosition,
        room.gameState.trumpMode
      );
      this.handlePlayCard(room.code, seat.sessionToken, chosenCard, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Computer players
  // ---------------------------------------------------------------------------

  private hasConnectedHuman(room: LanRoom): boolean {
    return room.seats.some((s) => !s.isCpu && s.connected && Boolean(s.socketId));
  }

  /** Turns a seat into a computer player with a realistic name and its own avatar. */
  private makeCpuSeat(room: LanRoom, seat: SeatInfo) {
    const others = room.seats.filter((s) => s !== seat && this.isSeatTaken(s));
    const [name] = getRandomBotNames(1, others.map((s) => s.playerName));
    const [avatar] = getRandomDistinctAvatars(1, others.map((s) => s.avatar));
    seat.isCpu = true;
    seat.connected = true;
    seat.socketId = null;
    seat.playerId = `cpu_${seat.position}_${Math.random().toString(36).substring(2, 8)}`;
    seat.playerName = name || `Player ${seat.position + 1}`;
    seat.avatar = avatar || seat.avatar;
    seat.sessionToken = `tok_cpu_${seat.position}_${this.generateSessionToken()}`;
  }

  /** Whether `pos` still has to act in the current phase. */
  private isSeatDeciding(room: LanRoom, pos: PlayerPosition): boolean {
    const gs = room.gameState;
    if (!gs) return false;
    const biddingTeam = teamOf(gs.highestBidder ?? 0);
    switch (gs.phase) {
      case 'BIDDING':
        return gs.currentTurn === pos;
      case 'TRUMP_SELECTION':
        return gs.highestBidder === pos;
      case 'DOUBLE_DECISION':
        return teamOf(pos) !== biddingTeam && !gs.doubleVotes?.[pos];
      case 'REDOUBLE_DECISION':
        return teamOf(pos) === biddingTeam && !gs.redoubleVotes?.[pos];
      case 'TRICK_PLAY':
        return gs.currentTurn === pos && gs.currentTrickCards.length < 4;
      default:
        return false;
    }
  }

  /** Restarts the countdown for whatever decision is currently open. */
  private restartCurrentCountdown(room: LanRoom) {
    const phase = room.gameState?.phase;
    if (phase === 'DOUBLE_DECISION') this.startDoublePhase(room);
    else if (phase === 'REDOUBLE_DECISION') this.startRedoublePhase(room);
    else this.startTurnTimer(room);
  }

  /** Every human has dropped: freeze timers and computer players. */
  private pauseRoom(room: LanRoom) {
    this.stopCountdown(room);
    room.activeTurn = null;
    room.turnDeadline = 0;
    if (room.cpuTimer) clearTimeout(room.cpuTimer);
    room.cpuTimer = null;
    room.cpuTimerKey = null;
    if (room.abandonTimer) clearTimeout(room.abandonTimer);
    room.abandonTimer = setTimeout(() => {
      if (this.hasConnectedHuman(room)) return;
      this.clearRoomTimers(room);
      this.rooms.delete(room.code);
    }, ABANDONED_ROOM_MS);
  }

  /** Resumes a paused match when a human is back. Returns true if it resumed. */
  private resumeIfPaused(room: LanRoom): boolean {
    if (room.abandonTimer) {
      clearTimeout(room.abandonTimer);
      room.abandonTimer = null;
    }
    const gs = room.gameState;
    if (!gs || room.activeTurn || room.trickTransitionTimer || room.trumpAnnouncementTimer) return false;
    if (!this.hasConnectedHuman(room)) return false;
    const actionable = ['BIDDING', 'TRUMP_SELECTION', 'DOUBLE_DECISION', 'REDOUBLE_DECISION', 'TRICK_PLAY'];
    if (!actionable.includes(gs.phase)) return false;
    this.restartCurrentCountdown(room);
    return true;
  }

  /** The computer-controlled seat that should act next, if any. */
  private pickCpuActor(room: LanRoom): SeatInfo | null {
    const gs = room.gameState;
    if (!gs || !this.hasConnectedHuman(room)) return null;
    for (const seat of room.seats) {
      if (seat.isCpu && this.isSeatDeciding(room, seat.position)) return seat;
    }
    return null;
  }

  /**
   * Schedules the next computer-player move for the current state. Idempotent:
   * repeated broadcasts of the same state keep the already-scheduled move.
   */
  private scheduleCpuAction(room: LanRoom) {
    const gs = room.gameState;
    if (!gs) return;
    const key = `${gs.roundNumber}_${gs.version}_${gs.phase}`;
    if (room.cpuTimer && room.cpuTimerKey === key) return;
    if (room.cpuTimer) clearTimeout(room.cpuTimer);
    room.cpuTimer = null;
    room.cpuTimerKey = null;

    const actor = this.pickCpuActor(room);
    if (!actor) return;

    const isDecision = gs.phase === 'DOUBLE_DECISION' || gs.phase === 'REDOUBLE_DECISION';
    const [lo, hi] = isDecision ? CPU_DECISION_MS : CPU_THINK_MS;
    let delay = lo + Math.floor(Math.random() * (hi - lo));
    if (gs.phase === 'BIDDING' && gs.bids.length === 0) delay += DEAL_ANIMATION_GRACE_MS;

    const version = gs.version;
    room.cpuTimerKey = key;
    room.cpuTimer = setTimeout(() => {
      room.cpuTimer = null;
      room.cpuTimerKey = null;
      // The state moved on (or a human took the seat) while "thinking": re-evaluate.
      if (!room.gameState || room.gameState.version !== version || !actor.isCpu) {
        this.scheduleCpuAction(room);
        return;
      }
      this.runCpuAction(room, actor);
    }, delay);
  }

  /** Performs one decision for a computer player, using only what that seat may know. */
  private runCpuAction(room: LanRoom, seat: SeatInfo) {
    const gs = room.gameState;
    if (!gs) return;
    const pos = seat.position;
    const tok = seat.sessionToken;
    const hand = gs.hands[pos] || [];
    // Only the bidder knows a concealed trump.
    const knownTrump = gs.isTrumpRevealed || gs.highestBidder === pos ? gs.trumpSuit : null;
    let res: { success: boolean; error?: string } = { success: true };

    switch (gs.phase) {
      case 'BIDDING': {
        const forced =
          gs.bids.length === 3 &&
          gs.bids.every((b) => b.bid === 'PASS') &&
          pos === gs.dealerIndex &&
          gs.rules.forcedDealerBid;
        res = this.handleBid(room.code, tok, getBotBidDecision(hand, gs.highestBid, gs.rules, forced), true);
        if (!res.success) res = this.handleBid(room.code, tok, forced ? gs.rules.minBid : 'PASS', true);
        break;
      }
      case 'TRUMP_SELECTION':
        res = this.handleSelectTrump(room.code, tok, getBotTrumpSelection(hand), true);
        break;
      case 'DOUBLE_DECISION':
        res = this.handleDoubleDecision(room.code, tok, getBotDoubleDecision(hand, gs.highestBid) ? 'DOUBLE' : 'PASS');
        break;
      case 'REDOUBLE_DECISION':
        res = this.handleRedoubleDecision(
          room.code,
          tok,
          getBotRedoubleDecision(hand, gs.highestBid, knownTrump) ? 'REDOUBLE' : 'PASS'
        );
        break;
      case 'TRICK_PLAY': {
        const lead = gs.currentTrickCards[0]?.cardId ?? null;
        const leadSuit = lead ? CARD_MANIFEST[lead]?.suit : null;
        const canFollow = leadSuit ? hand.some((id) => CARD_MANIFEST[id]?.suit === leadSuit) : true;
        if (!gs.isTrumpRevealed && lead && !canFollow) {
          let wantsReveal: boolean;
          if (knownTrump) {
            wantsReveal = shouldBotRequestTrumpReveal(hand, lead, knownTrump, false, gs.currentTrickCards, pos);
          } else {
            // Doesn't know the trump: ask for it when the trick is worth fighting for.
            const trickPoints = gs.currentTrickCards.reduce((sum, pc) => sum + (CARD_MANIFEST[pc.cardId]?.points || 0), 0);
            wantsReveal = trickPoints >= 2;
          }
          if (wantsReveal) {
            // The reveal broadcasts a new state; the card is played on the next CPU tick.
            res = this.handleRevealTrump(room.code, tok, { requestId: `cpu_${pos}_${gs.roundNumber}_${gs.version}` });
            if (res.success) return;
          }
        }
        const card = getBotCardPlay(hand, lead, gs.trumpSuit, gs.isTrumpRevealed, gs.currentTrickCards, pos, gs.trumpMode);
        res = this.handlePlayCard(room.code, tok, card, true);
        if (!res.success) {
          const legal = getPlayableCards(hand, lead, gs.trumpSuit, gs.isTrumpRevealed, gs.trumpMode);
          if (legal[0]) res = this.handlePlayCard(room.code, tok, legal[0], true);
        }
        break;
      }
      default:
        return;
    }

    if (!res.success) {
      // The turn timer's fallback will still move the game on.
      console.warn(`[cpu] ${seat.playerName} could not act in ${gs.phase}: ${res.error}`);
    }
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
        occupied: this.isSeatTaken(s),
      })),
    };

    this.io.to(room.code).emit('room_update', payload);
  }

  /**
   * Sends each seat ONLY its own sanitized view (own hand, hidden opponents & trump).
   */
  public broadcastGameState(room: LanRoom) {
    if (!room.gameState) return;

    for (const seat of room.seats) {
      if (seat.socketId) {
        const publicState = getPublicGameState(room.gameState, seat.position);
        publicState.turnDeadline = room.turnDeadline;
        this.io.to(seat.socketId).emit('game_state_update', {
          publicState,
          myPosition: seat.position,
        });
      }
    }
    // Every state change is broadcast, so this is the single place that lets
    // computer players react to it.
    this.scheduleCpuAction(room);
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
}
