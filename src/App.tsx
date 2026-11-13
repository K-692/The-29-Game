import React, { useState, useEffect, useRef } from 'react';
import { HomeView } from './components/lobby/HomeView';
import { CreateRoomModal } from './components/lobby/CreateRoomModal';
import { JoinRoomModal } from './components/lobby/JoinRoomModal';
import { LobbyView } from './components/lobby/LobbyView';
import { GameTable } from './components/table/GameTable';
import { CardPreviewGallery } from './components/card/CardPreviewGallery';
import { HowToPlayModal } from './components/lobby/HowToPlayModal';
import { 
  createRoom, 
  joinRoom, 
  RoomSession, 
  swapPlayerSeats, 
  toggleSeatCpu 
} from './services/roomService';
import { 
  getOrCreateUserProfile, 
  updateUserProfileName 
} from './services/supabase';
import { 
  initMultiplayerSession, 
  MultiplayerController 
} from './services/multiplayerState';
import { 
  DEFAULT_RULES_CONFIG, 
  GameRulesConfig, 
  GameState, 
  PlayerInfo, 
  PlayerPosition, 
  PublicGameState 
} from './engine/types';
import { Suit } from './assets/cardManifest';

type AppView = 'home' | 'lobby' | 'table' | 'gallery';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [userProfile, setUserProfile] = useState(() => getOrCreateUserProfile());
  const [activeSession, setActiveSession] = useState<RoomSession | null>(null);
  
  // Modals on Home
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [joinCodeParam, setJoinCodeParam] = useState<string>('');

  // Active game states
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [myPosition, setMyPosition] = useState<PlayerPosition>(0);

  const controllerRef = useRef<MultiplayerController | null>(null);

  // Check URL query param ?room=XYZ on load for invitation links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        setJoinCodeParam(roomParam.trim().toUpperCase());
        setShowJoinModal(true);
      }
    }
  }, []);

  // Clean up controller on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.cleanup();
      }
    };
  }, []);

  const handleUpdateName = (newName: string) => {
    const updated = updateUserProfileName(newName);
    setUserProfile(updated);
  };

  // 1. Create Room Flow
  const handleCreateRoom = async (
    hostName: string,
    rules: GameRulesConfig,
    cpuSeats: PlayerPosition[]
  ) => {
    const session = await createRoom(hostName, rules, cpuSeats);
    setActiveSession(session);
    setMyPosition(0);
    setShowCreateModal(false);
    setView('lobby');
  };

  // 2. Join Room Flow
  const handleJoinRoom = async (code: string, playerName: string) => {
    const res = await joinRoom(code, playerName);
    if (res.success && res.session) {
      setActiveSession(res.session);
      setMyPosition(res.playerPosition ?? 1);
      setShowJoinModal(false);
      setView('lobby');
    } else {
      alert(res.error || 'Failed to join room');
    }
  };

  // 3. Play with Computer Flow (Instant Match)
  const handlePlayWithComputer = async () => {
    // Host at P0 (Team A), Bots at P1 (Team B), P2 (Team A - Bot Partner), P3 (Team B)
    const session = await createRoom(userProfile.name, DEFAULT_RULES_CONFIG, [1, 2, 3]);
    setActiveSession(session);
    setMyPosition(0);

    // Immediately launch into game table
    const ctrl = initMultiplayerSession(
      session.roomCode,
      session.players,
      userProfile.id,
      (newState, newPublicState) => {
        setGameState(newState);
        setPublicState(newPublicState);
      }
    );
    controllerRef.current = ctrl;
    ctrl.dispatchStartGame();
    setView('table');
  };

  // Lobby: Toggle CPU seat
  const handleToggleCpuSeat = (pos: PlayerPosition) => {
    if (!activeSession) return;
    const updated = toggleSeatCpu(activeSession.players, pos);
    setActiveSession({ ...activeSession, players: updated });
  };

  // Lobby: Swap seats
  const handleSwapSeats = (posA: PlayerPosition, posB: PlayerPosition) => {
    if (!activeSession) return;
    const updated = swapPlayerSeats(activeSession.players, posA, posB);
    setActiveSession({ ...activeSession, players: updated });
  };

  // Lobby: Start Game
  const handleStartGameFromLobby = () => {
    if (!activeSession) return;

    const ctrl = initMultiplayerSession(
      activeSession.roomCode,
      activeSession.players,
      userProfile.id,
      (newState, newPublicState) => {
        setGameState(newState);
        setPublicState(newPublicState);
      }
    );
    controllerRef.current = ctrl;
    ctrl.dispatchStartGame();
    setView('table');
  };

  // Leave active game / room
  const handleLeaveToHome = () => {
    if (controllerRef.current) {
      controllerRef.current.cleanup();
      controllerRef.current = null;
    }
    setActiveSession(null);
    setGameState(null);
    setPublicState(null);
    // Clear URL query param if present
    if (typeof window !== 'undefined' && window.history.pushState) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.pushState({}, document.title, cleanUrl);
    }
    setView('home');
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* 1. Home View */}
      {view === 'home' && (
        <HomeView
          displayName={userProfile.name}
          onUpdateName={handleUpdateName}
          onCreateRoom={() => setShowCreateModal(true)}
          onJoinRoom={() => setShowJoinModal(true)}
          onPlayWithComputer={handlePlayWithComputer}
          onOpenGallery={() => setView('gallery')}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
        />
      )}

      {/* 2. Lobby View */}
      {view === 'lobby' && activeSession && (
        <LobbyView
          roomCode={activeSession.roomCode}
          players={activeSession.players}
          myPlayerId={userProfile.id}
          isHost={activeSession.hostId === userProfile.id}
          onToggleCpu={handleToggleCpuSeat}
          onSwapSeats={handleSwapSeats}
          onStartGame={handleStartGameFromLobby}
          onLeave={handleLeaveToHome}
        />
      )}

      {/* 3. Game Table View */}
      {view === 'table' && gameState && publicState && controllerRef.current && (
        <GameTable
          gameState={gameState}
          publicState={publicState}
          myPosition={myPosition}
          isHost={controllerRef.current.isHost}
          onBid={(bid) => controllerRef.current?.dispatchBid(bid)}
          onSelectTrump={(suit: Suit) => controllerRef.current?.dispatchTrumpSelection(suit)}
          onRevealTrump={() => controllerRef.current?.dispatchTrumpReveal()}
          onPlayCard={(cardId: string) => controllerRef.current?.dispatchCardPlay(cardId)}
          onDeclarePair={() => controllerRef.current?.dispatchPairDeclaration()}
          onNextRound={() => controllerRef.current?.dispatchNextRound()}
          onRematch={() => controllerRef.current?.dispatchRestartMatch()}
          onLeave={handleLeaveToHome}
        />
      )}

      {/* 4. Card Asset Verification Gallery */}
      {view === 'gallery' && (
        <CardPreviewGallery onBack={() => setView('home')} />
      )}

      {/* Modals on Home */}
      {showCreateModal && (
        <CreateRoomModal
          initialName={userProfile.name}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoom}
        />
      )}

      {showJoinModal && (
        <JoinRoomModal
          initialRoomCode={joinCodeParam}
          initialName={userProfile.name}
          onClose={() => setShowJoinModal(false)}
          onJoin={handleJoinRoom}
        />
      )}

      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}
    </div>
  );
}
