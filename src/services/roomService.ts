import { DEFAULT_RULES_CONFIG, GameRulesConfig, PlayerInfo, PlayerPosition, Team } from '../engine/types';
import { getOrCreateUserProfile, isSupabaseConfigured, supabase } from './supabase';

export interface RoomSession {
  roomCode: string;
  hostId: string;
  rules: GameRulesConfig;
  players: PlayerInfo[];
  createdAt: number;
}

const STORAGE_ACTIVE_ROOM = 'twenty_nine_active_room';

export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Creates initial 4 seats with host at Position 0 (Team 0: South)
 */
export const createDefaultRoomPlayers = (
  hostName: string,
  cpuPositions: PlayerPosition[] = [1, 2, 3]
): PlayerInfo[] => {
  const user = getOrCreateUserProfile(hostName);

  const players: PlayerInfo[] = [];

  for (let pos = 0; pos < 4; pos++) {
    const position = pos as PlayerPosition;
    const team: Team = (position === 0 || position === 2) ? 0 : 1;

    if (position === 0) {
      players.push({
        id: user.id,
        name: user.name,
        position: 0,
        team: 0,
        isHost: true,
        isCpu: false,
        isReady: true,
        connected: true,
        avatarSeed: user.avatarSeed,
      });
    } else {
      const isCpu = cpuPositions.includes(position);
      const defaultName = isCpu 
        ? (position === 2 ? 'Bot Partner' : `Bot Opponent ${position}`)
        : (position === 2 ? 'Friend (Partner)' : `Opponent ${position}`);

      players.push({
        id: isCpu ? `cpu_${position}` : '',
        name: isCpu ? defaultName : 'Waiting for player...',
        position,
        team,
        isHost: false,
        isCpu,
        isReady: isCpu,
        connected: isCpu,
        avatarSeed: `avatar_${position}`,
      });
    }
  }

  return players;
};

/**
 * Creates a new RoomSession
 */
export const createRoom = async (
  hostName: string,
  rules: GameRulesConfig = DEFAULT_RULES_CONFIG,
  cpuPositions: PlayerPosition[] = [1, 3] // Default: partner seat 2 open for friend, opponents 1 & 3 CPU
): Promise<RoomSession> => {
  const roomCode = generateRoomCode();
  const user = getOrCreateUserProfile(hostName);
  const players = createDefaultRoomPlayers(user.name, cpuPositions);

  const roomSession: RoomSession = {
    roomCode,
    hostId: user.id,
    rules,
    players,
    createdAt: Date.now(),
  };

  // Save locally for quick recovery
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_ACTIVE_ROOM, JSON.stringify(roomSession));
  }

  // If Supabase is connected, persist to Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('rooms').insert({
        room_code: roomCode,
        rules_config: rules,
      });
    } catch (err) {
      console.warn('Failed to insert room to Supabase, continuing with realtime broadcast:', err);
    }
  }

  return roomSession;
};

/**
 * Join an existing room by code
 */
export const joinRoom = async (
  roomCode: string,
  playerName: string,
  preferredPosition?: PlayerPosition
): Promise<{ success: boolean; session?: RoomSession; playerPosition?: PlayerPosition; error?: string }> => {
  const user = getOrCreateUserProfile(playerName);

  // If local active room matches
  let roomSession: RoomSession | null = null;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_ACTIVE_ROOM);
    if (stored) {
      try {
        const parsed: RoomSession = JSON.parse(stored);
        if (parsed.roomCode.toUpperCase() === roomCode.toUpperCase()) {
          roomSession = parsed;
        }
      } catch {}
    }
  }

  // If not in local storage, initialize template for this code
  if (!roomSession) {
    roomSession = {
      roomCode: roomCode.toUpperCase(),
      hostId: '',
      rules: DEFAULT_RULES_CONFIG,
      players: createDefaultRoomPlayers('Host', []),
      createdAt: Date.now(),
    };
  }

  // Find an available seat
  let targetSeat: PlayerPosition | null = null;

  // Check if user already occupies a seat
  const existingSeat = roomSession.players.find((p) => p.id === user.id);
  if (existingSeat) {
    existingSeat.connected = true;
    return { success: true, session: roomSession, playerPosition: existingSeat.position };
  }

  // Try preferred position first (e.g. Position 2 for partner)
  if (preferredPosition !== undefined) {
    const seat = roomSession.players[preferredPosition];
    if (!seat.id || seat.isCpu) {
      targetSeat = preferredPosition;
    }
  }

  // Otherwise, find first open human or replaceable seat
  if (targetSeat === null) {
    for (let pos = 0; pos < 4; pos++) {
      const p = pos as PlayerPosition;
      const seat = roomSession.players[p];
      if (!seat.id || seat.isCpu) {
        targetSeat = p;
        break;
      }
    }
  }

  if (targetSeat === null) {
    return { success: false, error: 'Room is already full (all 4 seats occupied)' };
  }

  // Assign user to seat
  const seat = roomSession.players[targetSeat];
  seat.id = user.id;
  seat.name = user.name;
  seat.isCpu = false;
  seat.isReady = true;
  seat.connected = true;
  seat.avatarSeed = user.avatarSeed;

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_ACTIVE_ROOM, JSON.stringify(roomSession));
  }

  return {
    success: true,
    session: roomSession,
    playerPosition: targetSeat,
  };
};

/**
 * Toggle a seat between Computer (CPU) and Human Player
 */
export const toggleSeatCpu = (
  players: PlayerInfo[],
  position: PlayerPosition
): PlayerInfo[] => {
  return players.map((p) => {
    if (p.position !== position) return p;
    if (p.isHost) return p; // Cannot turn host into CPU

    const isCpuNow = !p.isCpu;
    const defaultName = isCpuNow 
      ? (position === 2 ? 'Bot Partner' : `Bot Opponent ${position}`)
      : 'Waiting for player...';

    return {
      ...p,
      isCpu: isCpuNow,
      id: isCpuNow ? `cpu_${position}` : '',
      name: isCpuNow ? defaultName : 'Waiting for player...',
      isReady: isCpuNow,
      connected: isCpuNow,
    };
  });
};

/**
 * Swap seats in the pre-game lobby (Host can rearrange partners)
 */
export const swapPlayerSeats = (
  players: PlayerInfo[],
  posA: PlayerPosition,
  posB: PlayerPosition
): PlayerInfo[] => {
  const pA = players.find((p) => p.position === posA);
  const pB = players.find((p) => p.position === posB);
  if (!pA || !pB) return players;

  return players.map((p) => {
    if (p.position === posA) {
      return {
        ...pB,
        position: posA,
        team: (posA === 0 || posA === 2) ? 0 : 1,
      };
    }
    if (p.position === posB) {
      return {
        ...pA,
        position: posB,
        team: (posB === 0 || posB === 2) ? 0 : 1,
      };
    }
    return p;
  });
};

