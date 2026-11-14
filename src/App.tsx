import React, { useState, useEffect } from 'react';
import { HomeView } from './components/lobby/HomeView';
import { CreateRoomModal } from './components/lobby/CreateRoomModal';
import { JoinRoomModal } from './components/lobby/JoinRoomModal';
import { LobbyView } from './components/lobby/LobbyView';
import { GameTable } from './components/table/GameTable';
import { CardPreviewGallery } from './components/card/CardPreviewGallery';
import { HowToPlayModal } from './components/lobby/HowToPlayModal';
import { 
  lanClient, 
  LanRoomState, 
  InTableNotification 
} from './services/lanClient';
import { 
  DEFAULT_RULES_CONFIG, 
  GameRulesConfig, 
  GameState, 
  PlayerPosition, 
  PublicGameState,
  TrumpSelectionChoice 
} from './engine/types';
import { Suit } from './assets/cardManifest';
import { soundManager } from './common/SoundManager';

type AppView = 'home' | 'lobby' | 'table' | 'gallery';

const STORAGE_USERNAME = 'twenty_nine_username';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [userName, setUserName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_USERNAME) || 'Player';
    }
    return 'Player';
  });

  // Modals on Home
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [joinCodeParam, setJoinCodeParam] = useState<string>('');

  // Active LAN Game State
  const [roomState, setRoomState] = useState<LanRoomState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [myPosition, setMyPosition] = useState<PlayerPosition>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(60);
  const [notification, setNotification] = useState<InTableNotification | null>(null);

  // Initialize Socket and Listeners
  useEffect(() => {
    lanClient.connect();

    const unsubRoom = lanClient.onRoomUpdate((updatedRoom) => {
      setRoomState(updatedRoom);
      if (updatedRoom.isStarted && view === 'lobby') {
        setView('table');
      }
    });

    const unsubGame = lanClient.onGameStateUpdate(({ gameState: fullState, publicState: pubState, myPosition: pos }) => {
      setGameState(fullState);
      setPublicState(pubState);
      if (pos !== undefined) {
        setMyPosition(pos);
      }
      setView('table');
    });

    const unsubTimer = lanClient.onTimerTick((tick) => {
      setRemainingSeconds(tick.remainingSeconds);
      if (tick.remainingSeconds <= 5 && tick.remainingSeconds > 0) {
        soundManager.playTick();
      }
    });

    const unsubNotif = lanClient.onInTableNotification((notif) => {
      if (notif.type === 'TIMEOUT_AUTO_PLAY') return; // Silent timeout handling (strictly no popups)
      setNotification(notif);
      if (notif.type === 'TRUMP_REVEALED') {
        soundManager.playTrump();
      } else if (notif.type === 'PAIR_DECLARED') {
        soundManager.playWin();
      }
      setTimeout(() => {
        setNotification((current) => (current?.timestamp === notif.timestamp ? null : current));
      }, 4500);
    });

    // Check URL query param ?room=XYZ
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        setJoinCodeParam(roomParam.trim().toUpperCase());
        setShowJoinModal(true);
      } else {
        // Attempt session reconnect if returning to same LAN room
        const saved = lanClient.getSavedSession();
        if (saved) {
          lanClient.reconnectSeat(saved.roomCode, saved.sessionToken).then((res) => {
            if (res.success && res.position !== undefined) {
              setMyPosition(res.position);
            }
          });
        }
      }
    }

    return () => {
      unsubRoom();
      unsubGame();
      unsubTimer();
      unsubNotif();
    };
  }, [view]);

  const handleUpdateName = (newName: string) => {
    const trimmed = newName.trim();
    setUserName(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_USERNAME, trimmed);
    }
  };

  // 1. Create Room Flow
  const handleCreateRoom = async (
    hostName: string,
    rules: GameRulesConfig,
    preferredSeat: PlayerPosition
  ) => {
    handleUpdateName(hostName);
    const res = await lanClient.createRoom(hostName, rules, preferredSeat);
    if (res.success && res.roomCode) {
      setMyPosition(res.position ?? preferredSeat);
      setShowCreateModal(false);
      setView('lobby');
    } else {
      alert(res.error || 'Failed to create LAN room');
    }
  };

  // 2. Join Room Flow
  const handleJoinRoom = async (
    code: string,
    playerName: string,
    hostAddress: string,
    preferredSeat?: PlayerPosition
  ) => {
    handleUpdateName(playerName);
    if (hostAddress) {
      lanClient.connect(hostAddress);
    }
    const res = await lanClient.joinRoom(code, playerName, preferredSeat);
    if (res.success && res.roomCode) {
      setMyPosition(res.position ?? 1);
      setShowJoinModal(false);
      setView('lobby');
    } else {
      alert(res.error || 'Failed to join LAN room. Verify host IP and room code.');
    }
  };

  // 3. Play with Computer (Instant 1P + 3 Bots match)
  const handlePlayWithComputer = async () => {
    const res = await lanClient.createRoom(userName, DEFAULT_RULES_CONFIG, 0);
    if (res.success) {
      setMyPosition(0);
      setShowCreateModal(false);
      // Immediately start match (server will auto-fill seats 1, 2, 3 with CPU bots!)
      await lanClient.startMatch();
      setView('table');
    } else {
      alert(res.error || 'Failed to start instant match');
    }
  };

  // 4. Lobby: Select / Switch seat
  const handleSelectSeat = async (pos: PlayerPosition) => {
    const res = await lanClient.selectSeat(pos);
    if (res.success) {
      setMyPosition(pos);
    } else if (res.error) {
      alert(res.error);
    }
  };

  // 5. Lobby: Start Match
  const handleStartMatch = async () => {
    const res = await lanClient.startMatch();
    if (!res.success && res.error) {
      alert(res.error);
    }
  };

  // 6. Leave Room / Return to Home
  const handleLeaveToHome = () => {
    lanClient.clearSavedSession();
    setRoomState(null);
    setGameState(null);
    setPublicState(null);

    // Clean URL params if present
    if (typeof window !== 'undefined' && window.history.pushState) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.pushState({}, document.title, cleanUrl);
    }

    setView('home');
  };

  // In-Table Game Actions
  const handleBid = async (bid: number | 'PASS') => {
    soundManager.playChip();
    const res = await lanClient.placeBid(bid);
    if (!res.success && res.error) {
      console.warn('Bid action rejected:', res.error);
      soundManager.playError();
      setNotification({
        type: 'INFO',
        message: res.error,
        timestamp: Date.now(),
      });
    }
  };

  const handleSelectTrump = (choice: TrumpSelectionChoice) => {
    soundManager.playTrump();
    lanClient.selectTrump(choice);
  };

  const handleRevealTrump = () => {
    soundManager.playTrump();
    lanClient.revealTrump();
  };

  const handlePlayCard = (cardId: string) => {
    soundManager.playCard();
    lanClient.playCard(cardId);
  };

  const handleDeclarePair = () => {
    soundManager.playWin();
    lanClient.declarePair();
  };

  const handleNextRound = () => {
    soundManager.playDeal();
    lanClient.nextRound();
  };

  const handleRematch = () => {
    lanClient.startMatch();
  };

  const isHost = Boolean(roomState?.seats.find((s) => s.position === myPosition)?.isHost);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* 1. Home View */}
      {view === 'home' && (
        <HomeView
          displayName={userName}
          onUpdateName={handleUpdateName}
          onCreateRoom={() => setShowCreateModal(true)}
          onJoinRoom={() => setShowJoinModal(true)}
          onPlayWithComputer={handlePlayWithComputer}
          onOpenGallery={() => setView('gallery')}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
        />
      )}

      {/* 2. Lobby View */}
      {view === 'lobby' && roomState && (
        <LobbyView
          roomCode={roomState.roomCode}
          seats={roomState.seats}
          myPosition={myPosition}
          isHost={isHost}
          onSelectSeat={handleSelectSeat}
          onStartMatch={handleStartMatch}
          onLeave={handleLeaveToHome}
        />
      )}

      {/* 3. Game Table View (100% In-Table, Strictly No Popups) */}
      {view === 'table' && publicState && gameState && (
        <GameTable
          gameState={gameState}
          publicState={publicState}
          myPosition={myPosition}
          isHost={isHost}
          remainingSeconds={remainingSeconds}
          notification={notification}
          onBid={handleBid}
          onSelectTrump={handleSelectTrump}
          onRevealTrump={handleRevealTrump}
          onPlayCard={handlePlayCard}
          onDeclarePair={handleDeclarePair}
          onNextRound={handleNextRound}
          onRematch={handleRematch}
          onLeave={handleLeaveToHome}
        />
      )}

      {/* 4. Original Card Assets Gallery (EPS Vector Inspection) */}
      {view === 'gallery' && (
        <CardPreviewGallery onBack={() => setView('home')} />
      )}

      {/* Modals on Home (Only on Home View) */}
      {showCreateModal && (
        <CreateRoomModal
          initialName={userName}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoom}
        />
      )}

      {showJoinModal && (
        <JoinRoomModal
          initialRoomCode={joinCodeParam}
          initialName={userName}
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
