/**
 * Supabase Edge Function: the online game server for The 29 Game.
 *
 * Stateless: each request loads the room from Postgres (table game_rooms,
 * readable only with the service role), applies one action with the pure room
 * state machine, saves it with optimistic locking and pushes updates over
 * Supabase Realtime broadcast:
 *   - topic `room-<CODE>`      public table/lobby info (no hands, no tokens)
 *   - topic `seat-<channel>`   one seat's private view (its own hand only);
 *                              `channel` is a secret known only to that player
 *
 * Bundled into a single file with esbuild (see scripts/build-function.mjs).
 */
import {
  act,
  advance,
  clockView,
  createRoom,
  GameAction,
  generateRoomCode,
  joinRoom,
  leaveRoom,
  nextWakeAt,
  playerView,
  publicRoom,
  RoomRecord,
  selectSeat,
  startMatch,
  touch,
} from '../../../src/engine/room/roomMachine';
import { PlayerPosition } from '../../../src/engine/types';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TABLE = 'game_rooms';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

async function loadRoom(code: string): Promise<{ room: RoomRecord; version: number } | null> {
  const res = await rest(`${TABLE}?code=eq.${encodeURIComponent(code)}&select=state,version`);
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ state: RoomRecord; version: number }>;
  return rows[0] ? { room: rows[0].state, version: rows[0].version } : null;
}

async function insertRoom(room: RoomRecord): Promise<boolean> {
  const res = await rest(TABLE, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ code: room.code, state: room, version: 1 }),
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`insert failed: ${res.status} ${await res.text()}`);
  return true;
}

async function saveRoom(room: RoomRecord, version: number): Promise<boolean> {
  const res = await rest(`${TABLE}?code=eq.${encodeURIComponent(room.code)}&version=eq.${version}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ state: room, version: version + 1, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as unknown[];
  return rows.length === 1;
}

async function broadcast(messages: Array<{ topic: string; event: string; payload: unknown }>) {
  if (!messages.length) return;
  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.map((m) => ({ ...m, private: false })) }),
  });
  if (!res.ok) console.error('broadcast failed', res.status, await res.text());
}

/** Everything other players can observe; lastSeen ticks alone don't trigger a broadcast. */
const fingerprint = (room: RoomRecord, now: number) =>
  JSON.stringify([publicRoom(room, now), room.game?.version ?? 0, room.clock, room.pending, room.noteSeq, room.cpuDueAt]);

const roomPayload = (room: RoomRecord, now: number, sinceNote: number) => ({
  room: publicRoom(room, now),
  clock: clockView(room),
  nextWakeAt: nextWakeAt(room),
  serverNow: now,
  notes: room.notes.filter((n) => n.id > sinceNote),
  noteSeq: room.noteSeq,
});

const messagesFor = (room: RoomRecord, now: number, sinceNote: number) => {
  const msgs: Array<{ topic: string; event: string; payload: unknown }> = [
    { topic: `room-${room.code}`, event: 'room', payload: roomPayload(room, now, sinceNote) },
  ];
  if (room.game) {
    for (const s of room.seats) {
      if (s.isCpu || !s.channel) continue;
      msgs.push({
        topic: `seat-${s.channel}`,
        event: 'view',
        payload: { view: playerView(room, s.position, now), myPosition: s.position, gameVersion: room.game.version },
      });
    }
  }
  return msgs;
};

type Body = {
  op: string;
  code?: string;
  token?: string;
  name?: string;
  seat?: PlayerPosition;
  bid?: number | 'PASS';
  choice?: string;
  decision?: string;
  cardId?: string;
  requestId?: string;
};

/** Load → mutate → save (retrying on concurrent writes) → broadcast. */
async function withRoom(
  code: string,
  mutate: (room: RoomRecord, now: number) => { ok: boolean; error?: string; token?: string } & Record<string, unknown>,
  token?: string
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const loaded = await loadRoom(code);
    if (!loaded) return json({ ok: false, error: `Room ${code} was not found.`, code: 'ROOM_NOT_FOUND' });
    const { room, version } = loaded;
    const now = Date.now();
    const before = fingerprint(room, now);
    const beforeState = JSON.stringify(room);
    const noteSeq = room.noteSeq;

    const result = mutate(room, now);
    // Whatever else happened, let due automatic steps run.
    advance(room, now);

    const changed = JSON.stringify(room) !== beforeState;
    if (changed && !(await saveRoom(room, version))) continue; // someone else wrote first: retry
    const visibleChange = fingerprint(room, now) !== before;
    if (visibleChange) await broadcast(messagesFor(room, now, noteSeq));

    const myToken = (result.token as string | undefined) ?? token;
    const me = myToken ? room.seats.find((s) => s.token === myToken && !s.isCpu) : undefined;
    return json({
      ...result,
      position: me?.position,
      channel: me?.channel,
      ...roomPayload(room, now, noteSeq),
      view: me ? playerView(room, me.position, now) : null,
      gameVersion: room.game?.version ?? 0,
    });
  }
  return json({ ok: false, error: 'The table is busy — please try again.' }, 409);
}

function toAction(body: Body): GameAction | null {
  switch (body.op) {
    case 'bid':
      return { type: 'BID', bid: body.bid as number | 'PASS' };
    case 'trump':
      return { type: 'TRUMP', choice: body.choice as never };
    case 'double':
      return { type: 'DOUBLE', decision: body.decision as 'DOUBLE' | 'PASS' };
    case 'redouble':
      return { type: 'REDOUBLE', decision: body.decision as 'REDOUBLE' | 'PASS' };
    case 'reveal':
      return { type: 'REVEAL', requestId: body.requestId };
    case 'play':
      return { type: 'PLAY', cardId: String(body.cardId) };
    case 'pair':
      return { type: 'PAIR' };
    case 'nextRound':
      return { type: 'NEXT_ROUND' };
    default:
      return null;
  }
}

async function handle(body: Body): Promise<Response> {
  const code = (body.code || '').toUpperCase().trim();

  if (body.op === 'create') {
    // Housekeeping: forget rooms idle for more than a day.
    rest(`${TABLE}?updated_at=lt.${new Date(Date.now() - 86_400_000).toISOString()}`, { method: 'DELETE' }).catch(() => {});
    for (let i = 0; i < 8; i++) {
      const now = Date.now();
      const { room, seat } = createRoom(generateRoomCode(), String(body.name || ''), now);
      if (await insertRoom(room)) {
        return json({
          ok: true,
          token: seat.token,
          channel: seat.channel,
          position: seat.position,
          ...roomPayload(room, now, 0),
          view: null,
          gameVersion: 0,
        });
      }
    }
    return json({ ok: false, error: 'Could not create a room, please retry.' }, 500);
  }

  if (!code) return json({ ok: false, error: 'Missing room code.' }, 400);

  switch (body.op) {
    case 'join':
      return withRoom(code, (room, now) => {
        const res = joinRoom(room, String(body.name || ''), now, body.seat);
        return res.ok ? { ok: true, token: res.seat.token } : { ok: false, error: res.error };
      });
    case 'ping':
    case 'view':
      return withRoom(
        code,
        (room, now) => {
          const seat = touch(room, body.token, now);
          return seat ? { ok: true } : { ok: false, error: 'Your seat is no longer in this room.', code: 'SEAT_LOST' };
        },
        body.token
      );
    case 'selectSeat':
      return withRoom(code, (room, now) => okOrErr(selectSeat(room, body.token || '', body.seat as PlayerPosition, now)), body.token);
    case 'leave':
      return withRoom(code, (room, now) => okOrErr(leaveRoom(room, body.token || '', now)), body.token);
    case 'start':
      return withRoom(code, (room, now) => okOrErr(startMatch(room, body.token || '', now)), body.token);
    default: {
      const action = toAction(body);
      if (!action) return json({ ok: false, error: `Unknown op ${body.op}` }, 400);
      return withRoom(code, (room, now) => okOrErr(act(room, body.token || '', action, now)), body.token);
    }
  }
}

const okOrErr = (r: { ok: true } | { ok: false; error: string }) => (r.ok ? { ok: true } : { ok: false, error: r.error });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  try {
    const body = (await req.json()) as Body;
    return await handle(body);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: err instanceof Error ? err.message : 'Server error' }, 500);
  }
});
