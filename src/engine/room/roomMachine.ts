/**
 * Serverless room state machine for online play.
 *
 * Every function is pure with respect to time: callers pass `now` and get the
 * next room record back. There are no timers. A stateless backend (Supabase
 * Edge Function) loads the room, applies one action and then `advance()`s it,
 * which performs everything that has become due (computer-player moves, turn
 * timeouts, trick collection, the Joker/7th-card announcement, auto next deal).
 * Connected browsers ask the backend to advance at `nextWakeAt()`.
 */
import { CARD_MANIFEST, Suit } from '../../assets/cardManifest';
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
  startNewRound,
} from '../gameManager';
import {
  getBotBidDecision,
  getBotCardPlay,
  getBotDoubleDecision,
  getBotRedoubleDecision,
  getBotTrumpSelection,
  shouldBotRequestTrumpReveal,
} from '../bot';
import { getRandomBotNames } from '../botNames';
import { getPlayableCards } from '../tricks';
import { isLegalBid } from '../bidding';
import {
  CompletedTrick,
  DEFAULT_RULES_CONFIG,
  GamePhase,
  GameRulesConfig,
  GameState,
  PlayerInfo,
  PlayerPosition,
  PublicGameState,
  Team,
  TrumpSelectionChoice,
} from '../types';

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

export const TURN_MS = 15_000;
export const DOUBLE_DECISION_MS = 10_000;
export const DISCONNECTED_TURN_MS = 3_000;
export const DEAL_ANIMATION_GRACE_MS = 1_500;
export const TRICK_DISPLAY_MS = 1_600;
export const TRUMP_ANNOUNCEMENT_MS = 1_000;
export const AUTO_NEXT_ROUND_MS = 15_000;
export const CPU_THINK_MS: [number, number] = [900, 1500];
export const CPU_DECISION_MS: [number, number] = [1600, 2600];
/** A human who hasn't pinged for this long is treated as disconnected. */
export const PRESENCE_TIMEOUT_MS = 25_000;
/** A lobby seat whose player vanished for this long can be taken by someone else. */
export const LOBBY_SEAT_HOLD_MS = 60_000;
/** How long a full-table rejection allows the original taker to rejoin. */
export const NOTE_HISTORY = 12;

export const ANIMAL_AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦁', '🐻', '🐵', '🐺', '🐨', '🦉', '🐧', '🐱', '🐰', '🦄', '🦖', '🦋'];

const SEAT_LABELS: Record<PlayerPosition, string> = {
  0: 'Bottom - Team A',
  1: 'Left - Team B',
  2: 'Top - Team A',
  3: 'Right - Team B',
};

const POSITIONS: PlayerPosition[] = [0, 1, 2, 3];
const teamOf = (pos: PlayerPosition): Team => (pos === 0 || pos === 2 ? 0 : 1);

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface SeatRecord {
  position: PlayerPosition;
  team: Team;
  name: string;
  avatar: string;
  isHost: boolean;
  isCpu: boolean;
  /** Secret that authorises this seat's actions ('' = empty seat). */
  token: string;
  /** Secret realtime topic for this seat's private view. */
  channel: string;
  /** Last time this human talked to the server (ms). */
  lastSeen: number;
}

export type PendingStep =
  | { kind: 'TRICK_TRANSITION'; dueAt: number; trick: CompletedTrick }
  | { kind: 'TRUMP_ANNOUNCEMENT'; dueAt: number }
  | { kind: 'AUTO_NEXT_ROUND'; dueAt: number };

export interface TurnClock {
  key: string;
  position: PlayerPosition;
  phase: GamePhase;
  deadline: number;
}

export interface RoomNote {
  id: number;
  type: 'INFO' | 'TRUMP_REVEALED' | 'PAIR_DECLARED';
  message: string;
  ts: number;
}

export interface RoomRecord {
  code: string;
  rules: GameRulesConfig;
  isStarted: boolean;
  seats: SeatRecord[];
  game: GameState | null;
  clock: TurnClock | null;
  pending: PendingStep | null;
  /** Earliest time the computer player who must act may do so. */
  cpuDueAt: number | null;
  /** game.version the CPU timing was computed for. */
  cpuVersion: number | null;
  revealRequestId: string | null;
  notes: RoomNote[];
  noteSeq: number;
  createdAt: number;
  updatedAt: number;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface RandomSource {
  random(): number;
}
const defaultRng: RandomSource = { random: () => Math.random() };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export const randomToken = (len = 24, rng: RandomSource = defaultRng): string => {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(rng.random() * chars.length)];
  return out;
};

export const generateRoomCode = (rng: RandomSource = defaultRng): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(rng.random() * chars.length)];
  return code;
};

const shuffledAvatars = (count: number, exclude: string[], rng: RandomSource): string[] => {
  const pool = ANIMAL_AVATARS.filter((a) => !exclude.includes(a));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
};

const cleanName = (raw: unknown, fallback: string): string => {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 20) : '';
  return name || fallback;
};

const between = ([lo, hi]: [number, number], rng: RandomSource) => lo + Math.floor(rng.random() * (hi - lo));

export const isSeatTaken = (s: SeatRecord) => s.token !== '';
export const isHumanConnected = (s: SeatRecord, now: number) =>
  !s.isCpu && isSeatTaken(s) && now - s.lastSeen < PRESENCE_TIMEOUT_MS;
export const hasConnectedHuman = (room: RoomRecord, now: number) => room.seats.some((s) => isHumanConnected(s, now));

const emptySeat = (seat: SeatRecord) => {
  seat.name = `Empty Seat (${SEAT_LABELS[seat.position]})`;
  seat.isHost = false;
  seat.isCpu = false;
  seat.token = '';
  seat.channel = '';
  seat.lastSeen = 0;
};

const note = (room: RoomRecord, type: RoomNote['type'], message: string, now: number) => {
  room.noteSeq += 1;
  room.notes = [...room.notes, { id: room.noteSeq, type, message, ts: now }].slice(-NOTE_HISTORY);
};

const seatByToken = (room: RoomRecord, token: string | undefined): SeatRecord | undefined =>
  token ? room.seats.find((s) => s.token === token && !s.isCpu) : undefined;

/** Hands the host role to a connected human if the current host is gone. */
const ensureHost = (room: RoomRecord, now: number) => {
  const host = room.seats.find((s) => s.isHost);
  if (host && !host.isCpu && isSeatTaken(host) && isHumanConnected(host, now)) return;
  const next = room.seats.find((s) => isHumanConnected(s, now));
  if (!next || next === host) return;
  if (host) host.isHost = false;
  next.isHost = true;
  note(room, 'INFO', `${next.name} is now the room host.`, now);
};

const makeCpuSeat = (room: RoomRecord, seat: SeatRecord, rng: RandomSource) => {
  const others = room.seats.filter((s) => s !== seat && isSeatTaken(s));
  const [name] = getRandomBotNames(1, others.map((s) => s.name));
  const [avatar] = shuffledAvatars(1, others.map((s) => s.avatar), rng);
  seat.isCpu = true;
  seat.isHost = false;
  seat.name = name || `Player ${seat.position + 1}`;
  seat.avatar = avatar || seat.avatar;
  seat.token = `cpu_${randomToken(16, rng)}`;
  seat.channel = '';
  seat.lastSeen = 0;
};

const syncPlayers = (room: RoomRecord, now: number) => {
  if (!room.game) return;
  room.game = {
    ...room.game,
    players: room.game.players.map((p) => {
      const s = room.seats[p.position];
      return {
        ...p,
        id: `seat_${s.position}`,
        name: s.name,
        avatar: s.avatar,
        isHost: s.isHost,
        isCpu: s.isCpu,
        connected: s.isCpu || isHumanConnected(s, now),
      };
    }),
  };
};

// ---------------------------------------------------------------------------
// Turn bookkeeping
// ---------------------------------------------------------------------------

/** Whether `pos` still has to act in the current phase. */
export const isSeatDeciding = (room: RoomRecord, pos: PlayerPosition): boolean => {
  const gs = room.game;
  if (!gs || room.pending) return false;
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
};

const clockKeyFor = (gs: GameState): string | null => {
  switch (gs.phase) {
    case 'BIDDING':
      return `r${gs.roundNumber}_bid${gs.bids.length}_p${gs.currentTurn}`;
    case 'TRUMP_SELECTION':
      return `r${gs.roundNumber}_trump`;
    case 'DOUBLE_DECISION':
      return `r${gs.roundNumber}_double`;
    case 'REDOUBLE_DECISION':
      return `r${gs.roundNumber}_redouble`;
    case 'TRICK_PLAY':
      return gs.currentTrickCards.length < 4 ? `r${gs.roundNumber}_t${gs.currentTrickNumber}_c${gs.currentTrickCards.length}` : null;
    default:
      return null;
  }
};

/**
 * Recomputes the countdown and the computer player's think time after any
 * change. The countdown restarts only when a new decision starts (one
 * defender passing does not reset the shared Double window).
 */
const refreshTiming = (room: RoomRecord, now: number, rng: RandomSource) => {
  const gs = room.game;
  if (!gs || room.pending) {
    room.clock = null;
    room.cpuDueAt = null;
    room.cpuVersion = null;
    return;
  }
  const key = clockKeyFor(gs);
  if (!key) {
    room.clock = null;
  } else if (!room.clock || room.clock.key !== key) {
    const deciders = POSITIONS.filter((p) => isSeatDeciding(room, p));
    const isWindow = gs.phase === 'DOUBLE_DECISION' || gs.phase === 'REDOUBLE_DECISION';
    let duration = isWindow ? DOUBLE_DECISION_MS : TURN_MS;
    if (gs.phase === 'BIDDING' && gs.bids.length === 0) duration += DEAL_ANIMATION_GRACE_MS;
    // Nobody able to answer is present → keep the table moving.
    const anyoneHere = deciders.some((p) => room.seats[p].isCpu || isHumanConnected(room.seats[p], now));
    if (!anyoneHere) duration = DISCONNECTED_TURN_MS;
    const position = gs.phase === 'TRUMP_SELECTION' ? (gs.highestBidder ?? gs.currentTurn) : deciders[0] ?? gs.currentTurn;
    room.clock = { key, position, phase: gs.phase, deadline: now + duration };
  }

  const cpuActor = pickCpuActor(room);
  if (!cpuActor) {
    room.cpuDueAt = null;
    room.cpuVersion = null;
  } else if (room.cpuVersion !== gs.version || room.cpuDueAt === null) {
    const isWindow = gs.phase === 'DOUBLE_DECISION' || gs.phase === 'REDOUBLE_DECISION';
    let delay = between(isWindow ? CPU_DECISION_MS : CPU_THINK_MS, rng);
    if (gs.phase === 'BIDDING' && gs.bids.length === 0) delay += DEAL_ANIMATION_GRACE_MS;
    room.cpuDueAt = now + delay;
    room.cpuVersion = gs.version;
  }
};

const pickCpuActor = (room: RoomRecord): SeatRecord | null => {
  for (const s of room.seats) if (s.isCpu && isSeatDeciding(room, s.position)) return s;
  return null;
};

/** Earliest server time at which `advance` will have something to do. */
export const nextWakeAt = (room: RoomRecord): number | null => {
  const times: number[] = [];
  if (room.pending) times.push(room.pending.dueAt);
  else {
    if (room.cpuDueAt !== null) times.push(room.cpuDueAt);
    if (room.clock) times.push(room.clock.deadline);
  }
  return times.length ? Math.min(...times) : null;
};

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

export const createRoom = (
  code: string,
  hostName: string,
  now: number,
  rules: GameRulesConfig = DEFAULT_RULES_CONFIG,
  rng: RandomSource = defaultRng
): { room: RoomRecord; seat: SeatRecord } => {
  const avatars = shuffledAvatars(4, [], rng);
  const seats: SeatRecord[] = POSITIONS.map((pos) => ({
    position: pos,
    team: teamOf(pos),
    name: `Empty Seat (${SEAT_LABELS[pos]})`,
    avatar: avatars[pos],
    isHost: false,
    isCpu: false,
    token: '',
    channel: '',
    lastSeen: 0,
  }));
  const host = seats[0];
  host.name = cleanName(hostName, 'Host');
  host.isHost = true;
  host.token = randomToken(24, rng);
  host.channel = randomToken(24, rng);
  host.lastSeen = now;

  const room: RoomRecord = {
    code,
    rules,
    isStarted: false,
    seats,
    game: null,
    clock: null,
    pending: null,
    cpuDueAt: null,
    cpuVersion: null,
    revealRequestId: null,
    notes: [],
    noteSeq: 0,
    createdAt: now,
    updatedAt: now,
  };
  return { room, seat: host };
};

/**
 * Join by room code. Lobby: first open seat (or a seat abandoned for a while).
 * Running match: replaces a computer player or a disconnected human.
 */
export const joinRoom = (
  room: RoomRecord,
  playerName: string,
  now: number,
  preferredSeat?: PlayerPosition,
  rng: RandomSource = defaultRng
): { ok: true; seat: SeatRecord } | { ok: false; error: string } => {
  const canTake = room.isStarted
    ? (s: SeatRecord) => s.isCpu || !isHumanConnected(s, now)
    : (s: SeatRecord) => !isSeatTaken(s) || now - s.lastSeen > LOBBY_SEAT_HOLD_MS;
  let seat =
    preferredSeat !== undefined && room.seats[preferredSeat] && canTake(room.seats[preferredSeat])
      ? room.seats[preferredSeat]
      : undefined;
  if (!seat) {
    // Prefer genuinely empty / computer seats over a dropped human's seat.
    seat =
      room.seats.find((s) => canTake(s) && (s.isCpu || !isSeatTaken(s))) ?? room.seats.find((s) => canTake(s));
  }
  if (!seat) {
    return {
      ok: false,
      error: room.isStarted
        ? `Room ${room.code} is in progress and all 4 seats have players.`
        : `Room ${room.code} is full.`,
    };
  }

  const replacedCpu = seat.isCpu ? seat.name : null;
  seat.isCpu = false;
  seat.isHost = false; // ensureHost() below hands the role to a present human
  seat.name = cleanName(playerName, 'Player');
  seat.token = randomToken(24, rng);
  seat.channel = randomToken(24, rng);
  seat.lastSeen = now;
  ensureHost(room, now);

  if (room.isStarted) {
    note(
      room,
      'INFO',
      replacedCpu
        ? `${seat.name} joined and takes over from ${replacedCpu}.`
        : `${seat.name} took over Seat ${seat.position + 1}.`,
      now
    );
    syncPlayers(room, now);
    // If it is this seat's move right now, give the new human a full turn.
    if (isSeatDeciding(room, seat.position)) room.clock = null;
    refreshTiming(room, now, rng);
  }
  room.updatedAt = now;
  return { ok: true, seat };
};

export const selectSeat = (room: RoomRecord, token: string, target: PlayerPosition, now: number): ActionResult => {
  if (room.isStarted) return { ok: false, error: 'Seats are fixed once the game has started.' };
  const seat = seatByToken(room, token);
  if (!seat) return { ok: false, error: 'Your seat was not found.' };
  if (seat.position === target) return { ok: true };
  const dest = room.seats[target];
  if (!dest) return { ok: false, error: 'Unknown seat.' };
  if (isSeatTaken(dest) && now - dest.lastSeen <= LOBBY_SEAT_HOLD_MS) {
    return { ok: false, error: `Seat ${target + 1} is taken.` };
  }
  const moved = { name: seat.name, avatar: seat.avatar, isHost: seat.isHost, token: seat.token, channel: seat.channel };
  emptySeat(seat);
  Object.assign(dest, moved, { isCpu: false, lastSeen: now });
  room.updatedAt = now;
  return { ok: true };
};

/** Marks a human as present (heartbeat); restores host if needed. */
export const touch = (room: RoomRecord, token: string | undefined, now: number): SeatRecord | undefined => {
  const seat = seatByToken(room, token);
  if (seat) {
    const wasAway = !isHumanConnected(seat, now);
    seat.lastSeen = now;
    if (wasAway && room.isStarted) {
      note(room, 'INFO', `${seat.name} is back.`, now);
      syncPlayers(room, now);
    }
    ensureHost(room, now);
  }
  return seat;
};

/**
 * Leave the room. Lobby: frees the seat. Match: a computer player takes over
 * so the remaining humans can play on.
 */
export const leaveRoom = (room: RoomRecord, token: string, now: number, rng: RandomSource = defaultRng): ActionResult => {
  const seat = seatByToken(room, token);
  if (!seat) return { ok: true };
  const name = seat.name;
  if (!room.isStarted) {
    emptySeat(seat);
    note(room, 'INFO', `${name} left.`, now);
  } else {
    makeCpuSeat(room, seat, rng);
    note(room, 'INFO', `${name} left — ${seat.name} (computer) takes the seat.`, now);
    syncPlayers(room, now);
    refreshTiming(room, now, rng);
  }
  ensureHost(room, now);
  room.updatedAt = now;
  return { ok: true };
};

/** Starts (or restarts after the match ends). Empty seats become computer players. */
export const startMatch = (room: RoomRecord, token: string, now: number, rng: RandomSource = defaultRng): ActionResult => {
  const seat = seatByToken(room, token);
  if (!seat || !seat.isHost) return { ok: false, error: 'Only the host can start the game.' };
  if (room.isStarted && room.game && room.game.phase !== 'MATCH_ENDED') {
    return { ok: false, error: 'The game is already in progress.' };
  }
  for (const s of room.seats) {
    const hasHuman = !s.isCpu && isSeatTaken(s) && (isHumanConnected(s, now) || s === seat);
    if (!hasHuman && !s.isCpu) makeCpuSeat(room, s, rng);
  }
  const players: PlayerInfo[] = room.seats.map((s) => ({
    id: `seat_${s.position}`,
    name: s.name,
    avatar: s.avatar,
    position: s.position,
    team: s.team,
    isHost: s.isHost,
    isCpu: s.isCpu,
    isReady: true,
    connected: true,
  }));
  room.isStarted = true;
  room.revealRequestId = null;
  room.pending = null;
  room.clock = null;
  room.game = startNewRound(createInitialGame(room.code, players, room.rules));
  syncPlayers(room, now);
  refreshTiming(room, now, rng);
  room.updatedAt = now;
  return { ok: true };
};

// ---------------------------------------------------------------------------
// Game actions
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'BID'; bid: number | 'PASS' }
  | { type: 'TRUMP'; choice: TrumpSelectionChoice }
  | { type: 'DOUBLE'; decision: 'DOUBLE' | 'PASS' }
  | { type: 'REDOUBLE'; decision: 'REDOUBLE' | 'PASS' }
  | { type: 'REVEAL'; requestId?: string }
  | { type: 'PLAY'; cardId: string }
  | { type: 'PAIR' }
  | { type: 'NEXT_ROUND' };

/** Applies a human action (after first processing anything already due). */
export const act = (
  room: RoomRecord,
  token: string,
  action: GameAction,
  now: number,
  rng: RandomSource = defaultRng
): ActionResult => {
  const seat = touch(room, token, now);
  if (!seat) return { ok: false, error: 'Your seat is no longer in this room.' };
  advance(room, now, rng);
  if (!room.game) return { ok: false, error: 'The game has not started.' };
  if (
    room.clock &&
    now > room.clock.deadline + 1000 &&
    action.type !== 'NEXT_ROUND' &&
    action.type !== 'REVEAL' &&
    action.type !== 'PAIR'
  ) {
    return { ok: false, error: 'Time is up for that turn.' };
  }
  const res = applyAction(room, seat, action, now, rng);
  if (res.ok) {
    refreshTiming(room, now, rng);
    advance(room, now, rng);
    room.updatedAt = now;
  }
  return res;
};

const applyAction = (
  room: RoomRecord,
  seat: SeatRecord,
  action: GameAction,
  now: number,
  rng: RandomSource
): ActionResult => {
  const gs = room.game!;
  const pos = seat.position;

  switch (action.type) {
    case 'BID': {
      if (gs.phase !== 'BIDDING' || gs.currentTurn !== pos) return { ok: false, error: 'Not your turn to bid.' };
      const forced =
        gs.bids.length === 3 && gs.bids.every((b) => b.bid === 'PASS') && pos === gs.dealerIndex && gs.rules.forcedDealerBid;
      const legal = isLegalBid(action.bid, gs.highestBid, gs.rules, forced);
      if (!legal.legal) return { ok: false, error: legal.reason || 'Illegal bid.' };
      const res = applyBid(gs, pos, action.bid);
      if (!res.success) return { ok: false, error: res.error || 'Bid rejected.' };
      room.game = res.state;
      if (res.state.phase === 'BIDDING' && res.state.roundNumber !== gs.roundNumber) {
        note(room, 'INFO', 'Everyone passed — the cards are redealt.', now);
        room.revealRequestId = null;
      }
      return { ok: true };
    }
    case 'TRUMP': {
      if (gs.phase !== 'TRUMP_SELECTION' || gs.highestBidder !== pos) return { ok: false, error: 'You are not choosing trump.' };
      const res = applyTrumpSelection(gs, pos, action.choice);
      if (!res.success) return { ok: false, error: res.error || 'Trump rejected.' };
      room.game = res.state;
      const msg =
        action.choice === 'NO_TRUMP'
          ? `${seat.name} chose Joker — no trump.`
          : action.choice === 'SEVENTH_CARD'
          ? `${seat.name} chose 7th card trump.`
          : `${seat.name} chose a secret trump.`;
      note(room, 'INFO', msg, now);
      if (res.state.phase === 'TRUMP_ANNOUNCEMENT') {
        room.pending = { kind: 'TRUMP_ANNOUNCEMENT', dueAt: now + TRUMP_ANNOUNCEMENT_MS };
      }
      return { ok: true };
    }
    case 'DOUBLE': {
      if (gs.phase !== 'DOUBLE_DECISION') return { ok: false, error: 'The Double window is closed.' };
      const res = applyDoubleDecision(gs, pos, action.decision);
      if (!res.success) return { ok: false, error: res.error || 'Rejected.' };
      room.game = res.state;
      if (action.decision === 'DOUBLE') note(room, 'INFO', `${seat.name} doubled — 2×.`, now);
      else if (res.state.phase === 'TRICK_PLAY') note(room, 'INFO', 'Defenders passed — 1×.', now);
      return { ok: true };
    }
    case 'REDOUBLE': {
      if (gs.phase !== 'REDOUBLE_DECISION') return { ok: false, error: 'The Re-double window is closed.' };
      const res = applyRedoubleDecision(gs, pos, action.decision);
      if (!res.success) return { ok: false, error: res.error || 'Rejected.' };
      room.game = res.state;
      if (action.decision === 'REDOUBLE') note(room, 'INFO', `${seat.name} re-doubled — 4×.`, now);
      else if (res.state.phase === 'TRICK_PLAY') note(room, 'INFO', 'Bidding side passed — stays 2×.', now);
      return { ok: true };
    }
    case 'REVEAL': {
      if (action.requestId && room.revealRequestId === action.requestId) return { ok: true };
      if (gs.phase !== 'TRICK_PLAY' || gs.isTrumpRevealed || gs.currentTrickCards.length >= 4 || room.pending) {
        return { ok: false, error: 'Trump cannot be revealed now.' };
      }
      const res = applyTrumpReveal(gs, pos);
      if (!res.success) return { ok: false, error: res.error || 'Rejected.' };
      if (action.requestId) room.revealRequestId = action.requestId;
      room.game = res.state;
      announceTrumpReveal(room, seat.name, false, now);
      return { ok: true };
    }
    case 'PLAY':
      return playCard(room, seat, action.cardId, now);
    case 'PAIR': {
      const res = applyPairDeclaration(gs, pos);
      if (!res.success) return { ok: false, error: res.error || 'Rejected.' };
      room.game = res.state;
      note(room, 'PAIR_DECLARED', `${seat.name} declared King & Queen — target is now ${res.state.adjustedTarget}.`, now);
      return { ok: true };
    }
    case 'NEXT_ROUND': {
      if (gs.phase !== 'ROUND_ENDED') return { ok: false, error: 'The deal is not over yet.' };
      startNextRound(room);
      return { ok: true };
    }
  }
};

const playCard = (room: RoomRecord, seat: SeatRecord, cardId: string, now: number): ActionResult => {
  const gs = room.game!;
  const pos = seat.position;
  if (gs.phase !== 'TRICK_PLAY' || gs.currentTurn !== pos) return { ok: false, error: 'Not your turn to play.' };
  if (gs.currentTrickCards.length >= 4 || room.pending) return { ok: false, error: 'Wait for the trick to be collected.' };
  const hand = gs.hands[pos];
  if (!hand.includes(cardId)) return { ok: false, error: 'That card is not in your hand.' };
  const lead = gs.currentTrickCards[0]?.cardId ?? null;
  if (!getPlayableCards(hand, lead, gs.trumpSuit, gs.isTrumpRevealed, gs.trumpMode).includes(cardId)) {
    return { ok: false, error: 'You must follow the led suit.' };
  }
  const wasRevealed = gs.isTrumpRevealed;
  const res = applyCardPlay(gs, pos, cardId);
  if (!res.success) return { ok: false, error: res.error || 'Rejected.' };
  room.game = res.state;
  if (!wasRevealed && res.state.isTrumpRevealed) announceTrumpReveal(room, seat.name, true, now);
  if (res.trickCompleted) {
    room.pending = { kind: 'TRICK_TRANSITION', dueAt: now + TRICK_DISPLAY_MS, trick: res.trickCompleted };
  }
  return { ok: true };
};

const startNextRound = (room: RoomRecord) => {
  const gs = room.game!;
  room.pending = null;
  room.revealRequestId = null;
  room.game = startNewRound(gs, ((gs.dealerIndex + 1) % 4) as PlayerPosition);
};

const suitName = (s: Suit | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

const announceTrumpReveal = (room: RoomRecord, byName: string, byCut: boolean, now: number) => {
  const gs = room.game!;
  let msg = byCut
    ? `${byName} cut with a trump — trump is ${suitName(gs.trumpSuit)}.`
    : `${byName} revealed trump: ${suitName(gs.trumpSuit)}.`;
  if (gs.trumpMode === 'no-trump') msg = `${byName} revealed: Joker / no trump.`;
  else if (gs.trumpMode === 'seventh-card' && gs.seventhCard) {
    const info = CARD_MANIFEST[gs.seventhCard.cardId];
    const cardName = info ? `${info.rank} of ${info.suit.toLowerCase()}` : gs.seventhCard.cardId;
    msg = `7th card revealed: ${cardName} — trump is ${suitName(gs.trumpSuit)}.`;
  }
  note(room, 'TRUMP_REVEALED', msg, now);
  if (gs.pairDeclaration) {
    const owner = room.seats[gs.pairDeclaration.playerIndex];
    note(room, 'PAIR_DECLARED', `${owner?.name ?? 'Player'} holds King & Queen of trump — target is now ${gs.pairDeclaration.adjustedTarget}.`, now);
  }
};

// ---------------------------------------------------------------------------
// Automatic progress
// ---------------------------------------------------------------------------

/**
 * Performs everything due at `now`: pending table steps, computer moves and
 * expired turn timers. Does nothing while no human is connected (the game
 * pauses). Returns true if the room changed.
 */
export const advance = (room: RoomRecord, now: number, rng: RandomSource = defaultRng): boolean => {
  let changed = false;
  for (let guard = 0; guard < 64; guard++) {
    const gs = room.game;
    if (!gs) break;

    if (room.pending) {
      if (now < room.pending.dueAt) break;
      const step = room.pending;
      room.pending = null;
      if (step.kind === 'TRICK_TRANSITION') {
        room.game = completeTrickTransition(gs, step.trick);
        if (room.game.phase === 'ROUND_ENDED') {
          room.pending = { kind: 'AUTO_NEXT_ROUND', dueAt: step.dueAt + AUTO_NEXT_ROUND_MS };
        }
      } else if (step.kind === 'TRUMP_ANNOUNCEMENT') {
        room.game = applyTrumpAnnouncementComplete(gs);
      } else if (step.kind === 'AUTO_NEXT_ROUND') {
        if (gs.phase === 'ROUND_ENDED') startNextRound(room);
      }
      refreshTiming(room, Math.max(now, step.dueAt), rng);
      changed = true;
      continue;
    }

    if (!hasConnectedHuman(room, now)) break;

    const cpu = pickCpuActor(room);
    if (cpu && room.cpuDueAt !== null && now >= room.cpuDueAt) {
      const at = room.cpuDueAt;
      if (runCpuAction(room, cpu, at, rng)) {
        refreshTiming(room, at, rng);
        changed = true;
        continue;
      }
      room.cpuDueAt = null; // fall back to the turn timer
    }

    if (room.clock && now >= room.clock.deadline) {
      const at = room.clock.deadline;
      if (runTimeout(room, at, rng)) {
        refreshTiming(room, at, rng);
        changed = true;
        continue;
      }
      room.clock = null;
    }
    break;
  }
  if (changed) {
    syncPlayers(room, now);
    room.updatedAt = now;
  }
  return changed;
};

/** One decision for a computer player, using only what that seat may know. */
const runCpuAction = (room: RoomRecord, seat: SeatRecord, now: number, rng: RandomSource): boolean => {
  const gs = room.game!;
  const pos = seat.position;
  const hand = gs.hands[pos] || [];
  const knownTrump = gs.isTrumpRevealed || gs.highestBidder === pos ? gs.trumpSuit : null;
  const run = (a: GameAction) => applyAction(room, seat, a, now, rng).ok;

  switch (gs.phase) {
    case 'BIDDING': {
      const forced =
        gs.bids.length === 3 && gs.bids.every((b) => b.bid === 'PASS') && pos === gs.dealerIndex && gs.rules.forcedDealerBid;
      return run({ type: 'BID', bid: getBotBidDecision(hand, gs.highestBid, gs.rules, forced) }) ||
        run({ type: 'BID', bid: forced ? gs.rules.minBid : 'PASS' });
    }
    case 'TRUMP_SELECTION':
      return run({ type: 'TRUMP', choice: getBotTrumpSelection(hand) });
    case 'DOUBLE_DECISION':
      return run({ type: 'DOUBLE', decision: getBotDoubleDecision(hand, gs.highestBid) ? 'DOUBLE' : 'PASS' });
    case 'REDOUBLE_DECISION':
      return run({ type: 'REDOUBLE', decision: getBotRedoubleDecision(hand, gs.highestBid, knownTrump) ? 'REDOUBLE' : 'PASS' });
    case 'TRICK_PLAY': {
      const lead = gs.currentTrickCards[0]?.cardId ?? null;
      const leadSuit = lead ? CARD_MANIFEST[lead]?.suit : null;
      const canFollow = leadSuit ? hand.some((id) => CARD_MANIFEST[id]?.suit === leadSuit) : true;
      if (!gs.isTrumpRevealed && lead && !canFollow && gs.trumpMode !== 'no-trump') {
        const wantsReveal = knownTrump
          ? shouldBotRequestTrumpReveal(hand, lead, knownTrump, false, gs.currentTrickCards, pos)
          : gs.currentTrickCards.reduce((sum, pc) => sum + (CARD_MANIFEST[pc.cardId]?.points || 0), 0) >= 2;
        // The reveal is its own step; the card follows on the next CPU tick.
        if (wantsReveal && run({ type: 'REVEAL', requestId: `cpu_${pos}_${gs.roundNumber}_${gs.version}` })) return true;
      }
      const card = getBotCardPlay(hand, lead, gs.trumpSuit, gs.isTrumpRevealed, gs.currentTrickCards, pos, gs.trumpMode);
      if (run({ type: 'PLAY', cardId: card })) return true;
      const legal = getPlayableCards(hand, lead, gs.trumpSuit, gs.isTrumpRevealed, gs.trumpMode);
      return legal.length > 0 && run({ type: 'PLAY', cardId: legal[0] });
    }
    default:
      return false;
  }
};

/** Expired turn: make a safe move for the human (or close the Double window). */
const runTimeout = (room: RoomRecord, now: number, rng: RandomSource): boolean => {
  const gs = room.game!;
  const biddingTeam = teamOf(gs.highestBidder ?? 0);

  if (gs.phase === 'DOUBLE_DECISION') {
    const defenders = POSITIONS.filter((p) => teamOf(p) !== biddingTeam);
    room.game = applySecondDeal({
      ...gs,
      doubleVotes: Object.fromEntries(defenders.map((p) => [p, gs.doubleVotes?.[p] || 'PASS'])),
      doubleStatus: 'NONE',
      dealMultiplier: 1,
    });
    note(room, 'INFO', 'No double (time up) — 1×.', now);
    return true;
  }
  if (gs.phase === 'REDOUBLE_DECISION') {
    const bidders = POSITIONS.filter((p) => teamOf(p) === biddingTeam);
    room.game = applySecondDeal({
      ...gs,
      redoubleVotes: Object.fromEntries(bidders.map((p) => [p, gs.redoubleVotes?.[p] || 'PASS'])),
      doubleStatus: 'DOUBLED',
      dealMultiplier: 2,
    });
    note(room, 'INFO', 'No re-double (time up) — stays 2×.', now);
    return true;
  }

  const pos = gs.phase === 'TRUMP_SELECTION' ? gs.highestBidder : gs.currentTurn;
  if (pos === null || pos === undefined) return false;
  const seat = room.seats[pos];
  // A computer player whose move failed, or a human who ran out of time: same safe move.
  const saved = seat.isCpu;
  seat.isCpu = true;
  try {
    return runCpuAction(room, seat, now, rng);
  } finally {
    seat.isCpu = saved;
  }
};

// ---------------------------------------------------------------------------
// Views (what each client may see)
// ---------------------------------------------------------------------------

export interface PublicSeat {
  position: PlayerPosition;
  team: Team;
  playerId: string;
  playerName: string;
  avatar: string;
  isHost: boolean;
  isCpu: boolean;
  connected: boolean;
  occupied: boolean;
}

export interface PublicRoom {
  roomCode: string;
  hostId: string;
  isStarted: boolean;
  rules: GameRulesConfig;
  seats: PublicSeat[];
}

export const publicRoom = (room: RoomRecord, now: number): PublicRoom => {
  const host = room.seats.find((s) => s.isHost);
  return {
    roomCode: room.code,
    hostId: host ? `seat_${host.position}` : '',
    isStarted: room.isStarted,
    rules: room.rules,
    seats: room.seats.map((s) => ({
      position: s.position,
      team: s.team,
      playerId: isSeatTaken(s) ? `seat_${s.position}` : '',
      playerName: s.name,
      avatar: s.avatar,
      isHost: s.isHost,
      isCpu: s.isCpu,
      connected: s.isCpu || isHumanConnected(s, now),
      occupied: isSeatTaken(s) && (s.isCpu || now - s.lastSeen <= LOBBY_SEAT_HOLD_MS || room.isStarted),
    })),
  };
};

export interface ClockView {
  deadline: number;
  turnPosition: PlayerPosition;
  phase: GamePhase;
  key: string;
}

export const clockView = (room: RoomRecord): ClockView | null =>
  room.clock ? { deadline: room.clock.deadline, turnPosition: room.clock.position, phase: room.clock.phase, key: room.clock.key } : null;

/** Sanitised game view for one seat: own hand only, concealed trump hidden. */
export const playerView = (room: RoomRecord, position: PlayerPosition, now: number): PublicGameState | null => {
  if (!room.game) return null;
  syncPlayers(room, now);
  const view = getPublicGameState(room.game, position);
  view.turnDeadline = room.clock?.deadline ?? 0;
  return view;
};
