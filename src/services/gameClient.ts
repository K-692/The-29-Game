import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { GameRulesConfig, PlayerPosition, PublicGameState, Team, TrumpSelectionChoice } from '../engine/types';

/**
 * Online client for The 29 Game.
 *
 * - Actions go to the Supabase Edge Function `game` (the authoritative server).
 * - Updates arrive over Supabase Realtime broadcast:
 *     `room-<CODE>`      public lobby/table info for everyone in the room
 *     `seat-<channel>`   this player's private view (own hand only)
 * - The server has no timers. Whoever is connected asks it to advance when the
 *   next thing is due (computer move, timeout, trick collection). The lowest
 *   seated connected human does this first; the others are backups.
 */

// Public values: the publishable key is meant to ship in browser code.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://aaaauzhecvriqkttlnwg.supabase.co';
export const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_KEY as string | undefined) || 'sb_publishable_M2VTla6Hi0jCy8FiYOyKFQ_4Y7Fhb-H';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/game`;

export interface RoomSeat {
  position: PlayerPosition;
  team: Team;
  playerId: string;
  playerName: string;
  avatar?: string;
  isHost: boolean;
  isCpu?: boolean;
  connected: boolean;
  occupied?: boolean;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  isStarted: boolean;
  rules: GameRulesConfig;
  seats: RoomSeat[];
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
type RoomResult = ActionResult & { roomCode?: string; position?: PlayerPosition };

interface ClockView {
  deadline: number;
  turnPosition: PlayerPosition;
  phase: string;
  key: string;
}
interface RoomNote {
  id: number;
  type: InTableNotification['type'];
  message: string;
  ts: number;
}
interface RoomPayload {
  room: RoomState;
  clock: ClockView | null;
  nextWakeAt: number | null;
  serverNow: number;
  notes: RoomNote[];
  noteSeq: number;
}
interface ViewPayload {
  view: PublicGameState | null;
  myPosition: PlayerPosition;
  gameVersion: number;
}
type ServerResponse = Partial<RoomPayload> &
  Partial<ViewPayload> & {
    ok: boolean;
    error?: string;
    code?: string;
    token?: string;
    channel?: string;
    position?: PlayerPosition;
  };

interface EventMap {
  room_update: RoomState;
  game_state_update: GameStateUpdate;
  timer_tick: TimerTickData;
  in_table_notification: InTableNotification;
  connection_status: ConnectionStatus;
  session_lost: { reason: string };
}
type EventName = keyof EventMap;
type Listener<E extends EventName> = (data: EventMap[E]) => void;

interface Session {
  code: string;
  token: string;
  channel: string;
  position: PlayerPosition;
}

const SESSION_KEY = 'twenty_nine_online_session';
const HEARTBEAT_MS = 8_000;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Seat sessions live in sessionStorage: they survive a refresh but are
 * per-tab, so two tabs never grab the same seat.
 */
const store = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

class GameClient {
  private supabase: SupabaseClient | null = null;
  private roomChannel: RealtimeChannel | null = null;
  private seatChannel: RealtimeChannel | null = null;
  private session: Session | null = null;
  private listeners: { [E in EventName]?: Set<Listener<E>> } = {};
  private status: ConnectionStatus = 'connecting';

  private room: RoomState | null = null;
  private clock: ClockView | null = null;
  private clockOffset = 0; // serverNow - Date.now()
  private lastRoomServerNow = 0;
  private lastGameVersion = -1;
  private lastNoteSeq = 0;
  private lastTickSecond = -1;
  private lastTickKey = '';

  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private started = false;

  /** Starts background work and resumes a saved seat after a refresh. */
  public connect(): void {
    if (this.started) return;
    this.started = true;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    this.ticker = setInterval(() => this.emitTick(), 250);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.ping());
      window.addEventListener('offline', () => this.setStatus('disconnected'));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.ping();
      });
    }
    const saved = this.getSavedSession();
    if (saved) {
      this.session = saved;
      this.attachChannels();
      this.startHeartbeat();
      void this.call({ op: 'view' });
    } else {
      this.setStatus('connected');
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getSavedSession(): Session | null {
    try {
      const raw = store()?.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  public hasSession(): boolean {
    return Boolean(this.session);
  }

  private saveSession() {
    try {
      if (this.session) store()?.setItem(SESSION_KEY, JSON.stringify(this.session));
      else store()?.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  public clearSavedSession() {
    this.session = null;
    this.saveSession();
    this.detachChannels();
    this.stopHeartbeat();
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    this.room = null;
    this.clock = null;
    this.lastGameVersion = -1;
    this.lastRoomServerNow = 0;
    this.lastNoteSeq = 0;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  private dispatch<E extends EventName>(event: E, data: EventMap[E]) {
    const set = this.listeners[event] as Set<Listener<E>> | undefined;
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[gameClient] ${event} listener failed`, err);
      }
    }
  }

  private subscribe<E extends EventName>(event: E, cb: Listener<E>): () => void {
    if (!this.listeners[event]) (this.listeners as Record<string, Set<unknown>>)[event] = new Set();
    const set = this.listeners[event] as Set<Listener<E>>;
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.dispatch('connection_status', status);
  }

  // -------------------------------------------------------------------------
  // Realtime
  // -------------------------------------------------------------------------

  private attachChannels() {
    if (!this.supabase || !this.session) return;
    this.detachChannels();
    const { code, channel } = this.session;
    this.roomChannel = this.supabase
      .channel(`room-${code}`)
      .on('broadcast', { event: 'room' }, ({ payload }) => this.applyRoom(payload as RoomPayload))
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          this.setStatus('connected');
          // Catch up on anything sent while we were (re)subscribing.
          void this.ping();
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          if (this.session) this.setStatus('disconnected');
        }
      });
    this.seatChannel = this.supabase
      .channel(`seat-${channel}`)
      .on('broadcast', { event: 'view' }, ({ payload }) => this.applyView(payload as ViewPayload))
      .subscribe();
  }

  private detachChannels() {
    if (this.supabase) {
      if (this.roomChannel) void this.supabase.removeChannel(this.roomChannel);
      if (this.seatChannel) void this.supabase.removeChannel(this.seatChannel);
    }
    this.roomChannel = null;
    this.seatChannel = null;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.ping(), HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private ping() {
    if (this.session) void this.call({ op: 'ping' });
  }

  // -------------------------------------------------------------------------
  // Applying server data
  // -------------------------------------------------------------------------

  private applyRoom(p: RoomPayload) {
    if (!p || !p.room || p.serverNow < this.lastRoomServerNow) return; // stale
    this.lastRoomServerNow = p.serverNow;
    this.clockOffset = p.serverNow - Date.now();
    this.room = p.room;
    this.clock = p.clock;
    this.dispatch('room_update', p.room);

    for (const n of p.notes || []) {
      if (n.id <= this.lastNoteSeq) continue;
      this.dispatch('in_table_notification', { type: n.type, message: n.message, timestamp: n.ts });
    }
    if (typeof p.noteSeq === 'number') this.lastNoteSeq = Math.max(this.lastNoteSeq, p.noteSeq);

    this.lastTickKey = '';
    this.emitTick();
    this.scheduleWake(p.nextWakeAt);
  }

  private applyView(p: ViewPayload) {
    if (!p || !p.view || p.gameVersion < this.lastGameVersion) return;
    this.lastGameVersion = p.gameVersion;
    if (this.session && this.session.position !== p.myPosition) {
      this.session.position = p.myPosition;
      this.saveSession();
    }
    this.dispatch('game_state_update', { publicState: p.view, myPosition: p.myPosition });
  }

  /** Ask the server to advance when the next automatic step is due. */
  private scheduleWake(nextWakeAt: number | null) {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    if (!nextWakeAt || !this.session || !this.room) return;
    const humans = this.room.seats.filter((s) => !s.isCpu && s.connected).map((s) => s.position);
    const leader = humans.length ? Math.min(...humans) : this.session.position;
    const isLeader = leader === this.session.position;
    const backupDelay = isLeader ? 80 : 1200 + 400 * humans.indexOf(this.session.position);
    const localDue = nextWakeAt - this.clockOffset;
    const delay = Math.max(0, localDue - Date.now()) + backupDelay;
    this.wakeTimer = setTimeout(() => this.ping(), Math.min(delay, 60_000));
  }

  private emitTick() {
    const c = this.clock;
    if (!c) return;
    const remainingMs = c.deadline - (Date.now() + this.clockOffset);
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    if (seconds === this.lastTickSecond && c.key === this.lastTickKey) return;
    this.lastTickSecond = seconds;
    this.lastTickKey = c.key;
    this.dispatch('timer_tick', {
      turnId: c.key,
      remainingSeconds: Math.min(seconds, 15),
      turnDeadline: c.deadline,
      turnPosition: c.turnPosition,
      phase: c.phase,
    });
  }

  // -------------------------------------------------------------------------
  // Requests
  // -------------------------------------------------------------------------

  private async call(body: Record<string, unknown>): Promise<ServerResponse> {
    const payload = { ...body, code: body.code ?? this.session?.code, token: body.token ?? this.session?.token };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const data = (await res.json()) as ServerResponse;
      this.setStatus('connected');
      if (data.room && typeof data.serverNow === 'number') {
        this.applyRoom(data as RoomPayload);
      }
      if (data.view && typeof data.position === 'number') {
        this.applyView({ view: data.view, myPosition: data.position, gameVersion: data.gameVersion ?? 0 });
      }
      if (!data.ok && (data.code === 'SEAT_LOST' || data.code === 'ROOM_NOT_FOUND') && this.session && body.op !== 'join') {
        const reason = data.error || 'Your seat is no longer available.';
        this.clearSavedSession();
        this.dispatch('session_lost', { reason });
      }
      return data;
    } catch {
      this.setStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'disconnected' : 'connecting');
      return { ok: false, error: 'Could not reach the game server. Check your internet connection.' };
    } finally {
      clearTimeout(timer);
    }
  }

  private async enterRoom(res: ServerResponse): Promise<RoomResult> {
    if (!res.ok || !res.token || !res.channel || res.position === undefined || !res.room) {
      return { success: false, error: res.error || 'Could not enter the room.' };
    }
    this.session = { code: res.room.roomCode, token: res.token, channel: res.channel, position: res.position };
    this.saveSession();
    this.lastNoteSeq = res.noteSeq ?? 0;
    this.attachChannels();
    this.startHeartbeat();
    return { success: true, roomCode: res.room.roomCode, position: res.position };
  }

  private toResult(r: ServerResponse): ActionResult {
    return r.ok ? { success: true } : { success: false, error: r.error || 'Request failed.' };
  }

  // -------------------------------------------------------------------------
  // Public API (same surface the UI used for the LAN client)
  // -------------------------------------------------------------------------

  public async createRoom(hostName: string, _rules?: GameRulesConfig, _seat?: PlayerPosition): Promise<RoomResult> {
    this.clearSavedSession();
    // Seat for the creator is applied after we have a session.
    const res = await this.call({ op: 'create', name: hostName, code: undefined, token: undefined });
    return this.enterRoom(res);
  }

  public async joinRoom(roomCode: string, playerName: string, preferredSeat?: PlayerPosition): Promise<RoomResult> {
    this.clearSavedSession();
    const res = await this.call({ op: 'join', code: roomCode.trim().toUpperCase(), name: playerName, seat: preferredSeat, token: undefined });
    return this.enterRoom(res);
  }

  public async selectSeat(targetPosition: PlayerPosition): Promise<ActionResult> {
    const r = await this.call({ op: 'selectSeat', seat: targetPosition });
    if (r.ok && this.session) {
      this.session.position = targetPosition;
      this.saveSession();
    }
    return this.toResult(r);
  }

  public async leaveRoom(): Promise<ActionResult> {
    if (!this.session) return { success: true };
    const r = await this.call({ op: 'leave' });
    this.clearSavedSession();
    return this.toResult(r);
  }

  public async startMatch(): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'start' }));
  }

  public async placeBid(bid: number | 'PASS'): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'bid', bid }));
  }

  public async selectTrump(choice: TrumpSelectionChoice): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'trump', choice }));
  }

  public async revealTrump(payload?: { requestId?: string }): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'reveal', requestId: payload?.requestId }));
  }

  public async playCard(cardId: string): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'play', cardId }));
  }

  public async declarePair(): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'pair' }));
  }

  public async submitDoubleDecision(decision: 'DOUBLE' | 'PASS'): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'double', decision }));
  }

  public async submitRedoubleDecision(decision: 'REDOUBLE' | 'PASS'): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'redouble', decision }));
  }

  public async nextRound(): Promise<ActionResult> {
    return this.toResult(await this.call({ op: 'nextRound' }));
  }

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
  public onConnectionStatus(cb: Listener<'connection_status'>) {
    return this.subscribe('connection_status', cb);
  }
  public onSessionLost(cb: Listener<'session_lost'>) {
    return this.subscribe('session_lost', cb);
  }
}

export const gameClient = new GameClient();
