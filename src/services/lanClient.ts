import { io, Socket } from 'socket.io-client';
import { GameRulesConfig, GameState, PlayerPosition, PublicGameState, Team, TrumpSelectionChoice } from '../engine/types';
import { Suit } from '../assets/cardManifest';

export interface LanSeat {
  position: PlayerPosition;
  team: Team;
  playerId: string;
  playerName: string;
  avatar?: string;
  isHost: boolean;
  isCpu: boolean;
  connected: boolean;
}

export interface LanRoomState {
  roomCode: string;
  hostId: string;
  isStarted: boolean;
  rules: GameRulesConfig;
  seats: LanSeat[];
}

export interface InTableNotification {
  type: 'INFO' | 'TIMEOUT_AUTO_PLAY' | 'TRUMP_REVEALED' | 'PAIR_DECLARED';
  message: string;
  cardId?: string;
  timestamp: number;
}

export interface TimerTickData {
  remainingSeconds: number;
  turnDeadline?: number;
  turnPosition: PlayerPosition;
  phase: string;
}

export interface LanConnectionConfig {
  hostAddress: string;
}

class LanClientService {
  private socket: Socket | null = null;
  private currentHostUrl: string = '';
  private sessionToken: string = '';
  private roomCode: string = '';
  private myPosition: PlayerPosition = 0;

  /**
   * Resolves the default LAN server URL based on the browser's current location.
   */
  public getDefaultHostUrl(): string {
    if (typeof window === 'undefined') return 'http://localhost:3000';

    const hostname = window.location.hostname || 'localhost';
    const port = window.location.port;

    // If running under Vite dev server (5173), default backend target is port 3000
    if (port === '5173') {
      return `http://${hostname}:3000`;
    }

    return window.location.origin;
  }

  /**
   * Initializes or reuses the Socket.IO connection.
   */
  public connect(customHostUrl?: string): Socket {
    const targetUrl = customHostUrl?.trim() || this.getDefaultHostUrl();

    if (this.socket && this.currentHostUrl === targetUrl && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentHostUrl = targetUrl;
    this.socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public saveSession(roomCode: string, sessionToken: string, position: PlayerPosition) {
    this.roomCode = roomCode;
    this.sessionToken = sessionToken;
    this.myPosition = position;
    if (typeof window !== 'undefined') {
      localStorage.setItem('twenty_nine_lan_session', JSON.stringify({ roomCode, sessionToken, position }));
    }
  }

  public getSavedSession(): { roomCode: string; sessionToken: string; position: PlayerPosition } | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('twenty_nine_lan_session');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public clearSavedSession() {
    this.roomCode = '';
    this.sessionToken = '';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('twenty_nine_lan_session');
    }
  }

  // --- API Methods ---

  public createRoom(
    hostName: string,
    rules?: GameRulesConfig,
    preferredSeat: PlayerPosition = 0
  ): Promise<{ success: boolean; roomCode?: string; sessionToken?: string; position?: PlayerPosition; error?: string }> {
    return new Promise((resolve) => {
      const socket = this.socket || this.connect();
      socket.emit('create_room', { hostName, rules, preferredSeat }, (res: any) => {
        if (res.success && res.roomCode && res.sessionToken) {
          this.saveSession(res.roomCode, res.sessionToken, res.position ?? preferredSeat);
        }
        resolve(res);
      });
    });
  }

  public joinRoom(
    roomCode: string,
    playerName: string,
    preferredSeat?: PlayerPosition
  ): Promise<{ success: boolean; roomCode?: string; sessionToken?: string; position?: PlayerPosition; error?: string }> {
    return new Promise((resolve) => {
      const socket = this.socket || this.connect();
      socket.emit('join_room', { roomCode, playerName, preferredSeat }, (res: any) => {
        if (res.success && res.roomCode && res.sessionToken) {
          this.saveSession(res.roomCode, res.sessionToken, res.position ?? 1);
        }
        resolve(res);
      });
    });
  }

  public selectSeat(targetPosition: PlayerPosition): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit(
        'select_seat',
        { roomCode: this.roomCode, sessionToken: this.sessionToken, targetPosition },
        (res: any) => {
          if (res.success) {
            this.myPosition = targetPosition;
            this.saveSession(this.roomCode, this.sessionToken, targetPosition);
          }
          resolve(res);
        }
      );
    });
  }

  public reconnectSeat(
    roomCode: string,
    sessionToken: string
  ): Promise<{ success: boolean; position?: PlayerPosition; error?: string }> {
    return new Promise((resolve) => {
      const socket = this.socket || this.connect();
      socket.emit('reconnect_seat', { roomCode, sessionToken }, (res: any) => {
        if (res.success && res.position !== undefined) {
          this.saveSession(roomCode, sessionToken, res.position);
        }
        resolve(res);
      });
    });
  }

  public startMatch(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('start_match', { roomCode: this.roomCode, sessionToken: this.sessionToken }, resolve);
    });
  }

  public placeBid(bid: number | 'PASS'): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('place_bid', { roomCode: this.roomCode, sessionToken: this.sessionToken, bid }, resolve);
    });
  }

  public selectTrump(choice: TrumpSelectionChoice): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('select_trump', { roomCode: this.roomCode, sessionToken: this.sessionToken, choice, suit: choice }, resolve);
    });
  }

  public revealTrump(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('reveal_trump', { roomCode: this.roomCode, sessionToken: this.sessionToken }, resolve);
    });
  }

  public playCard(cardId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('play_card', { roomCode: this.roomCode, sessionToken: this.sessionToken, cardId }, resolve);
    });
  }

  public declarePair(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('declare_pair', { roomCode: this.roomCode, sessionToken: this.sessionToken }, resolve);
    });
  }

  public nextRound(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('next_round', { roomCode: this.roomCode, sessionToken: this.sessionToken }, resolve);
    });
  }

  // --- Subscriptions ---

  public onRoomUpdate(callback: (room: LanRoomState) => void): () => void {
    if (!this.socket) this.connect();
    this.socket?.on('room_update', callback);
    return () => this.socket?.off('room_update', callback);
  }

  public onGameStateUpdate(
    callback: (data: { gameState: GameState; publicState: PublicGameState; myPosition: PlayerPosition }) => void
  ): () => void {
    if (!this.socket) this.connect();
    this.socket?.on('game_state_update', callback);
    return () => this.socket?.off('game_state_update', callback);
  }

  public onTimerTick(callback: (data: TimerTickData) => void): () => void {
    if (!this.socket) this.connect();
    this.socket?.on('timer_tick', callback);
    return () => this.socket?.off('timer_tick', callback);
  }

  public onInTableNotification(callback: (notif: InTableNotification) => void): () => void {
    if (!this.socket) this.connect();
    this.socket?.on('in_table_notification', callback);
    return () => this.socket?.off('in_table_notification', callback);
  }
}

export const lanClient = new LanClientService();
