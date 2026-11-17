import { io, Socket } from 'socket.io-client';
import { CompletedTrick, GameRulesConfig, PlayerPosition, PublicGameState, Team, TrumpSelectionChoice } from '../engine/types';

export interface LanSeat {
  position: PlayerPosition;
  team: Team;
  playerId: string;
  playerName: string;
  avatar?: string;
  isHost: boolean;
  connected: boolean;
  /** Seat is played by a computer player. */
  isCpu?: boolean;
  /** Seat is claimed by a player (they may be briefly disconnected). */
  occupied?: boolean;
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
  turnId?: string;
  remainingSeconds: number;
  turnDeadline?: number;
  turnPosition: PlayerPosition;
  phase: string;
}

export interface GameStateUpdate {
  publicState: PublicGameState;
  myPosition: PlayerPosition;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type ActionResult = { success: boolean; error?: string };
type RoomResult = ActionResult & { roomCode?: string; sessionToken?: string; position?: PlayerPosition };

interface EventMap {
  room_update: LanRoomState;
  game_state_update: GameStateUpdate;
  timer_tick: TimerTickData;
  in_table_notification: InTableNotification;
  TRICK_COMPLETED: { trick: CompletedTrick };
  connection_status: ConnectionStatus;
  session_lost: { reason: string };
}

type EventName = keyof EventMap;
type Listener<E extends EventName> = (data: EventMap[E]) => void;

const SERVER_EVENTS: EventName[] = [
  'room_update',
  'game_state_update',
  'timer_tick',
  'in_table_notification',
  'TRICK_COMPLETED',
];

const SESSION_KEY = 'twenty_nine_lan_session';

/**
 * Seat sessions live in sessionStorage: they survive a page refresh but are
 * per-tab, so two tabs (or two players sharing one laptop) never grab the
 * same seat.
 */
const sessionStore = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};
const ACK_TIMEOUT_MS = 6000;

/**
 * Socket.IO client for the LAN host.
 *
 * Listeners are kept in our own registry and re-dispatched from whichever
 * socket is current, so switching host address (joining via a typed IP) or a
 * transport reconnect never drops subscriptions. On every (re)connect we
 * automatically re-attach to our seat using the saved session token.
 */
class LanClientService {
  private socket: Socket | null = null;
  private currentHostUrl = '';
  private sessionToken = '';
  private roomCode = '';
  private myPosition: PlayerPosition = 0;
  private status: ConnectionStatus = 'disconnected';
  private listeners: { [E in EventName]?: Set<Listener<E>> } = {};

  constructor() {
    const saved = this.getSavedSession();
    if (saved) {
      this.roomCode = saved.roomCode;
      this.sessionToken = saved.sessionToken;
      this.myPosition = saved.position;
    }
  }

  /**
   * Resolves the default LAN server URL based on the browser's current location.
   * In Vite dev mode (port 5173) the backend runs on port 3000 of the same host.
   */
  public getDefaultHostUrl(): string {
    if (typeof window === 'undefined') return 'http://localhost:3000';
    const hostname = window.location.hostname || 'localhost';
    if (window.location.port === '5173') {
      return `http://${hostname}:3000`;
    }
    return window.location.origin;
  }

  /** Normalises "192.168.1.5", "192.168.1.5:3000" or a full URL into a URL. */
  public normaliseHostUrl(raw: string): string {
    let url = raw.trim();
    if (!url) return this.getDefaultHostUrl();
    if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
    try {
      const parsed = new URL(url);
      if (!parsed.port && parsed.protocol === 'http:') parsed.port = '3000';
      return parsed.origin;
    } catch {
      return this.getDefaultHostUrl();
    }
  }

  public getHostUrl(): string {
    return this.currentHostUrl || this.getDefaultHostUrl();
  }

  /**
   * Initializes or reuses the Socket.IO connection.
   */
  public connect(customHostUrl?: string): Socket {
    const targetUrl = customHostUrl ? this.normaliseHostUrl(customHostUrl) : this.currentHostUrl || this.getDefaultHostUrl();

    if (this.socket && this.currentHostUrl === targetUrl) {
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return this.socket;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.currentHostUrl = targetUrl;
    const socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    });
    this.socket = socket;
    this.setStatus('connecting');

    for (const event of SERVER_EVENTS) {
      socket.on(event, (data: unknown) => this.dispatch(event, data as never));
    }

    socket.on('connect', () => {
      this.setStatus('connected');
      // Re-attach to our seat after any (re)connect: page refresh, Wi-Fi blip, server restart.
      if (this.roomCode && this.sessionToken) {
        const attempted = { roomCode: this.roomCode, sessionToken: this.sessionToken };
        socket.emit(
          'reconnect_seat',
          attempted,
          (res: ActionResult & { position?: PlayerPosition }) => {
            // Ignore stale answers if we have since created/joined another room.
            if (this.sessionToken !== attempted.sessionToken) return;
            if (res?.success && res.position !== undefined) {
              this.myPosition = res.position;
              this.persistSession();
            } else {
              this.clearSavedSession();
              this.dispatch('session_lost', { reason: res?.error || 'Your seat is no longer available.' });
            }
          }
        );
      }
    });
    socket.on('disconnect', () => this.setStatus('disconnected'));
    socket.io.on('reconnect_attempt', () => this.setStatus('connecting'));

    return socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public hasSession(): boolean {
    return Boolean(this.roomCode && this.sessionToken);
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.dispatch('connection_status', status);
  }

  private dispatch<E extends EventName>(event: E, data: EventMap[E]) {
    const set = this.listeners[event] as Set<Listener<E>> | undefined;
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[lanClient] listener for ${event} failed`, err);
      }
    }
  }

  private subscribe<E extends EventName>(event: E, cb: Listener<E>): () => void {
    if (!this.listeners[event]) {
      (this.listeners as Record<string, Set<unknown>>)[event] = new Set();
    }
    const set = this.listeners[event] as Set<Listener<E>>;
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }

  // --- Session persistence ---

  private persistSession() {
    try {
      sessionStore()?.setItem(
        SESSION_KEY,
        JSON.stringify({
          roomCode: this.roomCode,
          sessionToken: this.sessionToken,
          position: this.myPosition,
          hostUrl: this.currentHostUrl,
        })
      );
    } catch {
      /* storage unavailable: session simply won't survive a refresh */
    }
  }

  public saveSession(roomCode: string, sessionToken: string, position: PlayerPosition) {
    this.roomCode = roomCode;
    this.sessionToken = sessionToken;
    this.myPosition = position;
    this.persistSession();
  }

  public getSavedSession(): { roomCode: string; sessionToken: string; position: PlayerPosition; hostUrl?: string } | null {
    try {
      const raw = sessionStore()?.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public clearSavedSession() {
    this.roomCode = '';
    this.sessionToken = '';
    try {
      sessionStore()?.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  // --- Request helper ---

  private request<T extends ActionResult>(event: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve) => {
      const socket = this.socket || this.connect();
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit(event, payload, (err: Error | null, res: T) => {
          if (err) {
            resolve({ success: false, error: 'The LAN host did not respond. Check that you are on the same Wi-Fi.' } as T);
          } else {
            resolve(res);
          }
        });
    });
  }

  private sessionPayload(extra: Record<string, unknown> = {}) {
    return { roomCode: this.roomCode, sessionToken: this.sessionToken, ...extra };
  }

  // --- API Methods ---

  public async createRoom(hostName: string, rules?: GameRulesConfig, preferredSeat: PlayerPosition = 0): Promise<RoomResult> {
    const res = await this.request<RoomResult>('create_room', { hostName, rules, preferredSeat });
    if (res.success && res.roomCode && res.sessionToken) {
      this.saveSession(res.roomCode, res.sessionToken, res.position ?? preferredSeat);
    }
    return res;
  }

  public async joinRoom(roomCode: string, playerName: string, preferredSeat?: PlayerPosition): Promise<RoomResult> {
    const res = await this.request<RoomResult>('join_room', { roomCode, playerName, preferredSeat });
    if (res.success && res.roomCode && res.sessionToken) {
      this.saveSession(res.roomCode, res.sessionToken, res.position ?? 0);
    }
    return res;
  }

  public async selectSeat(targetPosition: PlayerPosition): Promise<ActionResult> {
    const res = await this.request<ActionResult>('select_seat', this.sessionPayload({ targetPosition }));
    if (res.success) {
      this.myPosition = targetPosition;
      this.persistSession();
    }
    return res;
  }

  public async reconnectSeat(roomCode: string, sessionToken: string): Promise<ActionResult & { position?: PlayerPosition }> {
    const res = await this.request<ActionResult & { position?: PlayerPosition }>('reconnect_seat', { roomCode, sessionToken });
    if (res.success && res.position !== undefined) {
      this.saveSession(roomCode, sessionToken, res.position);
    }
    return res;
  }

  public async leaveRoom(): Promise<ActionResult> {
    if (!this.roomCode || !this.socket) {
      this.clearSavedSession();
      return { success: true };
    }
    const res = await this.request<ActionResult>('leave_room', this.sessionPayload());
    this.clearSavedSession();
    return res;
  }

  public startMatch(): Promise<ActionResult> {
    return this.request('start_match', this.sessionPayload());
  }

  public placeBid(bid: number | 'PASS'): Promise<ActionResult> {
    return this.request('place_bid', this.sessionPayload({ bid }));
  }

  public selectTrump(choice: TrumpSelectionChoice): Promise<ActionResult> {
    return this.request('select_trump', this.sessionPayload({ choice, suit: choice }));
  }

  public revealTrump(payload?: { requestId?: string; playerPosition?: PlayerPosition; roundNumber?: number; trickNumber?: number }): Promise<ActionResult> {
    return this.request('reveal_trump', this.sessionPayload({ ...payload }));
  }

  public playCard(cardId: string): Promise<ActionResult> {
    return this.request('play_card', this.sessionPayload({ cardId }));
  }

  public declarePair(): Promise<ActionResult> {
    return this.request('declare_pair', this.sessionPayload());
  }

  public submitDoubleDecision(decision: 'DOUBLE' | 'PASS'): Promise<ActionResult> {
    return this.request('double_decision', this.sessionPayload({ decision }));
  }

  public submitRedoubleDecision(decision: 'REDOUBLE' | 'PASS'): Promise<ActionResult> {
    return this.request('redouble_decision', this.sessionPayload({ decision }));
  }

  public nextRound(): Promise<ActionResult> {
    return this.request('next_round', this.sessionPayload());
  }

  // --- Subscriptions ---

  public onRoomUpdate(cb: Listener<'room_update'>) {
    return this.subscribe('room_update', cb);
  }

  public onGameStateUpdate(cb: Listener<'game_state_update'>) {
    return this.subscribe('game_state_update', cb);
  }

  public onTimerTick(cb: Listener<'timer_tick'>) {
    return this.subscribe('timer_tick', cb);
  }

  public onInTableNotification(cb: Listener<'in_table_notification'>) {
    return this.subscribe('in_table_notification', cb);
  }

  public onTrickCompleted(cb: Listener<'TRICK_COMPLETED'>) {
    return this.subscribe('TRICK_COMPLETED', cb);
  }

  public onConnectionStatus(cb: Listener<'connection_status'>) {
    return this.subscribe('connection_status', cb);
  }

  public onSessionLost(cb: Listener<'session_lost'>) {
    return this.subscribe('session_lost', cb);
  }
}

export const lanClient = new LanClientService();
