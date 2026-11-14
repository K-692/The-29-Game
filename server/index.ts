import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { 
  getLanIpAddresses, 
  getPrimaryLanIp, 
  printHostBanner 
} from './lanUtils.js';
import { RoomManager } from './roomManager.js';
import { GameRulesConfig, PlayerPosition, TrumpSelectionChoice } from '../src/engine/types.js';
import { Suit } from '../src/assets/cardManifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// API Endpoint: Provides host LAN connection details
app.get('/api/lan-info', (_req, res) => {
  const primaryIp = getPrimaryLanIp();
  const allIps = getLanIpAddresses();
  res.json({
    primaryIp,
    allIps,
    port: PORT,
    url: `http://${primaryIp}:${PORT}`,
  });
});

// Serve frontend static build files from dist/ if it exists
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>29 Card Game - LAN Server</title></head>
        <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem;">
          <h1>♠ ♥ 29 Card Game — LAN Server ♦ ♣</h1>
          <p>The backend LAN server is active! To play in your browser:</p>
          <ol>
            <li>Run <code>npm run build</code> to compile frontend static assets, or</li>
            <li>Run <code>npm run dev</code> for Vite dev mode.</li>
          </ol>
        </body>
      </html>
    `);
  });
}

// Initialize authoritative Room Manager
const roomManager = new RoomManager(io);

io.on('connection', (socket: Socket) => {
  // 1. Create room
  socket.on(
    'create_room',
    (
      data: { hostName: string; rules?: GameRulesConfig; preferredSeat?: PlayerPosition },
      callback?: (res: { success: boolean; roomCode?: string; sessionToken?: string; position?: PlayerPosition; error?: string }) => void
    ) => {
      try {
        const { room, seat } = roomManager.createRoom(
          socket,
          data.hostName || 'Host Player',
          data.rules,
          data.preferredSeat ?? 0
        );
        roomManager.broadcastRoomUpdate(room);
        if (callback) {
          callback({
            success: true,
            roomCode: room.code,
            sessionToken: seat.sessionToken,
            position: seat.position,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (callback) callback({ success: false, error: msg });
      }
    }
  );

  // 2. Join room
  socket.on(
    'join_room',
    (
      data: { roomCode: string; playerName: string; preferredSeat?: PlayerPosition },
      callback?: (res: { success: boolean; roomCode?: string; sessionToken?: string; position?: PlayerPosition; error?: string }) => void
    ) => {
      try {
        const res = roomManager.joinRoom(
          socket,
          data.roomCode,
          data.playerName || 'Player',
          data.preferredSeat
        );
        if (res.success && res.room && res.seat) {
          roomManager.broadcastRoomUpdate(res.room);
          if (callback) {
            callback({
              success: true,
              roomCode: res.room.code,
              sessionToken: res.seat.sessionToken,
              position: res.seat.position,
            });
          }
        } else {
          if (callback) callback({ success: false, error: res.error });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (callback) callback({ success: false, error: msg });
      }
    }
  );

  // 3. Select / switch seat in lobby
  socket.on(
    'select_seat',
    (
      data: { roomCode: string; sessionToken: string; targetPosition: PlayerPosition },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const res = roomManager.selectSeat(socket, data.roomCode, data.sessionToken, data.targetPosition);
      if (callback) callback(res);
    }
  );

  // 4. Reconnect to seat
  socket.on(
    'reconnect_seat',
    (
      data: { roomCode: string; sessionToken: string },
      callback?: (res: { success: boolean; position?: PlayerPosition; error?: string }) => void
    ) => {
      const res = roomManager.reconnectSeat(socket, data.roomCode, data.sessionToken);
      if (callback) {
        callback({
          success: res.success,
          position: res.seat?.position,
          error: res.error,
        });
      }
    }
  );

  // 5. Start match
  socket.on(
    'start_match',
    (
      data: { roomCode: string; sessionToken: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const res = roomManager.startMatch(socket, data.roomCode, data.sessionToken);
      if (callback) callback(res);
    }
  );

  // 6. Place bid
  socket.on(
    'place_bid',
    (
      data: { roomCode: string; sessionToken: string; bid: number | 'PASS' },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const res = roomManager.handleBid(data.roomCode, data.sessionToken, data.bid);
      if (callback) callback(res);
    }
  );

  // 7. Select secret trump
  socket.on(
    'select_trump',
    (
      data: { roomCode: string; sessionToken: string; choice?: TrumpSelectionChoice; suit?: TrumpSelectionChoice },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const choice = data.choice || data.suit;
      const res = roomManager.handleSelectTrump(data.roomCode, data.sessionToken, choice as TrumpSelectionChoice);
      if (callback) callback(res);
    }
  );

  // 8. Reveal trump
  socket.on(
    'reveal_trump',
    (
      data: { roomCode: string; sessionToken: string; requestId?: string; playerPosition?: PlayerPosition; roundNumber?: number; trickNumber?: number },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const res = roomManager.handleRevealTrump(data.roomCode, data.sessionToken, data);
      if (callback) callback(res);
    }
  );

  // 9. Play card
  socket.on(
    'play_card',
    (
      data: { roomCode: string; sessionToken: string; cardId: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const res = roomManager.handlePlayCard(data.roomCode, data.sessionToken, data.cardId);
      if (callback) callback(res);
    }
  );

  // 10. Declare Pair / Royals
  socket.on(
    'declare_pair',
    (
      data: { roomCode: string; sessionToken: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const res = roomManager.handleDeclarePair(data.roomCode, data.sessionToken);
      if (callback) callback(res);
    }
  );

  // 11. Next round
  socket.on(
    'next_round',
    (
      data: { roomCode: string; sessionToken: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      const res = roomManager.handleNextRound(data.roomCode, data.sessionToken);
      if (callback) callback(res);
    }
  );

  // 12. Socket disconnect
  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

httpServer.listen(PORT, HOST, () => {
  const primaryIp = getPrimaryLanIp();
  const allIps = getLanIpAddresses();
  printHostBanner(PORT, primaryIp, allIps);
});
