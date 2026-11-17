import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HomeView } from './components/lobby/HomeView';
import { CreateRoomModal } from './components/lobby/CreateRoomModal';
import { JoinRoomModal } from './components/lobby/JoinRoomModal';
import { LobbyView } from './components/lobby/LobbyView';
import { GameTable } from './components/table/GameTable';
import { CardPreviewGallery } from './components/card/CardPreviewGallery';
import { HowToPlayModal } from './components/lobby/HowToPlayModal';
import {
  ConnectionStatus,
  lanClient,
  LanRoomState,
  InTableNotification,
} from './services/lanClient';
import {
  GameRulesConfig,
  PlayerPosition,
  PublicGameState,
  TrumpSelectionChoice,
} from './engine/types';
import { soundManager } from './common/SoundManager';

type AppView = 'home' | 'lobby' | 'table' | 'gallery';

const STORAGE_USERNAME = 'twenty_nine_username';

const readStoredName = (): string => {
  try {
    return localStorage.getItem(STORAGE_USERNAME) || 'Player';
  } catch {
    return 'Player';
  }
};

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [userName, setUserName] = useState<string>(readStoredName);

  // Modals on Home
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [joinCodeParam, setJoinCodeParam] = useState<string>('');

  // Active LAN Game State
  const [roomState, setRoomState] = useState<LanRoomState | null>(null);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [myPosition, setMyPosition] = useState<PlayerPosition>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(15);
  const [notification, setNotification] = useState<InTableNotification | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [startError, setStartError] = useState<string | null>(null);

  const myPositionRef = useRef(myPosition);
  myPositionRef.current = myPosition;
  const viewRef = useRef(view);
  viewRef.current = view;

  const resetToHome = useCallback(() => {
    setRoomState(null);
    setPublicState(null);
    setStartError(null);
    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    }
    setView('home');
  }, []);

  // One-time socket setup and subscriptions (listeners survive host changes / reconnects).
  useEffect(() => {
    const saved = lanClient.getSavedSession();
    lanClient.connect(saved?.hostUrl);
    setConnectionStatus(lanClient.getStatus());

    const unsubs = [
      lanClient.onConnectionStatus(setConnectionStatus),

      lanClient.onRoomUpdate((room) => {
        setRoomState(room);
        if (viewRef.current === 'home' || viewRef.current === 'gallery') {
          setShowCreateModal(false);
          setShowJoinModal(false);
        }
        if (!room.isStarted && viewRef.current !== 'lobby') {
          setView('lobby');
        }
      }),

      lanClient.onGameStateUpdate(({ publicState: pubState, myPosition: pos }) => {
        setPublicState(pubState);
        setMyPosition(pos);
        setStartError(null);
        setShowCreateModal(false);
        setShowJoinModal(false);
        if (viewRef.current !== 'table') setView('table');
      }),

      lanClient.onTimerTick((tick) => {
        // Use the server's remaining seconds directly: device clocks on a LAN often disagree.
        setRemainingSeconds(tick.remainingSeconds);
        if (
          tick.turnPosition === myPositionRef.current &&
          (tick.phase === 'BIDDING' || tick.phase === 'TRUMP_SELECTION' || tick.phase === 'TRICK_PLAY') &&
          tick.remainingSeconds <= 5 &&
          tick.remainingSeconds > 0
        ) {
          soundManager.playEventOnce(`tick_${tick.turnId || tick.turnDeadline}_${tick.remainingSeconds}`, () => soundManager.playTick());
        }
      }),

      lanClient.onInTableNotification((notif) => {
        if (notif.type === 'TIMEOUT_AUTO_PLAY') return;
        setNotification(notif);
        if (notif.type === 'PAIR_DECLARED') {
          soundManager.playEventOnce(`pair_notif_${notif.timestamp}`, () => soundManager.playWin());
        }
        window.setTimeout(() => {
          setNotification((current) => (current?.timestamp === notif.timestamp ? null : current));
        }, 4500);
      }),

      lanClient.onSessionLost(() => {
        resetToHome();
      }),
    ];

    // Invite link: ?room=XYZ opens the join dialog (unless we're already seated somewhere).
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam && !saved) {
      setJoinCodeParam(roomParam.trim().toUpperCase());
      setShowJoinModal(true);
    }

    return () => unsubs.forEach((u) => u());
  }, [resetToHome]);

  const handleUpdateName = (newName: string) => {
    const trimmed = newName.trim().slice(0, 20);
    setUserName(trimmed);
    try {
      localStorage.setItem(STORAGE_USERNAME, trimmed);
    } catch {
      /* ignore */
    }
  };

  // 1. Create Room Flow
  const handleCreateRoom = async (
    hostName: string,
    rules: GameRulesConfig,
    preferredSeat: PlayerPosition
  ): Promise<string | null> => {
    handleUpdateName(hostName);
    const res = await lanClient.createRoom(hostName, rules, preferredSeat);
    if (res.success && res.roomCode) {
      setMyPosition(res.position ?? preferredSeat);
      setShowCreateModal(false);
      setView('lobby');
      return null;
    }
    return res.error || 'Could not create the room. Is the LAN host server running?';
  };

  // 2. Join Room Flow
  const handleJoinRoom = async (
    code: string,
    playerName: string,
    hostAddress: string,
    preferredSeat?: PlayerPosition
  ): Promise<string | null> => {
    handleUpdateName(playerName);
    if (hostAddress) {
      lanClient.connect(hostAddress);
    }
    const res = await lanClient.joinRoom(code, playerName, preferredSeat);
    if (res.success && res.roomCode) {
      setMyPosition(res.position ?? 0);
      setShowJoinModal(false);
      // Lobby join → lobby; in-progress match → the game_state_update switches to the table.
      setView((v) => (v === 'table' ? v : 'lobby'));
      return null;
    }
    return res.error || 'Could not join. Check the room code and that you are on the same Wi-Fi as the host.';
  };

  // 3. Lobby: Select / Switch seat
  const handleSelectSeat = async (pos: PlayerPosition) => {
    const res = await lanClient.selectSeat(pos);
    if (res.success) {
      setMyPosition(pos);
    } else if (res.error) {
      setStartError(res.error);
    }
  };

  // 4. Lobby: Start Match
  const handleStartMatch = async () => {
    setStartError(null);
    const res = await lanClient.startMatch();
    if (!res.success && res.error) {
      setStartError(res.error);
    }
  };

  // 5. Leave Room / Return to Home
  const handleLeaveToHome = async () => {
    await lanClient.leaveRoom();
    resetToHome();
  };

  const showActionError = (error?: string) => {
    if (!error) return;
    soundManager.playError();
    setNotification({ type: 'INFO', message: error, timestamp: Date.now() });
  };

  // In-Table Game Actions
  const handleBid = async (bid: number | 'PASS') => {
    const res = await lanClient.placeBid(bid);
    if (!res.success) showActionError(res.error);
  };

  const handleSelectTrump = (choice: TrumpSelectionChoice) => {
    lanClient.selectTrump(choice).then((res) => {
      if (!res.success) showActionError(res.error);
    });
  };

  const handleRevealTrump = (payload?: { requestId?: string; playerPosition?: PlayerPosition; roundNumber?: number; trickNumber?: number }) =>
    lanClient.revealTrump(payload);

  const handlePlayCard = async (cardId: string) => {
    const res = await lanClient.playCard(cardId);
    if (!res.success) showActionError(res.error);
    return res;
  };

  const handleDoubleDecision = async (decision: 'DOUBLE' | 'PASS') => {
    const res = await lanClient.submitDoubleDecision(decision);
    if (!res.success) showActionError(res.error);
    return res;
  };

  const handleRedoubleDecision = async (decision: 'REDOUBLE' | 'PASS') => {
    const res = await lanClient.submitRedoubleDecision(decision);
    if (!res.success) showActionError(res.error);
    return res;
  };

  const handleNextRound = () => {
    lanClient.nextRound();
  };

  const handleRematch = () => {
    lanClient.startMatch().then((res) => {
      if (!res.success) showActionError(res.error);
    });
  };

  const isHost = Boolean(roomState?.seats.find((s) => s.position === myPosition)?.isHost);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans">
      {view === 'home' && (
        <HomeView
          displayName={userName}
          onUpdateName={handleUpdateName}
          onCreateRoom={() => setShowCreateModal(true)}
          onJoinRoom={() => setShowJoinModal(true)}
          onOpenGallery={() => setView('gallery')}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
        />
      )}

      {view === 'lobby' && roomState && (
        <LobbyView
          roomCode={roomState.roomCode}
          seats={roomState.seats}
          myPosition={myPosition}
          isHost={isHost}
          onSelectSeat={handleSelectSeat}
          onStartMatch={handleStartMatch}
          onLeave={handleLeaveToHome}
          startError={startError}
        />
      )}

      {view === 'table' && publicState && (
        <GameTable
          publicState={publicState}
          myPosition={myPosition}
          isHost={isHost}
          remainingSeconds={remainingSeconds}
          notification={notification}
          connectionStatus={connectionStatus}
          onBid={handleBid}
          onSelectTrump={handleSelectTrump}
          onDoubleDecision={handleDoubleDecision}
          onRedoubleDecision={handleRedoubleDecision}
          onRevealTrump={handleRevealTrump}
          onPlayCard={handlePlayCard}
          onNextRound={handleNextRound}
          onRematch={handleRematch}
          onLeave={handleLeaveToHome}
        />
      )}

      {view === 'gallery' && <CardPreviewGallery onBack={() => setView('home')} />}

      {view === 'home' && showCreateModal && (
        <CreateRoomModal
          initialName={userName}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoom}
        />
      )}

      {view === 'home' && showJoinModal && (
        <JoinRoomModal
          initialRoomCode={joinCodeParam}
          initialName={userName}
          onClose={() => setShowJoinModal(false)}
          onJoin={handleJoinRoom}
        />
      )}

      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
    </div>
  );
}
